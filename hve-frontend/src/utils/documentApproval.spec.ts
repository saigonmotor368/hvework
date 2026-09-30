import { describe, expect, it } from "vitest";
import {
  getDocumentProjectIds,
  isCreatorAccountingSettlement,
  matchesDepartmentHeadScope,
} from "./documentApproval";

describe("document approval scope", () => {
  it("allows the creator to execute only the final accounting settlement", () => {
    const document = {
      type: "payment_request",
      steps: [
        { stepOrder: 1, roleRequired: "department_head" },
        { stepOrder: 2, roleRequired: "ceo" },
        { stepOrder: 3, roleRequired: "accountant" },
      ],
    };

    expect(
      isCreatorAccountingSettlement(document, document.steps[2]),
    ).toBe(true);
    expect(
      isCreatorAccountingSettlement(document, document.steps[0]),
    ).toBe(false);
  });

  it("matches a project head when the document has only a linked project", () => {
    const document = {
      projectId: null,
      linkedProjectIds: [2],
      createdBy: { department: { id: 1 } },
    };

    expect(getDocumentProjectIds(document)).toEqual([2]);
    expect(
      matchesDepartmentHeadScope({ projects: [{ id: 2 }] }, document),
    ).toBe(true);
  });

  it("does not fall back to department when a linked project is present", () => {
    const document = {
      projectId: null,
      linkedProjectIds: [2],
      createdBy: { department: { id: 1 } },
    };

    expect(
      matchesDepartmentHeadScope(
        { departmentId: 1, projects: [{ id: 3 }] },
        document,
      ),
    ).toBe(false);
  });

  it("uses department scope only for legacy documents without projects", () => {
    expect(
      matchesDepartmentHeadScope(
        { departmentId: 1 },
        {
          projectId: null,
          linkedProjectIds: [],
          createdBy: { department: { id: 1 } },
        },
      ),
    ).toBe(true);
  });
});
