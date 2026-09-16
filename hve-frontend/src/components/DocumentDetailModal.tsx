import React from 'react';
import { type DocumentItem, type ApprovalStep, ROLE_LABELS } from '../types';


interface DocumentDetailModalProps {
  selectedDoc: DocumentItem;
  user: any;
  isProcessing: boolean;
  apiBaseUrl: string;
  getStatusBadge: (status: string) => React.ReactNode;
  onBack: () => void;
  onSubmitDraft: (doc: DocumentItem) => void;
  onCreateNewVersion: (doc: DocumentItem) => void;
  onApproveStep: (doc: DocumentItem, step: ApprovalStep) => void;
  onOpenModalAction: (type: 'return' | 'reject', stepId: number, docId: number) => void;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  selectedDoc,
  user,
  isProcessing,
  apiBaseUrl,
  getStatusBadge,
  onBack,
  onSubmitDraft,
  onCreateNewVersion,
  onApproveStep,
  onOpenModalAction,
}) => {
  return (
    <div className="space-y-6">
      {/* Back button & versioning */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center"
        >
          ← Quay lại danh sách hồ sơ
        </button>
        <span className="text-xs text-gray-400">Phiên bản hồ sơ: v{selectedDoc.version}</span>
      </div>

      {/* Header Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h3 className="text-xl font-extrabold text-gray-900">{selectedDoc.title}</h3>
              {getStatusBadge(selectedDoc.status)}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Mã hồ sơ: <strong className="text-gray-700">{selectedDoc.code}</strong> — Tạo lúc:{' '}
              {new Date(selectedDoc.createdAt).toLocaleString('vi-VN')} bởi {selectedDoc.createdBy?.name} ({selectedDoc.createdBy?.department?.name || 'IT'})
            </p>
          </div>

          {/* Header Actions */}
          <div className="flex items-center space-x-2">
            {selectedDoc.status === 'Nháp' && selectedDoc.createdById === user?.id && (
              <button
                onClick={() => onSubmitDraft(selectedDoc)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-[#0A66C2] text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
              >
                {isProcessing ? 'Đang gửi...' : '🚀 Gửi duyệt hồ sơ'}
              </button>
            )}

            {selectedDoc.status === 'Đã duyệt' && selectedDoc.createdById === user?.id && (
              <button
                onClick={() => onCreateNewVersion(selectedDoc)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 shadow-sm transition-all disabled:opacity-50"
              >
                {isProcessing ? 'Đang xử lý...' : '📄 Tạo bản sửa đổi (v' + (selectedDoc.version + 1) + ')'}
              </button>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 text-sm">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Số tiền đề nghị</span>
            <p className="text-2xl font-black text-[#0A66C2] mt-1">
              {selectedDoc.dataJson?.amount?.toLocaleString('vi-VN')} VND
            </p>
          </div>

          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Đơn vị thụ hưởng</span>
            <p className="font-bold text-gray-800 mt-1">{selectedDoc.dataJson?.receiver}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {selectedDoc.dataJson?.bankName} - STK: <strong className="text-gray-700">{selectedDoc.dataJson?.bankAccount}</strong>
            </p>
          </div>

          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Hạn thanh toán</span>
            <p className="font-bold text-gray-800 mt-1">{selectedDoc.dataJson?.deadline}</p>
          </div>

          <div className="md:col-span-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Nội dung chi tiết</span>
            <p className="text-gray-700 mt-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
              {selectedDoc.dataJson?.content}
            </p>
          </div>
        </div>

        {/* Attachments Section */}
        {selectedDoc.attachments && selectedDoc.attachments.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3">
              Chứng từ & Hóa đơn đính kèm ({selectedDoc.attachments.length})
            </span>
            <div className="flex flex-wrap gap-3">
              {selectedDoc.attachments.map((att) => (
                <a
                  key={att.id}
                  href={`${apiBaseUrl}${att.fileUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0A66C2] transition-colors"
                >
                  <span>📎</span>
                  <span>{att.fileName}</span>
                  <span className="text-gray-400 text-[10px]">({Math.round(att.size / 1024)} KB)</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4-Step Approval Timeline */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h4 className="text-base font-bold text-gray-900 mb-6">
          Tiến trình phê duyệt 4 cấp (Workflow Timeline)
        </h4>

        {selectedDoc.steps && selectedDoc.steps.length > 0 ? (
          <div className="relative">
            <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-200 -z-0" />

            <div className="space-y-6">
              {/* Step 0: Creator */}
              <div className="flex items-start space-x-4 relative z-10">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-white">
                  ✓
                </div>
                <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase">Cấp 0: Người tạo</span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Đã khởi tạo & gửi duyệt</span>
                  </div>
                  <p className="text-sm font-bold text-gray-800 mt-1">{selectedDoc.createdBy?.name || 'Nhân viên'}</p>
                  <p className="text-xs text-gray-400">{new Date(selectedDoc.createdAt).toLocaleString('vi-VN')}</p>
                </div>
              </div>

              {/* Approval Steps */}
              {selectedDoc.steps.map((step) => {
                const isPending = step.status === 'pending';
                const isApproved = step.status === 'approved';
                const isReturned = step.status === 'returned';
                const isRejected = step.status === 'rejected';

                const isCreator = selectedDoc.createdById === user?.id;
                const hasRole = user?.roles?.includes(step.roleRequired);
                const canAct = isPending && hasRole && !isCreator;

                return (
                  <div key={step.id} className="flex items-start space-x-4 relative z-10">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-white ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-700'
                          : isPending
                          ? 'bg-amber-100 text-amber-800 animate-pulse'
                          : isReturned
                          ? 'bg-orange-100 text-orange-800'
                          : isRejected
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isApproved ? '✓' : isPending ? '⏳' : isReturned ? '↩' : isRejected ? '✗' : step.stepOrder}
                    </div>

                    <div className="flex-1 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase">
                          Cấp {step.stepOrder}: {ROLE_LABELS[step.roleRequired] || step.roleRequired}
                        </span>
                        {isApproved && (
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            Đã phê duyệt
                          </span>
                        )}
                        {isPending && (
                          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded animate-pulse">
                            Đang chờ duyệt
                          </span>
                        )}
                        {isReturned && (
                          <span className="text-xs font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded">
                            Đã trả lại để sửa
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                            Đã từ chối
                          </span>
                        )}
                        {step.status === 'not_started' && (
                          <span className="text-xs font-medium text-gray-400">Chưa đến lượt</span>
                        )}
                      </div>

                      {step.comment && (
                        <p className="text-xs text-gray-700 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          Ý kiến: <em className="font-medium">"{step.comment}"</em>
                        </p>
                      )}
                      {step.actedAt && (
                        <p className="text-[11px] text-gray-400 mt-1.5">
                          Xử lý lúc: {new Date(step.actedAt).toLocaleString('vi-VN')}
                        </p>
                      )}

                      {/* Step Action Bar */}
                      {isPending && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          {isCreator ? (
                            <div className="text-xs font-semibold text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-center">
                              <span className="mr-2">⚠️</span>
                              Quy định Anti Self-Approval: Bạn là người tạo hồ sơ này nên không thể tự phê duyệt.
                            </div>
                          ) : canAct ? (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => onApproveStep(selectedDoc, step)}
                                disabled={isProcessing}
                                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
                              >
                                {isProcessing ? 'Đang duyệt...' : '✓ Phê duyệt'}
                              </button>
                              <button
                                onClick={() => onOpenModalAction('return', step.id, selectedDoc.id)}
                                disabled={isProcessing}
                                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 shadow-sm transition-all disabled:opacity-50"
                              >
                                Trả lại để sửa
                              </button>
                              <button
                                onClick={() => onOpenModalAction('reject', step.id, selectedDoc.id)}
                                disabled={isProcessing}
                                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 shadow-sm transition-all disabled:opacity-50"
                              >
                                Từ chối hồ sơ
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">
                              Đang chờ duyệt bởi người có vai trò{' '}
                              <strong className="text-gray-600">{ROLE_LABELS[step.roleRequired] || step.roleRequired}</strong>.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-gray-400">
            Hồ sơ đang ở trạng thái Nháp — chưa tạo các bước phê duyệt.
          </div>
        )}
      </div>
    </div>
  );
};
