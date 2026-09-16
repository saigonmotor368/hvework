import { IsOptional, IsString, Matches } from 'class-validator';

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
}

export class RejectOrReturnStepDto {
  @IsString({ message: 'Lý do phải là chuỗi' })
  comment: string;
}
