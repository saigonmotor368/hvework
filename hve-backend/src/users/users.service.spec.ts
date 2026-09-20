import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';
import { AuditService } from '../audit/audit.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let auditService: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: vi.fn(), update: vi.fn() },
      userAvatar: { findUnique: vi.fn(), upsert: vi.fn() },
      $transaction: vi.fn(async (callback: any) => callback(prisma)),
    };
    auditService = { logEvent: vi.fn().mockResolvedValue({ id: 1 }) };
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('returns public company profile with project-specific positions', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 12,
      name: 'Nguyễn Văn A',
      email: 'a@huyvoeducation.vn',
      roles: [{ id: 1, name: 'employee' }],
      ledProjects: [],
      projectMemberships: [
        {
          position: 'Cứu hộ',
          project: { id: 4, code: 'HB', name: 'Hồ bơi' },
        },
      ],
    });

    const profile = await service.findProfile(12);
    expect(profile.projectMemberships[0].position).toBe('Cứu hộ');
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 12 } }),
    );
  });

  it('rejects an unknown profile', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findProfile(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates the current user avatar and records an audit event', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 12, avatarUrl: null });
    prisma.user.update.mockResolvedValue({
      id: 12,
      name: 'Nguyễn Văn A',
      email: 'a@huyvoeducation.vn',
      avatarUrl: '/users/12/avatar?v=1',
    });

    const webp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WEBP'),
      Buffer.from('avatar'),
    ]);

    const result = await service.updateAvatar(
      12,
      { buffer: webp, size: webp.length, mimetype: 'image/webp' },
      '127.0.0.1',
    );

    expect(prisma.userAvatar.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 12 } }),
    );
    expect(result.avatarUrl).toContain('/users/12/avatar');
    expect(auditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update_avatar', actorId: 12 }),
    );
  });

  it('rejects content that is not a real supported image', async () => {
    await expect(
      service.updateAvatar(12, {
        buffer: Buffer.from('not-an-image'),
        size: 12,
        mimetype: 'image/webp',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('only updates the authenticated user phone and records an audit event', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 12, phone: null });
    prisma.user.update.mockResolvedValue({
      id: 12,
      name: 'Nguyễn Văn A',
      email: 'a@huyvoeducation.vn',
      phone: '0901 234 567',
      avatarUrl: null,
    });

    const result = await service.updateMyPhone(
      12,
      ' 0901 234 567 ',
      '127.0.0.1',
    );

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 12 },
        data: { phone: '0901 234 567' },
      }),
    );
    expect(result.phone).toBe('0901 234 567');
    expect(auditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update_own_phone', actorId: 12 }),
    );
  });
});
