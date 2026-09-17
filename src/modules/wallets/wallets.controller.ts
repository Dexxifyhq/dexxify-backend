import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { KycVerifiedGuard } from '../../common/guards/kyc-verified.guard';
import { WalletsService } from './wallets.service';
import {
  CreateWalletDto,
  WalletQueryDto,
  AddWithdrawalAddressDto,
  InitiateStableCoinWithdrawalDto,
  InitiateFiatWithdrawalDto,
  IssueDepositIdentityDto,
} from './dto';
import { GetBusinessId, GetMode, DualAuth } from '../../common/decorators';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiTags,
  ApiPropertyOptional,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString } from 'class-validator';
import { DepositAccount } from '../../database/entities';

export class CustomQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Number of items per page', example: 10 })
  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class UpdateWalletAutoSettlementDto {
  @ApiPropertyOptional({ description: 'Auto settlement', example: true })
  @IsString()
  @IsOptional()
  auto_settlement: boolean;
}

@ApiTags('Deposit Account')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  @UseGuards(KycVerifiedGuard)
  @ApiOperation({
    summary: 'Create a new deposit account',
    description: 'Create a new deposit account for the authenticated user',
  })
  @ApiCreatedResponse({
    description: 'Deposit account created successfully',
    type: DepositAccount,
  })
  @ApiErrorResponses(400, 401)
  @ApiBody({ type: CreateWalletDto })
  async create(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreateWalletDto,
  ) {
    return this.walletsService.create(businessId, mode, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all deposit accounts',
    description:
      'Retrieve all deposit accounts for the authenticated user with optional filtering',
  })
  @ApiOkResponse({ description: 'Deposit accounts retrieved successfully.' })
  @ApiErrorResponses(401)
  async findAll(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Query() query: WalletQueryDto,
  ) {
    return this.walletsService.findAll(businessId, mode, query);
  }

  @Get(':wallet_id')
  @ApiOperation({
    summary: 'Get deposit account by ID',
    description: 'Retrieve a specific deposit account by its ID',
  })
  @ApiParam({
    name: 'wallet_id',
    description: 'Deposit account unique identifier',
    example: '67063f653b4a1f6c7a60ec57',
  })
  @ApiOkResponse({ description: 'Wallet retrieved successfully.' })
  @ApiErrorResponses(401, 404)
  async findOne(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('wallet_id') walletId: string,
  ) {
    return this.walletsService.findOne(businessId, mode, walletId);
  }

  @Get(':wallet_id/details')
  @ApiOperation({
    summary: 'Get detailed deposit account info',
    description:
      'Get comprehensive deposit account details from the crypto provider',
  })
  @ApiParam({
    name: 'wallet_id',
    description: 'Deposit account unique identifier',
    example: '67063f653b4a1f6c7a60ec57',
  })
  @ApiOkResponse({ description: 'Wallet details retrieved successfully.' })
  @ApiErrorResponses(400, 401)
  async getWalletDetails(
    @Param('wallet_id') walletId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.walletsService.getWalletDetails(walletId, mode);
  }

  @Get('details/all')
  @ApiOperation({
    summary: 'Get all deposit account details',
    description: 'Retrieve detailed information for all deposit accounts',
  })
  @ApiOkResponse({
    description: 'Deposit account details retrieved successfully.',
  })
  @ApiErrorResponses(400, 401)
  async getAllWalletDetails(@GetMode() mode: 'live' | 'test') {
    return this.walletsService.getAllWalletDetails(mode);
  }

  @Post(':wallet_id/identities')
  @UseGuards(KycVerifiedGuard)
  @ApiOperation({
    summary: 'Issue a deposit identity',
    description:
      'Provisions a new static crypto deposit address (per chain) or an NGN virtual bank account onto an existing deposit account.',
  })
  @ApiParam({ name: 'wallet_id', description: 'Deposit account ID' })
  @ApiBody({ type: IssueDepositIdentityDto })
  @ApiCreatedResponse({ description: 'Deposit identity issued successfully.' })
  @ApiErrorResponses(400, 401, 403, 404)
  async issueIdentity(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('wallet_id') walletId: string,
    @Body() dto: IssueDepositIdentityDto,
  ) {
    return this.walletsService.issueIdentity(businessId, mode, walletId, dto);
  }

  // Withdrawal Address Endpoints
  @Post('withdrawal-addresses')
  @ApiOperation({
    summary: 'Add withdrawal address',
    description: 'Add a withdrawal (payout) wallet address for stable coins',
  })
  @ApiBody({ type: AddWithdrawalAddressDto })
  @ApiCreatedResponse({ description: 'Withdrawal address added successfully.' })
  @ApiErrorResponses(400, 401)
  async addWithdrawalAddress(
    @Body() dto: AddWithdrawalAddressDto,
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.walletsService.addWithdrawalAddress(dto, businessId, mode);
  }

  @Get('withdrawal-addresses/saved')
  @ApiOperation({
    summary: 'Get saved withdrawal addresses',
    description: 'Fetch all saved withdrawal (payout) wallet addresses',
  })
  @ApiOkResponse({
    description: 'Saved withdrawal addresses retrieved successfully.',
  })
  @ApiErrorResponses(401)
  async getSavedWithdrawalAddresses(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.walletsService.getSavedWithdrawalAddresses(businessId, mode);
  }

  @Get('withdrawal-addresses')
  @ApiOperation({
    summary: 'Get withdrawal addresses',
    description: 'Fetch all withdrawal (payout) wallet addresses',
  })
  @ApiOkResponse({
    description: 'Withdrawal addresses retrieved successfully.',
  })
  @ApiErrorResponses(401)
  async getWithdrawalAddresses() {
    return this.walletsService.getWithdrawalAddresses();
  }

  @Delete('withdrawal-addresses/:withdrawalAddressId')
  @ApiOperation({
    summary: 'Remove withdrawal address',
    description: 'Remove a saved withdrawal address by its ID',
  })
  @ApiParam({
    name: 'withdrawalAddressId',
    description: 'Withdrawal address unique identifier',
  })
  @ApiOkResponse({ description: 'Withdrawal address removed successfully.' })
  @ApiErrorResponses(401, 404)
  async removeWithdrawalAddress(
    @Param('withdrawalAddressId') withdrawalAddressId: string,
  ) {
    return this.walletsService.removeWithdrawalAddress(withdrawalAddressId);
  }

  // Initiate withdrawals and fetch withdrawals
  @Post('withdrawals/stable-coins')
  @UseGuards(KycVerifiedGuard)
  @ApiOperation({
    summary: 'Initiate stable coin withdrawal',
    description: 'Initiate a stable coin withdrawal from a wallet',
  })
  @ApiBody({ type: InitiateStableCoinWithdrawalDto })
  @ApiCreatedResponse({
    description: 'Stable coin withdrawal initiated successfully.',
  })
  @ApiErrorResponses(400, 401, 403)
  async initiateStableCoinWithdrawal(
    @Body() dto: InitiateStableCoinWithdrawalDto,
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.walletsService.initiateStableCoinWithdrawal(
      dto,
      businessId,
      mode,
    );
  }

  @Post('withdrawals/local-currencies')
  @UseGuards(KycVerifiedGuard)
  @ApiOperation({
    summary: 'Initiate withdrawal for local currencies',
    description: 'Initiate a withdrawal for local currencies from a wallet',
  })
  @ApiBody({ type: InitiateFiatWithdrawalDto })
  @ApiCreatedResponse({
    description: 'Fiat withdrawal initiated successfully.',
  })
  @ApiErrorResponses(400, 401, 403)
  async initiateFiattWithdrawal(
    @Body() dto: InitiateFiatWithdrawalDto,
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.walletsService.initiateFiatWithdrawal(dto, businessId, mode);
  }

  @Get('withdrawals')
  @ApiOperation({
    summary: 'Get withdrawals',
    description: 'Fetch all payouts / withdrawals',
  })
  @ApiOkResponse({ description: 'Withdrawals retrieved successfully.' })
  @ApiErrorResponses(401)
  async listPayouts(
    @GetMode() mode: 'live' | 'test',
    @Query('page') page: string,
    @Query('size') size: string,
  ) {
    return this.walletsService.listPayouts(mode, { page, size });
  }
}
