import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { DualAuth, GetBusinessId, GetMode } from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiOkResponse,
  ApiExcludeController,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';

@ApiTags('Payouts')
@ApiBearerAuth('api-key')
@DualAuth()
@ApiExcludeController()
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @ApiOperation({
    summary: 'Get payout by ID',
    description: 'Retrieve details of a specific payout by its ID',
  })
  @ApiParam({
    name: 'payout_id',
    description: 'Payout unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({ description: 'Payout retrieved successfully.' })
  @ApiErrorResponses(401, 404)
  @Get(':payout_id')
  async findOne(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('payout_id', ParseUUIDPipe) payoutId: string,
  ) {
    return this.payoutsService.findOne(businessId, mode, payoutId);
  }

  @ApiOperation({
    summary: 'Get all payouts',
    description: 'Retrieve all payouts for the business',
  })
  @ApiOkResponse({ description: 'Payouts retrieved successfully.' })
  @ApiErrorResponses(401, 404)
  @Get()
  async findAll(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Query('page') page: string,
    @Query('size') limit: string,
  ) {
    return this.payoutsService.findAll(businessId, mode, {
      page: +page,
      limit: +limit,
    });
  }
}
