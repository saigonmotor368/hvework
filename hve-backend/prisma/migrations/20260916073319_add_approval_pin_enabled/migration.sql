-- Cho phép CEO tự bật/tắt yêu cầu mã PIN xác nhận duyệt ở bước duyệt cuối cùng
ALTER TABLE "User" ADD COLUMN     "approvalPinEnabled" BOOLEAN NOT NULL DEFAULT false;
