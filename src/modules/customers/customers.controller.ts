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
  ApiQuery,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, CustomerQueryDto, UpdateCustomerDto } from './dto';
import { GetDeveloper } from '../../common/decorators';

@ApiTags('Customers')
@ApiBearerAuth('api-key')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @ApiOperation({ summary: 'Create a customer' })
  @ApiBody({ type: CreateCustomerDto })
  @Post()
  create(
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(developerId, dto);
  }

  @ApiOperation({ summary: 'List all customers' })
  @Get()
  findAll(
    @GetDeveloper('id') developerId: string,
    @Query() query: CustomerQueryDto,
  ) {
    return this.customersService.findAll(developerId, query);
  }

  @ApiOperation({ summary: 'Get a customer by ID' })
  @ApiParam({ name: 'customer_id', description: 'Customer UUID' })
  @Get(':customer_id')
  findOne(
    @GetDeveloper('id') developerId: string,
    @Param('customer_id', ParseUUIDPipe) customerId: string,
  ) {
    return this.customersService.findOne(developerId, customerId);
  }

  @ApiOperation({ summary: 'Update a customer' })
  @ApiParam({ name: 'customer_id', description: 'Customer UUID' })
  @ApiBody({ type: UpdateCustomerDto })
  @Put(':customer_id')
  update(
    @GetDeveloper('id') developerId: string,
    @Param('customer_id', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(developerId, customerId, dto);
  }

  @ApiOperation({ summary: 'Delete a customer' })
  @ApiParam({ name: 'customer_id', description: 'Customer UUID' })
  @HttpCode(HttpStatus.OK)
  @Delete(':customer_id')
  remove(
    @GetDeveloper('id') developerId: string,
    @Param('customer_id', ParseUUIDPipe) customerId: string,
  ) {
    return this.customersService.remove(developerId, customerId);
  }
}
