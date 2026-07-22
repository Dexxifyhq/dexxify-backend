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
import { DualAuth, GetDeveloper } from '../../common/decorators';

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
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreatePaymentPageDto,
  ) {
    return this.pagesService.create(developerId, dto);
  }

  @ApiOperation({ summary: 'List payment pages' })
  @Get()
  findAll(
    @GetDeveloper('id') developerId: string,
    @Query() query: PaymentPageQueryDto,
  ) {
    return this.pagesService.findAll(developerId, query);
  }

  @ApiOperation({ summary: 'Get a payment page by ID' })
  @ApiParam({ name: 'page_id', description: 'Payment page UUID' })
  @Get(':page_id')
  findOne(
    @GetDeveloper('id') developerId: string,
    @Param('page_id', ParseUUIDPipe) pageId: string,
  ) {
    return this.pagesService.findOne(developerId, pageId);
  }

  @ApiOperation({ summary: 'Update a payment page' })
  @ApiParam({ name: 'page_id', description: 'Payment page UUID' })
  @ApiBody({ type: UpdatePaymentPageDto })
  @Put(':page_id')
  update(
    @GetDeveloper('id') developerId: string,
    @Param('page_id', ParseUUIDPipe) pageId: string,
    @Body() dto: UpdatePaymentPageDto,
  ) {
    return this.pagesService.update(developerId, pageId, dto);
  }

  @ApiOperation({ summary: 'Delete a payment page' })
  @ApiParam({ name: 'page_id', description: 'Payment page UUID' })
  @HttpCode(HttpStatus.OK)
  @Delete(':page_id')
  remove(
    @GetDeveloper('id') developerId: string,
    @Param('page_id', ParseUUIDPipe) pageId: string,
  ) {
    return this.pagesService.remove(developerId, pageId);
  }

  @ApiOperation({ summary: 'List all payment sessions through a page' })
  @ApiParam({ name: 'page_id', description: 'Payment page UUID' })
  @Get(':page_id/sessions')
  getSessions(
    @GetDeveloper('id') developerId: string,
    @Param('page_id', ParseUUIDPipe) pageId: string,
    @Query() query: PaymentPageQueryDto,
  ) {
    return this.pagesService.getSessions(developerId, pageId, query);
  }
}
