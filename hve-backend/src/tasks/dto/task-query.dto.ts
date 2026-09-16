import { IsIn, IsOptional, IsString } from 'class-validator';

export class TaskQueryDto {
  @IsOptional()
  @IsIn(['all', 'assigned_to_me', 'assigned_by_me', 'department'], {
    message: 'Tab phải là all, assigned_to_me, assigned_by_me hoặc department',
  })
  tab?: 'all' | 'assigned_to_me' | 'assigned_by_me' | 'department' = 'all';

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  isOverdue?: string;

  @IsOptional()
  @IsString()
  tags?: string;
}
