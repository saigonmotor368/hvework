import React from 'react';
import { ROLE_LABELS } from '../types';

interface SidebarProps {
  activeTab: 'overview' | 'documents' | 'create';
  pendingCount: number;
  user: any;
  onSelectTab: (tab: 'overview' | 'documents' | 'create') => void;
  onLogout: () => void;
  onSwitchAccount: (email: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  pendingCount,
  user,
  onSelectTab,
  onLogout,
  onSwitchAccount,
}) => {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between">
      <div>
        {/* Logo Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 space-x-3">
          <div className="w-9 h-9 rounded-xl bg-[#0A66C2] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            HVE
          </div>
          <div>
            <h1 className="text-base font-bold text-[#1D1D1F]">HVE Work</h1>
            <span className="text-[11px] text-gray-400 font-medium tracking-tight">Quy trình điều hành</span>
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
              <span className="mr-3">📑</span> Đề nghị thanh toán
            </div>
            {pendingCount > 0 && (
              <span className="bg-amber-100 text-amber-900 text-xs px-2 py-0.5 rounded-full font-bold">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('create')}
            className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'create'
                ? 'bg-blue-50 text-[#0A66C2] font-semibold'
                : 'text-gray-600 hover:bg-slate-50'
            }`}
          >
            <span className="mr-3">➕</span> Tạo đề nghị mới
          </button>
        </nav>
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
            Thoát
          </button>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {user?.roles?.map((r: string) => (
            <span key={r} className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-[#0A66C2]">
              {ROLE_LABELS[r] || r}
            </span>
          ))}
        </div>

        {/* Quick Demo Role Switcher */}
        <div className="pt-2 border-t border-slate-200">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Chuyển vai trò test:
          </span>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => onSwitchAccount('nv1@hve.com')}
              className={`px-1.5 py-1 text-[10px] font-semibold rounded ${
                user?.email === 'nv1@hve.com' ? 'bg-[#0A66C2] text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
              }`}
            >
              Nhân viên
            </button>
            <button
              onClick={() => onSwitchAccount('ketoan@hve.com')}
              className={`px-1.5 py-1 text-[10px] font-semibold rounded ${
                user?.email === 'ketoan@hve.com' ? 'bg-[#0A66C2] text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
              }`}
            >
              Trưởng BP
            </button>
            <button
              onClick={() => onSwitchAccount('ceo@hve.com')}
              className={`px-1.5 py-1 text-[10px] font-semibold rounded ${
                user?.email === 'ceo@hve.com' ? 'bg-[#0A66C2] text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
              }`}
            >
              CEO
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
