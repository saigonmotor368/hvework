-- Đề nghị thanh toán: Trưởng Ban -> CEO rà soát -> Kế toán chi tiền.
-- Chỉ thay template dùng cho lần gửi duyệt tiếp theo; các snapshot hồ sơ đang
-- chạy giữ nguyên để không làm mất dấu lịch sử phê duyệt đã phát sinh.
DO $$
DECLARE
  payment_workflow_id INTEGER;
BEGIN
  SELECT "id" INTO payment_workflow_id
  FROM "WorkflowTemplate"
  WHERE "type" = 'payment_request';

  IF payment_workflow_id IS NULL THEN
    INSERT INTO "WorkflowTemplate" ("type", "name", "createdAt", "updatedAt")
    VALUES (
      'payment_request',
      'Quy trình duyệt Đề nghị thanh toán',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING "id" INTO payment_workflow_id;
  ELSE
    UPDATE "WorkflowTemplate"
    SET "name" = 'Quy trình duyệt Đề nghị thanh toán',
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = payment_workflow_id;

    DELETE FROM "WorkflowStepTemplate"
    WHERE "workflowTemplateId" = payment_workflow_id;
  END IF;

  INSERT INTO "WorkflowStepTemplate"
    ("workflowTemplateId", "stepOrder", "roleRequired", "createdAt", "updatedAt")
  VALUES
    (payment_workflow_id, 1, 'department_head', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (payment_workflow_id, 2, 'ceo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (payment_workflow_id, 3, 'accountant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
END $$;
