import ExcelJS from 'exceljs';
import { parsePayrollWorkbook, validatePayrollItems } from './payroll-parser.js';

async function buildBook(rows: unknown[][], sheetName = 'Lương KNS NVH T9') {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('parsePayrollWorkbook', () => {
  const header = ['STT', 'Mã NV', 'Họ và tên', 'Chức danh', 'THỰC LÃNH', 'Số tài khoản', 'Ngân hàng', 'Ghi chú'];

  it('đọc danh sách nhận lương, bỏ dòng tổng và nhân viên thực lãnh 0', async () => {
    const buf = await buildBook([
      ['Công ty'],
      ['BẢNG TỔNG HỢP LƯƠNG NHÂN VIÊN SITE - THÁNG 09 NĂM 2026'],
      header,
      [1, 'A01', 'Nguyễn Văn A', 'Quản lý', 15000000.4, '0522 225 566', 'OCB', ''],
      [2, 'A02', 'Trần Thị B', 'GV', 0, '123456', 'VIB', ''],
      [3, 'A03', 'Lê C', 'GV', { formula: '1+1', result: 2500000 }, 7222145, 'Techcombank', 'ghi chú'],
      ['TỔNG CỘNG'],
      [4, 'X', 'Không được đọc', '', 1, '1', 'B'],
    ]);
    const r = await parsePayrollWorkbook(buf);
    expect(r.period).toBe('09/2026');
    expect(r.items.map((i) => i.fullName)).toEqual(['Nguyễn Văn A', 'Lê C']);
    expect(r.items[0].netPay).toBe(15000000);
    expect(r.items[0].bankAccount).toBe('0522225566');
    expect(r.items[1].bankAccount).toBe('7222145');
    expect(r.totalNetPay).toBe(17500000);
    expect(r.warnings).toHaveLength(1);
  });

  it('báo lỗi rõ khi không có bảng lương', async () => {
    const buf = await buildBook([['a', 'b']]);
    await expect(parsePayrollWorkbook(buf)).rejects.toThrow('Không tìm thấy bảng lương');
  });
});

describe('validatePayrollItems', () => {
  it('phát hiện thiếu tài khoản / ngân hàng', () => {
    const errs = validatePayrollItems([
      { employeeCode: '', fullName: 'A', position: '', netPay: 1000, bankName: '', bankAccount: '', note: '' },
    ]);
    expect(errs.join('|')).toContain('thiếu số tài khoản');
    expect(errs.join('|')).toContain('thiếu ngân hàng');
  });
});
