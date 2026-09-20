import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly userCache = new Map<
    number,
    { user: any; expiresAt: number }
  >();
  private readonly inFlightLoads = new Map<number, Promise<any>>();
  private readonly cacheTtlMs: number;

  constructor(private prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error(
        'FATAL SECURITY ERROR: JWT_SECRET environment variable is missing or empty! Startup aborted.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });

    const configuredTtl = Number(
      process.env.AUTH_CONTEXT_CACHE_TTL_MS || 30000,
    );
    this.cacheTtlMs = Number.isFinite(configuredTtl)
      ? Math.min(Math.max(configuredTtl, 0), 5 * 60 * 1000)
      : 30000;
  }

  invalidateUser(userId: number) {
    this.userCache.delete(userId);
    this.inFlightLoads.delete(userId);
  }

  private async loadUser(userId: number) {
    const now = Date.now();
    const cached = this.userCache.get(userId);
    if (cached && cached.expiresAt > now) return cached.user;
    if (cached) this.userCache.delete(userId);

    const existingLoad = this.inFlightLoads.get(userId);
    if (existingLoad) return existingLoad;

    const load = this.loadUserFromDatabase(userId)
      .then((user) => {
        if (this.cacheTtlMs > 0) {
          this.userCache.set(userId, {
            user,
            expiresAt: Date.now() + this.cacheTtlMs,
          });
          if (this.userCache.size > 500) {
            const oldestKey = this.userCache.keys().next().value;
            if (oldestKey !== undefined) this.userCache.delete(oldestKey);
          }
        }
        return user;
      })
      .finally(() => {
        this.inFlightLoads.delete(userId);
      });

    this.inFlightLoads.set(userId, load);
    return load;
  }

  /**
   * Prisma's default relation loading issues one SQL round-trip per relation.
   * Railway is in Singapore while Supabase is in Tokyo, so those sequential
   * round-trips dominated every authenticated request. Load the scalar user
   * first, then fetch all business-scope relations concurrently.
   */
  private async loadUserFromDatabase(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const [department, roles, ledProjects, memberProjects, delegatedFrom] = await Promise.all([
      user.departmentId
        ? this.prisma.department.findUnique({
            where: { id: user.departmentId },
          })
        : Promise.resolve(null),
      this.prisma.role.findMany({
        where: { users: { some: { id: userId } } },
      }),
      this.prisma.project.findMany({
        where: { leadUserId: userId, isActive: true },
        select: { id: true, name: true, isActive: true },
      }),
      this.prisma.project.findMany({
        where: { members: { some: { userId } } },
        select: { id: true, name: true, isActive: true },
      }),
      this.prisma.user.findMany({
        relationLoadStrategy: 'join',
        where: {
          delegateToUserId: userId,
          delegateUntil: { gte: new Date() },
          status: 'active',
        },
        select: {
          id: true,
          name: true,
          email: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
          delegateUntil: true,
          roles: { select: { id: true, name: true } },
          ledProjects: {
            where: { isActive: true },
            select: { id: true, name: true, isActive: true },
          },
          projectMemberships: {
            where: { project: { isActive: true } },
            select: {
              projectId: true,
              project: { select: { id: true, name: true, isActive: true } },
            },
          },
        },
      }),
    ]);

    return {
      ...user,
      department,
      roles,
      ledProjects,
      projectMemberships: memberProjects.map((project) => ({
        projectId: project.id,
        project,
      })),
      delegatedFrom,
    };
  }

  async validate(payload: any) {
    // Short-lived tokens for one-purpose flows (for example the mandatory
    // first-password change) must never be accepted as API access tokens.
    if (payload?.purpose) {
      throw new UnauthorizedException();
    }

    const userId = Number(payload?.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException();
    }

    const user = await this.loadUser(userId);

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException();
    }

    return user;
  }
}
