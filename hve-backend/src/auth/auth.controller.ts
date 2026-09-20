import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { SetApprovalPinDto, ToggleApprovalPinDto } from './dto/set-approval-pin.dto.js';
import { VerifyLoginDto } from './dto/verify-login.dto.js';
import { ResendLoginCodeDto } from './dto/resend-login-code.dto.js';
import { ChangeInitialPasswordDto } from './dto/change-initial-password.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';
import { Roles } from './roles.decorator.js';

import { Throttle } from '../common/throttle.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle(5, 60000)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto, @Req() request: any) {
    const ip = request.ip;
    const device = request.headers['user-agent'];
    return this.authService.login(body, ip, device);
  }

  @Throttle(5, 60000)
  @Post('verify-login')
  @HttpCode(HttpStatus.OK)
  async verifyLogin(@Body() body: VerifyLoginDto, @Req() request: any) {
    return this.authService.verifyLoginChallenge(body, request.ip, request.headers['user-agent']);
  }

  @Throttle(5, 60000)
  @Post('resend-login-code')
  @HttpCode(HttpStatus.OK)
  async resendLoginCode(@Body() body: ResendLoginCodeDto, @Req() request: any) {
    return this.authService.resendLoginChallenge(
      body,
      request.ip,
      request.headers['user-agent'],
    );
  }

  @Throttle(5, 60000)
  @Post('change-initial-password')
  @HttpCode(HttpStatus.OK)
  async changeInitialPassword(
    @Body() body: ChangeInitialPasswordDto,
    @Req() request: any,
  ) {
    return this.authService.changeInitialPassword(
      body,
      request.ip,
      request.headers['user-agent'],
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Throttle(3, 60000)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: ForgotPasswordDto, @Req() request: any) {
    const ip = request.ip;
    return this.authService.forgotPassword(body.email, ip);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: ResetPasswordDto, @Req() request: any) {
    const ip = request.ip;
    return this.authService.resetPassword(body, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: any) {
    const user = req.user;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl || null,
      mustChangePassword: Boolean(user.mustChangePassword),
      departmentId: user.departmentId,
      department: user.department
        ? {
            id: user.department.id,
            name: user.department.name,
            code: user.department.code,
          }
        : null,
      roles: user.roles ? user.roles.map((r: { name: string }) => r.name) : [],
      projects: [
        ...(user.ledProjects || []),
        ...(user.projectMemberships || []).map(
          (membership: any) => membership.project,
        ),
      ].filter(
        (project: any, index: number, projects: any[]) =>
          project && projects.findIndex((item) => item?.id === project.id) === index,
      ),
      delegatedFrom: (user.delegatedFrom || []).map((delegator: any) => ({
        id: delegator.id,
        name: delegator.name,
        email: delegator.email,
        departmentId: delegator.departmentId,
        delegateUntil: delegator.delegateUntil,
        roles: (delegator.roles || []).map((role: any) => role.name),
        projects: [
          ...(delegator.ledProjects || []),
          ...(delegator.projectMemberships || []).map(
            (membership: any) => membership.project,
          ),
        ].filter(Boolean),
      })),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('approval-pin-status')
  async getApprovalPinStatus(@Req() req: any) {
    return this.authService.getApprovalPinStatus(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('approval-pin')
  @HttpCode(HttpStatus.OK)
  async setApprovalPin(@Body() body: SetApprovalPinDto, @Req() req: any) {
    return this.authService.setApprovalPin(req.user.id, body, req.ip);
  }

  @UseGuards(JwtAuthGuard)
  @Post('approval-pin/enabled')
  @HttpCode(HttpStatus.OK)
  async setApprovalPinEnabled(@Body() body: ToggleApprovalPinDto, @Req() req: any) {
    return this.authService.setApprovalPinEnabled(req.user.id, body, req.ip);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ceo', 'it_admin')
  @Get('admin-check')
  adminCheck(@Req() req: any) {
    return {
      message: 'Truy cập thành công - bạn có quyền Quản trị (CEO / IT Admin)',
      userId: req.user.id,
      email: req.user.email,
    };
  }
}
