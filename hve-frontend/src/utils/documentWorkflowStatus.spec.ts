import { describe, expect, it } from "vitest";
import type { DocumentItem } from "../types";
import { getDocumentWorkflowStatus } from "./documentWorkflowStatus";

const makeDocument = (overrides: Partial<DocumentItem>): DocumentItem => ({
  id: 1,
  code: "DNTT-2026-001",
  title: "Đề nghị thanh toán",
  type: "payment_request",
  status: "Chờ duyệt",
  version: 1,
  createdById: 10,
  createdAt: "2026-09-29T00:00:00.000Z",
  dataJson: {},
  ...overrides,
});

describe("document workflow status", () => {
  it("shows the current step and pending approval role", () => {
    const result = getDocumentWorkflowStatus(
      makeDocument({
        steps: [
          { id: 1, stepOrder: 1, roleRequired: "department_head", status: "approved" },
          { id: 2, stepOrder: 2, roleRequired: "ceo", status: "approved" },
          { id: 3, stepOrder: 3, roleRequired: "accountant", status: "pending" },
        ],
      }),
    );

    expect(result).toEqual({ title: "Chờ Kế toán", detail: "Bước 3/3" });
  });

  it("describes a returned document with the returning role", () => {
    const result = getDocumentWorkflowStatus(
      makeDocument({
        status: "Trả lại",
        steps: [
          { id: 1, stepOrder: 1, roleRequired: "department_head", status: "approved" },
          { id: 2, stepOrder: 2, roleRequired: "ceo", status: "returned" },
        ],
      }),
    );

    expect(result).toEqual({
      title: "Chờ người tạo điều chỉnh",
      detail: "Trả lại từ CEO",
    });
  });
});
