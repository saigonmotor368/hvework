import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ProjectFieldsDto } from '../../common/dto/project-fields.dto.js';

export class UpdateDocumentDto extends ProjectFieldsDto {
  @IsOptional()
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  title?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Số tiền thanh toán phải là số' })
  @Min(1, { message: 'Số tiền thanh toán phải lớn hơn 0' })
  amount?: number;

  @IsOptional()
  @IsString()
  receiver?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsString()
  partner?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Giá trị hợp đồng phải là số' })
  @Min(0, { message: 'Giá trị hợp đồng không thể âm' })
  value?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  manager?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  targetUserId?: number;

  @IsOptional()
  @IsArray({ message: 'Danh sách tệp đính kèm phải là một mảng' })
  @ArrayUnique({ message: 'Danh sách tệp đính kèm không được trùng lặp' })
  @IsInt({ each: true, message: 'Mã tệp đính kèm phải là số nguyên' })
  attachmentIds?: number[];
}
