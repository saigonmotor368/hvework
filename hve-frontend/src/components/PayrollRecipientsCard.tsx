import React, { useEffect, useMemo, useRef, useState } from "react";
import type { DocumentItem } from "../types";
import {
  authenticatedFileUrl,
  fetchWithSession,
  uploadAttachment,
} from "../api/client";
import { formatVnd, type PayrollItem } from "../utils/documentTypes";
import {
  buildVietQrImageUrl,
  findMatchingVietQrBank,
  type VietQrBank,
} from "../utils/vietQr";

interface Props {
  document: DocumentItem;
  apiBaseUrl: string;
  /** Kế toán đang xử lý bước chi tiền: hiện QR và xác nhận chi từng người. */
  canPay?: boolean;
  /** Người tạo, hồ sơ còn Nháp: được sửa danh sách người nhận. */
  canEdit?: boolean;
  onChanged: () => Promise<void> | void;
  showToast: (message: string, type?: "success" | "error") => void;
}

const nowLocalInput = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

const formatDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString("vi-VN") : "";

const messageOf = async (res: Response, fallback: string) => {
  try {
    const body = await res.json();
    return Array.isArray(body?.message)
      ? body.message.join("; ")
      : body?.message || fallback;
  } catch {
    return fallback;
  }
};

const emptyItem = (): PayrollItem => ({
  employeeCode: "",
  fullName: "",
  position: "",
  netPay: 0,
  bankName: "",
  bankAccount: "",
  note: "",
});

export const PayrollRecipientsCard: React.FC<Props> = ({
  document,
  apiBaseUrl,
  canPay = false,
  canEdit = false,
  onChanged,
  showToast,
}) => {
  const items: Array<PayrollItem & { payment?: any }> =
    (document.dataJson as any)?.payrollItems || [];
  const period: string = (document.dataJson as any)?.period || "";
  const attachments = document.attachments || [];
  const token = () => localStorage.getItem("access_token") || "";

  const [banks, setBanks] = useState<VietQrBank[]>([]);
  const [openQr, setOpenQr] = useState<number | null>(null);
  const [payIndex, setPayIndex] = useState<number | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(nowLocalInput());
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<PayrollItem[] | null>(null);
  const [draftPeriod, setDraftPeriod] = useState(period);
  const [draftFileName, setDraftFileName] = useState<string | undefined>();
  const excelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!canPay) return;
    let active = true;
    fetch("https://api.vietqr.io/v2/banks")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => active && setBanks(Array.isArray(p?.data) ? p.data : []))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [canPay]);

  const total = items.reduce((sum, i) => sum + i.netPay, 0);
  const paidCount = items.filter((i) => i.payment?.paidAt).length;
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q
      ? items.filter((i) =>
          `${i.fullName} ${i.employeeCode} ${i.bankAccount}`.toLowerCase().includes(q),
        )
      : items;
  }, [items, filter]);

  const transferNote = (item: PayrollItem) =>
    `LUONG ${period.replace("/", "")} ${item.employeeCode || ""}`.trim();

  const qrFor = (item: PayrollItem) => {
    const bank = findMatchingVietQrBank(item.bankName, banks);
    return bank
      ? buildVietQrImageUrl({
          bankBin: bank.bin,
          accountNo: item.bankAccount,
          accountName: item.fullName,
          amount: item.netPay,
          description: transferNote(item),
        })
      : "";
  };

  const copy = (text: string) =>
    navigator.clipboard?.writeText(text).catch(() => undefined);

  const attachmentLink = (id?: number) => {
    const att = attachments.find((a) => a.id === id);
    if (!att) return "";
    const t = token();
    return t ? authenticatedFileUrl(apiBaseUrl, att.fileUrl, t) : att.fileUrl;
  };

  const resetPanel = () => {
    setPayIndex(null);
    setProofFile(null);
    setReference("");
    setPaidAt(nowLocalInput());
  };

  const confirmPaid = async (index: number) => {
    if (!proofFile || busy) return;
    setBusy(true);
    try {
      const attachmentId = await uploadAttachment(apiBaseUrl, token(), proofFile, {
        entityType: "document",
        entityId: document.id,
      });
      const res = await fetchWithSession(
        `${apiBaseUrl}/documents/${document.id}/payroll-items/${index}/payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token()}`,
          },
          body: JSON.stringify({
            attachmentId,
            reference: reference.trim() || undefined,
            paidAt: new Date(paidAt).toISOString(),
          }),
        },
      );
      if (!res.ok) throw new Error(await messageOf(res, "Không ghi nhận được khoản chi"));
      showToast(`Đã ghi nhận chi cho ${items[index].fullName}.`);
      resetPanel();
      await onChanged();
    } catch (err: any) {
      showToast(err.message || "Không ghi nhận được khoản chi", "error");
    } finally {
      setBusy(false);
    }
  };

  const undoPaid = async (index: number) => {
    if (busy || !window.confirm(`Hoàn tác xác nhận chi cho ${items[index].fullName}?`)) return;
    setBusy(true);
    try {
      const res = await fetchWithSession(
        `${apiBaseUrl}/documents/${document.id}/payroll-items/${index}/payment`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } },
      );
      if (!res.ok) throw new Error(await messageOf(res, "Không hoàn tác được"));
      await onChanged();
    } catch (err: any) {
      showToast(err.message || "Không hoàn tác được", "error");
    } finally {
      setBusy(false);
    }
  };

  // ---------- Chỉnh sửa danh sách (bản nháp) ----------
  const startEdit = () => {
    setDraft(items.map(({ payment: _payment, ...rest }) => ({ ...rest })));
    setDraftPeriod(period);
    setDraftFileName(undefined);
  };

  const updateDraft = (index: number, patch: Partial<PayrollItem>) =>
    setDraft((cur) => cur && cur.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const reloadFromExcel = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetchWithSession(`${apiBaseUrl}/documents/payroll-requests/parse`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
        body: form,
      });
      if (!res.ok) throw new Error(await messageOf(res, "Không đọc được bảng lương"));
      const data = await res.json();
      setDraft(data.items);
      if (data.period) setDraftPeriod(data.period);
      setDraftFileName(data.fileName);
      showToast(`Đã nạp ${data.items.length} nhân viên từ bảng lương mới. Bấm “Lưu danh sách” để áp dụng.`);
    } catch (err: any) {
      showToast(err.message || "Không đọc được bảng lương", "error");
    } finally {
      setBusy(false);
      if (excelRef.current) excelRef.current.value = "";
    }
  };

  const draftErrors = useMemo(() => {
    if (!draft) return [];
    const errors: string[] = [];
    if (draft.length === 0) errors.push("Danh sách không được để trống");
    draft.forEach((row, i) => {
      const label = row.fullName.trim() || `Dòng ${i + 1}`;
      if (!row.fullName.trim()) errors.push(`${label}: thiếu họ tên`);
      if (!(Number(row.netPay) > 0)) errors.push(`${label}: số tiền phải lớn hơn 0`);
      if (!row.bankName.trim()) errors.push(`${label}: thiếu ngân hàng`);
      if (!/^[0-9A-Za-z]{4,30}$/.test(row.bankAccount.replace(/\s+/g, ""))) {
        errors.push(`${label}: số tài khoản không hợp lệ`);
      }
    });
    if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(draftPeriod)) errors.push("Kỳ lương phải có dạng MM/YYYY");
    return errors;
  }, [draft, draftPeriod]);

  const saveDraft = async () => {
    if (!draft || draftErrors.length > 0 || busy) return;
    setBusy(true);
    try {
      const res = await fetchWithSession(
        `${apiBaseUrl}/documents/${document.id}?version=${document.version}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token()}`,
          },
          body: JSON.stringify({
            payrollItems: draft.map((row) => ({
              ...row,
              netPay: Math.round(Number(row.netPay)),
              bankAccount: row.bankAccount.replace(/\s+/g, ""),
            })),
            period: draftPeriod,
            ...(draftFileName ? { payrollFileName: draftFileName } : {}),
          }),
        },
      );
      if (!res.ok) throw new Error(await messageOf(res, "Không lưu được danh sách"));
      showToast("Đã lưu danh sách nhận lương.");
      setDraft(null);
      await onChanged();
    } catch (err: any) {
      showToast(err.message || "Không lưu được danh sách", "error");
    } finally {
      setBusy(false);
    }
  };

  const cell =
    "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0A66C2]";

  if (draft) {
    const draftTotal = draft.reduce((s, r) => s + (Number(r.netPay) || 0), 0);
    return (
      <section className="mb-3 overflow-hidden rounded-xl border border-amber-300 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3">
          <div>
            <p className="text-xs font-black text-slate-900">Chỉnh sửa danh sách nhận lương · {draft.length} người</p>
            <p className="mt-0.5 text-[11px] text-slate-600">
              Tổng: <b>{formatVnd(draftTotal)}</b>. Sửa trực tiếp, thêm/xóa dòng hoặc nạp lại từ bảng lương Excel mới.
            </p>
          </div>
          <label className="text-[11px] font-bold text-slate-600">
            Kỳ lương{" "}
            <input
              value={draftPeriod}
              onChange={(e) => setDraftPeriod(e.target.value)}
              className="ml-1 w-24 rounded-md border border-slate-200 px-2 py-1 text-xs"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-2 py-2">Mã NV</th>
                <th className="px-2 py-2">Họ và tên</th>
                <th className="px-2 py-2">Ngân hàng</th>
                <th className="px-2 py-2">Số tài khoản</th>
                <th className="px-2 py-2">Thực lãnh (đ)</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {draft.map((row, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5"><input className={cell} value={row.employeeCode} onChange={(e) => updateDraft(i, { employeeCode: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><input className={cell} value={row.fullName} onChange={(e) => updateDraft(i, { fullName: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><input className={cell} value={row.bankName} onChange={(e) => updateDraft(i, { bankName: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><input className={`${cell} font-mono`} value={row.bankAccount} onChange={(e) => updateDraft(i, { bankAccount: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><input className={`${cell} text-right`} type="number" min={0} value={row.netPay || ""} onChange={(e) => updateDraft(i, { netPay: Number(e.target.value) })} /></td>
                  <td className="px-2 py-1.5 text-center">
                    <button type="button" aria-label={`Xóa ${row.fullName || "dòng"}`} onClick={() => setDraft(draft.filter((_, j) => j !== i))} className="h-7 w-7 rounded-full text-lg font-bold text-slate-400 hover:bg-rose-50 hover:text-rose-600">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {draftErrors.length > 0 && (
          <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-[11px] font-semibold text-rose-700">
            {draftErrors.slice(0, 4).map((e) => <p key={e}>• {e}</p>)}
            {draftErrors.length > 4 && <p>… và {draftErrors.length - 4} lỗi khác</p>}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setDraft([...draft, emptyItem()])} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">+ Thêm nhân viên</button>
            <input ref={excelRef} type="file" accept=".xlsx" className="sr-only" onChange={(e) => void reloadFromExcel(e.target.files?.[0] || null)} />
            <button type="button" disabled={busy} onClick={() => excelRef.current?.click()} className="rounded-lg bg-blue-100 px-3 py-2 text-xs font-bold text-[#0A66C2] hover:bg-blue-200">📥 Nạp lại từ Excel</button>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => setDraft(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Hủy</button>
            <button type="button" disabled={busy || draftErrors.length > 0} onClick={() => void saveDraft()} className="rounded-lg bg-[#0A66C2] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? "Đang lưu…" : "Lưu danh sách"}</button>
          </div>
        </div>
      </section>
    );
  }

  const colSpan = canPay ? 7 : 6;
  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-blue-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-blue-50/60 px-4 py-3">
        <div>
          <p className="text-xs font-black text-slate-900">
            Danh sách nhận lương kỳ {period || "—"} · {items.length} người
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Tổng thực lãnh: <b className="text-[#0A66C2]">{formatVnd(total)}</b>
            {(canPay || paidCount > 0) && (
              <>
                {" · "}
                Đã chi: <b className={paidCount === items.length ? "text-emerald-700" : "text-amber-700"}>{paidCount}/{items.length}</b>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {items.length > 8 && (
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Tìm tên / mã / STK"
              className="w-40 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
            />
          )}
          {canEdit && (
            <button type="button" onClick={startEdit} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-200">
              ✏️ Chỉnh sửa danh sách
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2">STT</th>
              <th className="px-3 py-2">Họ và tên</th>
              <th className="px-3 py-2">Ngân hàng</th>
              <th className="px-3 py-2">Số tài khoản</th>
              <th className="px-3 py-2 text-right">Thực lãnh</th>
              <th className="px-3 py-2">Chi tiền</th>
              {canPay && <th className="px-3 py-2 text-center">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((item) => {
              const index = items.indexOf(item);
              const url = canPay && openQr === index ? qrFor(item) : "";
              const link = attachmentLink(item.payment?.attachmentId);
              return (
                <React.Fragment key={`${item.employeeCode}-${index}`}>
                  <tr className={item.payment?.paidAt ? "bg-emerald-50/40" : ""}>
                    <td className="px-3 py-2 text-slate-400">{index + 1}</td>
                    <td className="px-3 py-2">
                      <p className="font-bold text-slate-800">{item.fullName}</p>
                      <p className="text-[10px] text-slate-400">{[item.employeeCode, item.position].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{item.bankName}</td>
                    <td className="px-3 py-2">
                      <button type="button" title="Bấm để sao chép" onClick={() => copy(item.bankAccount)} className="font-mono font-semibold text-slate-800 hover:text-[#0A66C2]">
                        {item.bankAccount}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right font-black text-slate-900">{formatVnd(item.netPay)}</td>
                    <td className="px-3 py-2">
                      {item.payment?.paidAt ? (
                        <div className="text-[11px]">
                          <p className="font-bold text-emerald-700">✓ Đã chi</p>
                          <p className="text-slate-500">
                            {formatDateTime(item.payment.paidAt)}
                            {item.payment.reference ? ` · ${item.payment.reference}` : ""}
                          </p>
                          {link && (
                            <a href={link} target="_blank" rel="noreferrer" className="font-bold text-[#0A66C2] hover:underline">
                              📎 Chứng từ ↗
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Chưa chi</span>
                      )}
                    </td>
                    {canPay && (
                      <td className="px-3 py-2 text-center">
                        {item.payment?.paidAt ? (
                          <button type="button" disabled={busy} onClick={() => void undoPaid(index)} className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50">
                            Hoàn tác
                          </button>
                        ) : (
                          <div className="flex justify-center gap-1.5">
                            <button type="button" onClick={() => setOpenQr(openQr === index ? null : index)} className="rounded-lg bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-[#0A66C2] hover:bg-blue-200">
                              {openQr === index ? "Ẩn QR" : "QR"}
                            </button>
                            <button type="button" onClick={() => (payIndex === index ? resetPanel() : (resetPanel(), setPayIndex(index)))} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700">
                              Xác nhận chi
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                  {canPay && openQr === index && !item.payment?.paidAt && (
                    <tr>
                      <td colSpan={colSpan} className="bg-slate-50 px-3 py-3">
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex h-44 w-44 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5">
                            {url ? (
                              <img src={url} alt={`VietQR ${item.fullName}`} className="h-full w-full object-contain" />
                            ) : (
                              <p className="px-3 text-center text-[11px] font-semibold text-slate-500">
                                {banks.length ? `Không nhận diện được ngân hàng “${item.bankName}”.` : "Đang tạo mã QR..."}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-slate-600">
                            <p><b>{item.fullName}</b> — {formatVnd(item.netPay)}</p>
                            <p className="mt-1">Nội dung CK: <b>{transferNote(item)}</b></p>
                            {url && (
                              <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-[#0A66C2]">Mở QR lớn ↗</a>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {canPay && payIndex === index && (
                    <tr>
                      <td colSpan={colSpan} className="bg-emerald-50/60 px-3 py-3">
                        <p className="mb-2 text-xs font-bold text-emerald-800">
                          Xác nhận đã chuyển {formatVnd(item.netPay)} cho {item.fullName}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Mã giao dịch (nếu có)
                            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="FT26345123456" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold normal-case tracking-normal text-slate-700" />
                          </label>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Thời gian chuyển
                            <input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold normal-case tracking-normal text-slate-700" />
                          </label>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Chứng từ chuyển khoản *
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-xs normal-case tracking-normal file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-2.5 file:py-2 file:text-xs file:font-bold file:text-emerald-800" />
                          </label>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button type="button" disabled={!proofFile || !paidAt || busy} onClick={() => void confirmPaid(index)} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                            {busy ? "Đang tải lên…" : "Tải chứng từ & xác nhận"}
                          </button>
                          <button type="button" disabled={busy} onClick={resetPanel} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Đóng</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-black text-slate-900">
              <td colSpan={4} className="px-3 py-2 text-right text-[11px] uppercase tracking-wider">Tổng cộng</td>
              <td className="px-3 py-2 text-right">{formatVnd(total)}</td>
              <td colSpan={canPay ? 2 : 1} />
            </tr>
          </tfoot>
        </table>
      </div>
      {canPay && (
        <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-[11px] font-semibold leading-relaxed text-amber-800">
          Chuyển khoản từng người (quét QR hoặc sao chép số tài khoản), rồi bấm “Xác nhận chi” và tải ảnh/PDF chứng từ của chính người đó.
          Chỉ hoàn tất được hồ sơ khi tất cả nhân viên đã có chứng từ.
        </p>
      )}
    </section>
  );
};
