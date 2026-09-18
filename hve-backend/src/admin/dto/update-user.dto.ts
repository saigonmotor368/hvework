import {
  IsEmail,
  IsString,
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsIn,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'Họ tên phải là chuỗi' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

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

  @IsOptional()
  @IsArray({ message: 'Danh sách vai trò phải là mảng số' })
  @IsNumber({}, { each: true, message: 'Mỗi mã vai trò phải là số' })
  roleIds?: number[];

  @IsOptional()
  @IsIn(['active', 'locked'], {
    message: 'Trạng thái phải là active hoặc locked',
  })
  status?: string;
}
