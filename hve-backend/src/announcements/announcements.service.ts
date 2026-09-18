import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { getUserProjectIds } from '../common/access-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto.js';

const listSelect = {
  id: true,
  title: true,
  summary: true,
  type: true,
  priority: true,
  isPinned: true,
  projectId: true,
  meetingStartAt: true,
  meetingEndAt: true,
  location: true,
  meetingUrl: true,
  publishedAt: true,
  expiresAt: true,
  project: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

type CachedList = { expiresAt: number; items: unknown[] };

@Injectable()
export class AnnouncementsService {
  private readonly listCache = new Map<string, CachedList>();
  private readonly cacheTtlMs = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private visibilityWhere(user: any, now: Date) {
    const projectIds = getUserProjectIds(user);
    return {
      status: 'published',
      publishedAt: { lte: now },
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        {
          OR: [
            { projectId: null },
            ...(projectIds.length > 0
              ? [{ projectId: { in: projectIds } }]
              : []),
          ],
        },
      ],
    };
  }

  async findVisible(user: any, limit = 3) {
    const safeLimit = Math.min(Math.max(Number(limit) || 3, 1), 20);
    const projectIds = getUserProjectIds(user);
    const cacheKey = `${projectIds.join(',')}|${safeLimit}`;
    const cached = this.listCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.items;

    const now = new Date();
    const candidates = await this.prisma.announcement.findMany({
      where: this.visibilityWhere(user, now),
      select: listSelect,
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: Math.min(safeLimit * 4, 80),
    });
    const priorityRank: Record<string, number> = {
      urgent: 2,
      important: 1,
      normal: 0,
    };
    const items = candidates
      .sort((left, right) => {
        if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
        const priorityDiff =
          (priorityRank[right.priority] || 0) -
          (priorityRank[left.priority] || 0);
        if (priorityDiff) return priorityDiff;
        return (
          (right.publishedAt?.getTime() || 0) -
          (left.publishedAt?.getTime() || 0)
        );
      })
      .slice(0, safeLimit);
    this.listCache.set(cacheKey, {
      expiresAt: Date.now() + this.cacheTtlMs,
      items,
    });
    if (this.listCache.size > 200) this.listCache.clear();
    return items;
  }

  async findVisibleById(user: any, id: number) {
    const item = await this.prisma.announcement.findFirst({
      where: { id, ...this.visibilityWhere(user, new Date()) },
      include: {
        project: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!item) throw new NotFoundException('Không tìm thấy thông báo');
    return item;
  }

  async findAllForAdmin(status?: string, projectId?: number) {
    return this.prisma.announcement.findMany({
      where: {
        ...(status && status !== 'all' ? { status } : {}),
        ...(projectId ? { projectId } : {}),
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });
  }

  private cleanText(value?: string | null) {
    return value?.trim() || null;
  }

  private toDate(value?: string | null) {
    return value ? new Date(value) : null;
  }

  private async normalize(
    dto: CreateAnnouncementDto | UpdateAnnouncementDto,
    current?: any,
  ) {
    const merged = { ...current, ...dto };
    const projectId =
      dto.projectId === undefined
        ? (current?.projectId ?? null)
        : dto.projectId || null;
    const type = dto.type ?? current?.type ?? 'news';
    const meetingStartAt =
      dto.meetingStartAt === undefined
        ? (current?.meetingStartAt ?? null)
        : this.toDate(dto.meetingStartAt);
    const meetingEndAt =
      dto.meetingEndAt === undefined
        ? (current?.meetingEndAt ?? null)
        : this.toDate(dto.meetingEndAt);
    const publishedAt =
      dto.publishedAt === undefined
        ? (current?.publishedAt ?? null)
        : this.toDate(dto.publishedAt);
    const expiresAt =
      dto.expiresAt === undefined
        ? (current?.expiresAt ?? null)
        : this.toDate(dto.expiresAt);

    if (projectId) {
      const exists = await this.prisma.project.count({
        where: { id: projectId, isActive: true },
      });
      if (!exists)
        throw new BadRequestException(
          'Dự án không tồn tại hoặc đã ngừng hoạt động',
        );
    }
    if (type === 'meeting' && !meetingStartAt) {
      throw new BadRequestException(
        'Thông báo lịch họp phải có thời gian bắt đầu',
      );
    }
    if (meetingStartAt && meetingEndAt && meetingEndAt <= meetingStartAt) {
      throw new BadRequestException(
        'Thời gian kết thúc phải sau thời gian bắt đầu',
      );
    }
    if (expiresAt && publishedAt && expiresAt <= publishedAt) {
      throw new BadRequestException('Ngày hết hạn phải sau ngày đăng');
    }
    const meetingUrl =
      dto.meetingUrl === undefined
        ? (current?.meetingUrl ?? null)
        : this.cleanText(dto.meetingUrl);
    if (meetingUrl && !/^https?:\/\//i.test(meetingUrl)) {
      throw new BadRequestException(
        'Đường dẫn họp phải bắt đầu bằng http:// hoặc https://',
      );
    }

    return {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.summary !== undefined
        ? { summary: this.cleanText(dto.summary) }
        : {}),
      ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
      ...(dto.type !== undefined ? { type } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.isPinned !== undefined ? { isPinned: dto.isPinned } : {}),
      projectId,
      meetingStartAt,
      meetingEndAt,
      location:
        dto.location === undefined
          ? (current?.location ?? null)
          : this.cleanText(dto.location),
      meetingUrl,
      publishedAt,
      expiresAt,
      _mergedStatus: merged.status,
    };
  }

  private clearCache() {
    this.listCache.clear();
  }

  async create(dto: CreateAnnouncementDto, actorId: number, ip?: string) {
    const normalized = await this.normalize(dto);
    const status = dto.status || 'draft';
    const { _mergedStatus: _ignored, ...data } = normalized;
    const item = await this.prisma.announcement.create({
      data: {
        ...data,
        title: dto.title.trim(),
        content: dto.content.trim(),
        type: dto.type,
        priority: dto.priority || 'normal',
        status,
        publishedAt:
          status === 'published'
            ? data.publishedAt || new Date()
            : data.publishedAt,
        createdById: actorId,
      },
    });
    this.clearCache();
    await this.auditService.logEvent({
      entityType: 'announcement',
      entityId: item.id,
      action: status === 'published' ? 'create_publish' : 'create_draft',
      actorId,
      afterJson: item,
      ip,
    });
    return item;
  }

  async update(
    id: number,
    dto: UpdateAnnouncementDto,
    actorId: number,
    ip?: string,
  ) {
    const current = await this.prisma.announcement.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Không tìm thấy thông báo');
    const normalized = await this.normalize(dto, current);
    const { _mergedStatus, ...data } = normalized;
    if (_mergedStatus === 'published' && !data.publishedAt) {
      data.publishedAt = new Date();
    }
    const item = await this.prisma.announcement.update({ where: { id }, data });
    this.clearCache();
    await this.auditService.logEvent({
      entityType: 'announcement',
      entityId: id,
      action: dto.status === 'archived' ? 'archive' : 'update',
      actorId,
      beforeJson: current,
      afterJson: item,
      ip,
    });
    return item;
  }

  async publish(id: number, actorId: number, ip?: string) {
    return this.update(id, { status: 'published' }, actorId, ip);
  }

  async archive(id: number, actorId: number, ip?: string) {
    return this.update(id, { status: 'archived' }, actorId, ip);
  }

  private escapeIcs(value: string) {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  private formatIcsDate(date: Date) {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  }

  async buildCalendar(user: any, id: number) {
    const item = await this.findVisibleById(user, id);
    if (item.type !== 'meeting' || !item.meetingStartAt) {
      throw new BadRequestException('Thông báo này không phải lịch họp');
    }
    const end =
      item.meetingEndAt ||
      new Date(item.meetingStartAt.getTime() + 60 * 60 * 1000);
    const description = [item.summary, item.content, item.meetingUrl]
      .filter(Boolean)
      .join('\n\n');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Huy Vo Education//HVE Work//VI',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:announcement-${item.id}@huyvoeducation.vn`,
      `DTSTAMP:${this.formatIcsDate(new Date())}`,
      `DTSTART:${this.formatIcsDate(item.meetingStartAt)}`,
      `DTEND:${this.formatIcsDate(end)}`,
      `SUMMARY:${this.escapeIcs(item.title)}`,
      `DESCRIPTION:${this.escapeIcs(description)}`,
      ...(item.location ? [`LOCATION:${this.escapeIcs(item.location)}`] : []),
      ...(item.meetingUrl ? [`URL:${this.escapeIcs(item.meetingUrl)}`] : []),
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    return lines.join('\r\n');
  }
}
