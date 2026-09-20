import {
  Controller,
  Body,
  Get,
  Put,
  Req,
  Res,
  Param,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UsersService } from './users.service.js';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Put('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 256 * 1024, files: 1 } }),
  )
  updateMyAvatar(@UploadedFile() file: any, @Req() req: any) {
    // ID đích luôn lấy từ JWT, không nhận userId từ client. Vì vậy kể cả IT
    // cũng chỉ cập nhật được avatar của chính tài khoản đang đăng nhập.
    return this.usersService.updateAvatar(req.user.id, file, req.ip);
  }

  @Put('me/profile')
  updateMyProfile(@Body() dto: UpdateMyProfileDto, @Req() req: any) {
    return this.usersService.updateMyPhone(req.user.id, dto.phone, req.ip);
  }

  @Get(':id/avatar')
  async getAvatar(
    @Param('id', ParseIntPipe) id: number,
    @Res() response: Response,
  ) {
    const avatar = await this.usersService.getAvatar(id);
    response.setHeader('Content-Type', avatar.mimeType);
    response.setHeader('Content-Length', String(avatar.size));
    response.setHeader('Cache-Control', 'private, max-age=86400');
    // Frontend chạy trên Vercel, ảnh được phục vụ từ Railway. Helmet mặc định
    // gắn same-origin khiến trình duyệt nhận HTTP 200 nhưng không cho <img>
    // hiển thị. JWT vẫn bắt buộc nên mở CORP không làm ảnh thành công khai.
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.send(avatar.data);
  }

  @Get(':id/profile')
  findProfile(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findProfile(id);
  }
}
