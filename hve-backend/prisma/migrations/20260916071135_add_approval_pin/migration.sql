-- Mã PIN xác nhận duyệt (6 số, tự đặt) cho bước phê duyệt cuối cùng của CEO
ALTER TABLE "User" ADD COLUMN     "approvalPinHash" TEXT,
ADD COLUMN     "approvalPinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "approvalPinLockedUntil" TIMESTAMP(3);
