import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service.js';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LoginVerificationMailer } from './login-verification-mailer.service.js';
import { createHash } from 'node:crypto';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let auditService: any;
  let loginVerificationMailer: any;

  const mockPasswordHash = bcrypt.hashSync('123456', 10);

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      trustedDevice: {
        findUnique: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn(),
      },
      loginChallenge: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi
        .fn()
        .mockImplementation(async (operations: Promise<unknown>[]) =>
          Promise.all(operations),
        ),
    };

    jwtService = {
      sign: vi.fn().mockReturnValue('mock_jwt_token'),
      verify: vi.fn(),
    };

    auditService = {
      logEvent: vi.fn().mockResolvedValue({ id: 1 }),
    };
    loginVerificationMailer = {
      isEnabled: vi.fn().mockReturnValue(false),
      sendLoginCode: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: AuditService, useValue: auditService },
        { provide: LoginVerificationMailer, useValue: loginVerificationMailer },
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

      const result = await service.login({
        email: 'ceo@huyvoeducation.vn',
        password: '123456',
      });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user!.email).toBe('ceo@huyvoeducation.vn');
      expect(result.user!.roles).toContain('ceo');
      // Should reset failedLoginAttempts to 0
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        }),
      );
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'login', actorId: 1 }),
      );
    });

    it('should normalize email before looking up the account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'ceo@huyvoeducation.vn',
        passwordHash: mockPasswordHash,
        name: 'CEO User',
        status: 'active',
        failedLoginAttempts: 0,
        lockedUntil: null,
        roles: [{ name: 'ceo' }],
        department: { name: 'Board' },
      });
      prisma.user.update.mockResolvedValue({});

      await service.login({
        email: '  CEO@HUYVOEDUCATION.VN  ',
        password: '123456',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'ceo@huyvoeducation.vn' } }),
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
        service.login({
          email: 'user@huyvoeducation.vn',
          password: 'wrong_password',
        }),
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
        service.login({
          email: 'attacker@huyvoeducation.vn',
          password: 'wrong_password',
        }),
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
        service.login({
          email: 'locked@huyvoeducation.vn',
          password: '123456',
        }),
      ).rejects.toThrow('Tài khoản tạm thời bị khoá');
    });

    it('should send an email challenge and withhold JWT on first login', async () => {
      loginVerificationMailer.isEnabled.mockReturnValue(true);
      prisma.user.findUnique.mockResolvedValue({
        id: 11,
        email: 'new.user@huyvoeducation.vn',
        passwordHash: mockPasswordHash,
        name: 'New User',
        status: 'active',
        failedLoginAttempts: 0,
        lockedUntil: null,
        emailVerifiedAt: null,
        roles: [{ name: 'employee' }],
        department: { name: 'IT' },
      });
      prisma.trustedDevice.findUnique.mockResolvedValue(null);
      prisma.loginChallenge.deleteMany.mockResolvedValue({ count: 0 });
      prisma.loginChallenge.create.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});

      const result = await service.login({
        email: 'new.user@huyvoeducation.vn',
        password: '123456',
        deviceId: 'device-identifier-123456',
        deviceName: 'Chrome on Windows',
      });

      expect(result).toMatchObject({ requiresEmailVerification: true });
      expect(result).not.toHaveProperty('access_token');
      expect(loginVerificationMailer.sendLoginCode).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new.user@huyvoeducation.vn',
          firstLogin: true,
        }),
      );
    });

    it('should require a newly created account to change its temporary password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 21,
        email: 'new.staff@huyvoeducation.vn',
        passwordHash: mockPasswordHash,
        name: 'New Staff',
        status: 'active',
        failedLoginAttempts: 0,
        lockedUntil: null,
        mustChangePassword: true,
        roles: [{ name: 'employee' }],
        department: null,
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.login({
        email: 'new.staff@huyvoeducation.vn',
        password: '123456',
      });

      expect(result).toMatchObject({
        requiresPasswordChange: true,
        passwordChangeToken: 'mock_jwt_token',
      });
      expect(result).not.toHaveProperty('access_token');
    });
  });

  describe('changeInitialPassword', () => {
    it('changes the temporary password and issues a full session', async () => {
      jwtService.verify.mockReturnValue({
        sub: 21,
        email: 'new.staff@huyvoeducation.vn',
        purpose: 'password_change',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 21,
        email: 'new.staff@huyvoeducation.vn',
        passwordHash: mockPasswordHash,
        name: 'New Staff',
        status: 'active',
        mustChangePassword: true,
        roles: [{ name: 'employee' }],
        department: null,
        ledProjects: [],
        projectMemberships: [],
        delegatedFrom: [],
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.changeInitialPassword(
        {
          token: 'change-token',
          currentPassword: '123456',
          newPassword: 'HveSecure@2027',
        },
        '127.0.0.1',
        'Chrome',
      );

      expect(result).toHaveProperty('access_token');
      expect(result.user.mustChangePassword).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 21 },
          data: expect.objectContaining({ mustChangePassword: false }),
        }),
      );
    });

    it('rejects reuse of the temporary password', async () => {
      jwtService.verify.mockReturnValue({
        sub: 21,
        purpose: 'password_change',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 21,
        passwordHash: mockPasswordHash,
        status: 'active',
        mustChangePassword: true,
      });

      await expect(
        service.changeInitialPassword({
          token: 'change-token',
          currentPassword: '123456',
          newPassword: '123456',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyLoginChallenge', () => {
    it('should trust the device and issue JWT after a correct email code', async () => {
      const code = '654321';
      prisma.loginChallenge.findUnique.mockResolvedValue({
        id: '30ecad53-9d42-4ed1-8b3e-bc66d5e39f4c',
        userId: 11,
        otpHash: bcrypt.hashSync(code, 10),
        deviceHash: createHash('sha256')
          .update('device-identifier-123456')
          .digest('hex'),
        deviceLabel: 'Chrome on Windows',
        ip: '127.0.0.1',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        consumedAt: null,
        user: {
          id: 11,
          email: 'new.user@huyvoeducation.vn',
          name: 'New User',
          status: 'active',
          emailVerifiedAt: null,
          departmentId: 1,
          department: { name: 'IT' },
          roles: [{ name: 'employee' }],
        },
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.verifyLoginChallenge({
        challengeId: '30ecad53-9d42-4ed1-8b3e-bc66d5e39f4c',
        code,
        deviceId: 'device-identifier-123456',
      });

      expect(result).toHaveProperty('access_token');
      expect(prisma.trustedDevice.upsert).toHaveBeenCalled();
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'first_login_email_verified' }),
      );
    });
  });

  describe('resendLoginChallenge', () => {
    it('should replace the old challenge and send a new email code after 60 seconds', async () => {
      loginVerificationMailer.isEnabled.mockReturnValue(true);
      const deviceId = 'device-identifier-123456';
      prisma.loginChallenge.findUnique.mockResolvedValue({
        id: '30ecad53-9d42-4ed1-8b3e-bc66d5e39f4c',
        userId: 11,
        deviceHash: createHash('sha256').update(deviceId).digest('hex'),
        deviceLabel: 'Chrome on Windows',
        consumedAt: null,
        createdAt: new Date(Date.now() - 61_000),
        user: {
          id: 11,
          email: 'new.user@huyvoeducation.vn',
          name: 'New User',
          status: 'active',
          emailVerifiedAt: null,
        },
      });
      prisma.loginChallenge.create.mockResolvedValue({});

      const result = await service.resendLoginChallenge({
        challengeId: '30ecad53-9d42-4ed1-8b3e-bc66d5e39f4c',
        deviceId,
      });

      expect(result).toMatchObject({
        requiresEmailVerification: true,
        resendCooldownSeconds: 60,
      });
      expect(loginVerificationMailer.sendLoginCode).toHaveBeenCalledOnce();
      expect(prisma.loginChallenge.delete).toHaveBeenCalledWith({
        where: { id: '30ecad53-9d42-4ed1-8b3e-bc66d5e39f4c' },
      });
    });

    it('should reject resending during the 60 second cooldown', async () => {
      loginVerificationMailer.isEnabled.mockReturnValue(true);
      const deviceId = 'device-identifier-123456';
      prisma.loginChallenge.findUnique.mockResolvedValue({
        id: '30ecad53-9d42-4ed1-8b3e-bc66d5e39f4c',
        userId: 11,
        deviceHash: createHash('sha256').update(deviceId).digest('hex'),
        consumedAt: null,
        createdAt: new Date(Date.now() - 10_000),
        user: { status: 'active' },
      });

      await expect(
        service.resendLoginChallenge({
          challengeId: '30ecad53-9d42-4ed1-8b3e-bc66d5e39f4c',
          deviceId,
        }),
      ).rejects.toThrow('Vui lòng chờ');
      expect(loginVerificationMailer.sendLoginCode).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should generate new tokens when refresh token is valid and matches hash', async () => {
      const rawRefreshToken = 'valid_refresh_token';
      const tokenHash = bcrypt.hashSync(rawRefreshToken, 10);

      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'user@huyvoeducation.vn',
      });
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

  describe('setApprovalPin', () => {
    it('should set PIN when current password is correct', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        passwordHash: mockPasswordHash,
        approvalPinHash: null,
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.setApprovalPin(1, {
        currentPassword: '123456',
        newPin: '778899',
      });

      expect(result.message).toContain('Đã lưu mã PIN');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            approvalPinFailedAttempts: 0,
            approvalPinLockedUntil: null,
          }),
        }),
      );
    });

    it('should reject when current password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        passwordHash: mockPasswordHash,
        approvalPinHash: null,
      });

      await expect(
        service.setApprovalPin(1, {
          currentPassword: 'wrong',
          newPin: '778899',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyApprovalPin', () => {
    const mockPinHash = bcrypt.hashSync('778899', 10);

    it('should pass and reset counters when PIN is correct', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        approvalPinHash: mockPinHash,
        approvalPinFailedAttempts: 2,
        approvalPinLockedUntil: null,
      });
      prisma.user.update.mockResolvedValue({});

      await expect(
        service.verifyApprovalPin(1, '778899'),
      ).resolves.toBeUndefined();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { approvalPinFailedAttempts: 0, approvalPinLockedUntil: null },
        }),
      );
    });

    it('should throw if user has not set a PIN yet', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        approvalPinHash: null,
      });

      await expect(service.verifyApprovalPin(1, '778899')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should lock PIN for 15 minutes after 5 wrong attempts', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        approvalPinHash: mockPinHash,
        approvalPinFailedAttempts: 4,
        approvalPinLockedUntil: null,
      });
      prisma.user.update.mockResolvedValue({});

      await expect(service.verifyApprovalPin(1, '000000')).rejects.toThrow(
        'Mã PIN đã bị tạm khoá 15 phút',
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            approvalPinFailedAttempts: 5,
            approvalPinLockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('should reject while PIN is currently locked', async () => {
      const lockFuture = new Date(Date.now() + 10 * 60 * 1000);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        approvalPinHash: mockPinHash,
        approvalPinFailedAttempts: 5,
        approvalPinLockedUntil: lockFuture,
      });

      await expect(service.verifyApprovalPin(1, '778899')).rejects.toThrow(
        'Mã PIN tạm thời bị khoá',
      );
    });
  });

  describe('isApprovalPinEnabled', () => {
    it('should return true when approvalPinEnabled is true', async () => {
      prisma.user.findUnique.mockResolvedValue({ approvalPinEnabled: true });
      await expect(service.isApprovalPinEnabled(1)).resolves.toBe(true);
    });

    it('should return false when approvalPinEnabled is false or user not found', async () => {
      prisma.user.findUnique.mockResolvedValue({ approvalPinEnabled: false });
      await expect(service.isApprovalPinEnabled(1)).resolves.toBe(false);

      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.isApprovalPinEnabled(1)).resolves.toBe(false);
    });
  });

  describe('setApprovalPinEnabled', () => {
    const mockPinHash = bcrypt.hashSync('778899', 10);

    it('should enable when a PIN is already set', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        approvalPinHash: mockPinHash,
        approvalPinEnabled: false,
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.setApprovalPinEnabled(1, { enabled: true });

      expect(result.enabled).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { approvalPinEnabled: true },
        }),
      );
    });

    it('should reject enabling when no PIN has been set yet', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        approvalPinHash: null,
        approvalPinEnabled: false,
      });

      await expect(
        service.setApprovalPinEnabled(1, { enabled: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should disable directly when PIN feature is not currently enabled', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        approvalPinHash: mockPinHash,
        approvalPinEnabled: false,
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.setApprovalPinEnabled(1, { enabled: false });

      expect(result.enabled).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { approvalPinEnabled: false },
        }),
      );
    });

    it('should require correct PIN to disable when feature is currently enabled', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        approvalPinHash: mockPinHash,
        approvalPinEnabled: true,
        approvalPinFailedAttempts: 0,
        approvalPinLockedUntil: null,
      });

      await expect(
        service.setApprovalPinEnabled(1, { enabled: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject disabling with wrong PIN when feature is currently enabled', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        approvalPinHash: mockPinHash,
        approvalPinEnabled: true,
        approvalPinFailedAttempts: 0,
        approvalPinLockedUntil: null,
      });
      prisma.user.update.mockResolvedValue({});

      await expect(
        service.setApprovalPinEnabled(1, { enabled: false, pin: '000000' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should disable successfully with correct current PIN', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        approvalPinHash: mockPinHash,
        approvalPinEnabled: true,
        approvalPinFailedAttempts: 0,
        approvalPinLockedUntil: null,
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.setApprovalPinEnabled(1, {
        enabled: false,
        pin: '778899',
      });

      expect(result.enabled).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { approvalPinEnabled: false },
        }),
      );
    });
  });
});
