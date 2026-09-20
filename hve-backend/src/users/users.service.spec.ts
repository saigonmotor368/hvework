import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';
import { AuditService } from '../audit/audit.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let auditService: any;

  beforeEach(async () => {
    prisma = { user: { findUnique: vi.fn(), update: vi.fn() } };
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
      avatarUrl: '/attachments/file/avatar-drive-id',
    });

    const result = await service.updateAvatar(
      12,
      '/attachments/file/avatar-drive-id',
      '127.0.0.1',
    );

    expect(result.avatarUrl).toContain('avatar-drive-id');
    expect(auditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'update_avatar', actorId: 12 }),
    );
  });
});
