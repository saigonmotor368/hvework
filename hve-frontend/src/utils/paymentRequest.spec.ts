import { describe, expect, it } from "vitest";
import type { ApprovalStep, DocumentItem } from "../types";
import { selectAccountingProofFiles } from "./paymentRequest";

type Attachment = NonNullable<DocumentItem["attachments"]>[number];

const pendingAccountingStep: ApprovalStep = {
  id: 3,
  stepOrder: 3,
  roleRequired: "accountant",
  status: "pending",
  updatedAt: "2026-09-29T03:00:00.000Z",
};

const attachment = (
  id: number,
  uploadedById: number,
  uploadedAt: string,
): Attachment => ({
  id,
  fileName: `${id}.jpg`,
  size: 100,
  mimeType: "image/jpeg",
  fileUrl: `/attachments/${id}/download`,
  uploadedById,
  uploadedAt,
});

describe("payment request accounting proofs", () => {
  it("counts a proof uploaded by the current accountant after the step became active", () => {
    const result = selectAccountingProofFiles(
      [attachment(1, 25, "2026-09-29T03:05:00.000Z")],
      pendingAccountingStep,
      25,
    );

    expect(result.map((item) => item.id)).toEqual([1]);
  });

  it("does not count requester files or old files as payment proofs", () => {
    const result = selectAccountingProofFiles(
      [
        attachment(1, 10, "2026-09-29T03:05:00.000Z"),
        attachment(2, 25, "2026-09-29T02:55:00.000Z"),
      ],
      pendingAccountingStep,
      25,
    );

    expect(result).toEqual([]);
  });
});
