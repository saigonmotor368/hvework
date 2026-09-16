import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer from 'nodemailer';

export interface LoginVerificationEmail {
  email: string;
  name: string;
  code: string;
  deviceName?: string;
  ip?: string;
  firstLogin: boolean;
}

@Injectable()
export class LoginVerificationMailer {
  isEnabled(): boolean {
    return process.env.LOGIN_EMAIL_OTP_ENABLED === 'true';
  }

  async sendLoginCode(payload: LoginVerificationEmail): Promise<void> {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const from = process.env.EMAIL_FROM;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !from || (user && !pass) || (!user && pass)) {
      throw new ServiceUnavailableException(
        'Xác minh email chưa được cấu hình. Vui lòng liên hệ IT Admin.',
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: user && pass ? { user, pass } : undefined,
    });

    const reason = payload.firstLogin
      ? 'Đây là lần đăng nhập đầu tiên của tài khoản.'
      : 'Hệ thống phát hiện đăng nhập từ một thiết bị chưa được xác minh.';

    await transporter.sendMail({
      from,
      to: payload.email,
      subject: '[HVE Work] Mã xác minh đăng nhập',
      text: [
        `Xin chào ${payload.name},`,
        '',
        reason,
        `Mã xác minh của bạn là: ${payload.code}`,
        'Mã có hiệu lực trong 10 phút và chỉ dùng được một lần.',
        `Thiết bị: ${payload.deviceName || 'Không xác định'}`,
        `IP: ${payload.ip || 'Không xác định'}`,
        '',
        'Nếu không phải bạn, không cung cấp mã này cho bất kỳ ai và liên hệ IT Admin.',
      ].join('\n'),
    });
  }
}
