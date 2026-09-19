import React, { useState, useEffect } from "react";
import { MOCK_REPORTS_SUMMARY } from "../mockData";
import { ENABLE_MOCK_DATA } from "../config";
import { BrandLoader } from "./BrandLoader";
import type { ProjectItem } from "../types";
import { UserNameButton } from "./UserNameButton";

interface ReportsViewProps {
  apiBaseUrl: string;
  currentUser: any;
  showToast: (msg: string, type?: "success" | "error") => void;
  onSelectDoc?: (docId: number) => void;
  onSelectTask?: (taskId: number) => void;
  projects: ProjectItem[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  apiBaseUrl,
  currentUser,
  showToast,
  onSelectDoc,
  onSelectTask,
  projects,
}) => {
  const [activeTab, setActiveTab] = useState<
    "documents" | "tasks" | "financial" | "audit_logs"
  >("documents");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Report filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [status, setStatus] = useState<string>("all");
  const [docType, setDocType] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");

  // Dropdown lists
  const [users, setUsers] = useState<any[]>([
    {
      id: 1,
      name: "Nguyễn Văn An",
      email: "nv1@huyvoeducation.vn",
    },
    {
      id: 2,
      name: "Trần Minh Tuấn",
      email: "tp_it@huyvoeducation.vn",
    },
    {
      id: 3,
      name: "Trần Thị Mai",
      email: "ketoan@huyvoeducation.vn",
    },
    {
      id: 4,
      name: "Hoàng Kim Ngân",
      email: "phapche@huyvoeducation.vn",
    },
    {
      id: 5,
      name: "Võ Huy Định",
      email: "ceo@huyvoeducation.vn",
    },
  ]);

  const userRoles: string[] = currentUser?.roles || [];
  const isCeoOrAdmin =
    userRoles.includes("ceo") ||
    userRoles.includes("bgd") ||
    userRoles.includes("it_admin");
  const isCompanyWide = userRoles.some((r) =>
    ["ceo", "bgd", "it_admin", "accountant", "legal"].includes(r),
  );
  const isDeptHead = userRoles.includes("department_head");
  const isEmployee = !isCompanyWide && !isDeptHead;

  // If regular employee somehow has activeTab set to financial or audit_logs, fallback to documents
  useEffect(() => {
    if (
      isEmployee &&
      (activeTab === "financial" || activeTab === "audit_logs")
    ) {
      setActiveTab("documents");
    }
  }, [isEmployee, activeTab]);

  // Load users for filtering. The backend already returns only users in scope.
  useEffect(() => {
    const fetchFilterOptions = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;
      try {
        const userRes = await fetch(`${apiBaseUrl}/tasks/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (userRes.ok) setUsers(await userRes.json());
      } catch {
        // ignore
      }
    };
    fetchFilterOptions();
  }, [apiBaseUrl]);

  // Filter available users according to user's scope
  const availableUsers = React.useMemo(() => {
    if (isEmployee) {
      return users.filter((u: any) => u.id === currentUser?.id);
    }
    if (projectId) {
      return users.filter(
        (user: any) =>
          user.ledProjects?.some(
            (project: any) => String(project.id) === projectId,
          ) ||
          user.projectMemberships?.some(
            (membership: any) =>
              String(membership.project?.id) === projectId,
          ),
      );
    }
    return users;
  }, [isEmployee, users, currentUser?.id, projectId]);

  // Fetch report summary
  const fetchSummary = async () => {
    setIsLoading(true);
    const token = localStorage.getItem("access_token");
    if (!token) {
      setSummaryData(ENABLE_MOCK_DATA ? MOCK_REPORTS_SUMMARY : null);
      if (!ENABLE_MOCK_DATA) showToast("Phiên đăng nhập đã hết hạn", "error");
      setIsLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (userId) params.append("userId", userId);
      if (status && status !== "all") params.append("status", status);
      if (docType) params.append("type", docType);
      if (projectId) params.append("projectId", projectId);

      const res = await fetch(
        `${apiBaseUrl}/reports/summary?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Không thể tải dữ liệu báo cáo");
      const data = await res.json();
      setSummaryData(data);
    } catch (error: any) {
      setSummaryData(ENABLE_MOCK_DATA ? MOCK_REPORTS_SUMMARY : null);
      if (!ENABLE_MOCK_DATA)
        showToast(error.message || "Không thể tải dữ liệu báo cáo", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch audit logs (only if tab is audit_logs and user is CEO/Admin)
  const fetchAuditLogs = async () => {
    if (!isCeoOrAdmin) return;
    setIsLoading(true);
    const token = localStorage.getItem("access_token");
    if (!token) {
      setAuditLogs(ENABLE_MOCK_DATA ? MOCK_REPORTS_SUMMARY.auditLogs : []);
      if (!ENABLE_MOCK_DATA) showToast("Phiên đăng nhập đã hết hạn", "error");
      setIsLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(
        `${apiBaseUrl}/reports/audit-logs?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Không thể tải nhật ký hệ thống");
      const data = await res.json();
      setAuditLogs(data);
    } catch (error: any) {
      setAuditLogs(ENABLE_MOCK_DATA ? MOCK_REPORTS_SUMMARY.auditLogs : []);
      if (!ENABLE_MOCK_DATA)
        showToast(error.message || "Không thể tải nhật ký hệ thống", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "audit_logs") {
      fetchAuditLogs();
    } else {
      fetchSummary();
    }
  }, [
    activeTab,
    startDate,
    endDate,
    userId,
    status,
    docType,
    projectId,
  ]);

  // Export CSV Handler
  const handleExportCsv = () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const exportType = activeTab === "financial" ? "contracts" : activeTab;
    const params = new URLSearchParams();
    params.append("type", exportType);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (projectId) params.append("projectId", projectId);
    if (userId) params.append("userId", userId);
    if (status && status !== "all") params.append("status", status);
    if (docType) params.append("type", docType);

    const exportUrl = `${apiBaseUrl}/reports/export-xlsx?${params.toString()}`;
    // Trigger download with auth
    fetch(exportUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Không có quyền hoặc lỗi xuất file");
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `HVE_BaoCao_${exportType}_${new Date().toISOString().split("T")[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("Đã tải xuống file báo cáo Excel thành công!");
      })
      .catch((err) => {
        showToast(err.message || "Lỗi xuất file", "error");
      });
  };

  const handlePrint = () => {
    window.print();
  };

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setProjectId("");
    setUserId("");
    setStatus("all");
    setDocType("");
  };

  return (
    <div className="min-w-0 space-y-4 md:space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="w-full text-xl sm:w-auto sm:text-2xl font-black text-gray-900 tracking-tight">
              📈 Báo Cáo & Thống Kê Điều Hành
            </h1>
            {isEmployee && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                🔒 Phạm vi: Cá nhân
              </span>
            )}
            {isDeptHead && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                🏗️ Phạm vi: Các dự án phụ trách
              </span>
            )}
            {isCompanyWide && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                🌐 Phạm vi: Toàn công ty
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {isEmployee
              ? "Theo dõi dữ liệu các hồ sơ trình duyệt và nhiệm vụ công việc do bạn phụ trách hoặc tạo"
              : isDeptHead
                ? "Theo dõi và thống kê các dự án bạn đang phụ trách"
                : "Tổng hợp đa chiều về hồ sơ, tiến độ công việc, tài chính và nhật ký kiểm soát nội bộ"}
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:space-x-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center px-2 sm:px-3.5 py-2 text-[11px] sm:text-xs font-semibold text-gray-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            🖨️ In / Xuất PDF
          </button>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center px-2 sm:px-3.5 py-2 text-[11px] sm:text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm"
          >
            📥 Xuất Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* 4 Tabs Selector */}
      <div className="mobile-scroll flex overflow-x-auto border-b border-slate-200 space-x-1 sm:space-x-2">
        <button
          onClick={() => setActiveTab("documents")}
          className={`shrink-0 pb-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === "documents"
              ? "border-[#0A66C2] text-[#0A66C2]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📑 Tổng hợp hồ sơ
        </button>

        <button
          onClick={() => setActiveTab("tasks")}
          className={`shrink-0 pb-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === "tasks"
              ? "border-[#0A66C2] text-[#0A66C2]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          📋 Tiến độ công việc
        </button>

        {!isEmployee && (
          <button
            onClick={() => setActiveTab("financial")}
            className={`shrink-0 pb-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === "financial"
                ? "border-[#0A66C2] text-[#0A66C2]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            💰 Tài chính & Hợp đồng
          </button>
        )}

        {/* Tab 4: Audit Logs - Giới hạn chỉ CEO & IT Admin xem */}
        {isCeoOrAdmin && (
          <button
            onClick={() => setActiveTab("audit_logs")}
            className={`shrink-0 pb-3 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === "audit_logs"
                ? "border-[#0A66C2] text-[#0A66C2]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            🛡️ Nhật ký hệ thống (CEO / Quản trị IT)
          </button>
        )}
      </div>

      {/* Bộ lọc đa chiều */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            🔍 Bộ lọc báo cáo
          </span>
          <button
            onClick={resetFilters}
            className="text-xs text-[#0A66C2] hover:underline font-semibold"
          >
            Đặt lại bộ lọc
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* Filter 1: Từ ngày */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">
              Từ ngày
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0A66C2]"
            />
          </div>

          {/* Filter 2: Đến ngày */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">
              Đến ngày
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0A66C2]"
            />
          </div>

          {/* Filter 3: Dự án */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">
              Dự án
            </label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setUserId("");
              }}
              className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
            >
              <option value="">Tất cả dự án</option>
              {projects
                .filter((project) => project.isActive)
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} — {project.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Filter 4: Người dùng */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">
              Người dùng
            </label>
            {isEmployee ? (
              <input
                type="text"
                disabled
                value={`${currentUser?.name || currentUser?.email || "Bạn"} (Chính bạn)`}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed font-medium"
              />
            ) : (
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0A66C2] bg-white"
              >
                <option value="">
                  {projectId ? "Tất cả nhân sự dự án" : "Tất cả nhân sự"}
                </option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Filter 5: Trạng thái hoặc Loại hồ sơ */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">
              {activeTab === "documents" ? "Loại hồ sơ" : "Trạng thái"}
            </label>
            {activeTab === "documents" ? (
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0A66C2] bg-white"
              >
                <option value="">Tất cả loại hồ sơ</option>
                <option value="payment_request">Đề nghị thanh toán</option>
                <option value="proposal">Đề xuất / Tờ trình</option>
                {!isEmployee && <option value="contract">Hợp đồng</option>}
              </select>
            ) : (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#0A66C2] bg-white"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="Hoàn thành">Hoàn thành / Đã duyệt</option>
                <option value="Đang làm">Đang làm / Chờ duyệt</option>
                <option value="Chưa làm">Chưa làm / Nháp</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Main Report Content according to Tab */}
      {isLoading ? (
        <BrandLoader label="Đang tổng hợp dữ liệu báo cáo..." />
      ) : (
        <div>
          {/* TAB 1: DOCUMENTS */}
          {activeTab === "documents" && summaryData?.documents && (
            <div className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">
                    Tổng số hồ sơ
                  </span>
                  <p className="text-2xl font-black text-gray-900 mt-1">
                    {summaryData.documents.total}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase">
                    Tỷ lệ phê duyệt
                  </span>
                  <p className="text-2xl font-black text-emerald-700 mt-1">
                    {summaryData.documents.approvalRate}%
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <span className="text-[11px] font-bold text-amber-600 uppercase">
                    Chờ duyệt
                  </span>
                  <p className="text-2xl font-black text-amber-700 mt-1">
                    {summaryData.documents.pending}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <span className="text-[11px] font-bold text-[#0A66C2] uppercase">
                    Duyệt TB (giờ)
                  </span>
                  <p className="text-2xl font-black text-[#0A66C2] mt-1">
                    {summaryData.documents.avgApprovalTimeHours}
                  </p>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-sm">
                    Danh sách hồ sơ chi tiết (Nhấn để xem)
                  </h3>
                  <span className="text-xs text-gray-400">
                    Hiển thị tối đa 100 bản ghi
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-gray-600 font-bold border-b border-slate-100 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3">Mã hồ sơ</th>
                        <th className="px-6 py-3">Tiêu đề</th>
                        <th className="px-6 py-3">Phân loại</th>
                        <th className="px-6 py-3">Người tạo</th>
                        <th className="px-6 py-3">Dự án</th>
                        <th className="px-6 py-3">Ngày tạo</th>
                        <th className="px-6 py-3 text-right">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summaryData.documents.items.map((d: any) => (
                        <tr
                          key={d.id}
                          onClick={() => onSelectDoc && onSelectDoc(d.id)}
                          className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-3 font-bold text-[#0A66C2]">
                            {d.code}
                          </td>
                          <td className="px-6 py-3 font-semibold text-gray-800">
                            {d.title}
                          </td>
                          <td className="px-6 py-3 text-gray-500">
                            {d.type === "payment_request"
                              ? "Thanh toán"
                              : d.type === "contract"
                                ? "Hợp đồng"
                                : "Đề xuất"}
                          </td>
                          <td className="px-6 py-3 text-gray-700">
                            {typeof d.creator === "object"
                              ? d.creator?.name
                              : d.creator || "—"}
                          </td>
                          <td className="px-6 py-3 text-gray-500">
                            {d.project || "Huy Võ Education"}
                          </td>
                          <td className="px-6 py-3 text-gray-400">
                            {new Date(d.createdAt).toLocaleDateString("vi-VN")}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="font-bold">{d.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TASKS */}
          {activeTab === "tasks" && summaryData?.tasks && (
            <div className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-gray-500 uppercase">
                    Tổng số công việc
                  </span>
                  <p className="text-2xl font-black text-gray-900 mt-1">
                    {summaryData.tasks.total}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-emerald-600 uppercase">
                    Tỷ lệ hoàn thành
                  </span>
                  <p className="text-2xl font-black text-emerald-700 mt-1">
                    {summaryData.tasks.completionRate}%
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-blue-600 uppercase">
                    Đang thực hiện
                  </span>
                  <p className="text-2xl font-black text-blue-700 mt-1">
                    {summaryData.tasks.inProgress}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-rose-600 uppercase">
                    Công việc quá hạn
                  </span>
                  <p className="text-2xl font-black text-rose-700 mt-1">
                    {summaryData.tasks.overdue}
                  </p>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-sm">
                    Danh sách công việc (Nhấn để đôn đốc / xem)
                  </h3>
                  <span className="text-xs text-gray-400">
                    Hiển thị tối đa 100 bản ghi
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-gray-600 font-bold border-b border-slate-100 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3">Mã CV</th>
                        <th className="px-6 py-3">Tiêu đề</th>
                        <th className="px-6 py-3">Người phụ trách</th>
                        <th className="px-6 py-3">Dự án</th>
                        <th className="px-6 py-3">Hạn hoàn thành</th>
                        <th className="px-6 py-3">Tiến độ</th>
                        <th className="px-6 py-3 text-right">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summaryData.tasks.items.map((t: any) => (
                        <tr
                          key={t.id}
                          onClick={() => onSelectTask && onSelectTask(t.id)}
                          className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-3 font-bold text-[#0A66C2]">
                            {t.code}
                          </td>
                          <td className="px-6 py-3 font-semibold text-gray-800">
                            {t.title}
                          </td>
                          <td className="px-6 py-3 text-gray-700">
                            {typeof t.assignee === "object" ? (
                              <UserNameButton user={t.assignee} fallback="—" />
                            ) : (
                              t.assignee || "—"
                            )}
                          </td>
                          <td className="px-6 py-3 text-gray-500">
                            {t.project || "Huy Võ Education"}
                          </td>
                          <td className="px-6 py-3">
                            <span
                              className={
                                t.isOverdue
                                  ? "text-red-600 font-bold"
                                  : "text-gray-500"
                              }
                            >
                              {t.dueDate
                                ? new Date(t.dueDate).toLocaleDateString(
                                    "vi-VN",
                                  )
                                : "—"}
                            </span>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-[#0A66C2] h-1.5 rounded-full"
                                  style={{ width: `${t.progressPercent}%` }}
                                />
                              </div>
                              <span className="font-semibold text-[11px]">
                                {t.progressPercent}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right font-bold">
                            {t.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FINANCIAL & CONTRACTS */}
          {activeTab === "financial" && summaryData?.contracts && (
            <div className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <span className="text-[11px] font-bold text-gray-500 uppercase">
                    Tổng số hợp đồng
                  </span>
                  <p className="text-2xl font-black text-gray-900 mt-1">
                    {summaryData.contracts.total}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <span className="text-[11px] font-bold text-[#0A66C2] uppercase">
                    Giá trị hợp đồng
                  </span>
                  <p className="text-lg font-black text-[#0A66C2] mt-1">
                    {summaryData.contracts.totalValue
                      ? Number(summaryData.contracts.totalValue).toLocaleString(
                          "vi-VN",
                        )
                      : 0}{" "}
                    đ
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase">
                    Tổng đã giải ngân
                  </span>
                  <p className="text-lg font-black text-amber-700 mt-1">
                    {(
                      summaryData.payments?.totalDisbursedValue || 0
                    ).toLocaleString("vi-VN")}{" "}
                    đ
                  </p>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    {summaryData.payments?.disbursedCount || 0} đề nghị đã hoàn
                    tất duyệt
                  </span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200">
                  <span className="text-[11px] font-bold text-rose-600 uppercase">
                    HĐ sắp hết hạn (≤30 ngày)
                  </span>
                  <p className="text-2xl font-black text-rose-700 mt-1">
                    {summaryData.contracts.expiringSoonCount}
                  </p>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-sm">
                    Danh mục hợp đồng kinh tế / đào tạo
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-gray-600 font-bold border-b border-slate-100 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3">Mã HĐ</th>
                        <th className="px-6 py-3">Tên hợp đồng</th>
                        <th className="px-6 py-3">Đối tác</th>
                        <th className="px-6 py-3">Giá trị (VNĐ)</th>
                        <th className="px-6 py-3">Thời hạn</th>
                        <th className="px-6 py-3">Người quản lý</th>
                        <th className="px-6 py-3 text-right">Cảnh báo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summaryData.contracts.items.map((c: any) => (
                        <tr
                          key={c.id}
                          onClick={() => onSelectDoc && onSelectDoc(c.id)}
                          className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-3 font-bold text-[#0A66C2]">
                            {c.code}
                          </td>
                          <td className="px-6 py-3 font-semibold text-gray-800">
                            {c.title}
                          </td>
                          <td className="px-6 py-3 text-gray-700">
                            {c.partner}
                          </td>
                          <td className="px-6 py-3 font-bold text-gray-900">
                            {c.value ? c.value.toLocaleString("vi-VN") : 0}
                          </td>
                          <td className="px-6 py-3 text-gray-500">
                            {c.startDate} → {c.endDate}
                          </td>
                          <td className="px-6 py-3 text-gray-600">
                            {c.manager}
                          </td>
                          <td className="px-6 py-3 text-right">
                            {c.isExpiringSoon ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                                Sắp hết hạn
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Hiệu lực
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT LOGS (CHỈ CEO & IT ADMIN) */}
          {activeTab === "audit_logs" && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start space-x-2">
                <span className="text-base">🛡️</span>
                <div>
                  <strong>Phân quyền nghiêm ngặt:</strong> Nhật ký kiểm soát nội
                  bộ chỉ mở cho Chủ tịch / CEO và Quản trị IT để tra cứu dấu vết
                  thay đổi và bảo toàn tính toàn vẹn dữ liệu.
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-sm">
                    Nhật ký truy vết thao tác hệ thống
                  </h3>
                  <span className="text-xs text-gray-400">
                    Tối đa 200 thao tác gần nhất
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-gray-600 font-bold border-b border-slate-100 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3">Thời gian</th>
                        <th className="px-6 py-3">Người thao tác</th>
                        <th className="px-6 py-3">Đối tượng</th>
                        <th className="px-6 py-3">Hành động</th>
                        <th className="px-6 py-3">Địa chỉ IP</th>
                        <th className="px-6 py-3">Chi tiết thay đổi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-6 py-3 text-gray-400 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString("vi-VN")}
                          </td>
                          <td className="px-6 py-3 font-bold text-gray-800">
                            <UserNameButton
                              user={log.actor}
                              fallback="Hệ thống"
                            />
                          </td>
                          <td className="px-6 py-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-medium">
                              {log.entityType} #{log.entityId}
                            </span>
                          </td>
                          <td className="px-6 py-3 font-semibold text-[#0A66C2]">
                            {log.action}
                          </td>
                          <td className="px-6 py-3 text-gray-400 font-mono text-[11px]">
                            {log.ip || "—"}
                          </td>
                          <td className="px-6 py-3 text-gray-500 font-mono text-[10px] max-w-[250px] truncate">
                            {log.afterJson
                              ? JSON.stringify(log.afterJson)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
