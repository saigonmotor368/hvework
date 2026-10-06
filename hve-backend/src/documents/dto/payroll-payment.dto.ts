import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class PayrollPaymentDto {
  @IsInt({ message: 'Chứng từ chuyển khoản không hợp lệ' })
  @Min(1, { message: 'Chứng từ chuyển khoản không hợp lệ' })
  attachmentId: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsDateString({}, { message: 'Thời gian chuyển khoản không hợp lệ' })
  paidAt: string;
}
