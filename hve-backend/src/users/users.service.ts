import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private detectImageMime(buffer: Buffer): string | null {
    if (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) {
      return 'image/png';
    }
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return 'image/jpeg';
    }
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }
    return null;
  }

  async updateAvatar(
    userId: number,
    file?: { buffer?: Buffer; size?: number; mimetype?: string },
    ip?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Vui lòng chọn ảnh đại diện');
    }
    const buffer = file.buffer;
    if (buffer.length > 256 * 1024) {
      throw new BadRequestException(
        'Ảnh đại diện sau khi nén phải nhỏ hơn 256KB',
      );
    }
    const mimeType = this.detectImageMime(buffer);
    if (!mimeType) {
      throw new BadRequestException(
        'Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WEBP',
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarUrl: true },
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const avatarUrl = `/users/${userId}/avatar?v=${Date.now()}`;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.userAvatar.upsert({
        where: { userId },
        create: {
          userId,
          data: buffer,
          mimeType,
          size: buffer.length,
        },
        update: {
          data: buffer,
          mimeType,
          size: buffer.length,
        },
      });
      return tx.user.update({
        where: { id: userId },
        data: { avatarUrl },
        select: { id: true, name: true, email: true, avatarUrl: true },
      });
    });
    await this.auditService.logEvent({
      entityType: 'User',
      entityId: userId,
      action: 'update_avatar',
      actorId: userId,
      beforeJson: { avatarUrl: user.avatarUrl },
      afterJson: { avatarUrl, mimeType, size: buffer.length },
      ip,
    });
    return updated;
  }

  async getAvatar(userId: number) {
    const avatar = await this.prisma.userAvatar.findUnique({
      where: { userId },
      select: { data: true, mimeType: true, size: true },
    });
    if (!avatar) throw new NotFoundException('Người dùng chưa có ảnh đại diện');
    return avatar;
  }

  async findProfile(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
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
