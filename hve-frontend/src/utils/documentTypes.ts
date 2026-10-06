/** Hồ sơ có bước Kế toán chi tiền cuối quy trình (cần chứng từ chuyển khoản). */
export const isPaymentLikeType = (type?: string): boolean =>
  type === "payment_request" || type === "payroll_request";

export interface PayrollItem {
  employeeCode: string;
  fullName: string;
  position: string;
  netPay: number;
  bankName: string;
  bankAccount: string;
  note: string;
}

/** Chấp nhận "9/2026", "09/2026", "9-2026", "09.2026"; trả về "MM/YYYY" hoặc "" nếu sai. */
export const normalizePeriod = (value: string): string => {
  const m = /^\s*(\d{1,2})\s*[/.-]\s*(\d{4})\s*$/.exec(value);
  if (!m) return "";
  const month = Number(m[1]);
  return month >= 1 && month <= 12 ? `${String(month).padStart(2, "0")}/${m[2]}` : "";
};

export const formatVnd = (value: number): string =>
  `${Math.round(value).toLocaleString("vi-VN")} ₫`;
