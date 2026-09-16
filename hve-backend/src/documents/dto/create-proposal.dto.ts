import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProposalDto {
  @IsString({ message: 'Tiêu đề đề xuất phải là chuỗi' })
  @IsNotEmpty({ message: 'Tiêu đề đề xuất không được để trống' })
  title: string;

  @IsString({ message: 'Nội dung đề xuất phải là chuỗi' })
  @IsNotEmpty({ message: 'Nội dung đề xuất không được để trống' })
  content: string;

  @IsOptional()
  attachmentIds?: number[];
}
