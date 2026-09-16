import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationPayload } from './channels/notification-channel.interface.js';
import { InAppChannel } from './channels/in-app.channel.js';
import { EmailChannel } from './channels/email.channel.js';
import { ZaloChannel } from './channels/zalo.channel.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private inAppChannel: InAppChannel,
    private emailChannel: EmailChannel,
    private zaloChannel: ZaloChannel,
  ) {}

  /**
   * Phát thông báo qua các kênh đã chỉ định
   */
  async dispatchNotification(
    payload: NotificationPayload,
    channels: string[] = ['in_app', 'email'],
  ) {
    const results: Record<string, boolean> = {};

    if (channels.includes('in_app')) {
      results.in_app = await this.inAppChannel.send(payload);
    }
    if (channels.includes('email')) {
      results.email = await this.emailChannel.send(payload);
    }
    if (channels.includes('zalo_oa')) {
      results.zalo_oa = await this.zaloChannel.send(payload);
    }

    return results;
  }

  /**
   * Lấy danh sách thông báo in-app của người dùng
   */
  async getUserNotifications(
    userId: number,
    query: { isUnreadOnly?: boolean | string; limit?: number; page?: number } = {},
  ) {
    const { isUnreadOnly, limit = 20, page = 1 } = query;
    const where: any = { userId, channel: 'in_app' };

    if (isUnreadOnly === true || isUnreadOnly === 'true') {
      where.readAt = null;
    }

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: Number(limit),
        skip: (Number(page) - 1) * Number(limit),
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, channel: 'in_app', readAt: null } }),
    ]);

    return {
      items,
      total,
      unreadCount,
      page: Number(page),
      limit: Number(limit),
    };
  }

  /**
   * Đếm số lượng thông báo chưa đọc
   */
  async getUnreadCount(userId: number): Promise<{ unreadCount: number }> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        channel: 'in_app',
        readAt: null,
      },
    });
    return { unreadCount: count };
  }

  /**
   * Đánh dấu 1 thông báo là đã đọc
   */
  async markAsRead(userId: number, notificationId: number) {
    const notif = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notif || notif.userId !== userId) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  /**
   * Đánh dấu toàn bộ thông báo của user là đã đọc
   */
  async markAllAsRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        channel: 'in_app',
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  /**
   * Quét mốc nhắc tự động định kỳ (Scheduled Reminders)
   * Chống gửi trùng lặp theo ngày bằng dedupeKey
   */
  async triggerScheduledReminders(now: Date = new Date()) {
    const dateStr = now.toISOString().split('T')[0];
    let dispatchedCount = 0;

    // 1. Quét công việc sắp đến hạn (trong vòng 1 đến 3 ngày tới)
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
    const upcomingTasks = await this.prisma.task.findMany({
      where: {
        status: { not: 'Hoàn thành' },
        dueDate: {
          gte: now,
          lte: threeDaysLater,
        },
        assigneeId: { not: null },
      },
      include: {
        assignee: true,
      },
    });

    for (const task of upcomingTasks) {
      if (!task.dueDate || !task.assigneeId) continue;
      const diffMs = task.dueDate.getTime() - now.getTime();
      const daysLeft = Math.max(1, Math.ceil(diffMs / (1000 * 3600 * 24)));
      const dedupeKey = `reminder_task_${task.id}_due_offset${daysLeft}_${dateStr}`;

      const res = await this.dispatchNotification({
        userId: task.assigneeId,
        eventType: 'task_due_soon',
        entityRef: `task:${task.id}`,
        title: `Công việc sắp đến hạn: ${task.code}`,
        content: `Công việc "${task.title}" còn ${daysLeft} ngày là đến hạn hoàn thành (${task.dueDate.toLocaleDateString('vi-VN')}).`,
        link: `/tasks?id=${task.id}`,
        dedupeKey,
      });
      if (res.in_app) dispatchedCount++;
    }

    // 2. Quét công việc quá hạn & Leo thang (Escalation)
    const overdueTasks = await this.prisma.task.findMany({
      where: {
        status: { not: 'Hoàn thành' },
        dueDate: { lt: now },
      },
      include: {
        assignee: true,
        createdBy: { include: { department: true } },
      },
    });

    // Lấy danh sách CEO và Trưởng bộ phận để phục vụ leo thang
    const ceoRole = await this.prisma.role.findUnique({
      where: { name: 'ceo' },
      include: { users: { select: { id: true } } },
    });
    const ceoUserIds = ceoRole?.users.map((u) => u.id) || [];

    for (const task of overdueTasks) {
      if (!task.dueDate) continue;
      const overdueMs = now.getTime() - task.dueDate.getTime();
      const overdueDays = Math.max(1, Math.floor(overdueMs / (1000 * 3600 * 24)));

      // 2a. Gửi cho người thực hiện (assignee)
      if (task.assigneeId) {
        const dedupeKey = `reminder_task_${task.id}_overdue_${dateStr}`;
        const res = await this.dispatchNotification({
          userId: task.assigneeId,
          eventType: 'task_overdue',
          entityRef: `task:${task.id}`,
          title: `Cảnh báo: Công việc ${task.code} đã quá hạn!`,
          content: `Công việc "${task.title}" đã quá hạn ${overdueDays} ngày (Hạn: ${task.dueDate.toLocaleDateString('vi-VN')}). Vui lòng cập nhật tiến độ ngay.`,
          link: `/tasks?id=${task.id}`,
          dedupeKey,
        });
        if (res.in_app) dispatchedCount++;
      }

      // 2b. Quy tắc leo thang: Quá hạn >= 1 ngày báo Trưởng bộ phận
      if (overdueDays >= 1 && task.createdBy?.departmentId) {
        const deptHeads = await this.prisma.user.findMany({
          where: {
            departmentId: task.createdBy.departmentId,
            roles: { some: { name: 'department_head' } },
          },
          select: { id: true },
        });

        for (const dh of deptHeads) {
          if (dh.id !== task.assigneeId) {
            const dedupeKey = `reminder_task_${task.id}_escalate_dh_${dh.id}_${dateStr}`;
            const res = await this.dispatchNotification({
              userId: dh.id,
              eventType: 'task_escalated_dept_head',
              entityRef: `task:${task.id}`,
              title: `[Leo thang BP] Việc quá hạn: ${task.code}`,
              content: `Công việc "${task.title}" của nhân sự ${task.assignee?.name || '---'} đã quá hạn ${overdueDays} ngày.`,
              link: `/tasks?id=${task.id}`,
              dedupeKey,
            });
            if (res.in_app) dispatchedCount++;
          }
        }
      }

      // 2c. Quy tắc leo thang mặc định: Quá hạn >= 3 ngày báo CEO
      if (overdueDays >= 3) {
        for (const ceoId of ceoUserIds) {
          if (ceoId !== task.assigneeId) {
            const dedupeKey = `reminder_task_${task.id}_escalate_ceo_${ceoId}_${dateStr}`;
            const res = await this.dispatchNotification({
              userId: ceoId,
              eventType: 'task_escalated_ceo',
              entityRef: `task:${task.id}`,
              title: `[Leo thang Ban Giám Đốc] Việc chậm tiến độ: ${task.code}`,
              content: `Công việc "${task.title}" thuộc phòng ban ${task.createdBy?.department?.name || '---'} đã quá hạn ${overdueDays} ngày cần chỉ đạo.`,
              link: `/tasks?id=${task.id}`,
              dedupeKey,
            });
            if (res.in_app) dispatchedCount++;
          }
        }
      }
    }

    // 3. Quét Hợp đồng sắp hết hạn (<= 30 ngày)
    const contracts = await this.prisma.document.findMany({
      where: {
        type: 'contract',
        status: 'Đã duyệt',
      },
    });

    const legalRole = await this.prisma.role.findUnique({
      where: { name: 'legal' },
      include: { users: { select: { id: true } } },
    });
    const legalUserIds = legalRole?.users.map((u) => u.id) || [];

    for (const doc of contracts) {
      const data: any = doc.dataJson || {};
      if (!data.endDate) continue;

      const end = new Date(data.endDate);
      const diffMs = end.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 3600 * 24));

      // Mốc nhắc cảnh báo: còn <= 30 ngày và chưa hết hạn quá 15 ngày
      if (daysRemaining <= 30 && daysRemaining >= -15) {
        const dedupeKey = `reminder_contract_${doc.id}_expiring_${dateStr}`;
        const recipientIds = new Set<number>([doc.createdById, ...legalUserIds]);

        for (const uid of recipientIds) {
          const res = await this.dispatchNotification({
            userId: uid,
            eventType: 'contract_expiring_soon',
            entityRef: `document:${doc.id}`,
            title: `Hợp đồng sắp hết hạn: ${doc.code}`,
            content: `Hợp đồng "${doc.title}" (Đối tác: ${data.partner || '---'}) còn ${daysRemaining} ngày là hết hiệu lực (${end.toLocaleDateString('vi-VN')}).`,
            link: `/documents?id=${doc.id}`,
            dedupeKey: `${dedupeKey}_user${uid}`,
          });
          if (res.in_app) dispatchedCount++;
        }
      }
    }

    this.logger.log(`[SCHEDULED REMINDERS] Completed scan for date ${dateStr}. In-app dispatched: ${dispatchedCount}`);
    return { date: dateStr, dispatchedCount };
  }
}
