import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateContractDto {
  @IsString({ message: 'Tiêu đề hợp đồng phải là chuỗi' })
  @IsNotEmpty({ message: 'Tiêu đề hợp đồng không được để trống' })
  title: string;

  @IsString({ message: 'Đối tác phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên đối tác không được để trống' })
  partner: string;

  @IsNumber({}, { message: 'Giá trị hợp đồng phải là số' })
  @Min(0, { message: 'Giá trị hợp đồng không thể âm' })
  value: number;

  @IsString({ message: 'Ngày hiệu lực phải là chuỗi ngày tháng' })
  @IsNotEmpty({ message: 'Ngày hiệu lực không được để trống' })
  startDate: string;

  @IsString({ message: 'Ngày hết hạn phải là chuỗi ngày tháng' })
  @IsNotEmpty({ message: 'Ngày hết hạn không được để trống' })
  endDate: string;

  @IsString({ message: 'Người phụ trách hợp đồng phải là chuỗi' })
  @IsNotEmpty({ message: 'Người phụ trách hợp đồng không được để trống' })
  manager: string;

  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  notes?: string;

  @IsOptional()
  attachmentIds?: number[];
}
