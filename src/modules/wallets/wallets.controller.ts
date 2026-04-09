import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import {
  CreateWalletDto,
  TransferDto,
  WalletQueryDto,
  MockTradeDto,
} from './dto';
import { GetDeveloper } from '../../common/decorators';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
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

@ApiBearerAuth('api-key')
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post()
  async create(
    @GetDeveloper('id') developerId: string,
    @Body() dto: CreateWalletDto,
  ) {
    return this.walletsService.create(developerId, dto);
  }

  @Get()
  async findAll(
    @GetDeveloper('id') developerId: string,
    @Query() query: WalletQueryDto,
  ) {
    return this.walletsService.findAll(developerId, query);
  }

  @Get(':wallet_id')
  async findOne(
    @GetDeveloper('id') developerId: string,
    @Param('wallet_id') walletId: string,
  ) {
    return this.walletsService.findOne(developerId, walletId);
  }

  @Get(':wallet_id/details')
  async getWalletDetails(@Param('wallet_id') walletId: string) {
    return this.walletsService.getWalletDetails(walletId);
  }

  @Get('details/all')
  async getAllWalletDetails() {
    return this.walletsService.getAllWalletDetails();
  }

  @Get(':wallet_id/address')
  async getDepositAddress(
    @GetDeveloper('id') developerId: string,
    @Param('wallet_id') walletId: string,
  ) {
    return this.walletsService.getDepositAddress(developerId, walletId);
  }

  @Get('/transactions/all')
  async getAllTransactions(
    @GetDeveloper('id') developerId: string,
    @Query() query: CustomQueryDto,
  ) {
    return this.walletsService.getAllTransactions(developerId, query);
  }

  @Get(':wallet_id/transactions')
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
  async transfer(
    @GetDeveloper('id') developerId: string,
    @Body() dto: TransferDto,
  ) {
    return this.walletsService.transfer(developerId, dto);
  }

  @Post('/mock-trade')
  async mockTrade(
    @GetDeveloper('id') developerId: string,
    @Body() dto: MockTradeDto,
  ) {
    return this.walletsService.mockBreetTrade(developerId, dto);
  }
}
