import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  Put,
} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import {
  CreateWalletDto,
  WalletQueryDto,
  AddWithdrawalAddressDto,
  InitiateStableCoinWithdrawalDto,
  InitiateFiatWithdrawalDto,
} from './dto';
import { GetDeveloper, DualAuth } from '../../common/decorators';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiTags,
  ApiPropertyOptional,
  ApiProperty,
} from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, IsNotEmpty } from 'class-validator';

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

@ApiTags('Wallets')
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
  @ApiBody({ type: CreateWalletDto })
  async create(
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreateWalletDto,
  ) {
    return this.walletsService.create(developerId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all wallets',
    description:
      'Retrieve all wallets for the authenticated developer with optional filtering',
  })
  async findAll(
    @GetDeveloper('id') developerId: string,
    @Query() query: WalletQueryDto,
  ) {
    return this.walletsService.findAll(developerId, query);
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
    @GetDeveloper('id') developerId: string,
    @Param('wallet_id') walletId: string,
  ) {
    return this.walletsService.findOne(developerId, walletId);
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

  @Get(':wallet_id/address')
  @ApiOperation({
    summary: 'Get deposit address',
    description: 'Get the deposit address for a specific wallet',
  })
  @ApiParam({
    name: 'wallet_id',
    description: 'Wallet unique identifier',
    example: '67063f653b4a1f6c7a60ec57',
  })
  async getDepositAddress(
    @GetDeveloper('id') developerId: string,
    @Param('wallet_id') walletId: string,
  ) {
    return this.walletsService.getDepositAddress(developerId, walletId);
  }

  // @Get('/transactions/all')
  // @ApiOperation({
  //   summary: 'Get all transactions',
  //   description: 'Retrieve all transactions across all developer wallets',
  // })
  // @ApiQuery({ type: CustomQueryDto })
  // async getAllTransactions(
  //   @GetDeveloper('id') developerId: string,
  //   @Query() query: CustomQueryDto,
  // ) {
  //   return this.walletsService.getAllTransactions(developerId, query);
  // }

  // @Get(':wallet_id/transactions')
  // @ApiOperation({
  //   summary: 'Get wallet transactions',
  //   description: 'Retrieve transactions for a specific wallet with pagination',
  // })
  // @ApiParam({
  //   name: 'wallet_id',
  //   description: 'Wallet unique identifier',
  //   example: '67063f653b4a1f6c7a60ec57',
  // })
  // @ApiQuery({ type: CustomQueryDto })
  // async getTransactions(
  //   @GetDeveloper('id') developerId: string,
  //   @Param('transaction_id') transactionId: string,
  //   @Query() query: CustomQueryDto,
  // ) {
  //   return this.walletsService.getTransactionsById(
  //     developerId,
  //     transactionId,
  //     query,
  //   );
  // }

  // @Get('/:wallet_id/transactions/all')
  // async getAllTransactionsByWallet(
  //   @GetDeveloper('id') developerId: string,
  //   @Query() query: any,
  // ) { ... }

  // @Get('/breet/:wallet_id/transactions')
  // async getWalletTransactionsById(
  //   @GetDeveloper('id') developerId: string,
  //   @Param('wallet_id') walletId: string,
  //   @Query() query: any,
  // ) {
  //   return this.walletsService.getTransactionsByWalletId(
  //     developerId,
  //     walletId,
  //     query,
  //   );
  // }

  // @Post('transfer')
  // @ApiOperation({
  //   summary: 'Transfer between wallets',
  //   description: 'Transfer funds between two wallets owned by the developer',
  // })
  // @ApiBody({ type: TransferDto })
  // async transfer(
  //   @GetDeveloper('id') developerId: string,
  //   @Body() dto: TransferDto,
  // ) {
  //   return this.walletsService.transfer(developerId, dto);
  // }

  // Withdrawal Address Endpoints
  @Post('withdrawal-addresses')
  @ApiOperation({
    summary: 'Add withdrawal address',
    description: 'Add a withdrawal (payout) wallet address for stable coins',
  })
  @ApiBody({ type: AddWithdrawalAddressDto })
  async addWithdrawalAddress(
    @Body() dto: AddWithdrawalAddressDto,
    @GetDeveloper('id') developerId: string,
  ) {
    return this.walletsService.addWithdrawalAddress(dto, developerId);
  }

  @Get('withdrawal-addresses/saved')
  @ApiOperation({
    summary: 'Get saved withdrawal addresses',
    description: 'Fetch all saved withdrawal (payout) wallet addresses',
  })
  async getSavedWithdrawalAddresses(@GetDeveloper('id') developerId: string) {
    return this.walletsService.getSavedWithdrawalAddresses(developerId);
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
    @GetDeveloper('id') developerId: string,
  ) {
    return this.walletsService.initiateStableCoinWithdrawal(dto, developerId);
  }

  @Post('withdrawals/local-currencies')
  @ApiOperation({
    summary: 'Initiate withdrawal for local currencies',
    description: 'Initiate a withdrawal for local currencies from a wallet',
  })
  @ApiBody({ type: InitiateFiatWithdrawalDto })
  async initiateFiattWithdrawal(
    @Body() dto: InitiateFiatWithdrawalDto,
    @GetDeveloper('id') developerId: string,
  ) {
    return this.walletsService.initiateFiatWithdrawal(dto, developerId);
  }

  @Get('withdrawals')
  @ApiOperation({
    summary: 'Get withdrawals',
    description: 'Fetch all payouts / withdrawals',
  })
  async listPayouts(@Query('page') page: string, @Query('size') size: string) {
    return this.walletsService.listPayouts({ page, size });
  }

  // @Get('withdrawals/:withdrawalId')
  // @ApiOperation({
  //   summary: 'Get withdrawal by ID',
  //   description: 'Fetch a specific withdrawal by ID',
  // })
  // @ApiParam({
  //   name: 'withdrawalId',
  //   description: 'Withdrawal unique identifier',
  // })
  // async getWithdrawalsById() {
  //   return this.walletsService.getWithdrawalsById();
  // }
}
