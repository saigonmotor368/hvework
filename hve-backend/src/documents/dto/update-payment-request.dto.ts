import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePaymentRequestDto {
  @IsOptional()
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  title?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Số tiền thanh toán phải là số' })
  @Min(1, { message: 'Số tiền thanh toán phải lớn hơn 0' })
  amount?: number;

  @IsOptional()
  @IsString({ message: 'Người nhận/Đơn vị thụ hưởng phải là chuỗi' })
  receiver?: string;

  @IsOptional()
  @IsString({ message: 'Tên ngân hàng phải là chuỗi' })
  bankName?: string;

  @IsOptional()
  @IsString({ message: 'Số tài khoản ngân hàng phải là chuỗi' })
  bankAccount?: string;

  @IsOptional()
  @IsString({ message: 'Nội dung thanh toán phải là chuỗi' })
  content?: string;

  @IsOptional()
  @IsString({ message: 'Hạn thanh toán phải là chuỗi ngày tháng' })
  deadline?: string;

  @IsOptional()
  attachmentIds?: number[];
}
