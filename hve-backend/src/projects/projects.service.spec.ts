import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectsService } from './projects.service.js';
import { JwtStrategy } from '../auth/jwt.strategy.js';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: any;
  let jwtStrategy: any;

  beforeEach(async () => {
    prisma = {
      project: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      projectMember: { deleteMany: vi.fn() },
      role: { findUnique: vi.fn() },
      user: {
        count: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (operation: any) =>
        Array.isArray(operation) ? Promise.all(operation) : operation(prisma),
      ),
    };
    jwtStrategy = { invalidateUser: vi.fn() };
    const module = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logEvent: vi.fn() } },
        { provide: JwtStrategy, useValue: jwtStrategy },
      ],
    }).compile();
    service = module.get(ProjectsService);
  });

  it('returns only active projects related to a regular employee', async () => {
    prisma.project.findMany.mockResolvedValue([]);
    await service.findVisible({ id: 22, roles: ['employee'] });
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          OR: [{ leadUserId: 22 }, { members: { some: { userId: 22 } } }],
        },
      }),
    );
  });

  it('lets a project head browse the active project catalog without member details', async () => {
    prisma.project.findMany.mockResolvedValue([
      {
        id: 1,
        code: 'KNS',
        name: 'Kỹ Năng Sống',
        location: 'NVH',
        leadUserId: 9,
        isActive: true,
        members: [{ userId: 99 }],
        lead: { id: 9, email: 'lead@example.com' },
      },
    ]);
    const result = await service.findVisible({
      id: 9,
      roles: ['department_head'],
    });
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    expect(result[0]).not.toHaveProperty('members');
    expect(result[0]).not.toHaveProperty('lead');
  });

  it('automatically grants department_head when a project lead is selected', async () => {
    prisma.user.count.mockResolvedValue(2);
    prisma.project.findUnique.mockResolvedValue(null);
    prisma.project.create.mockResolvedValue({
      id: 1,
      code: 'HVE',
      name: 'HVE Work',
      leadUserId: 9,
      members: [{ userId: 10 }],
    });
    prisma.role.findUnique.mockResolvedValue({ id: 2 });

    await service.create(
      {
        code: 'HVE',
        name: 'HVE Work',
        leadUserId: 9,
        memberIds: [9, 10],
      },
      1,
    );

    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadUserId: 9,
          members: { create: [{ userId: 10 }] },
        }),
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { roles: { connect: { id: 2 } } },
    });
    expect(jwtStrategy.invalidateUser).toHaveBeenCalledWith(9);
  });

  it('moves the derived department_head role when replacing the project lead', async () => {
    prisma.project.findUnique.mockResolvedValue({
      id: 1,
      code: 'HVE',
      name: 'HVE Work',
      location: null,
      leadUserId: 9,
      isActive: true,
      members: [],
    });
    prisma.user.count.mockResolvedValue(1);
    prisma.project.findFirst.mockResolvedValue(null);
    prisma.project.update.mockResolvedValue({
      id: 1,
      code: 'HVE',
      name: 'HVE Work',
      leadUserId: 10,
      members: [],
      isActive: true,
    });
    prisma.role.findUnique.mockResolvedValue({ id: 2 });
    prisma.project.count.mockResolvedValue(0);

    await service.update(
      1,
      { code: 'HVE', name: 'HVE Work', leadUserId: 10, memberIds: [] },
      1,
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { roles: { connect: { id: 2 } } },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { roles: { disconnect: { id: 2 } } },
    });
    expect(jwtStrategy.invalidateUser).toHaveBeenCalledWith(9);
    expect(jwtStrategy.invalidateUser).toHaveBeenCalledWith(10);
  });
});
