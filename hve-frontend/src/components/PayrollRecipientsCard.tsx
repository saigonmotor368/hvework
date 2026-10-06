import React, { useEffect, useMemo, useState } from "react";
import type { DocumentItem } from "../types";
import { formatVnd, type PayrollItem } from "../utils/documentTypes";
import {
  buildVietQrImageUrl,
  findMatchingVietQrBank,
  type VietQrBank,
} from "../utils/vietQr";

interface Props {
  document: DocumentItem;
  /** Hiện QR từng người (dành cho Kế toán khi đến bước chi tiền). */
  showQr?: boolean;
}

export const PayrollRecipientsCard: React.FC<Props> = ({ document, showQr = false }) => {
  const items: PayrollItem[] = (document.dataJson as any)?.payrollItems || [];
  const period: string = (document.dataJson as any)?.period || "";
  const [banks, setBanks] = useState<VietQrBank[]>([]);
  const [openQr, setOpenQr] = useState<number | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!showQr) return;
    let active = true;
    fetch("https://api.vietqr.io/v2/banks")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => active && setBanks(Array.isArray(p?.data) ? p.data : []))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [showQr]);

  const total = items.reduce((sum, i) => sum + i.netPay, 0);
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

  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => undefined);

  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-blue-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-blue-50/60 px-4 py-3">
        <div>
          <p className="text-xs font-black text-slate-900">
            Danh sách nhận lương kỳ {period || "—"} · {items.length} người
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Tổng thực lãnh: <b className="text-[#0A66C2]">{formatVnd(total)}</b>
            {showQr && " · Bấm “QR” để lấy mã chuyển khoản từng người (đã điền sẵn số tiền)."}
          </p>
        </div>
        {items.length > 8 && (
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Tìm tên / mã / STK"
            className="w-44 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
          />
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2">STT</th>
              <th className="px-3 py-2">Họ và tên</th>
              <th className="px-3 py-2">Ngân hàng</th>
              <th className="px-3 py-2">Số tài khoản</th>
              <th className="px-3 py-2 text-right">Thực lãnh</th>
              {showQr && <th className="px-3 py-2 text-center">QR</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((item) => {
              const index = items.indexOf(item);
              const url = showQr && openQr === index ? qrFor(item) : "";
              return (
                <React.Fragment key={`${item.employeeCode}-${index}`}>
                  <tr>
                    <td className="px-3 py-2 text-slate-400">{index + 1}</td>
                    <td className="px-3 py-2">
                      <p className="font-bold text-slate-800">{item.fullName}</p>
                      <p className="text-[10px] text-slate-400">
                        {[item.employeeCode, item.position].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{item.bankName}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        title="Bấm để sao chép"
                        onClick={() => copy(item.bankAccount)}
                        className="font-mono font-semibold text-slate-800 hover:text-[#0A66C2]"
                      >
                        {item.bankAccount}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right font-black text-slate-900">
                      {formatVnd(item.netPay)}
                    </td>
                    {showQr && (
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setOpenQr(openQr === index ? null : index)}
                          className="rounded-lg bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-[#0A66C2] hover:bg-blue-200"
                        >
                          {openQr === index ? "Ẩn" : "QR"}
                        </button>
                      </td>
                    )}
                  </tr>
                  {showQr && openQr === index && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 px-3 py-3">
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex h-44 w-44 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5">
                            {url ? (
                              <img
                                src={url}
                                alt={`VietQR ${item.fullName}`}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <p className="px-3 text-center text-[11px] font-semibold text-slate-500">
                                {banks.length
                                  ? `Không nhận diện được ngân hàng “${item.bankName}”.`
                                  : "Đang tạo mã QR..."}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-slate-600">
                            <p>
                              <b>{item.fullName}</b> — {formatVnd(item.netPay)}
                            </p>
                            <p className="mt-1">
                              Nội dung CK: <b>{transferNote(item)}</b>
                            </p>
                            {url && (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-block font-bold text-[#0A66C2]"
                              >
                                Mở QR lớn ↗
                              </a>
                            )}
                          </div>
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
              <td colSpan={4} className="px-3 py-2 text-right text-[11px] uppercase tracking-wider">
                Tổng cộng
              </td>
              <td className="px-3 py-2 text-right">{formatVnd(total)}</td>
              {showQr && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
      {showQr && (
        <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-[11px] font-semibold leading-relaxed text-amber-800">
          Có thể chuyển lần lượt từng người hoặc chuyển khoản hàng loạt qua ngân hàng điện tử. Sau khi chi
          xong, nhập mã giao dịch (hoặc mã lô) và tải sao kê / chứng từ chuyển khoản bên dưới để hoàn tất.
        </p>
      )}
    </section>
  );
};
