import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { PaymentPagesService } from './payment-pages.service';
import {
  CreatePaymentPageDto,
  UpdatePaymentPageDto,
  PaymentPageQueryDto,
} from './dto';
import { DualAuth, GetBusinessId, GetMode } from '../../common/decorators';

@ApiTags('Payment Pages')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('payment-pages')
export class PaymentPagesController {
  constructor(private readonly pagesService: PaymentPagesService) {}

  @ApiOperation({ summary: 'Create a payment page' })
  @ApiBody({ type: CreatePaymentPageDto })
  @Post()
  create(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreatePaymentPageDto,
  ) {
    return this.pagesService.create(businessId, mode, dto);
  }

  @ApiOperation({ summary: 'List payment pages' })
  @Get()
  findAll(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Query() query: PaymentPageQueryDto,
  ) {
    return this.pagesService.findAll(businessId, mode, query);
  }

  @ApiOperation({ summary: 'Get a payment page by ID' })
  @ApiParam({ name: 'page_id', description: 'Payment page UUID' })
  @Get(':page_id')
  findOne(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('page_id', ParseUUIDPipe) pageId: string,
  ) {
    return this.pagesService.findOne(businessId, mode, pageId);
  }

  @ApiOperation({ summary: 'Update a payment page' })
  @ApiParam({ name: 'page_id', description: 'Payment page UUID' })
  @ApiBody({ type: UpdatePaymentPageDto })
  @Put(':page_id')
  update(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('page_id', ParseUUIDPipe) pageId: string,
    @Body() dto: UpdatePaymentPageDto,
  ) {
    return this.pagesService.update(businessId, mode, pageId, dto);
  }

  @ApiOperation({ summary: 'Delete a payment page' })
  @ApiParam({ name: 'page_id', description: 'Payment page UUID' })
  @HttpCode(HttpStatus.OK)
  @Delete(':page_id')
  remove(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('page_id', ParseUUIDPipe) pageId: string,
  ) {
    return this.pagesService.remove(businessId, mode, pageId);
  }

  @ApiOperation({ summary: 'List all payment sessions through a page' })
  @ApiParam({ name: 'page_id', description: 'Payment page UUID' })
  @Get(':page_id/sessions')
  getSessions(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('page_id', ParseUUIDPipe) pageId: string,
    @Query() query: PaymentPageQueryDto,
  ) {
    return this.pagesService.getSessions(businessId, mode, pageId, query);
  }
}
