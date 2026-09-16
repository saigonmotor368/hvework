import { IsEmail, IsNotEmpty, IsString, IsArray, IsNumber, IsOptional, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsString({ message: 'Họ tên phải là chuỗi' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải tối thiểu 6 ký tự' })
  password?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Phòng ban ID phải là số' })
  departmentId?: number | null;

  @IsArray({ message: 'Danh sách vai trò phải là mảng số' })
  @IsNumber({}, { each: true, message: 'Mỗi mã vai trò phải là số' })
  roleIds: number[];
}
