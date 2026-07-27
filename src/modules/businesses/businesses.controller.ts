import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import {
  CreateBusinessDto,
  UpdateBusinessProfileDto,
  UpdateSettlementsDto,
  UpdateNotificationsDto,
} from './dto';
import { DualAuth, GetBusinessId, GetUser } from '../../common/decorators';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Businesses')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @ApiOperation({
    summary: 'Create a new business',
    description:
      'Creates a new business workspace for the current user. Use POST /auth/select-business to switch into it.',
  })
  @ApiBody({ type: CreateBusinessDto })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@GetUser('id') userId: string, @Body() dto: CreateBusinessDto) {
    return this.businessesService.create(userId, dto);
  }

  @ApiOperation({ summary: 'List all businesses the current user belongs to' })
  @Get()
  async listMyBusinesses(@GetUser('id') userId: string) {
    return this.businessesService.listForUser(userId);
  }

  @ApiOperation({ summary: 'Get active business profile' })
  @Get('me')
  async getMyBusiness(@GetBusinessId() businessId: string) {
    return this.businessesService.getById(businessId);
  }

  @ApiOperation({ summary: 'Update business profile' })
  @ApiBody({ type: UpdateBusinessProfileDto })
  @Patch('me')
  async updateProfile(
    @GetBusinessId() businessId: string,
    @Body() dto: UpdateBusinessProfileDto,
  ) {
    return this.businessesService.updateProfile(businessId, dto);
  }

  @ApiOperation({ summary: 'Update settlement configuration' })
  @ApiBody({ type: UpdateSettlementsDto })
  @Patch('me/settlements')
  async updateSettlements(
    @GetBusinessId() businessId: string,
    @Body() dto: UpdateSettlementsDto,
  ) {
    return this.businessesService.updateSettlements(businessId, dto);
  }

  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiBody({ type: UpdateNotificationsDto })
  @Patch('me/notifications')
  async updateNotifications(
    @GetBusinessId() businessId: string,
    @Body() dto: UpdateNotificationsDto,
  ) {
    return this.businessesService.updateNotifications(businessId, dto);
  }
}
