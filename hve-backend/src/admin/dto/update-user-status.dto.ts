import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateUserStatusDto {
  @IsString({ message: 'Trạng thái phải là chuỗi' })
  @IsNotEmpty({ message: 'Trạng thái không được để trống' })
  @IsIn(['active', 'locked'], { message: 'Trạng thái chỉ có thể là active hoặc locked' })
  status: 'active' | 'locked';
}
