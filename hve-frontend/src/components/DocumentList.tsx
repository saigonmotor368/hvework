import React from 'react';
import type { DocumentItem } from '../types';

interface DocumentListProps {
  filteredDocuments: DocumentItem[];
  tabFilter: 'all' | 'my' | 'to_review';
  setTabFilter: (tab: 'all' | 'my' | 'to_review') => void;
  typeFilter: string;
  setTypeFilter: (type: string) => void;
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
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  getStatusBadge,
  onSelectDoc,
  onCreateNew,
}) => {
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'proposal':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
            💡 Đề xuất
          </span>
        );
      case 'contract':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            📜 Hợp đồng
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-[#0A66C2] border border-blue-200">
            💳 ĐNTT
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Scope Tabs */}
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
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs font-medium bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
          >
            <option value="all">Tất cả loại hồ sơ</option>
            <option value="payment_request">Đề nghị thanh toán</option>
            <option value="proposal">Đề xuất / Kiến nghị</option>
            <option value="contract">Hợp đồng kinh tế</option>
          </select>

          {/* Status Filter */}
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
            placeholder="Tìm mã, tiêu đề, đối tác..."
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
              <th className="px-6 py-3.5">Loại</th>
              <th className="px-6 py-3.5">Tiêu đề & Chi tiết</th>
              <th className="px-6 py-3.5">Giá trị / Thông tin</th>
              <th className="px-6 py-3.5">Người tạo</th>
              <th className="px-6 py-3.5">Trạng thái</th>
              <th className="px-6 py-3.5">Hạn / Thời hạn</th>
              <th className="px-6 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredDocuments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-400">
                  Chưa có hồ sơ phù hợp với bộ lọc hiện tại.
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getTypeBadge(doc.type)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <p className="font-semibold text-gray-900 line-clamp-1">{doc.title}</p>
                      {/* Contract expiration badge */}
                      {doc.type === 'contract' && doc.expiringStatus === 'expiring_soon' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap border border-amber-200">
                          ⚠️ Sắp hết hạn ({doc.daysRemaining}d)
                        </span>
                      )}
                      {doc.type === 'contract' && doc.expiringStatus === 'expired' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 whitespace-nowrap border border-red-200">
                          🛑 Quá hạn
                        </span>
                      )}
                    </div>
                    {doc.type === 'payment_request' && (
                      <p className="text-xs text-gray-400 line-clamp-1">Thụ hưởng: {doc.dataJson?.receiver}</p>
                    )}
                    {doc.type === 'contract' && (
                      <p className="text-xs text-gray-400 line-clamp-1">Đối tác: {doc.dataJson?.partner} — Phụ trách: {doc.dataJson?.manager}</p>
                    )}
                    {doc.type === 'proposal' && (
                      <p className="text-xs text-gray-400 line-clamp-1">{doc.dataJson?.content}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap">
                    {doc.type === 'payment_request' && doc.dataJson?.amount !== undefined && (
                      <span>{doc.dataJson.amount.toLocaleString('vi-VN')} đ</span>
                    )}
                    {doc.type === 'contract' && doc.dataJson?.value !== undefined && (
                      <span className="text-amber-700">{doc.dataJson.value.toLocaleString('vi-VN')} đ</span>
                    )}
                    {doc.type === 'proposal' && (
                      <span className="text-xs text-purple-700 font-medium">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-800">{doc.createdBy?.name || 'Nhân viên'}</span>
                    <span className="block text-[11px] text-gray-400">{doc.createdBy?.department?.name || 'Bộ phận'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(doc.status)}</td>
                  <td className="px-6 py-4 text-xs text-gray-600 whitespace-nowrap">
                    {doc.type === 'payment_request' && (doc.dataJson?.deadline || '—')}
                    {doc.type === 'contract' && (
                      <span>
                        {doc.dataJson?.startDate} → {doc.dataJson?.endDate}
                      </span>
                    )}
                    {doc.type === 'proposal' && (
                      <span>{new Date(doc.createdAt).toLocaleDateString('vi-VN')}</span>
                    )}
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
