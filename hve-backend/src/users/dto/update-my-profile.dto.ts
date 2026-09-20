import { IsString, Matches, MaxLength } from 'class-validator';

export class UpdateMyProfileDto {
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @MaxLength(30, { message: 'Số điện thoại tối đa 30 ký tự' })
  @Matches(/^(?:|\+?[0-9][0-9\s().-]{7,28})$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone: string;
}
