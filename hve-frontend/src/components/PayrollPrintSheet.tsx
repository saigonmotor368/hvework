import React from "react";
import { createPortal } from "react-dom";
import type { ApprovalStep, DocumentItem } from "../types";
import { ROLE_LABELS } from "../types";
import { amountToVietnameseWords } from "../utils/paymentPrint";
import type { PayrollItem } from "../utils/documentTypes";

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "—";

const formatDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString("vi-VN") : "—";

const approvalLabel = (step: ApprovalStep) =>
  ROLE_LABELS[step.roleRequired] || step.roleRequired;

/** Phiếu đề nghị chi lương kiêm phiếu chi — in sau khi Kế toán đã chi xong. */
export const PayrollPrintSheet: React.FC<{ document: DocumentItem }> = ({
  document: doc,
}) => {
  if (typeof document === "undefined") return null;

  const items: Array<PayrollItem & { payment?: any }> =
    (doc.dataJson as any)?.payrollItems || [];
  const period = (doc.dataJson as any)?.period || "";
  const total = items.reduce((sum, i) => sum + i.netPay, 0);
  const steps = (doc.steps || []).filter((s) => s.status === "approved");
  const accountingStep = steps.find((s) => s.roleRequired === "accountant");
  const approvalSteps = steps.filter((s) => s.roleRequired !== "accountant");
  const hrStep = steps.find((s) => s.roleRequired === "hr");
  const ceoStep = steps.find((s) => s.roleRequired === "ceo");
  const projectLabel = doc.project
    ? `${doc.project.code} — ${doc.project.name}`
    : "Huy Võ Education";
  const paidAtList = items
    .map((i) => i.payment?.paidAt as string | undefined)
    .filter(Boolean) as string[];
  const lastPaidAt = paidAtList.sort().pop();

  return createPortal(
    <article className="payment-print-root" aria-hidden="true">
      <header className="payment-print-header">
        <div className="payment-print-brand">
          <img src="/hve-logo-transparent.svg" alt="HVE" />
          <div>
            <strong>HUY VÕ EDUCATION</strong>
            <span>Hệ thống quản lý công việc và phê duyệt nội bộ</span>
          </div>
        </div>
        <div className="payment-print-code">
          <span>Mã hồ sơ</span>
          <strong>{doc.code}</strong>
          <em>ĐÃ CHI LƯƠNG</em>
        </div>
      </header>

      <section className="payment-print-title">
        <h1>PHIẾU ĐỀ NGHỊ CHI LƯƠNG KIÊM PHIẾU CHI</h1>
        <p>
          Kỳ lương {period || "—"} · Ngày lập {formatDate(doc.createdAt)} · Ngày hoàn tất{" "}
          {formatDate(lastPaidAt || accountingStep?.actedAt)}
        </p>
      </section>

      <section className="payment-print-summary">
        <div>
          <span>Người đề nghị (Trưởng dự án)</span>
          <strong>{doc.createdBy?.name || "—"}</strong>
          <small>{doc.createdBy?.email || ""}</small>
        </div>
        <div>
          <span>Dự án (Site)</span>
          <strong>{projectLabel}</strong>
        </div>
        <div>
          <span>Số nhân viên</span>
          <strong>{items.length} người</strong>
        </div>
        <div>
          <span>Hình thức chi</span>
          <strong>Chuyển khoản từng người</strong>
        </div>
      </section>

      <section className="payment-print-amount">
        <div>
          <span>Tổng số tiền chi lương</span>
          <strong>{total.toLocaleString("vi-VN")} VND</strong>
        </div>
        <p>
          <b>Bằng chữ:</b> {amountToVietnameseWords(total)}
        </p>
      </section>

      <section className="payment-print-section">
        <h2>Danh sách nhận lương và xác nhận chi</h2>
        <table className="payment-print-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Họ và tên</th>
              <th>Ngân hàng / Số tài khoản</th>
              <th>Thực lãnh (VND)</th>
              <th>Thời gian chi / Mã GD</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.employeeCode}-${index}`}>
                <td>{index + 1}</td>
                <td>
                  {item.fullName}
                  {item.employeeCode ? ` (${item.employeeCode})` : ""}
                </td>
                <td>
                  {item.bankName} · {item.bankAccount}
                </td>
                <td>{item.netPay.toLocaleString("vi-VN")}</td>
                <td>
                  {formatDateTime(item.payment?.paidAt)}
                  {item.payment?.reference ? ` · ${item.payment.reference}` : ""}
                </td>
              </tr>
            ))}
            <tr className="payment-print-total">
              <td colSpan={3}>TỔNG CỘNG</td>
              <td colSpan={2}>{total.toLocaleString("vi-VN")} VND</td>
            </tr>
          </tbody>
        </table>
        <div className="payment-print-meta-row">
          <p>
            <b>Chứng từ chuyển khoản:</b>{" "}
            {items.filter((i) => i.payment?.attachmentId).length}/{items.length} giao dịch có chứng từ trên hệ thống
          </p>
          <p>
            <b>Bảng lương gốc:</b> {(doc.dataJson as any)?.payrollFileName || "đính kèm trong hồ sơ"}
          </p>
        </div>
      </section>

      <section className="payment-print-section payment-print-accounting">
        <h2>Xác nhận chi tiền của kế toán</h2>
        <div className="payment-print-accounting-grid">
          <p>
            <span>Người xử lý</span>
            <strong>{accountingStep?.actedBy?.name || "—"}</strong>
          </p>
          <p>
            <span>Hoàn tất lúc</span>
            <strong>{formatDateTime(accountingStep?.actedAt)}</strong>
          </p>
          <p>
            <span>Tham chiếu</span>
            <strong>{doc.dataJson?.settlement?.reference || "—"}</strong>
          </p>
        </div>
      </section>

      <section className="payment-print-section">
        <h2>Nhật ký phê duyệt điện tử</h2>
        <div className="payment-print-approvals">
          <div className="payment-print-approval">
            <span>Trưởng dự án</span>
            <strong>{doc.createdBy?.name || "—"}</strong>
            <small>{formatDateTime(doc.createdAt)}</small>
            <em>Đã lập đề nghị và gửi duyệt</em>
          </div>
          {approvalSteps.map((step) => (
            <div className="payment-print-approval" key={step.id}>
              <span>{approvalLabel(step)}</span>
              <strong>{step.actedBy?.name || "—"}</strong>
              <small>{formatDateTime(step.actedAt)}</small>
              <em>{step.comment?.trim() || "Đồng ý phê duyệt"}</em>
            </div>
          ))}
          {accountingStep && (
            <div className="payment-print-approval">
              <span>Kế toán</span>
              <strong>{accountingStep.actedBy?.name || "—"}</strong>
              <small>{formatDateTime(accountingStep.actedAt)}</small>
              <em>Đã chi lương và hoàn tất</em>
            </div>
          )}
        </div>
      </section>

      <section className="payment-print-signatures">
        <div>
          <strong>Trưởng dự án</strong>
          <span>Ký và ghi rõ họ tên</span>
          <b>{doc.createdBy?.name || ""}</b>
        </div>
        <div>
          <strong>Nhân sự</strong>
          <span>Ký và ghi rõ họ tên</span>
          <b>{hrStep?.actedBy?.name || ""}</b>
        </div>
        <div>
          <strong>Kế toán</strong>
          <span>Ký và ghi rõ họ tên</span>
          <b>{accountingStep?.actedBy?.name || ""}</b>
        </div>
        <div>
          <strong>CEO</strong>
          <span>Ký và ghi rõ họ tên</span>
          <b>{ceoStep?.actedBy?.name || ""}</b>
        </div>
      </section>

      <footer className="payment-print-footer">
        <span>Bản in từ HVE Work · Dữ liệu phê duyệt được lưu trên hệ thống</span>
        <span>
          {doc.code} · v{doc.version}
        </span>
      </footer>
    </article>,
    document.body,
  );
};
