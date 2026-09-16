import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsString({ message: 'Mã token / OTP phải là chuỗi' })
  @IsNotEmpty({ message: 'Mã token không được để trống' })
  token: string;

  @IsString({ message: 'Mật khẩu mới phải là chuỗi' })
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @MinLength(6, { message: 'Mật khẩu mới tối thiểu 6 ký tự' })
  newPassword: string;
}
