export type UserWithBusinessScope = {
  id: number;
  departmentId?: number | null;
  department?: { id?: number | null; name?: string | null } | null;
  roles?: Array<string | { name: string }>;
  ledProjects?: Array<{ id: number; name?: string | null; isActive?: boolean }>;
  projectMemberships?: Array<{
    projectId?: number;
    project?: { id: number; name?: string | null; isActive?: boolean } | null;
  }>;
};

export function getRoleNames(user: UserWithBusinessScope): string[] {
  return [...new Set((user.roles || []).map((role) =>
    typeof role === 'string' ? role : role.name,
  ))].sort();
}

export function getDepartmentId(user: UserWithBusinessScope): number | null {
  return user.departmentId || user.department?.id || null;
}

export function getUserProjectIds(user: UserWithBusinessScope): number[] {
  const ids = [
    ...(user.ledProjects || [])
      .filter((project) => project.isActive !== false)
      .map((project) => project.id),
    ...(user.projectMemberships || [])
      .filter((membership) => membership.project?.isActive !== false)
      .map((membership) => membership.projectId || membership.project?.id)
      .filter((id): id is number => typeof id === 'number'),
  ];
  return [...new Set(ids)].sort((a, b) => a - b);
}

function linkedProjectConditions(projectIds: number[]) {
  return projectIds.map((projectId) => ({
    linkedProjectIds: { array_contains: [projectId] },
  }));
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
  // BGĐ (Ban Giám Đốc) xem toàn bộ như CEO nhưng không có quyền thực thi —
  // quyền thực thi được chặn ở tầng RolesGuard/@Roles trên từng endpoint ghi
  // dữ liệu (approve/reject/create/...), không liệt kê 'bgd' ở đó.
  if (roles.includes('ceo') || roles.includes('bgd')) return {};

  const departmentId = getDepartmentId(user);
  const conditions: any[] = [{ createdById: user.id }];

  if (roles.includes('department_head')) {
    const projectIds = getUserProjectIds(user);
    if (projectIds.length > 0) {
      conditions.push({ projectId: { in: projectIds } });
      conditions.push(...linkedProjectConditions(projectIds));
    }
    if (departmentId) {
      conditions.push({
        AND: [{ projectId: null }, { createdBy: { departmentId } }],
      });
    }
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
  if (roles.includes('ceo') || roles.includes('bgd')) return {};

  const departmentId = getDepartmentId(user);
  const conditions: any[] = [
    { assigneeId: user.id },
    { createdById: user.id },
  ];
  if (roles.includes('department_head')) {
    const projectIds = getUserProjectIds(user);
    if (projectIds.length > 0) {
      conditions.push({ projectId: { in: projectIds } });
      conditions.push(...linkedProjectConditions(projectIds));
    }
    if (departmentId) {
      conditions.push({
        AND: [
          { projectId: null },
          {
            OR: [
              { assignee: { departmentId } },
              { createdBy: { departmentId } },
            ],
          },
        ],
      });
    }
  }

  return { OR: conditions };
}

export function describeBusinessScope(user: UserWithBusinessScope) {
  const roles = getRoleNames(user);
  const departmentId = getDepartmentId(user);
  const projectIds = getUserProjectIds(user);
  const isCeoStrict = roles.includes('ceo');
  // "isCeo" ở đây chỉ dùng cho phạm vi XEM (view) — BGĐ xem như CEO nhưng
  // không có quyền thực thi, nên các capability hành động (canAssignTasks...)
  // phải dùng isCeoStrict, không dùng isCeo.
  const isCeo = isCeoStrict || roles.includes('bgd');
  const isDepartmentHead = roles.includes('department_head');
  const projectNames = [
    ...(user.ledProjects || []),
    ...(user.projectMemberships || []).map((membership) => membership.project).filter(Boolean),
  ]
    .filter((project: any) => project.isActive !== false)
    .map((project: any) => project.name)
    .filter(Boolean);
  const uniqueProjectNames = [...new Set(projectNames)];

  return {
    level: isCeo ? 'company' : isDepartmentHead && projectIds.length > 0 ? 'project' : isDepartmentHead ? 'department' : 'personal',
    label: isCeo
      ? 'Toàn công ty'
      : isDepartmentHead && uniqueProjectNames.length > 0
        ? `Dự án ${uniqueProjectNames.join(', ')}`
        : isDepartmentHead
        ? `Phòng ban${user.department?.name ? ` ${user.department.name}` : ''}`
        : 'Dữ liệu của tôi',
    departmentId,
    projectIds,
    roles,
    capabilities: {
      canViewCompany: isCeo,
      canViewDepartment: isCeo || isDepartmentHead,
      canViewProject: isCeo || (isDepartmentHead && projectIds.length > 0),
      canAssignTasks: isCeoStrict || roles.includes('department_head'),
      canViewFinancials: isCeo || roles.includes('accountant'),
      canViewLegal: isCeo || roles.includes('legal'),
      canManageSystem: roles.includes('it_admin'),
    },
  };
}
