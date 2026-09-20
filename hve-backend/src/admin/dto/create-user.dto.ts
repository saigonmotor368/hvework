import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  MinLength,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsString({ message: 'Họ tên phải là chuỗi' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @MaxLength(30, { message: 'Số điện thoại tối đa 30 ký tự' })
  @Matches(/^(?:|\+?[0-9][0-9\s().-]{7,28})$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải tối thiểu 6 ký tự' })
  password?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Phòng ban ID phải là số' })
  departmentId?: number | null;

  @IsOptional()
  @IsArray({ message: 'Danh sách dự án phải là mảng số' })
  @IsNumber({}, { each: true, message: 'Mỗi mã dự án phải là số' })
  projectIds?: number[];

  @IsOptional()
  @IsObject({ message: 'Vị trí theo dự án phải là một đối tượng' })
  projectPositions?: Record<string, string>;

  @IsArray({ message: 'Danh sách vai trò phải là mảng số' })
  @IsNumber({}, { each: true, message: 'Mỗi mã vai trò phải là số' })
  roleIds: number[];
}
