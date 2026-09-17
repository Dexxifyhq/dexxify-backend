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
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { PaymentPagesService } from './payment-pages.service';
import {
  CreatePaymentPageDto,
  UpdatePaymentPageDto,
  PaymentPageQueryDto,
} from './dto';
import { DualAuth, GetBusinessId, GetMode } from '../../common/decorators';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';

@ApiTags('Payment Pages')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('payment-pages')
export class PaymentPagesController {
  constructor(private readonly pagesService: PaymentPagesService) {}

  @ApiOperation({ summary: 'Create a payment page' })
  @ApiBody({ type: CreatePaymentPageDto })
  @ApiCreatedResponse({ description: 'Payment page created successfully.' })
  @ApiErrorResponses(400, 401, 409)
  @Post()
  create(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreatePaymentPageDto,
  ) {
    return this.pagesService.create(businessId, mode, dto);
  }

  @ApiOperation({ summary: 'List payment pages' })
  @ApiOkResponse({ description: 'Payment pages retrieved successfully.' })
  @ApiErrorResponses(401)
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
  @ApiOkResponse({ description: 'Payment page retrieved successfully.' })
  @ApiErrorResponses(401, 404)
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
  @ApiOkResponse({ description: 'Payment page updated successfully.' })
  @ApiErrorResponses(401, 404)
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
  @ApiOkResponse({ description: 'Payment page deleted successfully.' })
  @ApiErrorResponses(401, 404)
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
  @ApiOkResponse({ description: 'Payment sessions retrieved successfully.' })
  @ApiErrorResponses(401, 404)
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
