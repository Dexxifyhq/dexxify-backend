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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiExcludeController,
} from '@nestjs/swagger';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';

@ApiTags('Businesses')
@ApiBearerAuth('api-key')
@DualAuth()
@ApiExcludeController()
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @ApiOperation({
    summary: 'Create a new business',
    description:
      'Creates a new business workspace for the current user. Use POST /auth/select-business to switch into it.',
  })
  @ApiBody({ type: CreateBusinessDto })
  @ApiCreatedResponse({ description: 'Business created successfully.' })
  @ApiErrorResponses(401, 404)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@GetUser('id') userId: string, @Body() dto: CreateBusinessDto) {
    return this.businessesService.create(userId, dto);
  }

  @ApiOperation({ summary: 'List all businesses the current user belongs to' })
  @ApiOkResponse({ description: 'Businesses retrieved successfully.' })
  @ApiErrorResponses(401)
  @Get()
  async listMyBusinesses(@GetUser('id') userId: string) {
    return this.businessesService.listForUser(userId);
  }

  @ApiOperation({ summary: 'Get active business profile' })
  @ApiOkResponse({ description: 'Business profile retrieved successfully.' })
  @ApiErrorResponses(401, 404)
  @Get('me')
  async getMyBusiness(@GetBusinessId() businessId: string) {
    return this.businessesService.getById(businessId);
  }

  @ApiOperation({ summary: 'Update business profile' })
  @ApiBody({ type: UpdateBusinessProfileDto })
  @ApiOkResponse({ description: 'Business profile updated successfully.' })
  @ApiErrorResponses(401, 404)
  @Patch('me')
  async updateProfile(
    @GetBusinessId() businessId: string,
    @Body() dto: UpdateBusinessProfileDto,
  ) {
    return this.businessesService.updateProfile(businessId, dto);
  }

  @ApiOperation({ summary: 'Update settlement configuration' })
  @ApiBody({ type: UpdateSettlementsDto })
  @ApiOkResponse({
    description: 'Settlement configuration updated successfully.',
  })
  @ApiErrorResponses(401, 404)
  @Patch('me/settlements')
  async updateSettlements(
    @GetBusinessId() businessId: string,
    @Body() dto: UpdateSettlementsDto,
  ) {
    return this.businessesService.updateSettlements(businessId, dto);
  }

  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiBody({ type: UpdateNotificationsDto })
  @ApiOkResponse({
    description: 'Notification preferences updated successfully.',
  })
  @ApiErrorResponses(401, 404)
  @Patch('me/notifications')
  async updateNotifications(
    @GetBusinessId() businessId: string,
    @Body() dto: UpdateNotificationsDto,
  ) {
    return this.businessesService.updateNotifications(businessId, dto);
  }
}
