import React, { useState } from "react";
import type { ApprovalStep, DocumentItem, ProjectItem } from "../types";
import { ROLE_LABELS } from "../types";
import { authenticatedFileUrl, uploadAttachment } from "../api/client";
import { UserNameButton } from "./UserNameButton";

interface PaymentRequestAuditViewProps {
  document: DocumentItem;
  user: any;
  isProcessing: boolean;
  apiBaseUrl: string;
  onApproveStep: (
    document: DocumentItem,
    step: ApprovalStep,
    comment?: string,
  ) => void;
  onOpenModalAction: (
    type: "return" | "reject",
    stepId: number,
    documentId: number,
  ) => void;
  onAttachmentUploaded: () => void;
  showToast: (message: string, type?: "success" | "error") => void;
}

type Attachment = NonNullable<DocumentItem["attachments"]>[number];

const formatDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString("vi-VN") : "Chưa xử lý";

const stepStatus = (step: ApprovalStep) => {
  if (step.status === "approved") {
    return { label: "Đã phê duyệt", icon: "✓", tone: "emerald" };
  }
  if (step.status === "pending") {
    return { label: "Đang chờ xử lý", icon: "⏳", tone: "amber" };
  }
  if (step.status === "returned") {
    return { label: "Đã trả lại", icon: "↩", tone: "orange" };
  }
  if (step.status === "rejected") {
    return { label: "Đã từ chối", icon: "✕", tone: "rose" };
  }
  return { label: "Chưa đến lượt", icon: String(step.stepOrder), tone: "slate" };
};

const toneClasses: Record<string, string> = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  orange: "border-orange-200 bg-orange-50 text-orange-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
  slate: "border-slate-200 bg-slate-50 text-slate-500",
};

const AttachmentCard: React.FC<{
  attachment: Attachment;
  apiBaseUrl: string;
  label: string;
  accent: "blue" | "emerald" | "violet";
}> = ({ attachment, apiBaseUrl, label, accent }) => {
  const token = localStorage.getItem("access_token") || "";
  const downloadUrl = token
    ? authenticatedFileUrl(apiBaseUrl, attachment.fileUrl, token)
    : attachment.fileUrl;
  const accentClass =
    accent === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : accent === "violet"
        ? "bg-violet-100 text-violet-700"
        : "bg-blue-100 text-blue-700";

  return (
    <a
      href={downloadUrl}
      target="_blank"
      rel="noreferrer"
      className="group flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg">
        📄
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${accentClass}`}>
            {label}
          </span>
          <span className="text-[10px] text-slate-400">
            {Math.max(1, Math.round(attachment.size / 1024))} KB
          </span>
        </div>
        <p className="mt-1.5 truncate text-xs font-bold text-[#0A66C2] group-hover:underline">
          {attachment.fileName}
        </p>
        <p className="mt-1 truncate text-[11px] text-slate-500">
          {attachment.uploadedBy?.name || "Không xác định"} • {formatDateTime(attachment.uploadedAt)}
        </p>
      </div>
      <span className="mt-2 text-slate-300 group-hover:text-[#0A66C2]">↗</span>
    </a>
  );
};

export const PaymentRequestAuditView: React.FC<PaymentRequestAuditViewProps> = ({
  document,
  user,
  isProcessing,
  apiBaseUrl,
  onApproveStep,
  onOpenModalAction,
  onAttachmentUploaded,
  showToast,
}) => {
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");
  const [renderedAt] = useState(() => Date.now());
  const steps = document.steps || [];
  const accountingStep = steps.find((step) => step.roleRequired === "accountant");
  const approvalSteps = steps.filter((step) => step.roleRequired !== "accountant");
  const attachments = document.attachments || [];
  const accountingFiles = attachments.filter((attachment) =>
    attachment.uploadedBy?.roles?.some((role) => role.name === "accountant"),
  );
  const requesterFiles = attachments.filter(
    (attachment) =>
      attachment.uploadedById === document.createdById &&
      !accountingFiles.some((file) => file.id === attachment.id),
  );
  const supportingFiles = attachments.filter(
    (attachment) =>
      !requesterFiles.some((file) => file.id === attachment.id) &&
      !accountingFiles.some((file) => file.id === attachment.id),
  );

  const activeDelegations = (user?.delegatedFrom || []).filter(
    (delegator: any) =>
      delegator.delegateUntil &&
      new Date(delegator.delegateUntil).getTime() >= renderedAt,
  );
  const delegationForRole = (roleRequired: string) =>
    activeDelegations.find((delegator: any) => {
      if (!(delegator.roles || []).includes(roleRequired)) return false;
      if (roleRequired !== "department_head") return true;
      const delegatedProjectIds = (delegator.projects || []).map(
        (project: ProjectItem) => project.id,
      );
      if (document.projectId) {
        return (
          delegatedProjectIds.includes(document.projectId) ||
          document.linkedProjectIds?.some((id) => delegatedProjectIds.includes(id))
        );
      }
      const creatorDepartmentId = document.createdBy?.department?.id;
      return Boolean(
        creatorDepartmentId && delegator.departmentId === creatorDepartmentId,
      );
    });

  const canActOnStep = (step: ApprovalStep) => {
    if (step.status !== "pending" || document.createdById === user?.id) return false;
    const delegated = delegationForRole(step.roleRequired);
    const hasRole = user?.roles?.includes(step.roleRequired) || Boolean(delegated);
    if (!hasRole) return false;
    if (step.roleRequired !== "department_head" || delegated) return true;
    const userProjectIds = (user?.projects || []).map(
      (project: ProjectItem) => project.id,
    );
    if (document.projectId) {
      return (
        userProjectIds.includes(document.projectId) ||
        Boolean(
          document.linkedProjectIds?.some((id) => userProjectIds.includes(id)),
        )
      );
    }
    const creatorDepartmentId = document.createdBy?.department?.id;
    const userDepartmentId = user?.departmentId || user?.department?.id;
    return Boolean(
      creatorDepartmentId && userDepartmentId === creatorDepartmentId,
    );
  };

  const uploadPaymentProof = async () => {
    const token = localStorage.getItem("access_token");
    if (!token || !proofFile) return;
    setUploadingProof(true);
    try {
      await uploadAttachment(apiBaseUrl, token, proofFile, {
        entityType: "document",
        entityId: document.id,
      });
      setProofFile(null);
      showToast("Đã đính kèm chứng từ chi tiền vào hồ sơ.");
      onAttachmentUploaded();
    } catch (error: any) {
      showToast(error.message || "Không thể tải chứng từ chi tiền", "error");
    } finally {
      setUploadingProof(false);
    }
  };

  const renderStepSummary = (step: ApprovalStep, accounting = false) => {
    const status = stepStatus(step);
    const canAct = canActOnStep(step);
    const delegated = delegationForRole(step.roleRequired);
    return (
      <div className={`rounded-2xl border p-4 sm:p-5 ${toneClasses[status.tone]}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black shadow-sm">
              {status.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">
                {accounting ? "Bộ phận kế toán" : `Cấp ${step.stepOrder}`}
              </p>
              <p className="mt-0.5 text-sm font-black">
                {ROLE_LABELS[step.roleRequired] || step.roleRequired}
              </p>
              {step.actedBy ? (
                <p className="mt-1 text-xs">
                  Người xử lý: <UserNameButton user={step.actedBy} />
                </p>
              ) : (
                <p className="mt-1 text-xs opacity-70">Chưa có người xử lý</p>
              )}
            </div>
          </div>
          <span className="w-fit rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold shadow-sm">
            {status.label}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="rounded-xl border border-white/80 bg-white/75 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">
              Ý kiến xử lý
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-xs font-semibold leading-relaxed text-slate-700">
              {step.comment?.trim() || "Chưa có ý kiến."}
            </p>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/75 p-3 sm:min-w-44">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">
              Thời gian
            </p>
            <p className="mt-1.5 text-xs font-semibold text-slate-700">
              {formatDateTime(step.actedAt)}
            </p>
          </div>
        </div>

        {canAct && (
          <div className="mt-4 border-t border-current/10 pt-4">
            {delegated && !user?.roles?.includes(step.roleRequired) && (
              <p className="mb-3 rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold">
                🔄 Đang xử lý thay {delegated.name}
              </p>
            )}
            {accounting && (
              <div className="mb-3 rounded-xl border border-emerald-200 bg-white p-3">
                <p className="text-xs font-bold text-emerald-800">
                  Chứng từ chi tiền bắt buộc
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                    onChange={(event) => setProofFile(event.target.files?.[0] || null)}
                    className="min-w-0 flex-1 text-xs text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={uploadPaymentProof}
                    disabled={!proofFile || uploadingProof}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {uploadingProof ? "Đang tải..." : "Tải chứng từ"}
                  </button>
                </div>
              </div>
            )}
            <textarea
              value={approvalComment}
              onChange={(event) => setApprovalComment(event.target.value)}
              placeholder={
                accounting
                  ? "Ý kiến kế toán: mã giao dịch, ngày chi tiền..."
                  : "Nhập ý kiến phê duyệt (tùy chọn)..."
              }
              rows={2}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() =>
                  onApproveStep(document, step, approvalComment.trim() || undefined)
                }
                disabled={isProcessing}
                className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50"
              >
                {isProcessing
                  ? "Đang xử lý..."
                  : accounting
                    ? "✓ Xác nhận đã chi tiền & hoàn tất"
                    : "✓ Phê duyệt đề nghị"}
              </button>
              <button
                type="button"
                onClick={() => onOpenModalAction("return", step.id, document.id)}
                disabled={isProcessing}
                className="rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                Trả lại để điều chỉnh
              </button>
              {!accounting && (
                <button
                  type="button"
                  onClick={() => onOpenModalAction("reject", step.id, document.id)}
                  disabled={isProcessing}
                  className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  Huỷ hồ sơ
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white px-4 py-4 sm:px-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0A66C2] text-sm font-black text-white">
            1
          </span>
          <div>
            <h4 className="text-base font-black text-slate-900">Nội dung đề nghị thanh toán</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Thông tin do người đề nghị cung cấp và chịu trách nhiệm.
            </p>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-blue-50 p-4 sm:col-span-2 xl:col-span-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Số tiền đề nghị</p>
              <p className="mt-1 text-xl font-black text-[#0A66C2] sm:text-2xl">
                {Number(document.dataJson?.amount || 0).toLocaleString("vi-VN")} ₫
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Người/đơn vị thụ hưởng</p>
              <p className="mt-1.5 text-sm font-bold text-slate-800">{document.dataJson?.receiver || "—"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Thông tin nhận tiền</p>
              <p className="mt-1.5 text-sm font-bold text-slate-800">{document.dataJson?.bankName || "—"}</p>
              <p className="mt-0.5 text-xs text-slate-500">STK: {document.dataJson?.bankAccount || "—"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hạn thanh toán</p>
              <p className="mt-1.5 text-sm font-bold text-slate-800">{document.dataJson?.deadline || "—"}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nội dung đề nghị</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {document.dataJson?.content || "Chưa có nội dung."}
            </p>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-700">Hồ sơ, hóa đơn người đề nghị đính kèm</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{requesterFiles.length} tệp từ {document.createdBy?.name || "người tạo"}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">Minh bạch hồ sơ</span>
            </div>
            {requesterFiles.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {requesterFiles.map((attachment) => (
                  <AttachmentCard key={attachment.id} attachment={attachment} apiBaseUrl={apiBaseUrl} label="Tệp người đề nghị" accent="blue" />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-center text-xs font-semibold text-amber-800">
                Người đề nghị chưa đính kèm tài liệu.
              </div>
            )}
            {supportingFiles.length > 0 && (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {supportingFiles.map((attachment) => (
                  <AttachmentCard key={attachment.id} attachment={attachment} apiBaseUrl={apiBaseUrl} label="Tài liệu bổ sung" accent="violet" />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white px-4 py-4 sm:px-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white">2</span>
          <div>
            <h4 className="text-base font-black text-slate-900">Ý kiến và kết quả phê duyệt</h4>
            <p className="mt-0.5 text-xs text-slate-500">Theo dõi rõ người xử lý, kết quả, ý kiến và thời gian từng cấp.</p>
          </div>
        </div>
        <div className="space-y-3 p-4 sm:p-6">
          {approvalSteps.length > 0 ? (
            approvalSteps.map((step) => (
              <React.Fragment key={step.id}>
                {renderStepSummary(step)}
              </React.Fragment>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">Chưa tạo quy trình phê duyệt.</div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-4 py-4 sm:px-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-sm font-black text-white">3</span>
          <div>
            <h4 className="text-base font-black text-slate-900">Xử lý thanh toán của kế toán</h4>
            <p className="mt-0.5 text-xs text-slate-500">Kết quả xử lý, ý kiến nghiệp vụ và chứng từ xác nhận chi tiền.</p>
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-6">
          {accountingStep ? (
            renderStepSummary(accountingStep, true)
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">Chưa có bước xử lý kế toán.</div>
          )}
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-wider text-slate-700">Chứng từ thanh toán</p>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{accountingFiles.length} tệp</span>
            </div>
            {accountingFiles.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {accountingFiles.map((attachment) => (
                  <AttachmentCard key={attachment.id} attachment={attachment} apiBaseUrl={apiBaseUrl} label="Chứng từ đã chi" accent="emerald" />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-4 text-center text-xs font-semibold text-emerald-800">
                Chưa có chứng từ xác nhận chi tiền.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
