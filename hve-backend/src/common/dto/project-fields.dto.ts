import { ArrayUnique, IsArray, IsInt, IsOptional, Min } from 'class-validator';

export class ProjectFieldsDto {
  @IsOptional()
  @IsInt({ message: 'Mã dự án phải là số nguyên' })
  @Min(1, { message: 'Mã dự án không hợp lệ' })
  projectId?: number;

  @IsOptional()
  @IsArray({ message: 'Danh sách dự án liên quan phải là một mảng' })
  @ArrayUnique({ message: 'Danh sách dự án liên quan không được trùng lặp' })
  @IsInt({ each: true, message: 'Mỗi mã dự án liên quan phải là số nguyên' })
  linkedProjectIds?: number[];
}
