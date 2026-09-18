import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ProjectFieldsDto } from '../../common/dto/project-fields.dto.js';

export class CreateProposalDto extends ProjectFieldsDto {
  @IsString({ message: 'Tiêu đề đề xuất phải là chuỗi' })
  @IsNotEmpty({ message: 'Tiêu đề đề xuất không được để trống' })
  title: string;

  @IsString({ message: 'Nội dung đề xuất phải là chuỗi' })
  @IsNotEmpty({ message: 'Nội dung đề xuất không được để trống' })
  content: string;

  @IsOptional()
  @IsInt({ message: 'Người nhận đề xuất phải là mã người dùng hợp lệ' })
  @Min(1)
  targetUserId?: number;

  @IsOptional()
  attachmentIds?: number[];
}
