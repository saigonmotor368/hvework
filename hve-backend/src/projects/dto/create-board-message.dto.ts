import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateBoardMessageDto {
  @IsString({ message: 'Nội dung phải là chuỗi' })
  @IsNotEmpty({ message: 'Nội dung không được để trống' })
  content: string;

  @IsOptional()
  @IsArray({ message: 'Danh sách nhắc tên phải là mảng ID' })
  @IsNumber({}, { each: true, message: 'Mỗi ID nhắc tên phải là số' })
  mentions?: number[];
}
