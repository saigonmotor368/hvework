import { describe, expect, it } from "vitest";
import { detectPreviewKind } from "./FilePreviewModal";

describe("detectPreviewKind", () => {
  it("nhận diện ảnh, PDF và Word theo MIME hoặc đuôi tệp", () => {
    expect(detectPreviewKind({ fileName: "a.png", mimeType: "image/png" })).toBe("image");
    expect(detectPreviewKind({ fileName: "scan.JPG" })).toBe("image");
    expect(detectPreviewKind({ fileName: "hd.pdf", mimeType: "application/octet-stream" })).toBe("pdf");
    expect(
      detectPreviewKind({
        fileName: "bien-ban.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe("docx");
  });

  it("các định dạng còn lại chỉ cho tải về", () => {
    expect(detectPreviewKind({ fileName: "bang-luong.xlsx" })).toBe("unsupported");
    expect(detectPreviewKind({ fileName: "cu.doc", mimeType: "application/msword" })).toBe("unsupported");
  });
});
