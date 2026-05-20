import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bank } from '../../database/entities/bank.entity';

@Injectable()
export class MiscService {
  private readonly logger = new Logger(MiscService.name);
  private readonly breetApiUrl: string;
  private readonly breetApiKey: string;
  private readonly breetAppId: string;
  private readonly breetEnv: string;

  // In-memory cache for bank list (rarely changes)
  private bankListCache: { data: any[]; fetchedAt: number } | null = null;
  private readonly BANK_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Bank)
    private readonly bankRepo: Repository<Bank>,
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

  // ── Banks ─────────────────────────────────────────────

  async getBanks() {
    // Return from cache if still fresh
    if (
      this.bankListCache &&
      Date.now() - this.bankListCache.fetchedAt < this.BANK_CACHE_TTL_MS
    ) {
      return { banks: this.bankListCache.data, cached: true };
    }

    const banks = await this.fetchBreetBanks();

    this.bankListCache = { data: banks, fetchedAt: Date.now() };

    return { banks, cached: false };
  }

  // 1. Add Bank
  async addBank(
    developerId: string,
    bankData: {
      accountNumber: string;
      bankId: string;
      narration?: string;
    },
  ) {
    const url = `${this.breetApiUrl}/v1/payments/banks/add`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    const payload = {
      accountNumber: bankData.accountNumber,
      id: bankData.bankId,
      ...(bankData.narration && { narration: bankData.narration }),
    };

    try {
      this.logger.log(`Adding bank account: ${JSON.stringify(payload)}`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log(`Bank account added successfully on Breet`);

      // Save to local database
      const bank = this.bankRepo.create({
        id: result.data.id,
        breet_bank_id: result.data.bankId,
        developer_id: developerId,
        account_name: result.data.accountName,
        account_number: result.data.accountNumber,
        auto_settlement: result.data.autoSettlement || false,
        bank_name: result.data.bankName,
        currency: result.data.currency || 'ngn',
        disabled: result.data.disabled || false,
        avatar: result.data.avatar,
        integration_id: result.data.integration,
        is_business: result.data.isBusiness || false,
        narration: result.data.narration || bankData.narration,
        type: result.data.type || 'nuban',
      });

      const savedBank = await this.bankRepo.save(bank);
      this.logger.log(`Bank account saved to local database: ${savedBank.id}`);

      return {
        ...result,
        local_id: savedBank.id,
      };
    } catch (error) {
      this.logger.error(`Failed to add bank account: ${error.message}`);
      throw error;
    }
  }

  async getSavedBanks(developerId: string) {
    return this.bankRepo.find({
      where: {
        developer_id: developerId,
      },
    });
  }

  async getSavedBanksById(developerId: string, accountNumber: string) {
    return this.bankRepo.findOne({
      where: {
        developer_id: developerId,
        account_number: accountNumber,
      },
    });
  }

  // 2. Fetch Bank by ID
  async getBreetBankById(bankId: string) {
    const url = `${this.breetApiUrl}/v1/payments/integration-banks/${bankId}`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    try {
      this.logger.log(`Fetching bank by ID: ${bankId}`);

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log(`Bank fetched successfully`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch bank by ID: ${error.message}`);
      throw error;
    }
  }

  // Fetch Saved Integration Bank
  async getBreetBankIntegration() {
    const url = `${this.breetApiUrl}/v1/payments/integration-banks?page=1&size=10`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    try {
      this.logger.log(`Fetching saved integration bank`);

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log(`Bank fetched successfully`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch bank integrations: ${error.message}`);
      throw error;
    }
  }

  // 3. Delete Bank
  async deleteBank(bankId: string) {
    const url = `${this.breetApiUrl}/v1/payments/banks/${bankId}`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      // 'Content-Type': 'application/json',
    };

    const selectedBank = await this.bankRepo.findOne({
      where: { id: bankId },
    });

    // if (!selectedBank) {
    //   throw new NotFoundException('Bank not found');
    // }

    try {
      this.logger.log(`Deleting bank account: ${bankId}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log(`Bank account deleted successfully`);

      await this.bankRepo.delete({ id: bankId });

      return result;
    } catch (error) {
      this.logger.error(`Failed to delete bank account: ${error.message}`);
      throw error;
    }
  }

  // 4. Verify Bank Account
  async verifyBankAccount(bankData: { accountNumber: string; bankId: string }) {
    const url = `${this.breetApiUrl}/v1/payments/banks/validate`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    const payload = {
      accountNumber: bankData.accountNumber,
      id: bankData.bankId,
    };

    try {
      this.logger.log(`Verifying bank account: ${JSON.stringify(payload)}`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log(`Bank account verified successfully`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to verify bank account: ${error.message}`);
      throw error;
    }
  }

  // ── Supported Assets & Currencies ─────────────────────

  async getSupportedDepositAssets() {
    const url = `${this.breetApiUrl}/v1/trades/assets`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      //   console.log('response', response);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const data = await response.json();
      // console.log('data', data);
      return data;
    } catch (error) {
      this.logger.error(`Failed to fetch deposit assets: ${error.message}`);
      throw error;
    }

    // return {
    //   crypto: [
    //     { symbol: 'BTC', name: 'Bitcoin', decimals: 8 },
    //     { symbol: 'USDT', name: 'Tether USD', decimals: 8 },
    //     { symbol: 'ETH', name: 'Ethereum', decimals: 8 },
    //     { symbol: 'USDC', name: 'USD Coin', decimals: 8 },
    //   ],
    // };
  }

  async getSupportedWithdrawalAssets() {
    const url = `${this.breetApiUrl}/v1/payments/supported-assets-info`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      //   console.log('response', response);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const data = await response.json();
      console.log('data', data);
      return data;
    } catch (error) {
      this.logger.error(`Failed to fetch withdrawal assets: ${error.message}`);
      throw error;
    }

    // return {
    //   crypto: [
    //     { symbol: 'BTC', name: 'Bitcoin', decimals: 8 },
    //     { symbol: 'USDT', name: 'Tether USD', decimals: 8 },
    //     { symbol: 'ETH', name: 'Ethereum', decimals: 8 },
    //     { symbol: 'USDC', name: 'USD Coin', decimals: 8 },
    //   ],
    // };
  }

  // ── Health Check ──────────────────────────────────────

  getHealth() {
    return {
      status: 'ok',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  // ── Breet Integration Stubs ───────────────────────────

  private async fetchBreetBanks(): Promise<any[]> {
    const url = `${this.breetApiUrl}/v1/payments/banks?currency=ngn`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      //   console.log('response', response);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const data = await response.json();
      //   console.log('data', data);
      // Monnify code is the bank code, our interest is in the bank code
      return data;
    } catch (error) {
      this.logger.error(`Failed to fetch banks: ${error.message}`);
      throw error;
    }

    // return [
    //   { code: '044', name: 'Access Bank' },
    //   { code: '023', name: 'Citibank Nigeria' },
    //   { code: '063', name: 'Diamond Bank' },
    //   { code: '050', name: 'Ecobank Nigeria' },
    //   { code: '070', name: 'Fidelity Bank' },
    //   { code: '011', name: 'First Bank of Nigeria' },
    //   { code: '214', name: 'First City Monument Bank' },
    //   { code: '058', name: 'Guaranty Trust Bank' },
    //   { code: '030', name: 'Heritage Bank' },
    //   { code: '301', name: 'Jaiz Bank' },
    //   { code: '082', name: 'Keystone Bank' },
    //   { code: '526', name: 'Parallex Bank' },
    //   { code: '076', name: 'Polaris Bank' },
    //   { code: '101', name: 'Providus Bank' },
    //   { code: '221', name: 'Stanbic IBTC Bank' },
    //   { code: '068', name: 'Standard Chartered Bank' },
    //   { code: '232', name: 'Sterling Bank' },
    //   { code: '100', name: 'Suntrust Bank' },
    //   { code: '032', name: 'Union Bank of Nigeria' },
    //   { code: '033', name: 'United Bank For Africa' },
    //   { code: '215', name: 'Unity Bank' },
    //   { code: '035', name: 'Wema Bank' },
    //   { code: '057', name: 'Zenith Bank' },
    //   { code: '305', name: 'OPay' },
    //   { code: '100033', name: 'PalmPay' },
    //   { code: '50211', name: 'Kuda Microfinance Bank' },
    //   { code: '090405', name: 'Moniepoint Microfinance Bank' },
    // ];
  }

  // 1. Get crypto prices (global market prices)
  async getCryptoPrices(options: {
    to: string;
    from: string;
  }): Promise<{ price: any }> {
    const params = new URLSearchParams();
    params.append('to', options.to.toString());
    params.append('from', options.from.toString());

    const url = `${this.breetApiUrl}/v1/trades/pbc/sell/assets/market/converter?${params.toString()}`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const price = await response.json();

      if (!price) {
        throw new Error(`Price not found for ${options.to}-${options.from}`);
      }

      return price;
    } catch (error) {
      this.logger.error(
        `Failed to fetch crypto price for ${options.to}-${options.from}: ${error.message}`,
      );
      throw error;
    }
  }

  // 2. Get rate calculator (Breet's actual conversion rates)
  async getRateCalculator(
    assetId: string,
    amountInUSD: number,
    currency: string,
  ): Promise<any> {
    const url = `${this.breetApiUrl}/v1/trades/pbc/sell/rate-calculator/${assetId}`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amountInUSD,
          currency,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      this.logger.error(
        `Failed to calculate rate for ${assetId}: ${error.message}`,
      );
      throw error;
    }
  }

  // 3. Convert USD to Fiat
  async convertUsdToFiat(
    amountInUSD: number,
    pin: string,
    bankId: string,
  ): Promise<any> {
    const url = `${this.breetApiUrl}/v1/payments/convert`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    const payload: any = {
      amount: amountInUSD,
      bank: bankId,
      pin,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const result = await response.json();

      this.logger.log(
        `Converted $${amountInUSD} USD to ${result.data.amount} ${result.data.currency}`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to convert USD to ${bankId}: ${error.message}`);
      throw error;
    }
  }

  // 4. Convert Fiat to USD
  async convertFiatToUsd(
    amountInLocalFiat: number,
    pin: string,
    withdrawalAddressId: string,
  ): Promise<any> {
    const url = `${this.breetApiUrl}/v1/payments/fiat-to-usd`;
    const headers = {
      'x-app-id': this.breetAppId,
      'x-app-secret': this.breetApiKey,
      'X-Breet-Env': this.breetEnv,
      'Content-Type': 'application/json',
    };

    const payload: any = {
      amount: amountInLocalFiat,
      withdrawalAddressId,
      pin,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Breet API error: ${error.message || response.statusText}`,
        );
      }

      const result = await response.json();

      this.logger.log(
        `Converted ${amountInLocalFiat} to $${result.data.amount} USD`,
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to convert to USD: ${error.message}`);
      throw error;
    }
  }
}
