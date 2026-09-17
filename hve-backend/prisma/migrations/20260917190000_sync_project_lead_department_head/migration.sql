-- Project.leadUserId là nguồn sự thật cho vai trò Trưởng Ban/Trưởng dự án.
UPDATE "Role"
SET "description" = 'Trưởng Ban / Trưởng dự án'
WHERE "name" = 'department_head';

-- Bổ sung vai trò cho mọi trưởng dự án hiện hữu.
INSERT INTO "_RoleToUser" ("A", "B")
SELECT r."id", p."leadUserId"
FROM "Project" p
JOIN "Role" r ON r."name" = 'department_head'
WHERE p."leadUserId" IS NOT NULL
ON CONFLICT ("A", "B") DO NOTHING;

-- Thu hồi vai trò Trưởng Ban khỏi tài khoản không còn phụ trách dự án nào.
DELETE FROM "_RoleToUser" ru
USING "Role" r
WHERE ru."A" = r."id"
  AND r."name" = 'department_head'
  AND NOT EXISTS (
    SELECT 1 FROM "Project" p WHERE p."leadUserId" = ru."B"
  );
