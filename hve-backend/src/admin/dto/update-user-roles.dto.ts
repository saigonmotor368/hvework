import { IsArray, IsNumber, IsOptional } from 'class-validator';

export class UpdateUserRolesDto {
  @IsArray({ message: 'Danh sách role IDs phải là một mảng số' })
  @IsNumber({}, { each: true, message: 'Mỗi role ID phải là số' })
  roleIds: number[];

  @IsOptional()
  @IsNumber({}, { message: 'Phòng ban ID phải là số' })
  departmentId?: number | null;
}
