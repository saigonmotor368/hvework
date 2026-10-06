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

export const formatVnd = (value: number): string =>
  `${Math.round(value).toLocaleString("vi-VN")} ₫`;
