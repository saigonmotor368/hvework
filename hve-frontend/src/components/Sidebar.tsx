import React from "react";
import { ROLE_LABELS } from "../types.js";
import { PwaInstallPrompt } from "./PwaInstallPrompt.js";
import { UserNameButton } from "./UserNameButton.js";

type AppTab =
  | "overview"
  | "documents"
  | "create"
  | "tasks"
  | "project_reports"
  | "reports"
  | "admin_workflows"
  | "admin_users"
  | "admin_projects"
  | "admin_announcements";

interface SidebarProps {
  activeTab: AppTab;
  pendingCount: number;
  taskCount?: number;
  user: any;
  isMobileOpen?: boolean;
  onClose?: () => void;
  onSelectTab: (tab: AppTab) => void;
  onLogout: () => void;
  onOpenSetPin?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  pendingCount,
  taskCount = 0,
  user,
  isMobileOpen = false,
  onClose,
  onSelectTab,
  onLogout,
  onOpenSetPin,
}) => {
  const userRoleNames: string[] = user?.roles || [];
  const isAdmin =
    userRoleNames.includes("it_admin") || userRoleNames.includes("ceo");
  const isItAdmin = userRoleNames.includes("it_admin");
  const isCeo = userRoleNames.includes("ceo");

  const handleTabSelect = (tab: any) => {
    onSelectTab(tab);
    onClose?.(); // close mobile drawer on nav
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          w-[min(20rem,88vw)] lg:w-64 bg-white border-r border-slate-200 flex flex-col justify-between
          fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:z-auto
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="min-h-0 overflow-y-auto mobile-scroll">
          {/* Logo Header */}
          <div className="h-16 flex items-center px-4 sm:px-6 border-b border-slate-100 space-x-3">
            <img
              src="/favicon.svg"
              alt="HVE Logo"
              className="w-9 h-9 rounded-xl shadow-sm object-contain"
            />
            <div>
              <h1 className="text-sm font-black text-gray-900 tracking-tight leading-tight">
                Hệ Thống Quản Lý Công Việc
              </h1>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg text-gray-500 hover:bg-slate-100 lg:hidden"
              aria-label="Đóng menu"
            >
              ✕
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 sm:p-4 space-y-1.5">
            <button
              onClick={() => handleTabSelect("overview")}
              className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "overview"
                  ? "bg-blue-50 text-[#0A66C2] font-semibold"
                  : "text-gray-600 hover:bg-slate-50"
              }`}
            >
              <span className="mr-3">📊</span> Tổng quan điều hành
            </button>

            <button
              onClick={() => handleTabSelect("documents")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "documents"
                  ? "bg-blue-50 text-[#0A66C2] font-semibold"
                  : "text-gray-600 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center">
                <span className="mr-3">📑</span> Danh sách hồ sơ
              </div>
              {pendingCount > 0 && (
                <span className="bg-amber-100 text-amber-900 text-xs px-2 py-0.5 rounded-full font-bold">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabSelect("tasks")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "tasks"
                  ? "bg-blue-50 text-[#0A66C2] font-semibold"
                  : "text-gray-600 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center">
                <span className="mr-3">📋</span> Quản lý công việc
              </div>
              {taskCount > 0 && (
                <span className="bg-blue-100 text-blue-900 text-xs px-2 py-0.5 rounded-full font-bold">
                  {taskCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabSelect("project_reports")}
              className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "project_reports"
                  ? "bg-blue-50 text-[#0A66C2] font-semibold"
                  : "text-gray-600 hover:bg-slate-50"
              }`}
            >
              <span className="mr-3">📝</span> Báo cáo dự án
            </button>

            <button
              onClick={() => handleTabSelect("reports")}
              className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "reports"
                  ? "bg-blue-50 text-[#0A66C2] font-semibold"
                  : "text-gray-600 hover:bg-slate-50"
              }`}
            >
              <span className="mr-3">📈</span> Báo cáo & Thống kê
            </button>

            <button
              onClick={() => handleTabSelect("create")}
              className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "create"
                  ? "bg-blue-50 text-[#0A66C2] font-semibold"
                  : "text-gray-600 hover:bg-slate-50"
              }`}
            >
              <span className="mr-3">➕</span> Tạo hồ sơ mới
            </button>

            {/* IT Admin & Leadership section */}
            {isAdmin && (
              <div className="pt-4 mt-4 border-t border-slate-100 space-y-1.5">
                <div className="px-3.5 pb-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Quản trị hệ thống
                </div>

                <button
                  onClick={() => handleTabSelect("admin_projects")}
                  className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === "admin_projects"
                      ? "bg-blue-50 text-[#0A66C2] font-semibold"
                      : "text-gray-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="mr-3">🏗️</span> Quản lý dự án
                </button>

                <button
                  onClick={() => handleTabSelect("admin_workflows")}
                  className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === "admin_workflows"
                      ? "bg-blue-50 text-[#0A66C2] font-semibold"
                      : "text-gray-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="mr-3">⚙️</span> Cấu hình quy trình
                </button>

                <button
                  onClick={() => handleTabSelect("admin_users")}
                  className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === "admin_users"
                      ? "bg-blue-50 text-[#0A66C2] font-semibold"
                      : "text-gray-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="mr-3">👥</span> Quản lý người dùng
                </button>

                {isItAdmin && (
                  <button
                    onClick={() => handleTabSelect("admin_announcements")}
                    className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      activeTab === "admin_announcements"
                        ? "bg-blue-50 text-[#0A66C2] font-semibold"
                        : "text-gray-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="mr-3">📢</span> Quản lý thông báo
                  </button>
                )}
              </div>
            )}
          </nav>
          <div className="px-4 pb-2">
            <PwaInstallPrompt />
          </div>
        </div>

        {/* User Info & Demo Switcher */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-bold text-gray-900 truncate">
                <UserNameButton user={user} fallback="Người dùng" />
              </p>
              <p className="text-[11px] text-gray-500 truncate">
                {user?.email}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="text-xs text-red-600 hover:text-red-700 font-semibold p-1 hover:bg-red-50 rounded"
              title="Đăng xuất"
            >
              Đăng xuất
            </button>
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {user?.roles?.map((r: string) => (
              <span
                key={r}
                className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-[#0A66C2]"
              >
                {ROLE_LABELS[r] || r}
              </span>
            ))}
          </div>

          {isCeo && onOpenSetPin && (
            <button
              onClick={onOpenSetPin}
              className="w-full flex items-center px-2 py-1.5 mb-3 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-white border border-slate-200 transition-all"
              title="Thiết lập / đổi mã PIN xác nhận duyệt"
            >
              🔑 Mã PIN xác nhận duyệt
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
