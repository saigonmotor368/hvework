import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@Request() req: any) {
    return this.dashboardService.getDashboardData(req.user);
  }

  @Get('project-health')
  @UseGuards(RolesGuard)
  @Roles('ceo', 'bgd', 'it_admin')
  async getProjectHealth() {
    return this.dashboardService.getProjectHealth();
  }

  @Post('clear-cache')
  async clearCache(@Request() req: any) {
    this.dashboardService.clearCache(req.user.id);
    return { message: 'Đã xóa cache dashboard thành công' };
  }
}
