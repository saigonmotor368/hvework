import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateUserDelegationDto {
  @IsOptional()
  @IsInt({ message: 'Người nhận ủy quyền phải là mã người dùng hợp lệ' })
  @Min(1)
  delegateToUserId?: number | null;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày hết hạn ủy quyền không hợp lệ' })
  delegateUntil?: string | null;
}
