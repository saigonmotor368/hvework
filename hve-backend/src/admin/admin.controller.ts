import {
  Controller,
  Get,
  Patch,
  Put,
  Param,
  Body,
  Req,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('it_admin', 'ceo')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  async findAllUsers() {
    return this.adminService.findAllUsers();
  }

  @Get('roles')
  async findAllRoles() {
    return this.adminService.findAllRoles();
  }

  @Get('departments')
  async findAllDepartments() {
    return this.adminService.findAllDepartments();
  }

  @Patch('users/:id/status')
  @HttpCode(HttpStatus.OK)
  async updateUserStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: any,
  ) {
    return this.adminService.updateUserStatus(
      id,
      dto,
      req.user.id,
      req.ip,
    );
  }

  @Put('users/:id/roles')
  @HttpCode(HttpStatus.OK)
  async updateUserRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserRolesDto,
    @Req() req: any,
  ) {
    return this.adminService.updateUserRoles(
      id,
      dto,
      req.user.id,
      req.ip,
    );
  }
}
