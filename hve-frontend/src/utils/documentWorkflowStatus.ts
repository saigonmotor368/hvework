import type { DocumentItem } from "../types";
import { ROLE_LABELS } from "../types";

export interface DocumentWorkflowStatus {
  title: string;
  detail: string;
}

export const getDocumentWorkflowStatus = (
  document: DocumentItem,
): DocumentWorkflowStatus => {
  const steps = [...(document.steps || [])].sort(
    (left, right) => left.stepOrder - right.stepOrder,
  );
  const pendingStep = steps.find((step) => step.status === "pending");

  if (document.status === "Chờ duyệt" && pendingStep) {
    const roleLabel = ROLE_LABELS[pendingStep.roleRequired] || pendingStep.roleRequired;
    return {
      title: `Chờ ${roleLabel}`,
      detail: `Bước ${pendingStep.stepOrder}/${Math.max(steps.length, pendingStep.stepOrder)}`,
    };
  }

  if (document.status === "Đã duyệt") {
    return {
      title: "Đã hoàn tất",
      detail: steps.length > 0 ? `${steps.length}/${steps.length} bước đã xử lý` : "Quy trình đã hoàn tất",
    };
  }

  if (document.status === "Trả lại") {
    const returnedStep = [...steps]
      .reverse()
      .find((step) => step.status === "returned");
    const returnedBy = returnedStep
      ? ROLE_LABELS[returnedStep.roleRequired] || returnedStep.roleRequired
      : null;
    return {
      title: "Chờ người tạo điều chỉnh",
      detail: returnedBy ? `Trả lại từ ${returnedBy}` : "Hồ sơ cần được cập nhật",
    };
  }

  if (document.status === "Từ chối") {
    return {
      title: "Đã từ chối",
      detail: "Quy trình đã dừng",
    };
  }

  if (document.status === "Nháp") {
    return {
      title: "Chưa gửi phê duyệt",
      detail: "Người tạo đang soạn hồ sơ",
    };
  }

  return {
    title: document.status,
    detail: "",
  };
};
