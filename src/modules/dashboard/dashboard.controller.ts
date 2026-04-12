import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { CookieAuth, GetDeveloper } from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Dashboard')
// @ApiBearerAuth('api-key')
@CookieAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // ── API Keys ────────────────────────────────────────────

  @ApiOperation({
    summary: 'Create API key',
    description: 'Generate a new API key for authentication',
  })
  @ApiBody({ type: CreateApiKeyDto })
  @Post('api-keys')
  async createApiKey(
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.dashboardService.createApiKey(developerId, dto);
  }

  @ApiOperation({
    summary: 'List API keys',
    description: 'Retrieve all API keys for the developer account',
  })
  @Get('api-keys')
  async listApiKeys(@GetDeveloper('id') developerId: string) {
    return this.dashboardService.listApiKeys(developerId);
  }

  @ApiOperation({
    summary: 'Update API key',
    description: 'Update API key settings (name, environment)',
  })
  @ApiParam({
    name: 'id',
    description: 'API key unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({ type: UpdateApiKeyDto })
  @Patch('api-keys/:id')
  async updateApiKey(
    @GetDeveloper('id') developerId: string,
    @Param('id', ParseUUIDPipe) keyId: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return this.dashboardService.updateApiKey(developerId, keyId, dto);
  }

  @ApiOperation({
    summary: 'Revoke API key',
    description: 'Revoke and delete an API key',
  })
  @ApiParam({
    name: 'id',
    description: 'API key unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Delete('api-keys/:id')
  async revokeApiKey(
    @GetDeveloper('id') developerId: string,
    @Param('id', ParseUUIDPipe) keyId: string,
  ) {
    return this.dashboardService.revokeApiKey(developerId, keyId);
  }

  // ── Stats ───────────────────────────────────────────────

  @ApiOperation({
    summary: 'Get dashboard overview',
    description:
      'Get account overview including balances, transactions, and recent activity',
  })
  @Get('overview')
  async getOverview(@GetDeveloper('id') developerId: string) {
    return this.dashboardService.getOverview(developerId);
  }

  @ApiOperation({
    summary: 'Get usage statistics',
    description: 'Get API usage statistics for the specified time period',
  })
  @ApiQuery({
    name: 'days',
    description: 'Number of days to include in stats',
    example: 30,
    required: false,
  })
  @Get('usage')
  async getUsageStats(
    @GetDeveloper('id') developerId: string,
    @Query() query: { days?: number },
  ) {
    return this.dashboardService.getUsageStats(developerId, query);
  }
}
