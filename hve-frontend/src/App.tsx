import { useState, useEffect } from 'react';
import { type DocumentItem, type ApprovalStep, ROLE_LABELS } from './types';


import { Toast } from './components/Toast';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { DocumentList } from './components/DocumentList';
import { DocumentDetailModal } from './components/DocumentDetailModal';
import { CreateDocumentForm } from './components/CreateDocumentForm';
import { ActionReasonModal } from './components/ActionReasonModal';

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

  // Main navigation & document state
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'create'>('overview');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
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
  const [createForm, setCreateForm] = useState({
    title: '',
    amount: '',
    receiver: '',
    bankName: '',
    bankAccount: '',
    content: '',
    deadline: '',
    selectedFile: null as File | null,
  });

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
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        // If viewing a document, refresh its details too
        if (selectedDoc) {
          const fresh = data.find((d: DocumentItem) => d.id === selectedDoc.id);
          if (fresh) setSelectedDoc(fresh);
        }
      }
    } catch {
      // Backend not connected or offline
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated, tabFilter, statusFilter]);

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
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setIsAuthenticated(true);
      showToast('Đăng nhập thành công!');
    } catch (err: any) {
      setAuthError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.');
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
    showToast('Đã đăng xuất');
  };

  // Quick Account Switcher (logs in with password 123456)
  const switchAccount = async (email: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: '123456' }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('access_token', data.access_token);
        if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setSelectedDoc(null);
        showToast(`Đã chuyển sang tài khoản: ${data.user.name}`);
        fetchDocuments();
      } else {
        showToast(data.message || 'Chuyển tài khoản thất bại', 'error');
      }
    } catch {
      showToast('Không thể kết nối máy chủ để đổi tài khoản', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // File Upload with Pre-Signed URL
  const uploadAttachmentReal = async (file: File): Promise<number | null> => {
    const token = localStorage.getItem('access_token');
    if (!token) return null;

    try {
      // 1. Get Pre-Signed URL from backend
      const presignRes = await fetch(`${API_BASE_URL}/attachments/presigned-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          size: file.size,
        }),
      });

      if (!presignRes.ok) {
        const err = await presignRes.json();
        throw new Error(err.message || 'Lỗi lấy pre-signed URL');
      }

      const { uploadUrl, fileUrl } = await presignRes.json();

      // 2. Upload binary file to destination storage (với Authorization header & Pre-signed URL)
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

  // Create Payment Request
  const handleCreateDocument = async (e: React.FormEvent, submitNow: boolean = false) => {
    e.preventDefault();
    if (isProcessing) return;

    if (!createForm.title || !createForm.amount || !createForm.receiver || !createForm.bankName || !createForm.bankAccount) {
      showToast('Vui lòng điền đầy đủ các thông tin thanh toán bắt buộc!', 'error');
      return;
    }

    if (submitNow && !createForm.selectedFile) {
      showToast('Quy định HVE: Bắt buộc đính kèm ít nhất 1 chứng từ / hóa đơn trước khi gửi duyệt!', 'error');
      return;
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
          throw new Error('Không thể tải chứng từ lên. Vui lòng thử lại.');
        }
      }

      // Create Payment Request draft
      const res = await fetch(`${API_BASE_URL}/documents/payment-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: createForm.title,
          amount: parseFloat(createForm.amount),
          receiver: createForm.receiver,
          bankName: createForm.bankName,
          bankAccount: createForm.bankAccount,
          content: createForm.content,
          deadline: createForm.deadline || new Date().toISOString().split('T')[0],
          attachmentIds,
        }),
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
      setCreateForm({
        title: '',
        amount: '',
        receiver: '',
        bankName: '',
        bankAccount: '',
        content: '',
        deadline: '',
        selectedFile: null,
      });

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
  const handleApproveStep = async (doc: DocumentItem, step: ApprovalStep) => {
    setIsProcessing(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(
        `${API_BASE_URL}/documents/${doc.id}/steps/${step.id}/approve?version=${doc.version}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ comment: `Đồng ý duyệt bởi ${user?.name}` }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Phê duyệt thất bại');
      }
      setSelectedDoc(data);
      showToast(data.status === 'Đã duyệt' ? 'Hồ sơ đã được CEO duyệt hoàn tất!' : 'Đã duyệt bước thành công!');
      fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi phê duyệt', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm Return or Reject with mandatory Reason
  const handleConfirmActionModal = async () => {
    if (!modalAction.comment.trim()) {
      showToast('Bắt buộc phải nhập lý do cụ thể!', 'error');
      return;
    }

    setIsProcessing(true);
    const token = localStorage.getItem('access_token');
    const endpoint = modalAction.type === 'return' ? 'return' : 'reject';

    try {
      const res = await fetch(
        `${API_BASE_URL}/documents/${modalAction.docId}/steps/${modalAction.stepId}/${endpoint}?version=${selectedDoc?.version}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ comment: modalAction.comment }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Thao tác thất bại');
      }

      setSelectedDoc(data);
      setModalAction({ isOpen: false, type: 'return', stepId: 0, docId: 0, comment: '' });
      showToast(
        modalAction.type === 'return'
          ? 'Hồ sơ đã được trả lại về trạng thái Nháp để người tạo chỉnh sửa.'
          : 'Hồ sơ đã bị từ chối phê duyệt.',
      );
      fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi thực hiện thao tác', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Create New Version for Approved Document
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
        throw new Error(data.message || 'Tạo phiên bản mới thất bại');
      }
      setSelectedDoc(data);
      showToast(`Đã tạo bản sửa đổi mới (${data.code}) ở trạng thái Nháp!`);
      fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Lỗi tạo phiên bản mới', 'error');
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
            ✓ Đã duyệt
          </span>
        );
      case 'Chờ duyệt':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
            ⏳ Chờ duyệt
          </span>
        );
      case 'Trả lại':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
            ↩ Trả lại sửa
          </span>
        );
      case 'Từ chối':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            ✗ Từ chối
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            📝 Bản nháp
          </span>
        );
    }
  };

  // Filtered documents by search & status
  const filteredDocuments = documents.filter((doc) => {
    const matchSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.dataJson?.receiver && doc.dataJson.receiver.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchSearch;
  });

  const pendingCount = documents.filter((d) => d.status === 'Chờ duyệt').length;
  const approvedCount = documents.filter((d) => d.status === 'Đã duyệt').length;
  const draftCount = documents.filter((d) => d.status === 'Nháp').length;

  // View: Login Page
  if (!isAuthenticated) {
    return (
      <LoginPage
        authError={authError}
        isProcessing={isProcessing}
        onLogin={handleLogin}
        onSwitchAccount={switchAccount}
      />
    );
  }

  // View: Main Application
  return (
    <div className="min-h-screen flex bg-slate-100 text-[#1D1D1F]">
      <Toast toast={toast} />

      <Sidebar
        activeTab={activeTab}
        pendingCount={pendingCount}
        user={user}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSelectedDoc(null);
        }}
        onLogout={handleLogout}
        onSwitchAccount={switchAccount}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-gray-900">
              {activeTab === 'overview' && 'Tổng quan điều hành'}
              {activeTab === 'documents' && 'Quản lý Đề nghị thanh toán'}
              {activeTab === 'create' && 'Tạo hồ sơ đề nghị thanh toán'}
            </h2>
            {selectedDoc && (
              <span className="text-sm text-gray-400 font-medium">/ Chi tiết {selectedDoc.code}</span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-500">
              Đang đăng nhập: <strong className="text-gray-800">{user?.name}</strong> ({user?.roles?.map((r: string) => ROLE_LABELS[r] || r).join(', ')})
            </span>
          </div>
        </header>

        {/* Tab Body */}
        <div className="flex-1 p-8 overflow-y-auto">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <OverviewDashboard
              pendingCount={pendingCount}
              approvedCount={approvedCount}
              draftCount={draftCount}
              documents={documents}
              getStatusBadge={getStatusBadge}
              onSelectDoc={(doc) => {
                setSelectedDoc(doc);
                setActiveTab('documents');
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
                  onApproveStep={handleApproveStep}
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
        </div>
      </main>

      <ActionReasonModal
        modalAction={modalAction}
        isProcessing={isProcessing}
        onClose={() => setModalAction({ ...modalAction, isOpen: false })}
        onChangeComment={(comment) => setModalAction({ ...modalAction, comment })}
        onConfirm={handleConfirmActionModal}
      />
    </div>
  );
}
