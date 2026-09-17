import React, { useState, useEffect } from 'react';
import { type AdminUser, type RoleItem, type ProjectItem, ROLE_LABELS, DOCUMENT_TYPE_LABELS } from '../types';
import { fetchWithSession } from '../api/client';

interface AdminUserViewProps {
  apiBaseUrl: string;
  currentUser: any;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface StuckTask {
  id: number;
  code: string;
  title: string;
  status: string;
  priority: string;
  progressPercent: number;
  createdAt: string;
  createdBy?: { id: number; name: string; email: string };
  assignee?: { id: number; name: string; email: string };
  _count?: { subTasks: number };
}

interface StuckDocument {
  id: number;
  code: string;
  title: string;
  type: string;
  status: string;
  createdAt: string;
  createdBy?: { id: number; name: string; email: string };
  steps?: Array<{ stepOrder: number; roleRequired: string; status: string }>;
}

export const AdminUserView: React.FC<AdminUserViewProps> = ({
  apiBaseUrl,
  currentUser,
  showToast,
}) => {
  // Main view tabs: 'users' or 'stuck_data'
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'stuck_data'>('users');

  // Users & Meta State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [search, setSearch] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [renderedAt] = useState(() => Date.now());

  // Stuck Data State
  const [stuckTasks, setStuckTasks] = useState<StuckTask[]>([]);
  const [stuckDocs, setStuckDocs] = useState<StuckDocument[]>([]);
  const [isLoadingStuck, setIsLoadingStuck] = useState<boolean>(false);
  const [stuckSearch, setStuckSearch] = useState<string>('');

  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('Hve@2026');
  const [newProjectIds, setNewProjectIds] = useState<number[]>([]);
  const [newRoleIds, setNewRoleIds] = useState<number[]>([1]); // default employee
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);

  // Edit User Modal State
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editRoleIds, setEditRoleIds] = useState<number[]>([]);
  const [editProjectIds, setEditProjectIds] = useState<number[]>([]);
  const [editDelegateToUserId, setEditDelegateToUserId] = useState<string>('');
  const [editDelegateUntil, setEditDelegateUntil] = useState<string>('');
  const [isSavingUser, setIsSavingUser] = useState<boolean>(false);

  // Reset Password Modal State
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState<string>('Hve@2026');
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Delete Confirmation Modal State (for Task or Document)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'task' | 'document';
    id: number;
    code: string;
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const DEFAULT_ROLES: RoleItem[] = [
    { id: 1, name: 'employee', description: 'Nhân viên - Lập hồ sơ và thực hiện công việc' },
    { id: 2, name: 'department_head', description: 'Trưởng bộ phận - Phê duyệt sơ bộ & Giao việc phòng' },
    { id: 3, name: 'accountant', description: 'Kế toán - Rà soát hóa đơn, duyệt chi và ngân sách' },
    { id: 4, name: 'legal', description: 'Pháp chế - Thẩm định hợp đồng kinh tế và pháp lý' },
    { id: 5, name: 'ceo', description: 'Chủ tịch / CEO - Phê duyệt cấp cao nhất toàn công ty' },
    { id: 6, name: 'it_admin', description: 'Quản trị IT - Cấu hình hệ thống & Quản lý phân quyền' },
    { id: 7, name: 'bgd', description: 'Ban Giám Đốc - Xem toàn bộ dữ liệu công ty, không thực thi lệnh' },
  ];

  const fetchUsersAndMeta = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('access_token');
    try {
      const [uRes, rRes, pRes] = await Promise.all([
        fetchWithSession(`${apiBaseUrl}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetchWithSession(`${apiBaseUrl}/admin/roles`, { headers: { Authorization: `Bearer ${token}` } }),
        fetchWithSession(`${apiBaseUrl}/projects/admin`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (uRes.ok && rRes.ok) {
        const uData = await uRes.json();
        const rData = await rRes.json();
        setUsers(uData);
        setRoles(rData);
      }
      if (pRes.ok) {
        setProjects(await pRes.json());
      }
    } catch {
      setRoles(DEFAULT_ROLES);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStuckData = async () => {
    setIsLoadingStuck(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetchWithSession(`${apiBaseUrl}/admin/stuck-data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStuckTasks(data.tasks || []);
        setStuckDocs(data.documents || []);
      }
    } catch {
      showToast('Không thể tải dữ liệu hệ thống', 'error');
    } finally {
      setIsLoadingStuck(false);
    }
  };

  useEffect(() => {
    fetchUsersAndMeta();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'stuck_data') {
      fetchStuckData();
    }
  }, [activeSubTab]);

  // Toggle user status (lock/unlock)
  const handleToggleStatus = async (user: AdminUser) => {
    if (user.id === currentUser?.id && user.status === 'active') {
      showToast('Quy định an toàn: Bạn không được tự khóa tài khoản của chính mình', 'error');
      return;
    }

    const nextStatus = user.status === 'active' ? 'locked' : 'active';
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetchWithSession(`${apiBaseUrl}/admin/users/${user.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        showToast(
          nextStatus === 'locked'
            ? `Đã khóa tài khoản ${user.email}`
            : `Đã mở khóa tài khoản ${user.email}`,
          'success',
        );
        setUsers(users.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));
      } else {
        const err = await res.json();
        showToast(err.message || 'Lỗi cập nhật trạng thái', 'error');
      }
    } catch {
      showToast('Lỗi kết nối máy chủ', 'error');
    }
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      showToast('Vui lòng điền đầy đủ họ tên và email', 'error');
      return;
    }
    if (newRoleIds.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 vai trò cho người dùng', 'error');
      return;
    }

    setIsCreatingUser(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetchWithSession(`${apiBaseUrl}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          password: newPassword || 'Hve@2026',
          projectIds: newProjectIds,
          roleIds: newRoleIds,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        showToast(`Đã thêm thành công người dùng ${created.name}`, 'success');
        await fetchUsersAndMeta();
        setIsAddModalOpen(false);
        setNewName('');
        setNewEmail('');
        setNewPassword('Hve@2026');
        setNewProjectIds([]);
        setNewRoleIds([1]);
      } else {
        const err = await res.json();
        showToast(err.message || 'Lỗi khi tạo người dùng', 'error');
      }
    } catch {
      showToast('Lỗi kết nối máy chủ', 'error');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (user: AdminUser) => {
    setEditUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRoleIds(user.roles.map((r) => r.id));
    setEditProjectIds([
      ...new Set([
        ...(user.ledProjects || []).map((p) => p.id),
        ...(user.projectMemberships || []).map((m) => m.project.id),
      ]),
    ]);
    setEditDelegateToUserId(user.delegateToUserId ? String(user.delegateToUserId) : '');
    setEditDelegateUntil(user.delegateUntil ? user.delegateUntil.slice(0, 10) : '');
  };

  // Toggle Role Checkbox in Edit Modal
  const handleToggleEditRole = (roleId: number) => {
    if (editRoleIds.includes(roleId)) {
      if (editRoleIds.length <= 1) {
        showToast('Người dùng phải có tối thiểu 1 vai trò', 'error');
        return;
      }
      setEditRoleIds(editRoleIds.filter((id) => id !== roleId));
    } else {
      setEditRoleIds([...editRoleIds, roleId]);
    }
  };

  // Save User Edit (Name, Email, Dept, Roles)
  const handleSaveEdit = async () => {
    if (!editUser) return;
    if (!editName.trim() || !editEmail.trim()) {
      showToast('Họ tên và email không được để trống', 'error');
      return;
    }
    if (editRoleIds.length === 0) {
      showToast('Phải chọn ít nhất 1 vai trò', 'error');
      return;
    }
    if (editDelegateToUserId && !editDelegateUntil) {
      showToast('Vui lòng chọn ngày hết hạn ủy quyền', 'error');
      return;
    }

    setIsSavingUser(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetchWithSession(`${apiBaseUrl}/admin/users/${editUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim().toLowerCase(),
          roleIds: editRoleIds,
          projectIds: editProjectIds,
        }),
      });

      const updated = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(updated.message || 'Lỗi cập nhật thông tin');

      const delegationChanged =
        String(editUser.delegateToUserId || '') !== editDelegateToUserId ||
        (editUser.delegateUntil?.slice(0, 10) || '') !== editDelegateUntil;
      if (delegationChanged) {
        const delegationRes = await fetchWithSession(
          `${apiBaseUrl}/admin/users/${editUser.id}/delegate`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(
              editDelegateToUserId
                ? {
                    delegateToUserId: Number(editDelegateToUserId),
                    delegateUntil: new Date(`${editDelegateUntil}T23:59:59`).toISOString(),
                  }
                : { delegateToUserId: null, delegateUntil: null },
            ),
          },
        );
        const delegationBody = await delegationRes.json().catch(() => ({}));
        if (!delegationRes.ok) {
          throw new Error(delegationBody.message || 'Không thể cập nhật ủy quyền duyệt');
        }
      }

      showToast(`Đã cập nhật thông tin cho ${updated.name}`, 'success');
      await fetchUsersAndMeta();
      setEditUser(null);
    } catch (error: any) {
      showToast(error.message || 'Lỗi kết nối máy chủ', 'error');
    } finally {
      setIsSavingUser(false);
    }
  };

  // Reset Password
  const handleConfirmResetPassword = async () => {
    if (!resetUser) return;
    setIsResetting(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetchWithSession(`${apiBaseUrl}/admin/users/${resetUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          newPassword: resetNewPassword || 'Hve@2026',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(data.message || `Đã đặt lại mật khẩu cho ${resetUser.name}`, 'success');
        setResetUser(null);
        setResetNewPassword('Hve@2026');
      } else {
        const err = await res.json();
        showToast(err.message || 'Lỗi khi đặt lại mật khẩu', 'error');
      }
    } catch {
      showToast('Lỗi kết nối máy chủ', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // Delete Stuck Data (Task or Document)
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const token = localStorage.getItem('access_token');

    const url =
      deleteTarget.type === 'task'
        ? `${apiBaseUrl}/admin/tasks/${deleteTarget.id}`
        : `${apiBaseUrl}/admin/documents/${deleteTarget.id}`;

    try {
      const res = await fetchWithSession(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'Đã xóa thành công', 'success');
        if (deleteTarget.type === 'task') {
          setStuckTasks(stuckTasks.filter((t) => t.id !== deleteTarget.id));
        } else {
          setStuckDocs(stuckDocs.filter((d) => d.id !== deleteTarget.id));
        }
        setDeleteTarget(null);
      } else {
        const err = await res.json();
        showToast(err.message || 'Lỗi khi xóa dữ liệu', 'error');
      }
    } catch {
      showToast('Lỗi kết nối máy chủ', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const userProjectIds = [
      ...(u.ledProjects || []).map((p) => p.id),
      ...(u.projectMemberships || []).map((m) => m.project.id),
    ];
    const matchProject = projectFilter === 'all' || userProjectIds.includes(Number(projectFilter));
    return matchSearch && matchProject;
  });

  const filteredStuckTasks = stuckTasks.filter(
    (t) =>
      t.code.toLowerCase().includes(stuckSearch.toLowerCase()) ||
      t.title.toLowerCase().includes(stuckSearch.toLowerCase()) ||
      (t.assignee?.name && t.assignee.name.toLowerCase().includes(stuckSearch.toLowerCase())),
  );

  const filteredStuckDocs = stuckDocs.filter(
    (d) =>
      d.code.toLowerCase().includes(stuckSearch.toLowerCase()) ||
      d.title.toLowerCase().includes(stuckSearch.toLowerCase()) ||
      (d.createdBy?.name && d.createdBy.name.toLowerCase().includes(stuckSearch.toLowerCase())),
  );

  return (
    <div className="min-w-0 space-y-4 md:space-y-6">
      {/* Sub-tab Switcher Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex min-w-0 items-start space-x-2">
            <span className="text-2xl">🛠️</span>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                Quản trị Hệ thống IT
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Quyền hạn Trưởng phòng IT: Quản lý nhân sự, phân quyền, cấp lại mật khẩu và dọn dẹp dữ liệu treo
              </p>
            </div>
          </div>
        </div>

        {/* View Toggle Tabs */}
        <div className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl md:flex md:w-auto md:items-center md:space-x-1">
          <button
            onClick={() => setActiveSubTab('users')}
            className={`px-2 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${
              activeSubTab === 'users'
                ? 'bg-white text-[#0A66C2] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            👥 Quản lý Người dùng ({users.length})
          </button>
          <button
            onClick={() => setActiveSubTab('stuck_data')}
            className={`px-2 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${
              activeSubTab === 'stuck_data'
                ? 'bg-white text-red-600 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🧹 Dữ liệu Bị Treo & Dọn dẹp
          </button>
        </div>
      </div>

      {/* ===================== TAB 1: USERS MANAGEMENT ===================== */}
      {activeSubTab === 'users' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-3">
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0A66C2] sm:w-auto"
              >
                <option value="all">Tất cả dự án</option>
                {projects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Tìm tên, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-gray-200 rounded-lg px-3.5 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A66C2] sm:w-64"
              />
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex w-full items-center justify-center px-4 py-2 rounded-xl bg-[#0A66C2] text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition-all md:w-auto"
            >
              <span className="mr-1.5 text-base leading-none">➕</span> Thêm người dùng mới
            </button>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="mobile-scroll overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Họ và tên</th>
                    <th className="px-5 py-3.5">Email</th>
                    <th className="px-5 py-3.5">Dự án</th>
                    <th className="px-5 py-3.5">Vai trò đảm nhiệm</th>
                    <th className="px-5 py-3.5">Trạng thái</th>
                    <th className="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                        Đang tải danh sách người dùng...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                        Không tìm thấy người dùng phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 font-bold text-gray-900 whitespace-nowrap">
                          {user.name}
                          {user.id === currentUser?.id && (
                            <span className="ml-2 text-[10px] font-bold bg-blue-100 text-[#0A66C2] px-1.5 py-0.5 rounded">
                              Bạn
                            </span>
                          )}
                          {user.delegateTo && user.delegateUntil && new Date(user.delegateUntil).getTime() >= renderedAt && (
                            <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700" title={`Ủy quyền duyệt cho ${user.delegateTo.name} đến ${new Date(user.delegateUntil).toLocaleDateString('vi-VN')}`}>
                              🔄 Đang ủy quyền
                            </span>
                          )}
                          {(user.delegatedFrom?.length || 0) > 0 && (
                            <span className="ml-2 rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-700" title={`Đang nhận ủy quyền từ ${user.delegatedFrom?.map((item) => item.name).join(', ')}`}>
                              🔄 Duyệt thay
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-600 whitespace-nowrap">
                          {user.email}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {[
                              ...(user.ledProjects || []).map((p) => p.code),
                              ...(user.projectMemberships || []).map((m) => m.project.code),
                            ].length > 0 ? (
                              [...new Set([
                                ...(user.ledProjects || []).map((p) => p.code),
                                ...(user.projectMemberships || []).map((m) => m.project.code),
                              ])].map((code) => (
                                <span
                                  key={code}
                                  className="text-xs font-semibold text-gray-700 bg-slate-100 px-2 py-0.5 rounded-md"
                                >
                                  {code}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">Chưa gán</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {user.roles.map((r) => (
                              <span
                                key={r.id}
                                className="text-[11px] font-bold bg-blue-50 text-[#0A66C2] px-2 py-0.5 rounded border border-blue-200"
                              >
                                {ROLE_LABELS[r.name] || r.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {user.status === 'active' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              ● Hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                              🔒 Đã khóa
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center space-x-1.5">
                            {/* Edit Button */}
                            <button
                              onClick={() => handleOpenEdit(user)}
                              title="Sửa thông tin & Phân quyền"
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-[#0A66C2] hover:bg-blue-50 transition-all"
                            >
                              ✏️ Sửa
                            </button>

                            {/* Reset Password Button */}
                            <button
                              onClick={() => {
                                setResetUser(user);
                                setResetNewPassword('Hve@2026');
                              }}
                              title="Cấp lại mật khẩu mặc định (Hve@2026)"
                              className="px-2.5 py-1 rounded-lg border border-amber-200 text-xs font-bold text-amber-700 hover:bg-amber-50 transition-all"
                            >
                              🔑 Reset MK
                            </button>

                            {/* Lock / Unlock Button */}
                            <button
                              onClick={() => handleToggleStatus(user)}
                              disabled={user.id === currentUser?.id}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all disabled:opacity-40 ${
                                user.status === 'active'
                                  ? 'border border-red-200 text-red-600 hover:bg-red-50'
                                  : 'border border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {user.status === 'active' ? 'Khóa' : 'Mở'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: STUCK DATA MANAGEMENT ===================== */}
      {activeSubTab === 'stuck_data' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3">
            <span className="text-xl">⚠️</span>
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="block font-bold mb-0.5">Lưu ý quản trị IT:</strong>
              Chức năng này cho phép dọn dẹp các công việc hoặc hồ sơ quy trình bị treo, bị kẹt phê duyệt, hoặc dữ liệu thử nghiệm thừa.
              Hành động xóa sẽ giải phóng toàn bộ luồng, xóa bình luận và tài liệu đính kèm liên quan. Vui lòng xác nhận kỹ trước khi xóa!
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="text"
              placeholder="Lọc mã công việc, mã hồ sơ hoặc tiêu đề..."
              value={stuckSearch}
              onChange={(e) => setStuckSearch(e.target.value)}
              className="w-full text-xs bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A66C2] shadow-xs sm:w-80"
            />
            <button
              onClick={fetchStuckData}
              disabled={isLoadingStuck}
              className="px-3 py-1.5 text-xs font-bold text-[#0A66C2] bg-blue-50 rounded-lg hover:bg-blue-100 transition-all"
            >
              🔄 Làm mới dữ liệu
            </button>
          </div>

          {/* Section 1: Stuck Tasks */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900 flex items-center">
                <span className="mr-2">📋</span> Danh sách Công việc ({filteredStuckTasks.length})
              </h4>
              <span className="text-[11px] text-gray-500">Bao gồm công việc chưa làm, đang làm hoặc bị treo</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Mã CV</th>
                    <th className="px-4 py-3">Tiêu đề</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Tiến độ</th>
                    <th className="px-4 py-3">Người tạo</th>
                    <th className="px-4 py-3">Phụ trách</th>
                    <th className="px-4 py-3 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingStuck ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        Đang tải danh sách công việc...
                      </td>
                    </tr>
                  ) : filteredStuckTasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        Không có công việc nào.
                      </td>
                    </tr>
                  ) : (
                    filteredStuckTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-mono font-bold text-[#0A66C2]">
                          {task.code}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                          {task.title}
                          {task._count?.subTasks ? (
                            <span className="ml-2 text-[10px] bg-slate-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {task._count.subTasks} việc con
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700">
                            {task.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-700">
                          {task.progressPercent}%
                        </td>
                        <td className="px-4 py-3 text-gray-600">{task.createdBy?.name || 'Hệ thống'}</td>
                        <td className="px-4 py-3 text-gray-600">{task.assignee?.name || 'Chưa gán'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() =>
                              setDeleteTarget({
                                type: 'task',
                                id: task.id,
                                code: task.code,
                                title: task.title,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50 transition-all"
                          >
                            🗑️ Xóa
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Stuck Documents */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900 flex items-center">
                <span className="mr-2">📑</span> Danh sách Hồ sơ & Đề xuất ({filteredStuckDocs.length})
              </h4>
              <span className="text-[11px] text-gray-500">Hồ sơ chờ phê duyệt, đã trả lại hoặc cần giải phóng</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Mã hồ sơ</th>
                    <th className="px-4 py-3">Tiêu đề hồ sơ</th>
                    <th className="px-4 py-3">Loại hồ sơ</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Người tạo</th>
                    <th className="px-4 py-3">Tiến trình duyệt</th>
                    <th className="px-4 py-3 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingStuck ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        Đang tải danh sách hồ sơ...
                      </td>
                    </tr>
                  ) : filteredStuckDocs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        Không có hồ sơ nào.
                      </td>
                    </tr>
                  ) : (
                    filteredStuckDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-mono font-bold text-[#0A66C2]">
                          {doc.code}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                          {doc.title}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {DOCUMENT_TYPE_LABELS[doc.type] || doc.type}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              doc.status === 'Đã duyệt'
                                ? 'bg-emerald-100 text-emerald-800'
                                : doc.status === 'Chờ duyệt'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-gray-700'
                            }`}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{doc.createdBy?.name || 'Hệ thống'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1">
                            {(doc.steps || []).map((st) => (
                              <span
                                key={st.stepOrder}
                                title={`${ROLE_LABELS[st.roleRequired] || st.roleRequired}: ${st.status}`}
                                className={`w-2.5 h-2.5 rounded-full ${
                                  st.status === 'approved'
                                    ? 'bg-emerald-500'
                                    : st.status === 'returned'
                                    ? 'bg-amber-500'
                                    : st.status === 'rejected'
                                    ? 'bg-red-500'
                                    : 'bg-slate-300'
                                }`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() =>
                              setDeleteTarget({
                                type: 'document',
                                id: doc.id,
                                code: doc.code,
                                title: doc.title,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50 transition-all"
                          >
                            🗑️ Xóa
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 1: ADD NEW USER ===================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="mobile-scroll max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h4 className="text-base font-bold text-gray-900 flex items-center">
                <span className="mr-2">➕</span> Thêm người dùng mới
              </h4>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Email đăng nhập <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="Ví dụ: nva@huyvoeducation.vn"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Mật khẩu khởi tạo
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mặc định: Hve@2026"
                  className="w-full text-xs font-mono font-medium bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
                />
                <p className="text-[11px] text-gray-400 mt-1">Mặc định hệ thống là Hve@2026</p>
              </div>

              {/* Projects */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Dự án tham gia
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto p-1 border border-slate-100 rounded-xl sm:grid-cols-2">
                  {projects.map((p) => {
                    const isChecked = newProjectIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'border-[#0A66C2] bg-blue-50/60 font-bold text-[#0A66C2]'
                            : 'border-slate-200 text-gray-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setNewProjectIds(
                              isChecked
                                ? newProjectIds.filter((id) => id !== p.id)
                                : [...newProjectIds, p.id],
                            );
                          }}
                        />
                        <span>{p.name} ({p.code})</span>
                      </label>
                    );
                  })}
                  {projects.length === 0 && (
                    <p className="col-span-full text-center text-[11px] text-gray-400 py-2">
                      Chưa có dự án nào — tạo dự án ở mục "Quản lý dự án" trước.
                    </p>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Vị trí (vai trò) + Dự án quyết định phạm vi dữ liệu người dùng được xem/xử lý.
                </p>
              </div>

              {/* Roles */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Vai trò đảm nhiệm <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto p-1 border border-slate-100 rounded-xl sm:grid-cols-2">
                  {roles.map((r) => {
                    const isChecked = newRoleIds.includes(r.id);
                    return (
                      <label
                        key={r.id}
                        className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'border-[#0A66C2] bg-blue-50/60 font-bold text-[#0A66C2]'
                            : 'border-slate-200 text-gray-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setNewRoleIds(newRoleIds.filter((id) => id !== r.id));
                            } else {
                              setNewRoleIds([...newRoleIds, r.id]);
                            }
                          }}
                          className="rounded text-[#0A66C2] focus:ring-[#0A66C2]"
                        />
                        <span>{ROLE_LABELS[r.name] || r.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2.5 pt-4 border-t border-slate-100 sm:flex sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isCreatingUser}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-slate-50 sm:w-auto"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="w-full px-5 py-2 rounded-xl bg-[#0A66C2] text-white text-xs font-bold hover:bg-blue-700 shadow-sm sm:w-auto"
                >
                  {isCreatingUser ? 'Đang tạo...' : 'Tạo người dùng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL 2: EDIT USER (NAME, EMAIL, DEPT, ROLES) ===================== */}
      {editUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="mobile-scroll max-h-[90vh] overflow-y-auto bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h4 className="text-base font-bold text-gray-900 flex items-center">
                <span className="mr-2">✏️</span> Sửa thông tin & Phân quyền
              </h4>
              <button
                onClick={() => setEditUser(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Họ tên */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Họ và tên
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Email đăng nhập
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
                />
              </div>

              {/* Projects */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Dự án tham gia
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto p-1 border border-slate-100 rounded-xl sm:grid-cols-2">
                  {projects.map((p) => {
                    const isChecked = editProjectIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'border-[#0A66C2] bg-blue-50/60 font-bold text-[#0A66C2]'
                            : 'border-slate-200 text-gray-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setEditProjectIds(
                              isChecked
                                ? editProjectIds.filter((id) => id !== p.id)
                                : [...editProjectIds, p.id],
                            );
                          }}
                        />
                        <span>{p.name} ({p.code})</span>
                      </label>
                    );
                  })}
                  {projects.length === 0 && (
                    <p className="col-span-full text-center text-[11px] text-gray-400 py-2">
                      Chưa có dự án nào — tạo dự án ở mục "Quản lý dự án" trước.
                    </p>
                  )}
                </div>
              </div>

              {/* Roles */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Danh sách Vai trò đảm nhiệm
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-1">
                  {roles.map((r) => {
                    const isChecked = editRoleIds.includes(r.id);
                    return (
                      <label
                        key={r.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'border-[#0A66C2] bg-blue-50/50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold text-gray-800 block">
                            {ROLE_LABELS[r.name] || r.name}
                          </span>
                          <span className="text-[11px] text-gray-400">{r.description || r.name}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleEditRole(r.id)}
                          className="w-4 h-4 text-[#0A66C2] rounded border-gray-300 focus:ring-[#0A66C2]"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-violet-800">
                  Ủy quyền duyệt tạm thời
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    value={editDelegateToUserId}
                    onChange={(event) => {
                      setEditDelegateToUserId(event.target.value);
                      if (!event.target.value) setEditDelegateUntil('');
                    }}
                    className="w-full rounded-lg border border-violet-200 bg-white p-2.5 text-xs"
                  >
                    <option value="">-- Không ủy quyền --</option>
                    {users
                      .filter((candidate) => candidate.status === 'active' && candidate.id !== editUser.id)
                      .map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>{candidate.name} — {candidate.email}</option>
                      ))}
                  </select>
                  <input
                    type="date"
                    value={editDelegateUntil}
                    min={new Date().toISOString().slice(0, 10)}
                    disabled={!editDelegateToUserId}
                    onChange={(event) => setEditDelegateUntil(event.target.value)}
                    className="w-full rounded-lg border border-violet-200 bg-white p-2.5 text-xs disabled:opacity-50"
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-violet-700">
                  Người nhận chỉ mượn quyền phê duyệt theo đúng vai trò và dự án của {editUser.name}; không nhận quyền quản trị hay giao việc.
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2.5 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditUser(null)}
                disabled={isSavingUser}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingUser}
                className="px-5 py-2 rounded-xl bg-[#0A66C2] text-white text-xs font-bold hover:bg-blue-700 shadow-sm"
              >
                {isSavingUser ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 3: RESET PASSWORD ===================== */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-lg">
                🔑
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">Đặt lại Mật khẩu</h4>
                <p className="text-xs text-gray-500">{resetUser.name} ({resetUser.email})</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Mật khẩu mới sẽ được gán cho người dùng này, đồng thời mở khóa tài khoản và xóa các lần nhập sai nếu có.
            </p>

            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Mật khẩu mới
              </label>
              <input
                type="text"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                className="w-full text-xs font-mono font-bold bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">Mặc định: Hve@2026</span>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResetUser(null)}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmResetPassword}
                disabled={isResetting}
                className="px-5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 shadow-sm"
              >
                {isResetting ? 'Đang cập nhật...' : 'Xác nhận Đặt lại Mật khẩu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 4: DELETE STUCK DATA CONFIRMATION ===================== */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-lg">
                🗑️
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">
                  Xác nhận xóa {deleteTarget.type === 'task' ? 'Công việc' : 'Hồ sơ'}
                </h4>
                <p className="text-xs text-red-600 font-mono font-bold">{deleteTarget.code}</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-2 leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn dữ liệu bị treo này?
            </p>
            <div className="bg-slate-50 p-3 rounded-xl text-xs font-bold text-gray-800 mb-4 border border-slate-200">
              {deleteTarget.title}
            </div>
            <p className="text-[11px] text-red-500 mb-5">
              ⚠️ Mọi quy trình, việc con, tài liệu đính kèm và bình luận liên quan sẽ bị xóa vĩnh viễn khỏi hệ thống!
            </p>

            <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 shadow-sm"
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
