import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy auth context cache', () => {
  const activeUser = {
    id: 7,
    email: 'member@huyvoeducation.vn',
    status: 'active',
    roles: [{ name: 'employee' }],
    department: null,
    ledProjects: [],
    projectMemberships: [],
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.AUTH_CONTEXT_CACHE_TTL_MS = '30000';
  });

  it('reuses the user context during the short cache window', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(activeUser), findMany: vi.fn().mockResolvedValue([]) },
      department: { findUnique: vi.fn() },
      role: { findMany: vi.fn().mockResolvedValue(activeUser.roles) },
      project: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;
    const strategy = new JwtStrategy(prisma);

    await strategy.validate({ sub: 7 });
    await strategy.validate({ sub: 7 });

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent cache misses into one database query', async () => {
    let resolveUser!: (value: typeof activeUser) => void;
    const pendingUser = new Promise<typeof activeUser>((resolve) => {
      resolveUser = resolve;
    });
    const prisma = {
      user: { findUnique: vi.fn().mockReturnValue(pendingUser), findMany: vi.fn().mockResolvedValue([]) },
      department: { findUnique: vi.fn() },
      role: { findMany: vi.fn().mockResolvedValue(activeUser.roles) },
      project: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;
    const strategy = new JwtStrategy(prisma);

    const first = strategy.validate({ sub: 7 });
    const second = strategy.validate({ sub: 7 });
    resolveUser(activeUser);

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ ...activeUser, delegatedFrom: [] }),
      expect.objectContaining({ ...activeUser, delegatedFrom: [] }),
    ]);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the complete business scope from parallel relation queries', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 7,
          email: activeUser.email,
          status: 'active',
          departmentId: 3,
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 9,
            name: 'Trưởng dự án',
            delegateUntil: new Date(Date.now() + 86400000),
            roles: [{ name: 'department_head' }],
            ledProjects: [{ id: 13, isActive: true }],
            projectMemberships: [],
          },
        ]),
      },
      department: {
        findUnique: vi.fn().mockResolvedValue({ id: 3, name: 'Vận hành' }),
      },
      role: {
        findMany: vi.fn().mockResolvedValue([{ name: 'department_head' }]),
      },
      project: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ id: 11, name: 'Dự án A', isActive: true }])
          .mockResolvedValueOnce([{ id: 12, name: 'Dự án B', isActive: true }]),
      },
    } as any;
    const strategy = new JwtStrategy(prisma);

    const result = await strategy.validate({ sub: 7 });

    expect(result.department).toEqual({ id: 3, name: 'Vận hành' });
    expect(result.roles).toEqual([{ name: 'department_head' }]);
    expect(result.ledProjects).toEqual([
      { id: 11, name: 'Dự án A', isActive: true },
    ]);
    expect(result.projectMemberships).toEqual([
      {
        projectId: 12,
        project: { id: 12, name: 'Dự án B', isActive: true },
      },
    ]);
    expect(result.delegatedFrom).toHaveLength(1);
    expect(result.delegatedFrom[0].roles[0].name).toBe('department_head');
  });

  it('rejects invalid subjects and inactive users', async () => {
    const prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ ...activeUser, status: 'locked' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      department: { findUnique: vi.fn() },
      role: { findMany: vi.fn().mockResolvedValue(activeUser.roles) },
      project: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;
    const strategy = new JwtStrategy(prisma);

    await expect(strategy.validate({ sub: 'invalid' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(strategy.validate({ sub: 7 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a one-purpose password-change token as an API access token', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      department: { findUnique: vi.fn() },
      role: { findMany: vi.fn() },
      project: { findMany: vi.fn() },
    } as any;
    const strategy = new JwtStrategy(prisma);

    await expect(
      strategy.validate({ sub: 7, purpose: 'password_change' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
