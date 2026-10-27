import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CompanyAccountsService } from './company-accounts.service.js';
import {
  CreateCompanyAccountDto,
  UpdateCompanyAccountDto,
} from './dto/company-account.dto.js';

// Danh sách tài khoản nhận tiền của công ty: Kế toán và Quản trị IT quản lý;
// CEO / Ban Giám Đốc chỉ xem. Site xem thông tin tài khoản qua chính hồ sơ Đề nghị thu.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('company-accounts')
export class CompanyAccountsController {
  constructor(private readonly service: CompanyAccountsService) {}

  @Get()
  @Roles('accountant', 'it_admin', 'ceo', 'bgd')
  list(@Query('all') all?: string) {
    return this.service.list(all === 'true');
  }

  @Post()
  @Roles('accountant', 'it_admin')
  create(@Body() dto: CreateCompanyAccountDto, @Req() req: any) {
    return this.service.create(req.user.id, dto, req.ip);
  }

  @Put(':id')
  @Roles('accountant', 'it_admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyAccountDto,
    @Req() req: any,
  ) {
    return this.service.update(req.user.id, id, dto, req.ip);
  }
}
