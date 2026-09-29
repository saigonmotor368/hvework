import { describe, expect, it } from "vitest";
import {
  buildVietQrImageUrl,
  findMatchingVietQrBank,
  getPaymentReference,
  normalizeBankName,
  type VietQrBank,
} from "./vietQr";

const banks: VietQrBank[] = [
  { name: "Ngân hàng TMCP Ngoại Thương Việt Nam", code: "VCB", bin: "970436", shortName: "Vietcombank" },
  { name: "Ngân hàng TMCP Quân đội", code: "MB", bin: "970422", shortName: "MBBank" },
];

describe("VietQR helpers", () => {
  it("keeps only the final numeric part of a payment request code", () => {
    expect(getPaymentReference("DNTT-2026-011")).toBe("011");
    expect(getPaymentReference("011")).toBe("011");
  });

  it("falls back to the original code when it has no numeric suffix", () => {
    expect(getPaymentReference("DNTT-DRAFT")).toBe("DNTT-DRAFT");
  });

  it("normalizes Vietnamese bank names", () => {
    expect(normalizeBankName("Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)"))
      .toContain("vietcom");
  });

  it("matches a free-text bank name to the official bank BIN", () => {
    expect(findMatchingVietQrBank("Ngân hàng Quân Đội (MB Bank)", banks)?.bin)
      .toBe("970422");
  });

  it("builds a QR URL with amount and the short payment reference", () => {
    const url = buildVietQrImageUrl({
      bankBin: "970436",
      accountNo: "0071001234567",
      accountName: "CONG TY HVE",
      amount: 1_500_000,
      description: getPaymentReference("DNTT-2026-001"),
    });
    expect(url).toContain("970436-0071001234567-compact2.png");
    expect(url).toContain("amount=1500000");
    expect(url).toContain("addInfo=001");
  });
});
