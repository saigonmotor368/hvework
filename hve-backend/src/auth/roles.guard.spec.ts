import { Controller, ExecutionContext, ForbiddenException, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { Roles } from './roles.decorator.js';

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
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
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
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([roleName]);
      const context = createMockContext({
        id: 1,
        email: `${roleName}@huyvoeducation.vn`,
        roles: [{ name: roleName }],
      });

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow user having multiple roles if one matches required role', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ceo', 'it_admin']);
      const context = createMockContext({
        id: 1,
        roles: [{ name: 'employee' }, { name: 'it_admin' }],
      });

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('RBAC Role Rejection (Fail cases)', () => {
    it('should throw ForbiddenException if user lacks required role', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ceo']);
      const context = createMockContext({
        id: 2,
        email: 'employee@huyvoeducation.vn',
        roles: [{ name: 'employee' }],
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Bạn không có quyền thực hiện thao tác này');
    });

    it('should throw ForbiddenException if accountant tries to access legal-only route', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['legal']);
      const context = createMockContext({
        id: 3,
        roles: [{ name: 'accountant' }],
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user has no roles array or user is missing', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ceo']);
      const contextWithoutRoles = createMockContext({ id: 4, roles: null });

      expect(() => guard.canActivate(contextWithoutRoles)).toThrow(ForbiddenException);
    });
  });

  describe('Real decorator metadata (không mock Reflector) — bắt lỗi @Roles() đặt sai cấp', () => {
    // Đây là kịch bản thật đã xảy ra: AdminController/WorkflowsController khai báo
    // @Roles() ở CẤP CLASS. Guard cũ chỉ đọc context.getHandler() nên bỏ sót hoàn
    // toàn metadata này và luôn cho qua (silent bypass). Test này dùng Reflector
    // thật (không mock) + class/handler thật để đảm bảo lỗi này không tái diễn.

    @Roles('it_admin', 'ceo')
    @Controller('fake-admin')
    class FakeClassLevelRolesController {
      @Get('users')
      listUsers() {
        return [];
      }
    }

    class FakeMethodLevelRolesController {
      @Roles('it_admin', 'ceo')
      @Get('users')
      listUsers() {
        return [];
      }
    }

    function realReflectorContext(
      controllerClass: any,
      handlerName: string,
      user: any,
    ): ExecutionContext {
      const instance = new controllerClass();
      const handler = instance[handlerName];
      return {
        getHandler: () => handler,
        getClass: () => controllerClass,
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      } as unknown as ExecutionContext;
    }

    it('should block employee from a controller whose @Roles() is declared at CLASS level', () => {
      const realGuard = new RolesGuard(new Reflector());
      const ctx = realReflectorContext(FakeClassLevelRolesController, 'listUsers', {
        id: 99,
        roles: [{ name: 'employee' }],
      });

      expect(() => realGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should allow it_admin through a controller whose @Roles() is declared at CLASS level', () => {
      const realGuard = new RolesGuard(new Reflector());
      const ctx = realReflectorContext(FakeClassLevelRolesController, 'listUsers', {
        id: 2,
        roles: [{ name: 'it_admin' }],
      });

      expect(realGuard.canActivate(ctx)).toBe(true);
    });

    it('should still block employee from a controller whose @Roles() is declared at METHOD level', () => {
      const realGuard = new RolesGuard(new Reflector());
      const ctx = realReflectorContext(FakeMethodLevelRolesController, 'listUsers', {
        id: 99,
        roles: [{ name: 'employee' }],
      });

      expect(() => realGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });
});
