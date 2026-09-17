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
      user: { findUnique: vi.fn().mockResolvedValue(activeUser) },
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
      user: { findUnique: vi.fn().mockReturnValue(pendingUser) },
    } as any;
    const strategy = new JwtStrategy(prisma);

    const first = strategy.validate({ sub: 7 });
    const second = strategy.validate({ sub: 7 });
    resolveUser(activeUser);

    await expect(Promise.all([first, second])).resolves.toEqual([
      activeUser,
      activeUser,
    ]);
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid subjects and inactive users', async () => {
    const prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ ...activeUser, status: 'locked' }),
      },
    } as any;
    const strategy = new JwtStrategy(prisma);

    await expect(strategy.validate({ sub: 'invalid' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(strategy.validate({ sub: 7 })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
