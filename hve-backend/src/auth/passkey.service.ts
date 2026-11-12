import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from './auth.service.js';

const RP_NAME = 'HVE Work';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_PASSKEYS_PER_USER = 5;

/**
 * Đăng nhập bằng vân tay / khuôn mặt qua WebAuthn (passkey). Hệ thống chỉ lưu
 * khóa công khai; sinh trắc học luôn nằm trên thiết bị của người dùng.
 */
@Injectable()
export class PasskeyService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private authService: AuthService,
  ) {}

  private get rpID(): string {
    return process.env.WEBAUTHN_RP_ID || 'work.huyvoeducation.vn';
  }

  private get origins(): string[] {
    return (process.env.WEBAUTHN_ORIGINS || 'https://work.huyvoeducation.vn')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  private async storeChallenge(
    challenge: string,
    purpose: 'register' | 'login',
    userId: number | null,
  ) {
    await this.prisma.passkeyChallenge.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          ...(userId ? [{ userId, purpose }] : []),
        ],
      },
    });
    const created = await this.prisma.passkeyChallenge.create({
      data: {
        challenge,
        purpose,
        userId,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });
    return created.id;
  }

  /** Lấy và hủy thử thách ngay (chỉ dùng được một lần). */
  private async consumeChallenge(
    challengeId: string,
    purpose: 'register' | 'login',
    userId: number | null,
  ) {
    const found = await this.prisma.passkeyChallenge.findUnique({
      where: { id: challengeId },
    });
    if (found) {
      await this.prisma.passkeyChallenge
        .delete({ where: { id: challengeId } })
        .catch(() => undefined);
    }
    if (
      !found ||
      found.purpose !== purpose ||
      found.expiresAt < new Date() ||
      (userId !== null && found.userId !== userId)
    ) {
      throw new BadRequestException(
        'Phiên xác thực đã hết hạn. Vui lòng thử lại.',
      );
    }
    return found.challenge;
  }

  async registerOptions(userId: number, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại');
    if (!(await bcrypt.compare(password || '', user.passwordHash))) {
      // 400 (không phải 401) để nhập sai mật khẩu không bị hiểu là hết phiên đăng nhập.
      throw new BadRequestException('Mật khẩu không chính xác');
    }

    const existing = await this.prisma.userPasskey.findMany({
      where: { userId },
      select: { credentialId: true, transports: true },
    });
    if (existing.length >= MAX_PASSKEYS_PER_USER) {
      throw new BadRequestException(
        `Mỗi tài khoản chỉ bật tối đa ${MAX_PASSKEYS_PER_USER} thiết bị. Hãy xóa bớt thiết bị cũ.`,
      );
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: this.rpID,
      userName: user.email,
      userDisplayName: user.name,
      userID: new TextEncoder().encode(String(user.id)),
      attestationType: 'none',
      excludeCredentials: existing.map((item) => ({
        id: item.credentialId,
        transports: (item.transports as any) || undefined,
      })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
    });
    const challengeId = await this.storeChallenge(
      options.challenge,
      'register',
      userId,
    );
    return { challengeId, options };
  }

  async registerVerify(
    userId: number,
    dto: { challengeId: string; response: any; deviceLabel?: string },
    ip?: string,
    device?: string,
  ) {
    const expectedChallenge = await this.consumeChallenge(
      dto.challengeId,
      'register',
      userId,
    );

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: dto.response,
        expectedChallenge,
        expectedOrigin: this.origins,
        expectedRPID: this.rpID,
        requireUserVerification: true,
      });
    } catch {
      throw new BadRequestException(
        'Không xác minh được vân tay / khuôn mặt trên thiết bị này. Vui lòng thử lại.',
      );
    }
    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Không xác minh được thiết bị. Vui lòng thử lại.');
    }

    const { credential } = verification.registrationInfo;
    try {
      const saved = await this.prisma.userPasskey.create({
        data: {
          userId,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey).toString('base64url'),
          counter: credential.counter,
          transports: (credential.transports as any) ?? undefined,
          deviceLabel: (dto.deviceLabel || device || 'Thiết bị').slice(0, 100),
        },
      });
      await this.auditService.logEvent({
        entityType: 'User',
        entityId: userId,
        action: 'passkey_registered',
        actorId: userId,
        ip,
        device,
      });
      return { id: saved.id, deviceLabel: saved.deviceLabel };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new BadRequestException('Thiết bị này đã được bật đăng nhập sinh trắc học.');
      }
      throw error;
    }
  }

  async loginOptions() {
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: 'required',
    });
    const challengeId = await this.storeChallenge(options.challenge, 'login', null);
    return { challengeId, options };
  }

  async loginVerify(
    dto: { challengeId: string; response: any },
    ip?: string,
    device?: string,
  ) {
    const failure = new UnauthorizedException(
      'Không đăng nhập được bằng vân tay / khuôn mặt. Vui lòng dùng mật khẩu hoặc bật lại trong Hồ sơ cá nhân.',
    );
    let expectedChallenge: string;
    try {
      expectedChallenge = await this.consumeChallenge(dto.challengeId, 'login', null);
    } catch {
      throw failure;
    }

    const credentialId = dto.response?.id;
    const passkey =
      typeof credentialId === 'string'
        ? await this.prisma.userPasskey.findUnique({ where: { credentialId } })
        : null;
    if (!passkey) throw failure;

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: dto.response,
        expectedChallenge,
        expectedOrigin: this.origins,
        expectedRPID: this.rpID,
        requireUserVerification: true,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64url')),
          counter: passkey.counter,
          transports: (passkey.transports as any) || undefined,
        },
      });
    } catch {
      await this.auditService.logEvent({
        entityType: 'User',
        entityId: passkey.userId,
        action: 'login_passkey_failed',
        actorId: passkey.userId,
        ip,
        device,
      });
      throw failure;
    }
    if (!verification.verified) throw failure;

    await this.prisma.userPasskey.update({
      where: { id: passkey.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    });
    return this.authService.completePasskeyLogin(passkey.userId, ip, device);
  }

  async list(userId: number) {
    return this.prisma.userPasskey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true },
    });
  }

  async remove(userId: number, id: string, ip?: string) {
    const result = await this.prisma.userPasskey.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Không tìm thấy thiết bị');
    }
    await this.auditService.logEvent({
      entityType: 'User',
      entityId: userId,
      action: 'passkey_revoked',
      actorId: userId,
      ip,
    });
    return { success: true };
  }
}
