import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed/update...');

  // Create Departments if not exists
  let deptIT = await prisma.department.findUnique({ where: { code: 'IT' } });
  if (!deptIT) {
    deptIT = await prisma.department.create({
      data: { name: 'IT & Engineering', code: 'IT' },
    });
  }

  let deptHR = await prisma.department.findUnique({ where: { code: 'HR' } });
  if (!deptHR) {
    deptHR = await prisma.department.create({
      data: { name: 'Human Resources', code: 'HR' },
    });
  }

  let deptFin = await prisma.department.findUnique({ where: { code: 'FIN' } });
  if (!deptFin) {
    deptFin = await prisma.department.create({
      data: { name: 'Finance', code: 'FIN' },
    });
  }

  let deptLegal = await prisma.department.findUnique({ where: { code: 'LEG' } });
  if (!deptLegal) {
    deptLegal = await prisma.department.create({
      data: { name: 'Legal', code: 'LEG' },
    });
  }

  let deptKD = await prisma.department.findUnique({ where: { code: 'KD' } });
  if (!deptKD) {
    deptKD = await prisma.department.create({
      data: { name: 'Kinh doanh & Tuyển sinh', code: 'KD' },
    });
  }

  // Create Roles if not exists
  const roleNames = [
    { name: 'employee', description: 'Nhân viên' },
    { name: 'department_head', description: 'Trưởng bộ phận' },
    { name: 'accountant', description: 'Kế toán' },
    { name: 'legal', description: 'Pháp chế' },
    { name: 'ceo', description: 'CEO' },
    { name: 'it_admin', description: 'IT Admin' },
    { name: 'bgd', description: 'Ban Giám Đốc — xem toàn bộ, không thực thi lệnh' },
  ];

  const roles: Record<string, any> = {};
  for (const r of roleNames) {
    let existing = await prisma.role.findUnique({ where: { name: r.name } });
    if (!existing) {
      existing = await prisma.role.create({ data: r });
    }
    roles[r.name] = existing;
  }

  const defaultPassword = await bcrypt.hash('123456', 10);

  // Users to seed
  const usersToSeed = [
    {
      email: 'ceo@huyvoeducation.vn',
      name: 'CEO',
      departmentId: deptIT.id,
      roleNames: ['ceo', 'employee'],
    },
    {
      email: 'admin@huyvoeducation.vn',
      name: 'IT Admin',
      departmentId: deptIT.id,
      roleNames: ['it_admin'],
    },
    {
      email: 'tp_it@huyvoeducation.vn',
      name: 'Trưởng Phòng IT',
      departmentId: deptIT.id,
      roleNames: ['department_head', 'employee'],
    },
    {
      email: 'ketoan@huyvoeducation.vn',
      name: 'Kế Toán Trưởng',
      departmentId: deptFin.id,
      roleNames: ['accountant', 'department_head'],
    },
    {
      email: 'phapche@huyvoeducation.vn',
      name: 'Nhân viên Pháp Chế',
      departmentId: deptLegal.id,
      roleNames: ['legal', 'employee'],
    },
    {
      email: 'nv1@huyvoeducation.vn',
      name: 'Nhân viên 1',
      departmentId: deptIT.id,
      roleNames: ['employee'],
    },
    {
      email: 'tp_kd@huyvoeducation.vn',
      name: 'Trưởng Phòng Kinh Doanh',
      departmentId: deptKD.id,
      roleNames: ['department_head', 'employee'],
    },
    {
      email: 'nv_kd1@huyvoeducation.vn',
      name: 'Nhân viên Kinh Doanh 1',
      departmentId: deptKD.id,
      roleNames: ['employee'],
    },
    {
      email: 'nv_kd2@huyvoeducation.vn',
      name: 'Nhân viên Kinh Doanh 2',
      departmentId: deptKD.id,
      roleNames: ['employee'],
    },
    {
      email: 'nv_tc@huyvoeducation.vn',
      name: 'Nhân viên Tài Chính',
      departmentId: deptFin.id,
      roleNames: ['employee'],
    },
  ];

  // An toàn production: mặc định KHÔNG tạo lại tài khoản demo/test nữa.
  // Trước đây seed từng vô tình tạo lại các tài khoản demo (ceo@, tp_it@,
  // ketoan@...) mà anh Định đã chủ động xóa để chạy live test với người
  // dùng thật — vì đoạn code này chỉ kiểm tra "chưa có thì tạo", mỗi lần
  // seed chạy lại (VD: để thêm role mới) sẽ vô tình hồi sinh chúng.
  // Chỉ bật lại khi cần dựng CSDL mới hoàn toàn cho máy dev local:
  //   SEED_DEMO_USERS=true npx prisma db seed
  if (process.env.SEED_DEMO_USERS === 'true') {
    for (const u of usersToSeed) {
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      if (!existing) {
        await prisma.user.create({
          data: {
            email: u.email,
            passwordHash: defaultPassword,
            name: u.name,
            departmentId: u.departmentId,
            roles: {
              connect: u.roleNames.map((r) => ({ id: roles[r].id })),
            },
          },
        });
      }
    }
  }

  // Workflow Templates
  // 1. payment_request: Trưởng BP -> Kế toán -> CEO
  const existingWfPayment = await prisma.workflowTemplate.findUnique({
    where: { type: 'payment_request' },
  });
  if (!existingWfPayment) {
    await prisma.workflowTemplate.create({
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
  }

  // 2. proposal: Trưởng BP -> CEO
  const existingWfProposal = await prisma.workflowTemplate.findUnique({
    where: { type: 'proposal' },
  });
  if (!existingWfProposal) {
    await prisma.workflowTemplate.create({
      data: {
        type: 'proposal',
        name: 'Quy trình duyệt Đề xuất',
        steps: {
          create: [
            { stepOrder: 1, roleRequired: 'department_head' },
            { stepOrder: 2, roleRequired: 'ceo' },
          ],
        },
      },
    });
  }

  // 3. contract: Trưởng BP -> Pháp chế -> Kế toán -> CEO
  const existingWfContract = await prisma.workflowTemplate.findUnique({
    where: { type: 'contract' },
  });
  if (!existingWfContract) {
    await prisma.workflowTemplate.create({
      data: {
        type: 'contract',
        name: 'Quy trình duyệt Hợp đồng',
        steps: {
          create: [
            { stepOrder: 1, roleRequired: 'department_head' },
            { stepOrder: 2, roleRequired: 'legal' },
            { stepOrder: 3, roleRequired: 'accountant' },
            { stepOrder: 4, roleRequired: 'ceo' },
          ],
        },
      },
    });
  }

  // Dự án thật của công ty (thay cho việc phân quyền theo Phòng ban) —
  // idempotent theo "code", chạy lại không tạo trùng.
  const projectsToSeed = [
    { code: 'SNA', name: 'Dự án SNA' },
    { code: 'KNS', name: 'Dự án KNS' },
    { code: 'TOURISM', name: 'Dự án TOURISM' },
    { code: 'SUNRISE', name: 'Dự án SUNRISE' },
  ];
  for (const p of projectsToSeed) {
    const existing = await prisma.project.findUnique({ where: { code: p.code } });
    if (!existing) {
      await prisma.project.create({ data: { code: p.code, name: p.name, isActive: true } });
    }
  }

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
