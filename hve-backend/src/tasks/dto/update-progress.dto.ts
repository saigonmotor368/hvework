import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateProgressDto {
  @IsInt({ message: 'Tiến độ phải là số nguyên' })
  @Min(0, { message: 'Tiến độ tối thiểu là 0%' })
  @Max(100, { message: 'Tiến độ tối đa là 100%' })
  progressPercent: number;

  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  note?: string;
}
