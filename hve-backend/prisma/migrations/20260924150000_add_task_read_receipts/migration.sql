CREATE TABLE "TaskView" (
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TaskView_pkey" PRIMARY KEY ("taskId","userId")
);

CREATE INDEX "TaskView_taskId_lastViewedAt_idx" ON "TaskView"("taskId", "lastViewedAt");
CREATE INDEX "TaskView_userId_lastViewedAt_idx" ON "TaskView"("userId", "lastViewedAt");

ALTER TABLE "TaskView"
ADD CONSTRAINT "TaskView_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskView"
ADD CONSTRAINT "TaskView_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
