import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ApprovalStep, DocumentItem } from "../types";
import { fetchWithSession, uploadAttachment } from "../api/client";
import { CollectionPrintSheet } from "./CollectionPrintSheet";
import {
  isCreatorAccountingSettlement,
  matchesDepartmentHeadScope,
} from "../utils/documentApproval";
import { formatVnd, normalizePeriod } from "../utils/documentTypes";
import {
  buildVietQrImageUrl,
  DEFAULT_TRANSFER_NOTE,
  findMatchingVietQrBank,
  type VietQrBank,
} from "../utils/vietQr";
import type { PaymentSettlementInput } from "./PaymentRequestAuditView";

interface Props {
  document: DocumentItem;
  user: any;
  isProcessing: boolean;
  apiBaseUrl: string;
  onApproveStep: (
    document: DocumentItem,
    step: ApprovalStep,
    comment?: string,
    settlement?: PaymentSettlementInput,
  ) => void;
  onOpenModalAction: (type: "return" | "reject", stepId: number, documentId: number) => void;
  onAttachmentUploaded: () => Promise<void> | void;
  onOpenDocument?: (documentId: number) => Promise<void> | void;
  showToast: (message: string, type?: "success" | "error") => void;
}

const nowLocalInput = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const fmtDateTime = (value?: string) => (value ? new Date(value).toLocaleString("vi-VN") : "—");
const fmtDate = (value?: string) => (value ? new Date(value).toLocaleDateString("vi-VN") : "—");

export const CollectionRequestView: React.FC<Props> = ({
  document,
  user,
  isProcessing,
  apiBaseUrl,
  onApproveStep,
  onOpenModalAction,
  onAttachmentUploaded,
  onOpenDocument,
  showToast,
}) => {
  const data: any = document.dataJson || {};
  const amount = Number(data.amount) || 0;
  const remittance = data.remittance;
  const collection = data.collection;
  const steps = document.steps || [];
  const siteStep = steps.find((s) => s.roleRequired === "department_head");
  const accountingStep = steps.find((s) => s.roleRequired === "accountant");
  const [renderedAt] = useState(() => Date.now());

  const [banks, setBanks] = useState<VietQrBank[]>([]);
  useEffect(() => {
    let active = true;
    fetch("https://api.vietqr.io/v2/banks")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => active && setBanks(Array.isArray(p?.data) ? p.data : []))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const qrUrl = useMemo(() => {
    const bank = findMatchingVietQrBank(data.bankName || "", banks);
    return bank
      ? buildVietQrImageUrl({
          bankBin: bank.bin,
          accountNo: data.bankAccount || "",
          accountName: data.receiver || "",
          amount,
          description: DEFAULT_TRANSFER_NOTE,
        })
      : "";
  }, [banks, data.bankName, data.bankAccount, data.receiver, amount]);

  // ---- quyền xử lý bước ----
  const delegations = (user?.delegatedFrom || []).filter(
    (d: any) => d.delegateUntil && new Date(d.delegateUntil).getTime() >= renderedAt,
  );
  const canActOn = (step?: ApprovalStep) => {
    if (!step || step.status !== "pending") return false;
    const isOwnFinal = document.createdById === user?.id && isCreatorAccountingSettlement(document, step);
    if (document.createdById === user?.id && !isOwnFinal) return false;
    const delegated = delegations.find((d: any) => (d.roles || []).includes(step.roleRequired));
    const hasRole = user?.roles?.includes(step.roleRequired) || Boolean(delegated);
    if (!hasRole) return false;
    if (step.roleRequired !== "department_head" || delegated) return true;
    return matchesDepartmentHeadScope(user || {}, document);
  };
  const canSiteAct = canActOn(siteStep);
  const canAccountantAct = canActOn(accountingStep);

  // ---- bước Site nộp tiền ----
  const [remitted, setRemitted] = useState(String(amount || ""));
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(nowLocalInput());
  const [comment, setComment] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const proofRef = useRef<HTMLInputElement>(null);

  const stepSince = siteStep ? new Date(siteStep.updatedAt || siteStep.createdAt || 0).getTime() : 0;
  const siteProofs = (document.attachments || []).filter(
    (a) => a.uploadedById === user?.id && a.uploadedAt && new Date(a.uploadedAt).getTime() > stepSince,
  );
  const allProofs = (document.attachments || []).filter((a) => a.uploadedById !== document.createdById);

  const uploadProof = async () => {
    const token = localStorage.getItem("access_token");
    if (!token || !proofFile) return;
    setUploading(true);
    try {
      await uploadAttachment(apiBaseUrl, token, proofFile, { entityType: "document", entityId: document.id });
      setProofFile(null);
      if (proofRef.current) proofRef.current.value = "";
      await onAttachmentUploaded();
      showToast("Đã tải chứng từ lên hồ sơ.");
    } catch (err: any) {
      showToast(err.message || "Không tải được chứng từ", "error");
    } finally {
      setUploading(false);
    }
  };

  // ---- bước Kế toán xác nhận thu ----
  const defaultReceived = Number(remittance?.amount) || amount;
  const [received, setReceived] = useState(String(defaultReceived || ""));
  const [accRef, setAccRef] = useState("");
  const [accDate, setAccDate] = useState(nowLocalInput());
  const receivedNum = Number(received);
  const receivedValid = receivedNum > 0 && receivedNum <= amount;
  const outstanding = receivedValid ? amount - receivedNum : 0;

  const overdue =
    document.status === "Chờ duyệt" && data.deadline && new Date(data.deadline).getTime() + 86_400_000 < renderedAt;


  const statusBanner = () => {
    if (document.status === "Đã duyệt" && collection) {
      const partial = collection.status === "partial";
      return (
        <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${partial ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {partial
            ? `Đã thu một phần: ${formatVnd(collection.receivedAmount)} / ${formatVnd(collection.requestedAmount)} — còn thiếu ${formatVnd(collection.outstandingAmount)}`
            : `✓ Đã thu đủ ${formatVnd(collection.receivedAmount)}`}
          <p className="mt-1 text-xs font-medium opacity-80">
            Xác nhận lúc {fmtDateTime(collection.receivedAt)}
            {collection.reference ? ` · Mã GD ${collection.reference}` : ""}
          </p>
        </div>
      );
    }
    if (siteStep?.status === "approved" && accountingStep?.status === "pending") {
      return <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">Site đã nộp tiền — đang chờ Kế toán đối chiếu và xác nhận đã thu.</div>;
    }
    if (siteStep?.status === "pending") {
      return (
        <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${overdue ? "border-rose-300 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {overdue ? "⚠ Quá hạn — " : ""}Đang chờ Site nộp tiền về công ty (hạn {fmtDate(data.deadline)}).
        </div>
      );
    }
    return null;
  };

  const inputCls = "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700";
  const labelCls = "text-[10px] font-bold uppercase tracking-wider text-slate-500";

  // ---- tạo đề nghị cho phần còn thiếu ----
  const [creatingFollowUp, setCreatingFollowUp] = useState(false);
  const canFollowUp =
    document.status === "Đã duyệt" &&
    collection?.status === "partial" &&
    collection.outstandingAmount > 0 &&
    (user?.roles?.includes("accountant") || user?.roles?.includes("it_admin"));
  const createFollowUp = async () => {
    if (creatingFollowUp) return;
    setCreatingFollowUp(true);
    try {
      const res = await fetchWithSession(`${apiBaseUrl}/documents/${document.id}/collection-follow-up`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(Array.isArray(body?.message) ? body.message.join("; ") : body?.message || "Không tạo được đề nghị");
      showToast(`Đã tạo bản nháp ${body.code} cho phần còn thiếu. Kiểm tra hạn nộp rồi gửi site.`);
      await onOpenDocument?.(body.id);
    } catch (err: any) {
      showToast(err.message || "Không tạo được đề nghị", "error");
    } finally {
      setCreatingFollowUp(false);
    }
  };

  // ---- sửa bản nháp ----
  const canEditDraft = document.status === "Nháp" && document.createdById === user?.id;
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ amount: "", deadline: "", content: "", period: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const startEdit = () => {
    setEditForm({
      amount: String(amount),
      deadline: data.deadline || "",
      content: data.content || "",
      period: data.period || "",
    });
    setEditing(true);
  };
  const saveEdit = async () => {
    if (savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await fetchWithSession(`${apiBaseUrl}/documents/${document.id}?version=${document.version}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
        },
        body: JSON.stringify({
          amount: Math.round(Number(editForm.amount)),
          deadline: editForm.deadline,
          content: editForm.content,
          period: normalizePeriod(editForm.period),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(Array.isArray(body?.message) ? body.message.join("; ") : body?.message || "Không lưu được thay đổi");
      showToast("Đã lưu thay đổi đề nghị thu.");
      setEditing(false);
      await onAttachmentUploaded();
    } catch (err: any) {
      showToast(err.message || "Không lưu được thay đổi", "error");
    } finally {
      setSavingEdit(false);
    }
  };
  const editValid =
    Number(editForm.amount) > 0 && Boolean(editForm.deadline) && Boolean(normalizePeriod(editForm.period));

  return (
    <div className="space-y-4 md:space-y-5">
      {document.status === "Đã duyệt" && collection && (
        <>
          <CollectionPrintSheet document={document} />
          <section className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <p className="text-sm font-black text-slate-900">
                {collection.status === "partial" ? "Đã thu một phần — phiếu thu sẵn sàng" : "Đã thu đủ — phiếu thu sẵn sàng"}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Phiếu gồm số liệu đối chiếu, mã giao dịch và nhật ký xử lý.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canFollowUp && (
                <button type="button" disabled={creatingFollowUp} onClick={() => void createFollowUp()} className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-amber-600 disabled:opacity-50">
                  {creatingFollowUp ? "Đang tạo..." : `➕ Tạo đề nghị thu phần còn thiếu (${formatVnd(collection.outstandingAmount)})`}
                </button>
              )}
              <button type="button" onClick={() => window.print()} className="rounded-xl bg-[#0A66C2] px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-blue-700">
                🖨️ In phiếu thu
              </button>
            </div>
          </section>
        </>
      )}

      {canEditDraft && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          {editing ? (
            <div className="space-y-3">
              <p className="text-xs font-black text-amber-900">Chỉnh sửa bản nháp</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label><span className={labelCls}>Số tiền cần thu (đ)</span><input type="number" min={1} value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} className={inputCls} /></label>
                <label><span className={labelCls}>Kỳ (MM/YYYY)</span><input value={editForm.period} onChange={(e) => setEditForm({ ...editForm, period: e.target.value })} className={inputCls} /></label>
                <label><span className={labelCls}>Hạn nộp</span><input type="date" value={editForm.deadline} onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })} className={inputCls} /></label>
              </div>
              <label className="block"><span className={labelCls}>Nội dung</span><textarea rows={2} value={editForm.content} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} className={inputCls} /></label>
              <div className="flex gap-2">
                <button type="button" disabled={!editValid || savingEdit} onClick={() => void saveEdit()} className="rounded-lg bg-[#0A66C2] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{savingEdit ? "Đang lưu..." : "Lưu thay đổi"}</button>
                <button type="button" disabled={savingEdit} onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Hủy</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-amber-900">Hồ sơ đang là bản nháp. Kiểm tra số tiền, kỳ, hạn nộp rồi bấm “Gửi duyệt hồ sơ”.</p>
              <button type="button" onClick={startEdit} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-200">✏️ Sửa số tiền / hạn nộp</button>
            </div>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white px-4 py-4 sm:px-6">
          <h4 className="text-base font-black text-slate-900">Nội dung đề nghị thu</h4>
          <p className="mt-0.5 text-xs text-slate-500">Kế toán yêu cầu site nộp kết quả kinh doanh về công ty theo biên bản đối soát.</p>
        </div>
        <div className="space-y-4 p-4 sm:p-6">
          {statusBanner()}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Số tiền cần thu</p>
              <p className="mt-1 text-xl font-black text-[#0A66C2]">{formatVnd(amount)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className={labelCls}>Site / dự án</p>
              <p className="mt-1.5 text-sm font-bold text-slate-800">{document.project?.name || "—"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className={labelCls}>Kỳ</p>
              <p className="mt-1.5 text-sm font-bold text-slate-800">{data.period || "—"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className={labelCls}>Hạn nộp</p>
              <p className={`mt-1.5 text-sm font-bold ${overdue ? "text-rose-700" : "text-slate-800"}`}>{fmtDate(data.deadline)}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)] md:items-center rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="mx-auto flex h-[190px] w-[190px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5">
              {qrUrl ? (
                <img src={qrUrl} alt="VietQR nộp tiền về công ty" className="h-full w-full object-contain" />
              ) : (
                <p className="px-3 text-center text-[11px] font-semibold text-slate-500">{banks.length ? "Không tạo được QR cho ngân hàng này." : "Đang tạo mã QR..."}</p>
              )}
            </div>
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-slate-500">Tài khoản nhận</dt>
              <dd className="font-bold text-slate-800">{data.receiver}</dd>
              <dt className="text-slate-500">Ngân hàng</dt>
              <dd className="font-bold text-slate-800">{data.bankName}</dd>
              <dt className="text-slate-500">Số tài khoản</dt>
              <dd>
                <button type="button" title="Bấm để sao chép" onClick={() => navigator.clipboard?.writeText(data.bankAccount).catch(() => undefined)} className="font-mono font-black text-slate-900 hover:text-[#0A66C2]">
                  {data.bankAccount}
                </button>
              </dd>
              <dt className="text-slate-500">Số tiền</dt>
              <dd className="font-black text-[#0A66C2]">{formatVnd(amount)}</dd>
              <dt className="text-slate-500">Nội dung CK</dt>
              <dd className="font-black text-emerald-700">{DEFAULT_TRANSFER_NOTE}</dd>
            </dl>
          </div>

          {data.content && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className={labelCls}>Nội dung đề nghị</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{data.content}</p>
            </div>
          )}
        </div>
      </section>

      {/* BƯỚC 1: SITE NỘP TIỀN */}
      <section className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
        <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white px-4 py-4 sm:px-6">
          <h4 className="text-base font-black text-slate-900">Site nộp tiền & chứng từ</h4>
        </div>
        <div className="space-y-3 p-4 sm:p-6">
          {remittance ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
              <p className="font-black">✓ Site đã nộp {formatVnd(remittance.amount)}</p>
              <p className="mt-1">Mã giao dịch: <b>{remittance.reference}</b> · Thời gian: {fmtDateTime(remittance.paidAt)}</p>
              <p className="mt-0.5">{remittance.proofAttachmentCount} chứng từ đính kèm trong hồ sơ.</p>
            </div>
          ) : siteStep?.status === "approved" ? (
            <p className="text-xs text-slate-500">Bước Site đã được bỏ qua hoặc xác nhận (người lập đồng thời là Trưởng dự án).</p>
          ) : (
            <p className="text-xs text-slate-500">Chưa có xác nhận nộp tiền từ Site.</p>
          )}

          {canSiteAct && siteStep && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
              <p className="text-xs font-black text-violet-900">Xác nhận đã nộp tiền về công ty</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label>
                  <span className={labelCls}>Số tiền đã nộp (đ)</span>
                  <input type="number" min={1} value={remitted} onChange={(e) => setRemitted(e.target.value)} className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Mã giao dịch *</span>
                  <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="FT26345123456" className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Thời gian nộp *</span>
                  <input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={inputCls} />
                </label>
              </div>
              <div className="mt-3">
                <input ref={proofRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx" className="sr-only" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button type="button" onClick={() => proofRef.current?.click()} disabled={uploading} className="rounded-lg border border-dashed border-violet-400 bg-white px-3 py-2.5 text-xs font-bold text-violet-800 hover:bg-violet-50">
                    📎 Chọn chứng từ nộp tiền / biên bản đã ký
                  </button>
                  <button type="button" onClick={() => void uploadProof()} disabled={!proofFile || uploading} className="rounded-lg bg-violet-700 px-3 py-2.5 text-xs font-bold text-white disabled:bg-slate-300">
                    {uploading ? "Đang tải..." : proofFile ? `Tải lên “${proofFile.name}”` : "Chọn tệp trước khi tải"}
                  </button>
                </div>
                <p className="mt-2 text-[11px] font-semibold text-slate-500">Đã tải {siteProofs.length} chứng từ. Có thể tải nhiều tệp (từng tệp một).</p>
              </div>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Ghi chú gửi Kế toán (tùy chọn)..." className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isProcessing || siteProofs.length === 0 || !reference.trim() || !paidAt || !(Number(remitted) > 0)}
                  onClick={() =>
                    onApproveStep(document, siteStep, comment.trim() || "Site đã nộp tiền", {
                      paymentReference: reference.trim(),
                      paymentPaidAt: new Date(paidAt).toISOString(),
                      paymentMethod: "bank_transfer",
                      remittedAmount: Number(remitted),
                    })
                  }
                  className="rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                >
                  {isProcessing ? "Đang xử lý..." : "✓ Xác nhận đã nộp tiền"}
                </button>
                <button type="button" disabled={isProcessing} onClick={() => onOpenModalAction("return", siteStep.id, document.id)} className="rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                  Trả lại kế toán (sai số liệu)
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* BƯỚC 2: KẾ TOÁN XÁC NHẬN */}
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-4 py-4 sm:px-6">
          <h4 className="text-base font-black text-slate-900">Kế toán xác nhận đã thu</h4>
        </div>
        <div className="space-y-3 p-4 sm:p-6">
          {collection ? (
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-xl border border-slate-200 p-3"><p className={labelCls}>Đã nhận</p><p className="mt-1 text-base font-black text-emerald-700">{formatVnd(collection.receivedAmount)}</p></div>
              <div className="rounded-xl border border-slate-200 p-3"><p className={labelCls}>Còn thiếu</p><p className={`mt-1 text-base font-black ${collection.outstandingAmount > 0 ? "text-rose-700" : "text-slate-700"}`}>{formatVnd(collection.outstandingAmount)}</p></div>
              <div className="rounded-xl border border-slate-200 p-3"><p className={labelCls}>Xác nhận bởi</p><p className="mt-1 text-sm font-bold text-slate-800">{accountingStep?.actedBy?.name || "—"}</p></div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Kế toán đối chiếu sao kê ngân hàng với chứng từ site đã gửi rồi xác nhận số tiền thực nhận.</p>
          )}

          {allProofs.length > 0 && !collection && (
            <p className="text-[11px] font-semibold text-slate-500">Chứng từ của Site: xem trong mục “Tệp đính kèm” bên dưới ({allProofs.length} tệp).</p>
          )}

          {canAccountantAct && accountingStep && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  <span className={labelCls}>Số tiền thực nhận (đ) *</span>
                  <input type="number" min={1} max={amount} value={received} onChange={(e) => setReceived(e.target.value)} className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Mã giao dịch / tham chiếu</span>
                  <input value={accRef} onChange={(e) => setAccRef(e.target.value)} placeholder={remittance?.reference || ""} className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>Thời gian nhận</span>
                  <input type="datetime-local" value={accDate} onChange={(e) => setAccDate(e.target.value)} className={inputCls} />
                </label>
              </div>
              {received && !receivedValid && (
                <p className="mt-2 text-[11px] font-semibold text-rose-600">Số tiền thực nhận phải lớn hơn 0 và không vượt quá {formatVnd(amount)}.</p>
              )}
              {receivedValid && outstanding > 0 && (
                <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-[11px] font-bold text-amber-900">
                  Thu một phần: còn thiếu {formatVnd(outstanding)}. Hồ sơ vẫn đóng với trạng thái “Thu một phần”.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isProcessing || !receivedValid}
                  onClick={() =>
                    onApproveStep(document, accountingStep, undefined, {
                      paymentReference: accRef.trim(),
                      paymentPaidAt: new Date(accDate).toISOString(),
                      paymentMethod: "bank_transfer",
                      receivedAmount: receivedNum,
                    })
                  }
                  className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                >
                  {isProcessing ? "Đang xử lý..." : outstanding > 0 ? "✓ Xác nhận thu một phần" : "✓ Xác nhận đã thu đủ"}
                </button>
                {document.createdById !== user?.id && (
                  <button type="button" disabled={isProcessing} onClick={() => onOpenModalAction("return", accountingStep.id, document.id)} className="rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                    Trả lại Site (chưa nhận được tiền)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
