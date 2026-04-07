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

@CookieAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // ── API Keys ────────────────────────────────────────────

  @Post('api-keys')
  async createApiKey(
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.dashboardService.createApiKey(developerId, dto);
  }

  @Get('api-keys')
  async listApiKeys(@GetDeveloper('id') developerId: string) {
    return this.dashboardService.listApiKeys(developerId);
  }

  @Patch('api-keys/:id')
  async updateApiKey(
    @GetDeveloper('id') developerId: string,
    @Param('id', ParseUUIDPipe) keyId: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return this.dashboardService.updateApiKey(developerId, keyId, dto);
  }

  @Delete('api-keys/:id')
  async revokeApiKey(
    @GetDeveloper('id') developerId: string,
    @Param('id', ParseUUIDPipe) keyId: string,
  ) {
    return this.dashboardService.revokeApiKey(developerId, keyId);
  }

  // ── Stats ───────────────────────────────────────────────

  @Get('overview')
  async getOverview(@GetDeveloper('id') developerId: string) {
    return this.dashboardService.getOverview(developerId);
  }

  @Get('usage')
  async getUsageStats(
    @GetDeveloper('id') developerId: string,
    @Query() query: { days?: number },
  ) {
    return this.dashboardService.getUsageStats(developerId, query);
  }
}
