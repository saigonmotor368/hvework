import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GeneratePresignedUrlDto {
  @IsString({ message: 'Tên tệp phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên tệp không được để trống' })
  fileName: string;

  @IsString({ message: 'MIME type phải là chuỗi' })
  @IsNotEmpty({ message: 'MIME type không được để trống' })
  mimeType: string;

  @IsNumber({}, { message: 'Kích thước tệp phải là số' })
  @Max(10 * 1024 * 1024, { message: 'Dung lượng tệp tối đa 10MB' })
  size: number;

  @IsOptional()
  @IsString()
  @IsIn(['document', 'task'])
  entityType?: 'document' | 'task';

  @IsOptional()
  @IsInt()
  @Min(1)
  entityId?: number;
}
