import React from "react";
import { createPortal } from "react-dom";
import type { ApprovalStep, DocumentItem } from "../types";
import { ROLE_LABELS } from "../types";
import { amountToVietnameseWords } from "../utils/paymentPrint";

type Attachment = NonNullable<DocumentItem["attachments"]>[number];

interface PaymentRequestPrintSheetProps {
  document: DocumentItem;
  accountingFiles: Attachment[];
}

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "—";

const formatDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString("vi-VN") : "—";

const approvalLabel = (step: ApprovalStep) =>
  ROLE_LABELS[step.roleRequired] || step.roleRequired;

export const PaymentRequestPrintSheet: React.FC<
  PaymentRequestPrintSheetProps
> = ({ document: paymentDocument, accountingFiles }) => {
  if (typeof document === "undefined") return null;

  const steps = (paymentDocument.steps || []).filter(
    (step) => step.status === "approved",
  );
  const accountingStep = steps.find(
    (step) => step.roleRequired === "accountant",
  );
  const approvalSteps = steps.filter(
    (step) => step.roleRequired !== "accountant",
  );
  const amount = Number(paymentDocument.dataJson?.amount || 0);
  const paymentMethod =
    paymentDocument.dataJson?.bankAccount || paymentDocument.dataJson?.bankName
      ? "Chuyển khoản"
      : "Tiền mặt / khác";
  const projectLabel = paymentDocument.project
    ? `${paymentDocument.project.code} — ${paymentDocument.project.name}`
    : "Huy Võ Education";

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
          <strong>{paymentDocument.code}</strong>
          <em>ĐÃ HOÀN TẤT</em>
        </div>
      </header>

      <section className="payment-print-title">
        <h1>PHIẾU ĐỀ NGHỊ THANH TOÁN KIÊM PHIẾU CHI</h1>
        <p>
          Ngày lập {formatDate(paymentDocument.createdAt)} · Ngày hoàn tất{" "}
          {formatDate(accountingStep?.actedAt)}
        </p>
      </section>

      <section className="payment-print-summary">
        <div>
          <span>Người đề nghị</span>
          <strong>{paymentDocument.createdBy?.name || "—"}</strong>
          <small>{paymentDocument.createdBy?.email || ""}</small>
        </div>
        <div>
          <span>Đơn vị dự án</span>
          <strong>{projectLabel}</strong>
        </div>
        <div>
          <span>Người / đơn vị thụ hưởng</span>
          <strong>{paymentDocument.dataJson?.receiver || "—"}</strong>
        </div>
        <div>
          <span>Hình thức chi</span>
          <strong>{paymentMethod}</strong>
          <small>
            {paymentDocument.dataJson?.bankName || ""}
            {paymentDocument.dataJson?.bankAccount
              ? ` · STK ${paymentDocument.dataJson.bankAccount}`
              : ""}
          </small>
        </div>
      </section>

      <section className="payment-print-amount">
        <div>
          <span>Số tiền thanh toán</span>
          <strong>{amount.toLocaleString("vi-VN")} VND</strong>
        </div>
        <p>
          <b>Bằng chữ:</b> {amountToVietnameseWords(amount)}
        </p>
      </section>

      <section className="payment-print-section">
        <h2>Nội dung và căn cứ thanh toán</h2>
        <table className="payment-print-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Nội dung chi</th>
              <th>Số lượng</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>{paymentDocument.dataJson?.content || paymentDocument.title}</td>
              <td>1</td>
              <td>{amount.toLocaleString("vi-VN")}</td>
              <td>{amount.toLocaleString("vi-VN")}</td>
            </tr>
            <tr className="payment-print-total">
              <td colSpan={4}>TỔNG CỘNG</td>
              <td>{amount.toLocaleString("vi-VN")} VND</td>
            </tr>
          </tbody>
        </table>
        <div className="payment-print-meta-row">
          <p>
            <b>Hạn thanh toán:</b>{" "}
            {formatDate(paymentDocument.dataJson?.deadline)}
          </p>
          <p>
            <b>Hồ sơ gốc:</b>{" "}
            {(paymentDocument.attachments || []).filter(
              (file) => file.uploadedById === paymentDocument.createdById,
            ).length}{" "}
            tệp đính kèm
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
            <span>Thời gian chi</span>
            <strong>{formatDateTime(accountingStep?.actedAt)}</strong>
          </p>
          <p className="payment-print-wide">
            <span>Ý kiến / mã giao dịch</span>
            <strong>{accountingStep?.comment?.trim() || "Đã xác nhận chi tiền"}</strong>
          </p>
          <p className="payment-print-wide">
            <span>Chứng từ thanh toán</span>
            <strong>
              {accountingFiles.length > 0
                ? accountingFiles.map((file) => file.fileName).join(" · ")
                : "—"}
            </strong>
          </p>
        </div>
      </section>

      <section className="payment-print-section">
        <h2>Nhật ký phê duyệt điện tử</h2>
        <div className="payment-print-approvals">
          <div className="payment-print-approval">
            <span>Người đề nghị</span>
            <strong>{paymentDocument.createdBy?.name || "—"}</strong>
            <small>{formatDateTime(paymentDocument.createdAt)}</small>
            <em>Đã khởi tạo và gửi duyệt</em>
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
              <em>Đã chi tiền và hoàn tất</em>
            </div>
          )}
        </div>
      </section>

      <section className="payment-print-signatures">
        <div>
          <strong>Người lập phiếu</strong>
          <span>Ký và ghi rõ họ tên</span>
          <b>{paymentDocument.createdBy?.name || ""}</b>
        </div>
        <div>
          <strong>Kế toán</strong>
          <span>Ký và ghi rõ họ tên</span>
          <b>{accountingStep?.actedBy?.name || ""}</b>
        </div>
        <div>
          <strong>Người nhận tiền đối chiếu</strong>
          <span>Ký và ghi rõ họ tên nếu chi tiền mặt</span>
          <b>{paymentDocument.dataJson?.receiver || ""}</b>
        </div>
      </section>

      <footer className="payment-print-footer">
        <span>Bản in từ HVE Work · Dữ liệu phê duyệt được lưu trên hệ thống</span>
        <span>{paymentDocument.code} · v{paymentDocument.version}</span>
      </footer>
    </article>,
    document.body,
  );
};
