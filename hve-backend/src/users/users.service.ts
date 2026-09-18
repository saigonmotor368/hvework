import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findProfile(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        department: { select: { id: true, code: true, name: true } },
        roles: { select: { id: true, name: true, description: true } },
        ledProjects: {
          where: { isActive: true },
          select: { id: true, code: true, name: true, location: true },
        },
        projectMemberships: {
          where: { project: { isActive: true } },
          select: {
            position: true,
            project: {
              select: { id: true, code: true, name: true, location: true },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }
}
