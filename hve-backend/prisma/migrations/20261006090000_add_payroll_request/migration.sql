-- Đề nghị chi lương: Trưởng dự án lập (người tạo) -> Nhân sự -> CEO -> Kế toán chi.
-- Thêm vai trò Nhân sự (hr) và quy trình mới; không ảnh hưởng quy trình hiện có.
INSERT INTO "Role" ("name", "description", "createdAt", "updatedAt")
VALUES ('hr', 'Nhân sự', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

DO $$
DECLARE
  wf_id INTEGER;
BEGIN
  SELECT "id" INTO wf_id FROM "WorkflowTemplate" WHERE "type" = 'payroll_request';

  IF wf_id IS NULL THEN
    INSERT INTO "WorkflowTemplate" ("type", "name", "createdAt", "updatedAt")
    VALUES ('payroll_request', 'Quy trình duyệt Đề nghị chi lương', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING "id" INTO wf_id;

    INSERT INTO "WorkflowStepTemplate"
      ("workflowTemplateId", "stepOrder", "roleRequired", "createdAt", "updatedAt")
    VALUES
      (wf_id, 1, 'hr', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (wf_id, 2, 'ceo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (wf_id, 3, 'accountant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;
END $$;
