import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class PayrollItemDto {
  @IsOptional()
  @IsString()
  employeeCode?: string;

  @IsString({ message: 'Họ tên nhân viên phải là chuỗi' })
  @IsNotEmpty({ message: 'Họ tên nhân viên không được để trống' })
  fullName: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsNumber({}, { message: 'Số tiền thực lãnh phải là số' })
  @Min(1, { message: 'Số tiền thực lãnh phải lớn hơn 0' })
  netPay: number;

  @IsString({ message: 'Ngân hàng phải là chuỗi' })
  @IsNotEmpty({ message: 'Ngân hàng không được để trống' })
  bankName: string;

  @IsString({ message: 'Số tài khoản phải là chuỗi' })
  @IsNotEmpty({ message: 'Số tài khoản không được để trống' })
  bankAccount: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreatePayrollRequestDto {
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  title: string;

  @IsInt({ message: 'Vui lòng chọn dự án (site) đề nghị chi lương' })
  @Min(1, { message: 'Vui lòng chọn dự án (site) đề nghị chi lương' })
  projectId: number;

  @Matches(/^(0[1-9]|1[0-2])\/\d{4}$/, {
    message: 'Kỳ lương phải có dạng MM/YYYY, ví dụ 09/2026',
  })
  period: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsArray({ message: 'Danh sách nhận lương phải là một mảng' })
  @ArrayMinSize(1, { message: 'Danh sách nhận lương không được để trống' })
  @ArrayMaxSize(500, { message: 'Danh sách nhận lương tối đa 500 người' })
  @ValidateNested({ each: true })
  @Type(() => PayrollItemDto)
  items: PayrollItemDto[];

  @IsOptional()
  attachmentIds?: number[];
}
