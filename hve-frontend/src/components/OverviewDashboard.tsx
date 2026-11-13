import React, { useState, useEffect } from "react";
import type { DocumentItem, ProjectHealthItem } from "../types";
import { MOCK_DASHBOARD_DATA } from "../mockData";
import { ENABLE_MOCK_DATA } from "../config";
import { fetchWithSession } from "../api/client";
import { isPaymentLikeType } from "../utils/documentTypes";
import { BrandLoader } from "./BrandLoader";
import { AnnouncementBoard } from "./AnnouncementBoard";
import { UserNameButton } from "./UserNameButton";

interface OverviewDashboardProps {
  apiBaseUrl: string;
  user: any;
  pendingCount: number;
  approvedCount: number;
  draftCount: number;
  documents: DocumentItem[];
  getStatusBadge: (status: string) => React.ReactNode;
  onSelectDoc: (doc: any) => void;
  onSelectTask?: (taskId: number) => void;
  onOpenDocuments: (status: string, projectId?: number) => void;
  onOpenTasks: (filter: {
    tab?: "all" | "assigned_to_me" | "assigned_by_me" | "department";
    status?: string;
    isOverdueOnly?: boolean;
    projectId?: number;
  }) => void;
  onViewAll: () => void;
  onDashboardLoaded?: (data: any) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  apiBaseUrl,
  user,
  pendingCount,
  approvedCount,
  draftCount,
  documents,
  getStatusBadge,
  onSelectDoc,
  onSelectTask,
  onOpenDocuments,
  onOpenTasks,
  onViewAll,
  onDashboardLoaded,
}) => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [projectHealth, setProjectHealth] = useState<ProjectHealthItem[]>([]);

  const fetchDashboard = async (clearCache = false) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setDashboardData(ENABLE_MOCK_DATA ? MOCK_DASHBOARD_DATA : null);
      if (!ENABLE_MOCK_DATA) setLoadError("Phiên đăng nhập đã hết hạn.");
      setIsLoading(false);
      return;
    }

    try {
      setLoadError(null);
      if (clearCache) {
        setIsRefreshing(true);
        await fetchWithSession(`${apiBaseUrl}/dashboard/clear-cache`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      const res = await fetchWithSession(`${apiBaseUrl}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Không thể tải dữ liệu tổng quan");
      const data = await res.json();
      setDashboardData(data);
      onDashboardLoaded?.(data);
      if (data?.capabilities?.canViewCompany) {
        const healthResponse = await fetchWithSession(
          `${apiBaseUrl}/dashboard/project-health`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (healthResponse.ok) setProjectHealth(await healthResponse.json());
      } else {
        setProjectHealth([]);
      }
    } catch (error: any) {
      setDashboardData(ENABLE_MOCK_DATA ? MOCK_DASHBOARD_DATA : null);
      if (!ENABLE_MOCK_DATA)
        setLoadError(error.message || "Không thể tải dữ liệu tổng quan");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [user]);

  const userRoles: string[] = user?.roles || [];
  const isCeo = userRoles.includes("ceo") || userRoles.includes("bgd");
  const isDeptHead = userRoles.includes("department_head");
  const capabilities = dashboardData?.capabilities || {};
  const scopeLabel =
    dashboardData?.scope?.label ||
    (isCeo
      ? "Toàn công ty"
      : isDeptHead
        ? "Các dự án phụ trách"
        : "Dữ liệu của tôi");
  const pendingActionCount =
    dashboardData?.actionRequired?.pendingApprovalsCount || 0;
  const returnedActionCount =
    dashboardData?.actionRequired?.returnedDocumentsCount || 0;
  const recentDocuments: DocumentItem[] =
    dashboardData?.recentDocuments || documents;
  const projectStats: any[] = dashboardData?.projectStats || [];
  const projectOverview = Array.from(
    new Set([
      ...projectHealth.map((project) => project.id),
      ...projectStats.map((project) => project.id),
    ]),
  ).map((projectId) => ({
    health: projectHealth.find((project) => project.id === projectId),
    stats: projectStats.find((project) => project.id === projectId),
  }));

  if (isLoading && !dashboardData) {
    return <BrandLoader label="Đang tổng hợp dữ liệu điều hành..." />;
  }

  if (loadError && !dashboardData) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {loadError}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3 sm:space-y-5 md:space-y-8">
      {/* Tiêu đề + làm mới */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 pb-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Tổng quan điều hành
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            Phạm vi: <strong className="text-gray-800">{scopeLabel}</strong>
          </p>
          {(userRoles.length > 1 || draftCount > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {userRoles.length > 1 && (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                  Đã gộp {userRoles.length} vai trò
                </span>
              )}
              {draftCount > 0 && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                  {draftCount} bản nháp cá nhân
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => fetchDashboard(true)}
          disabled={isRefreshing}
          aria-label="Làm mới dữ liệu"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
          <span className="hidden sm:inline">
            {isRefreshing ? "Đang làm mới..." : "Làm mới dữ liệu"}
          </span>
        </button>
      </div>

      <AnnouncementBoard apiBaseUrl={apiBaseUrl} />

      {/* KHỐI 1: CẦN HÀNH ĐỘNG NGAY (ACTION REQUIRED) - ĐẶT TRÊN CÙNG */}
      <section className="bg-gradient-to-br from-rose-50/70 via-amber-50/40 to-white rounded-2xl md:rounded-3xl p-2.5 sm:p-4 md:p-6 border border-rose-200/80 md:border-2 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
          <div className="flex min-w-0 items-start sm:items-center space-x-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight flex flex-wrap items-center gap-y-1">
              ⚠️ CẦN HÀNH ĐỘNG NGAY
              <span className="ml-2 hidden sm:inline text-xs bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full font-bold">
                Ưu tiên cao nhất
              </span>
            </h2>
          </div>
          <span className="hidden text-xs text-gray-500 sm:block">
            Tự động quét theo chu kỳ kiểm soát nội bộ
          </span>
        </div>

        {/* Action Items according to Role */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
          {/* Action Box 1: Pending Documents for Approval */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-rose-100 shadow-sm">
            <div className="flex items-start justify-between gap-2 pb-1.5 sm:pb-2 border-b border-slate-100">
              <span className="text-[11px] sm:text-xs font-bold text-gray-600 uppercase tracking-wide sm:tracking-wider leading-snug">
                {pendingActionCount > 0
                  ? "Hồ sơ đang chờ bạn xử lý"
                  : "Hồ sơ của bạn cần bổ sung"}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                {pendingActionCount || returnedActionCount} hồ sơ
              </span>
            </div>

            <div className="mt-1 divide-y divide-slate-100 sm:mt-2">
              {(dashboardData?.actionRequired?.pendingDocuments?.length ||
                0) === 0 &&
              (dashboardData?.actionRequired?.returnedDocuments?.length ||
                0) === 0 ? (
                <p className="text-xs text-emerald-600 font-medium py-3 text-center">
                  ✓ Không có hồ sơ nào đang bị nghẽn ở bước này.
                </p>
              ) : (
                (
                  dashboardData?.actionRequired?.pendingDocuments ||
                  dashboardData?.actionRequired?.returnedDocuments ||
                  []
                )
                  .slice(0, 3)
                  .map((doc: any) => (
                    <div
                      key={doc.id}
                      onClick={() => onSelectDoc(doc)}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-slate-50 active:bg-slate-100 sm:px-1.5 sm:py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="shrink-0 whitespace-nowrap rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-[#0A66C2]">
                            {doc.code}
                          </span>
                          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-800">
                            {doc.title}
                          </p>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-gray-400">
                          Người tạo:{" "}
                          <UserNameButton user={doc.createdBy} fallback="Tôi" />
                        </p>
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-[#0A66C2]">
                        <span className="hidden sm:inline">Xử lý </span>
                        <span aria-hidden className="text-base">›</span>
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Action Box 2: Overdue / Escalated Tasks or Expiring Contracts */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-rose-100 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-slate-100">
              <span className="text-[11px] sm:text-xs font-bold text-gray-600 uppercase tracking-wide sm:tracking-wider leading-snug">
                {capabilities.canViewCompany
                  ? "Việc quá hạn leo thang CEO (≥3 ngày)"
                  : capabilities.canViewDepartment
                    ? "Việc quá hạn trong phạm vi phụ trách"
                    : "Nhiệm vụ đến hạn hôm nay / quá hạn"}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                {`${
                  capabilities.canViewCompany
                    ? (dashboardData?.actionRequired?.escalatedTasksCount ?? 0)
                    : (dashboardData?.actionRequired?.overdueTasksCount ??
                      dashboardData?.actionRequired?.urgentTasksCount ??
                      0)
                } việc`}
              </span>
            </div>

            <div className="mt-1 divide-y divide-slate-100 sm:mt-2">
              {(() => {
                const tasks =
                  (capabilities.canViewCompany &&
                    dashboardData?.actionRequired?.escalatedTasks) ||
                  dashboardData?.actionRequired?.overdueTasks ||
                  dashboardData?.actionRequired?.urgentTasks ||
                  [];

                if (tasks.length === 0) {
                  return (
                    <p className="text-xs text-emerald-600 font-medium py-3 text-center">
                      ✓ Toàn bộ tiến độ công việc đang trong tầm kiểm soát!
                    </p>
                  );
                }

                return tasks.slice(0, 3).map((t: any) => (
                  <div
                    key={t.id}
                    onClick={() => onSelectTask && onSelectTask(t.id)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-slate-50 active:bg-slate-100 sm:px-1.5 sm:py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="shrink-0 whitespace-nowrap rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-bold text-red-600">
                          {t.code}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-gray-800">
                          {t.title}
                        </p>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-gray-400">
                        Phụ trách:{" "}
                        <UserNameButton user={t.assignee} fallback="N/A" />
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-red-600">
                      <span className="hidden sm:inline">Đôn đốc </span>
                      <span aria-hidden className="text-base">›</span>
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* KHỐI 2: CÁC THẺ THỐNG KÊ CHÍNH (METRICS SUMMARY) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <button
          type="button"
          onClick={() => onOpenDocuments("Chờ duyệt")}
          className="group bg-white rounded-2xl p-3 sm:p-5 shadow-sm border border-slate-200 flex flex-col-reverse items-start gap-1 sm:gap-2 sm:flex-row sm:items-center sm:justify-between text-left transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
          aria-label="Xem hồ sơ chờ phê duyệt"
        >
          <div>
            <span className="block text-[10px] sm:text-xs font-bold text-amber-700 uppercase leading-tight tracking-wide sm:tracking-wider">
              Hồ sơ chờ phê duyệt
            </span>
            <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-extrabold text-amber-900">
              {dashboardData?.metrics?.documents?.pending ?? pendingCount}
            </p>
            <p className="hidden sm:block text-xs text-gray-400 mt-1">Cần hoàn tất đúng mốc</p>
            <span className="mt-2 hidden sm:block text-[11px] font-bold text-amber-700 opacity-80 group-hover:opacity-100">
              Xem chi tiết →
            </span>
          </div>
          <div className="hidden sm:flex sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 items-center justify-center text-lg sm:text-2xl font-bold shadow-inner">
            ⏳
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenDocuments("Đã duyệt")}
          className="group bg-white rounded-2xl p-3 sm:p-5 shadow-sm border border-slate-200 flex flex-col-reverse items-start gap-1 sm:gap-2 sm:flex-row sm:items-center sm:justify-between text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
          aria-label="Xem hồ sơ đã thông qua"
        >
          <div>
            <span className="block text-[10px] sm:text-xs font-bold text-emerald-700 uppercase leading-tight tracking-wide sm:tracking-wider">
              Hồ sơ đã thông qua
            </span>
            <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-900">
              {dashboardData?.metrics?.documents?.approved ?? approvedCount}
            </p>
            <p className="hidden sm:block text-xs text-gray-400 mt-1">Đã phê duyệt hoàn tất</p>
            <span className="mt-2 hidden sm:block text-[11px] font-bold text-emerald-700 opacity-80 group-hover:opacity-100">
              Xem chi tiết →
            </span>
          </div>
          <div className="hidden sm:flex sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 items-center justify-center text-lg sm:text-2xl font-bold shadow-inner">
            ✓
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            onOpenTasks({
              tab: capabilities.canViewCompany ? "all" : "assigned_to_me",
            })
          }
          className="group bg-white rounded-2xl p-3 sm:p-5 shadow-sm border border-slate-200 flex flex-col-reverse items-start gap-1 sm:gap-2 sm:flex-row sm:items-center sm:justify-between text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Xem công việc chưa hoàn thành"
        >
          <div>
            <span className="block text-[10px] sm:text-xs font-bold text-blue-700 uppercase leading-tight tracking-wide sm:tracking-wider">
              {capabilities.canViewCompany
                ? "Việc chưa hoàn thành"
                : "Việc đang tham gia"}
            </span>
            <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-extrabold text-blue-900">
              {dashboardData?.metrics?.tasks?.active ??
                dashboardData?.metrics?.tasks?.inProgress ??
                dashboardData?.metrics?.departmentTasks?.inProgress ??
                0}
            </p>
            <p className="hidden sm:block text-xs text-gray-400 mt-1">
              {capabilities.canViewCompany
                ? "Tổng số chưa hoàn tất toàn công ty"
                : "Gồm việc được giao chính hoặc tham gia phối hợp"}
            </p>
            <span className="mt-2 hidden sm:block text-[11px] font-bold text-blue-700 opacity-80 group-hover:opacity-100">
              Xem chi tiết →
            </span>
          </div>
          <div className="hidden sm:flex sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-600 items-center justify-center text-lg sm:text-2xl font-bold shadow-inner">
            ⚙️
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            onOpenTasks({
              tab: capabilities.canViewCompany ? "all" : "assigned_to_me",
              isOverdueOnly: true,
            })
          }
          className="group bg-white rounded-2xl p-3 sm:p-5 shadow-sm border border-slate-200 flex flex-col-reverse items-start gap-1 sm:gap-2 sm:flex-row sm:items-center sm:justify-between text-left transition hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-400"
          aria-label="Xem công việc quá hạn"
        >
          <div>
            <span className="block text-[10px] sm:text-xs font-bold text-rose-700 uppercase leading-tight tracking-wide sm:tracking-wider">
              Việc quá hạn xử lý
            </span>
            <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-extrabold text-rose-900">
              {dashboardData?.metrics?.tasks?.overdue ??
                dashboardData?.actionRequired?.overdueTasksCount ??
                0}
            </p>
            <p className="hidden sm:block text-xs text-gray-400 mt-1">Cần tăng tốc can thiệp</p>
            <span className="mt-2 hidden sm:block text-[11px] font-bold text-rose-700 opacity-80 group-hover:opacity-100">
              Xem chi tiết →
            </span>
          </div>
          <div className="hidden sm:flex sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-rose-50 text-rose-600 items-center justify-center text-lg sm:text-2xl font-bold shadow-inner">
            🚨
          </div>
        </button>
      </div>

      {(capabilities.canViewFinancials || capabilities.canViewLegal) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {capabilities.canViewFinancials && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Nghiệp vụ kế toán
              </p>
              <p className="mt-2 text-2xl font-black text-emerald-900">
                {Number(
                  dashboardData?.metrics?.financials?.totalApprovedAmount || 0,
                ).toLocaleString("vi-VN")}{" "}
                ₫
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                {dashboardData?.metrics?.financials?.approvedPayments || 0} đề
                nghị thanh toán đã duyệt trong phạm vi được xem
              </p>
            </div>
          )}
          {capabilities.canViewLegal && (
            <button
              type="button"
              onClick={() => onOpenDocuments("all")}
              className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 text-left transition hover:border-violet-400"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-violet-700">
                Nghiệp vụ pháp chế
              </p>
              <p className="mt-2 text-2xl font-black text-violet-900">
                {dashboardData?.metrics?.legal?.expiringSoon || 0} hợp đồng sắp
                hết hạn
              </p>
              <p className="mt-1 text-xs text-violet-700">
                Tổng {dashboardData?.metrics?.legal?.totalContracts || 0} hợp
                đồng trong phạm vi được xem · Xem chi tiết →
              </p>
            </button>
          )}
        </div>
      )}

      {/* KHỐI 3: TỔNG QUAN SỨC KHỎE VÀ TIẾN ĐỘ DỰ ÁN */}
      {capabilities.canViewCompany && projectOverview.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Tổng quan tiến độ dự án
              </h2>
              <p className="text-xs text-slate-500">
                Tỷ lệ hoàn thành, công việc quá hạn và hồ sơ chờ duyệt trên 5 ngày.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-500">
              Cập nhật tự động · Bấm để xem công việc
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {projectOverview.map(({ health, stats }) => {
              const project = health || stats;
              const completionRate = stats?.completionRate || 0;
              const completedTasks = stats?.completedTasks || 0;
              const totalTasks = stats?.totalTasks || 0;
              const openTasks = health?.openTasks ?? health?.total ?? 0;
              const overdueTasksCount = health?.overdueTasks ?? 0;
              const pendingDocs = health?.pendingDocuments ?? 0;
              const overdueDocs = health?.overdueDocuments ?? 0;
              const style =
                health?.level === "rui_ro_cao"
                  ? {
                      label: "Rủi ro cao",
                      badge: "border-rose-200 bg-rose-50 text-rose-700",
                      text: "text-rose-700",
                      bar: "bg-rose-500",
                    }
                  : health?.level === "tre_tien_do"
                    ? {
                        label: "Trễ tiến độ",
                        badge: "border-orange-200 bg-orange-50 text-orange-700",
                        text: "text-orange-700",
                        bar: "bg-orange-500",
                      }
                    : health?.level === "can_chu_y"
                      ? {
                          label: "Cần chú ý",
                          badge: "border-amber-200 bg-amber-50 text-amber-700",
                          text: "text-amber-700",
                          bar: "bg-amber-500",
                        }
                      : {
                          label: "Bình thường",
                          badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
                          text: "text-emerald-700",
                          bar: "bg-[#0A66C2]",
                        };
              return (
                <div
                  key={project.id}
                  className="group rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() =>
                      totalTasks === 0 && openTasks === 0 && pendingDocs > 0
                        ? onOpenDocuments("Chờ duyệt", project.id)
                        : onOpenTasks({ projectId: project.id })
                    }
                    className="block w-full text-left"
                    aria-label={`Xem chi tiết dự án ${project.name}`}
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#0A66C2]">
                      {project.code}
                      </span>
                      <strong className="mt-0.5 block truncate text-sm text-slate-900 group-hover:text-[#0A66C2]">
                        {project.name}
                      </strong>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${style.badge}`}>
                      {style.label}
                    </span>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-500">
                      Tiến độ công việc
                    </span>
                    <span className="text-lg font-black text-[#0A66C2]">
                      {totalTasks === 0 ? "Chưa có việc" : `${completionRate}%`}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
                      style={{ width: `${totalTasks === 0 ? 0 : completionRate}%` }}
                    />
                  </div>

                  </button>

                  <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50 py-2.5 text-center">
                    <div className="px-1">
                      <strong className="block text-sm text-slate-800">{completedTasks}/{totalTasks}</strong>
                      <span className="text-[10px] text-slate-500">Việc hoàn thành</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenTasks({ projectId: project.id })}
                      className="px-1 hover:bg-white"
                      aria-label={`Xem công việc đang mở của ${project.name}`}
                    >
                      <strong className={`block text-sm ${overdueTasksCount > 0 ? style.text : "text-slate-800"}`}>
                        {openTasks}
                        {overdueTasksCount > 0 && (
                          <span className="text-[10px] font-semibold"> ({overdueTasksCount} trễ)</span>
                        )}
                      </strong>
                      <span className="text-[10px] text-slate-500">Việc đang mở</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenDocuments("Chờ duyệt", project.id)}
                      className="px-1 hover:bg-white"
                      aria-label={`Xem hồ sơ chờ duyệt của ${project.name}`}
                    >
                      <strong className={`block text-sm ${overdueDocs > 0 ? style.text : "text-slate-800"}`}>
                        {pendingDocs}
                        {overdueDocs > 0 && (
                          <span className="text-[10px] font-semibold"> ({overdueDocs} quá 5 ngày)</span>
                        )}
                      </strong>
                      <span className="text-[10px] text-slate-500">Hồ sơ chờ duyệt</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* KHỐI 4: HỒ SƠ GẦN ĐÂY */}
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="text-base font-bold text-gray-900">
            Hồ sơ luân chuyển gần đây
          </h3>
          <button
            onClick={onViewAll}
            className="text-xs font-semibold text-[#0A66C2] hover:underline"
          >
            Xem tất cả (
            {dashboardData?.metrics?.documents?.total ?? recentDocuments.length}
            ) →
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {recentDocuments.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              Chưa có hồ sơ nào.
            </p>
          ) : (
            recentDocuments.slice(0, 5).map((doc, index) => (
              <div
                key={doc.id}
                data-extra={index >= 3 ? 'true' : undefined}
                onClick={() => onSelectDoc(doc)}
                className="py-3.5 flex flex-col gap-2 data-[extra=true]:hidden sm:data-[extra=true]:flex sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50 cursor-pointer rounded-lg px-2 sm:px-3 transition-all"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-[#0A66C2]">
                      {doc.code}
                    </span>
                    <span className="min-w-0 line-clamp-2 text-sm font-semibold text-gray-800">
                      {doc.title}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {isPaymentLikeType(doc.type) && doc.dataJson?.amount ? (
                      <>
                        Số tiền:{" "}
                        <strong className="text-gray-700">
                          {Number(doc.dataJson.amount).toLocaleString("vi-VN")}{" "}
                          VND
                        </strong>{" "}
                        — Người nhận: {doc.dataJson.receiver}
                      </>
                    ) : doc.type === "contract" ? (
                      <>
                        Đối tác:{" "}
                        <strong className="text-gray-700">
                          {doc.dataJson?.partner}
                        </strong>{" "}
                        — Hạn: {doc.dataJson?.endDate}
                      </>
                    ) : (
                      <>
                        Người lập:{" "}
                        <strong className="text-gray-700">
                          <UserNameButton user={doc.createdBy} fallback="---" />
                        </strong>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                  {getStatusBadge(doc.status)}
                  <span className="text-xs text-gray-400">v{doc.version}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
