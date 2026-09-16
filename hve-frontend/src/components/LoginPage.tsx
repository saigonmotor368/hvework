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
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-50 shadow-lg shadow-blue-500/20">
          <svg viewBox="0 0 200 200" className="w-12 h-12" aria-label="Huy Võ Education">
            <circle cx="100" cy="58" r="11" fill="#FFC631" />
            <path d="M66 75 L100 130" fill="none" stroke="#0A66C2" strokeWidth="22" strokeLinecap="round" />
            <path d="M100 130 L134 75" fill="none" stroke="#20B84D" strokeWidth="22" strokeLinecap="round" />
            <path d="M68 150 Q100 170 132 150" fill="none" stroke="#1D1D1F" strokeWidth="11" strokeLinecap="round" />
          </svg>
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
              Chuyển vai trò đăng nhập thử nghiệm:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="btn-login-nv"
                onClick={() => onSwitchAccount('nv1@huyvoeducation.vn')}
                className="p-2 text-xs font-medium text-center rounded-lg bg-blue-50 text-[#0A66C2] hover:bg-blue-100"
              >
                Nhân viên
              </button>
              <button
                type="button"
                id="btn-login-tp"
                onClick={() => onSwitchAccount('tp_it@huyvoeducation.vn')}
                className="p-2 text-xs font-medium text-center rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              >
                Trưởng phòng IT
              </button>
              <button
                type="button"
                id="btn-login-kt"
                onClick={() => onSwitchAccount('ketoan@huyvoeducation.vn')}
                className="p-2 text-xs font-medium text-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              >
                Kế toán trưởng
              </button>
              <button
                type="button"
                id="btn-login-pc"
                onClick={() => onSwitchAccount('phapche@huyvoeducation.vn')}
                className="p-2 text-xs font-medium text-center rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100"
              >
                Pháp chế
              </button>
              <button
                type="button"
                id="btn-login-ceo"
                onClick={() => onSwitchAccount('ceo@huyvoeducation.vn')}
                className="p-2 text-xs font-medium text-center rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                Ban Giám Đốc (CEO)
              </button>
              <button
                type="button"
                id="btn-login-admin"
                onClick={() => onSwitchAccount('admin@huyvoeducation.vn')}
                className="p-2 text-xs font-medium text-center rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200"
              >
                IT Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
