import { useState, useEffect } from 'react';

// Interfaces
interface ApprovalStep {
  id: number;
  stepOrder: number;
  roleRequired: string;
  status: 'not_started' | 'pending' | 'approved' | 'returned' | 'rejected';
  actedById?: number;
  actedAt?: string;
  comment?: string;
}

interface DocumentItem {
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

const ROLE_LABELS: Record<string, string> = {
  employee: 'Nhân viên',
  department_head: 'Trưởng bộ phận',
  accountant: 'Kế toán',
  legal: 'Pháp chế',
  ceo: 'CEO',
  it_admin: 'IT Admin',
};

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

  // Fetch documents from backend API
  const fetchDocuments = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      let url = `http://localhost:3000/documents?tab=${tabFilter}`;
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
          const updatedSelected = data.find((d: DocumentItem) => d.id === selectedDoc.id);
          if (updatedSelected) {
            setSelectedDoc(updatedSelected);
          }
        }
      }
    } catch {
      // Backend offline fallback handled gracefully
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
    }
  }, [isAuthenticated, tabFilter, statusFilter]);

  // Auth: Login
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError('');
    setIsProcessing(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const response = await fetch('http://localhost:3000/auth/login', {
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
      const response = await fetch('http://localhost:3000/auth/login', {
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
        showToast(`Đã chuyển sang: ${data.user.name} (${data.user.roles.join(', ')})`);
        fetchDocuments();
      }
    } catch (err: any) {
      showToast(err.message || 'Chuyển tài khoản thất bại', 'error');
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
      const presignRes = await fetch('http://localhost:3000/attachments/presigned-url', {
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

      // 2. Upload binary file to destination storage
      const fullUploadUrl = uploadUrl.startsWith('http') ? uploadUrl : `http://localhost:3000${uploadUrl}`;
      const uploadRes = await fetch(fullUploadUrl, {
        method: 'PUT',
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Lỗi tải tệp lên máy chủ lưu trữ');
      }

      // 3. Register Attachment Metadata in DB
      const regRes = await fetch('http://localhost:3000/attachments/register', {
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

      const attachment = await regRes.json();
      return attachment.id;
    } catch (err: any) {
      showToast(err.message || 'Tải chứng từ thất bại', 'error');
      return null;
    }
  };

  // Create Payment Request
  const handleCreateDocument = async (e: React.FormEvent, submitNow = false) => {
    e.preventDefault();
    if (!createForm.title || !createForm.amount || !createForm.receiver || !createForm.bankName || !createForm.bankAccount) {
      showToast('Vui lòng điền đầy đủ các thông tin thanh toán bắt buộc', 'error');
      return;
    }

    if (submitNow && !createForm.selectedFile) {
      showToast('Quy định nghiệp vụ: Bắt buộc phải đính kèm ít nhất 1 chứng từ / hóa đơn trước khi gửi duyệt!', 'error');
      return;
    }

    setIsProcessing(true);
    const token = localStorage.getItem('access_token');

    try {
      let attachmentIds: number[] = [];
      if (createForm.selectedFile) {
        const attId = await uploadAttachmentReal(createForm.selectedFile);
        if (attId) {
          attachmentIds.push(attId);
        } else if (submitNow) {
          setIsProcessing(false);
          return;
        }
      }

      // Create Payment Request draft
      const res = await fetch('http://localhost:3000/documents/payment-requests', {
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
        const submitRes = await fetch(`http://localhost:3000/documents/${doc.id}/submit`, {
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
      const res = await fetch(`http://localhost:3000/documents/${doc.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gửi duyệt thất bại');
      }
      setSelectedDoc(data);
      showToast('Đã gửi hồ sơ lên Trưởng bộ phận phê duyệt!');
      fetchDocuments();
    } catch (err: any) {
      showToast(err.message || 'Gửi duyệt thất bại', 'error');
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
        `http://localhost:3000/documents/${doc.id}/steps/${step.id}/approve?version=${doc.version}`,
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
        `http://localhost:3000/documents/${modalAction.docId}/steps/${modalAction.stepId}/${endpoint}?version=${selectedDoc?.version}`,
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
      const res = await fetch(`http://localhost:3000/documents/${doc.id}/new-version`, {
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

  // Status Badge UI Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Nháp':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">Bản nháp</span>;
      case 'Chờ duyệt':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 animate-pulse">Chờ duyệt</span>;
      case 'Đã duyệt':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">Đã duyệt ✓</span>;
      case 'Trả lại':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-900">Trả lại để sửa</span>;
      case 'Từ chối':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">Từ chối ✗</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  // Search filter
  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      doc.code.toLowerCase().includes(q) ||
      doc.title.toLowerCase().includes(q) ||
      (doc.dataJson?.receiver && doc.dataJson.receiver.toLowerCase().includes(q))
    );
  });

  const pendingCount = documents.filter((d) => d.status === 'Chờ duyệt').length;
  const approvedCount = documents.filter((d) => d.status === 'Đã duyệt').length;
  const draftCount = documents.filter((d) => d.status === 'Nháp').length;

  // View: Login Page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0A66C2] text-white text-2xl font-bold shadow-lg shadow-blue-500/30">
            HVE
          </div>
          <h2 className="mt-4 text-3xl font-extrabold text-[#1D1D1F] tracking-tight">HVE Work</h2>
          <p className="mt-1 text-sm text-gray-500">Hệ thống điều hành & Phê duyệt nội bộ chuyên nghiệp</p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/60 rounded-2xl sm:px-10 border border-slate-100">
            <form className="space-y-5" onSubmit={handleLogin}>
              {authError && (
                <div className="text-sm text-red-700 bg-red-50 p-3 rounded-lg border border-red-100">
                  {authError}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700">Email công việc</label>
                <input
                  name="email"
                  type="email"
                  defaultValue="nv1@hve.com"
                  required
                  className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700">Mật khẩu</label>
                <input
                  name="password"
                  type="password"
                  defaultValue="123456"
                  required
                  className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full flex justify-center py-2.5 px-4 rounded-lg shadow-md text-sm font-semibold text-white bg-[#0A66C2] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0A66C2] transition-all disabled:opacity-50"
              >
                {isProcessing ? 'Đang đăng nhập...' : 'Đăng nhập vào hệ thống'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center mb-3">
                Chuyển tài khoản đăng nhập nhanh:
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => switchAccount('nv1@hve.com')}
                  className="p-2 text-xs font-medium text-center rounded-lg bg-blue-50 text-[#0A66C2] hover:bg-blue-100"
                >
                  Nhân viên
                </button>
                <button
                  type="button"
                  onClick={() => switchAccount('ketoan@hve.com')}
                  className="p-2 text-xs font-medium text-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                >
                  Trưởng BP/Kế toán
                </button>
                <button
                  type="button"
                  onClick={() => switchAccount('ceo@hve.com')}
                  className="p-2 text-xs font-medium text-center rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100"
                >
                  CEO
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // View: Main Application
  return (
    <div className="min-h-screen flex bg-slate-100 text-[#1D1D1F]">
      {/* Notification Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center px-4 py-3 rounded-xl shadow-lg border transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between">
        <div>
          {/* Logo Header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-100 space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#0A66C2] text-white flex items-center justify-center font-bold text-lg shadow-sm">
              HVE
            </div>
            <div>
              <h1 className="text-base font-bold text-[#1D1D1F]">HVE Work</h1>
              <span className="text-[11px] text-gray-400 font-medium tracking-tight">Quy trình điều hành</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => {
                setActiveTab('overview');
                setSelectedDoc(null);
              }}
              className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'overview'
                  ? 'bg-blue-50 text-[#0A66C2] font-semibold'
                  : 'text-gray-600 hover:bg-slate-50'
              }`}
            >
              <span className="mr-3">📊</span> Tổng quan điều hành
            </button>

            <button
              onClick={() => {
                setActiveTab('documents');
                setSelectedDoc(null);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'documents'
                  ? 'bg-blue-50 text-[#0A66C2] font-semibold'
                  : 'text-gray-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center">
                <span className="mr-3">📑</span> Đề nghị thanh toán
              </div>
              {pendingCount > 0 && (
                <span className="bg-amber-100 text-amber-900 text-xs px-2 py-0.5 rounded-full font-bold">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('create');
                setSelectedDoc(null);
              }}
              className={`w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'create'
                  ? 'bg-blue-50 text-[#0A66C2] font-semibold'
                  : 'text-gray-600 hover:bg-slate-50'
              }`}
            >
              <span className="mr-3">➕</span> Tạo đề nghị mới
            </button>
          </nav>
        </div>

        {/* User Info & Demo Switcher */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-bold text-gray-900 truncate">{user?.name}</p>
              <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-red-600 hover:text-red-700 font-semibold p-1 hover:bg-red-50 rounded"
              title="Đăng xuất"
            >
              Thoát
            </button>
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {user?.roles?.map((r: string) => (
              <span key={r} className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-[#0A66C2]">
                {ROLE_LABELS[r] || r}
              </span>
            ))}
          </div>

          {/* Quick Demo Role Switcher */}
          <div className="pt-2 border-t border-slate-200">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Chuyển vai trò test:
            </span>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => switchAccount('nv1@hve.com')}
                className={`px-1.5 py-1 text-[10px] font-semibold rounded ${
                  user?.email === 'nv1@hve.com' ? 'bg-[#0A66C2] text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
                }`}
              >
                Nhân viên
              </button>
              <button
                onClick={() => switchAccount('ketoan@hve.com')}
                className={`px-1.5 py-1 text-[10px] font-semibold rounded ${
                  user?.email === 'ketoan@hve.com' ? 'bg-[#0A66C2] text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
                }`}
              >
                Trưởng BP
              </button>
              <button
                onClick={() => switchAccount('ceo@hve.com')}
                className={`px-1.5 py-1 text-[10px] font-semibold rounded ${
                  user?.email === 'ceo@hve.com' ? 'bg-[#0A66C2] text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
                }`}
              >
                CEO
              </button>
            </div>
          </div>
        </div>
      </aside>

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
            <div className="space-y-8">
              {/* Key Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Hồ sơ chờ phê duyệt</span>
                    <p className="mt-2 text-3xl font-extrabold text-amber-900">{pendingCount}</p>
                    <p className="text-xs text-gray-400 mt-1">Cần xử lý kịp tiến độ</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-bold">
                    ⏳
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Đã duyệt hoàn tất</span>
                    <p className="mt-2 text-3xl font-extrabold text-emerald-900">{approvedCount}</p>
                    <p className="text-xs text-gray-400 mt-1">Đã thông qua CEO</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold">
                    ✓
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Bản nháp đang soạn</span>
                    <p className="mt-2 text-3xl font-extrabold text-blue-900">{draftCount}</p>
                    <p className="text-xs text-gray-400 mt-1">Chưa gửi duyệt</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl font-bold">
                    📝
                  </div>
                </div>
              </div>

              {/* Recent Items */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-900">Hồ sơ thanh toán gần đây</h3>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className="text-xs font-semibold text-[#0A66C2] hover:underline"
                  >
                    Xem tất cả ({documents.length}) →
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {documents.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 text-center">Chưa có hồ sơ nào.</p>
                  ) : (
                    documents.slice(0, 4).map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => {
                          setSelectedDoc(doc);
                          setActiveTab('documents');
                        }}
                        className="py-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer rounded-lg px-3 transition-all"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-[#0A66C2]">{doc.code}</span>
                            <span className="text-sm font-semibold text-gray-800">{doc.title}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Số tiền: <strong className="text-gray-700">{doc.dataJson?.amount?.toLocaleString('vi-VN')} VND</strong> — Người nhận: {doc.dataJson?.receiver}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          {getStatusBadge(doc.status)}
                          <span className="text-xs text-gray-400">v{doc.version}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DOCUMENTS LIST & DETAIL */}
          {activeTab === 'documents' && (
            <div>
              {!selectedDoc ? (
                /* Documents Table View */
                <div className="space-y-6">
                  {/* Toolbar */}
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Tab selection */}
                    <div className="flex rounded-xl bg-slate-100 p-1">
                      <button
                        onClick={() => setTabFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          tabFilter === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        Tất cả
                      </button>
                      <button
                        onClick={() => setTabFilter('my')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          tabFilter === 'my' ? 'bg-white shadow text-[#0A66C2]' : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        Hồ sơ của tôi
                      </button>
                      <button
                        onClick={() => setTabFilter('to_review')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          tabFilter === 'to_review' ? 'bg-white shadow text-amber-800' : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        Cần tôi duyệt
                      </button>
                    </div>

                    {/* Filter Dropdowns & Search */}
                    <div className="flex items-center space-x-3">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="text-xs font-medium bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
                      >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="Nháp">Bản nháp</option>
                        <option value="Chờ duyệt">Chờ duyệt</option>
                        <option value="Đã duyệt">Đã duyệt</option>
                        <option value="Trả lại">Trả lại để sửa</option>
                        <option value="Từ chối">Bị từ chối</option>
                      </select>

                      <input
                        type="text"
                        placeholder="Tìm mã, tiêu đề, người nhận..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-xs bg-slate-50 border border-gray-200 rounded-lg px-3.5 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
                      />

                      <button
                        onClick={() => setActiveTab('create')}
                        className="px-3.5 py-2 rounded-lg bg-[#0A66C2] text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition-all"
                      >
                        + Tạo mới
                      </button>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-3.5">Mã hồ sơ</th>
                          <th className="px-6 py-3.5">Tiêu đề đề nghị</th>
                          <th className="px-6 py-3.5">Số tiền (VND)</th>
                          <th className="px-6 py-3.5">Người đề nghị</th>
                          <th className="px-6 py-3.5">Trạng thái</th>
                          <th className="px-6 py-3.5">Hạn thanh toán</th>
                          <th className="px-6 py-3.5 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredDocuments.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-400">
                              Chưa có hồ sơ thanh toán phù hợp với bộ lọc hiện tại.
                            </td>
                          </tr>
                        ) : (
                          filteredDocuments.map((doc) => (
                            <tr
                              key={doc.id}
                              onClick={() => setSelectedDoc(doc)}
                              className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                            >
                              <td className="px-6 py-4 font-bold text-[#0A66C2] whitespace-nowrap">
                                {doc.code}
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-semibold text-gray-900 line-clamp-1">{doc.title}</p>
                                <p className="text-xs text-gray-400 line-clamp-1">Thụ hưởng: {doc.dataJson?.receiver}</p>
                              </td>
                              <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap">
                                {doc.dataJson?.amount?.toLocaleString('vi-VN')} đ
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-medium text-gray-800">{doc.createdBy?.name || 'Nhân viên'}</span>
                                <span className="block text-[11px] text-gray-400">{doc.createdBy?.department?.name || 'Phòng ban'}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(doc.status)}</td>
                              <td className="px-6 py-4 text-xs text-gray-600 whitespace-nowrap">
                                {doc.dataJson?.deadline}
                              </td>
                              <td className="px-6 py-4 text-right whitespace-nowrap">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDoc(doc);
                                  }}
                                  className="text-xs font-bold text-[#0A66C2] hover:underline"
                                >
                                  Xem chi tiết →
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Document Detail View */
                <div className="space-y-6">
                  {/* Back button & versioning */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedDoc(null)}
                      className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center"
                    >
                      ← Quay lại danh sách hồ sơ
                    </button>
                    <span className="text-xs text-gray-400">Phiên bản hồ sơ: v{selectedDoc.version}</span>
                  </div>

                  {/* Header Card */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-100 gap-4">
                      <div>
                        <div className="flex items-center space-x-3">
                          <h3 className="text-xl font-extrabold text-gray-900">{selectedDoc.title}</h3>
                          {getStatusBadge(selectedDoc.status)}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Mã hồ sơ: <strong className="text-gray-700">{selectedDoc.code}</strong> — Tạo lúc:{' '}
                          {new Date(selectedDoc.createdAt).toLocaleString('vi-VN')} bởi {selectedDoc.createdBy?.name} ({selectedDoc.createdBy?.department?.name || 'IT'})
                        </p>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center space-x-2">
                        {selectedDoc.status === 'Nháp' && selectedDoc.createdById === user?.id && (
                          <button
                            onClick={() => handleSubmitDraft(selectedDoc)}
                            disabled={isProcessing}
                            className="px-4 py-2 rounded-xl bg-[#0A66C2] text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
                          >
                            {isProcessing ? 'Đang gửi...' : '🚀 Gửi duyệt hồ sơ'}
                          </button>
                        )}

                        {selectedDoc.status === 'Đã duyệt' && selectedDoc.createdById === user?.id && (
                          <button
                            onClick={() => handleCreateNewVersion(selectedDoc)}
                            disabled={isProcessing}
                            className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 shadow-sm transition-all disabled:opacity-50"
                          >
                            {isProcessing ? 'Đang xử lý...' : '📄 Tạo bản sửa đổi (v' + (selectedDoc.version + 1) + ')'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 text-sm">
                      <div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Số tiền đề nghị</span>
                        <p className="text-2xl font-black text-[#0A66C2] mt-1">
                          {selectedDoc.dataJson?.amount?.toLocaleString('vi-VN')} VND
                        </p>
                      </div>

                      <div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Đơn vị thụ hưởng</span>
                        <p className="font-bold text-gray-800 mt-1">{selectedDoc.dataJson?.receiver}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {selectedDoc.dataJson?.bankName} - STK: <strong className="text-gray-700">{selectedDoc.dataJson?.bankAccount}</strong>
                        </p>
                      </div>

                      <div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Hạn thanh toán</span>
                        <p className="font-bold text-gray-800 mt-1">{selectedDoc.dataJson?.deadline}</p>
                      </div>

                      <div className="md:col-span-3">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Nội dung chi tiết</span>
                        <p className="text-gray-700 mt-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                          {selectedDoc.dataJson?.content}
                        </p>
                      </div>
                    </div>

                    {/* Attachments Section */}
                    {selectedDoc.attachments && selectedDoc.attachments.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-slate-100">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3">
                          Chứng từ & Hóa đơn đính kèm ({selectedDoc.attachments.length})
                        </span>
                        <div className="flex flex-wrap gap-3">
                          {selectedDoc.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={`http://localhost:3000${att.fileUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#0A66C2] transition-colors"
                            >
                              <span>📎</span>
                              <span>{att.fileName}</span>
                              <span className="text-gray-400 text-[10px]">({Math.round(att.size / 1024)} KB)</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4-Step Approval Timeline */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h4 className="text-base font-bold text-gray-900 mb-6">
                      Tiến trình phê duyệt 4 cấp (Workflow Timeline)
                    </h4>

                    {selectedDoc.steps && selectedDoc.steps.length > 0 ? (
                      <div className="relative">
                        <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-200 -z-0" />

                        <div className="space-y-6">
                          {/* Step 0: Creator */}
                          <div className="flex items-start space-x-4 relative z-10">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-white">
                              ✓
                            </div>
                            <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-500 uppercase">Cấp 0: Người tạo</span>
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Đã khởi tạo & gửi duyệt</span>
                              </div>
                              <p className="text-sm font-bold text-gray-800 mt-1">{selectedDoc.createdBy?.name || 'Nhân viên'}</p>
                              <p className="text-xs text-gray-400">{new Date(selectedDoc.createdAt).toLocaleString('vi-VN')}</p>
                            </div>
                          </div>

                          {/* Approval Steps */}
                          {selectedDoc.steps.map((step) => {
                            const isPending = step.status === 'pending';
                            const isApproved = step.status === 'approved';
                            const isReturned = step.status === 'returned';
                            const isRejected = step.status === 'rejected';

                            const isCreator = selectedDoc.createdById === user?.id;
                            const hasRole = user?.roles?.includes(step.roleRequired);
                            const canAct = isPending && hasRole && !isCreator;

                            return (
                              <div key={step.id} className="flex items-start space-x-4 relative z-10">
                                <div
                                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ring-4 ring-white ${
                                    isApproved
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : isPending
                                      ? 'bg-amber-100 text-amber-800 animate-pulse'
                                      : isReturned
                                      ? 'bg-orange-100 text-orange-800'
                                      : isRejected
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-gray-100 text-gray-400'
                                  }`}
                                >
                                  {isApproved ? '✓' : isPending ? '⏳' : isReturned ? '↩' : isRejected ? '✗' : step.stepOrder}
                                </div>

                                <div className="flex-1 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-500 uppercase">
                                      Cấp {step.stepOrder}: {ROLE_LABELS[step.roleRequired] || step.roleRequired}
                                    </span>
                                    {isApproved && (
                                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                        Đã phê duyệt
                                      </span>
                                    )}
                                    {isPending && (
                                      <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded animate-pulse">
                                        Đang chờ duyệt
                                      </span>
                                    )}
                                    {isReturned && (
                                      <span className="text-xs font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded">
                                        Đã trả lại để sửa
                                      </span>
                                    )}
                                    {isRejected && (
                                      <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                                        Đã từ chối
                                      </span>
                                    )}
                                    {step.status === 'not_started' && (
                                      <span className="text-xs font-medium text-gray-400">Chưa đến lượt</span>
                                    )}
                                  </div>

                                  {step.comment && (
                                    <p className="text-xs text-gray-700 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                      Ý kiến: <em className="font-medium">"{step.comment}"</em>
                                    </p>
                                  )}
                                  {step.actedAt && (
                                    <p className="text-[11px] text-gray-400 mt-1.5">
                                      Xử lý lúc: {new Date(step.actedAt).toLocaleString('vi-VN')}
                                    </p>
                                  )}

                                  {/* Step Action Bar */}
                                  {isPending && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                      {isCreator ? (
                                        <div className="text-xs font-semibold text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-center">
                                          <span className="mr-2">⚠️</span>
                                          Quy định Anti Self-Approval: Bạn là người tạo hồ sơ này nên không thể tự phê duyệt.
                                        </div>
                                      ) : canAct ? (
                                        <div className="flex items-center space-x-2">
                                          <button
                                            onClick={() => handleApproveStep(selectedDoc, step)}
                                            disabled={isProcessing}
                                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
                                          >
                                            {isProcessing ? 'Đang duyệt...' : '✓ Phê duyệt'}
                                          </button>
                                          <button
                                            onClick={() =>
                                              setModalAction({
                                                isOpen: true,
                                                type: 'return',
                                                stepId: step.id,
                                                docId: selectedDoc.id,
                                                comment: '',
                                              })
                                            }
                                            disabled={isProcessing}
                                            className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 shadow-sm transition-all disabled:opacity-50"
                                          >
                                            Trả lại để sửa
                                          </button>
                                          <button
                                            onClick={() =>
                                              setModalAction({
                                                isOpen: true,
                                                type: 'reject',
                                                stepId: step.id,
                                                docId: selectedDoc.id,
                                                comment: '',
                                              })
                                            }
                                            disabled={isProcessing}
                                            className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 shadow-sm transition-all disabled:opacity-50"
                                          >
                                            Từ chối hồ sơ
                                          </button>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-gray-400 italic">
                                          Đang chờ duyệt bởi người có vai trò{' '}
                                          <strong className="text-gray-600">{ROLE_LABELS[step.roleRequired] || step.roleRequired}</strong>.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-xs text-gray-400">
                        Hồ sơ đang ở trạng thái Nháp — chưa tạo các bước phê duyệt.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CREATE FORM */}
          {activeTab === 'create' && (
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-gray-900">Tạo Đề Nghị Thanh Toán Mới</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Điền đầy đủ thông tin và đính kèm chứng từ theo mẫu quy định của HVE Work
                </p>
              </div>

              <form className="space-y-6" onSubmit={(e) => handleCreateDocument(e, false)}>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Tiêu đề đề nghị thanh toán <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Thanh toán tiền bản quyền phần mềm thiết kế Q3"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Số tiền thanh toán (VND) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="VD: 5000000"
                      value={createForm.amount}
                      onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                      className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm font-bold text-[#0A66C2] focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                    />
                    {createForm.amount && (
                      <span className="text-xs text-gray-500 mt-1 block">
                        = {Number(createForm.amount).toLocaleString('vi-VN')} đ
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Hạn thanh toán <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={createForm.deadline}
                      onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
                      className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Đơn vị / Người thụ hưởng <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Công ty TNHH ABC"
                      value={createForm.receiver}
                      onChange={(e) => setCreateForm({ ...createForm, receiver: e.target.value })}
                      className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Ngân hàng <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Vietcombank CN Tân Bình"
                      value={createForm.bankName}
                      onChange={(e) => setCreateForm({ ...createForm, bankName: e.target.value })}
                      className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Số tài khoản <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: 0071001234567"
                      value={createForm.bankAccount}
                      onChange={(e) => setCreateForm({ ...createForm, bankAccount: e.target.value })}
                      className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Nội dung thanh toán chi tiết <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Mô tả mục đích chi tiết, căn cứ hợp đồng hoặc thỏa thuận..."
                    value={createForm.content}
                    onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
                    className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                  />
                </div>

                {/* Real Attachment Upload */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Đính kèm chứng từ / Hóa đơn (PDF, DOCX, XLSX, JPG, PNG - Tối đa 10MB) <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1.5 flex items-center space-x-3">
                    <input
                      type="file"
                      accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCreateForm({ ...createForm, selectedFile: file });
                        }
                      }}
                      className="text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0A66C2] hover:file:bg-blue-100 cursor-pointer"
                    />
                    {createForm.selectedFile && (
                      <span className="text-xs font-bold text-emerald-600">
                        ✓ Đã chọn: {createForm.selectedFile.name} ({Math.round(createForm.selectedFile.size / 1024)} KB)
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveTab('documents')}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                  >
                    Hủy bỏ
                  </button>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isProcessing ? 'Đang lưu...' : 'Lưu bản nháp'}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleCreateDocument(e, true)}
                    disabled={isProcessing}
                    className="px-5 py-2.5 rounded-xl bg-[#0A66C2] text-white text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50"
                  >
                    {isProcessing ? 'Đang gửi...' : 'Gửi duyệt ngay →'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Modal for Return / Reject with mandatory comment */}
      {modalAction.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in">
            <h4 className="text-base font-bold text-gray-900 mb-1">
              {modalAction.type === 'return' ? 'Lý do trả lại hồ sơ để sửa' : 'Lý do từ chối hồ sơ'}
            </h4>
            <p className="text-xs text-gray-500 mb-4">
              {modalAction.type === 'return'
                ? 'Hồ sơ sẽ quay về trạng thái Nháp. Người tạo sẽ nhận thông báo kèm lý do dưới đây để sửa đổi.'
                : 'Hồ sơ sẽ chuyển sang trạng thái Từ chối và kết thúc quy trình phê duyệt.'}
            </p>

            <textarea
              rows={4}
              required
              placeholder="Vui lòng nhập lý do cụ thể (bắt buộc)..."
              value={modalAction.comment}
              onChange={(e) => setModalAction({ ...modalAction, comment: e.target.value })}
              className="w-full p-3 text-sm bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white mb-4"
            />

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setModalAction({ ...modalAction, isOpen: false })}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-slate-100"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={handleConfirmActionModal}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-50 ${
                  modalAction.type === 'return' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isProcessing ? 'Đang xử lý...' : modalAction.type === 'return' ? 'Xác nhận trả lại' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
