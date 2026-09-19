CREATE TABLE "ProjectReport" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "projectId" INTEGER,
    "authorId" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectReportViewer" (
    "reportId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "ProjectReportViewer_pkey" PRIMARY KEY ("reportId","userId")
);

CREATE UNIQUE INDEX "ProjectReport_code_key" ON "ProjectReport"("code");
CREATE INDEX "ProjectReport_authorId_status_createdAt_idx" ON "ProjectReport"("authorId", "status", "createdAt");
CREATE INDEX "ProjectReport_projectId_status_createdAt_idx" ON "ProjectReport"("projectId", "status", "createdAt");
CREATE INDEX "ProjectReport_status_submittedAt_idx" ON "ProjectReport"("status", "submittedAt");
CREATE INDEX "ProjectReportViewer_userId_reportId_idx" ON "ProjectReportViewer"("userId", "reportId");

ALTER TABLE "ProjectReport" ADD CONSTRAINT "ProjectReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectReport" ADD CONSTRAINT "ProjectReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectReport" ADD CONSTRAINT "ProjectReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectReportViewer" ADD CONSTRAINT "ProjectReportViewer_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ProjectReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectReportViewer" ADD CONSTRAINT "ProjectReportViewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
