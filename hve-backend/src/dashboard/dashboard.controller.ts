import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboard(@Request() req: any) {
    return this.dashboardService.getDashboardData(req.user);
  }

  @Post('clear-cache')
  async clearCache(@Request() req: any) {
    this.dashboardService.clearCache(req.user.id);
    return { message: 'Đã xóa cache dashboard thành công' };
  }
}
