import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UsersService } from './users.service.js';
import { UpdateAvatarDto } from './dto/update-avatar.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me/avatar')
  updateMyAvatar(@Body() dto: UpdateAvatarDto, @Req() req: any) {
    return this.usersService.updateAvatar(req.user.id, dto.avatarUrl, req.ip);
  }

  @Get(':id/profile')
  findProfile(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findProfile(id);
  }
}
