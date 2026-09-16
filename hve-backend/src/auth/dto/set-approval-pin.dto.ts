import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class SetApprovalPinDto {
  @IsString({ message: 'Mật khẩu hiện tại phải là chuỗi' })
  @IsNotEmpty({ message: 'Cần nhập mật khẩu hiện tại để xác nhận đổi mã PIN' })
  currentPassword: string;

  @IsString({ message: 'Mã PIN phải là chuỗi' })
  @Matches(/^\d{6}$/, { message: 'Mã PIN phải gồm đúng 6 chữ số' })
  newPin: string;
}

export class ToggleApprovalPinDto {
  @IsBoolean({ message: 'Trạng thái bật/tắt phải là kiểu boolean' })
  enabled: boolean;

  // Bắt buộc khi tắt tính năng trong khi PIN đang bật, để xác nhận đúng
  // là chủ tài khoản chứ không phải người khác lén tắt bảo vệ.
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'Mã PIN phải gồm đúng 6 chữ số' })
  pin?: string;
}
