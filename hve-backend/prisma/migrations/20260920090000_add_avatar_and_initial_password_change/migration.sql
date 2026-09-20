ALTER TABLE "User"
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
