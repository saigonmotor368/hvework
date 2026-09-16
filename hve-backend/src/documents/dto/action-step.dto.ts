import { IsOptional, IsString } from 'class-validator';

export class ActionStepDto {
  @IsOptional()
  @IsString({ message: 'Ý kiến / lý do phải là chuỗi' })
  comment?: string;
}

export class RejectOrReturnStepDto {
  @IsString({ message: 'Lý do phải là chuỗi' })
  comment: string;
}
