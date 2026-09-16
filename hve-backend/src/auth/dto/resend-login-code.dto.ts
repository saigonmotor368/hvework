import { IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ResendLoginCodeDto {
  @IsUUID('4', { message: 'Phiên xác minh không hợp lệ' })
  challengeId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @MaxLength(200)
  deviceId: string;
}
