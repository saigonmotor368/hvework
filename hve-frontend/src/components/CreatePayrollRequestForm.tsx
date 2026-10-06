import React, { useMemo, useState } from "react";
import type { ProjectItem } from "../types";
import { fetchWithSession, uploadAttachment } from "../api/client";
import { formatVnd, normalizePeriod, type PayrollItem } from "../utils/documentTypes";

interface ParsedPayroll {
  sheetName: string;
  period: string;
  fileName: string;
  items: PayrollItem[];
  totalNetPay: number;
  warnings: string[];
  itemErrors: string[];
}

interface Props {
  apiBaseUrl: string;
  projects: ProjectItem[];
  currentUser: any;
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

export const CreatePayrollRequestForm: React.FC<Props> = ({
  apiBaseUrl,
  projects,
  currentUser,
  onCancel,
  onCreated,
  showToast,
}) => {
  const roles: string[] = (currentUser?.roles || []).map((r: any) => (typeof r === "string" ? r : r.name));
  const canPickAnyProject = roles.some((r) => ["hr", "it_admin"].includes(r));
  const selectableProjects = useMemo(
    () =>
      projects.filter(
        (p) => p.isActive && (canPickAnyProject || p.leadUserId === currentUser?.id),
      ),
    [projects, canPickAnyProject, currentUser?.id],
  );

  const [projectId, setProjectId] = useState<string>(
    selectableProjects.length === 1 ? String(selectableProjects[0].id) : "",
  );
  const [period, setPeriod] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedPayroll | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const token = () => localStorage.getItem("access_token") || "";
  const project = selectableProjects.find((p) => String(p.id) === projectId);

  const handleFile = async (selected: File | null) => {
    setFile(selected);
    setParsed(null);
    if (!selected) return;
    setParsing(true);
    try {
      const form = new FormData();
      form.append("file", selected);
      const res = await fetchWithSession(`${apiBaseUrl}/documents/payroll-requests/parse`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
        body: form,
      });
      if (!res.ok) throw new Error(await messageOf(res, "Không đọc được bảng lương"));
      const data: ParsedPayroll = await res.json();
      setParsed(data);
      const nextPeriod = period || data.period;
      setPeriod(nextPeriod);
      if (!title && nextPeriod) {
        setTitle(`Đề nghị chi lương tháng ${nextPeriod}${project ? ` — ${project.name}` : ""}`);
      }
    } catch (err: any) {
      setFile(null);
      showToast(err.message || "Không đọc được bảng lương", "error");
    } finally {
      setParsing(false);
    }
  };

  const canSave =
    Boolean(projectId && normalizePeriod(period) && title.trim() && file && parsed) &&
    parsed!.itemErrors.length === 0;

  const submit = async (submitNow: boolean) => {
    if (!canSave || !file || !parsed || saving) return;
    setSaving(true);
    try {
      // Tệp bảng lương gốc được đính kèm làm chứng từ của hồ sơ.
      const attachmentId = await uploadAttachment(apiBaseUrl, token(), file);
      const res = await fetchWithSession(`${apiBaseUrl}/documents/payroll-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          title: title.trim(),
          projectId: Number(projectId),
          period: normalizePeriod(period),
          content: content.trim() || undefined,
          fileName: parsed.fileName,
          items: parsed.items,
          attachmentIds: [attachmentId],
        }),
      });
      if (!res.ok) throw new Error(await messageOf(res, "Tạo đề nghị chi lương thất bại"));
      const doc = await res.json();
      if (submitNow) {
        const submitRes = await fetchWithSession(`${apiBaseUrl}/documents/${doc.id}/submit`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (!submitRes.ok) throw new Error(await messageOf(submitRes, "Gửi duyệt thất bại"));
      }
      showToast(submitNow ? "Đã gửi đề nghị chi lương cho Nhân sự duyệt!" : "Đã lưu bản nháp đề nghị chi lương!");
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
    <div className="w-full">
      <div className="mb-6 pb-6 border-b border-slate-100">
        <h3 className="text-xl font-bold text-gray-900">Đề nghị chi lương nhân viên Site</h3>
        <p className="text-xs text-gray-500 mt-1">
          Quy trình: Trưởng dự án đề nghị → Nhân sự → CEO → Kế toán chi. Tải bảng lương Excel lên, hệ thống tự đọc
          danh sách nhân viên, số tài khoản và số tiền thực lãnh — không cần nhập tay từng người.
        </p>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="payroll-project">
              Dự án (Site) đề nghị <span className="text-red-500">*</span>
            </label>
            <select
              id="payroll-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={inputCls}
            >
              <option value="">-- Chọn dự án --</option>
              {selectableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
            {selectableProjects.length === 0 && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">
                Bạn chưa phụ trách dự án nào. Chỉ Trưởng dự án mới lập được đề nghị chi lương.
              </p>
            )}
          </div>
          <div>
            <label className={labelCls} htmlFor="payroll-period">
              Kỳ lương (MM/YYYY) <span className="text-red-500">*</span>
            </label>
            <input
              id="payroll-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              onBlur={() => setPeriod((cur) => normalizePeriod(cur) || cur)}
              placeholder="09/2026"
              className={inputCls}
            />
            {period && !normalizePeriod(period) && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">Nhập kỳ lương dạng tháng/năm, ví dụ 09/2026</p>
            )}
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="payroll-file">
            Bảng lương đính kèm (.xlsx) <span className="text-red-500">*</span>
          </label>
          <input
            id="payroll-file"
            type="file"
            accept=".xlsx"
            disabled={parsing || saving}
            onChange={(e) => void handleFile(e.target.files?.[0] || null)}
            className="mt-1.5 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#0A66C2]"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Bảng cần có các cột “Họ và tên”, “THỰC LÃNH”, “Số tài khoản”, “Ngân hàng”. Hệ thống tự tìm sheet “Lương …”.
          </p>
          {parsing && <p className="mt-2 text-xs font-semibold text-slate-500">Đang đọc bảng lương…</p>}
        </div>

        {parsed && (
          <div className="rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold text-slate-800">
                Đọc từ sheet “{parsed.sheetName}”: {parsed.items.length} nhân viên
              </p>
              <p className="text-xs font-black text-[#0A66C2]">Tổng thực lãnh: {formatVnd(parsed.totalNetPay)}</p>
            </div>
            {parsed.itemErrors.length > 0 && (
              <div className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                <p>Bảng lương còn thiếu thông tin, vui lòng bổ sung trong Excel rồi tải lại:</p>
                <ul className="mt-1 list-disc pl-5">
                  {parsed.itemErrors.slice(0, 8).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {parsed.warnings.length > 0 && (
              <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[11px] font-semibold text-amber-800">
                {parsed.warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            )}
            <div className="max-h-72 overflow-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="sticky top-0 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">STT</th>
                    <th className="px-3 py-2">Họ và tên</th>
                    <th className="px-3 py-2">Ngân hàng</th>
                    <th className="px-3 py-2">Số tài khoản</th>
                    <th className="px-3 py-2 text-right">Thực lãnh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsed.items.map((item, i) => (
                    <tr key={`${item.employeeCode}-${i}`}>
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 font-bold text-slate-800">{item.fullName}</td>
                      <td className="px-3 py-2">{item.bankName || <span className="text-rose-600">Thiếu</span>}</td>
                      <td className="px-3 py-2 font-mono">
                        {item.bankAccount || <span className="text-rose-600">Thiếu</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-black">{formatVnd(item.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <label className={labelCls} htmlFor="payroll-title">
            Tiêu đề đề nghị <span className="text-red-500">*</span>
          </label>
          <input id="payroll-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="payroll-content">
            Ghi chú gửi Nhân sự / CEO
          </label>
          <textarea
            id="payroll-content"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={inputCls}
          />
        </div>

        {!canSave && (
          <p className="text-right text-[11px] font-semibold text-amber-700">
            {[
              !projectId && "chọn dự án",
              !normalizePeriod(period) && "nhập kỳ lương (MM/YYYY)",
              !file && "tải bảng lương Excel",
              file && parsed && parsed.itemErrors.length > 0 && "bổ sung thông tin còn thiếu trong bảng lương",
              !title.trim() && "nhập tiêu đề",
            ]
              .filter(Boolean)
              .reduce<string[]>((acc, cur) => [...acc, cur as string], [])
              .join(" · ")
              .replace(/^/, "Cần: ")}
          </p>
        )}
        <div className="grid grid-cols-1 sm:flex sm:items-center sm:justify-end gap-2 sm:gap-3 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => void submit(false)}
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            Lưu nháp
          </button>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={() => void submit(true)}
            className="rounded-xl bg-[#0A66C2] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#004182] disabled:opacity-50"
          >
            {saving ? "Đang xử lý…" : "Gửi Nhân sự duyệt"}
          </button>
        </div>
      </div>
    </div>
  );
};
