export type UserWithBusinessScope = {
  id: number;
  departmentId?: number | null;
  department?: { id?: number | null; name?: string | null } | null;
  roles?: Array<string | { name: string }>;
};

export function getRoleNames(user: UserWithBusinessScope): string[] {
  return [...new Set((user.roles || []).map((role) =>
    typeof role === 'string' ? role : role.name,
  ))].sort();
}

export function getDepartmentId(user: UserWithBusinessScope): number | null {
  return user.departmentId || user.department?.id || null;
}

export function hasBusinessRole(
  user: UserWithBusinessScope,
  roleName: string,
): boolean {
  return getRoleNames(user).includes(roleName);
}

/**
 * Phạm vi hồ sơ là hợp (union) của tất cả vai trò người dùng:
 * - CEO: toàn công ty.
 * - Trưởng phòng: toàn bộ hồ sơ do người trong phòng tạo.
 * - Kế toán / Pháp chế: hồ sơ thuộc nghiệp vụ tương ứng trên toàn công ty.
 * - Mọi người: hồ sơ do chính mình tạo và hồ sơ đang chờ vai trò của mình xử lý.
 * Prisma OR tự khử trùng lặp khi một hồ sơ khớp nhiều vai trò.
 */
export function buildDocumentAccessWhere(user: UserWithBusinessScope): any {
  const roles = getRoleNames(user);
  if (roles.includes('ceo')) return {};

  const departmentId = getDepartmentId(user);
  const conditions: any[] = [{ createdById: user.id }];

  if (roles.includes('department_head') && departmentId) {
    conditions.push({ createdBy: { departmentId } });
  }
  if (roles.includes('accountant')) {
    conditions.push({ type: 'payment_request' });
  }
  if (roles.includes('legal')) {
    conditions.push({ type: 'contract' });
  }

  const actionableRoles = roles.filter((role) =>
    !['employee', 'it_admin', 'department_head'].includes(role),
  );
  if (actionableRoles.length > 0) {
    conditions.push({
      steps: {
        some: {
          status: 'pending',
          roleRequired: { in: actionableRoles },
        },
      },
    });
  }

  return { OR: conditions };
}

/**
 * Phạm vi công việc theo cấp quản lý. Người có nhiều vai trò nhận hợp quyền
 * cao nhất, nhưng một bản ghi chỉ xuất hiện một lần.
 */
export function buildTaskAccessWhere(user: UserWithBusinessScope): any {
  const roles = getRoleNames(user);
  if (roles.includes('ceo')) return {};

  const departmentId = getDepartmentId(user);
  if (roles.includes('department_head') && departmentId) {
    return {
      OR: [
        { assignee: { departmentId } },
        { createdBy: { departmentId } },
      ],
    };
  }

  return {
    OR: [
      { assigneeId: user.id },
      { createdById: user.id },
    ],
  };
}

export function describeBusinessScope(user: UserWithBusinessScope) {
  const roles = getRoleNames(user);
  const departmentId = getDepartmentId(user);
  const isCeo = roles.includes('ceo');
  const isDepartmentHead = roles.includes('department_head') && !!departmentId;

  return {
    level: isCeo ? 'company' : isDepartmentHead ? 'department' : 'personal',
    label: isCeo
      ? 'Toàn công ty'
      : isDepartmentHead
        ? `Phòng ban${user.department?.name ? ` ${user.department.name}` : ''}`
        : 'Dữ liệu của tôi',
    departmentId,
    roles,
    capabilities: {
      canViewCompany: isCeo,
      canViewDepartment: isCeo || isDepartmentHead,
      canAssignTasks: isCeo || roles.includes('department_head'),
      canViewFinancials: isCeo || roles.includes('accountant'),
      canViewLegal: isCeo || roles.includes('legal'),
      canManageSystem: roles.includes('it_admin'),
    },
  };
}
