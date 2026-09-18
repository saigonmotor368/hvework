import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { user: { findUnique: vi.fn() } };
    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
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
});
