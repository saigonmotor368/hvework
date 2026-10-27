import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const ACCOUNT_NUMBER = /^[0-9A-Za-z]{4,30}$/;
const ACCOUNT_NUMBER_MESSAGE =
  'Số tài khoản không hợp lệ (4–30 ký tự chữ/số, không khoảng trắng)';

export class CreateCompanyAccountDto {
  @IsString({ message: 'Tên ngân hàng phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên ngân hàng không được để trống' })
  bankName: string;

  @IsString({ message: ACCOUNT_NUMBER_MESSAGE })
  @Matches(ACCOUNT_NUMBER, { message: ACCOUNT_NUMBER_MESSAGE })
  accountNumber: string;

  @IsString({ message: 'Tên chủ tài khoản phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên chủ tài khoản không được để trống' })
  accountName: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateCompanyAccountDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên ngân hàng không được để trống' })
  bankName?: string;

  @IsOptional()
  @Matches(ACCOUNT_NUMBER, { message: ACCOUNT_NUMBER_MESSAGE })
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Tên chủ tài khoản không được để trống' })
  accountName?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
