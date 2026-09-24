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
import { DepositAccountsService } from './deposit-accounts.service';
import {
  CreateDepositAccountDto,
  DepositAccountQueryDto,
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

export class UpdateDepositAccountAutoSettlementDto {
  @ApiPropertyOptional({ description: 'Auto settlement', example: true })
  @IsString()
  @IsOptional()
  auto_settlement: boolean;
}

const DEPOSIT_ACCOUNT_EXAMPLE = {
  id: '67063f653b4a1f6c7a60ec57',
  business_id: '8e2f6b2a-df9c-4c2a-9a0a-9e6a2a2b6a11',
  mode: 'test',
  customer_id: '3c1e6a2a-2b3c-4d5e-8f9a-1a2b3c4d5e6f',
  status: 'active',
  deposit_addresses: [
    {
      chain: 'tron',
      address: 'TXkPqR7YbAaHqZ5t5fRZ9Zk3f2NcQvJ9f2A',
      createdAt: '2026-09-01T10:15:00.000Z',
    },
  ],
  ngn_virtual_accounts: [],
  created_at: '2026-09-01T10:15:00.000Z',
  updated_at: '2026-09-01T10:15:00.000Z',
};

const CC_DEPOSIT_ACCOUNT_DATA_EXAMPLE = {
  id: '67063f653b4a1f6c7a60ec57',
  staticDepositAddresses: [
    {
      chain: 'tron',
      address: 'TXkPqR7YbAaHqZ5t5fRZ9Zk3f2NcQvJ9f2A',
      createdAt: '2026-09-01T10:15:00.000Z',
    },
  ],
  ngnVirtualAccounts: [
    {
      currency: 'NGN',
      accountNumber: '0123456789',
      accountName: 'Dexxify Test Business',
      bankName: 'Wema Bank',
      bankCode: '035',
      accountReference: 'dex_ngn_67063f65',
      createdAt: '2026-09-01T10:15:00.000Z',
    },
  ],
};

const WITHDRAWAL_WALLET_EXAMPLE = {
  id: '6a0ce75269321c4cb5eafe7d',
  business_id: '8e2f6b2a-df9c-4c2a-9a0a-9e6a2a2b6a11',
  mode: 'test',
  address: 'UQCvj9LMypzHShhTvO1qSLE0XiWxopEMweLh8MFnY3mxzLvi',
  network: 'bsc',
  token: 'USDT',
  label: 'My USDT Wallet',
  primary: true,
  created_at: '2026-09-01T10:15:00.000Z',
  updated_at: '2026-09-01T10:15:00.000Z',
};

@ApiTags('Deposit Account')
@ApiBearerAuth('api-key')
@DualAuth()
@Controller('deposit-accounts')
export class DepositAccountsController {
  constructor(
    private readonly depositAccountsService: DepositAccountsService,
  ) {}

  @Post()
  @UseGuards(KycVerifiedGuard)
  @ApiOperation({
    summary: 'Create a new deposit account',
    description: 'Create a new deposit account for the authenticated user',
  })
  @ApiCreatedResponse({
    description: 'Deposit account created successfully.',
    type: DepositAccount,
    example: DEPOSIT_ACCOUNT_EXAMPLE,
  })
  @ApiErrorResponses(
    {
      status: 400,
      message: 'Failed to create deposit account.',
    },
    401,
    {
      status: 403,
      message:
        'This action requires a verified identity. Complete individual KYC verification first.',
    },
  )
  @ApiBody({ type: CreateDepositAccountDto })
  async create(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Body() dto: CreateDepositAccountDto,
  ) {
    return this.depositAccountsService.create(businessId, mode, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all deposit accounts',
    description:
      'Retrieve all deposit accounts for the authenticated user with optional filtering',
  })
  @ApiOkResponse({
    description: 'Deposit accounts retrieved successfully.',
    schema: {
      example: {
        data: [DEPOSIT_ACCOUNT_EXAMPLE],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          total_pages: 1,
          has_next: false,
          has_prev: false,
        },
      },
    },
  })
  @ApiErrorResponses(401)
  async findAll(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Query() query: DepositAccountQueryDto,
  ) {
    return this.depositAccountsService.findAll(businessId, mode, query);
  }

  @Get(':deposit_account_id')
  @ApiOperation({
    summary: 'Get deposit account by ID',
    description: 'Retrieve a specific deposit account by its ID',
  })
  @ApiParam({
    name: 'deposit_account_id',
    description: 'Deposit account unique identifier',
    example: '67063f653b4a1f6c7a60ec57',
  })
  @ApiOkResponse({
    description: 'Deposit account retrieved successfully.',
    type: DepositAccount,
    example: DEPOSIT_ACCOUNT_EXAMPLE,
  })
  @ApiErrorResponses(401, {
    status: 404,
    message: 'Deposit account not found.',
  })
  async findOne(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('deposit_account_id') depositAccountId: string,
  ) {
    return this.depositAccountsService.findOne(
      businessId,
      mode,
      depositAccountId,
    );
  }

  @Get(':deposit_account_id/details')
  @ApiOperation({
    summary: 'Get detailed deposit account info',
    description:
      'Get comprehensive deposit account details from the crypto provider',
  })
  @ApiParam({
    name: 'deposit_account_id',
    description: 'Deposit account unique identifier',
    example: '67063f653b4a1f6c7a60ec57',
  })
  @ApiOkResponse({
    description: 'Deposit account details retrieved successfully.',
    schema: { example: CC_DEPOSIT_ACCOUNT_DATA_EXAMPLE },
  })
  @ApiErrorResponses(
    {
      status: 400,
      message: 'Failed to retrieve deposit account with crypto provider.',
    },
    401,
  )
  async getDepositAccountDetails(
    @Param('deposit_account_id') depositAccountId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.depositAccountsService.getDepositAccountDetails(
      depositAccountId,
      mode,
    );
  }

  @Get('details/all')
  @ApiOperation({
    summary: 'Get all deposit account details',
    description: 'Retrieve detailed information for all deposit accounts',
  })
  @ApiOkResponse({
    description: 'Deposit account details retrieved successfully.',
    schema: { example: [CC_DEPOSIT_ACCOUNT_DATA_EXAMPLE] },
  })
  @ApiErrorResponses(
    {
      status: 400,
      message: 'Failed to retrieve deposit accounts with crypto provider.',
    },
    401,
  )
  async getAllDepositAccountDetails(@GetMode() mode: 'live' | 'test') {
    return this.depositAccountsService.getAllDepositAccountDetails(mode);
  }

  @Post(':deposit_account_id/identities')
  @UseGuards(KycVerifiedGuard)
  @ApiOperation({
    summary: 'Issue a deposit identity',
    description:
      'Provisions a new static crypto deposit address (per chain) or an NGN virtual bank account onto an existing deposit account.',
  })
  @ApiParam({ name: 'deposit_account_id', description: 'Deposit account ID' })
  @ApiBody({ type: IssueDepositIdentityDto })
  @ApiCreatedResponse({
    description: 'Deposit identity issued successfully.',
    schema: { example: CC_DEPOSIT_ACCOUNT_DATA_EXAMPLE },
  })
  @ApiErrorResponses(
    { status: 400, message: 'BVN must be exactly 11 digits.' },
    401,
    {
      status: 403,
      message:
        'This action requires a verified identity. Complete individual KYC verification first.',
    },
    { status: 404, message: 'Deposit account not found.' },
  )
  async issueIdentity(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
    @Param('deposit_account_id') depositAccountId: string,
    @Body() dto: IssueDepositIdentityDto,
  ) {
    return this.depositAccountsService.issueIdentity(
      businessId,
      mode,
      depositAccountId,
      dto,
    );
  }

  // Withdrawal Address Endpoints
  @Post('withdrawal-addresses')
  @ApiOperation({
    summary: 'Add withdrawal address',
    description: 'Add a withdrawal (payout) wallet address for stable coins',
  })
  @ApiBody({ type: AddWithdrawalAddressDto })
  @ApiCreatedResponse({
    description: 'Withdrawal address added successfully.',
    schema: { example: { success: true, data: WITHDRAWAL_WALLET_EXAMPLE } },
  })
  @ApiErrorResponses(
    {
      status: 400,
      message:
        'network must be one of the following values: bsc, tron, solana, base, ethereum',
    },
    401,
  )
  async addWithdrawalAddress(
    @Body() dto: AddWithdrawalAddressDto,
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.depositAccountsService.addWithdrawalAddress(
      dto,
      businessId,
      mode,
    );
  }

  @Get('withdrawal-addresses/saved')
  @ApiOperation({
    summary: 'Get saved withdrawal addresses',
    description: 'Fetch all saved withdrawal (payout) wallet addresses',
  })
  @ApiOkResponse({
    description: 'Saved withdrawal addresses retrieved successfully.',
    schema: { example: [WITHDRAWAL_WALLET_EXAMPLE] },
  })
  @ApiErrorResponses(401)
  async getSavedWithdrawalAddresses(
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.depositAccountsService.getSavedWithdrawalAddresses(
      businessId,
      mode,
    );
  }

  @Get('withdrawal-addresses')
  @ApiOperation({
    summary: 'Get withdrawal addresses',
    description: 'Fetch all withdrawal (payout) wallet addresses',
  })
  @ApiOkResponse({
    description: 'Withdrawal addresses retrieved successfully.',
    schema: { example: [WITHDRAWAL_WALLET_EXAMPLE] },
  })
  @ApiErrorResponses(401)
  async getWithdrawalAddresses() {
    return this.depositAccountsService.getWithdrawalAddresses();
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
  @ApiOkResponse({
    description: 'Request processed successfully',
    schema: { example: { success: true } },
  })
  @ApiErrorResponses(401)
  async removeWithdrawalAddress(
    @Param('withdrawalAddressId') withdrawalAddressId: string,
  ) {
    return this.depositAccountsService.removeWithdrawalAddress(
      withdrawalAddressId,
    );
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
    schema: { example: { fee: 1.5, amount: 5 } },
  })
  @ApiErrorResponses({ status: 400, message: 'Insufficient balance' }, 401, {
    status: 403,
    message:
      'This action requires a verified identity. Complete individual KYC verification first.',
  })
  async initiateStableCoinWithdrawal(
    @Body() dto: InitiateStableCoinWithdrawalDto,
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.depositAccountsService.initiateStableCoinWithdrawal(
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
    schema: { example: { fee: 50, amount: 2000 } },
  })
  @ApiErrorResponses(
    { status: 400, message: 'Insufficient balance' },
    401,
    {
      status: 403,
      message:
        'This action requires a verified identity. Complete individual KYC verification first.',
    },
    { status: 404, message: 'Bank account not found.' },
  )
  async initiateFiattWithdrawal(
    @Body() dto: InitiateFiatWithdrawalDto,
    @GetBusinessId() businessId: string,
    @GetMode() mode: 'live' | 'test',
  ) {
    return this.depositAccountsService.initiateFiatWithdrawal(
      dto,
      businessId,
      mode,
    );
  }

  @Get('withdrawals')
  @ApiOperation({
    summary: 'Get withdrawals',
    description: 'Fetch all payouts / withdrawals',
  })
  @ApiOkResponse({
    description: 'Withdrawals retrieved successfully.',
  })
  @ApiErrorResponses(401)
  async listPayouts(
    @GetMode() mode: 'live' | 'test',
    @Query('page') page: string,
    @Query('size') size: string,
  ) {
    return this.depositAccountsService.listPayouts(mode, { page, size });
  }
}
