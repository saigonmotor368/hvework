ALTER TABLE "ProjectMember"
ADD COLUMN "position" TEXT;

ALTER TABLE "Document"
ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'scoped',
ADD COLUMN "targetUserId" INTEGER;

ALTER TABLE "Task"
ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'scoped';

ALTER TABLE "Document"
ADD CONSTRAINT "Document_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Document_visibility_targetUserId_idx"
ON "Document"("visibility", "targetUserId");

CREATE INDEX "Task_visibility_assigneeId_idx"
ON "Task"("visibility", "assigneeId");
