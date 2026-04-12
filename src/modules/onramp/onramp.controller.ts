import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OnrampService } from './onramp.service';
import { CreateOnrampDto } from './dto';
import { GetDeveloper } from '../../common/decorators';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('On-Ramp')
@ApiBearerAuth('api-key')
@Controller('onramp')
export class OnrampController {
  constructor(private readonly onrampService: OnrampService) {}

  @ApiOperation({
    summary: 'Create on-ramp transaction',
    description:
      'Initiate a crypto on-ramp (deposit) transaction via fiat payment',
  })
  @ApiBody({ type: CreateOnrampDto })
  @Post()
  async create(
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreateOnrampDto,
  ) {
    return this.onrampService.create(developerId, dto);
  }

  @ApiOperation({
    summary: 'Get on-ramp transaction',
    description: 'Retrieve details of a specific on-ramp transaction by ID',
  })
  @ApiParam({
    name: 'tx_id',
    description: 'Transaction unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Get(':tx_id')
  async findOne(
    @GetDeveloper('id') developerId: string,
    @Param('tx_id', ParseUUIDPipe) txId: string,
  ) {
    return this.onrampService.findOne(developerId, txId);
  }
}
