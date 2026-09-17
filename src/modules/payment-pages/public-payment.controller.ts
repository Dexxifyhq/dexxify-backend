import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { PaymentPagesService } from './payment-pages.service';
import { PublicPayDto } from './dto';
import { Public } from '../../common/decorators';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';

@ApiTags('Public Payment Pages')
@Controller('p')
export class PublicPaymentController {
  constructor(private readonly pagesService: PaymentPagesService) {}

  @ApiOperation({
    summary: 'Get public payment page by slug',
    description:
      'Returns the page details a customer needs to complete payment. No auth required.',
  })
  @ApiParam({ name: 'slug', description: 'Page slug (e.g. summer-sale-x9k2)' })
  @ApiOkResponse({ description: 'Public payment page retrieved successfully.' })
  @ApiErrorResponses(404)
  @Public()
  @Get(':slug')
  getPage(@Param('slug') slug: string) {
    return this.pagesService.getPublicPage(slug);
  }

  @ApiOperation({
    summary: 'Submit payment on a page',
    description:
      'Customer selects crypto asset and submits. Creates a payment session and returns it.',
  })
  @ApiParam({ name: 'slug', description: 'Page slug' })
  @ApiBody({ type: PublicPayDto })
  @ApiCreatedResponse({ description: 'Payment session created successfully.' })
  @ApiErrorResponses(400, 404)
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post(':slug/pay')
  pay(@Param('slug') slug: string, @Body() dto: PublicPayDto) {
    return this.pagesService.pay(slug, dto);
  }
}
