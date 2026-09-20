import { IsString, Matches } from 'class-validator';

export class UpdateAvatarDto {
  @IsString()
  @Matches(/^\/attachments\/file\/[A-Za-z0-9_-]+$/, {
    message: 'Đường dẫn ảnh đại diện không hợp lệ',
  })
  avatarUrl: string;
}
