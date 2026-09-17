import React, { useEffect, useState } from 'react';
import { BrandLoader } from './BrandLoader';

interface SetApprovalPinModalProps {
  apiBaseUrl: string;
  onClose: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

type View = 'loading' | 'status' | 'setPin' | 'confirmDisable';

export const SetApprovalPinModal: React.FC<SetApprovalPinModalProps> = ({
  apiBaseUrl,
  onClose,
  showToast,
}) => {
  const [view, setView] = useState<View>('loading');
  const [hasPin, setHasPin] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [disablePin, setDisablePin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const token = localStorage.getItem('access_token');

  const fetchStatus = () => {
    fetch(`${apiBaseUrl}/auth/approval-pin-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setHasPin(!!data.hasPin);
        setEnabled(!!data.enabled);
        setView(data.hasPin ? 'status' : 'setPin');
      })
      .catch(() => setView('setPin'));
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl]);

  const isPinFormValid =
    /^\d{6}$/.test(newPin) && newPin === confirmPin && currentPassword.trim().length > 0;

  const handleSubmitPin = async () => {
    if (!isPinFormValid || isProcessing) return;
    setErrorMessage(null);
    setIsProcessing(true);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/approval-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Đặt mã PIN thất bại');
      }
      showToast('Đã lưu mã PIN xác nhận duyệt và bật tính năng này!');
      setCurrentPassword('');
      setNewPin('');
      setConfirmPin('');
      setHasPin(true);
      setEnabled(true);
      setView('status');
    } catch (err: any) {
      setErrorMessage(err.message || 'Đặt mã PIN thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const callToggle = async (nextEnabled: boolean, pin?: string) => {
    setErrorMessage(null);
    setIsProcessing(true);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/approval-pin/enabled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: nextEnabled, ...(pin ? { pin } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Thao tác thất bại');
      }
      setEnabled(nextEnabled);
      setDisablePin('');
      showToast(data.message || 'Đã cập nhật cài đặt mã PIN');
      setView('status');
    } catch (err: any) {
      setErrorMessage(err.message || 'Thao tác thất bại');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleChange = () => {
    if (isProcessing) return;
    if (enabled) {
      // Đang bật, chuyển sang tắt — bắt buộc xác nhận bằng PIN hiện tại
      setErrorMessage(null);
      setDisablePin('');
      setView('confirmDisable');
    } else {
      callToggle(true);
    }
  };

  if (view === 'loading') {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm px-6">
          <BrandLoader compact label="Đang tải thiết lập bảo mật..." />
        </div>
      </div>
    );
  }

  if (view === 'confirmDisable') {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
          <h3 className="text-base font-bold text-gray-900 mb-1">Tắt xác nhận mã PIN</h3>
          <p className="text-xs text-gray-500 mb-4">
            Nhập mã PIN hiện tại để xác nhận tắt yêu cầu PIN cho bước phê duyệt cuối cùng.
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            value={disablePin}
            onChange={(e) => setDisablePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && /^\d{6}$/.test(disablePin) && callToggle(false, disablePin)}
            placeholder="• • • • • •"
            className="w-full text-center text-2xl tracking-[0.5em] px-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent"
          />
          {errorMessage && <p className="mt-2 text-xs text-red-600 font-medium">{errorMessage}</p>}
          <div className="flex items-center justify-end space-x-2 mt-5">
            <button
              onClick={() => setView('status')}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              onClick={() => callToggle(false, disablePin)}
              disabled={!/^\d{6}$/.test(disablePin) || isProcessing}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 shadow-sm transition-all disabled:opacity-50"
            >
              {isProcessing ? 'Đang xử lý...' : 'Xác nhận tắt'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'status') {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
          <h3 className="text-base font-bold text-gray-900 mb-1">Mã PIN xác nhận duyệt</h3>
          <p className="text-xs text-gray-500 mb-4">
            Khi bật, hệ thống sẽ bắt buộc nhập mã PIN 6 số ở bước phê duyệt cuối cùng của bạn.
          </p>

          <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 mb-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {enabled ? 'Đang bật' : 'Đang tắt'}
              </p>
              <p className="text-[11px] text-gray-500">Yêu cầu mã PIN khi duyệt bước cuối cùng</p>
            </div>
            <button
              onClick={handleToggleChange}
              disabled={isProcessing}
              role="switch"
              aria-checked={enabled}
              className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
                enabled ? 'bg-emerald-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {errorMessage && <p className="mb-3 text-xs text-red-600 font-medium">{errorMessage}</p>}

          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setErrorMessage(null);
                setView('setPin');
              }}
              className="text-xs font-bold text-[#0A66C2] hover:underline"
            >
              Đổi mã PIN
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-slate-100 transition-all"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-gray-900 mb-1">
          {hasPin ? 'Đổi mã PIN xác nhận duyệt' : 'Thiết lập mã PIN xác nhận duyệt'}
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Mã PIN gồm 6 số, dùng để xác nhận bước phê duyệt cuối cùng của hồ sơ. Mã này độc lập với
          mật khẩu đăng nhập.{!hasPin && ' Đặt mã PIN sẽ tự động bật tính năng này.'}
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Mật khẩu hiện tại
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent"
              placeholder="Nhập mật khẩu đăng nhập"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Mã PIN mới (6 số)
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full text-center text-xl tracking-[0.4em] px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent"
              placeholder="• • • • • •"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Nhập lại mã PIN mới
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitPin()}
              className="w-full text-center text-xl tracking-[0.4em] px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent"
              placeholder="• • • • • •"
            />
            {confirmPin.length === 6 && confirmPin !== newPin && (
              <p className="mt-1 text-[11px] text-red-600 font-medium">Mã PIN nhập lại không khớp</p>
            )}
          </div>
        </div>

        {errorMessage && <p className="mt-3 text-xs text-red-600 font-medium">{errorMessage}</p>}

        <div className="flex items-center justify-end space-x-2 mt-5">
          <button
            onClick={() => (hasPin ? setView('status') : onClose())}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-slate-100 transition-all disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleSubmitPin}
            disabled={!isPinFormValid || isProcessing}
            className="px-4 py-2 rounded-xl bg-[#0A66C2] text-white text-xs font-bold hover:bg-[#08519c] shadow-sm transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Đang lưu...' : 'Lưu mã PIN'}
          </button>
        </div>
      </div>
    </div>
  );
};
