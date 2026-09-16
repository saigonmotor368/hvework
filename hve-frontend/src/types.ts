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
  type: string;
  status: 'Nháp' | 'Chờ duyệt' | 'Đã duyệt' | 'Trả lại' | 'Từ chối';
  version: number;
  createdById: number;
  createdAt: string;
  createdBy?: { id: number; name: string; email: string; department?: { name: string } };
  dataJson: {
    amount: number;
    receiver: string;
    bankName: string;
    bankAccount: string;
    content: string;
    deadline: string;
    attachmentIds?: number[];
  };
  steps?: ApprovalStep[];
  attachments?: Array<{ id: number; fileName: string; size: number; mimeType: string; fileUrl: string }>;
}

export const ROLE_LABELS: Record<string, string> = {
  employee: 'Nhân viên',
  department_head: 'Trưởng bộ phận',
  accountant: 'Kế toán',
  legal: 'Pháp chế',
  ceo: 'CEO',
  it_admin: 'IT Admin',
};
