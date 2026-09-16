import React from 'react';

interface LoginPageProps {
  authError: string;
  isProcessing: boolean;
  onLogin: (e: React.FormEvent<HTMLFormElement>) => void;
  onSwitchAccount: (email: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  authError,
  isProcessing,
  onLogin,
  onSwitchAccount,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0A66C2] text-white text-2xl font-bold shadow-lg shadow-blue-500/30">
          HVE
        </div>
        <h2 className="mt-4 text-3xl font-extrabold text-[#1D1D1F] tracking-tight">HVE Work</h2>
        <p className="mt-1 text-sm text-gray-500">Hệ thống điều hành & Phê duyệt nội bộ chuyên nghiệp</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/60 rounded-2xl sm:px-10 border border-slate-100">
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
                defaultValue="nv1@huyvoeducation.vn"
                required
                className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700">Mật khẩu</label>
              <input
                name="password"
                type="password"
                defaultValue="123456"
                required
                className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full flex justify-center py-2.5 px-4 rounded-lg shadow-md text-sm font-semibold text-white bg-[#0A66C2] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A66C2] transition-all disabled:opacity-50"
            >
              {isProcessing ? 'Đang đăng nhập...' : 'Đăng nhập vào hệ thống'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center mb-3">
              Chuyển tài khoản đăng nhập nhanh:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onSwitchAccount('nv1@huyvoeducation.vn')}
                className="p-2 text-xs font-medium text-center rounded-lg bg-blue-50 text-[#0A66C2] hover:bg-blue-100"
              >
                Nhân viên
              </button>
              <button
                type="button"
                onClick={() => onSwitchAccount('ketoan@huyvoeducation.vn')}
                className="p-2 text-xs font-medium text-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              >
                Trưởng BP/Kế toán
              </button>
              <button
                type="button"
                onClick={() => onSwitchAccount('ceo@huyvoeducation.vn')}
                className="p-2 text-xs font-medium text-center rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                CEO
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
