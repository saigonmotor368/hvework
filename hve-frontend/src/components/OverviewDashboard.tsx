import React, { useState, useEffect } from "react";
import type { DocumentItem, ProjectHealthItem } from "../types";
import { MOCK_DASHBOARD_DATA } from "../mockData";
import { ENABLE_MOCK_DATA } from "../config";
import { fetchWithSession } from "../api/client";
import { BrandLoader } from "./BrandLoader";

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
  onOpenDocuments: (status: string) => void;
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
    (isCeo ? "Toàn công ty" : isDeptHead ? "Phòng ban" : "Dữ liệu của tôi");
  const pendingActionCount =
    dashboardData?.actionRequired?.pendingApprovalsCount || 0;
  const returnedActionCount =
    dashboardData?.actionRequired?.returnedDocumentsCount || 0;
  const recentDocuments: DocumentItem[] =
    dashboardData?.recentDocuments || documents;

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
    <div className="min-w-0 space-y-5 md:space-y-8">
      {/* Header with Role & Refresh Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Tổng quan điều hành
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Phạm vi dữ liệu:{" "}
            <strong className="text-gray-800">{scopeLabel}</strong>
            {userRoles.length > 1 && (
              <span className="ml-2 text-xs text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full font-semibold">
                Đã gộp {userRoles.length} vai trò
              </span>
            )}
            {draftCount > 0 && (
              <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold">
                {draftCount} bản nháp cá nhân
              </span>
            )}
          </p>
        </div>

        <div className="flex w-full items-center sm:w-auto">
          <button
            onClick={() => fetchDashboard(true)}
            disabled={isRefreshing}
            className="inline-flex w-full sm:w-auto items-center justify-center px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <span className={`mr-1.5 ${isRefreshing ? "animate-spin" : ""}`}>
              🔄
            </span>
            {isRefreshing ? "Đang làm mới..." : "Làm mới dữ liệu"}
          </button>
        </div>
      </div>

      {/* KHỐI 1: CẦN HÀNH ĐỘNG NGAY (ACTION REQUIRED) - ĐẶT TRÊN CÙNG */}
      <section className="bg-gradient-to-br from-rose-50/70 via-amber-50/40 to-white rounded-2xl md:rounded-3xl p-4 md:p-6 border-2 border-rose-200/70 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex min-w-0 items-start sm:items-center space-x-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight flex flex-wrap items-center gap-y-1">
              ⚠️ CẦN HÀNH ĐỘNG NGAY
              <span className="ml-2 text-xs bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full font-bold">
                Ưu tiên cao nhất
              </span>
            </h2>
          </div>
          <span className="hidden text-xs text-gray-500 sm:block">
            Tự động quét theo chu kỳ kiểm soát nội bộ
          </span>
        </div>

        {/* Action Items according to Role */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Action Box 1: Pending Documents for Approval */}
          <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                {pendingActionCount > 0
                  ? "Hồ sơ đang chờ bạn xử lý"
                  : "Hồ sơ của bạn cần bổ sung"}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                {pendingActionCount || returnedActionCount} hồ sơ
              </span>
            </div>

            <div className="mt-3 divide-y divide-slate-100 max-h-48 overflow-y-auto">
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
                      className="py-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer px-2 rounded transition-colors"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-[#0A66C2]">
                            {doc.code}
                          </span>
                          <span className="text-xs font-semibold text-gray-800 truncate max-w-[180px]">
                            {doc.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Người tạo: {doc.createdBy?.name || "Tôi"}
                        </p>
                      </div>
                      <button className="text-xs font-semibold text-[#0A66C2] hover:underline whitespace-nowrap ml-2">
                        Xử lý →
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Action Box 2: Overdue / Escalated Tasks or Expiring Contracts */}
          <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                {capabilities.canViewCompany
                  ? "Việc quá hạn leo thang CEO (≥3 ngày)"
                  : capabilities.canViewDepartment
                    ? "Việc quá hạn trong phòng ban"
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

            <div className="mt-3 divide-y divide-slate-100 max-h-48 overflow-y-auto">
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
                    className="py-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer px-2 rounded transition-colors"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-red-600">
                          {t.code}
                        </span>
                        <span className="text-xs font-semibold text-gray-800 truncate max-w-[180px]">
                          {t.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Phụ trách: {t.assignee?.name || "N/A"}{" "}
                        {t.assignee?.department
                          ? `(${t.assignee.department.name})`
                          : ""}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-red-600">
                      Đôn đốc →
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* KHỐI 2: CÁC THẺ THỐNG KÊ CHÍNH (METRICS SUMMARY) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <button
          type="button"
          onClick={() => onOpenDocuments("Chờ duyệt")}
          className="group bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between text-left transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
          aria-label="Xem hồ sơ chờ phê duyệt"
        >
          <div>
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Hồ sơ chờ phê duyệt
            </span>
            <p className="mt-2 text-3xl font-extrabold text-amber-900">
              {dashboardData?.metrics?.documents?.pending ?? pendingCount}
            </p>
            <p className="text-xs text-gray-400 mt-1">Cần hoàn tất đúng mốc</p>
            <span className="mt-2 block text-[11px] font-bold text-amber-700 opacity-80 group-hover:opacity-100">
              Xem chi tiết →
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-bold shadow-inner">
            ⏳
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenDocuments("Đã duyệt")}
          className="group bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
          aria-label="Xem hồ sơ đã thông qua"
        >
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Hồ sơ đã thông qua
            </span>
            <p className="mt-2 text-3xl font-extrabold text-emerald-900">
              {dashboardData?.metrics?.documents?.approved ?? approvedCount}
            </p>
            <p className="text-xs text-gray-400 mt-1">Đã phê duyệt hoàn tất</p>
            <span className="mt-2 block text-[11px] font-bold text-emerald-700 opacity-80 group-hover:opacity-100">
              Xem chi tiết →
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold shadow-inner">
            ✓
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenTasks({ status: "Đang làm" })}
          className="group bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Xem công việc đang thực hiện"
        >
          <div>
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
              Việc đang thực hiện
            </span>
            <p className="mt-2 text-3xl font-extrabold text-blue-900">
              {dashboardData?.metrics?.tasks?.inProgress ??
                dashboardData?.metrics?.departmentTasks?.inProgress ??
                0}
            </p>
            <p className="text-xs text-gray-400 mt-1">Đang chạy trong tuần</p>
            <span className="mt-2 block text-[11px] font-bold text-blue-700 opacity-80 group-hover:opacity-100">
              Xem chi tiết →
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl font-bold shadow-inner">
            ⚙️
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOpenTasks({ isOverdueOnly: true })}
          className="group bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between text-left transition hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-400"
          aria-label="Xem công việc quá hạn"
        >
          <div>
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">
              Việc quá hạn xử lý
            </span>
            <p className="mt-2 text-3xl font-extrabold text-rose-900">
              {dashboardData?.metrics?.tasks?.overdue ??
                dashboardData?.actionRequired?.overdueTasksCount ??
                0}
            </p>
            <p className="text-xs text-gray-400 mt-1">Cần tăng tốc can thiệp</p>
            <span className="mt-2 block text-[11px] font-bold text-rose-700 opacity-80 group-hover:opacity-100">
              Xem chi tiết →
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl font-bold shadow-inner">
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

      {/* KHỐI 3: TIẾN ĐỘ PHÒNG BAN (NẾU LÀ CEO) HOẶC CHI TIẾT TÀI CHÍNH */}
      {capabilities.canViewCompany && projectHealth.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Sức khỏe dự án</h2>
              <p className="text-xs text-slate-500">Tỷ lệ công việc quá hạn và hồ sơ chờ duyệt trên 5 ngày.</p>
            </div>
            <span className="text-[11px] text-slate-400">Bấm vào dự án để xem công việc</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {projectHealth.map((project) => {
              const style = project.level === 'rui_ro_cao'
                ? { icon: '🔴', label: 'Rủi ro cao', card: 'border-rose-200 bg-rose-50/60', text: 'text-rose-700' }
                : project.level === 'tre_tien_do'
                  ? { icon: '🟠', label: 'Trễ tiến độ', card: 'border-orange-200 bg-orange-50/60', text: 'text-orange-700' }
                  : project.level === 'can_chu_y'
                    ? { icon: '🟡', label: 'Cần chú ý', card: 'border-amber-200 bg-amber-50/60', text: 'text-amber-700' }
                    : { icon: '🟢', label: 'Bình thường', card: 'border-emerald-200 bg-emerald-50/60', text: 'text-emerald-700' };
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onOpenTasks({ projectId: project.id })}
                  className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${style.card}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-bold text-slate-600">{project.code}</span>
                    <span aria-hidden>{style.icon}</span>
                  </div>
                  <strong className="mt-3 block truncate text-sm text-slate-900">{project.name}</strong>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <span className={`text-xs font-bold ${style.text}`}>{style.label}</span>
                    <span className={`text-xl font-black ${style.text}`}>{project.percent}%</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{project.overdue}/{project.total} mục đang mở bị trễ</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {capabilities.canViewCompany && dashboardData?.departmentStats && (
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-base font-bold text-gray-900">
              Tỷ lệ hoàn thành công việc theo Phòng ban
            </h3>
            <span className="text-xs text-gray-400 font-medium">
              Cập nhật tự động
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboardData.departmentStats.map((dept: any) => (
              <div
                key={dept.id}
                className="p-4 rounded-xl border border-slate-100 bg-slate-50/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-800">
                    {dept.name}
                  </span>
                  <span
                    className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${
                      dept.totalTasks === 0
                        ? "text-gray-400 bg-gray-100"
                        : "text-[#0A66C2] bg-blue-50"
                    }`}
                  >
                    {dept.totalTasks === 0
                      ? "Chưa có việc"
                      : `${dept.completionRate}%`}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                  <div
                    className="bg-[#0A66C2] h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${dept.totalTasks === 0 ? 0 : dept.completionRate}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Hoàn thành: {dept.completedTasks}</span>
                  <span>Tổng số: {dept.totalTasks} việc</span>
                </div>
              </div>
            ))}
          </div>
        </div>
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
            recentDocuments.slice(0, 5).map((doc) => (
              <div
                key={doc.id}
                onClick={() => onSelectDoc(doc)}
                className="py-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50 cursor-pointer rounded-lg px-2 sm:px-3 transition-all"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-[#0A66C2]">
                      {doc.code}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">
                      {doc.title}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {doc.type === "payment_request" && doc.dataJson?.amount ? (
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
                          {doc.createdBy?.name}
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
