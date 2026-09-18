ALTER TABLE "Announcement"
ADD COLUMN "notifiedAt" TIMESTAMP(3);

-- Các bài đã xuất bản trước khi có tính năng Web Push được đánh dấu là đã xử
-- lý để không phát thông báo hồi tố tới toàn công ty sau khi deploy.
UPDATE "Announcement"
SET "notifiedAt" = COALESCE("publishedAt", CURRENT_TIMESTAMP)
WHERE "status" = 'published'
  AND ("publishedAt" IS NULL OR "publishedAt" <= CURRENT_TIMESTAMP);

CREATE INDEX "Announcement_status_notifiedAt_publishedAt_idx"
ON "Announcement"("status", "notifiedAt", "publishedAt");
