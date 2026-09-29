import type { ApprovalStep, DocumentItem } from "../types";

type Attachment = NonNullable<DocumentItem["attachments"]>[number];

export const selectAccountingProofFiles = (
  attachments: Attachment[],
  accountingStep: ApprovalStep | undefined,
  accountingActorId: number | undefined,
): Attachment[] => {
  if (!accountingActorId) return [];

  return attachments.filter((attachment) => {
    if (attachment.uploadedById !== accountingActorId) return false;
    if (accountingStep?.status === "approved") return true;
    if (!accountingStep?.updatedAt || !attachment.uploadedAt) return true;

    return (
      new Date(attachment.uploadedAt).getTime() >
      new Date(accountingStep.updatedAt).getTime()
    );
  });
};
