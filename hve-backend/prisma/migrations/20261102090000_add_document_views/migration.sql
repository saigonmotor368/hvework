-- Theo dõi ai đã xem hồ sơ (kể cả Ban Giám đốc).
CREATE TABLE "DocumentView" (
  "id" SERIAL NOT NULL,
  "documentId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "viewCount" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "DocumentView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentView_documentId_userId_key" ON "DocumentView"("documentId", "userId");
CREATE INDEX "DocumentView_userId_idx" ON "DocumentView"("userId");

ALTER TABLE "DocumentView" ADD CONSTRAINT "DocumentView_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentView" ADD CONSTRAINT "DocumentView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
