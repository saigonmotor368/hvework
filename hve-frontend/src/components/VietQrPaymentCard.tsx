import React, { useEffect, useMemo, useState } from "react";
import type { DocumentItem } from "../types";
import {
  buildVietQrImageUrl,
  findMatchingVietQrBank,
  type VietQrBank,
} from "../utils/vietQr";

interface VietQrPaymentCardProps {
  document: DocumentItem;
}

export const VietQrPaymentCard: React.FC<VietQrPaymentCardProps> = ({ document }) => {
  const [banks, setBanks] = useState<VietQrBank[]>([]);
  const [selectedBin, setSelectedBin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("https://api.vietqr.io/v2/banks")
      .then(async (response) => {
        if (!response.ok) throw new Error("Không tải được danh sách ngân hàng");
        const payload = await response.json();
        return Array.isArray(payload?.data) ? payload.data : [];
      })
      .then((items: VietQrBank[]) => {
        if (!active) return;
        setBanks(items);
        setSelectedBin(
          findMatchingVietQrBank(document.dataJson?.bankName || "", items)?.bin || "",
        );
      })
      .catch(() => active && setError("Không nhận diện được ngân hàng. Vui lòng thử lại."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [document.dataJson?.bankName]);

  const selectedBank = banks.find((bank) => bank.bin === selectedBin);
  const qrUrl = useMemo(
    () =>
      selectedBank
        ? buildVietQrImageUrl({
            bankBin: selectedBank.bin,
            accountNo: document.dataJson?.bankAccount || "",
            accountName: document.dataJson?.receiver || "",
            amount: Number(document.dataJson?.amount || 0),
            description: document.code,
          })
        : "",
    [document, selectedBank],
  );

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <div className="border-b border-blue-100 px-4 py-3">
        <p className="text-xs font-black text-slate-900">Quét VietQR để thanh toán</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Số tiền và nội dung <b>{document.code}</b> đã được điền sẵn.
        </p>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
        <div className="mx-auto flex h-[220px] w-[220px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {qrUrl ? (
            <img className="h-full w-full object-contain" src={qrUrl} alt={`VietQR ${document.code}`} />
          ) : (
            <p className="px-4 text-center text-xs font-semibold text-slate-500">
              {loading ? "Đang tạo mã QR..." : "Chọn đúng ngân hàng để tạo QR."}
            </p>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ngân hàng thụ hưởng</span>
            <select
              value={selectedBin}
              onChange={(event) => setSelectedBin(event.target.value)}
              disabled={loading}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700"
            >
              <option value="">-- Chọn ngân hàng --</option>
              {banks.map((bank) => (
                <option value={bank.bin} key={bank.bin}>
                  {bank.shortName || bank.code} — {bank.name}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <dl className="grid grid-cols-[95px_1fr] gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-slate-500">Thụ hưởng</dt>
            <dd className="font-bold text-slate-800">{document.dataJson?.receiver || "—"}</dd>
            <dt className="text-slate-500">Số tài khoản</dt>
            <dd className="font-bold text-slate-800">{document.dataJson?.bankAccount || "—"}</dd>
            <dt className="text-slate-500">Số tiền</dt>
            <dd className="font-black text-[#0A66C2]">
              {Number(document.dataJson?.amount || 0).toLocaleString("vi-VN")} ₫
            </dd>
            <dt className="text-slate-500">Nội dung</dt>
            <dd className="font-black text-emerald-700">{document.code}</dd>
          </dl>
          {qrUrl && (
            <a href={qrUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-lg bg-blue-100 px-3 py-2 text-xs font-bold text-[#0A66C2] hover:bg-blue-200">
              Mở QR kích thước lớn ↗
            </a>
          )}
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-800">
            QR không tự xác nhận tiền đã vào. Sau khi chuyển, bắt buộc nhập thông tin giao dịch và tải chứng từ để hoàn tất.
          </p>
        </div>
      </div>
    </div>
  );
};
