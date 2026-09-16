import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service.js';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let auditService: any;

  const mockPasswordHash = bcrypt.hashSync('123456', 10);

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    jwtService = {
      sign: vi.fn().mockReturnValue('mock_jwt_token'),
      verify: vi.fn(),
    };

    auditService = {
      logEvent: vi.fn().mockResolvedValue({ id: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should successfully log in and return access_token, refresh_token, and user info', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'ceo@huyvoeducation.vn',
        passwordHash: mockPasswordHash,
        name: 'CEO User',
        status: 'active',
        failedLoginAttempts: 2,
        lockedUntil: null,
        roles: [{ name: 'ceo' }],
        department: { name: 'Board' },
      });

      prisma.user.update.mockResolvedValue({});

      const result = await service.login({ email: 'ceo@huyvoeducation.vn', password: '123456' });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user.email).toBe('ceo@huyvoeducation.vn');
      expect(result.user.roles).toContain('ceo');
      // Should reset failedLoginAttempts to 0
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
        }),
      );
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'login', actorId: 1 }),
      );
    });

    it('should increment failedLoginAttempts when password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 2,
        email: 'user@huyvoeducation.vn',
        passwordHash: mockPasswordHash,
        status: 'active',
        failedLoginAttempts: 1,
        lockedUntil: null,
        roles: [],
      });
      prisma.user.update.mockResolvedValue({});

      await expect(
        service.login({ email: 'user@huyvoeducation.vn', password: 'wrong_password' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2 },
          data: expect.objectContaining({ failedLoginAttempts: 2 }),
        }),
      );
    });

    it('should lock account for 15 minutes when 5th failed attempt is reached', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 3,
        email: 'attacker@huyvoeducation.vn',
        passwordHash: mockPasswordHash,
        status: 'active',
        failedLoginAttempts: 4,
        lockedUntil: null,
        roles: [],
      });
      prisma.user.update.mockResolvedValue({});

      await expect(
        service.login({ email: 'attacker@huyvoeducation.vn', password: 'wrong_password' }),
      ).rejects.toThrow('Tài khoản đã bị tạm khoá 15 phút');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 3 },
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'login_locked' }),
      );
    });

    it('should reject login if account is currently locked', async () => {
      const lockFuture = new Date(Date.now() + 10 * 60 * 1000);
      prisma.user.findUnique.mockResolvedValue({
        id: 4,
        email: 'locked@huyvoeducation.vn',
        passwordHash: mockPasswordHash,
        status: 'active',
        failedLoginAttempts: 5,
        lockedUntil: lockFuture,
        roles: [],
      });

      await expect(
        service.login({ email: 'locked@huyvoeducation.vn', password: '123456' }),
      ).rejects.toThrow('Tài khoản tạm thời bị khoá');
    });
  });

  describe('refreshToken', () => {
    it('should generate new tokens when refresh token is valid and matches hash', async () => {
      const rawRefreshToken = 'valid_refresh_token';
      const tokenHash = bcrypt.hashSync(rawRefreshToken, 10);

      jwtService.verify.mockReturnValue({ sub: 1, email: 'user@huyvoeducation.vn' });
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@huyvoeducation.vn',
        status: 'active',
        refreshTokenHash: tokenHash,
        roles: [{ name: 'employee' }],
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.refreshToken(rawRefreshToken);
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('should throw UnauthorizedException if refresh token is expired or corrupted', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refreshToken('expired_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('forgotPassword and resetPassword', () => {
    it('should generate OTP and expiry on forgotPassword', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@huyvoeducation.vn',
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.forgotPassword('user@huyvoeducation.vn');
      expect(result).toHaveProperty('message');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordResetToken: expect.any(String),
            passwordResetExpires: expect.any(Date),
          }),
        }),
      );
    });

    it('should reset password when valid token is provided', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@huyvoeducation.vn',
        passwordResetToken: '123456',
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.resetPassword({
        email: 'user@huyvoeducation.vn',
        token: '123456',
        newPassword: 'newPassword123',
      });

      expect(result.message).toContain('Đặt lại mật khẩu thành công');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordResetToken: null,
            passwordResetExpires: null,
            failedLoginAttempts: 0,
          }),
        }),
      );
    });

    it('should reject reset password with wrong token', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@huyvoeducation.vn',
        passwordResetToken: '123456',
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
      });

      await expect(
        service.resetPassword({
          email: 'user@huyvoeducation.vn',
          token: '999999',
          newPassword: 'newPassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
