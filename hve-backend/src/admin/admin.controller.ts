import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
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
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
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

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() dto: CreateUserDto, @Req() req: any) {
    return this.adminService.createUser(dto, req.user.id, req.ip);
  }

  @Put('users/:id')
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    return this.adminService.updateUser(id, dto, req.user.id, req.ip);
  }

  @Post('users/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
    @Req() req: any,
  ) {
    return this.adminService.resetPassword(id, dto, req.user.id, req.ip);
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

  @Get('stuck-data')
  async getStuckData() {
    return this.adminService.getStuckData();
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.OK)
  async deleteTask(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.adminService.deleteTask(id, req.user.id, req.ip);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.OK)
  async deleteDocument(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.adminService.deleteDocument(id, req.user.id, req.ip);
  }
}
