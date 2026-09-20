export interface ApprovalStep {
  id: number;
  stepOrder: number;
  roleRequired: string;
  status: "not_started" | "pending" | "approved" | "returned" | "rejected";
  actedById?: number;
  actedBy?: {
    id: number;
    name: string;
    email: string;
    roles?: Array<{ name: string }>;
  } | null;
  actedAt?: string;
  comment?: string;
}

export interface DocumentItem {
  id: number;
  code: string;
  title: string;
  type: "payment_request" | "proposal" | "contract" | string;
  status: "Nháp" | "Chờ duyệt" | "Đã duyệt" | "Trả lại" | "Từ chối";
  version: number;
  createdById: number;
  createdAt: string;
  projectId?: number | null;
  project?: ProjectItem | null;
  linkedProjectIds?: number[] | null;
  visibility?: "scoped" | "targeted" | "company";
  targetUserId?: number | null;
  targetUser?: {
    id: number;
    name: string;
    email: string;
    department?: { id: number; name: string; code: string };
  } | null;
  createdBy?: {
    id: number;
    name: string;
    email: string;
    department?: { id: number; name: string; code: string };
  };
  dataJson: {
    // payment_request
    amount?: number;
    receiver?: string;
    bankName?: string;
    bankAccount?: string;
    deadline?: string;

    // proposal & general content
    content?: string;

    // contract
    partner?: string;
    value?: number;
    startDate?: string;
    endDate?: string;
    manager?: string;
    notes?: string;

    attachmentIds?: number[];
  };
  isExpiringSoon?: boolean;
  expiringStatus?: "valid" | "expiring_soon" | "expired";
  daysRemaining?: number | null;
  steps?: ApprovalStep[];
  attachments?: Array<{
    id: number;
    fileName: string;
    size: number;
    mimeType: string;
    fileUrl: string;
    version?: number;
    uploadedAt?: string;
    uploadedById?: number;
    uploadedBy?: {
      id: number;
      name: string;
      email: string;
      roles?: Array<{ name: string }>;
    } | null;
  }>;
}

export interface WorkflowStepTemplate {
  id?: number;
  stepOrder: number;
  roleRequired: string;
}

export interface WorkflowTemplate {
  id: number;
  type: string;
  name: string;
  steps: WorkflowStepTemplate[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleItem {
  id: number;
  name: string;
  description?: string;
}

export interface DepartmentItem {
  id: number;
  name: string;
  code: string;
}

export interface ProjectItem {
  id: number;
  code: string;
  name: string;
  location?: string | null;
  leadUserId?: number | null;
  lead?: { id: number; name: string; email: string } | null;
  members?: Array<{
    userId: number;
    position?: string | null;
    user: { id: number; name: string; email: string };
  }>;
  isActive: boolean;
}

export interface AnnouncementItem {
  id: number;
  title: string;
  summary?: string | null;
  content?: string;
  type: "news" | "meeting" | "guide";
  priority: "normal" | "important" | "urgent";
  status?: "draft" | "published" | "archived";
  isPinned: boolean;
  projectId?: number | null;
  project?: { id: number; code: string; name: string } | null;
  meetingStartAt?: string | null;
  meetingEndAt?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: { id: number; name: string };
}

export interface ProjectReportItem {
  id: number;
  code: string;
  title: string;
  content: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  periodStart?: string | null;
  periodEnd?: string | null;
  projectId?: number | null;
  project?: {
    id: number;
    code: string;
    name: string;
    location?: string | null;
    leadUserId?: number | null;
  } | null;
  authorId: number;
  author: { id: number; name: string; email: string };
  viewers: Array<{
    userId: number;
    user: { id: number; name: string; email: string };
  }>;
  submittedAt?: string | null;
  reviewedById?: number | null;
  reviewedBy?: { id: number; name: string; email: string } | null;
  reviewedAt?: string | null;
  reviewComment?: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  attachments?: Array<{
    id: number;
    fileName: string;
    size: number;
    mimeType: string;
    fileUrl: string;
  }>;
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canSubmit: boolean;
    canReview: boolean;
  };
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string | null;
  mustChangePassword?: boolean;
  status: "active" | "locked";
  departmentId?: number | null;
  department?: DepartmentItem | null;
  roles: RoleItem[];
  ledProjects?: Array<{ id: number; code: string; name: string }>;
  projectMemberships?: Array<{
    position?: string | null;
    project: { id: number; code: string; name: string };
  }>;
  delegateToUserId?: number | null;
  delegateUntil?: string | null;
  delegateTo?: {
    id: number;
    name: string;
    email: string;
    status?: string;
  } | null;
  delegatedFrom?: Array<{
    id: number;
    name: string;
    email: string;
    delegateUntil: string;
  }>;
  createdAt?: string;
}

export interface WorkloadSummaryItem {
  userId: number;
  name: string;
  email: string;
  activeCount: number;
  overdueCount: number;
  level: "ranh" | "vua" | "qua_tai";
}

export interface ProjectHealthItem {
  id: number;
  code: string;
  name: string;
  total: number;
  overdue: number;
  ratio: number;
  percent: number;
  level: "binh_thuong" | "can_chu_y" | "tre_tien_do" | "rui_ro_cao";
}

export const ROLE_LABELS: Record<string, string> = {
  employee: "Nhân viên",
  department_head: "Trưởng Ban / Trưởng dự án",
  accountant: "Kế toán",
  legal: "Pháp chế",
  ceo: "CEO",
  it_admin: "Quản trị IT",
  bgd: "Ban Giám Đốc",
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  payment_request: "Đề nghị thanh toán",
  proposal: "Đề xuất",
  contract: "Hợp đồng",
};

export interface SubTaskItem {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "Chưa làm" | "Đang làm" | "Chờ duyệt" | "Hoàn thành";
  progressPercent: number;
  startDate?: string | null;
  dueDate?: string | null;
  assigneeId?: number | null;
  assignee?: { id: number; name: string };
  isOverdue?: boolean;
}

export interface TaskComment {
  id: number;
  entityId: number;
  userId: number;
  content: string;
  mentions?: number[];
  createdAt: string;
  user?: { id: number; name: string; email?: string };
}

export interface TaskItem {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "Chưa làm" | "Đang làm" | "Chờ duyệt" | "Hoàn thành";
  progressPercent: number;
  startDate?: string | null;
  dueDate?: string | null;
  assigneeId?: number | null;
  assignee?: {
    id: number;
    name: string;
    email: string;
    departmentId?: number | null;
  };
  createdById: number;
  createdBy?: {
    id: number;
    name: string;
    email: string;
    departmentId?: number | null;
  };
  parentTaskId?: number | null;
  parentTask?: {
    id: number;
    code: string;
    title: string;
    status: string;
  } | null;
  subTasks?: SubTaskItem[];
  recurrenceRule?: "daily" | "weekly" | "monthly" | null;
  tags?: string | null;
  collaboratorIds?: number[] | null;
  isOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
  projectId?: number | null;
  project?: ProjectItem | null;
  linkedProjectIds?: number[] | null;
  visibility?: "scoped" | "targeted" | "company";
  attachments?: Array<{
    id: number;
    fileName: string;
    size: number;
    mimeType: string;
    fileUrl: string;
  }>;
  comments?: TaskComment[];
}

export const TASK_PRIORITY_LABELS: Record<
  string,
  { label: string; color: string }
> = {
  low: { label: "Thấp", color: "bg-slate-100 text-slate-700" },
  normal: { label: "Bình thường", color: "bg-blue-100 text-blue-700" },
  high: { label: "Cao", color: "bg-orange-100 text-orange-700" },
  urgent: { label: "Khẩn cấp", color: "bg-red-100 text-red-700" },
};

export const TASK_STATUS_LABELS: Record<
  string,
  { label: string; color: string }
> = {
  "Chưa làm": { label: "Chưa làm", color: "bg-slate-100 text-slate-700" },
  "Đang làm": { label: "Đang làm", color: "bg-blue-100 text-blue-700" },
  "Chờ duyệt": { label: "Chờ duyệt", color: "bg-amber-100 text-amber-800" },
  "Hoàn thành": {
    label: "Hoàn thành",
    color: "bg-emerald-100 text-emerald-800",
  },
};
