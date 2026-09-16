export interface ApprovalStep {
  id: number;
  stepOrder: number;
  roleRequired: string;
  status: 'not_started' | 'pending' | 'approved' | 'returned' | 'rejected';
  actedById?: number;
  actedAt?: string;
  comment?: string;
}

export interface DocumentItem {
  id: number;
  code: string;
  title: string;
  type: 'payment_request' | 'proposal' | 'contract' | string;
  status: 'Nháp' | 'Chờ duyệt' | 'Đã duyệt' | 'Trả lại' | 'Từ chối';
  version: number;
  createdById: number;
  createdAt: string;
  createdBy?: { id: number; name: string; email: string; department?: { id: number; name: string; code: string } };
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
  expiringStatus?: 'valid' | 'expiring_soon' | 'expired';
  daysRemaining?: number | null;
  steps?: ApprovalStep[];
  attachments?: Array<{ id: number; fileName: string; size: number; mimeType: string; fileUrl: string }>;
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

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  phone?: string;
  status: 'active' | 'locked';
  departmentId?: number | null;
  department?: DepartmentItem | null;
  roles: RoleItem[];
  createdAt?: string;
}

export const ROLE_LABELS: Record<string, string> = {
  employee: 'Nhân viên',
  department_head: 'Trưởng bộ phận',
  accountant: 'Kế toán',
  legal: 'Pháp chế',
  ceo: 'CEO',
  it_admin: 'IT Admin',
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  payment_request: 'Đề nghị thanh toán',
  proposal: 'Đề xuất',
  contract: 'Hợp đồng',
};
