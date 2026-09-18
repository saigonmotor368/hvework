CREATE TABLE "Announcement" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'news',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "projectId" INTEGER,
    "meetingStartAt" TIMESTAMP(3),
    "meetingEndAt" TIMESTAMP(3),
    "location" TEXT,
    "meetingUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Announcement_status_isPinned_publishedAt_idx"
ON "Announcement"("status", "isPinned", "publishedAt");

CREATE INDEX "Announcement_projectId_status_publishedAt_idx"
ON "Announcement"("projectId", "status", "publishedAt");

CREATE INDEX "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");

ALTER TABLE "Announcement"
ADD CONSTRAINT "Announcement_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Announcement"
ADD CONSTRAINT "Announcement_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
