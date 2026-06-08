import { Injectable, Logger, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CustomerWallet,
  WalletAsset,
  WalletNetwork,
} from '../../database/entities';
import { generateUniqueId } from '../../common/utils';

@Injectable()
export class CustomerWalletsService {
  private readonly logger = new Logger(CustomerWalletsService.name);
  private readonly breetApiUrl: string;
  private readonly breetAppId: string;
  private readonly breetApiKey: string;
  private readonly breetEnv: string;

  constructor(
    @InjectRepository(CustomerWallet)
    private readonly customerWalletRepo: Repository<CustomerWallet>,
    private readonly config: ConfigService,
  ) {
    const isProduction =
      this.config.get<string>('app.nodeEnv') === 'production';
    this.breetApiUrl = this.config.get<string>('breet.apiUrl') || '';
    this.breetEnv = isProduction
      ? this.config.get<string>('breet.env') || ''
      : this.config.get<string>('breet.testEnv') || '';
    this.breetAppId = isProduction
      ? this.config.get<string>('breet.appId') || ''
      : this.config.get<string>('breet.testAppId') || '';
    this.breetApiKey = isProduction
      ? this.config.get<string>('breet.secretKey') || ''
      : this.config.get<string>('breet.testSecretKey') || '';
  }

  /**
   * Returns an existing deposit address for the customer+asset+network combo,
   * or provisions a new one from Breet and persists it.
   */
  async getOrCreate(
    customerId: string,
    developerId: string,
    asset: WalletAsset,
    assetId: string,
    network: WalletNetwork,
    autoSettlement: boolean,
    bankAccount: any,
  ): Promise<CustomerWallet> {
    const existing = await this.customerWalletRepo.findOne({
      where: {
        developer_id: developerId,
        customer_id: customerId,
        crypto_asset: asset,
        network,
      },
    });

    if (existing) {
      this.logger.log(
        `Reusing deposit address for customer ${customerId} / ${asset}`,
      );
      return existing;
    }

    const { breetWalletId, address } = await this.provisionBreetAddress(
      asset,
      assetId,
      customerId,
      autoSettlement,
      bankAccount,
    );

    const customerWallet = this.customerWalletRepo.create({
      developer_id: developerId,
      asset_id: assetId,
      customer_id: customerId,
      crypto_asset: asset,
      network,
      deposit_address: address,
      breet_wallet_id: breetWalletId,
      auto_settled: autoSettlement,
      bank_id: bankAccount?.id,
      account_number: bankAccount?.account_number,
    });

    const saved = await this.customerWalletRepo.save(customerWallet);
    this.logger.log(
      `Provisioned new deposit address for customer ${customerId} / ${asset}: ${address}`,
    );
    return saved;
  }

  private async provisionBreetAddress(
    asset: WalletAsset,
    assetId: string,
    customerId: string,
    autoSettlement: boolean,
    bankAccount: any,
  ): Promise<{ breetWalletId: string; address: string }> {
    const url = `${this.breetApiUrl}/v1/trades/sell/assets/${assetId}/generate-address`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    const body = {
      label: `cw_${customerId.replace(/-/g, '').slice(0, 12)}_${generateUniqueId().slice(0, 6)}`,
      narration: 'Customer payment',
      autoSettlement: bankAccount && autoSettlement,
      bankId: bankAccount?.breet_bank_id,
      accountNumber: bankAccount?.account_number,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      const message = error.message || response.statusText;
      this.logger.error(
        `Failed to provision Breet address for ${asset}: ${message}`,
      );
      throw new HttpException(message, response.status);
    }

    const data = await response.json();
    return { breetWalletId: data.data.id, address: data.data.address };
  }
}
