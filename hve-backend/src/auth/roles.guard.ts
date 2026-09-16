import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
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
