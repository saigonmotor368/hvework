import React from 'react';

interface ActionReasonModalProps {
  modalAction: {
    isOpen: boolean;
    type: 'return' | 'reject';
    stepId: number;
    docId: number;
    comment: string;
  };
  isProcessing: boolean;
  onClose: () => void;
  onChangeComment: (comment: string) => void;
  onConfirm: () => void;
}

export const ActionReasonModal: React.FC<ActionReasonModalProps> = ({
  modalAction,
  isProcessing,
  onClose,
  onChangeComment,
  onConfirm,
}) => {
  if (!modalAction.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in">
        <h4 className="text-base font-bold text-gray-900 mb-1">
          {modalAction.type === 'return' ? 'Lý do trả lại hồ sơ để sửa' : 'Lý do từ chối hồ sơ'}
        </h4>
        <p className="text-xs text-gray-500 mb-4">
          {modalAction.type === 'return'
            ? 'Hồ sơ sẽ quay về trạng thái Nháp. Người tạo sẽ nhận thông báo kèm lý do dưới đây để sửa đổi.'
            : 'Hồ sơ sẽ chuyển sang trạng thái Từ chối và kết thúc quy trình phê duyệt.'}
        </p>

        <textarea
          rows={4}
          required
          placeholder="Vui lòng nhập lý do cụ thể (bắt buộc)..."
          value={modalAction.comment}
          onChange={(e) => onChangeComment(e.target.value)}
          className="w-full p-3 text-sm bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white mb-4"
        />

        <div className="flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-slate-100"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-50 ${
              modalAction.type === 'return' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isProcessing ? 'Đang xử lý...' : modalAction.type === 'return' ? 'Xác nhận trả lại' : 'Xác nhận từ chối'}
          </button>
        </div>
      </div>
    </div>
  );
};
