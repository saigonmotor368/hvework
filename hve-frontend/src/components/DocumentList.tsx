import React from 'react';
import type { DocumentItem } from '../types';


interface DocumentListProps {
  filteredDocuments: DocumentItem[];
  tabFilter: 'all' | 'my' | 'to_review';
  setTabFilter: (tab: 'all' | 'my' | 'to_review') => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  onSelectDoc: (doc: DocumentItem) => void;
  onCreateNew: () => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  filteredDocuments,
  tabFilter,
  setTabFilter,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  getStatusBadge,
  onSelectDoc,
  onCreateNew,
}) => {
  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Tab selection */}
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setTabFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tabFilter === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setTabFilter('my')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tabFilter === 'my' ? 'bg-white shadow text-[#0A66C2]' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Hồ sơ của tôi
          </button>
          <button
            onClick={() => setTabFilter('to_review')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tabFilter === 'to_review' ? 'bg-white shadow text-amber-800' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Cần tôi duyệt
          </button>
        </div>

        {/* Filter Dropdowns & Search */}
        <div className="flex items-center space-x-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-medium bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Nháp">Bản nháp</option>
            <option value="Chờ duyệt">Chờ duyệt</option>
            <option value="Đã duyệt">Đã duyệt</option>
            <option value="Trả lại">Trả lại để sửa</option>
            <option value="Từ chối">Bị từ chối</option>
          </select>

          <input
            type="text"
            placeholder="Tìm mã, tiêu đề, người nhận..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs bg-slate-50 border border-gray-200 rounded-lg px-3.5 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
          />

          <button
            onClick={onCreateNew}
            className="px-3.5 py-2 rounded-lg bg-[#0A66C2] text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition-all"
          >
            + Tạo mới
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3.5">Mã hồ sơ</th>
              <th className="px-6 py-3.5">Tiêu đề đề nghị</th>
              <th className="px-6 py-3.5">Số tiền (VND)</th>
              <th className="px-6 py-3.5">Người đề nghị</th>
              <th className="px-6 py-3.5">Trạng thái</th>
              <th className="px-6 py-3.5">Hạn thanh toán</th>
              <th className="px-6 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredDocuments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">
                  Chưa có hồ sơ thanh toán phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              filteredDocuments.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => onSelectDoc(doc)}
                  className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 font-bold text-[#0A66C2] whitespace-nowrap">
                    {doc.code}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900 line-clamp-1">{doc.title}</p>
                    <p className="text-xs text-gray-400 line-clamp-1">Thụ hưởng: {doc.dataJson?.receiver}</p>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap">
                    {doc.dataJson?.amount?.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-800">{doc.createdBy?.name || 'Nhân viên'}</span>
                    <span className="block text-[11px] text-gray-400">{doc.createdBy?.department?.name || 'Phòng ban'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(doc.status)}</td>
                  <td className="px-6 py-4 text-xs text-gray-600 whitespace-nowrap">
                    {doc.dataJson?.deadline}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDoc(doc);
                      }}
                      className="text-xs font-bold text-[#0A66C2] hover:underline"
                    >
                      Xem chi tiết →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
