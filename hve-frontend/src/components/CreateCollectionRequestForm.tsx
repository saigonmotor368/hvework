import React, { useEffect, useMemo, useState } from "react";
import type { CompanyAccount, ProjectItem } from "../types";
import { fetchWithSession, uploadAttachment } from "../api/client";
import { normalizePeriod } from "../utils/documentTypes";

interface Props {
  apiBaseUrl: string;
  projects: ProjectItem[];
  onCancel: () => void;
  onCreated: (documentId: number, submitted: boolean) => void | Promise<void>;
  showToast: (message: string, type?: "success" | "error") => void;
}

const messageOf = async (res: Response, fallback: string) => {
  try {
    const body = await res.json();
    return Array.isArray(body?.message) ? body.message.join("; ") : body?.message || fallback;
  } catch {
    return fallback;
  }
};

const currentPeriod = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1); // kỳ kết quả kinh doanh thường là tháng trước
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export const CreateCollectionRequestForm: React.FC<Props> = ({
  apiBaseUrl,
  projects,
  onCancel,
  onCreated,
  showToast,
}) => {
  const [accounts, setAccounts] = useState<CompanyAccount[]>([]);
  const [projectId, setProjectId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const token = () => localStorage.getItem("access_token") || "";
  const activeProjects = useMemo(() => projects.filter((p) => p.isActive), [projects]);
  const project = activeProjects.find((p) => String(p.id) === projectId);

  useEffect(() => {
    fetchWithSession(`${apiBaseUrl}/company-accounts`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: CompanyAccount[]) => {
        setAccounts(list);
        if (list.length === 1) setAccountId(String(list[0].id));
      })
      .catch(() => showToast("Không tải được danh sách tài khoản công ty", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl]);

  // Tự gợi ý tiêu đề theo site + kỳ cho tới khi người dùng tự sửa.
  useEffect(() => {
    if (titleTouched) return;
    const p = normalizePeriod(period);
    setTitle(project && p ? `Đề nghị thu kết quả kinh doanh tháng ${p} — ${project.name}` : "");
  }, [project, period, titleTouched]);

  const amountNum = Number(amount);
  const missing = [
    !projectId && "chọn site",
    !normalizePeriod(period) && "nhập kỳ (MM/YYYY)",
    !(amountNum > 0) && "nhập số tiền cần thu",
    !accountId && "chọn tài khoản nhận",
    !deadline && "chọn hạn nộp",
    files.length === 0 && "đính kèm biên bản đối soát",
    !title.trim() && "nhập tiêu đề",
  ].filter(Boolean) as string[];

  const submit = async (submitNow: boolean) => {
    if (missing.length > 0 || saving) return;
    setSaving(true);
    try {
      const attachmentIds: number[] = [];
      for (const file of files) {
        attachmentIds.push(await uploadAttachment(apiBaseUrl, token(), file));
      }
      const res = await fetchWithSession(`${apiBaseUrl}/documents/collection-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          title: title.trim(),
          projectId: Number(projectId),
          period: normalizePeriod(period),
          amount: Math.round(amountNum),
          bankAccountId: Number(accountId),
          deadline,
          content: content.trim() || undefined,
          attachmentIds,
        }),
      });
      if (!res.ok) throw new Error(await messageOf(res, "Tạo đề nghị thu thất bại"));
      const doc = await res.json();
      if (submitNow) {
        const sub = await fetchWithSession(`${apiBaseUrl}/documents/${doc.id}/submit`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (!sub.ok) throw new Error(await messageOf(sub, "Gửi đề nghị thất bại"));
      }
      showToast(submitNow ? "Đã gửi đề nghị thu cho site!" : "Đã lưu bản nháp đề nghị thu!");
      await onCreated(doc.id, submitNow);
    } catch (err: any) {
      showToast(err.message || "Thao tác thất bại", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white";
  const labelCls = "block text-xs font-bold text-gray-700 uppercase tracking-wider";

  return (
    <div className="w-full space-y-5">
      <p className="text-xs text-gray-500">
        Kế toán yêu cầu site nộp kết quả kinh doanh về công ty. Quy trình: Kế toán lập → Trưởng dự án (site) nộp tiền và tải chứng từ → Kế toán xác nhận đã thu. Không qua CEO.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className={labelCls} htmlFor="col-project">Site (dự án) cần nộp tiền *</label>
          <select id="col-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
            <option value="">-- Chọn site --</option>
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
                {p.leadUserId ? (p.lead ? ` (TDA: ${p.lead.name})` : "") : " (chưa có Trưởng dự án)"}
              </option>
            ))}
          </select>
          {project && !project.leadUserId && (
            <p className="mt-1 text-[11px] font-semibold text-amber-700">
              Site này chưa có Trưởng dự án nên bước nộp tiền sẽ tự bỏ qua. Hãy gán Trưởng dự án trước.
            </p>
          )}
        </div>
        <div>
          <label className={labelCls} htmlFor="col-period">Kỳ (MM/YYYY) *</label>
          <input id="col-period" value={period} onChange={(e) => setPeriod(e.target.value)} onBlur={() => setPeriod((c) => normalizePeriod(c) || c)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="col-amount">Số tiền cần thu (đ) *</label>
          <input id="col-amount" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          {amountNum > 0 && <p className="mt-1 text-[11px] font-bold text-[#0A66C2]">{Math.round(amountNum).toLocaleString("vi-VN")} ₫</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="col-account">Tài khoản nhận về *</label>
          <select id="col-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
            <option value="">-- Chọn tài khoản --</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.bankName} — {a.accountNumber} ({a.accountName})
              </option>
            ))}
          </select>
          {accounts.length === 0 && (
            <p className="mt-1 text-[11px] font-semibold text-rose-600">Chưa có tài khoản nào. Vào “Tài khoản công ty” để thêm.</p>
          )}
        </div>
        <div>
          <label className={labelCls} htmlFor="col-deadline">Hạn nộp *</label>
          <input id="col-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="col-files">Biên bản đối soát đính kèm *</label>
        <input
          id="col-files"
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.docx"
          disabled={saving}
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          className="mt-1.5 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#0A66C2]"
        />
        {files.length > 0 && <p className="mt-1 text-[11px] text-slate-500">{files.map((f) => f.name).join(", ")}</p>}
      </div>

      <div>
        <label className={labelCls} htmlFor="col-title">Tiêu đề *</label>
        <input id="col-title" value={title} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="col-content">Ghi chú gửi site</label>
        <textarea id="col-content" rows={3} value={content} onChange={(e) => setContent(e.target.value)} className={inputCls} />
      </div>

      {missing.length > 0 && (
        <p className="text-right text-[11px] font-semibold text-amber-700">Cần: {missing.join(" · ")}</p>
      )}
      <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-6 sm:flex sm:items-center sm:justify-end sm:gap-3">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Hủy</button>
        <button type="button" disabled={missing.length > 0 || saving} onClick={() => void submit(false)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">Lưu nháp</button>
        <button type="button" disabled={missing.length > 0 || saving} onClick={() => void submit(true)} className="rounded-xl bg-[#0A66C2] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#004182] disabled:opacity-50">
          {saving ? "Đang xử lý…" : "Gửi đề nghị cho site"}
        </button>
      </div>
    </div>
  );
};
