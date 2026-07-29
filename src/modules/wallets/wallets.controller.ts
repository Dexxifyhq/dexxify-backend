import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
} from '@nestjs/common';
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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiTags,
  ApiPropertyOptional,
  ApiProperty,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, IsNotEmpty } from 'class-validator';
import { DepositAccount } from 'src/database/entities';

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

export class UpdateWalletBankDetailsDto {
  @ApiProperty({ description: 'Bank ID', example: '39' })
  @IsString()
  @IsNotEmpty()
  bank_id: string;

  @ApiProperty({ description: 'Account number', example: '2249098732' })
  @IsString()
  @IsNotEmpty()
  account_number: string;

  @ApiPropertyOptional({ description: 'Narration', example: 'Dexxify Payout' })
  @IsString({
    validateIf: (obj) =>
      obj.narration !== undefined && obj.narration.length <= 32,
  }) // Max 32 chars
  @IsOptional()
  narration?: string;

  @ApiPropertyOptional({ description: 'Auto settlement', example: true })
  @IsString()
  @IsOptional()
  auto_settlement?: boolean;
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
  @ApiOperation({
    summary: 'Create a new wallet',
    description: 'Create a new crypto wallet for the authenticated developer',
  })
  @ApiCreatedResponse({
    description: 'Deposit account created successfully',
    type: DepositAccount,
  })
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
    summary: 'Get all wallets',
    description:
      'Retrieve all wallets for the authenticated developer with optional filtering',
  })
  async findAll(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Query() query: WalletQueryDto,
  ) {
    return this.walletsService.findAll(businessId, mode, query);
  }

  @Get(':wallet_id')
  @ApiOperation({
    summary: 'Get wallet by ID',
    description: 'Retrieve a specific wallet by its ID',
  })
  @ApiParam({
    name: 'wallet_id',
    description: 'Wallet unique identifier',
    example: '67063f653b4a1f6c7a60ec57',
  })
  async findOne(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('wallet_id') walletId: string,
  ) {
    return this.walletsService.findOne(businessId, mode, walletId);
  }

  @Get(':wallet_id/details')
  @ApiOperation({
    summary: 'Get detailed wallet info',
    description: 'Get comprehensive wallet details from the crypto provider',
  })
  @ApiParam({
    name: 'wallet_id',
    description: 'Wallet unique identifier',
    example: '67063f653b4a1f6c7a60ec57',
  })
  async getWalletDetails(@Param('wallet_id') walletId: string) {
    return this.walletsService.getWalletDetails(walletId);
  }

  @Get('details/all')
  @ApiOperation({
    summary: 'Get all wallet details',
    description: 'Retrieve detailed information for all wallets',
  })
  async getAllWalletDetails() {
    return this.walletsService.getAllWalletDetails();
  }

  @Post(':wallet_id/identities')
  @ApiOperation({
    summary: 'Issue a deposit identity',
    description:
      'Provisions a new static crypto deposit address (per chain) or an NGN virtual bank account onto an existing deposit account.',
  })
  @ApiParam({ name: 'wallet_id', description: 'Deposit account ID' })
  @ApiBody({ type: IssueDepositIdentityDto })
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
  async removeWithdrawalAddress(
    @Param('withdrawalAddressId') withdrawalAddressId: string,
  ) {
    return this.walletsService.removeWithdrawalAddress(withdrawalAddressId);
  }

  // Initiate withdrawals and fetch withdrawals
  @Post('withdrawals/stable-coins')
  @ApiOperation({
    summary: 'Initiate stable coin withdrawal',
    description: 'Initiate a stable coin withdrawal from a wallet',
  })
  @ApiBody({ type: InitiateStableCoinWithdrawalDto })
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
  @ApiOperation({
    summary: 'Initiate withdrawal for local currencies',
    description: 'Initiate a withdrawal for local currencies from a wallet',
  })
  @ApiBody({ type: InitiateFiatWithdrawalDto })
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
  async listPayouts(
    @GetMode() mode: 'live' | 'test',
    @Query('page') page: string,
    @Query('size') size: string,
  ) {
    return this.walletsService.listPayouts(mode, { page, size });
  }
}
