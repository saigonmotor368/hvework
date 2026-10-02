import React from "react";
import { createPortal } from "react-dom";

type ReportTab = "documents" | "tasks" | "financial" | "audit_logs";

interface ReportPrintSheetProps {
  activeTab: ReportTab;
  summaryData: any;
  auditLogs: any[];
  scopeLabel: string;
  filterLabel: string;
}

const fmtDate = (v?: string) => (v ? new Date(v).toLocaleDateString("vi-VN") : "—");
const fmtDateTime = (v?: string) => (v ? new Date(v).toLocaleString("vi-VN") : "—");
const fmtMoney = (v?: number) => `${Number(v || 0).toLocaleString("vi-VN")} đ`;

const docTypeLabel = (type: string) =>
  type === "payment_request"
    ? "Thanh toán"
    : type === "contract"
      ? "Hợp đồng"
      : "Đề xuất";

const reportTitle = (tab: ReportTab) => {
  switch (tab) {
    case "documents":
      return "BÁO CÁO TỔNG HỢP HỒ SƠ";
    case "tasks":
      return "BÁO CÁO TIẾN ĐỘ CÔNG VIỆC";
    case "financial":
      return "BÁO CÁO TÀI CHÍNH & HỢP ĐỒNG";
    case "audit_logs":
      return "NHẬT KÝ HỆ THỐNG";
    default:
      return "BÁO CÁO";
  }
};

export const ReportPrintSheet: React.FC<ReportPrintSheetProps> = ({
  activeTab,
  summaryData,
  auditLogs,
  scopeLabel,
  filterLabel,
}) => {
  if (typeof document === "undefined") return null;

  const nowLabel = new Date().toLocaleString("vi-VN");

  return createPortal(
    <article className="report-print-root" aria-hidden="true">
      <header className="report-print-header">
        <div className="report-print-brand">
          <img src="/hve-logo-transparent.svg" alt="HVE" />
          <div>
            <strong>HUY VÕ EDUCATION</strong>
            <span>Hệ thống quản lý công việc và phê duyệt nội bộ</span>
          </div>
        </div>
        <div className="report-print-meta">
          <span>Xuất lúc {nowLabel}</span>
          <span>Phạm vi: {scopeLabel}</span>
        </div>
      </header>

      <section className="report-print-title">
        <h1>{reportTitle(activeTab)}</h1>
        <p>work.huyvoeducation.vn</p>
      </section>

      {filterLabel && <div className="report-print-filters">Bộ lọc áp dụng: {filterLabel}</div>}

      {/* TAB: DOCUMENTS */}
      {activeTab === "documents" && summaryData?.documents && (
        <>
          <div className="report-print-cards">
            <div>
              <span>Tổng số hồ sơ</span>
              <strong>{summaryData.documents.total}</strong>
            </div>
            <div>
              <span>Tỷ lệ phê duyệt</span>
              <strong>{summaryData.documents.approvalRate}%</strong>
            </div>
            <div>
              <span>Chờ duyệt</span>
              <strong>{summaryData.documents.pending}</strong>
            </div>
            <div>
              <span>Duyệt TB (giờ)</span>
              <strong>{summaryData.documents.avgApprovalTimeHours}</strong>
            </div>
          </div>
          <table className="report-print-table">
            <thead>
              <tr>
                <th style={{ width: "13%" }}>Mã hồ sơ</th>
                <th style={{ width: "27%" }}>Tiêu đề</th>
                <th style={{ width: "13%" }}>Phân loại</th>
                <th style={{ width: "16%" }}>Người tạo</th>
                <th style={{ width: "16%" }}>Dự án</th>
                <th style={{ width: "9%" }}>Ngày tạo</th>
                <th style={{ width: "10%" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {summaryData.documents.items.map((d: any) => (
                <tr key={d.id}>
                  <td>{d.code}</td>
                  <td>{d.title}</td>
                  <td>{docTypeLabel(d.type)}</td>
                  <td>{typeof d.creator === "object" ? d.creator?.name : d.creator || "—"}</td>
                  <td>{d.project || "Huy Võ Education"}</td>
                  <td>{fmtDate(d.createdAt)}</td>
                  <td>{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* TAB: TASKS */}
      {activeTab === "tasks" && summaryData?.tasks && (
        <>
          <div className="report-print-cards">
            <div>
              <span>Tổng số công việc</span>
              <strong>{summaryData.tasks.total}</strong>
            </div>
            <div>
              <span>Tỷ lệ hoàn thành</span>
              <strong>{summaryData.tasks.completionRate}%</strong>
            </div>
            <div>
              <span>Đang thực hiện</span>
              <strong>{summaryData.tasks.inProgress}</strong>
            </div>
            <div>
              <span>Quá hạn</span>
              <strong>{summaryData.tasks.overdue}</strong>
            </div>
          </div>
          <table className="report-print-table">
            <thead>
              <tr>
                <th style={{ width: "12%" }}>Mã CV</th>
                <th style={{ width: "26%" }}>Tiêu đề</th>
                <th style={{ width: "16%" }}>Người phụ trách</th>
                <th style={{ width: "16%" }}>Dự án</th>
                <th style={{ width: "10%" }}>Hạn</th>
                <th style={{ width: "10%" }}>Tiến độ</th>
                <th style={{ width: "10%" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {summaryData.tasks.items.map((t: any) => (
                <tr key={t.id}>
                  <td>{t.code}</td>
                  <td>{t.title}</td>
                  <td>{typeof t.assignee === "object" ? t.assignee?.name : t.assignee || "—"}</td>
                  <td>{t.project || "Huy Võ Education"}</td>
                  <td>{t.dueDate ? fmtDate(t.dueDate) : "—"}</td>
                  <td>{t.progressPercent}%</td>
                  <td>{t.status}{t.isOverdue ? " (Quá hạn)" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* TAB: FINANCIAL (contracts + payment requests) */}
      {activeTab === "financial" && summaryData?.contracts && (
        <>
          <div className="report-print-cards">
            <div>
              <span>Tổng số hợp đồng</span>
              <strong>{summaryData.contracts.total}</strong>
            </div>
            <div>
              <span>Giá trị hợp đồng</span>
              <strong>{fmtMoney(summaryData.contracts.totalValue)}</strong>
            </div>
            <div>
              <span>Tổng đã giải ngân</span>
              <strong>{fmtMoney(summaryData.payments?.totalDisbursedValue)}</strong>
            </div>
            <div>
              <span>HĐ sắp hết hạn</span>
              <strong>{summaryData.contracts.expiringSoonCount}</strong>
            </div>
          </div>
          <table className="report-print-table">
            <thead>
              <tr>
                <th style={{ width: "12%" }}>Mã HĐ</th>
                <th style={{ width: "26%" }}>Tên hợp đồng</th>
                <th style={{ width: "18%" }}>Đối tác</th>
                <th style={{ width: "14%" }}>Giá trị (VNĐ)</th>
                <th style={{ width: "16%" }}>Thời hạn</th>
                <th style={{ width: "14%" }}>Người quản lý</th>
              </tr>
            </thead>
            <tbody>
              {summaryData.contracts.items.map((c: any) => (
                <tr key={c.id}>
                  <td>{c.code}</td>
                  <td>{c.title}</td>
                  <td>{c.partner}</td>
                  <td className="num">{Number(c.value || 0).toLocaleString("vi-VN")}</td>
                  <td>
                    {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
                  </td>
                  <td>{c.manager}</td>
                </tr>
              ))}
              <tr className="report-print-total-row">
                <td colSpan={3}>TỔNG GIÁ TRỊ HỢP ĐỒNG</td>
                <td className="num">{Number(summaryData.contracts.totalValue || 0).toLocaleString("vi-VN")}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* TAB: AUDIT LOGS */}
      {activeTab === "audit_logs" && (
        <table className="report-print-table">
          <thead>
            <tr>
              <th style={{ width: "16%" }}>Thời gian</th>
              <th style={{ width: "16%" }}>Người thao tác</th>
              <th style={{ width: "16%" }}>Đối tượng</th>
              <th style={{ width: "16%" }}>Hành động</th>
              <th style={{ width: "12%" }}>Địa chỉ IP</th>
              <th style={{ width: "24%" }}>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log: any) => (
              <tr key={log.id}>
                <td>{fmtDateTime(log.createdAt)}</td>
                <td>{log.actor?.name || "Hệ thống"}</td>
                <td>
                  {log.entityType} #{log.entityId}
                </td>
                <td>{log.action}</td>
                <td>{log.ip || "—"}</td>
                <td>{log.afterJson ? JSON.stringify(log.afterJson).slice(0, 80) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="report-print-footer">
        <span>Bản in từ HVE Work · Dữ liệu tổng hợp theo quyền truy cập của người xuất báo cáo</span>
        <span>{nowLabel}</span>
      </footer>
    </article>,
    document.body,
  );
};
