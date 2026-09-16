import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Check if roles exist
  const existingRoles = await prisma.role.count();
  if (existingRoles > 0) {
    console.log('Database already seeded');
    return;
  }

  console.log('Seeding database...');

  // Create Departments
  const deptIT = await prisma.department.create({
    data: { name: 'IT & Engineering', code: 'IT' },
  });
  const deptHR = await prisma.department.create({
    data: { name: 'Human Resources', code: 'HR' },
  });
  const deptFin = await prisma.department.create({
    data: { name: 'Finance', code: 'FIN' },
  });
  const deptLegal = await prisma.department.create({
    data: { name: 'Legal', code: 'LEG' },
  });

  // Create Roles
  const rEmployee = await prisma.role.create({ data: { name: 'employee', description: 'Nhân viên' } });
  const rDeptHead = await prisma.role.create({ data: { name: 'department_head', description: 'Trưởng bộ phận' } });
  const rAccountant = await prisma.role.create({ data: { name: 'accountant', description: 'Kế toán' } });
  const rLegal = await prisma.role.create({ data: { name: 'legal', description: 'Pháp chế' } });
  const rCeo = await prisma.role.create({ data: { name: 'ceo', description: 'CEO' } });
  const rItAdmin = await prisma.role.create({ data: { name: 'it_admin', description: 'IT Admin' } });

  const defaultPassword = await bcrypt.hash('123456', 10);

  // Create Users
  await prisma.user.create({
    data: {
      email: 'ceo@hve.com',
      passwordHash: defaultPassword,
      name: 'CEO',
      departmentId: deptIT.id,
      roles: { connect: [{ id: rCeo.id }, { id: rEmployee.id }] },
    },
  });

  await prisma.user.create({
    data: {
      email: 'admin@hve.com',
      passwordHash: defaultPassword,
      name: 'IT Admin',
      departmentId: deptIT.id,
      roles: { connect: [{ id: rItAdmin.id }] },
    },
  });

  await prisma.user.create({
    data: {
      email: 'ketoan@hve.com',
      passwordHash: defaultPassword,
      name: 'Kế Toán Trưởng',
      departmentId: deptFin.id,
      roles: { connect: [{ id: rAccountant.id }, { id: rDeptHead.id }] },
    },
  });

  await prisma.user.create({
    data: {
      email: 'phapche@hve.com',
      passwordHash: defaultPassword,
      name: 'Nhân viên Pháp Chế',
      departmentId: deptLegal.id,
      roles: { connect: [{ id: rLegal.id }] },
    },
  });

  await prisma.user.create({
    data: {
      email: 'nv1@hve.com',
      passwordHash: defaultPassword,
      name: 'Nhân viên 1',
      departmentId: deptIT.id,
      roles: { connect: [{ id: rEmployee.id }] },
    },
  });

  // Create Default Workflow Template for Payment Request
  const wfPayment = await prisma.workflowTemplate.create({
    data: {
      type: 'payment_request',
      name: 'Quy trình duyệt Đề nghị thanh toán',
      steps: {
        create: [
          { stepOrder: 1, roleRequired: 'department_head' },
          { stepOrder: 2, roleRequired: 'accountant' },
          { stepOrder: 3, roleRequired: 'ceo' },
        ],
      },
    },
  });

  console.log('Seeding completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
