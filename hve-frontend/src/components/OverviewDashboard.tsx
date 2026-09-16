import React from 'react';
import type { DocumentItem } from '../types';


interface OverviewDashboardProps {
  pendingCount: number;
  approvedCount: number;
  draftCount: number;
  documents: DocumentItem[];
  getStatusBadge: (status: string) => React.ReactNode;
  onSelectDoc: (doc: DocumentItem) => void;
  onViewAll: () => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  pendingCount,
  approvedCount,
  draftCount,
  documents,
  getStatusBadge,
  onSelectDoc,
  onViewAll,
}) => {
  return (
    <div className="space-y-8">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Hồ sơ chờ phê duyệt</span>
            <p className="mt-2 text-3xl font-extrabold text-amber-900">{pendingCount}</p>
            <p className="text-xs text-gray-400 mt-1">Cần xử lý kịp tiến độ</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-bold">
            ⏳
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Đã duyệt hoàn tất</span>
            <p className="mt-2 text-3xl font-extrabold text-emerald-900">{approvedCount}</p>
            <p className="text-xs text-gray-400 mt-1">Đã thông qua CEO</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold">
            ✓
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Bản nháp đang soạn</span>
            <p className="mt-2 text-3xl font-extrabold text-blue-900">{draftCount}</p>
            <p className="text-xs text-gray-400 mt-1">Chưa gửi duyệt</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl font-bold">
            📝
          </div>
        </div>
      </div>

      {/* Recent Items */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Hồ sơ thanh toán gần đây</h3>
          <button
            onClick={onViewAll}
            className="text-xs font-semibold text-[#0A66C2] hover:underline"
          >
            Xem tất cả ({documents.length}) →
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {documents.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Chưa có hồ sơ nào.</p>
          ) : (
            documents.slice(0, 4).map((doc) => (
              <div
                key={doc.id}
                onClick={() => onSelectDoc(doc)}
                className="py-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer rounded-lg px-3 transition-all"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-[#0A66C2]">{doc.code}</span>
                    <span className="text-sm font-semibold text-gray-800">{doc.title}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Số tiền: <strong className="text-gray-700">{doc.dataJson?.amount?.toLocaleString('vi-VN')} VND</strong> — Người nhận: {doc.dataJson?.receiver}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
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
