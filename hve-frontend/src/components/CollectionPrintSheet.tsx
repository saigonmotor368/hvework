import React from "react";
import { createPortal } from "react-dom";
import type { ApprovalStep, DocumentItem } from "../types";
import { ROLE_LABELS } from "../types";
import { amountToVietnameseWords } from "../utils/paymentPrint";

const fmtDate = (v?: string) => (v ? new Date(v).toLocaleDateString("vi-VN") : "—");
const fmtDateTime = (v?: string) => (v ? new Date(v).toLocaleString("vi-VN") : "—");
const money = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} VND`;
const roleLabel = (step: ApprovalStep) => ROLE_LABELS[step.roleRequired] || step.roleRequired;

/** Phiếu thu — in sau khi Kế toán xác nhận đã nhận tiền từ site. */
export const CollectionPrintSheet: React.FC<{ document: DocumentItem }> = ({ document: doc }) => {
  if (typeof document === "undefined") return null;
  const data: any = doc.dataJson || {};
  const collection = data.collection;
  const remittance = data.remittance;
  const steps = (doc.steps || []).filter((s) => s.status === "approved");
  const siteStep = steps.find((s) => s.roleRequired === "department_head");
  const accountingStep = steps.find((s) => s.roleRequired === "accountant");
  const partial = collection?.status === "partial";
  const received = Number(collection?.receivedAmount) || 0;

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
          <em>{partial ? "THU MỘT PHẦN" : "ĐÃ THU ĐỦ"}</em>
        </div>
      </header>

      <section className="payment-print-title">
        <h1>PHIẾU THU</h1>
        <p>
          Kỳ {data.period || "—"} · Ngày lập {fmtDate(doc.createdAt)} · Ngày xác nhận thu {fmtDate(collection?.receivedAt)}
        </p>
      </section>

      <section className="payment-print-summary">
        <div>
          <span>Site nộp tiền</span>
          <strong>{doc.project ? `${doc.project.code} — ${doc.project.name}` : "—"}</strong>
        </div>
        <div>
          <span>Người lập đề nghị (Kế toán)</span>
          <strong>{doc.createdBy?.name || "—"}</strong>
          <small>Hạn nộp {fmtDate(data.deadline)}</small>
        </div>
        <div>
          <span>Tài khoản nhận về</span>
          <strong>{data.receiver}</strong>
          <small>
            {data.bankName} · STK {data.bankAccount}
          </small>
        </div>
        <div>
          <span>Hình thức</span>
          <strong>Chuyển khoản</strong>
          <small>Mã giao dịch: {collection?.reference || remittance?.reference || "—"}</small>
        </div>
      </section>

      <section className="payment-print-amount">
        <div>
          <span>Số tiền thực nhận</span>
          <strong>{money(received)}</strong>
        </div>
        <p>
          <b>Bằng chữ:</b> {amountToVietnameseWords(received)}
        </p>
      </section>

      <section className="payment-print-section">
        <h2>Đối chiếu số liệu</h2>
        <table className="payment-print-table">
          <thead>
            <tr>
              <th>Số tiền đề nghị thu</th>
              <th>Site báo đã nộp</th>
              <th>Kế toán thực nhận</th>
              <th>Còn thiếu</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{Number(data.amount || 0).toLocaleString("vi-VN")}</td>
              <td>{remittance ? Number(remittance.amount).toLocaleString("vi-VN") : "—"}</td>
              <td>{received.toLocaleString("vi-VN")}</td>
              <td>{Number(collection?.outstandingAmount || 0).toLocaleString("vi-VN")}</td>
            </tr>
          </tbody>
        </table>
        <div className="payment-print-meta-row">
          <p>
            <b>Site nộp lúc:</b> {fmtDateTime(remittance?.paidAt)} · {remittance?.proofAttachmentCount || 0} chứng từ
          </p>
          <p>
            <b>Nội dung:</b> {data.content || "—"}
          </p>
        </div>
      </section>

      <section className="payment-print-section">
        <h2>Nhật ký xử lý điện tử</h2>
        <div className="payment-print-approvals">
          <div className="payment-print-approval">
            <span>Kế toán lập</span>
            <strong>{doc.createdBy?.name || "—"}</strong>
            <small>{fmtDateTime(doc.createdAt)}</small>
            <em>Đã gửi đề nghị thu cho site</em>
          </div>
          {steps.map((step) => (
            <div className="payment-print-approval" key={step.id}>
              <span>{step.roleRequired === "department_head" ? "Trưởng dự án (Site)" : roleLabel(step)}</span>
              <strong>{step.actedBy?.name || "Tự động bỏ qua"}</strong>
              <small>{fmtDateTime(step.actedAt)}</small>
              <em>{step.roleRequired === "accountant" ? (partial ? "Xác nhận thu một phần" : "Xác nhận đã thu đủ") : step.comment?.trim() || "Đã nộp tiền"}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="payment-print-signatures">
        <div>
          <strong>Người lập phiếu</strong>
          <span>Ký và ghi rõ họ tên</span>
          <b>{doc.createdBy?.name || ""}</b>
        </div>
        <div>
          <strong>Trưởng dự án (Site)</strong>
          <span>Ký và ghi rõ họ tên</span>
          <b>{siteStep?.actedBy?.name || ""}</b>
        </div>
        <div>
          <strong>Kế toán xác nhận</strong>
          <span>Ký và ghi rõ họ tên</span>
          <b>{accountingStep?.actedBy?.name || ""}</b>
        </div>
        <div>
          <strong>Kế toán trưởng / CEO</strong>
          <span>Ký và ghi rõ họ tên</span>
          <b />
        </div>
      </section>

      <footer className="payment-print-footer">
        <span>Bản in từ HVE Work · Dữ liệu được lưu trên hệ thống</span>
        <span>
          {doc.code} · v{doc.version}
        </span>
      </footer>
    </article>,
    document.body,
  );
};
