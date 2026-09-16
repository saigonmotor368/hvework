import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import {
  SetApprovalPinDto,
  ToggleApprovalPinDto,
} from './dto/set-approval-pin.dto.js';
import { VerifyLoginDto } from './dto/verify-login.dto.js';
import { LoginVerificationMailer } from './login-verification-mailer.service.js';
import { createHash, randomInt, randomUUID } from 'node:crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService,
    private loginVerificationMailer: LoginVerificationMailer,
  ) {}

  private hashDevice(deviceId: string): string {
    return createHash('sha256').update(deviceId).digest('hex');
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local.slice(0, 2)}***@${domain}`;
  }

  private tokenPair(user: { id: number; email: string }) {
    const payload = { email: user.email, sub: user.id };
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }

  private publicUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      department: user.department?.name || null,
      departmentId: user.departmentId || null,
      roles: user.roles.map((r: { name: string }) => r.name),
    };
  }

  async login(loginDto: LoginDto, ip?: string, device?: string) {
    const { email, password } = loginDto;
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: true, department: true },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (user.status === 'locked') {
      throw new UnauthorizedException(
        'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.',
      );
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const waitMinutes = Math.ceil(
        (user.lockedUntil.getTime() - now.getTime()) / 60000,
      );
      throw new UnauthorizedException(
        `Tài khoản tạm thời bị khoá do đăng nhập sai nhiều lần. Vui lòng thử lại sau ${waitMinutes} phút.`,
      );
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const newAttempts = user.failedLoginAttempts + 1;
      const isLocking = newAttempts >= 5;
      const lockedUntil = isLocking
        ? new Date(now.getTime() + 15 * 60 * 1000)
        : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          lockedUntil,
        },
      });

      await this.auditService.logEvent({
        entityType: 'User',
        entityId: user.id,
        action: isLocking ? 'login_locked' : 'login_failed',
        actorId: user.id,
        ip,
        device,
      });

      if (isLocking) {
        throw new UnauthorizedException(
          'Tài khoản đã bị tạm khoá 15 phút do nhập sai mật khẩu 5 lần liên tiếp.',
        );
      }

      throw new UnauthorizedException(
        `Email hoặc mật khẩu không chính xác. Đã nhập sai ${newAttempts}/5 lần.`,
      );
    }

    if (this.loginVerificationMailer.isEnabled()) {
      if (!loginDto.deviceId) {
        throw new BadRequestException(
          'Thiết bị đăng nhập không hợp lệ. Vui lòng tải lại trang.',
        );
      }

      const deviceHash = this.hashDevice(loginDto.deviceId);
      const trustedDevice = await this.prisma.trustedDevice.findUnique({
        where: { userId_deviceHash: { userId: user.id, deviceHash } },
      });
      const firstLogin = !user.emailVerifiedAt;

      if (firstLogin || !trustedDevice || trustedDevice.revokedAt) {
        const code = randomInt(100000, 1000000).toString();
        const challengeId = randomUUID();
        const otpHash = await bcrypt.hash(code, 10);

        await this.prisma.loginChallenge.deleteMany({
          where: { userId: user.id, deviceHash, consumedAt: null },
        });
        await this.prisma.loginChallenge.create({
          data: {
            id: challengeId,
            userId: user.id,
            otpHash,
            deviceHash,
            deviceLabel: loginDto.deviceName || device,
            ip,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });

        try {
          await this.loginVerificationMailer.sendLoginCode({
            email: user.email,
            name: user.name,
            code,
            deviceName: loginDto.deviceName || device,
            ip,
            firstLogin,
            challengeId,
          });
        } catch (error) {
          await this.prisma.loginChallenge.delete({
            where: { id: challengeId },
          });
          throw error;
        }

        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            refreshTokenHash: null,
          },
        });
        await this.auditService.logEvent({
          entityType: 'User',
          entityId: user.id,
          action: firstLogin
            ? 'first_login_email_requested'
            : 'unfamiliar_device_challenge',
          actorId: user.id,
          ip,
          device: loginDto.deviceName || device,
        });

        return {
          requiresEmailVerification: true,
          challengeId,
          maskedEmail: this.maskEmail(user.email),
          message: 'Mã xác minh đăng nhập đã được gửi tới email công việc.',
        };
      }

      await this.prisma.trustedDevice.update({
        where: { id: trustedDevice.id },
        data: {
          lastUsedAt: new Date(),
          lastIp: ip,
          label: loginDto.deviceName || device,
        },
      });
    }

    const { accessToken, refreshToken } = this.tokenPair(user);
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        refreshTokenHash,
      },
    });

    await this.auditService.logEvent({
      entityType: 'User',
      entityId: user.id,
      action: 'login',
      actorId: user.id,
      ip,
      device,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: this.publicUser(user),
    };
  }

  async verifyLoginChallenge(
    dto: VerifyLoginDto,
    ip?: string,
    device?: string,
  ) {
    const challenge = await this.prisma.loginChallenge.findUnique({
      where: { id: dto.challengeId },
      include: { user: { include: { roles: true, department: true } } },
    });

    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt < new Date() ||
      challenge.deviceHash !== this.hashDevice(dto.deviceId)
    ) {
      throw new UnauthorizedException(
        'Phiên xác minh không hợp lệ hoặc đã hết hạn',
      );
    }

    if (challenge.attempts >= 5) {
      throw new UnauthorizedException(
        'Mã xác minh đã bị khóa do nhập sai quá nhiều lần',
      );
    }

    const isMatch = await bcrypt.compare(dto.code, challenge.otpHash);
    if (!isMatch) {
      const attempts = challenge.attempts + 1;
      await this.prisma.loginChallenge.update({
        where: { id: challenge.id },
        data: { attempts },
      });
      await this.auditService.logEvent({
        entityType: 'User',
        entityId: challenge.userId,
        action:
          attempts >= 5 ? 'login_email_code_locked' : 'login_email_code_failed',
        actorId: challenge.userId,
        ip,
        device,
      });
      throw new UnauthorizedException(
        attempts >= 5
          ? 'Mã xác minh đã bị khóa do nhập sai 5 lần'
          : `Mã xác minh không chính xác. Đã nhập sai ${attempts}/5 lần.`,
      );
    }

    const user = challenge.user;
    if (user.status !== 'active') {
      throw new UnauthorizedException('Tài khoản không hoạt động');
    }

    const { accessToken, refreshToken } = this.tokenPair(user);
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const verifiedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.loginChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: verifiedAt },
      }),
      this.prisma.trustedDevice.upsert({
        where: {
          userId_deviceHash: {
            userId: user.id,
            deviceHash: challenge.deviceHash,
          },
        },
        create: {
          userId: user.id,
          deviceHash: challenge.deviceHash,
          label: challenge.deviceLabel || device,
          lastIp: ip || challenge.ip,
          lastUsedAt: verifiedAt,
        },
        update: {
          revokedAt: null,
          label: challenge.deviceLabel || device,
          lastIp: ip || challenge.ip,
          lastUsedAt: verifiedAt,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: user.emailVerifiedAt || verifiedAt,
          refreshTokenHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
    ]);

    await this.auditService.logEvent({
      entityType: 'User',
      entityId: user.id,
      action: user.emailVerifiedAt
        ? 'unfamiliar_device_verified'
        : 'first_login_email_verified',
      actorId: user.id,
      ip,
      device: challenge.deviceLabel || device,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: this.publicUser(user),
    };
  }

  async refreshToken(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: true, department: true },
    });

    if (!user || user.status !== 'active' || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const isTokenMatch = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );
    if (!isTokenMatch) {
      throw new UnauthorizedException('Refresh token đã bị thu hồi');
    }

    const newPayload = { email: user.email, sub: user.id };
    const newAccessToken = this.jwtService.sign(newPayload, {
      expiresIn: '15m',
    });
    const newRefreshToken = this.jwtService.sign(newPayload, {
      expiresIn: '7d',
    });
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: newRefreshTokenHash },
    });

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }

  async forgotPassword(email: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Do not reveal whether user exists
      return {
        message:
          'Nếu email tồn tại trong hệ thống, mã xác thực đặt lại mật khẩu đã được gửi.',
      };
    }

    // Generate a 6-digit OTP
    const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetOtp,
        passwordResetExpires: expiresAt,
      },
    });

    await this.auditService.logEvent({
      entityType: 'User',
      entityId: user.id,
      action: 'forgot_password_request',
      actorId: user.id,
      ip,
    });

    console.log(`[AUTH-EMAIL-OTP] OTP for ${email}: ${resetOtp}`);

    return {
      message:
        'Mã xác thực đặt lại mật khẩu (OTP) đã được gửi tới email của bạn và có hiệu lực trong 15 phút.',
      // In dev environment, provide otp for testing convenience
      otpDev: process.env.NODE_ENV === 'production' ? undefined : resetOtp,
    };
  }

  async resetPassword(dto: ResetPasswordDto, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

    if (
      !user.passwordResetToken ||
      user.passwordResetToken !== dto.token ||
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ) {
      throw new BadRequestException('Mã xác thực không hợp lệ hoặc đã hết hạn');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await this.auditService.logEvent({
      entityType: 'User',
      entityId: user.id,
      action: 'password_reset',
      actorId: user.id,
      ip,
    });

    return {
      message:
        'Đặt lại mật khẩu thành công. Vui lòng đăng nhập với mật khẩu mới.',
    };
  }

  /**
   * Đặt hoặc đổi mã PIN xác nhận duyệt (6 số) — bắt buộc nhập đúng mật khẩu
   * đăng nhập hiện tại để xác nhận, vì đây là thao tác đổi 1 thông tin bảo mật.
   */
  async setApprovalPin(userId: number, dto: SetApprovalPinDto, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const passwordMatch = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!passwordMatch) {
      throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    }

    const pinHash = await bcrypt.hash(dto.newPin, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        approvalPinHash: pinHash,
        approvalPinEnabled: true,
        approvalPinFailedAttempts: 0,
        approvalPinLockedUntil: null,
      },
    });

    await this.auditService.logEvent({
      entityType: 'User',
      entityId: userId,
      action: user.approvalPinHash
        ? 'approval_pin_changed'
        : 'approval_pin_set',
      actorId: userId,
      ip,
    });

    return { message: 'Đã lưu mã PIN xác nhận duyệt.' };
  }

  /**
   * Cho frontend biết user đã đặt PIN chưa, để hiển thị đúng lời nhắc
   * (không trả về hash, chỉ trả về cờ boolean).
   */
  async getApprovalPinStatus(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { approvalPinHash: true, approvalPinEnabled: true },
    });
    return {
      hasPin: !!user?.approvalPinHash,
      enabled: !!user?.approvalPinEnabled,
    };
  }

  /**
   * Dùng bởi DocumentsService để quyết định có bắt buộc mã PIN ở bước duyệt
   * cuối cùng của CEO hay không — CEO có thể tự tắt tính năng này.
   */
  async isApprovalPinEnabled(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { approvalPinEnabled: true },
    });
    return !!user?.approvalPinEnabled;
  }

  /**
   * Bật/tắt yêu cầu mã PIN cho bước duyệt cuối cùng. Bật thì cần đã có PIN
   * sẵn (đặt qua setApprovalPin trước). Tắt trong khi đang bật thì bắt buộc
   * nhập đúng mã PIN hiện tại để xác nhận, tránh người khác lén tắt bảo vệ.
   */
  async setApprovalPinEnabled(
    userId: number,
    dto: ToggleApprovalPinDto,
    ip?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    if (dto.enabled) {
      if (!user.approvalPinHash) {
        throw new BadRequestException(
          'Bạn cần đặt mã PIN trước khi bật tính năng xác nhận duyệt bằng PIN.',
        );
      }
    } else if (user.approvalPinEnabled && user.approvalPinHash) {
      if (!dto.pin) {
        throw new BadRequestException(
          'Cần nhập đúng mã PIN hiện tại để xác nhận tắt tính năng này.',
        );
      }
      await this.verifyApprovalPin(userId, dto.pin);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { approvalPinEnabled: dto.enabled },
    });

    await this.auditService.logEvent({
      entityType: 'User',
      entityId: userId,
      action: dto.enabled ? 'approval_pin_enabled' : 'approval_pin_disabled',
      actorId: userId,
      ip,
    });

    return {
      enabled: dto.enabled,
      message: dto.enabled
        ? 'Đã bật yêu cầu mã PIN cho bước duyệt cuối cùng.'
        : 'Đã tắt yêu cầu mã PIN cho bước duyệt cuối cùng.',
    };
  }

  /**
   * Xác thực mã PIN duyệt trước khi cho phép thực hiện hành động phê duyệt
   * quan trọng (bước duyệt cuối của CEO). Có khoá riêng sau 5 lần sai liên
   * tiếp (15 phút) — tách biệt với khoá đăng nhập, để tránh 1 người cố tình
   * dò PIN khoá luôn cả tài khoản CEO không đăng nhập được.
   */
  async verifyApprovalPin(userId: number, pin: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    if (!user.approvalPinHash) {
      throw new BadRequestException(
        'Bạn chưa đặt mã PIN xác nhận duyệt. Vào Hồ sơ cá nhân để thiết lập trước khi phê duyệt.',
      );
    }

    const now = new Date();
    if (user.approvalPinLockedUntil && user.approvalPinLockedUntil > now) {
      const waitMinutes = Math.ceil(
        (user.approvalPinLockedUntil.getTime() - now.getTime()) / 60000,
      );
      throw new UnauthorizedException(
        `Mã PIN tạm thời bị khoá do nhập sai nhiều lần. Vui lòng thử lại sau ${waitMinutes} phút.`,
      );
    }

    const isMatch = await bcrypt.compare(pin, user.approvalPinHash);
    if (!isMatch) {
      const newAttempts = user.approvalPinFailedAttempts + 1;
      const isLocking = newAttempts >= 5;
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          approvalPinFailedAttempts: newAttempts,
          approvalPinLockedUntil: isLocking
            ? new Date(now.getTime() + 15 * 60 * 1000)
            : null,
        },
      });

      await this.auditService.logEvent({
        entityType: 'User',
        entityId: userId,
        action: isLocking ? 'approval_pin_locked' : 'approval_pin_failed',
        actorId: userId,
      });

      if (isLocking) {
        throw new UnauthorizedException(
          'Mã PIN đã bị tạm khoá 15 phút do nhập sai 5 lần liên tiếp.',
        );
      }
      throw new UnauthorizedException(
        `Mã PIN không chính xác. Đã nhập sai ${newAttempts}/5 lần.`,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { approvalPinFailedAttempts: 0, approvalPinLockedUntil: null },
    });
  }
}
