import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import nodemailer from 'nodemailer';

export interface LoginVerificationEmail {
  email: string;
  name: string;
  code: string;
  deviceName?: string;
  ip?: string;
  firstLogin: boolean;
  challengeId?: string;
}

@Injectable()
export class LoginVerificationMailer {
  private readonly logger = new Logger(LoginVerificationMailer.name);

  isEnabled(): boolean {
    return process.env.LOGIN_EMAIL_OTP_ENABLED === 'true';
  }

  async sendLoginCode(payload: LoginVerificationEmail): Promise<void> {
    const resendApiKey = process.env.RESEND_API_KEY;
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const from = process.env.EMAIL_FROM;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (
      !from ||
      (!resendApiKey && (!host || (user && !pass) || (!user && pass)))
    ) {
      throw new ServiceUnavailableException(
        'Xác minh email chưa được cấu hình. Vui lòng liên hệ IT Admin.',
      );
    }

    const reason = payload.firstLogin
      ? 'Đây là lần đăng nhập đầu tiên của tài khoản.'
      : 'Hệ thống phát hiện đăng nhập từ một thiết bị chưa được xác minh.';
    const text = [
      `Xin chào ${payload.name},`,
      '',
      reason,
      `Mã xác minh của bạn là: ${payload.code}`,
      'Mã có hiệu lực trong 10 phút và chỉ dùng được một lần.',
      `Thiết bị: ${payload.deviceName || 'Không xác định'}`,
      `IP: ${payload.ip || 'Không xác định'}`,
      '',
      'Nếu không phải bạn, không cung cấp mã này cho bất kỳ ai và liên hệ IT Admin.',
    ].join('\n');

    if (resendApiKey) {
      await this.sendWithResend(resendApiKey, from, payload, text);
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({
      from,
      to: payload.email,
      subject: '[HVE Work] Mã xác minh đăng nhập',
      text,
    });
  }

  private async sendWithResend(
    apiKey: string,
    from: string,
    payload: LoginVerificationEmail,
    text: string,
  ): Promise<void> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'hve-work/1.0',
          ...(payload.challengeId
            ? { 'Idempotency-Key': `login-verification-${payload.challengeId}` }
            : {}),
        },
        body: JSON.stringify({
          from,
          to: [payload.email],
          subject: '[HVE Work] Mã xác minh đăng nhập',
          text,
        }),
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        this.logger.error(
          `Resend rejected login email (${response.status}): ${detail}`,
        );
        throw new ServiceUnavailableException(
          'Không thể gửi mã xác minh. Vui lòng thử lại hoặc liên hệ IT Admin.',
        );
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error(
        `Resend login email failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new ServiceUnavailableException(
        'Không thể gửi mã xác minh. Vui lòng thử lại hoặc liên hệ IT Admin.',
      );
    }
  }
}
