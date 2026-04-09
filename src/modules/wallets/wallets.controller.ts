import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { CreateWalletDto, TransferDto, WalletQueryDto } from './dto';
import { GetDeveloper } from '../../common/decorators';
import { ApiBearerAuth } from '@nestjs/swagger';

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
    @Param('wallet_id', ParseUUIDPipe) walletId: string,
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
    @Param('wallet_id', ParseUUIDPipe) walletId: string,
  ) {
    return this.walletsService.getDepositAddress(developerId, walletId);
  }

  @Get(':wallet_id/transactions')
  async getTransactions(
    @GetDeveloper('id') developerId: string,
    @Param('wallet_id', ParseUUIDPipe) walletId: string,
    @Query() query: any,
  ) {
    return this.walletsService.getTransactions(developerId, walletId, query);
  }

  @Post('transfer')
  async transfer(
    @GetDeveloper('id') developerId: string,
    @Body() dto: TransferDto,
  ) {
    return this.walletsService.transfer(developerId, dto);
  }
}
