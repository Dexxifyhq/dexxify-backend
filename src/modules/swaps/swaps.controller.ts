import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { SwapsService } from './swaps.service';
import {
  EstimateSwapDto,
  CreateSwapQuotationDto,
  SwapQueryDto,
} from './dto';
import { DualAuth, GetBusinessId } from '../../common/decorators';

@ApiTags('Swaps')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('swaps')
export class SwapsController {
  constructor(private readonly swapsService: SwapsService) {}

  @ApiOperation({
    summary: 'Estimate swap amount',
    description: 'Get a live rate estimate without locking the rate.',
  })
  @Get('estimate')
  estimate(@Query() dto: EstimateSwapDto) {
    return this.swapsService.estimate(dto);
  }

  @ApiOperation({
    summary: 'Create swap quotation',
    description: 'Lock the current rate for 15 seconds. Execute before it expires.',
  })
  @ApiBody({ type: CreateSwapQuotationDto })
  @Post('quotation')
  createQuotation(@Body() dto: CreateSwapQuotationDto) {
    return this.swapsService.createQuotation(dto);
  }

  @ApiOperation({ summary: 'Get swap quotation by ID' })
  @ApiParam({ name: 'quotationId', description: 'Quotation ID' })
  @Get('quotation/:quotationId')
  getQuotation(@Param('quotationId') quotationId: string) {
    return this.swapsService.getQuotation(quotationId);
  }

  @ApiOperation({
    summary: 'Execute swap quotation',
    description: 'Execute a locked quotation. Must be done within 15 seconds of creation.',
  })
  @ApiParam({ name: 'quotationId', description: 'Quotation ID to execute' })
  @Post('quotation/:quotationId/execute')
  executeQuotation(
    @GetBusinessId() businessId: string,
    @Param('quotationId') quotationId: string,
  ) {
    return this.swapsService.executeQuotation(businessId, quotationId);
  }

  @ApiOperation({ summary: 'List swap history' })
  @Get()
  list(@Query() query: SwapQueryDto) {
    return this.swapsService.list(query);
  }

  @ApiOperation({ summary: 'Get swap details by ID' })
  @ApiParam({ name: 'id', description: 'Swap ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.swapsService.findOne(id);
  }
}
