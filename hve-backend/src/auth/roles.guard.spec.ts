import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockContext(user: any): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access if no roles are required on handler', () => {
    vi.spyOn(reflector, 'get').mockReturnValue(undefined);
    const context = createMockContext({ id: 1, roles: [{ name: 'employee' }] });

    expect(guard.canActivate(context)).toBe(true);
  });

  describe('RBAC Role Acceptance (Pass cases)', () => {
    const mainRoles = [
      'ceo',
      'department_head',
      'accountant',
      'legal',
      'employee',
      'it_admin',
    ];

    it.each(mainRoles)('should allow access for role "%s"', (roleName) => {
      vi.spyOn(reflector, 'get').mockReturnValue([roleName]);
      const context = createMockContext({
        id: 1,
        email: `${roleName}@huyvoeducation.vn`,
        roles: [{ name: roleName }],
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow user having multiple roles if one matches required role', () => {
      vi.spyOn(reflector, 'get').mockReturnValue(['ceo', 'it_admin']);
      const context = createMockContext({
        id: 1,
        roles: [{ name: 'employee' }, { name: 'it_admin' }],
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('RBAC Role Rejection (Fail cases)', () => {
    it('should throw ForbiddenException if user lacks required role', () => {
      vi.spyOn(reflector, 'get').mockReturnValue(['ceo']);
      const context = createMockContext({
        id: 2,
        email: 'employee@huyvoeducation.vn',
        roles: [{ name: 'employee' }],
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Access denied');
    });

    it('should throw ForbiddenException if accountant tries to access legal-only route', () => {
      vi.spyOn(reflector, 'get').mockReturnValue(['legal']);
      const context = createMockContext({
        id: 3,
        roles: [{ name: 'accountant' }],
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user has no roles array or user is missing', () => {
      vi.spyOn(reflector, 'get').mockReturnValue(['ceo']);
      const contextWithoutRoles = createMockContext({ id: 4, roles: null });

      expect(() => guard.canActivate(contextWithoutRoles)).toThrow(ForbiddenException);
    });
  });
});
