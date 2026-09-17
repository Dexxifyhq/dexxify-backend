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
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, CustomerQueryDto, UpdateCustomerDto } from './dto';
import { DualAuth, GetBusinessId, GetMode } from '../../common/decorators';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';

@ApiTags('Customers')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @ApiOperation({ summary: 'Create a customer' })
  @ApiBody({ type: CreateCustomerDto })
  @ApiCreatedResponse({ description: 'Customer created successfully.' })
  @ApiErrorResponses(400, 401, 409)
  @Post()
  create(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(businessId, mode, dto);
  }

  @ApiOperation({ summary: 'List all customers' })
  @ApiOkResponse({ description: 'Customers retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get()
  findAll(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Query() query: CustomerQueryDto,
  ) {
    return this.customersService.findAll(businessId, mode, query);
  }

  @ApiOperation({ summary: 'Get a customer by ID' })
  @ApiParam({ name: 'customer_id', description: 'Customer UUID' })
  @ApiOkResponse({ description: 'Customer retrieved successfully.' })
  @ApiErrorResponses(401, 404)
  @Get(':customer_id')
  findOne(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('customer_id', ParseUUIDPipe) customerId: string,
  ) {
    return this.customersService.findOne(businessId, mode, customerId);
  }

  @ApiOperation({ summary: 'Update a customer' })
  @ApiParam({ name: 'customer_id', description: 'Customer UUID' })
  @ApiBody({ type: UpdateCustomerDto })
  @ApiOkResponse({ description: 'Customer updated successfully.' })
  @ApiErrorResponses(400, 401, 404)
  @Put(':customer_id')
  update(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('customer_id', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(businessId, mode, customerId, dto);
  }

  @ApiOperation({ summary: 'Delete a customer' })
  @ApiParam({ name: 'customer_id', description: 'Customer UUID' })
  @ApiOkResponse({ description: 'Customer deleted successfully.' })
  @ApiErrorResponses(401, 404)
  @HttpCode(HttpStatus.OK)
  @Delete(':customer_id')
  remove(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('customer_id', ParseUUIDPipe) customerId: string,
  ) {
    return this.customersService.remove(businessId, mode, customerId);
  }

  @ApiOperation({
    summary: "Get or provision a customer's deposit account",
    description:
      'Returns all crypto deposit addresses and NGN virtual accounts from CoincircuitMCP. ' +
      'Creates the deposit account if one does not exist yet.',
  })
  @ApiParam({ name: 'customer_id', description: 'Customer UUID' })
  @ApiOkResponse({ description: 'Deposit account retrieved successfully.' })
  @ApiErrorResponses(400, 401, 404)
  @Get(':customer_id/deposit-account')
  getDepositAccount(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('customer_id', ParseUUIDPipe) customerId: string,
  ) {
    return this.customersService.getDepositAccount(
      businessId,
      mode,
      customerId,
    );
  }
}
