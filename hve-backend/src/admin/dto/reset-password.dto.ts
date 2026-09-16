import { IsOptional, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải tối thiểu 6 ký tự' })
  newPassword?: string;
}
