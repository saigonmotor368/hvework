import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Đọc metadata @Roles() ở cả cấp method VÀ cấp class — method-level ghi đè
    // nếu có, ngược lại lấy class-level. Chỉ đọc context.getHandler() sẽ bỏ sót
    // toàn bộ @Roles() khai báo trên class (ví dụ AdminController, WorkflowsController),
    // khiến guard luôn cho qua vì tưởng không có yêu cầu vai trò nào.
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user || !user.roles) {
      throw new ForbiddenException('User has no roles');
    }

    const hasRole = user.roles.some((role: { name: string }) => requiredRoles.includes(role.name));
    if (!hasRole) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
