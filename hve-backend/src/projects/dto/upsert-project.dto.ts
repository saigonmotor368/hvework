import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProjectDto {
  @IsString({ message: 'Mã dự án phải là chuỗi' })
  @IsNotEmpty({ message: 'Mã dự án không được để trống' })
  @MaxLength(30, { message: 'Mã dự án tối đa 30 ký tự' })
  code: string;

  @IsString({ message: 'Tên dự án phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên dự án không được để trống' })
  @MaxLength(200, { message: 'Tên dự án tối đa 200 ký tự' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Địa điểm phải là chuỗi' })
  @MaxLength(200, { message: 'Địa điểm tối đa 200 ký tự' })
  location?: string;

  @IsOptional()
  @IsInt({ message: 'Mã Trưởng dự án phải là số nguyên' })
  @Min(1)
  leadUserId?: number | null;

  @IsOptional()
  @IsArray({ message: 'Danh sách thành viên phải là mảng' })
  @ArrayUnique({ message: 'Danh sách thành viên không được trùng lặp' })
  @IsInt({ each: true, message: 'Mã thành viên phải là số nguyên' })
  memberIds?: number[];

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái dự án phải là đúng/sai' })
  isActive?: boolean;
}

export class UpdateProjectDto extends CreateProjectDto {}
