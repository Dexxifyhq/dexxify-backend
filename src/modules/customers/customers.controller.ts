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
import { CustomersService } from './customers.service';
import { CreateCustomerDto, CustomerQueryDto, UpdateCustomerDto } from './dto';
import { DualAuth, GetBusinessId, GetMode } from '../../common/decorators';

@ApiTags('Customers')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @ApiOperation({ summary: 'Create a customer' })
  @ApiBody({ type: CreateCustomerDto })
  @Post()
  create(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(businessId, mode, dto);
  }

  @ApiOperation({ summary: 'List all customers' })
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
  @Get(':customer_id/deposit-account')
  getDepositAccount(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('customer_id', ParseUUIDPipe) customerId: string,
  ) {
    return this.customersService.getDepositAccount(businessId, mode, customerId);
  }
}
