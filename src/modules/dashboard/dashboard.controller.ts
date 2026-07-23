import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { DualAuth, GetDeveloper } from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Dashboard')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // ── API Keys ────────────────────────────────────────────

  @ApiOperation({ summary: 'Create API key' })
  @ApiBody({ type: CreateApiKeyDto })
  @Post('api-keys')
  async createApiKey(
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.dashboardService.createApiKey(developerId, dto);
  }

  @ApiOperation({ summary: 'List API keys' })
  @Get('api-keys')
  async listApiKeys(@GetDeveloper('id') developerId: string) {
    return this.dashboardService.listApiKeys(developerId);
  }

  @ApiOperation({ summary: 'Update API key label or IP whitelist' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiBody({ type: UpdateApiKeyDto })
  @Patch('api-keys/:id')
  async updateApiKey(
    @GetDeveloper('id') developerId: string,
    @Param('id', ParseUUIDPipe) keyId: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return this.dashboardService.updateApiKey(developerId, keyId, dto);
  }

  @ApiOperation({ summary: 'Revoke API key' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @Delete('api-keys/:id')
  async revokeApiKey(
    @GetDeveloper('id') developerId: string,
    @Param('id', ParseUUIDPipe) keyId: string,
  ) {
    return this.dashboardService.revokeApiKey(developerId, keyId);
  }

  // ── Insights ────────────────────────────────────────────

  @ApiOperation({
    summary: 'Dashboard overview',
    description:
      'Balances, total received, payment session breakdown, invoice stats, customer counts, deposit accounts, and pending payouts.',
  })
  @Get('overview')
  async getOverview(@GetDeveloper('id') developerId: string) {
    return this.dashboardService.getOverview(developerId);
  }

  @ApiOperation({
    summary: 'Revenue chart',
    description:
      'Daily credit totals (NGN, USDT, USDC) from completed deposits over the last N days.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    example: 30,
    description: 'Number of days to include (1–365, default 30)',
  })
  @Get('revenue-chart')
  async getRevenueChart(
    @GetDeveloper('id') developerId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.dashboardService.getRevenueChart(developerId, days);
  }

  @ApiOperation({
    summary: 'Asset distribution',
    description:
      'Payment sessions grouped by crypto asset — counts and volumes.',
  })
  @Get('asset-distribution')
  async getAssetDistribution(@GetDeveloper('id') developerId: string) {
    return this.dashboardService.getAssetDistribution(developerId);
  }

  @ApiOperation({
    summary: 'Recent activity',
    description: 'Latest ledger entries with direction, amount, and currency.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
    description: 'Number of entries to return (1–50, default 10)',
  })
  @Get('recent-activity')
  async getRecentActivity(
    @GetDeveloper('id') developerId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.dashboardService.getRecentActivity(developerId, limit);
  }
}
