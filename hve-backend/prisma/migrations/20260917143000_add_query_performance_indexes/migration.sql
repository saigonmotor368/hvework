-- Indexes for the authenticated list, dashboard, notification, and attachment
-- queries that dominate normal HVE Work page loads.
CREATE INDEX "Document_createdById_status_idx" ON "Document"("createdById", "status");
CREATE INDEX "Document_type_status_idx" ON "Document"("type", "status");
CREATE INDEX "DocumentApprovalStep_status_roleRequired_documentId_idx" ON "DocumentApprovalStep"("status", "roleRequired", "documentId");

CREATE INDEX "Task_assigneeId_status_dueDate_idx" ON "Task"("assigneeId", "status", "dueDate");
CREATE INDEX "Task_createdById_idx" ON "Task"("createdById");
CREATE INDEX "Task_status_dueDate_idx" ON "Task"("status", "dueDate");
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

CREATE INDEX "Attachment_entityType_entityId_uploadedAt_idx" ON "Attachment"("entityType", "entityId", "uploadedAt");
CREATE INDEX "Attachment_uploadedById_entityId_idx" ON "Attachment"("uploadedById", "entityId");
CREATE INDEX "Comment_entityType_entityId_createdAt_idx" ON "Comment"("entityType", "entityId", "createdAt");

CREATE INDEX "Notification_userId_channel_sentAt_idx" ON "Notification"("userId", "channel", "sentAt");
CREATE INDEX "Notification_userId_channel_readAt_idx" ON "Notification"("userId", "channel", "readAt");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
