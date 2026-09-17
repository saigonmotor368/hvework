import { describe, expect, it } from 'vitest';
import {
  buildDocumentAccessWhere,
  buildTaskAccessWhere,
  buildApprovalStepAccessConditions,
  describeBusinessScope,
  getEffectiveRoleNames,
  getEffectiveUserProjectIds,
} from './access-scope.js';

describe('business access scopes', () => {
  it('gives CEO company scope but does not elevate IT admin', () => {
    expect(buildTaskAccessWhere({ id: 1, roles: ['ceo'] })).toEqual({});
    expect(describeBusinessScope({ id: 1, roles: ['ceo'] }).level).toBe('company');

    const adminScope = describeBusinessScope({ id: 2, roles: ['it_admin'] });
    expect(adminScope.level).toBe('personal');
    expect(adminScope.capabilities.canManageSystem).toBe(true);
    expect(adminScope.capabilities.canViewCompany).toBe(false);
  });

  it('keeps project-less legacy data in the department fallback scope', () => {
    const user = { id: 3, departmentId: 8, roles: ['employee', 'department_head'] };
    expect(buildTaskAccessWhere(user)).toEqual({
      OR: [
        { assigneeId: 3 },
        { createdById: 3 },
        {
          AND: [
            { projectId: null },
            {
              OR: [
                { assignee: { departmentId: 8 } },
                { createdBy: { departmentId: 8 } },
              ],
            },
          ],
        },
      ],
    });
    expect(buildDocumentAccessWhere(user).OR).toContainEqual({
      AND: [{ projectId: null }, { createdBy: { departmentId: 8 } }],
    });
  });

  it('limits project heads to their own and explicitly linked projects', () => {
    const user = {
      id: 7,
      departmentId: 8,
      roles: ['department_head'],
      ledProjects: [{ id: 11, name: 'Alpha', isActive: true }],
      projectMemberships: [{ projectId: 12, project: { id: 12, name: 'Beta', isActive: true } }],
    };

    const documentScope = buildDocumentAccessWhere(user);
    expect(documentScope.OR).toContainEqual({ projectId: { in: [11, 12] } });
    expect(documentScope.OR).toContainEqual({ linkedProjectIds: { array_contains: [11] } });
    expect(documentScope.OR).not.toContainEqual({ projectId: 99 });

    const taskScope = buildTaskAccessWhere(user);
    expect(taskScope.OR).toContainEqual({ projectId: { in: [11, 12] } });
    expect(taskScope.OR).not.toContainEqual({ projectId: { in: [99] } });
  });

  it('merges functional document roles into one OR scope', () => {
    const scope = buildDocumentAccessWhere({
      id: 4,
      roles: ['employee', 'accountant', 'legal'],
    });
    expect(scope.OR).toContainEqual({ createdById: 4 });
    expect(scope.OR).toContainEqual({ type: 'payment_request' });
    expect(scope.OR).toContainEqual({ type: 'contract' });
  });

  it('keeps employees in personal task scope', () => {
    expect(buildTaskAccessWhere({ id: 5, departmentId: 9, roles: ['employee'] })).toEqual({
      OR: [{ assigneeId: 5 }, { createdById: 5 }],
    });
  });

  it('gives BGĐ (Board) company-wide view scope like CEO, but no execute capability', () => {
    expect(buildTaskAccessWhere({ id: 6, roles: ['bgd'] })).toEqual({});
    expect(buildDocumentAccessWhere({ id: 6, roles: ['bgd'] })).toEqual({});

    const scope = describeBusinessScope({ id: 6, roles: ['bgd'] });
    expect(scope.level).toBe('company');
    expect(scope.label).toBe('Toàn công ty');
    expect(scope.capabilities.canViewCompany).toBe(true);
    // BGĐ chỉ được xem, không được thực thi — không có quyền gán việc hay
    // quản trị hệ thống dù xem được toàn bộ dữ liệu như CEO.
    expect(scope.capabilities.canAssignTasks).toBe(false);
    expect(scope.capabilities.canManageSystem).toBe(false);
  });

  it('adds only active delegated approval roles and project scope', () => {
    const user = {
      id: 20,
      roles: ['employee'],
      delegatedFrom: [
        {
          id: 7,
          roles: ['department_head'],
          delegateUntil: new Date(Date.now() + 60_000),
          ledProjects: [{ id: 11, isActive: true }],
        },
      ],
    };

    expect(getEffectiveRoleNames(user)).toContain('department_head');
    expect(getEffectiveUserProjectIds(user)).toContain(11);
    expect(buildApprovalStepAccessConditions(user)).toContainEqual(
      expect.objectContaining({
        status: 'pending',
        roleRequired: 'department_head',
      }),
    );
  });

  it('drops delegated rights immediately after expiry', () => {
    const user = {
      id: 20,
      roles: ['employee'],
      delegatedFrom: [
        {
          id: 7,
          roles: ['ceo'],
          delegateUntil: new Date(Date.now() - 1),
        },
      ],
    };
    expect(getEffectiveRoleNames(user)).toEqual(['employee']);
    expect(buildApprovalStepAccessConditions(user)).toEqual([]);
  });

  it('never elevates task or system-management scope through delegation', () => {
    const user = {
      id: 20,
      roles: ['employee'],
      delegatedFrom: [
        {
          id: 1,
          roles: ['ceo', 'it_admin'],
          delegateUntil: new Date(Date.now() + 60_000),
        },
      ],
    };
    expect(buildTaskAccessWhere(user)).toEqual({
      OR: [{ assigneeId: 20 }, { createdById: 20 }],
    });
    expect(describeBusinessScope(user).capabilities.canManageSystem).toBe(false);
    expect(describeBusinessScope(user).capabilities.canAssignTasks).toBe(false);
  });
});
