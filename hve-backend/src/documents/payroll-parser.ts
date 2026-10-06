import ExcelJS from 'exceljs';

export interface PayrollItem {
  employeeCode: string;
  fullName: string;
  position: string;
  netPay: number;
  bankName: string;
  bankAccount: string;
  note: string;
}

export interface ParsedPayroll {
  sheetName: string;
  period: string;
  items: PayrollItem[];
  totalNetPay: number;
  warnings: string[];
}

const normalize = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

function cellValue(cell: ExcelJS.Cell): unknown {
  const v: any = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if ('result' in v) return v.result ?? '';
    if ('richText' in v) return v.richText.map((t: any) => t.text).join('');
    if ('text' in v) return v.text;
    if (v instanceof Date) return v;
  }
  return v;
}

const text = (cell: ExcelJS.Cell) => String(cellValue(cell) ?? '').trim();

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const cleaned = String(value ?? '').replace(/[^\d,.-]/g, '');
  if (!cleaned) return NaN;
  // "25.788.462" (dấu chấm ngăn nghìn) hoặc "25,788,462"
  return Number(cleaned.replace(/[.,](?=\d{3}(\D|$))/g, ''));
}

interface HeaderMap {
  row: number;
  name: number;
  net: number;
  account: number;
  bank?: number;
  code?: number;
  position?: number;
  note?: number;
}

function findHeader(ws: ExcelJS.Worksheet): HeaderMap | null {
  const limit = Math.min(ws.rowCount, 30);
  for (let r = 1; r <= limit; r++) {
    const row = ws.getRow(r);
    const map: Partial<HeaderMap> = { row: r };
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const h = normalize(cellValue(cell));
      if (!h) return;
      if (h === 'ho va ten' || h === 'ho ten') map.name ??= col;
      else if (h.startsWith('thuc lanh') || h.startsWith('thuc nhan'))
        map.net ??= col;
      else if (h.startsWith('so tai khoan') || h === 'stk')
        map.account ??= col;
      else if (h.startsWith('ngan hang')) map.bank ??= col;
      else if (h === 'ma nv' || h === 'ma nhan vien') map.code ??= col;
      else if (h === 'chuc danh' || h === 'chuc vu') map.position ??= col;
      else if (h.startsWith('ghi chu')) map.note ??= col;
    });
    if (map.name && map.net && map.account) return map as HeaderMap;
  }
  return null;
}

function guessPeriod(ws: ExcelJS.Worksheet, sheetName: string): string {
  for (let r = 1; r <= 6; r++) {
    const m = /thang\s*0?(\d{1,2})\s*(?:nam|\/)\s*(\d{4})/.exec(
      normalize(text(ws.getRow(r).getCell(1))),
    );
    if (m) return `${m[1].padStart(2, '0')}/${m[2]}`;
  }
  const m = /t\s*0?(\d{1,2})[.\s/-]*(\d{4})/i.exec(sheetName);
  return m ? `${m[1].padStart(2, '0')}/${m[2]}` : '';
}

export async function parsePayrollWorkbook(
  buffer: Buffer,
): Promise<ParsedPayroll> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as any);
  } catch {
    throw new Error('Không đọc được tệp. Vui lòng dùng tệp Excel .xlsx.');
  }

  // Ưu tiên sheet có chữ "lương" (bỏ sheet chấm công / phiếu lương cá nhân).
  const candidates = [...wb.worksheets].sort((a, b) => {
    const score = (n: string) => {
      const s = normalize(n);
      return (s.includes('luong') ? 2 : 0) - (s.includes('phieu') ? 3 : 0);
    };
    return score(b.name) - score(a.name);
  });

  for (const ws of candidates) {
    const header = findHeader(ws);
    if (!header) continue;

    const items: PayrollItem[] = [];
    const warnings: string[] = [];
    for (let r = header.row + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const first = normalize(text(row.getCell(1)));
      if (first.startsWith('tong')) break;
      const fullName = text(row.getCell(header.name));
      if (!fullName) continue;

      const netRaw = toNumber(cellValue(row.getCell(header.net)));
      if (!Number.isFinite(netRaw) || netRaw <= 0) {
        warnings.push(`Bỏ qua "${fullName}" (dòng ${r}): thực lãnh bằng 0 hoặc không hợp lệ.`);
        continue;
      }
      items.push({
        employeeCode: header.code ? text(row.getCell(header.code)) : '',
        fullName,
        position: header.position ? text(row.getCell(header.position)) : '',
        netPay: Math.round(netRaw),
        bankName: header.bank ? text(row.getCell(header.bank)) : '',
        bankAccount: text(row.getCell(header.account)).replace(/\s+/g, ''),
        note: header.note ? text(row.getCell(header.note)) : '',
      });
    }

    if (items.length === 0) {
      throw new Error(`Sheet "${ws.name}" không có dòng nhân viên nào có thực lãnh > 0.`);
    }
    return {
      sheetName: ws.name,
      period: guessPeriod(ws, ws.name),
      items,
      totalNetPay: items.reduce((s, i) => s + i.netPay, 0),
      warnings,
    };
  }

  throw new Error(
    'Không tìm thấy bảng lương. Sheet cần có các cột "Họ và tên", "THỰC LÃNH", "Số tài khoản" (và "Ngân hàng").',
  );
}

/** Trả về danh sách lỗi dữ liệu của từng dòng; rỗng nghĩa là hợp lệ. */
export function validatePayrollItems(items: PayrollItem[]): string[] {
  const errors: string[] = [];
  items.forEach((item, idx) => {
    const label = item.fullName || `dòng ${idx + 1}`;
    if (!item.fullName?.trim()) errors.push(`Dòng ${idx + 1}: thiếu họ tên`);
    if (!Number.isFinite(item.netPay) || item.netPay <= 0)
      errors.push(`${label}: số tiền thực lãnh không hợp lệ`);
    if (!item.bankAccount?.trim()) errors.push(`${label}: thiếu số tài khoản`);
    else if (!/^[0-9A-Za-z]{4,30}$/.test(item.bankAccount.trim()))
      errors.push(`${label}: số tài khoản không hợp lệ`);
    if (!item.bankName?.trim()) errors.push(`${label}: thiếu ngân hàng`);
  });
  return errors;
}
