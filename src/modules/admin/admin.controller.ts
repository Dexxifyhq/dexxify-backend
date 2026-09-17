import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiSecurity,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { WithdrawFeesDto } from './dto';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';

@ApiTags('Admin')
@ApiSecurity('admin-key')
@UseGuards(AdminGuard)
@Controller('admin/platform')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({
    summary: 'Platform fee balance',
    description:
      'Total revenue, amount already withdrawn, and available balance.',
  })
  @ApiOkResponse({
    description: 'Platform fee balance retrieved successfully.',
  })
  @ApiErrorResponses(403)
  @Get('balance')
  getBalance() {
    return this.adminService.getPlatformBalance();
  }

  @ApiOperation({
    summary: 'Withdraw platform fees',
    description:
      'Initiate a payout of accumulated fees to your bank or wallet. Only the available balance can be withdrawn.',
  })
  @ApiCreatedResponse({
    description: 'Platform fee withdrawal initiated successfully.',
  })
  @ApiErrorResponses(400, 403)
  @Post('withdraw')
  withdraw(@Body() dto: WithdrawFeesDto) {
    return this.adminService.withdrawFees(dto);
  }

  @ApiOperation({
    summary: 'Platform ledger history',
    description: 'Paginated list of all fee credits and withdrawals.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({
    description: 'Platform ledger history retrieved successfully.',
  })
  @ApiErrorResponses(403)
  @Get('ledger')
  getLedger(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.adminService.getPlatformLedger(Number(page), Number(limit));
  }
}
