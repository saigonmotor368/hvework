-- Sửa dữ liệu lịch sử DNTT-2026-001: CEO từng dùng chức năng duyệt thẳng
-- khiến bước Kế toán được đánh dấu hoàn tất dù chưa có chứng từ chi tiền.
-- Giữ nguyên các bước đã duyệt trước đó, chỉ mở lại bước Kế toán cuối cùng.
DO $$
DECLARE
  payment_document_id INTEGER;
BEGIN
  SELECT "id" INTO payment_document_id
  FROM "Document"
  WHERE "code" = 'DNTT-2026-001'
    AND "type" = 'payment_request'
    AND "status" = 'Đã duyệt';

  IF payment_document_id IS NULL THEN
    RETURN;
  END IF;

  -- Không sửa lại nếu đã có chứng từ do một tài khoản Kế toán tải lên.
  IF EXISTS (
    SELECT 1
    FROM "Attachment" a
    JOIN "_RoleToUser" ru ON ru."B" = a."uploadedById"
    JOIN "Role" r ON r."id" = ru."A" AND r."name" = 'accountant'
    WHERE a."entityType" = 'document'
      AND a."entityId" = payment_document_id
  ) THEN
    RETURN;
  END IF;

  UPDATE "DocumentApprovalStep"
  SET "status" = 'pending',
      "actedById" = NULL,
      "actedAt" = NULL,
      "comment" = 'Mở lại để Kế toán xác nhận chi tiền và đính kèm chứng từ.',
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "documentId" = payment_document_id
    AND "roleRequired" = 'accountant';

  UPDATE "Document"
  SET "status" = 'Chờ duyệt',
      "version" = "version" + 1,
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = payment_document_id;

  INSERT INTO "AuditLog"
    ("entityType", "entityId", "action", "beforeJson", "afterJson", "createdAt")
  VALUES (
    'Document',
    payment_document_id,
    'reopen_for_accounting_proof',
    '{"status":"Đã duyệt","accountingProof":false}'::jsonb,
    '{"status":"Chờ duyệt","pendingRole":"accountant"}'::jsonb,
    CURRENT_TIMESTAMP
  );

  INSERT INTO "Notification"
    ("userId", "eventType", "entityRef", "title", "content", "link", "channel", "dedupeKey", "sentAt")
  SELECT
    u."id",
    'document_pending_accounting',
    'document:' || payment_document_id,
    'Đề nghị thanh toán chờ xử lý: DNTT-2026-001',
    'CEO đã phê duyệt. Vui lòng xác nhận chi tiền và đính kèm chứng từ thanh toán.',
    '/documents?id=' || payment_document_id,
    'in_app',
    'reopen_payment_' || payment_document_id || '_accountant_' || u."id",
    CURRENT_TIMESTAMP
  FROM "User" u
  JOIN "_RoleToUser" ru ON ru."B" = u."id"
  JOIN "Role" r ON r."id" = ru."A"
  WHERE r."name" = 'accountant'
    AND u."status" = 'active'
  ON CONFLICT ("dedupeKey") DO NOTHING;
END $$;
