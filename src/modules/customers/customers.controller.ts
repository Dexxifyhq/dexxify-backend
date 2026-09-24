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
import { Customer } from '../../database/entities';

const CUSTOMER_EXAMPLE = {
  id: '3c1e6a2a-2b3c-4d5e-8f9a-1a2b3c4d5e6f',
  business_id: '8e2f6b2a-df9c-4c2a-9a0a-9e6a2a2b6a11',
  mode: 'test',
  email: 'john@example.com',
  phone: '+2348012345678',
  first_name: 'John',
  last_name: 'Doe',
  status: 'active',
  cc_customer_id: 'cus_8f3c1a2b4d5e',
  metadata: { plan: 'premium', region: 'NG' },
  created_at: '2026-09-01T10:15:00.000Z',
  updated_at: '2026-09-01T10:15:00.000Z',
};

const CUSTOMER_LIST_ITEM_EXAMPLE = {
  ...CUSTOMER_EXAMPLE,
  has_paid: true,
};

const CUSTOMER_DEPOSIT_ACCOUNT_EXAMPLE = {
  id: '67063f653b4a1f6c7a60ec57',
  staticDepositAddresses: [
    {
      chain: 'tron',
      address: 'TXkPqR7YbAaHqZ5t5fRZ9Zk3f2NcQvJ9f2A',
      createdAt: '2026-09-01T10:15:00.000Z',
    },
  ],
  ngnVirtualAccounts: [
    {
      currency: 'NGN',
      accountNumber: '0123456789',
      accountName: 'John Doe',
      bankName: 'Wema Bank',
      bankCode: '035',
      accountReference: 'dex_ngn_67063f65',
      createdAt: '2026-09-01T10:15:00.000Z',
    },
  ],
};

@ApiTags('Customers')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @ApiOperation({ summary: 'Create a customer' })
  @ApiBody({ type: CreateCustomerDto })
  @ApiCreatedResponse({
    description: 'Customer created successfully.',
    type: Customer,
    example: CUSTOMER_EXAMPLE,
  })
  @ApiErrorResponses({ status: 400, message: 'email must be an email' }, 401, {
    status: 409,
    message: "Customer with email 'john@example.com' already exists.",
  })
  @Post()
  create(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(businessId, mode, dto);
  }

  @ApiOperation({ summary: 'List all customers' })
  @ApiOkResponse({
    description: 'Customers retrieved successfully.',
    schema: {
      example: {
        data: [CUSTOMER_LIST_ITEM_EXAMPLE],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      },
    },
  })
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
  @ApiOkResponse({
    description: 'Customer retrieved successfully.',
    type: Customer,
    example: CUSTOMER_EXAMPLE,
  })
  @ApiErrorResponses(401, { status: 404, message: 'Customer not found.' })
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
  @ApiOkResponse({
    description: 'Customer updated successfully.',
    type: Customer,
    example: CUSTOMER_EXAMPLE,
  })
  @ApiErrorResponses({ status: 400, message: 'email must be an email' }, 401, {
    status: 404,
    message: 'Customer not found.',
  })
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
  @ApiOkResponse({
    description: 'Customer deleted successfully.',
    schema: { example: { message: 'Customer deleted.' } },
  })
  @ApiErrorResponses(401, { status: 404, message: 'Customer not found.' })
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
  @ApiOkResponse({
    description: 'Deposit account retrieved successfully.',
    schema: { example: CUSTOMER_DEPOSIT_ACCOUNT_EXAMPLE },
  })
  @ApiErrorResponses(
    {
      status: 400,
      message: 'Customer is not synced with payment provider.',
    },
    401,
    { status: 404, message: 'Customer not found.' },
  )
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
