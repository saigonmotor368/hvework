-- Đề nghị thu: Kế toán lập -> Trưởng dự án (site) nộp tiền + tải chứng từ -> Kế toán xác nhận đã thu.
-- Không có bước CEO duyệt. Thêm bảng tài khoản ngân hàng công ty và quy trình mới.
CREATE TABLE "CompanyBankAccount" (
  "id" SERIAL NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyBankAccount_pkey" PRIMARY KEY ("id")
);

DO $$
DECLARE
  wf_id INTEGER;
BEGIN
  SELECT "id" INTO wf_id FROM "WorkflowTemplate" WHERE "type" = 'collection_request';
  IF wf_id IS NULL THEN
    INSERT INTO "WorkflowTemplate" ("type", "name", "createdAt", "updatedAt")
    VALUES ('collection_request', 'Quy trình Đề nghị thu', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING "id" INTO wf_id;

    INSERT INTO "WorkflowStepTemplate"
      ("workflowTemplateId", "stepOrder", "roleRequired", "createdAt", "updatedAt")
    VALUES
      (wf_id, 1, 'department_head', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (wf_id, 2, 'accountant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;
END $$;
