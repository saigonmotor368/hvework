import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { LoginVerificationMailer } from './login-verification-mailer.service.js';

describe('LoginVerificationMailer', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.LOGIN_EMAIL_OTP_ENABLED = 'true';
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'HVE Work <no-reply@auth.huyvoeducation.vn>';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends login OTP through the Resend HTTPS API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: vi.fn() });
    vi.stubGlobal('fetch', fetchMock);

    await new LoginVerificationMailer().sendLoginCode({
      email: 'user@huyvoeducation.vn',
      name: 'Test User',
      code: '123456',
      firstLogin: true,
      challengeId: 'challenge-123',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_key',
          'Idempotency-Key': 'login-verification-challenge-123',
        }),
      }),
    );
    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(request.body)).toMatchObject({
      from: 'HVE Work <no-reply@auth.huyvoeducation.vn>',
      to: ['user@huyvoeducation.vn'],
      subject: '[HVE Work] Mã xác minh đăng nhập',
    });
  });

  it('fails closed when Resend rejects the email', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: vi.fn().mockResolvedValue('Domain is not verified'),
      }),
    );

    await expect(
      new LoginVerificationMailer().sendLoginCode({
        email: 'user@huyvoeducation.vn',
        name: 'Test User',
        code: '123456',
        firstLogin: true,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
