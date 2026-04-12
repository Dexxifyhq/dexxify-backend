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
  TransferDto,
  WalletQueryDto,
  MockTradeDto,
  AddWithdrawalAddressDto,
} from './dto';
import { GetDeveloper } from '../../common/decorators';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiTags,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsOptional, IsNumber } from 'class-validator';

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

@ApiTags('Wallets')
@ApiBearerAuth('api-key')
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
    description:
      'Get comprehensive wallet details including Breet integration data',
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

  @Get('/transactions/all')
  @ApiOperation({
    summary: 'Get all transactions',
    description: 'Retrieve all transactions across all developer wallets',
  })
  @ApiQuery({ type: CustomQueryDto })
  async getAllTransactions(
    @GetDeveloper('id') developerId: string,
    @Query() query: CustomQueryDto,
  ) {
    return this.walletsService.getAllTransactions(developerId, query);
  }

  @Get(':wallet_id/transactions')
  @ApiOperation({
    summary: 'Get wallet transactions',
    description: 'Retrieve transactions for a specific wallet with pagination',
  })
  @ApiParam({
    name: 'wallet_id',
    description: 'Wallet unique identifier',
    example: '67063f653b4a1f6c7a60ec57',
  })
  @ApiQuery({ type: CustomQueryDto })
  async getTransactions(
    @GetDeveloper('id') developerId: string,
    @Param('wallet_id') walletId: string,
    @Query() query: CustomQueryDto,
  ) {
    return this.walletsService.getTransactionsByWalletId(
      developerId,
      walletId,
      query,
    );
  }

  // @Get('/breet/transactions/all')
  // async getAllBreetTransactions(
  //   @GetDeveloper('id') developerId: string,
  //   @Query() query: any,
  // ) {
  //   return this.walletsService.getBreetWalletTransactions(developerId, query);
  // }

  // @Get('/breet/:wallet_id/transactions')
  // async getBreetWalletTransactions(
  //   @GetDeveloper('id') developerId: string,
  //   @Param('wallet_id') walletId: string,
  //   @Query() query: any,
  // ) {
  //   return this.walletsService.getBreetWalletTransactionsById(
  //     developerId,
  //     walletId,
  //     query,
  //   );
  // }

  @Post('transfer')
  @ApiOperation({
    summary: 'Transfer between wallets',
    description: 'Transfer funds between two wallets owned by the developer',
  })
  @ApiBody({ type: TransferDto })
  async transfer(
    @GetDeveloper('id') developerId: string,
    @Body() dto: TransferDto,
  ) {
    return this.walletsService.transfer(developerId, dto);
  }

  @Post('/mock-trade')
  @ApiOperation({
    summary: 'Mock a trade (development only)',
    description:
      'Simulate an incoming deposit for testing purposes. Only available in development environment.',
  })
  @ApiBody({ type: MockTradeDto })
  async mockTrade(
    @GetDeveloper('id') developerId: string,
    @Body() dto: MockTradeDto,
  ) {
    return this.walletsService.mockBreetTrade(developerId, dto);
  }

  // Withdrawal Address Endpoints
  @Post('withdrawal-addresses')
  @ApiOperation({
    summary: 'Add withdrawal address',
    description: 'Add a withdrawal (payout) wallet address for stable coins',
  })
  @ApiBody({ type: AddWithdrawalAddressDto })
  async addWithdrawalAddress(@Body() dto: AddWithdrawalAddressDto) {
    return this.walletsService.addWithdrawalAddress(dto);
  }

  @Get('withdrawal-addresses')
  @ApiOperation({
    summary: 'Get withdrawal addresses',
    description: 'Fetch all saved withdrawal (payout) wallet addresses',
  })
  async getWithdrawalAddresses() {
    return this.walletsService.getWithdrawalAddresses();
  }

  @Delete('withdrawal-addresses/:withdrwalAddressId')
  @ApiOperation({
    summary: 'Remove withdrawal address',
    description: 'Remove a saved withdrawal address by its ID',
  })
  @ApiParam({
    name: 'withdrwalAddressId',
    description: 'Withdrawal address unique identifier',
  })
  async removeWithdrawalAddress(
    @Param('withdrwalAddressId') withdrwalAddressId: string,
  ) {
    return this.walletsService.removeWithdrawalAddress(withdrwalAddressId);
  }
}
