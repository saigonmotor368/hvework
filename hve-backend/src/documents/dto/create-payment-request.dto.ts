import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentRequestDto {
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  @IsNotEmpty({ message: 'Tiêu đề đề nghị thanh toán không được để trống' })
  title: string;

  @IsNumber({}, { message: 'Số tiền thanh toán phải là số' })
  @Min(1, { message: 'Số tiền thanh toán phải lớn hơn 0' })
  amount: number;

  @IsString({ message: 'Người nhận/Đơn vị thụ hưởng phải là chuỗi' })
  @IsNotEmpty({ message: 'Người nhận/Đơn vị thụ hưởng không được để trống' })
  receiver: string;

  @IsString({ message: 'Tên ngân hàng phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên ngân hàng không được để trống' })
  bankName: string;

  @IsString({ message: 'Số tài khoản ngân hàng phải là chuỗi' })
  @IsNotEmpty({ message: 'Số tài khoản ngân hàng không được để trống' })
  bankAccount: string;

  @IsString({ message: 'Nội dung thanh toán phải là chuỗi' })
  @IsNotEmpty({ message: 'Nội dung thanh toán không được để trống' })
  content: string;

  @IsString({ message: 'Hạn thanh toán phải là chuỗi ngày tháng' })
  @IsNotEmpty({ message: 'Hạn thanh toán không được để trống' })
  deadline: string;

  @IsOptional()
  attachmentIds?: number[];
}
