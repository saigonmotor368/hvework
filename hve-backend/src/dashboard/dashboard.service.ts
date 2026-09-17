import { Injectable } from '@nestjs/common';
import {
  buildDocumentAccessWhere,
  buildTaskAccessWhere,
  describeBusinessScope,
  getRoleNames,
} from '../common/access-scope.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface DashboardCacheEntry {
  data: any;
  expiresAt: number;
}

@Injectable()
export class DashboardService {
  private cache = new Map<string, DashboardCacheEntry>();
  private readonly CACHE_TTL_MS = 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  clearCache(userId?: number) {
    if (!userId) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(`dashboard_${userId}_`)) this.cache.delete(key);
    }
  }

  async getDashboardData(user: any) {
    const roles = getRoleNames(user);
    const scope = describeBusinessScope(user);
    const cacheKey = `dashboard_${user.id}_${user.departmentId || 'none'}_${roles.join('-')}`;
    const nowMs = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) return cached.data;

    const data = await this.getScopedDashboard(user, scope);
    this.cache.set(cacheKey, { data, expiresAt: nowMs + this.CACHE_TTL_MS });
    return data;
  }

  private async getScopedDashboard(user: any, scope: ReturnType<typeof describeBusinessScope>) {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const documentScope = buildDocumentAccessWhere(user);
    const taskScope = buildTaskAccessWhere(user);
    const actionableRoles = scope.roles.filter((role) =>
      !['employee', 'it_admin'].includes(role),
    );
    const pendingStepConditions: any[] = [];
    if (scope.roles.includes('ceo')) {
      pendingStepConditions.push({ status: 'pending', roleRequired: 'ceo' });
    } else {
      if (scope.roles.includes('department_head') && scope.departmentId) {
        pendingStepConditions.push({
          status: 'pending',
          roleRequired: 'department_head',
          document: { createdBy: { departmentId: scope.departmentId } },
        });
      }
      const nonDepartmentRoles = actionableRoles.filter((role) => role !== 'department_head');
      if (nonDepartmentRoles.length > 0) {
        pendingStepConditions.push({
          status: 'pending',
          roleRequired: { in: nonDepartmentRoles },
        });
      }
    }

    const documentSelect = {
      id: true,
      code: true,
      title: true,
      type: true,
      status: true,
      dataJson: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          departmentId: true,
          department: { select: { id: true, name: true, code: true } },
        },
      },
    } as const;
    const taskSelect = {
      id: true,
      code: true,
      title: true,
      dueDate: true,
      status: true,
      priority: true,
      progressPercent: true,
      assignee: {
        select: {
          id: true,
          name: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
        },
      },
      createdBy: { select: { id: true, name: true, departmentId: true } },
    } as const;

    const [documents, tasks, pendingDocuments, returnedDocuments, departments] = await Promise.all([
      this.prisma.document.findMany({
        where: documentScope,
        select: documentSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.findMany({
        where: { AND: [taskScope, { parentTaskId: null }] },
        select: taskSelect,
        orderBy: { createdAt: 'desc' },
      }),
      pendingStepConditions.length > 0
        ? this.prisma.document.findMany({
            where: {
              AND: [
                documentScope,
                { status: 'Chờ duyệt' },
                {
                  steps: {
                    some: pendingStepConditions.length === 1
                      ? pendingStepConditions[0]
                      : { OR: pendingStepConditions },
                  },
                },
              ],
            },
            select: documentSelect,
            orderBy: { createdAt: 'asc' },
          })
        : Promise.resolve([]),
      this.prisma.document.findMany({
        where: {
          createdById: user.id,
          status: { in: ['Nháp', 'Trả lại'] },
          steps: { some: { status: 'returned' } },
        },
        select: documentSelect,
        orderBy: { updatedAt: 'desc' },
      }),
      scope.capabilities.canViewCompany
        ? this.prisma.department.findMany({
            include: {
              users: {
                select: {
                  assignedTasks: {
                    where: { parentTaskId: null },
                    select: { status: true },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const overdueTasks = tasks.filter((task: any) =>
      task.status !== 'Hoàn thành' && task.dueDate && new Date(task.dueDate) < now,
    );
    const urgentTasks = tasks.filter((task: any) =>
      task.status !== 'Hoàn thành' && task.dueDate && new Date(task.dueDate) <= endOfToday,
    );
    const escalatedTasks = overdueTasks.filter((task: any) =>
      task.dueDate && new Date(task.dueDate) < threeDaysAgo,
    );

    const contracts = documents.filter((doc: any) => doc.type === 'contract');
    const expiringContracts = contracts.filter((doc: any) => {
      const endDate = (doc.dataJson as any)?.endDate;
      if (!endDate) return false;
      const end = new Date(endDate);
      return end >= now && end <= in30Days;
    });
    const approvedPayments = documents.filter((doc: any) =>
      doc.type === 'payment_request' && doc.status === 'Đã duyệt',
    );
    const totalApprovedAmount = approvedPayments.reduce(
      (sum: number, doc: any) => sum + (Number((doc.dataJson as any)?.amount) || 0),
      0,
    );

    const departmentStats = departments.map((department: any) => {
      const departmentTasks = department.users.flatMap((member: any) => member.assignedTasks);
      const completed = departmentTasks.filter((task: any) => task.status === 'Hoàn thành').length;
      return {
        id: department.id,
        name: department.name,
        code: department.code,
        totalTasks: departmentTasks.length,
        completedTasks: completed,
        completionRate: departmentTasks.length > 0
          ? Math.round((completed / departmentTasks.length) * 100)
          : 0,
      };
    });

    const visibleActionDocuments = pendingDocuments.length > 0
      ? pendingDocuments
      : returnedDocuments;

    return {
      role: scope.level,
      roles: scope.roles,
      scope: {
        level: scope.level,
        label: scope.label,
        departmentId: scope.departmentId,
      },
      capabilities: scope.capabilities,
      actionRequired: {
        pendingApprovalsCount: pendingDocuments.length,
        returnedDocumentsCount: returnedDocuments.length,
        overdueTasksCount: overdueTasks.length,
        urgentTasksCount: urgentTasks.length,
        escalatedTasksCount: escalatedTasks.length,
        expiringContractsCount: expiringContracts.length,
        pendingDocuments: visibleActionDocuments,
        returnedDocuments,
        overdueTasks,
        urgentTasks,
        escalatedTasks,
        expiringContracts,
      },
      metrics: {
        documents: {
          total: documents.length,
          pending: documents.filter((doc: any) => doc.status === 'Chờ duyệt').length,
          approved: documents.filter((doc: any) => doc.status === 'Đã duyệt').length,
          draft: documents.filter((doc: any) => doc.status === 'Nháp').length,
          rejected: documents.filter((doc: any) => ['Từ chối', 'Trả lại'].includes(doc.status)).length,
        },
        tasks: {
          total: tasks.length,
          completed: tasks.filter((task: any) => task.status === 'Hoàn thành').length,
          inProgress: tasks.filter((task: any) => task.status === 'Đang làm').length,
          pendingReview: tasks.filter((task: any) => task.status === 'Chờ duyệt').length,
          overdue: overdueTasks.length,
        },
        financials: scope.capabilities.canViewFinancials
          ? { approvedPayments: approvedPayments.length, totalApprovedAmount }
          : null,
        legal: scope.capabilities.canViewLegal
          ? { totalContracts: contracts.length, expiringSoon: expiringContracts.length }
          : null,
      },
      departmentStats: scope.capabilities.canViewCompany ? departmentStats : undefined,
    };
  }
}
