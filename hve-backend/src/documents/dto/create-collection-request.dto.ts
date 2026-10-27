import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateCollectionRequestDto {
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  title: string;

  @IsInt({ message: 'Vui lòng chọn dự án (site) cần nộp tiền' })
  @Min(1, { message: 'Vui lòng chọn dự án (site) cần nộp tiền' })
  projectId: number;

  @Matches(/^(0[1-9]|1[0-2])\/\d{4}$/, {
    message: 'Kỳ phải có dạng MM/YYYY, ví dụ 09/2026',
  })
  period: string;

  @IsNumber({}, { message: 'Số tiền cần thu phải là số' })
  @Min(1, { message: 'Số tiền cần thu phải lớn hơn 0' })
  amount: number;

  @IsInt({ message: 'Vui lòng chọn tài khoản nhận tiền' })
  @Min(1, { message: 'Vui lòng chọn tài khoản nhận tiền' })
  bankAccountId: number;

  @IsString({ message: 'Hạn nộp phải là chuỗi ngày tháng' })
  @IsNotEmpty({ message: 'Hạn nộp không được để trống' })
  deadline: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  attachmentIds?: number[];
}
