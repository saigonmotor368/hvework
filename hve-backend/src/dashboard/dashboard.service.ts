import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface DashboardCacheEntry {
  data: any;
  expiresAt: number;
}

@Injectable()
export class DashboardService {
  private cache = new Map<string, DashboardCacheEntry>();
  private readonly CACHE_TTL_MS = 60 * 1000; // 60s in-memory cache

  constructor(private readonly prisma: PrismaService) {}

  clearCache(userId?: number) {
    if (userId) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`dashboard_${userId}_`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  async getDashboardData(user: any) {
    const roles: string[] = user.roles ? user.roles.map((r: any) => (typeof r === 'string' ? r : r.name)) : [];
    const primaryRole = this.resolvePrimaryRole(roles);
    const cacheKey = `dashboard_${user.id}_${primaryRole}`;

    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    let data: any;
    switch (primaryRole) {
      case 'ceo':
        data = await this.getCeoDashboard(user);
        break;
      case 'department_head':
        data = await this.getDeptHeadDashboard(user);
        break;
      case 'accountant':
      case 'legal':
        data = await this.getAccountantLegalDashboard(user);
        break;
      default:
        data = await this.getEmployeeDashboard(user);
        break;
    }

    this.cache.set(cacheKey, {
      data,
      expiresAt: now + this.CACHE_TTL_MS,
    });

    return data;
  }

  private resolvePrimaryRole(roles: string[]): string {
    if (roles.includes('ceo') || roles.includes('it_admin')) return 'ceo';
    if (roles.includes('department_head')) return 'department_head';
    if (roles.includes('accountant')) return 'accountant';
    if (roles.includes('legal')) return 'legal';
    return 'employee';
  }

  private async getCeoDashboard(_user: any) {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Action Required 1: Documents waiting for CEO approval
    const pendingDocuments = await this.prisma.document.findMany({
      where: {
        status: 'Chờ duyệt',
        steps: {
          some: {
            status: 'pending',
            roleRequired: 'ceo',
          },
        },
      },
      select: {
        id: true,
        code: true,
        title: true,
        type: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Action Required 2: Tasks overdue >= 3 days (escalated to CEO)
    const escalatedTasks = await this.prisma.task.findMany({
      where: {
        status: { not: 'Hoàn thành' },
        dueDate: { lt: threeDaysAgo },
      },
      select: {
        id: true,
        code: true,
        title: true,
        dueDate: true,
        status: true,
        priority: true,
        assignee: { select: { id: true, name: true, department: { select: { name: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Overview Stats
    const totalDocs = await this.prisma.document.count();
    const approvedDocs = await this.prisma.document.count({ where: { status: 'Đã duyệt' } });
    const pendingDocs = await this.prisma.document.count({ where: { status: 'Chờ duyệt' } });
    const rejectedDocs = await this.prisma.document.count({ where: { status: { in: ['Từ chối', 'Trả lại'] } } });

    const totalTasks = await this.prisma.task.count();
    const completedTasks = await this.prisma.task.count({ where: { status: 'Hoàn thành' } });
    const overdueTasks = await this.prisma.task.count({
      where: { status: { not: 'Hoàn thành' }, dueDate: { lt: now } },
    });
    const inProgressTasks = await this.prisma.task.count({ where: { status: 'Đang làm' } });

    // Contracts expiring soon (<= 30 days)
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const contracts = await this.prisma.document.findMany({
      where: { type: 'contract' },
      select: { id: true, code: true, title: true, dataJson: true, status: true },
    });

    const expiringContracts = contracts.filter((c: any) => {
      const data = (c.dataJson as any) || {};
      if (!data.endDate) return false;
      const end = new Date(data.endDate);
      return end >= now && end <= in30Days;
    });

    // Department Performance
    const departments = await this.prisma.department.findMany({
      include: {
        users: {
          select: {
            assignedTasks: {
              select: { status: true },
            },
          },
        },
      },
    });

    const departmentStats = departments.map((d: any) => {
      let deptTotal = 0;
      let deptCompleted = 0;
      for (const u of d.users) {
        deptTotal += u.assignedTasks.length;
        deptCompleted += u.assignedTasks.filter((t: any) => t.status === 'Hoàn thành').length;
      }
      return {
        id: d.id,
        name: d.name,
        code: d.code,
        totalTasks: deptTotal,
        completedTasks: deptCompleted,
        completionRate: deptTotal > 0 ? Math.round((deptCompleted / deptTotal) * 100) : 100,
      };
    });

    return {
      role: 'ceo',
      actionRequired: {
        pendingApprovalsCount: pendingDocuments.length,
        escalatedTasksCount: escalatedTasks.length,
        pendingDocuments,
        escalatedTasks,
      },
      metrics: {
        documents: { total: totalDocs, approved: approvedDocs, pending: pendingDocs, rejected: rejectedDocs },
        tasks: { total: totalTasks, completed: completedTasks, overdue: overdueTasks, inProgress: inProgressTasks },
        contracts: { total: contracts.length, expiringSoon: expiringContracts.length },
      },
      departmentStats,
    };
  }

  private async getDeptHeadDashboard(user: any) {
    const now = new Date();
    const userDeptId = user.departmentId || user.department?.id;

    // Action Required 1: Documents waiting for Department Head approval from dept members
    const pendingDocuments = await this.prisma.document.findMany({
      where: {
        status: 'Chờ duyệt',
        createdBy: userDeptId ? { departmentId: userDeptId } : undefined,
        createdById: { not: user.id },
        steps: {
          some: {
            status: 'pending',
            roleRequired: 'department_head',
          },
        },
      },
      select: {
        id: true,
        code: true,
        title: true,
        type: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Action Required 2: Tasks overdue within department
    const overdueTasks = await this.prisma.task.findMany({
      where: {
        status: { not: 'Hoàn thành' },
        dueDate: { lt: now },
        assignee: userDeptId ? { departmentId: userDeptId } : undefined,
      },
      select: {
        id: true,
        code: true,
        title: true,
        dueDate: true,
        status: true,
        priority: true,
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Dept tasks summary
    const deptTasks = await this.prisma.task.findMany({
      where: {
        assignee: userDeptId ? { departmentId: userDeptId } : undefined,
      },
      select: { status: true, progressPercent: true },
    });

    const total = deptTasks.length;
    const completed = deptTasks.filter((t: any) => t.status === 'Hoàn thành').length;
    const inProgress = deptTasks.filter((t: any) => t.status === 'Đang làm').length;
    const pendingReview = deptTasks.filter((t: any) => t.status === 'Chờ duyệt').length;

    return {
      role: 'department_head',
      actionRequired: {
        pendingApprovalsCount: pendingDocuments.length,
        overdueTasksCount: overdueTasks.length,
        pendingDocuments,
        overdueTasks,
      },
      metrics: {
        departmentTasks: {
          total,
          completed,
          inProgress,
          pendingReview,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 100,
        },
      },
    };
  }

  private async getAccountantLegalDashboard(_user: any) {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Pending payment requests waiting for review / disbursement
    const approvedPayments = await this.prisma.document.findMany({
      where: {
        type: 'payment_request',
        status: 'Đã duyệt',
      },
      select: { id: true, code: true, title: true, dataJson: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Expiring contracts
    const allContracts = await this.prisma.document.findMany({
      where: { type: 'contract' },
      select: { id: true, code: true, title: true, dataJson: true, status: true },
    });

    const expiringContracts = allContracts.filter((c: any) => {
      const data = (c.dataJson as any) || {};
      if (!data.endDate) return false;
      const end = new Date(data.endDate);
      return end >= now && end <= in30Days;
    });

    // Calculate total disbursement amount
    let totalApprovedAmount = 0;
    for (const p of approvedPayments) {
      const d = (p.dataJson as any) || {};
      if (d.amount) totalApprovedAmount += Number(d.amount) || 0;
    }

    return {
      role: 'accountant_legal',
      actionRequired: {
        expiringContractsCount: expiringContracts.length,
        approvedPaymentsCount: approvedPayments.length,
        expiringContracts,
        approvedPayments,
      },
      metrics: {
        totalApprovedAmount,
        totalContracts: allContracts.length,
        expiringSoonContracts: expiringContracts.length,
      },
    };
  }

  private async getEmployeeDashboard(user: any) {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Documents returned to employee
    const returnedDocs = await this.prisma.document.findMany({
      where: {
        createdById: user.id,
        status: 'Nháp',
        steps: {
          some: { status: 'returned' },
        },
      },
      select: { id: true, code: true, title: true, updatedAt: true },
    });

    // Tasks due today or overdue
    const urgentTasks = await this.prisma.task.findMany({
      where: {
        assigneeId: user.id,
        status: { not: 'Hoàn thành' },
        dueDate: { lte: endOfToday },
      },
      select: { id: true, code: true, title: true, dueDate: true, priority: true, status: true },
      orderBy: { dueDate: 'asc' },
    });

    // My documents summary
    const myDocs = await this.prisma.document.findMany({
      where: { createdById: user.id },
      select: { status: true },
    });

    const myTasks = await this.prisma.task.findMany({
      where: { assigneeId: user.id },
      select: { status: true },
    });

    return {
      role: 'employee',
      actionRequired: {
        returnedDocumentsCount: returnedDocs.length,
        urgentTasksCount: urgentTasks.length,
        returnedDocuments: returnedDocs,
        urgentTasks,
      },
      metrics: {
        documents: {
          total: myDocs.length,
          pending: myDocs.filter((d: any) => d.status === 'Chờ duyệt').length,
          approved: myDocs.filter((d: any) => d.status === 'Đã duyệt').length,
          draft: myDocs.filter((d: any) => d.status === 'Nháp').length,
        },
        tasks: {
          total: myTasks.length,
          completed: myTasks.filter((t: any) => t.status === 'Hoàn thành').length,
          inProgress: myTasks.filter((t: any) => t.status === 'Đang làm').length,
          pendingReview: myTasks.filter((t: any) => t.status === 'Chờ duyệt').length,
        },
      },
    };
  }
}
