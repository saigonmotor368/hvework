import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Lý do khi tạm ngừng / hủy / khôi phục công việc. */
export class TaskReasonDto {
  @IsOptional()
  @IsString({ message: 'Lý do phải là chuỗi' })
  @MaxLength(500, { message: 'Lý do tối đa 500 ký tự' })
  reason?: string;
}

export class ExtendTaskDto {
  @IsString({ message: 'Hạn mới phải là chuỗi ngày' })
  dueDate!: string;

  @IsOptional()
  @IsString({ message: 'Lý do phải là chuỗi' })
  @MaxLength(500, { message: 'Lý do tối đa 500 ký tự' })
  reason?: string;
}
