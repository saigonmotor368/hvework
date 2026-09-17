import { describe, expect, it } from 'vitest';
import {
  buildDocumentAccessWhere,
  buildTaskAccessWhere,
  describeBusinessScope,
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

  it('gives department heads department task and document scope', () => {
    const user = { id: 3, departmentId: 8, roles: ['employee', 'department_head'] };
    expect(buildTaskAccessWhere(user)).toEqual({
      OR: [
        { assignee: { departmentId: 8 } },
        { createdBy: { departmentId: 8 } },
      ],
    });
    expect(buildDocumentAccessWhere(user).OR).toContainEqual({
      createdBy: { departmentId: 8 },
    });
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
});
