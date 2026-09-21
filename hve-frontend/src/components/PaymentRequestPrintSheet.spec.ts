import { describe, expect, it } from "vitest";
import { amountToVietnameseWords } from "../utils/paymentPrint";

describe("amountToVietnameseWords", () => {
  it.each([
    [0, "Không đồng"],
    [15, "Mười lăm đồng"],
    [1_500_000, "Một triệu năm trăm nghìn đồng"],
    [1_005_000, "Một triệu không trăm lẻ năm nghìn đồng"],
    [12_345_678, "Mười hai triệu ba trăm bốn mươi lăm nghìn sáu trăm bảy mươi tám đồng"],
  ])("reads %s VND", (amount, expected) => {
    expect(amountToVietnameseWords(amount)).toBe(expected);
  });
});
