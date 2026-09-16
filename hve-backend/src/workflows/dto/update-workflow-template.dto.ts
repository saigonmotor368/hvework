import { IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WorkflowStepItemDto {
  @IsNumber({}, { message: 'Thứ tự bước phải là số' })
  stepOrder: number;

  @IsString({ message: 'Vai trò phê duyệt phải là chuỗi' })
  @IsNotEmpty({ message: 'Vai trò phê duyệt không được để trống' })
  roleRequired: string;
}

export class UpdateWorkflowTemplateDto {
  @IsArray({ message: 'Danh sách các bước phê duyệt phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepItemDto)
  steps: WorkflowStepItemDto[];
}
