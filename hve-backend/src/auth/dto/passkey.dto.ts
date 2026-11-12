import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class PasskeyRegisterOptionsDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class PasskeyRegisterVerifyDto {
  @IsString()
  @IsNotEmpty()
  challengeId!: string;

  @IsObject()
  response!: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceLabel?: string;
}

export class PasskeyLoginVerifyDto {
  @IsString()
  @IsNotEmpty()
  challengeId!: string;

  @IsObject()
  response!: Record<string, any>;
}
