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
import {
  DualAuth,
  GetUser,
  GetBusinessId,
  GetMode,
} from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // ── API Keys ────────────────────────────────────────────

  @ApiOperation({ summary: 'Create API key' })
  @ApiBody({ type: CreateApiKeyDto })
  @ApiCreatedResponse({ description: 'API key created successfully.' })
  @ApiErrorResponses(400, 401)
  @Post('api-keys')
  async createApiKey(
    @GetUser('id') userId: string,
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.dashboardService.createApiKey(userId, businessId, dto, mode);
  }

  @ApiOperation({ summary: 'List API keys' })
  @ApiOkResponse({ description: 'API keys retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get('api-keys')
  async listApiKeys(
    @GetUser('id') userId: string,
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.dashboardService.listApiKeys(userId, businessId, mode);
  }

  @ApiOperation({ summary: 'Update API key label or IP whitelist' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiBody({ type: UpdateApiKeyDto })
  @ApiOkResponse({ description: 'API key updated successfully.' })
  @ApiErrorResponses(401, 404)
  @Patch('api-keys/:id')
  async updateApiKey(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) keyId: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return this.dashboardService.updateApiKey(userId, keyId, dto);
  }

  @ApiOperation({ summary: 'Revoke API key' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiOkResponse({ description: 'API key revoked successfully.' })
  @ApiErrorResponses(401, 404)
  @Delete('api-keys/:id')
  async revokeApiKey(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) keyId: string,
  ) {
    return this.dashboardService.revokeApiKey(userId, keyId);
  }

  // ── Insights ────────────────────────────────────────────

  @ApiOperation({
    summary: 'Dashboard overview',
    description:
      'Balances, total received, payment session breakdown, invoice stats, customer counts, deposit accounts, and pending payouts.',
  })
  @ApiOkResponse({ description: 'Dashboard overview retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get('overview')
  async getOverview(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.dashboardService.getOverview(businessId, mode);
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
    description: 'Number of days to include (1-365, default 30)',
  })
  @ApiOkResponse({ description: 'Revenue chart retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get('revenue-chart')
  async getRevenueChart(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.dashboardService.getRevenueChart(businessId, mode, days);
  }

  @ApiOperation({
    summary: 'Asset distribution',
    description:
      'Payment sessions grouped by crypto asset — counts and volumes.',
  })
  @ApiOkResponse({ description: 'Asset distribution retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get('asset-distribution')
  async getAssetDistribution(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.dashboardService.getAssetDistribution(businessId, mode);
  }

  @ApiOperation({
    summary: 'Recent activity',
    description: 'Latest ledger entries with direction, amount, and currency.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
    description: 'Number of entries to return (1-50, default 10)',
  })
  @ApiOkResponse({ description: 'Recent activity retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get('recent-activity')
  async getRecentActivity(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.dashboardService.getRecentActivity(businessId, mode, limit);
  }
}
