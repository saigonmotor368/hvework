import {
  ArrayUnique,
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpsertProjectReportDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề báo cáo không được để trống' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Nội dung báo cáo không được để trống' })
  content: string;

  @IsOptional()
  @IsString()
  periodStart?: string;

  @IsOptional()
  @IsString()
  periodEnd?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  projectId?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50, {
    message: 'Mỗi báo cáo chỉ được chỉ định tối đa 50 người xem',
  })
  @ArrayUnique()
  @IsInt({ each: true })
  viewerIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: 'Mỗi báo cáo chỉ được đính kèm tối đa 10 tệp' })
  @ArrayUnique()
  @IsInt({ each: true })
  attachmentIds?: number[];
}

export class ReviewProjectReportDto {
  @IsIn(['approve', 'reject'])
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  comment?: string;
}
