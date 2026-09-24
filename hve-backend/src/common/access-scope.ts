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
  delegatedFrom?: Array<
    UserWithBusinessScope & {
      name?: string;
      email?: string;
      delegateUntil?: Date | string | null;
    }
  >;
};

export function getRoleNames(user: UserWithBusinessScope): string[] {
  return [
    ...new Set(
      (user.roles || []).map((role) =>
        typeof role === 'string' ? role : role.name,
      ),
    ),
  ].sort();
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

/**
 * Luôn kiểm tra hạn ngay tại thời điểm request. Nhờ vậy quyền duyệt hết hạn
 * tức thì ngay cả khi ngữ cảnh xác thực đang nằm trong cache ngắn hạn.
 */
export function getActiveDelegators(
  user: UserWithBusinessScope,
  now: Date = new Date(),
) {
  return (user.delegatedFrom || []).filter((delegator) => {
    if (!delegator.delegateUntil) return false;
    const until = new Date(delegator.delegateUntil);
    return !Number.isNaN(until.getTime()) && until.getTime() >= now.getTime();
  });
}

export function getEffectiveRoleNames(
  user: UserWithBusinessScope,
  now: Date = new Date(),
): string[] {
  return [
    ...new Set([
      ...getRoleNames(user),
      ...getActiveDelegators(user, now).flatMap((delegator) =>
        getRoleNames(delegator),
      ),
    ]),
  ].sort();
}

export function getEffectiveUserProjectIds(
  user: UserWithBusinessScope,
  now: Date = new Date(),
): number[] {
  return [
    ...new Set([
      ...getUserProjectIds(user),
      ...getActiveDelegators(user, now).flatMap((delegator) =>
        getUserProjectIds(delegator),
      ),
    ]),
  ].sort((a, b) => a - b);
}

export function getApprovalDelegator(
  user: UserWithBusinessScope,
  roleRequired: string,
  document?: {
    projectId?: number | null;
    linkedProjectIds?: unknown;
    createdBy?: { departmentId?: number | null } | null;
  },
  now: Date = new Date(),
):
  | (UserWithBusinessScope & {
      name?: string;
      delegateUntil?: Date | string | null;
    })
  | null {
  const matchesDepartmentScope = (candidate: UserWithBusinessScope) => {
    if (!document) return true;
    const projectIds = getUserProjectIds(candidate);
    const documentProjectIds = [
      document.projectId,
      ...(Array.isArray(document.linkedProjectIds)
        ? document.linkedProjectIds
        : []),
    ].filter((id): id is number => typeof id === 'number');
    if (documentProjectIds.some((id) => projectIds.includes(id))) return true;
    return (
      !document.projectId &&
      !!getDepartmentId(candidate) &&
      getDepartmentId(candidate) === document.createdBy?.departmentId
    );
  };

  if (
    getRoleNames(user).includes(roleRequired) &&
    (roleRequired !== 'department_head' || matchesDepartmentScope(user))
  ) {
    return null;
  }

  return (
    getActiveDelegators(user, now).find((delegator) => {
      if (!getRoleNames(delegator).includes(roleRequired)) return false;
      if (roleRequired !== 'department_head' || !document) return true;
      return matchesDepartmentScope(delegator);
    }) || null
  );
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
  const canViewScopedCompany = roles.includes('ceo') || roles.includes('bgd');

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

  const actionableRoles = roles.filter(
    (role) => !['employee', 'it_admin', 'department_head'].includes(role),
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

  // Quyền ủy quyền chỉ mở đúng hồ sơ đang chờ vai trò của người ủy quyền;
  // không kế thừa quyền xem rộng hay quyền quản trị khác của họ.
  for (const delegator of getActiveDelegators(user)) {
    const delegatedRoles = getRoleNames(delegator).filter(
      (role) => !['employee', 'it_admin', 'bgd'].includes(role),
    );
    for (const role of delegatedRoles) {
      if (role !== 'department_head') {
        conditions.push({
          steps: { some: { status: 'pending', roleRequired: role } },
        });
        continue;
      }

      const delegatedProjectIds = getUserProjectIds(delegator);
      const delegatedScope: any[] = [];
      if (delegatedProjectIds.length > 0) {
        delegatedScope.push({ projectId: { in: delegatedProjectIds } });
        delegatedScope.push(...linkedProjectConditions(delegatedProjectIds));
      }
      const delegatedDepartmentId = getDepartmentId(delegator);
      if (delegatedDepartmentId) {
        delegatedScope.push({
          AND: [
            { projectId: null },
            { createdBy: { departmentId: delegatedDepartmentId } },
          ],
        });
      }
      if (delegatedScope.length > 0) {
        conditions.push({
          AND: [
            { steps: { some: { status: 'pending', roleRequired: role } } },
            { OR: delegatedScope },
          ],
        });
      }
    }
  }

  const scopedAccess = canViewScopedCompany ? {} : { OR: conditions };
  const targetedAccess: any[] = [
    { createdById: user.id },
    { targetUserId: user.id },
  ];
  const approvalConditions = buildApprovalStepAccessConditions(user);
  if (approvalConditions.length > 0) {
    targetedAccess.push({
      steps: {
        some:
          approvalConditions.length === 1
            ? approvalConditions[0]
            : { OR: approvalConditions },
      },
    });
  }

  return {
    OR: [
      { visibility: 'company' },
      { AND: [{ visibility: 'targeted' }, { OR: targetedAccess }] },
      { AND: [{ visibility: 'scoped' }, scopedAccess] },
    ],
  };
}

/** Điều kiện bên trong `steps.some` cho các bước mà user được phép xử lý. */
export function buildApprovalStepAccessConditions(
  user: UserWithBusinessScope,
): any[] {
  const conditions: any[] = [];
  const candidates: UserWithBusinessScope[] = [
    user,
    ...getActiveDelegators(user),
  ];

  for (const candidate of candidates) {
    for (const role of getRoleNames(candidate)) {
      if (['employee', 'it_admin', 'bgd'].includes(role)) continue;
      if (role !== 'department_head') {
        conditions.push({ status: 'pending', roleRequired: role });
        continue;
      }

      const scopedDocuments: any[] = [];
      const projectIds = getUserProjectIds(candidate);
      if (projectIds.length > 0) {
        scopedDocuments.push({ projectId: { in: projectIds } });
        scopedDocuments.push(...linkedProjectConditions(projectIds));
      }
      const departmentId = getDepartmentId(candidate);
      if (departmentId) {
        scopedDocuments.push({
          AND: [{ projectId: null }, { createdBy: { departmentId } }],
        });
      }
      if (scopedDocuments.length > 0) {
        conditions.push({
          status: 'pending',
          roleRequired: role,
          document: { OR: scopedDocuments },
        });
      }
    }
  }

  return conditions;
}

/**
 * Phạm vi công việc theo cấp quản lý. Người có nhiều vai trò nhận hợp quyền
 * cao nhất, nhưng một bản ghi chỉ xuất hiện một lần.
 */
export function buildTaskAccessWhere(user: UserWithBusinessScope): any {
  const roles = getRoleNames(user);
  const canViewScopedCompany = roles.includes('ceo') || roles.includes('bgd');

  // CEO/BGĐ chịu trách nhiệm giám sát tiến độ toàn doanh nghiệp nên phải xem
  // được mọi công việc, kể cả việc được giao đích danh (visibility=targeted).
  // Quyền này chỉ áp dụng cho công việc; hồ sơ/đề xuất chỉ định riêng vẫn giữ
  // nguyên phạm vi bảo mật tại buildDocumentAccessWhere.
  if (canViewScopedCompany) return {};

  const departmentId = getDepartmentId(user);
  const conditions: any[] = [{ assigneeId: user.id }, { createdById: user.id }];
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

  const scopedAccess = { OR: conditions };
  return {
    OR: [
      { visibility: 'company' },
      {
        AND: [
          { visibility: 'targeted' },
          {
            OR: [
              { assigneeId: user.id },
              { createdById: user.id },
              { collaboratorIds: { array_contains: [user.id] } },
            ],
          },
        ],
      },
      { AND: [{ visibility: 'scoped' }, scopedAccess] },
    ],
  };
}

export function describeBusinessScope(user: UserWithBusinessScope) {
  const roles = getRoleNames(user);
  const departmentId = getDepartmentId(user);
  const projectIds = getUserProjectIds(user);
  const isCeoStrict = roles.includes('ceo');
  // BGĐ xem dữ liệu doanh nghiệp và có thể giao việc/đề xuất; các quyền duyệt
  // và quản trị hệ thống vẫn tách riêng, không kế thừa quyền CEO.
  const isCeo = isCeoStrict || roles.includes('bgd');
  const isDepartmentHead = roles.includes('department_head');
  const projectNames = [
    ...(user.ledProjects || []),
    ...(user.projectMemberships || [])
      .map((membership) => membership.project)
      .filter(Boolean),
  ]
    .filter((project: any) => project.isActive !== false)
    .map((project: any) => project.name)
    .filter(Boolean);
  const uniqueProjectNames = [...new Set(projectNames)];

  return {
    level: isCeo
      ? 'company'
      : isDepartmentHead && projectIds.length > 0
        ? 'project'
        : isDepartmentHead
          ? 'department'
          : 'personal',
    label: isCeo
      ? 'Toàn công ty'
      : isDepartmentHead && uniqueProjectNames.length > 0
        ? `Dự án ${uniqueProjectNames.join(', ')}`
        : isDepartmentHead
          ? 'Huy Võ Education'
          : 'Dữ liệu của tôi',
    departmentId,
    projectIds,
    roles,
    capabilities: {
      canViewCompany: isCeo,
      canViewDepartment: isCeo || isDepartmentHead,
      canViewProject: isCeo || (isDepartmentHead && projectIds.length > 0),
      canAssignTasks:
        isCeoStrict ||
        roles.includes('bgd') ||
        roles.includes('department_head') ||
        roles.includes('accountant'),
      canViewFinancials: isCeo || roles.includes('accountant'),
      canViewLegal: isCeo || roles.includes('legal'),
      canManageSystem: roles.includes('it_admin'),
    },
  };
}
