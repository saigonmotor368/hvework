type ProjectScopedUser = {
  departmentId?: number | null;
  department?: { id?: number | null } | null;
  projects?: Array<{ id: number }>;
};

type ProjectScopedDocument = {
  projectId?: number | null;
  linkedProjectIds?: number[] | null;
  createdBy?: {
    departmentId?: number | null;
    department?: { id?: number | null } | null;
  } | null;
};

export const getDocumentProjectIds = (
  document: ProjectScopedDocument,
): number[] =>
  [document.projectId, ...(document.linkedProjectIds || [])].filter(
    (id): id is number => typeof id === "number",
  );

export const matchesDepartmentHeadScope = (
  user: ProjectScopedUser,
  document: ProjectScopedDocument,
): boolean => {
  const documentProjectIds = getDocumentProjectIds(document);
  if (documentProjectIds.length > 0) {
    const userProjectIds = (user.projects || []).map((project) => project.id);
    return documentProjectIds.some((id) => userProjectIds.includes(id));
  }

  const creatorDepartmentId =
    document.createdBy?.departmentId || document.createdBy?.department?.id;
  const userDepartmentId = user.departmentId || user.department?.id;
  return Boolean(
    creatorDepartmentId &&
      userDepartmentId &&
      creatorDepartmentId === userDepartmentId,
  );
};
