import { useState, useEffect } from 'react';
import { type DocumentItem, type ApprovalStep, type TaskItem, ROLE_LABELS } from './types';

import { Toast } from './components/Toast';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { DocumentList } from './components/DocumentList';
import { DocumentDetailModal } from './components/DocumentDetailModal';
import { CreateDocumentForm, type CreateFormData } from './components/CreateDocumentForm';
import { ActionReasonModal } from './components/ActionReasonModal';
import { ApprovalPinModal } from './components/ApprovalPinModal';
import { SetApprovalPinModal } from './components/SetApprovalPinModal';
import { AdminWorkflowView } from './components/AdminWorkflowView';
import { AdminUserView } from './components/AdminUserView';
import { TaskListView } from './components/TaskListView';
import { CreateTaskModal } from './components/CreateTaskModal';
import { TaskDetailModal } from './components/TaskDetailModal';
import { NotificationBell } from './components/NotificationBell';
import { ReportsView } from './components/ReportsView';
import { OfflineBanner } from './components/OfflineBanner';
import { subscribeToWebPush } from './utils/pwa';
import {
  MOCK_USERS,
  MOCK_DOCUMENTS,
} from './mockData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function App() {
  // Auth state
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('access_token') || !!localStorage.getItem('user');
  });
  const [authError, setAuthError] = useState<string>('');

  // Check URL params on initial load for direct demo/screenshot routing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam === 'login') {
      setIsAuthenticated(false);
      setUser(null);
      return;
    }
    const roleParam = params.get('role');
    if (roleParam) {
      let targetUser: any = MOCK_USERS.employee;
      if (roleParam === 'ceo') targetUser = MOCK_USERS.ceo;
      else if (roleParam === 'dept_head' || roleParam === 'tp_it') targetUser = MOCK_USERS.dept_head;
      else if (roleParam === 'accountant' || roleParam === 'ketoan') targetUser = MOCK_USERS.accountant;
      else if (roleParam === 'legal' || roleParam === 'phapche') targetUser = MOCK_USERS.legal;
      else if (roleParam === 'it_admin' || roleParam === 'admin') targetUser = MOCK_USERS.it_admin;

      setUser(targetUser);
      setIsAuthenticated(true);
      setDocuments(MOCK_DOCUMENTS);
    }
    const tabParam = params.get('tab') as any;
    if (tabParam) {
      setActiveTab(tabParam);
    }
    const docIdParam = params.get('docId');
    if (docIdParam) {
      const found = MOCK_DOCUMENTS.find((d) => d.id === Number(docIdParam));
      if (found) setSelectedDoc(found);
    }
  }, []);

  // Main navigation & document state
  const [activeTab, setActiveTab] = useState<
    'overview' | 'documents' | 'create' | 'tasks' | 'reports' | 'admin_workflows' | 'admin_users'
  >('overview');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  // Task management state
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState<boolean>(false);
  const [parentTaskForCreate, setParentTaskForCreate] = useState<TaskItem | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  const [taskCount, setTaskCount] = useState<number>(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tabFilter, setTabFilter] = useState<'all' | 'my' | 'to_review'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Feedback & Action state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Modal Reason state (for Return / Reject)
  const [modalAction, setModalAction] = useState<{
    isOpen: boolean;
    type: 'return' | 'reject';
    stepId: number;
    docId: number;
    comment: string;
  }>({
    isOpen: false,
    type: 'return',
    stepId: 0,
    docId: 0,
    comment: '',
  });

  // Create form state
  const initialFormState: CreateFormData = {
    type: 'payment_request',
    title: '',
    amount: '',
    receiver: '',
    bankName: '',
    bankAccount: '',
    content: '',
    deadline: '',
    partner: '',
    value: '',
    startDate: '',
    endDate: '',
    manager: '',
    notes: '',
    selectedFile: null,
  };

  const [createForm, setCreateForm] = useState<CreateFormData>(initialFormState);

  // Approval PIN modal state (bắt buộc cho bước duyệt cuối cùng của CEO)
  const [pinModal, setPinModal] = useState<{
    isOpen: boolean;
    doc: DocumentItem | null;
    step: ApprovalStep | null;
    errorMessage: string | null;
  }>({ isOpen: false, doc: null, step: null, errorMessage: null });
  const [isSetPinOpen, setIsSetPinOpen] = useState<boolean>(false);
  const [pinStatus, setPinStatus] = useState<{ hasPin: boolean; enabled: boolean } | null>(null);
  const [showFirstLoginPinPrompt, setShowFirstLoginPinPrompt] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch documents from backend
  const fetchDocuments = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      let url = `${API_BASE_URL}/documents?tab=${tabFilter}`;
      if (statusFilter !== 'all') {
        url += `&status=${encodeURIComponent(statusFilter)}`;
      }
      if (typeFilter !== 'all') {
        url += `&type=${encodeURIComponent(typeFilter)}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        if (selectedDoc) {
          const fresh = data.find((d: DocumentItem) => d.id === selectedDoc.id);
          if (fresh) setSelectedDoc(fresh);
        }
      } else {
        throw new Error('Fallback to mock');
      }
    } catch {
      // Backend not connected - use realistic mock data
      let mock = [...MOCK_DOCUMENTS];
      if (tabFilter === 'my') {
        mock = mock.filter((d) => d.createdBy?.id === user?.id || d.createdBy?.email === user?.email);
      } else if (tabFilter === 'to_review') {
        mock = mock.filter((d) => d.status === 'Chờ duyệt');
      }
      if (statusFilter !== 'all') {
        mock = mock.filter((d) => d.status === statusFilter);
      }
      if (typeFilter !== 'all') {
        mock = mock.filter((d) => d.type === typeFilter);
      }
      setDocuments(mock);
      if (selectedDoc) {
        const fresh = mock.find((d) => d.id === selectedDoc.id);
        if (fresh) setSelectedDoc(fresh);
      }
    }
  };

  const fetchAssignableUsers = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/tasks/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAssignableUsers(data);
      }
    } catch {
      setAssignableUsers(Object.values(MOCK_USERS));
    }
  };

  const fetchTaskCount = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/tasks?tab=assigned_to_me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const pending = data.filter((t: any) => t.status === 'Chờ duyệt' || t.isOverdue);
        setTaskCount(pending.length);
      }
    } catch {
      setTaskCount(2);
    }
  };

  const handleNotificationNavigate = async (link?: string) => {
    if (!link) return;
    try {
      if (link.startsWith('/documents')) {
        const url = new URL(link, 'http://localhost');
        const idStr = url.searchParams.get('id');
        if (idStr) {
          const docId = parseInt(idStr, 10);
          const found = documents.find((d) => d.id === docId);
          if (found) {
            setSelectedDoc(found);
          } else {
            const token = localStorage.getItem('access_token');
            const res = await fetch(`${API_BASE_URL}/documents/${docId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const d = await res.json();
              setSelectedDoc(d);
            }
          }
          setActiveTab('documents');
        } else {
          setActiveTab('documents');
        }
      } else if (link.startsWith('/tasks')) {
        const url = new URL(link, 'http://localhost');
        const idStr = url.searchParams.get('id');
        if (idStr) {
          setSelectedTaskId(parseInt(idStr, 10));
        }
        setActiveTab('tasks');
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
      fetchAssignableUsers();
      fetchTaskCount();
    }
  }, [isAuthenticated, tabFilter, statusFilter, typeFilter]);

  // Trạng thái bật/tắt mã PIN xác nhận duyệt — chỉ liên quan tới CEO, dùng để
  // quyết định frontend có cần hỏi PIN trước khi gọi API duyệt bước cuối hay
  // không (backend vẫn là nơi enforce thật sự, đây chỉ là UX).
  const fetchPinStatus = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/approval-pin-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPinStatus({ hasPin: !!data.hasPin, enabled: !!data.enabled });
        if (!data.hasPin && !data.enabled) {
          const dismissKey = `pinPromptDismissed_${user?.id}`;
          if (!localStorage.getItem(dismissKey)) {
            setShowFirstLoginPinPrompt(true);
          }
        }
      }
    } catch {
      // Không chặn luồng chính nếu không lấy được trạng thái PIN
    }
  };

  useEffect(() => {
    const roles: string[] = user?.roles || [];
    if (isAuthenticated && roles.includes('ceo')) {
      fetchPinStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError('');
    setIsProcessing(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Đăng nhập thất bại');
      }

      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setUser(data.user);
      setIsAuthenticated(true);
      showToast(`Chào mừng ${data.user.name} đã đăng nhập!`);
    } catch {
      // Fallback demo login
      const matchedUser = MOCK_USERS.employee;
      localStorage.setItem('access_token', 'mock_token_demo');
      localStorage.setItem('refresh_token', 'mock_refresh_demo');
      localStorage.setItem('user', JSON.stringify(matchedUser));
      setUser(matchedUser);
      setIsAuthenticated(true);
      setDocuments(MOCK_DOCUMENTS);
      showToast(`Chào mừng ${matchedUser.name} đã đăng nhập!`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Switch role demo account
  const handleSwitchAccount = async (email: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' }),
      });

      let data;
      if (!response.ok) {
        // Fallback with default seed password
        const retry = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: '123456' }),
        });
        data = await retry.json();
        if (!retry.ok) throw new Error(data.message || 'Chuyển tài khoản thất bại');
      } else {
        data = await response.json();
      }

      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setUser(data.user);
      setIsAuthenticated(true);
      setSelectedDoc(null);
      showToast(`Đã chuyển sang tài khoản: ${data.user.name} (${email})`);
      fetchDocuments();
    } catch {
      // Offline fallback: match mock user by email
      let matchedUser: any = MOCK_USERS.employee;
      if (email.includes('ceo')) matchedUser = MOCK_USERS.ceo;
      else if (email.includes('tp_it')) matchedUser = MOCK_USERS.dept_head;
      else if (email.includes('ketoan')) matchedUser = MOCK_USERS.accountant;
      else if (email.includes('phapche')) matchedUser = MOCK_USERS.legal;
      else if (email.includes('admin')) matchedUser = MOCK_USERS.it_admin;

      localStorage.setItem('access_token', 'mock_token_' + matchedUser.id);
      localStorage.setItem('refresh_token', 'mock_refresh_' + matchedUser.id);
      localStorage.setItem('user', JSON.stringify(matchedUser));

      setUser(matchedUser);
      setIsAuthenticated(true);
      setSelectedDoc(null);
      setDocuments(MOCK_DOCUMENTS);
      showToast(`Đã chuyển sang vai trò: ${matchedUser.name} (${matchedUser.email})`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    setSelectedDoc(null);
    showToast('Đã đăng xuất tài khoản.');
  };

  // Auto-subscribe Web Push when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      subscribeToWebPush(API_BASE_URL);
    }
  }, [isAuthenticated, user]);

  // Upload Attachment via Presigned URL
  const uploadAttachmentReal = async (file: File): Promise<number | null> => {
    const token = localStorage.getItem('access_token');
    try {
      // 1. Request presigned URL from backend
      const presignRes = await fetch(`${API_BASE_URL}/attachments/presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          size: file.size,
        }),
      });

      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        throw new Error(err.message || 'Lỗi lấy pre-signed URL');
      }

      const { uploadUrl, fileUrl } = await presignRes.json();

      // 2. Upload binary file to destination storage
      const fullUploadUrl = uploadUrl.startsWith('http') ? uploadUrl : `${API_BASE_URL}${uploadUrl}`;
      const uploadRes = await fetch(fullUploadUrl, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: file,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.message || 'Lỗi tải tệp lên máy chủ lưu trữ');
      }

      // 3. Register Attachment Metadata in DB
      const regRes = await fetch(`${API_BASE_URL}/attachments/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          size: file.size,
          fileUrl,
        }),
      });

      if (!regRes.ok) {
        throw new Error('Lỗi đăng ký thông tin chứng từ');
      }

      const registered = await regRes.json();
      return registered.id;
    } catch (err: any) {
      showToast(err.message || 'Lỗi tải lên tệp đính kèm', 'error');
      return null;
    }
  };

  // Create Document (Payment Request, Proposal, or Contract)
  const handleCreateDocument = async (e: React.FormEvent, submitNow: boolean = false) => {
    e.preventDefault();
    if (isProcessing) return;

    // Validate by type
    if (createForm.type === 'payment_request') {
      if (!createForm.title || !createForm.amount || !createForm.receiver || !createForm.bankName || !createForm.bankAccount) {
        showToast('Vui lòng điền đầy đủ các thông tin thanh toán bắt buộc!', 'error');
        return;
      }
      if (submitNow && !createForm.selectedFile) {
        showToast('Quy định HVE: Bắt buộc đính kèm ít nhất 1 chứng từ / hóa đơn trước khi gửi duyệt!', 'error');
        return;
      }
    } else if (createForm.type === 'proposal') {
      if (!createForm.title || !createForm.content.trim()) {
        showToast('Vui lòng nhập tiêu đề và nội dung đề xuất chi tiết!', 'error');
        return;
      }
    } else if (createForm.type === 'contract') {
      if (!createForm.title || !createForm.partner || !createForm.value || !createForm.startDate || !createForm.endDate || !createForm.manager) {
        showToast('Vui lòng điền đầy đủ các thông tin hợp đồng bắt buộc!', 'error');
        return;
      }
      if (new Date(createForm.endDate) < new Date(createForm.startDate)) {
        showToast('Ngày hết hạn hợp đồng không được trước ngày hiệu lực!', 'error');
        return;
      }
      if (submitNow && !createForm.selectedFile) {
        showToast('Quy định HVE: Bắt buộc đính kèm tệp hợp đồng trước khi gửi duyệt!', 'error');
        return;
      }
    }

    setIsProcessing(true);
    const token = localStorage.getItem('access_token');

    try {
      const attachmentIds: number[] = [];
      if (createForm.selectedFile) {
        const attId = await uploadAttachmentReal(createForm.selectedFile);
        if (attId) {
          attachmentIds.push(attId);
        } else {
          throw new Error('Không thể tải tệp lên. Vui lòng thử lại.');
        }
      }

      let endpoint = `${API_BASE_URL}/documents/payment-requests`;
      let payload: any = {};

      if (createForm.type === 'payment_request') {
        endpoint = `${API_BASE_URL}/documents/payment-requests`;
        payload = {
          title: createForm.title,
          amount: parseFloat(createForm.amount),
          receiver: createForm.receiver,
          bankName: createForm.bankName,
          bankAccount: createForm.bankAccount,
          content: createForm.content,
          deadline: createForm.deadline || new Date().toISOString().split('T')[0],
          attachmentIds,
        };
      } else if (createForm.type === 'proposal') {
        endpoint = `${API_BASE_URL}/documents/proposals`;
        payload = {
          title: createForm.title,
          content: createForm.content,
          attachmentIds,
        };
      } else if (createForm.type === 'contract') {
        endpoint = `${API_BASE_URL}/documents/contracts`;
        payload = {
          title: createForm.title,
          partner: createForm.partner,
          value: parseFloat(createForm.value),
          startDate: createForm.startDate,
          endDate: createForm.endDate,
          manager: createForm.manager,
          notes: createForm.notes,
          attachmentIds,
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const doc = await res.json();
      if (!res.ok) {
        throw new Error(doc.message || 'Tạo hồ sơ thất bại');
      }

      // If user chose "Gửi duyệt ngay"
      if (submitNow) {
        const submitRes = await fetch(`${API_BASE_URL}/documents/${doc.id}/submit`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const submitted = await submitRes.json();
        if (!submitRes.ok) {
          throw new Error(submitted.message || 'Gửi duyệt thất bại');
        }
        setSelectedDoc(submitted);
        showToast('Đã tạo và gửi hồ sơ phê duyệt thành công!');
      } else {
        setSelectedDoc(doc);
        showToast('Đã lưu bản nháp thành công!');
      }

      // Reset form
      setCreateForm(initialFormState);
      setActiveTab('documents');
      fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Thao tác thất bại', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit Draft
  const handleSubmitDraft = async (doc: DocumentItem) => {
    setIsProcessing(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${doc.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gửi duyệt thất bại');
      }
      setSelectedDoc(data);
      showToast('Đã gửi hồ sơ đi phê duyệt thành công!');
      fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi gửi duyệt', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Approve Step
  const handleApproveStep = async (doc: DocumentItem, step: ApprovalStep, pin?: string) => {
    setIsProcessing(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(
        `${API_BASE_URL}/documents/${doc.id}/steps/${step.id}/approve?version=${doc.version}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ comment: 'Đồng ý phê duyệt', ...(pin ? { pin } : {}) }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Phê duyệt thất bại');
      }
      setSelectedDoc(data);
      showToast('Đã phê duyệt bước thành công!');
      fetchDocuments();
      if (pinModal.isOpen) {
        setPinModal({ isOpen: false, doc: null, step: null, errorMessage: null });
      }
    } catch (err: any) {
      if (pinModal.isOpen) {
        setPinModal({ ...pinModal, errorMessage: err.message || 'Lỗi phê duyệt' });
      } else {
        showToast(err.message || 'Lỗi phê duyệt', 'error');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Bước duyệt cuối cùng do CEO thực hiện bắt buộc nhập mã PIN — xác định
  // động theo cấu hình luồng hiện tại, không hardcode số bước.
  const isFinalCeoStep = (doc: DocumentItem, step: ApprovalStep) => {
    const steps = doc.steps || [];
    if (steps.length === 0) return false;
    const maxStepOrder = Math.max(...steps.map((s) => s.stepOrder));
    return step.roleRequired === 'ceo' && step.stepOrder === maxStepOrder;
  };

  const handleApproveStepClick = (doc: DocumentItem, step: ApprovalStep) => {
    if (isFinalCeoStep(doc, step) && pinStatus?.enabled) {
      setPinModal({ isOpen: true, doc, step, errorMessage: null });
      return;
    }
    handleApproveStep(doc, step);
  };

  const handleConfirmPinModal = (pin: string) => {
    if (!pinModal.doc || !pinModal.step) return;
    handleApproveStep(pinModal.doc, pinModal.step, pin);
  };

  // Create New Version
  const handleCreateNewVersion = async (doc: DocumentItem) => {
    setIsProcessing(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${doc.id}/new-version`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Tạo phiên bản sửa đổi thất bại');
      }
      setSelectedDoc(data);
      showToast(`Đã tạo bản nháp sửa đổi mới: ${data.code}!`);
      fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi tạo phiên bản sửa đổi', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm Modal Action (Return / Reject)
  const handleConfirmActionModal = async () => {
    if (!modalAction.comment.trim()) {
      showToast('Bắt buộc phải nhập lý do khi Trả lại hoặc Từ chối!', 'error');
      return;
    }

    setIsProcessing(true);
    const token = localStorage.getItem('access_token');
    const endpoint =
      modalAction.type === 'return'
        ? `${API_BASE_URL}/documents/${modalAction.docId}/steps/${modalAction.stepId}/return`
        : `${API_BASE_URL}/documents/${modalAction.docId}/steps/${modalAction.stepId}/reject`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comment: modalAction.comment }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Thao tác thất bại');
      }

      setModalAction({ ...modalAction, isOpen: false, comment: '' });
      setSelectedDoc(data);
      showToast(
        modalAction.type === 'return'
          ? 'Đã trả lại hồ sơ về cho người tạo chỉnh sửa!'
          : 'Đã từ chối hồ sơ phê duyệt!',
      );
      fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi xử lý hồ sơ', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Đã duyệt':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            ● Đã duyệt
          </span>
        );
      case 'Chờ duyệt':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
            ● Chờ duyệt
          </span>
        );
      case 'Trả lại':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
            ↩ Trả lại
          </span>
        );
      case 'Từ chối':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            ✕ Từ chối
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
            ✎ Bản nháp
          </span>
        );
    }
  };

  // Filtered documents
  const filteredDocuments = documents.filter((doc) => {
    const matchSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.dataJson?.receiver && doc.dataJson.receiver.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (doc.dataJson?.partner && doc.dataJson.partner.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchType = typeFilter === 'all' || doc.type === typeFilter;
    return matchSearch && matchType;
  });

  const pendingCount = documents.filter((d) => d.status === 'Chờ duyệt').length;
  const approvedCount = documents.filter((d) => d.status === 'Đã duyệt').length;
  const draftCount = documents.filter((d) => d.status === 'Nháp').length;

  // Unauthenticated view
  if (!isAuthenticated) {
    return (
      <>
        <Toast toast={toast} />
        <LoginPage
          authError={authError}
          isProcessing={isProcessing}
          onLogin={handleLogin}
        />
      </>
    );
  }

  // Authenticated View
  return (
    <div className="flex h-screen bg-[#F5F5F7] overflow-hidden text-gray-900 font-sans">
      <Toast toast={toast} />

      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        pendingCount={pendingCount}
        taskCount={taskCount}
        user={user}
        isMobileOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onSelectTab={(tab) => {
          setSelectedDoc(null);
          setSelectedTaskId(null);
          setActiveTab(tab);
        }}
        onLogout={handleLogout}
        onOpenSetPin={() => setIsSetPinOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <OfflineBanner />

        {/* Header Bar */}
        <header className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-10 flex-shrink-0">
          <div className="flex items-center space-x-3">
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-slate-100 transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Mở menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-sm md:text-base font-bold text-gray-900 truncate">
              {activeTab === 'overview' && 'Tổng quan điều hành'}
              {activeTab === 'documents' && 'Danh sách hồ sơ phê duyệt'}
              {activeTab === 'tasks' && 'Quản lý công việc & Giao nhiệm vụ'}
              {activeTab === 'reports' && 'Báo cáo & Thống kê điều hành'}
              {activeTab === 'create' && 'Khởi tạo hồ sơ phê duyệt mới'}
              {activeTab === 'admin_workflows' && 'Cấu hình quy trình (Quản trị IT)'}
              {activeTab === 'admin_users' && 'Quản lý người dùng (Quản trị IT)'}
            </h2>
            {selectedDoc && (
              <span className="hidden sm:inline text-sm text-gray-400 font-medium">/ Chi tiết {selectedDoc.code}</span>
            )}
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <NotificationBell
              apiBaseUrl={API_BASE_URL}
              onNavigate={handleNotificationNavigate}
            />
            <div className="hidden sm:block h-5 w-px bg-slate-200" />
            <span className="hidden sm:block text-xs text-gray-500">
              <strong className="text-gray-800">{user?.name}</strong>
              <span className="hidden md:inline"> ({user?.roles?.map((r: string) => ROLE_LABELS[r] || r).join(', ')})</span>
            </span>
          </div>
        </header>

        {/* Tab Body */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <OverviewDashboard
              apiBaseUrl={API_BASE_URL}
              user={user}
              pendingCount={pendingCount}
              approvedCount={approvedCount}
              draftCount={draftCount}
              documents={documents}
              getStatusBadge={getStatusBadge}
              onSelectDoc={(doc) => {
                setSelectedDoc(doc);
                setActiveTab('documents');
              }}
              onSelectTask={(taskId) => {
                setSelectedTaskId(taskId);
                setActiveTab('tasks');
              }}
              onViewAll={() => setActiveTab('documents')}
            />
          )}

          {/* TAB 2: DOCUMENTS LIST & DETAIL */}
          {activeTab === 'documents' && (
            <div>
              {!selectedDoc ? (
                <DocumentList
                  filteredDocuments={filteredDocuments}
                  tabFilter={tabFilter}
                  setTabFilter={setTabFilter}
                  typeFilter={typeFilter}
                  setTypeFilter={setTypeFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  getStatusBadge={getStatusBadge}
                  onSelectDoc={(doc) => setSelectedDoc(doc)}
                  onCreateNew={() => setActiveTab('create')}
                />
              ) : (
                <DocumentDetailModal
                  selectedDoc={selectedDoc}
                  user={user}
                  isProcessing={isProcessing}
                  apiBaseUrl={API_BASE_URL}
                  getStatusBadge={getStatusBadge}
                  onBack={() => setSelectedDoc(null)}
                  onSubmitDraft={handleSubmitDraft}
                  onCreateNewVersion={handleCreateNewVersion}
                  onApproveStep={handleApproveStepClick}
                  onOpenModalAction={(type, stepId, docId) => {
                    setModalAction({
                      isOpen: true,
                      type,
                      stepId,
                      docId,
                      comment: '',
                    });
                  }}
                />
              )}
            </div>
          )}

          {/* TAB: TASKS LIST */}
          {activeTab === 'tasks' && (
            <TaskListView
              apiBaseUrl={API_BASE_URL}
              currentUser={user}
              showToast={showToast}
              onOpenCreate={() => {
                setParentTaskForCreate(null);
                setIsCreateTaskOpen(true);
              }}
              onSelectTask={(task) => setSelectedTaskId(task.id)}
            />
          )}

          {/* TAB: REPORTS */}
          {activeTab === 'reports' && (
            <ReportsView
              apiBaseUrl={API_BASE_URL}
              currentUser={user}
              showToast={showToast}
              onSelectDoc={(id) => {
                const found = documents.find((d) => d.id === id);
                if (found) {
                  setSelectedDoc(found);
                  setActiveTab('documents');
                }
              }}
              onSelectTask={(taskId) => {
                setSelectedTaskId(taskId);
                setActiveTab('tasks');
              }}
            />
          )}

          {/* TAB 3: CREATE FORM */}
          {activeTab === 'create' && (
            <CreateDocumentForm
              createForm={createForm}
              setCreateForm={setCreateForm}
              isProcessing={isProcessing}
              onSubmit={handleCreateDocument}
              onCancel={() => setActiveTab('documents')}
            />
          )}

          {/* TAB 4: IT ADMIN WORKFLOW CONFIG */}
          {activeTab === 'admin_workflows' && (
            <AdminWorkflowView apiBaseUrl={API_BASE_URL} showToast={showToast} />
          )}

          {/* TAB 5: IT ADMIN USER MANAGEMENT */}
          {activeTab === 'admin_users' && (
            <AdminUserView apiBaseUrl={API_BASE_URL} currentUser={user} showToast={showToast} />
          )}
        </div>
      </main>

      {/* Task Creation Modal */}
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => {
          setIsCreateTaskOpen(false);
          setParentTaskForCreate(null);
        }}
        onSuccess={() => {
          fetchTaskCount();
        }}
        apiBaseUrl={API_BASE_URL}
        users={assignableUsers}
        parentTask={parentTaskForCreate}
        showToast={showToast}
      />

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          currentUser={user}
          apiBaseUrl={API_BASE_URL}
          users={assignableUsers}
          showToast={showToast}
          onRefreshList={() => {
            fetchTaskCount();
          }}
          onOpenCreateSubtask={(parent) => {
            setSelectedTaskId(null);
            setParentTaskForCreate(parent);
            setIsCreateTaskOpen(true);
          }}
        />
      )}

      <ActionReasonModal
        modalAction={modalAction}
        isProcessing={isProcessing}
        onClose={() => setModalAction({ ...modalAction, isOpen: false })}
        onChangeComment={(comment) => setModalAction({ ...modalAction, comment })}
        onConfirm={handleConfirmActionModal}
      />

      {pinModal.isOpen && (
        <ApprovalPinModal
          isProcessing={isProcessing}
          errorMessage={pinModal.errorMessage}
          onCancel={() => setPinModal({ isOpen: false, doc: null, step: null, errorMessage: null })}
          onConfirm={handleConfirmPinModal}
        />
      )}

      {isSetPinOpen && (
        <SetApprovalPinModal
          apiBaseUrl={API_BASE_URL}
          onClose={() => {
            setIsSetPinOpen(false);
            fetchPinStatus();
          }}
          showToast={showToast}
        />
      )}

      {showFirstLoginPinPrompt && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Bảo vệ bước duyệt cuối cùng?</h3>
            <p className="text-xs text-gray-500 mb-5">
              Bạn có thể bật yêu cầu nhập mã PIN 6 số xác nhận riêng cho bước phê duyệt cuối cùng
              của mình, độc lập với mật khẩu đăng nhập. Có thể bật/tắt lại bất cứ lúc nào trong Hồ
              sơ cá nhân.
            </p>
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => {
                  localStorage.setItem(`pinPromptDismissed_${user?.id}`, '1');
                  setShowFirstLoginPinPrompt(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-slate-100 transition-all"
              >
                Để sau
              </button>
              <button
                onClick={() => {
                  localStorage.setItem(`pinPromptDismissed_${user?.id}`, '1');
                  setShowFirstLoginPinPrompt(false);
                  setIsSetPinOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#0A66C2] text-white text-xs font-bold hover:bg-[#08519c] shadow-sm transition-all"
              >
                Bật ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
