import React, { useCallback, useEffect, useState } from "react";
import { fetchWithSession } from "../api/client";
import type { CompanyAccount } from "../types";

interface Props {
  apiBaseUrl: string;
  showToast: (message: string, type?: "success" | "error") => void;
}

const empty = { bankName: "", accountNumber: "", accountName: "", note: "" };

export const AdminCompanyAccountsView: React.FC<Props> = ({ apiBaseUrl, showToast }) => {
  const [accounts, setAccounts] = useState<CompanyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [bankNames, setBankNames] = useState<string[]>([]);

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithSession(`${apiBaseUrl}/company-accounts?all=true`, { headers: headers() });
      if (!res.ok) throw new Error("Không tải được danh sách tài khoản");
      setAccounts(await res.json());
    } catch (err: any) {
      showToast(err.message || "Không tải được danh sách tài khoản", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  // Gợi ý tên ngân hàng chuẩn để QR nhận diện đúng ngân hàng.
  useEffect(() => {
    let active = true;
    fetch("https://api.vietqr.io/v2/banks")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => active && setBankNames(Array.isArray(p?.data) ? p.data.map((b: any) => b.shortName).filter(Boolean) : []))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const messageOf = async (res: Response, fallback: string) => {
    try {
      const body = await res.json();
      return Array.isArray(body?.message) ? body.message.join("; ") : body?.message || fallback;
    } catch {
      return fallback;
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        bankName: form.bankName.trim(),
        accountNumber: form.accountNumber.replace(/\s+/g, ""),
        accountName: form.accountName.trim(),
        note: form.note.trim(),
      };
      const res = await fetchWithSession(
        editingId ? `${apiBaseUrl}/company-accounts/${editingId}` : `${apiBaseUrl}/company-accounts`,
        { method: editingId ? "PUT" : "POST", headers: headers(), body: JSON.stringify(payload) },
      );
      if (!res.ok) throw new Error(await messageOf(res, "Không lưu được tài khoản"));
      showToast(editingId ? "Đã cập nhật tài khoản." : "Đã thêm tài khoản nhận tiền.");
      setForm(empty);
      setEditingId(null);
      await load();
    } catch (err: any) {
      showToast(err.message || "Không lưu được tài khoản", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (account: CompanyAccount) => {
    try {
      const res = await fetchWithSession(`${apiBaseUrl}/company-accounts/${account.id}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ isActive: !account.isActive }),
      });
      if (!res.ok) throw new Error(await messageOf(res, "Không cập nhật được trạng thái"));
      await load();
    } catch (err: any) {
      showToast(err.message || "Không cập nhật được trạng thái", "error");
    }
  };

  const inputCls =
    "mt-1.5 block w-full rounded-xl border border-gray-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white";
  const labelCls = "block text-xs font-bold uppercase tracking-wider text-gray-700";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div>
        <h3 className="text-xl font-bold text-gray-900">Tài khoản nhận tiền của công ty</h3>
        <p className="mt-1 text-xs text-gray-500">
          Danh sách tài khoản để các site nộp tiền về trong Đề nghị thu. Khi lập đề nghị, kế toán chọn một tài khoản ở đây; hệ thống tự tạo QR kèm số tiền.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm font-bold text-gray-900">{editingId ? "Sửa tài khoản" : "Thêm tài khoản mới"}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="acc-bank">Ngân hàng *</label>
            <input id="acc-bank" list="bank-suggestions" required value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="VD: Vietcombank" className={inputCls} />
            <datalist id="bank-suggestions">
              {bankNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelCls} htmlFor="acc-number">Số tài khoản *</label>
            <input id="acc-number" required value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className={labelCls} htmlFor="acc-name">Tên chủ tài khoản *</label>
            <input id="acc-name" required value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} placeholder="CÔNG TY TNHH ..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="acc-note">Ghi chú</label>
            <input id="acc-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="VD: Tài khoản thu tiền các site" className={inputCls} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(empty); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600">
              Hủy sửa
            </button>
          )}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#0A66C2] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">
            {saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "+ Thêm tài khoản"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Ngân hàng</th>
                <th className="px-4 py-3">Số tài khoản</th>
                <th className="px-4 py-3">Chủ tài khoản</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((a) => (
                <tr key={a.id} className={a.isActive ? "" : "opacity-50"}>
                  <td className="px-4 py-3 font-bold text-slate-800">{a.bankName}{a.note && <p className="text-[10px] font-normal text-slate-400">{a.note}</p>}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{a.accountNumber}</td>
                  <td className="px-4 py-3">{a.accountName}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${a.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {a.isActive ? "Đang dùng" : "Ngừng dùng"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => { setEditingId(a.id); setForm({ bankName: a.bankName, accountNumber: a.accountNumber, accountName: a.accountName, note: a.note || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="mr-2 font-bold text-[#0A66C2] hover:underline">Sửa</button>
                    <button type="button" onClick={() => void toggleActive(a)} className="font-bold text-slate-500 hover:text-rose-600">{a.isActive ? "Ngừng dùng" : "Dùng lại"}</button>
                  </td>
                </tr>
              ))}
              {!loading && accounts.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chưa có tài khoản nào. Thêm tài khoản đầu tiên ở form phía trên.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Đang tải...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
