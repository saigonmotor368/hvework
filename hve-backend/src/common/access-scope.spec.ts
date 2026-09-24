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
  const scopedDocumentConditions = (scope: any) => scope.OR[2].AND[1].OR;
  const scopedTaskConditions = (scope: any) => scope.OR[2].AND[1].OR;

  it('gives CEO company scope but does not elevate IT admin', () => {
    const taskScope = buildTaskAccessWhere({ id: 1, roles: ['ceo'] });
    expect(taskScope).toEqual({});
    expect(describeBusinessScope({ id: 1, roles: ['ceo'] }).level).toBe(
      'company',
    );

    const adminScope = describeBusinessScope({ id: 2, roles: ['it_admin'] });
    expect(adminScope.level).toBe('personal');
    expect(adminScope.capabilities.canManageSystem).toBe(true);
    expect(adminScope.capabilities.canViewCompany).toBe(false);
  });

  it('keeps project-less legacy data in the department fallback scope', () => {
    const user = {
      id: 3,
      departmentId: 8,
      roles: ['employee', 'department_head'],
    };
    expect(scopedTaskConditions(buildTaskAccessWhere(user))).toEqual([
      { assigneeId: 3 },
      { createdById: 3 },
      { collaboratorIds: { array_contains: [3] } },
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
    ]);
    expect(
      scopedDocumentConditions(buildDocumentAccessWhere(user)),
    ).toContainEqual({
      AND: [{ projectId: null }, { createdBy: { departmentId: 8 } }],
    });
  });

  it('limits project heads to their own and explicitly linked projects', () => {
    const user = {
      id: 7,
      departmentId: 8,
      roles: ['department_head'],
      ledProjects: [{ id: 11, name: 'Alpha', isActive: true }],
      projectMemberships: [
        { projectId: 12, project: { id: 12, name: 'Beta', isActive: true } },
      ],
    };

    const documentScope = buildDocumentAccessWhere(user);
    expect(scopedDocumentConditions(documentScope)).toContainEqual({
      projectId: { in: [11, 12] },
    });
    expect(scopedDocumentConditions(documentScope)).toContainEqual({
      linkedProjectIds: { array_contains: [11] },
    });
    expect(scopedDocumentConditions(documentScope)).not.toContainEqual({
      projectId: 99,
    });

    const taskScope = buildTaskAccessWhere(user);
    expect(scopedTaskConditions(taskScope)).toContainEqual({
      projectId: { in: [11, 12] },
    });
    expect(scopedTaskConditions(taskScope)).not.toContainEqual({
      projectId: { in: [99] },
    });
  });

  it('labels legacy project-less leadership scope as Huy Võ Education', () => {
    const scope = describeBusinessScope({
      id: 3,
      departmentId: 8,
      department: { id: 8, name: 'Vận hành' },
      roles: ['department_head'],
    });

    expect(scope.label).toBe('Huy Võ Education');
  });

  it('merges functional document roles into one OR scope', () => {
    const scope = buildDocumentAccessWhere({
      id: 4,
      roles: ['employee', 'accountant', 'legal'],
    });
    expect(scopedDocumentConditions(scope)).toContainEqual({ createdById: 4 });
    expect(scopedDocumentConditions(scope)).toContainEqual({
      type: 'payment_request',
    });
    expect(scopedDocumentConditions(scope)).toContainEqual({
      type: 'contract',
    });
  });

  it('keeps employees in personal task scope', () => {
    const scope = buildTaskAccessWhere({
      id: 5,
      departmentId: 9,
      roles: ['employee'],
    });
    expect(scopedTaskConditions(scope)).toEqual([
      { assigneeId: 5 },
      { createdById: 5 },
      { collaboratorIds: { array_contains: [5] } },
    ]);
    expect(scope.OR[1]).toEqual({
      AND: [
        { visibility: 'targeted' },
        {
          OR: [
            { assigneeId: 5 },
            { createdById: 5 },
            { collaboratorIds: { array_contains: [5] } },
          ],
        },
      ],
    });
  });

  it('lets BGĐ supervise every task while keeping targeted documents private', () => {
    const taskScope = buildTaskAccessWhere({ id: 6, roles: ['bgd'] });
    const documentScope = buildDocumentAccessWhere({ id: 6, roles: ['bgd'] });
    expect(taskScope).toEqual({});
    expect(documentScope.OR).toContainEqual({ visibility: 'company' });
    expect(documentScope.OR[1].AND[1].OR).toContainEqual({ targetUserId: 6 });

    const scope = describeBusinessScope({ id: 6, roles: ['bgd'] });
    expect(scope.level).toBe('company');
    expect(scope.label).toBe('Toàn công ty');
    expect(scope.capabilities.canViewCompany).toBe(true);
    expect(scope.capabilities.canAssignTasks).toBe(true);
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
    expect(scopedTaskConditions(buildTaskAccessWhere(user))).toEqual([
      { assigneeId: 20 },
      { createdById: 20 },
      { collaboratorIds: { array_contains: [20] } },
    ]);
    expect(describeBusinessScope(user).capabilities.canManageSystem).toBe(
      false,
    );
    expect(describeBusinessScope(user).capabilities.canAssignTasks).toBe(false);
  });
});
