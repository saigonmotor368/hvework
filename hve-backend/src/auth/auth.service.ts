import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService,
  ) {}

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
      throw new UnauthorizedException('Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.');
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const waitMinutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000);
      throw new UnauthorizedException(
        `Tài khoản tạm thời bị khoá do đăng nhập sai nhiều lần. Vui lòng thử lại sau ${waitMinutes} phút.`,
      );
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const newAttempts = user.failedLoginAttempts + 1;
      const isLocking = newAttempts >= 5;
      const lockedUntil = isLocking ? new Date(now.getTime() + 15 * 60 * 1000) : null;

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

    // Reset failed login attempts on success
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
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
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        department: user.department?.name || null,
        roles: user.roles.map((r) => r.name),
      },
    };
  }

  async refreshToken(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: true, department: true },
    });

    if (!user || user.status !== 'active' || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const isTokenMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isTokenMatch) {
      throw new UnauthorizedException('Refresh token đã bị thu hồi');
    }

    const newPayload = { email: user.email, sub: user.id };
    const newAccessToken = this.jwtService.sign(newPayload, { expiresIn: '15m' });
    const newRefreshToken = this.jwtService.sign(newPayload, { expiresIn: '7d' });
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
        message: 'Nếu email tồn tại trong hệ thống, mã xác thực đặt lại mật khẩu đã được gửi.',
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
      message: 'Mã xác thực đặt lại mật khẩu (OTP) đã được gửi tới email của bạn và có hiệu lực trong 15 phút.',
      // In dev environment, provide otp for testing convenience
      otpDev: process.env.NODE_ENV === 'production' ? undefined : resetOtp,
    };
  }

  async resetPassword(dto: ResetPasswordDto, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
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
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập với mật khẩu mới.',
    };
  }
}
