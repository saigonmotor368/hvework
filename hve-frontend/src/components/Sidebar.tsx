import React from 'react';
import { ROLE_LABELS } from '../types.js';
import { PwaInstallPrompt } from './PwaInstallPrompt.js';

interface SidebarProps {
  activeTab: 'overview' | 'documents' | 'create' | 'tasks' | 'reports' | 'admin_workflows' | 'admin_users';
  pendingCount: number;
  taskCount?: number;
  user: any;
  onSelectTab: (tab: 'overview' | 'documents' | 'create' | 'tasks' | 'reports' | 'admin_workflows' | 'admin_users') => void;
  onLogout: () => void;
  onSwitchAccount: (email: string) => void;
  onOpenSetPin?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  pendingCount,
  taskCount = 0,
  user,
  onSelectTab,
  onLogout,
  onSwitchAccount,
  onOpenSetPin,
}) => {
  const userRoleNames: string[] = user?.roles || [];
  const isAdmin = userRoleNames.includes('it_admin') || userRoleNames.includes('ceo');
  const isCeo = userRoleNames.includes('ceo');

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between">
      <div>
        {/* Logo Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 space-x-3">
          <img
            src="/favicon.svg"
            alt="HVE Logo"
            className="w-9 h-9 rounded-xl shadow-sm object-contain"
          />
          <div>
            <h1 className="text-base font-black text-gray-900 tracking-tight">HVE Work</h1>
            <span className="text-[11px] text-gray-400 font-medium tracking-tight">Điều hành & Phê duyệt</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5">
          <button
            onClick={() => onSelectTab('overview')}
            className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-blue-50 text-[#0A66C2] font-semibold'
                : 'text-gray-600 hover:bg-slate-50'
            }`}
          >
            <span className="mr-3">📊</span> Tổng quan điều hành
          </button>

          <button
            onClick={() => onSelectTab('documents')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'documents'
                ? 'bg-blue-50 text-[#0A66C2] font-semibold'
                : 'text-gray-600 hover:bg-slate-50'
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
            onClick={() => onSelectTab('tasks')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'tasks'
                ? 'bg-blue-50 text-[#0A66C2] font-semibold'
                : 'text-gray-600 hover:bg-slate-50'
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
            onClick={() => onSelectTab('reports')}
            className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'reports'
                ? 'bg-blue-50 text-[#0A66C2] font-semibold'
                : 'text-gray-600 hover:bg-slate-50'
            }`}
          >
            <span className="mr-3">📈</span> Báo cáo & Thống kê
          </button>

          <button
            onClick={() => onSelectTab('create')}
            className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'create'
                ? 'bg-blue-50 text-[#0A66C2] font-semibold'
                : 'text-gray-600 hover:bg-slate-50'
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
                onClick={() => onSelectTab('admin_workflows')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'admin_workflows'
                    ? 'bg-blue-50 text-[#0A66C2] font-semibold'
                    : 'text-gray-600 hover:bg-slate-50'
                }`}
              >
                <span className="mr-3">⚙️</span> Cấu hình quy trình
              </button>

              <button
                onClick={() => onSelectTab('admin_users')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'admin_users'
                    ? 'bg-blue-50 text-[#0A66C2] font-semibold'
                    : 'text-gray-600 hover:bg-slate-50'
                }`}
              >
                <span className="mr-3">👥</span> Quản lý người dùng
              </button>
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
            <p className="text-xs font-bold text-gray-900 truncate">{user?.name}</p>
            <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
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
            <span key={r} className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-[#0A66C2]">
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

        {/* Demo fast-switch account */}
        <div className="pt-2 border-t border-slate-200/60">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1.5">
            Chuyển nhanh vai trò:
          </span>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <button
              onClick={() => onSwitchAccount('admin@huyvoeducation.vn')}
              className="p-1 rounded bg-white hover:bg-slate-100 text-gray-700 font-medium border border-slate-200 text-left truncate"
              title="Quản trị IT (Cấu hình luồng, Quản lý người dùng)"
            >
              🛠 Quản trị IT
            </button>
            <button
              onClick={() => onSwitchAccount('ceo@huyvoeducation.vn')}
              className="p-1 rounded bg-white hover:bg-slate-100 text-gray-700 font-medium border border-slate-200 text-left truncate"
              title="CEO (Phê duyệt cao nhất)"
            >
              👑 CEO
            </button>
            <button
              onClick={() => onSwitchAccount('tp_it@huyvoeducation.vn')}
              className="p-1 rounded bg-white hover:bg-slate-100 text-gray-700 font-medium border border-slate-200 text-left truncate"
              title="Trưởng phòng IT (Duyệt cấp bộ phận IT)"
            >
              👔 Trưởng BP IT
            </button>
            <button
              onClick={() => onSwitchAccount('ketoan@huyvoeducation.vn')}
              className="p-1 rounded bg-white hover:bg-slate-100 text-gray-700 font-medium border border-slate-200 text-left truncate"
              title="Kế toán (Duyệt thanh toán, hợp đồng)"
            >
              💼 Kế toán
            </button>
            <button
              onClick={() => onSwitchAccount('phapche@huyvoeducation.vn')}
              className="p-1 rounded bg-white hover:bg-slate-100 text-gray-700 font-medium border border-slate-200 text-left truncate"
              title="Pháp chế (Duyệt hợp đồng)"
            >
              ⚖️ Pháp chế
            </button>
            <button
              onClick={() => onSwitchAccount('nv1@huyvoeducation.vn')}
              className="p-1 rounded bg-white hover:bg-slate-100 text-gray-700 font-medium border border-slate-200 text-left truncate"
              title="Nhân viên 1 (Lập đề nghị)"
            >
              👤 Nhân viên
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
