import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PasskeyService } from './passkey.service.js';

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn().mockResolvedValue({ challenge: 'chal-reg' }),
  generateAuthenticationOptions: vi.fn().mockResolvedValue({ challenge: 'chal-login' }),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));
import * as webauthn from '@simplewebauthn/server';

describe('PasskeyService', () => {
  let prisma: any;
  let audit: any;
  let auth: any;
  let service: PasskeyService;

  const challenge = (over: any = {}) => ({
    id: 'c1',
    challenge: 'chal',
    purpose: 'login',
    userId: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...over,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const hash = await bcrypt.hash('Matkhau@1', 4);
    prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 1, email: 'a@x.vn', name: 'A', passwordHash: hash }) },
      userPasskey: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 'pk1', deviceLabel: 'May A' }),
        update: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      passkeyChallenge: {
        deleteMany: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 'c1' }),
        findUnique: vi.fn(),
        delete: vi.fn().mockResolvedValue({}),
      },
    };
    audit = { logEvent: vi.fn() };
    auth = { completePasskeyLogin: vi.fn().mockResolvedValue({ access_token: 't' }) };
    service = new PasskeyService(prisma, audit, auth);
  });

  describe('registerOptions', () => {
    it('từ chối khi sai mật khẩu', async () => {
      await expect(service.registerOptions(1, 'sai')).rejects.toThrow(UnauthorizedException);
    });

    it('chặn khi đã bật đủ số thiết bị tối đa', async () => {
      prisma.userPasskey.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({ credentialId: 'c' + i, transports: null })),
      );
      await expect(service.registerOptions(1, 'Matkhau@1')).rejects.toThrow(BadRequestException);
    });

    it('đúng mật khẩu thì tạo thử thách', async () => {
      const result = await service.registerOptions(1, 'Matkhau@1');
      expect(result.challengeId).toBe('c1');
      expect(prisma.passkeyChallenge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ purpose: 'register', userId: 1, challenge: 'chal-reg' }),
      });
    });
  });

  describe('registerVerify', () => {
    it('lưu khóa công khai khi xác minh thành công và hủy thử thách', async () => {
      prisma.passkeyChallenge.findUnique.mockResolvedValue(challenge({ purpose: 'register', userId: 1 }));
      (webauthn.verifyRegistrationResponse as any).mockResolvedValue({
        verified: true,
        registrationInfo: { credential: { id: 'cred1', publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ['internal'] } },
      });
      const result = await service.registerVerify(1, { challengeId: 'c1', response: {}, deviceLabel: 'May A' });
      expect(result.id).toBe('pk1');
      expect(prisma.passkeyChallenge.delete).toHaveBeenCalled();
      expect(prisma.userPasskey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 1, credentialId: 'cred1', publicKey: 'AQID' }),
      });
    });

    it('từ chối thử thách của người khác hoặc đã hết hạn', async () => {
      prisma.passkeyChallenge.findUnique.mockResolvedValue(challenge({ purpose: 'register', userId: 2 }));
      await expect(service.registerVerify(1, { challengeId: 'c1', response: {} })).rejects.toThrow(BadRequestException);
      prisma.passkeyChallenge.findUnique.mockResolvedValue(
        challenge({ purpose: 'register', userId: 1, expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.registerVerify(1, { challengeId: 'c1', response: {} })).rejects.toThrow(BadRequestException);
    });
  });

  describe('loginVerify', () => {
    const passkey = { id: 'pk1', userId: 7, credentialId: 'cred1', publicKey: 'AQID', counter: 3, transports: null };

    it('đăng nhập thành công sẽ cập nhật bộ đếm và cấp phiên', async () => {
      prisma.passkeyChallenge.findUnique.mockResolvedValue(challenge());
      prisma.userPasskey.findUnique.mockResolvedValue(passkey);
      (webauthn.verifyAuthenticationResponse as any).mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 4 },
      });
      const result = await service.loginVerify({ challengeId: 'c1', response: { id: 'cred1' } }, '1.1.1.1', 'UA');
      expect(result).toEqual({ access_token: 't' });
      expect(prisma.userPasskey.update).toHaveBeenCalledWith({
        where: { id: 'pk1' },
        data: expect.objectContaining({ counter: 4 }),
      });
      expect(auth.completePasskeyLogin).toHaveBeenCalledWith(7, '1.1.1.1', 'UA');
    });

    it('từ chối khi passkey không tồn tại (đã bị xóa khi reset)', async () => {
      prisma.passkeyChallenge.findUnique.mockResolvedValue(challenge());
      prisma.userPasskey.findUnique.mockResolvedValue(null);
      await expect(
        service.loginVerify({ challengeId: 'c1', response: { id: 'cred1' } }),
      ).rejects.toThrow(UnauthorizedException);
      expect(auth.completePasskeyLogin).not.toHaveBeenCalled();
    });

    it('từ chối và ghi nhật ký khi chữ ký sai', async () => {
      prisma.passkeyChallenge.findUnique.mockResolvedValue(challenge());
      prisma.userPasskey.findUnique.mockResolvedValue(passkey);
      (webauthn.verifyAuthenticationResponse as any).mockRejectedValue(new Error('bad signature'));
      await expect(
        service.loginVerify({ challengeId: 'c1', response: { id: 'cred1' } }),
      ).rejects.toThrow(UnauthorizedException);
      expect(audit.logEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'login_passkey_failed' }));
      expect(auth.completePasskeyLogin).not.toHaveBeenCalled();
    });

    it('thử thách chỉ dùng được một lần', async () => {
      prisma.passkeyChallenge.findUnique.mockResolvedValue(null);
      await expect(
        service.loginVerify({ challengeId: 'c1', response: { id: 'cred1' } }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  it('remove chỉ xóa thiết bị của chính người dùng', async () => {
    await service.remove(1, 'pk1');
    expect(prisma.userPasskey.deleteMany).toHaveBeenCalledWith({ where: { id: 'pk1', userId: 1 } });
    prisma.userPasskey.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove(1, 'pk-khac')).rejects.toThrow();
  });
});
