import { Injectable } from '@nestjs/common';
import {
  buildDocumentAccessWhere,
  buildApprovalStepAccessConditions,
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
    this.cache.delete('project_health_company');
    for (const key of this.cache.keys()) {
      if (key.startsWith(`dashboard_${userId}_`)) this.cache.delete(key);
    }
  }

  async getProjectHealth() {
    const cacheKey = 'project_health_company';
    const nowMs = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) return cached.data;

    const now = new Date();
    const fiveDaysAgo = new Date(nowMs - 5 * 24 * 60 * 60 * 1000);
    const [
      projects,
      openTasks,
      overdueTasks,
      pendingDocuments,
      overdueDocuments,
    ] = await Promise.all([
      this.prisma.project.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.task.groupBy({
        by: ['projectId'],
        where: { projectId: { not: null }, status: { not: 'Hoàn thành' } },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['projectId'],
        where: {
          projectId: { not: null },
          status: { not: 'Hoàn thành' },
          dueDate: { lt: now },
        },
        _count: { _all: true },
      }),
      this.prisma.document.groupBy({
        by: ['projectId'],
        where: { projectId: { not: null }, status: 'Chờ duyệt' },
        _count: { _all: true },
      }),
      this.prisma.document.groupBy({
        by: ['projectId'],
        where: {
          projectId: { not: null },
          status: 'Chờ duyệt',
          createdAt: { lt: fiveDaysAgo },
        },
        _count: { _all: true },
      }),
    ]);

    const toCountMap = (rows: any[]) =>
      new Map<number, number>(
        rows
          .filter((row) => typeof row.projectId === 'number')
          .map((row) => [row.projectId, Number(row._count._all)]),
      );
    const openTaskMap = toCountMap(openTasks);
    const overdueTaskMap = toCountMap(overdueTasks);
    const pendingDocumentMap = toCountMap(pendingDocuments);
    const overdueDocumentMap = toCountMap(overdueDocuments);

    const data = projects.map((project) => {
      const total =
        (openTaskMap.get(project.id) || 0) +
        (pendingDocumentMap.get(project.id) || 0);
      const overdue =
        (overdueTaskMap.get(project.id) || 0) +
        (overdueDocumentMap.get(project.id) || 0);
      const ratio = total > 0 ? overdue / total : 0;
      return {
        ...project,
        total,
        overdue,
        ratio,
        percent: Math.round(ratio * 100),
        level:
          ratio === 0
            ? 'binh_thuong'
            : ratio <= 0.2
              ? 'can_chu_y'
              : ratio <= 0.5
                ? 'tre_tien_do'
                : 'rui_ro_cao',
      };
    });

    this.cache.set(cacheKey, {
      data,
      expiresAt: nowMs + this.CACHE_TTL_MS,
    });
    return data;
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

  private async getScopedDashboard(
    user: any,
    scope: ReturnType<typeof describeBusinessScope>,
  ) {
    const now = new Date();
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
    );
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const documentScope = buildDocumentAccessWhere(user);
    const taskScope = buildTaskAccessWhere(user);
    const pendingStepConditions = buildApprovalStepAccessConditions(user);

    const documentSelect = {
      id: true,
      code: true,
      title: true,
      type: true,
      status: true,
      dataJson: true,
      createdAt: true,
      updatedAt: true,
      version: true,
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
      projectId: true,
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

    const [
      documents,
      tasks,
      pendingDocuments,
      returnedDocuments,
      projects,
      companyTaskStatusGroups,
      companyDocumentStatusGroups,
      companyOverdueTaskCount,
    ] = await Promise.all([
      this.prisma.document.findMany({
        relationLoadStrategy: 'join',
        where: documentScope,
        select: documentSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.findMany({
        relationLoadStrategy: 'join',
        where: { AND: [taskScope, { parentTaskId: null }] },
        select: taskSelect,
        orderBy: { createdAt: 'desc' },
      }),
      pendingStepConditions.length > 0
        ? this.prisma.document.findMany({
            relationLoadStrategy: 'join',
            where: {
              AND: [
                documentScope,
                { status: 'Chờ duyệt' },
                {
                  steps: {
                    some:
                      pendingStepConditions.length === 1
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
        relationLoadStrategy: 'join',
        where: {
          createdById: user.id,
          status: { in: ['Nháp', 'Trả lại'] },
          steps: { some: { status: 'returned' } },
        },
        select: documentSelect,
        orderBy: { updatedAt: 'desc' },
      }),
      scope.capabilities.canViewCompany
        ? this.prisma.project.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
      // Dashboard điều hành phải phản ánh toàn bộ số liệu công ty. Không dùng
      // danh sách chi tiết đã lọc theo visibility để tránh bỏ sót công việc
      // "targeted" mà BGĐ không phải người giao/nhận. Chỉ trả về số đếm tổng
      // hợp, không làm lộ nội dung công việc chỉ định riêng.
      scope.capabilities.canViewCompany
        ? this.prisma.task.groupBy({
            by: ['projectId', 'status'],
            where: { parentTaskId: null },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      scope.capabilities.canViewCompany
        ? this.prisma.document.groupBy({
            by: ['status'],
            _count: { _all: true },
          })
        : Promise.resolve([]),
      scope.capabilities.canViewCompany
        ? this.prisma.task.count({
            where: {
              parentTaskId: null,
              status: { not: 'Hoàn thành' },
              dueDate: { lt: now },
            },
          })
        : Promise.resolve(0),
    ]);

    const overdueTasks = tasks.filter(
      (task: any) =>
        task.status !== 'Hoàn thành' &&
        task.dueDate &&
        new Date(task.dueDate) < now,
    );
    const urgentTasks = tasks.filter(
      (task: any) =>
        task.status !== 'Hoàn thành' &&
        task.dueDate &&
        new Date(task.dueDate) <= endOfToday,
    );
    const escalatedTasks = overdueTasks.filter(
      (task: any) => task.dueDate && new Date(task.dueDate) < threeDaysAgo,
    );

    const contracts = documents.filter((doc: any) => doc.type === 'contract');
    const expiringContracts = contracts.filter((doc: any) => {
      const endDate = (doc.dataJson as any)?.endDate;
      if (!endDate) return false;
      const end = new Date(endDate);
      return end >= now && end <= in30Days;
    });
    const approvedPayments = documents.filter(
      (doc: any) => doc.type === 'payment_request' && doc.status === 'Đã duyệt',
    );
    const totalApprovedAmount = approvedPayments.reduce(
      (sum: number, doc: any) =>
        sum + (Number((doc.dataJson as any)?.amount) || 0),
      0,
    );

    const safeCompanyTaskGroups = Array.isArray(companyTaskStatusGroups)
      ? (companyTaskStatusGroups as any[])
      : [];
    const safeCompanyDocumentGroups = Array.isArray(companyDocumentStatusGroups)
      ? (companyDocumentStatusGroups as any[])
      : [];
    const companyTaskCountByStatus = new Map<string, number>();
    for (const row of safeCompanyTaskGroups) {
      companyTaskCountByStatus.set(
        row.status,
        (companyTaskCountByStatus.get(row.status) || 0) +
          Number(row._count._all),
      );
    }
    const companyDocumentCountByStatus = new Map<string, number>(
      safeCompanyDocumentGroups.map((row) => [
        row.status,
        Number(row._count._all),
      ]),
    );
    const companyTaskTotal = [...companyTaskCountByStatus.values()].reduce(
      (sum, count) => sum + count,
      0,
    );
    const companyTaskCompleted =
      companyTaskCountByStatus.get('Hoàn thành') || 0;
    const visibleActiveTasks = tasks.filter(
      (task: any) => task.status !== 'Hoàn thành',
    ).length;

    const projectStats = projects.map((project: any) => {
      const projectGroups = scope.capabilities.canViewCompany
        ? safeCompanyTaskGroups.filter((row) => row.projectId === project.id)
        : [];
      const totalTasks = projectGroups.reduce(
        (sum, row) => sum + Number(row._count._all),
        0,
      );
      const completed = projectGroups
        .filter((row) => row.status === 'Hoàn thành')
        .reduce((sum, row) => sum + Number(row._count._all), 0);
      return {
        id: project.id,
        name: project.name,
        code: project.code,
        totalTasks,
        completedTasks: completed,
        completionRate:
          totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0,
      };
    });

    const visibleActionDocuments =
      pendingDocuments.length > 0 ? pendingDocuments : returnedDocuments;

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
          total: scope.capabilities.canViewCompany
            ? [...companyDocumentCountByStatus.values()].reduce(
                (sum, count) => sum + count,
                0,
              )
            : documents.length,
          pending: scope.capabilities.canViewCompany
            ? companyDocumentCountByStatus.get('Chờ duyệt') || 0
            : documents.filter((doc: any) => doc.status === 'Chờ duyệt').length,
          approved: scope.capabilities.canViewCompany
            ? companyDocumentCountByStatus.get('Đã duyệt') || 0
            : documents.filter((doc: any) => doc.status === 'Đã duyệt').length,
          draft: scope.capabilities.canViewCompany
            ? companyDocumentCountByStatus.get('Nháp') || 0
            : documents.filter((doc: any) => doc.status === 'Nháp').length,
          rejected: scope.capabilities.canViewCompany
            ? (companyDocumentCountByStatus.get('Từ chối') || 0) +
              (companyDocumentCountByStatus.get('Trả lại') || 0)
            : documents.filter((doc: any) =>
                ['Từ chối', 'Trả lại'].includes(doc.status),
              ).length,
        },
        tasks: {
          total: scope.capabilities.canViewCompany
            ? companyTaskTotal
            : tasks.length,
          completed: scope.capabilities.canViewCompany
            ? companyTaskCompleted
            : tasks.filter((task: any) => task.status === 'Hoàn thành').length,
          active: scope.capabilities.canViewCompany
            ? companyTaskTotal - companyTaskCompleted
            : visibleActiveTasks,
          visibleActive: visibleActiveTasks,
          inProgress: scope.capabilities.canViewCompany
            ? companyTaskCountByStatus.get('Đang làm') || 0
            : tasks.filter((task: any) => task.status === 'Đang làm').length,
          pendingReview: scope.capabilities.canViewCompany
            ? companyTaskCountByStatus.get('Chờ duyệt') || 0
            : tasks.filter((task: any) => task.status === 'Chờ duyệt').length,
          overdue: scope.capabilities.canViewCompany
            ? Number(companyOverdueTaskCount || 0)
            : overdueTasks.length,
        },
        financials: scope.capabilities.canViewFinancials
          ? { approvedPayments: approvedPayments.length, totalApprovedAmount }
          : null,
        legal: scope.capabilities.canViewLegal
          ? {
              totalContracts: contracts.length,
              expiringSoon: expiringContracts.length,
            }
          : null,
      },
      recentDocuments: documents.slice(0, 5),
      projectStats: scope.capabilities.canViewCompany
        ? projectStats
        : undefined,
    };
  }
}
