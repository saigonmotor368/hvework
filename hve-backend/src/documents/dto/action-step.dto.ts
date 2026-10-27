import { IsISO8601, IsIn, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class ActionStepDto {
  @IsOptional()
  @IsString({ message: 'Ý kiến / lý do phải là chuỗi' })
  comment?: string;

  // Bắt buộc khi đây là bước duyệt cuối cùng do CEO thực hiện — kiểm tra
  // thêm ở tầng service, không chỉ dựa vào validation DTO vì tính bắt buộc
  // phụ thuộc vào vị trí của bước trong luồng duyệt (dữ liệu động).
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'Mã PIN phải gồm đúng 6 chữ số' })
  pin?: string;

  @IsOptional()
  @IsString({ message: 'Mã giao dịch phải là chuỗi' })
  paymentReference?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'Thời gian thanh toán không hợp lệ' })
  paymentPaidAt?: string;

  @IsOptional()
  @IsIn(['vietqr', 'bank_transfer', 'cash'], {
    message: 'Hình thức thanh toán không hợp lệ',
  })
  paymentMethod?: 'vietqr' | 'bank_transfer' | 'cash';

  // Đề nghị thu — site nhập số tiền thực nộp (bước Trưởng dự án).
  @IsOptional()
  @IsNumber({}, { message: 'Số tiền nộp phải là số' })
  @Min(1, { message: 'Số tiền nộp phải lớn hơn 0' })
  remittedAmount?: number;

  // Đề nghị thu — kế toán nhập số tiền thực nhận (bước cuối).
  @IsOptional()
  @IsNumber({}, { message: 'Số tiền thực nhận phải là số' })
  @Min(1, { message: 'Số tiền thực nhận phải lớn hơn 0' })
  receivedAmount?: number;
}

export class RejectOrReturnStepDto {
  @IsString({ message: 'Lý do phải là chuỗi' })
  comment: string;
}
