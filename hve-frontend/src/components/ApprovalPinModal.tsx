import React, { useState } from 'react';

interface ApprovalPinModalProps {
  isProcessing: boolean;
  errorMessage: string | null;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
}

export const ApprovalPinModal: React.FC<ApprovalPinModalProps> = ({
  isProcessing,
  errorMessage,
  onConfirm,
  onCancel,
}) => {
  const [pin, setPin] = useState('');

  const isValid = /^\d{6}$/.test(pin);

  const handleSubmit = () => {
    if (isValid && !isProcessing) {
      onConfirm(pin);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-gray-900 mb-1">Xác nhận phê duyệt cuối cùng</h3>
        <p className="text-xs text-gray-500 mb-4">
          Đây là bước duyệt cuối cùng của hồ sơ. Vui lòng nhập mã PIN xác nhận duyệt (6 số) để hoàn tất.
        </p>

        <input
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="• • • • • •"
          className="w-full text-center text-2xl tracking-[0.5em] px-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent"
        />

        {errorMessage && (
          <p className="mt-2 text-xs text-red-600 font-medium">{errorMessage}</p>
        )}

        <div className="flex items-center justify-end space-x-2 mt-5">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-slate-100 transition-all disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isProcessing}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Đang duyệt...' : 'Xác nhận duyệt'}
          </button>
        </div>
      </div>
    </div>
  );
};
