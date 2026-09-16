import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTaskDto {
  @IsString({ message: 'Tiêu đề công việc phải là chuỗi' })
  @IsNotEmpty({ message: 'Tiêu đề công việc không được để trống' })
  title: string;

  @IsOptional()
  @IsString({ message: 'Mô tả công việc phải là chuỗi' })
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['low', 'normal', 'high', 'urgent'], {
    message: 'Mức độ ưu tiên chỉ có thể là low, normal, high, urgent',
  })
  priority?: 'low' | 'normal' | 'high' | 'urgent';

  @IsOptional()
  @IsString({ message: 'Ngày bắt đầu phải là chuỗi ngày' })
  startDate?: string;

  @IsOptional()
  @IsString({ message: 'Hạn hoàn thành phải là chuỗi ngày' })
  dueDate?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Mã người thực hiện phải là số' })
  assigneeId?: number;

  @IsOptional()
  @IsArray({ message: 'Danh sách người phối hợp phải là mảng ID' })
  @IsNumber({}, { each: true, message: 'Mỗi ID người phối hợp phải là số' })
  collaboratorIds?: number[];

  @IsOptional()
  @IsString({ message: 'Thẻ phân loại phải là chuỗi' })
  tags?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Mã công việc cha phải là số' })
  parentTaskId?: number;

  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly', null], {
    message: 'Chu kỳ lặp lại chỉ có thể là daily, weekly, monthly hoặc null',
  })
  recurrenceRule?: string | null;

  @IsOptional()
  @IsArray()
  attachmentIds?: number[];
}
