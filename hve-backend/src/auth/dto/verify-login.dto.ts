import { IsNotEmpty, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

export class VerifyLoginDto {
  @IsUUID('4', { message: 'Phiên xác minh không hợp lệ' })
  challengeId: string;

  @IsString()
  @Length(6, 6, { message: 'Mã xác minh phải gồm đúng 6 chữ số' })
  code: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @MaxLength(200)
  deviceId: string;
}
