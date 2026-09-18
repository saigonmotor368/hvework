import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsString()
  @IsNotEmpty({ message: 'Nội dung không được để trống' })
  @MaxLength(20000)
  content: string;

  @IsIn(['news', 'meeting', 'guide'])
  type: string;

  @IsOptional()
  @IsIn(['normal', 'important', 'urgent'])
  priority?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  projectId?: number | null;

  @IsOptional()
  @IsDateString()
  meetingStartAt?: string | null;

  @IsOptional()
  @IsDateString()
  meetingEndAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingUrl?: string | null;

  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  content?: string;

  @IsOptional()
  @IsIn(['news', 'meeting', 'guide'])
  type?: string;

  @IsOptional()
  @IsIn(['normal', 'important', 'urgent'])
  priority?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  projectId?: number | null;

  @IsOptional()
  @IsDateString()
  meetingStartAt?: string | null;

  @IsOptional()
  @IsDateString()
  meetingEndAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingUrl?: string | null;

  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
