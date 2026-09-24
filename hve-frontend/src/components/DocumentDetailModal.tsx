import React, { useState } from "react";
import {
  type DocumentItem,
  type ApprovalStep,
  type ProjectItem,
  ROLE_LABELS,
  DOCUMENT_TYPE_LABELS,
} from "../types";
import { authenticatedFileUrl } from "../api/client";
import { UserNameButton } from "./UserNameButton";
import { PaymentRequestAuditView } from "./PaymentRequestAuditView";
import type { PaymentSettlementInput } from "./PaymentRequestAuditView";
import { matchesDepartmentHeadScope } from "../utils/documentApproval";

interface DocumentDetailModalProps {
  selectedDoc: DocumentItem;
  user: any;
  isProcessing: boolean;
  apiBaseUrl: string;
  getStatusBadge: (status: string) => React.ReactNode;
  onBack: () => void;
  onSubmitDraft: (doc: DocumentItem) => void;
  onEditDraft: (doc: DocumentItem) => void;
  onCreateNewVersion: (doc: DocumentItem) => void;
  onApproveStep: (
    doc: DocumentItem,
    step: ApprovalStep,
    comment?: string,
    settlement?: PaymentSettlementInput,
  ) => void;
  onApproveDirect: (doc: DocumentItem) => void;
  onOpenModalAction: (
    type: "return" | "reject",
    stepId: number,
    docId: number,
  ) => void;
  projects: ProjectItem[];
  onAttachmentUploaded: () => void;
  showToast: (message: string, type?: "success" | "error") => void;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  selectedDoc,
  user,
  isProcessing,
  apiBaseUrl,
  getStatusBadge,
  onBack,
  onSubmitDraft,
  onEditDraft,
  onCreateNewVersion,
  onApproveStep,
  onApproveDirect,
  onOpenModalAction,
  projects,
  onAttachmentUploaded,
  showToast,
}) => {
  const [renderedAt] = useState(() => Date.now());

  const linkedProjects = projects.filter((project) =>
    selectedDoc.linkedProjectIds?.includes(project.id),
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
      return matchesDepartmentHeadScope(delegator, selectedDoc);
    });
  const delegatedCeo = delegationForRole("ceo");
  return (
    <div className="min-w-0 space-y-4 md:space-y-6">
      {/* Back button & versioning */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center"
        >
          ← Quay lại danh sách hồ sơ
        </button>
        <span className="text-xs text-gray-400">
          Phiên bản hồ sơ: v{selectedDoc.version}
        </span>
      </div>

      {/* Contract Expiration Alerts Banner */}
      {selectedDoc.type === "contract" &&
        selectedDoc.expiringStatus === "expired" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center space-x-3 text-red-800">
            <span className="text-2xl">🛑</span>
            <div>
              <h5 className="text-sm font-bold">
                Hợp đồng đã quá hạn hiệu lực!
              </h5>
              <p className="text-xs mt-0.5">
                Hạn hợp đồng đã kết thúc vào ngày{" "}
                <strong>{selectedDoc.dataJson?.endDate}</strong>. Vui lòng kiểm
                tra gia hạn hoặc thanh lý hợp đồng.
              </p>
            </div>
          </div>
        )}

      {selectedDoc.type === "contract" &&
        selectedDoc.expiringStatus === "expiring_soon" && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center space-x-3 text-amber-800">
            <span className="text-2xl">⚠️</span>
            <div>
              <h5 className="text-sm font-bold">
                Cảnh báo: Hợp đồng sắp hết hạn hiệu lực!
              </h5>
              <p className="text-xs mt-0.5">
                Hợp đồng này chỉ còn{" "}
                <strong>{selectedDoc.daysRemaining} ngày</strong> nữa sẽ hết hạn
                (vào ngày <strong>{selectedDoc.dataJson?.endDate}</strong>). Vui
                lòng lên phương án gia hạn kịp thời.
              </p>
            </div>
          </div>
        )}

      {/* Header Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <h3 className="w-full text-lg sm:text-xl font-extrabold text-gray-900 break-words">
                {selectedDoc.title}
              </h3>
              <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700">
                {DOCUMENT_TYPE_LABELS[selectedDoc.type] || selectedDoc.type}
              </span>
              {getStatusBadge(selectedDoc.status)}
              {selectedDoc.visibility === "company" && (
                <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  🌐 Toàn hệ thống
                </span>
              )}
              {selectedDoc.targetUser && (
                <span className="rounded-md bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                  Gửi riêng: <UserNameButton user={selectedDoc.targetUser} />
                </span>
              )}
              {selectedDoc.project && (
                <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#0A66C2]">
                  🏗️ {selectedDoc.project.code} — {selectedDoc.project.name}
                </span>
              )}
              {linkedProjects.map((project) => (
                <span
                  key={project.id}
                  className="rounded-md bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700"
                >
                  ↔ {project.code}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Mã hồ sơ:{" "}
              <strong className="text-gray-700">{selectedDoc.code}</strong> —
              Tạo lúc: {new Date(selectedDoc.createdAt).toLocaleString("vi-VN")}{" "}
              bởi{" "}
              <UserNameButton
                user={selectedDoc.createdBy}
                fallback="Nhân viên"
              />{" "}
              (
              {selectedDoc.project
                ? `${selectedDoc.project.code} — ${selectedDoc.project.name}`
                : "Huy Võ Education"}
              )
            </p>
          </div>

          {/* Header Actions */}
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            {selectedDoc.status === "Chờ duyệt" &&
              selectedDoc.type !== "payment_request" &&
              (user?.roles?.includes("ceo") || delegatedCeo) &&
              selectedDoc.createdById !== user?.id && (
                <button
                  onClick={() => onApproveDirect(selectedDoc)}
                  disabled={isProcessing}
                  className="w-full rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-violet-700 disabled:opacity-50 sm:w-auto"
                >
                  {isProcessing
                    ? "Đang duyệt..."
                    : delegatedCeo
                      ? `⚡ Duyệt thay ${delegatedCeo.name}`
                      : "⚡ CEO duyệt thẳng"}
                </button>
              )}
            {selectedDoc.status === "Nháp" &&
              selectedDoc.createdById === user?.id && (
                <>
                  <button
                    onClick={() => onEditDraft(selectedDoc)}
                    disabled={isProcessing}
                    className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-[#0A66C2] shadow-sm transition-all hover:bg-blue-100 disabled:opacity-50 sm:w-auto"
                  >
                    ✏️ Chỉnh sửa nội dung & tệp
                  </button>
                  <button
                    onClick={() => onSubmitDraft(selectedDoc)}
                    disabled={isProcessing}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#0A66C2] text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
                  >
                    {isProcessing ? "Đang gửi..." : "🚀 Gửi duyệt hồ sơ"}
                  </button>
                </>
              )}

            {selectedDoc.status === "Đã duyệt" &&
              selectedDoc.createdById === user?.id && (
                <button
                  onClick={() => onCreateNewVersion(selectedDoc)}
                  disabled={isProcessing}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 shadow-sm transition-all disabled:opacity-50"
                >
                  {isProcessing
                    ? "Đang xử lý..."
                    : "📄 Tạo bản sửa đổi (v" + (selectedDoc.version + 1) + ")"}
                </button>
              )}
          </div>
        </div>

        {/* Details Grid: CONTRACT */}
        {selectedDoc.type === "contract" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 text-sm">
            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                Giá trị hợp đồng
              </span>
              <p className="text-2xl font-black text-amber-700 mt-1">
                {selectedDoc.dataJson?.value !== undefined
                  ? `${Number(selectedDoc.dataJson.value).toLocaleString("vi-VN")} VND`
                  : "—"}
              </p>
            </div>

            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                Đối tác ký kết
              </span>
              <p className="font-bold text-gray-800 mt-1">
                {selectedDoc.dataJson?.partner}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Phụ trách:{" "}
                <strong className="text-gray-700">
                  {selectedDoc.dataJson?.manager}
                </strong>
              </p>
            </div>

            <div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                Thời hạn hiệu lực
              </span>
              <p className="font-bold text-gray-800 mt-1">
                {selectedDoc.dataJson?.startDate} →{" "}
                {selectedDoc.dataJson?.endDate}
              </p>
            </div>

            {selectedDoc.dataJson?.notes && (
              <div className="md:col-span-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                  Ghi chú điều khoản
                </span>
                <p className="text-gray-700 mt-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {selectedDoc.dataJson.notes}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Details Grid: PROPOSAL */}
        {selectedDoc.type === "proposal" && (
          <div className="pt-6 text-sm">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
              Nội dung đề xuất / Kiến nghị
            </span>
            <div className="text-gray-800 mt-2 bg-slate-50 p-5 rounded-xl border border-slate-100 whitespace-pre-wrap leading-relaxed">
              {selectedDoc.dataJson?.content}
            </div>
          </div>
        )}

        {/* Luôn hiển thị để người xem biết rõ hồ sơ có/không có tài liệu. */}
        {selectedDoc.type !== "payment_request" && (
        <div className="mt-6 border-t border-slate-100 pt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {selectedDoc.type === "contract"
                ? "Tệp Hợp đồng đính kèm"
                : selectedDoc.type === "proposal"
                  ? "Tài liệu đính kèm"
                  : "Chứng từ & Hóa đơn đính kèm"}{" "}
              ({selectedDoc.attachments?.length || 0})
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-[#0A66C2]">
              Minh bạch hồ sơ
            </span>
          </div>
          {selectedDoc.attachments && selectedDoc.attachments.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {selectedDoc.attachments.map((att) => {
                const token =
                  typeof window !== "undefined"
                    ? localStorage.getItem("access_token")
                    : "";
                const downloadUrl = token
                  ? authenticatedFileUrl(apiBaseUrl, att.fileUrl, token)
                  : att.fileUrl;
                const isAccountingProof =
                  selectedDoc.type === "payment_request" &&
                  att.uploadedBy?.roles?.some(
                    (role) => role.name === "accountant",
                  );
                return (
                  <a
                    key={att.id}
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs transition-colors hover:border-blue-300 hover:bg-blue-50/60"
                  >
                    <div className="flex min-w-0 items-center gap-2 font-bold text-[#0A66C2]">
                      <span>📎</span>
                      <span className="truncate group-hover:underline">
                        {att.fileName}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                      <span>{Math.max(1, Math.round(att.size / 1024))} KB</span>
                      {att.version && <span>• Phiên bản {att.version}</span>}
                      {isAccountingProof && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-700">
                          Chứng từ thanh toán
                        </span>
                      )}
                    </div>
                    <p className="mt-2 truncate text-[11px] text-slate-600">
                      Tải lên bởi: {att.uploadedBy?.name || "Không xác định"}
                    </p>
                    {att.uploadedAt && (
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {new Date(att.uploadedAt).toLocaleString("vi-VN")}
                      </p>
                    )}
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-5 text-center">
              <p className="text-sm font-bold text-amber-800">
                Chưa có tệp đính kèm
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Hồ sơ hiện chưa có tài liệu hoặc chứng từ nào để đối chiếu.
              </p>
            </div>
          )}
        </div>
        )}
      </div>

      {selectedDoc.type === "payment_request" && (
        <PaymentRequestAuditView
          document={selectedDoc}
          user={user}
          isProcessing={isProcessing}
          apiBaseUrl={apiBaseUrl}
          onApproveStep={onApproveStep}
          onOpenModalAction={onOpenModalAction}
          onAttachmentUploaded={onAttachmentUploaded}
          showToast={showToast}
        />
      )}

      {/* Dynamic Workflow Timeline */}
      {selectedDoc.type !== "payment_request" && (
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
        <h4 className="text-base font-bold text-gray-900 mb-6">
          Tiến trình phê duyệt {(selectedDoc.steps?.length || 0) + 1} cấp
        </h4>

        {selectedDoc.steps && selectedDoc.steps.length > 0 ? (
          <div className="relative">
            <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-200 -z-0" />

            <div className="space-y-6">
              {/* Step 0: Creator */}
              <div className="flex items-start space-x-3 sm:space-x-4 relative z-10">
                <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-white">
                  ✓
                </div>
                <div className="min-w-0 flex-1 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase">
                      Cấp 0: Người tạo
                    </span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      Đã khởi tạo & gửi duyệt
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-800 mt-1">
                    <UserNameButton
                      user={selectedDoc.createdBy}
                      fallback="Nhân viên"
                    />
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(selectedDoc.createdAt).toLocaleString("vi-VN")}
                  </p>
                </div>
              </div>

              {/* Approval Steps */}
              {selectedDoc.steps.map((step) => {
                const isPending = step.status === "pending";
                const isApproved = step.status === "approved";
                const isReturned = step.status === "returned";
                const isRejected = step.status === "rejected";

                const isCreator = selectedDoc.createdById === user?.id;
                const approvalDelegator = delegationForRole(step.roleRequired);
                const hasDirectRole = user?.roles?.includes(step.roleRequired);
                const hasRole = hasDirectRole || Boolean(approvalDelegator);

                // Department scoping check for UI
                let departmentMatch = true;
                if (step.roleRequired === "department_head") {
                  const directDepartmentMatch = matchesDepartmentHeadScope(
                    user || {},
                    selectedDoc,
                  );
                  departmentMatch =
                    directDepartmentMatch || Boolean(approvalDelegator);
                }

                const canAct =
                  isPending && hasRole && !isCreator && departmentMatch;

                return (
                  <div
                    key={step.id}
                    className="flex items-start space-x-3 sm:space-x-4 relative z-10"
                  >
                    <div
                      className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-white ${
                        isApproved
                          ? "bg-emerald-100 text-emerald-700"
                          : isPending
                            ? "bg-amber-100 text-amber-800 animate-pulse"
                            : isReturned
                              ? "bg-orange-100 text-orange-800"
                              : isRejected
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {isApproved
                        ? "✓"
                        : isPending
                          ? "⏳"
                          : isReturned
                            ? "↩"
                            : isRejected
                              ? "✗"
                              : step.stepOrder}
                    </div>

                    <div className="min-w-0 flex-1 bg-white p-3 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase">
                          Cấp {step.stepOrder}:{" "}
                          {ROLE_LABELS[step.roleRequired] || step.roleRequired}
                        </span>
                        {isApproved && (
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            Đã phê duyệt
                          </span>
                        )}
                        {isPending && (
                          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded animate-pulse">
                            Đang chờ duyệt
                          </span>
                        )}
                        {isReturned && (
                          <span className="text-xs font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded">
                            Đã trả lại để sửa
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                            Đã từ chối
                          </span>
                        )}
                        {step.status === "not_started" && (
                          <span className="text-xs font-medium text-gray-400">
                            Chưa đến lượt
                          </span>
                        )}
                      </div>

                      {step.comment && (
                        <p className="text-xs text-gray-700 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          Ý kiến:{" "}
                          <em className="font-medium">"{step.comment}"</em>
                        </p>
                      )}
                      {step.actedAt && (
                        <p className="text-[11px] text-gray-400 mt-1.5">
                          Xử lý lúc:{" "}
                          {new Date(step.actedAt).toLocaleString("vi-VN")}
                        </p>
                      )}

                      {/* Step Action Bar */}
                      {isPending && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          {isCreator ? (
                            <div className="text-xs font-semibold text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-center">
                              <span className="mr-2">⚠️</span>
                              Quy định chống tự phê duyệt: Bạn là người tạo hồ
                              sơ này nên không được tự phê duyệt.
                            </div>
                          ) : !departmentMatch && hasRole ? (
                            <div className="text-xs font-semibold text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-200 flex items-center">
                              <span className="mr-2">🔒</span>
                              Giới hạn phạm vi: Hồ sơ này không thuộc dự án bạn
                              phụ trách hoặc được chia sẻ.
                            </div>
                          ) : canAct ? (
                            <div className="space-y-3">
                              {approvalDelegator && !hasDirectRole && (
                                <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800">
                                  🔄 Duyệt thay {approvalDelegator.name} (đang
                                  vắng mặt đến{" "}
                                  {new Date(
                                    approvalDelegator.delegateUntil,
                                  ).toLocaleDateString("vi-VN")}
                                  )
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() =>
                                    onApproveStep(
                                      selectedDoc,
                                      step,
                                      undefined,
                                    )
                                  }
                                  disabled={isProcessing}
                                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
                                >
                                  {isProcessing ? "Đang xử lý..." : "✓ Phê duyệt"}
                                </button>
                                <button
                                  onClick={() =>
                                    onOpenModalAction(
                                      "return",
                                      step.id,
                                      selectedDoc.id,
                                    )
                                  }
                                  disabled={isProcessing}
                                  className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 shadow-sm transition-all disabled:opacity-50"
                                >
                                  Trả lại để sửa
                                </button>
                                {step.roleRequired !== "accountant" && (
                                  <button
                                    onClick={() =>
                                      onOpenModalAction(
                                        "reject",
                                        step.id,
                                        selectedDoc.id,
                                      )
                                    }
                                    disabled={isProcessing}
                                    className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 shadow-sm transition-all disabled:opacity-50"
                                  >
                                    Từ chối hồ sơ
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">
                              Đang chờ duyệt bởi người có vai trò{" "}
                              <strong className="text-gray-600">
                                {ROLE_LABELS[step.roleRequired] ||
                                  step.roleRequired}
                              </strong>
                              .
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-gray-400">
            Hồ sơ đang ở trạng thái Nháp — chưa tạo các bước phê duyệt.
          </div>
        )}
      </div>
      )}
    </div>
  );
};
