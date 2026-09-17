ALTER TABLE "User"
ADD COLUMN "delegateToUserId" INTEGER,
ADD COLUMN "delegateUntil" TIMESTAMP(3);

CREATE INDEX "User_delegateToUserId_delegateUntil_idx"
ON "User"("delegateToUserId", "delegateUntil");

ALTER TABLE "User"
ADD CONSTRAINT "User_delegateToUserId_fkey"
FOREIGN KEY ("delegateToUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
