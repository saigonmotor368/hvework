import React, { useState } from 'react';
import { PwaInstallPrompt } from './PwaInstallPrompt.js';

interface LoginPageProps {
  authError: string;
  isProcessing: boolean;
  onLogin: (e: React.FormEvent<HTMLFormElement>) => void;
  verificationEmail?: string;
  onVerifyEmail: (e: React.FormEvent<HTMLFormElement>) => void;
  onResendEmail: () => void;
  resendCooldown: number;
  onCancelVerification: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  authError,
  isProcessing,
  onLogin,
  verificationEmail,
  onVerifyEmail,
  onResendEmail,
  resendCooldown,
  onCancelVerification,
}) => {
  const [verificationInput, setVerificationInput] = useState<{
    email?: string;
    code: string;
  }>({ code: '' });
  const [showPassword, setShowPassword] = useState(false);
  const verificationCode =
    verificationInput.email === verificationEmail ? verificationInput.code : '';

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col justify-center py-6 sm:py-12 px-3 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-50 shadow-lg shadow-blue-500/20">
          <svg viewBox="0 0 200 200" className="w-12 h-12" aria-label="Huy Võ Education">
            <circle cx="100" cy="58" r="11" fill="#FFC631" />
            <path d="M66 75 L100 130" fill="none" stroke="#0A66C2" strokeWidth="22" strokeLinecap="round" />
            <path d="M100 130 L134 75" fill="none" stroke="#20B84D" strokeWidth="22" strokeLinecap="round" />
            <path d="M68 150 Q100 170 132 150" fill="none" stroke="#1D1D1F" strokeWidth="11" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl sm:text-2xl font-extrabold text-[#1D1D1F] tracking-tight">Hệ Thống Quản Lý Công Việc</h2>
        <p className="mt-1 text-sm text-gray-500">Huy Võ Education – Hệ thống điều hành &amp; Phê duyệt nội bộ</p>
      </div>

      <div className="mt-6 sm:mt-8 sm:mx-auto w-full sm:max-w-md">
        <div className="bg-white py-6 sm:py-8 px-4 sm:px-10 shadow-xl shadow-slate-200/60 rounded-2xl border border-slate-100">
          {verificationEmail ? (
            <form className="space-y-5" onSubmit={onVerifyEmail} autoComplete="off" data-form-type="other">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                Thiết bị này cần được xác minh. Mã 6 số đã gửi tới{' '}
                <strong>{verificationEmail}</strong> và có hiệu lực trong 10 phút.
              </div>
              {authError && (
                <div className="text-sm text-red-700 bg-red-50 p-3 rounded-lg border border-red-100">
                  {authError}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700">Mã xác minh email</label>
                <input
                  name="code"
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="Mã xác minh email gồm 6 chữ số"
                  placeholder="••••••"
                  value={verificationCode}
                  onChange={(event) => {
                    const nextCode = event.target.value;
                    if (/^\d{0,6}$/.test(nextCode)) {
                      setVerificationInput({ email: verificationEmail, code: nextCode });
                    }
                  }}
                  data-1p-ignore
                  data-lpignore="true"
                  autoFocus
                  className="mt-1 block w-full px-3.5 py-3 bg-slate-50 border border-gray-200 rounded-lg text-center text-xl tracking-[0.35em] font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full flex justify-center py-2.5 px-4 rounded-lg shadow-md text-sm font-semibold text-white bg-[#0A66C2] hover:bg-blue-700 disabled:opacity-50"
              >
                {isProcessing ? 'Đang xác minh...' : 'Xác minh và đăng nhập'}
              </button>
              <button
                type="button"
                onClick={onResendEmail}
                disabled={isProcessing || resendCooldown > 0}
                className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-[#0A66C2] transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {resendCooldown > 0
                  ? `Có thể gửi lại mã sau ${resendCooldown}s`
                  : 'Không nhận được email? Gửi lại mã mới'}
              </button>
              <button
                type="button"
                onClick={onCancelVerification}
                disabled={isProcessing}
                className="w-full text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Quay lại đăng nhập
              </button>
            </form>
          ) : (
          <form className="space-y-5" onSubmit={onLogin}>
            {authError && (
              <div className="text-sm text-red-700 bg-red-50 p-3 rounded-lg border border-red-100">
                {authError}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700">Email công việc</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="email@huyvoeducation.vn"
                className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700">Mật khẩu</label>
              <div className="relative mt-1">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  className="block w-full px-3.5 py-2.5 pr-16 bg-slate-50 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-[#0A66C2]"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full flex justify-center py-2.5 px-4 rounded-lg shadow-md text-sm font-semibold text-white bg-[#0A66C2] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A66C2] transition-all disabled:opacity-50"
            >
              {isProcessing ? 'Đang đăng nhập...' : 'Đăng nhập vào hệ thống'}
            </button>
          </form>
          )}

          <p className="mt-6 text-center text-xs text-gray-400">
            Quên mật khẩu? Liên hệ IT Admin tại{' '}
            <span className="font-medium text-gray-600">admin@huyvoeducation.vn</span>
          </p>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <PwaInstallPrompt />
          </div>
        </div>
      </div>
    </div>
  );
};
