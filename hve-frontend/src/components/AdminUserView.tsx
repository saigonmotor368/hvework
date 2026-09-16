import React, { useState, useEffect } from 'react';
import { type AdminUser, type RoleItem, type DepartmentItem, ROLE_LABELS } from '../types';

interface AdminUserViewProps {
  apiBaseUrl: string;
  currentUser: any;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export const AdminUserView: React.FC<AdminUserViewProps> = ({
  apiBaseUrl,
  currentUser,
  showToast,
}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [search, setSearch] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Edit Modal State
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | ''>('');
  const [isSavingUser, setIsSavingUser] = useState<boolean>(false);

  const DEFAULT_DEPARTMENTS: DepartmentItem[] = [
    { id: 1, name: 'Phòng Công nghệ Thông tin', code: 'IT' },
    { id: 2, name: 'Phòng Tài chính - Kế toán', code: 'FIN' },
    { id: 3, name: 'Phòng Kinh doanh & Tuyển sinh', code: 'KD' },
    { id: 4, name: 'Ban Pháp chế & Thẩm định', code: 'LEG' },
  ];

  const DEFAULT_ROLES: RoleItem[] = [
    { id: 1, name: 'employee', description: 'Nhân viên - Lập hồ sơ và thực hiện công việc' },
    { id: 2, name: 'department_head', description: 'Trưởng bộ phận - Phê duyệt sơ bộ & Giao việc phòng' },
    { id: 3, name: 'accountant', description: 'Kế toán - Rà soát hóa đơn, duyệt chi và ngân sách' },
    { id: 4, name: 'legal', description: 'Pháp chế - Thẩm định hợp đồng kinh tế và pháp lý' },
    { id: 5, name: 'ceo', description: 'Chủ tịch / CEO - Phê duyệt cấp cao nhất toàn công ty' },
    { id: 6, name: 'it_admin', description: 'Quản trị IT - Cấu hình hệ thống & Quản lý phân quyền' },
  ];

  const DEFAULT_USERS: AdminUser[] = [
    {
      id: 1,
      name: 'Nguyễn Văn An',
      email: 'nv1@huyvoeducation.vn',
      status: 'active',
      departmentId: 3,
      department: DEFAULT_DEPARTMENTS[2],
      roles: [DEFAULT_ROLES[0]],
    },
    {
      id: 2,
      name: 'Trần Minh Tuấn',
      email: 'tp_it@huyvoeducation.vn',
      status: 'active',
      departmentId: 1,
      department: DEFAULT_DEPARTMENTS[0],
      roles: [DEFAULT_ROLES[1], DEFAULT_ROLES[0]],
    },
    {
      id: 3,
      name: 'Trần Thị Mai',
      email: 'ketoan@huyvoeducation.vn',
      status: 'active',
      departmentId: 2,
      department: DEFAULT_DEPARTMENTS[1],
      roles: [DEFAULT_ROLES[2], DEFAULT_ROLES[1]],
    },
    {
      id: 4,
      name: 'Hoàng Kim Ngân',
      email: 'phapche@huyvoeducation.vn',
      status: 'active',
      departmentId: 4,
      department: DEFAULT_DEPARTMENTS[3],
      roles: [DEFAULT_ROLES[3], DEFAULT_ROLES[0]],
    },
    {
      id: 5,
      name: 'Võ Huy Định',
      email: 'ceo@huyvoeducation.vn',
      status: 'active',
      departmentId: null,
      roles: [DEFAULT_ROLES[4]],
    },
    {
      id: 6,
      name: 'Lê Hoàng Minh',
      email: 'admin@huyvoeducation.vn',
      status: 'active',
      departmentId: 1,
      department: DEFAULT_DEPARTMENTS[0],
      roles: [DEFAULT_ROLES[5]],
    },
  ];

  const fetchUsersAndMeta = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('access_token');
    try {
      const [uRes, rRes, dRes] = await Promise.all([
        fetch(`${apiBaseUrl}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBaseUrl}/admin/roles`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBaseUrl}/admin/departments`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (uRes.ok && rRes.ok && dRes.ok) {
        const uData = await uRes.json();
        const rData = await rRes.json();
        const dData = await dRes.json();
        setUsers(uData);
        setRoles(rData);
        setDepartments(dData);
      } else {
        throw new Error('Fallback to default admin data');
      }
    } catch {
      // Offline fallback
      setUsers(DEFAULT_USERS);
      setRoles(DEFAULT_ROLES);
      setDepartments(DEFAULT_DEPARTMENTS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndMeta();
  }, []);

  const handleToggleStatus = async (user: AdminUser) => {
    if (user.id === currentUser?.id && user.status === 'active') {
      showToast('Quy định an toàn: Bạn không được tự khóa tài khoản của chính mình', 'error');
      return;
    }

    const nextStatus = user.status === 'active' ? 'locked' : 'active';
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch(`${apiBaseUrl}/admin/users/${user.id}/status`, {
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
        );
        setUsers(
          users.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)),
        );
      } else {
        const err = await res.json();
        showToast(err.message || 'Lỗi cập nhật trạng thái', 'error');
      }
    } catch {
      showToast('Lỗi kết nối máy chủ', 'error');
    }
  };

  const handleOpenEdit = (user: AdminUser) => {
    setEditUser(user);
    setSelectedRoleIds(user.roles.map((r) => r.id));
    setSelectedDeptId(user.department?.id || user.departmentId || '');
  };

  const handleToggleRoleCheckbox = (roleId: number) => {
    if (selectedRoleIds.includes(roleId)) {
      if (selectedRoleIds.length <= 1) {
        showToast('Người dùng phải có tối thiểu 1 vai trò', 'error');
        return;
      }
      setSelectedRoleIds(selectedRoleIds.filter((id) => id !== roleId));
    } else {
      setSelectedRoleIds([...selectedRoleIds, roleId]);
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setIsSavingUser(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch(`${apiBaseUrl}/admin/users/${editUser.id}/roles`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roleIds: selectedRoleIds,
          departmentId: selectedDeptId === '' ? null : Number(selectedDeptId),
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        showToast(`Đã cập nhật phân quyền cho ${editUser.name}`);
        setUsers(
          users.map((u) =>
            u.id === editUser.id
              ? {
                  ...u,
                  department: updated.department,
                  roles: updated.roles,
                }
              : u,
          ),
        );
        setEditUser(null);
      } else {
        const err = await res.json();
        showToast(err.message || 'Lỗi phân quyền', 'error');
      }
    } catch {
      showToast('Lỗi kết nối máy chủ', 'error');
    } finally {
      setIsSavingUser(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchDept =
      deptFilter === 'all' ||
      String(u.department?.id || u.departmentId) === deptFilter;
    return matchSearch && matchDept;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <span className="mr-2.5">👥</span> Quản lý Người dùng & Phân quyền Vai trò
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Xem danh sách nhân sự, gán vai trò phê duyệt, phân phòng ban và quản lý trạng thái tài khoản
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-3">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="text-xs font-medium bg-slate-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
          >
            <option value="all">Tất cả phòng ban</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Tìm tên, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs bg-slate-50 border border-gray-200 rounded-lg px-3.5 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3.5">Họ và tên</th>
              <th className="px-6 py-3.5">Email</th>
              <th className="px-6 py-3.5">Phòng ban</th>
              <th className="px-6 py-3.5">Vai trò đảm nhiệm</th>
              <th className="px-6 py-3.5">Trạng thái</th>
              <th className="px-6 py-3.5 text-right">Thao tác</th>
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
                  <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap">
                    {user.name}
                    {user.id === currentUser?.id && (
                      <span className="ml-2 text-[10px] font-bold bg-blue-100 text-[#0A66C2] px-1.5 py-0.5 rounded">
                        Bạn
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-600 whitespace-nowrap">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs font-semibold text-gray-700 bg-slate-100 px-2.5 py-1 rounded-md">
                      {user.department?.name || 'Chưa gán'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4 whitespace-nowrap">
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
                  <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                    <button
                      onClick={() => handleOpenEdit(user)}
                      className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-[#0A66C2] hover:bg-blue-50 transition-all"
                    >
                      Phân quyền
                    </button>
                    <button
                      onClick={() => handleToggleStatus(user)}
                      disabled={user.id === currentUser?.id}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all disabled:opacity-40 ${
                        user.status === 'active'
                          ? 'border border-red-200 text-red-600 hover:bg-red-50'
                          : 'border border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      {user.status === 'active' ? 'Khóa' : 'Mở khóa'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Role & Department Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h4 className="text-base font-bold text-gray-900 mb-1">
              Phân quyền: {editUser.name}
            </h4>
            <p className="text-xs text-gray-500 mb-5">{editUser.email}</p>

            <div className="space-y-4">
              {/* Department */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Phòng ban trực thuộc
                </label>
                <select
                  value={selectedDeptId}
                  onChange={(e) =>
                    setSelectedDeptId(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full text-xs font-medium bg-slate-50 border border-gray-200 rounded-lg p-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
                >
                  <option value="">-- Không trực thuộc phòng ban --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Roles */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Danh sách Vai trò trong hệ thống
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-1">
                  {roles.map((r) => {
                    const isChecked = selectedRoleIds.includes(r.id);
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
                          onChange={() => handleToggleRoleCheckbox(r.id)}
                          className="w-4 h-4 text-[#0A66C2] rounded border-gray-300 focus:ring-[#0A66C2]"
                        />
                      </label>
                    );
                  })}
                </div>
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
                {isSavingUser ? 'Đang lưu...' : 'Lưu phân quyền'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
