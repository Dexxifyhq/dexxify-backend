import { Controller, Get, Query } from '@nestjs/common';
import { MiscService } from './misc.service';
import { GetRateQueryDto } from './dto';
import { Public } from '../../common/decorators';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('misc')
export class MiscController {
  constructor(private readonly miscService: MiscService) {}

  /**
   * GET /v1/misc/banks
   * Returns list of supported Nigerian banks (bank code + name).
   * Cached for 24 hours.
   */
  @ApiBearerAuth('api-key')
  @Get('banks')
  async getBanks() {
    return this.miscService.getBanks();
  }

  /**
   * GET /v1/misc/deposit-assets
   * Returns supported crypto assets for deposit.
   */
  @ApiBearerAuth('api-key')
  @Get('deposit-assets')
  async getSupportedDepositAssets() {
    return this.miscService.getSupportedDepositAssets();
  }

  /**
   * GET /v1/misc/withdrawal-assets
   * Returns supported crypto assets for withdrawal.
   */
  @ApiBearerAuth('api-key')
  @Get('withdrawal-assets')
  async getSupportedWithdrawalAssets() {
    return this.miscService.getSupportedWithdrawalAssets();
  }

  /**
   * GET /v1/misc/rates
   * GET /v1/misc/rates?source=USDT&target=NGN
   * Returns live exchange rates — all pairs or a specific pair.
   */
  // @ApiBearerAuth('api-key')
  // @Get('rates')
  // async getRates(@Query() query: GetRateQueryDto) {
  //   return this.miscService.getRates(query.source, query.target);
  // }
}

/**
 * Health check — public, no auth required.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly miscService: MiscService) {}

  @Public()
  @Get()
  getHealth() {
    return this.miscService.getHealth();
  }
}
