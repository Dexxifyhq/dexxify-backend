import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  constructor(private readonly config: ConfigService) {
    const isProduction =
      this.config.get<string>('app.nodeEnv') === 'production';
    this.breetApiUrl = this.config.get<string>('breet.apiUrl') || '';
    this.breetEnv = this.config.get<string>('breet.env') || '';
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

  // ── Exchange Rates ────────────────────────────────────

  // async getRates(source?: string, target?: string) {
  //   // If specific pair requested
  //   if (source && target) {
  //     const rate = await this.fetchBreetRate(
  //       source.toUpperCase(),
  //       target.toUpperCase(),
  //     );
  //     return {
  //       pair: `${source.toUpperCase()}/${target.toUpperCase()}`,
  //       buy_rate: rate.buy,
  //       sell_rate: rate.sell,
  //       timestamp: new Date().toISOString(),
  //     };
  //   }

  //   // Return all supported rates
  //   const pairs = ['BTC_NGN', 'USDT_NGN', 'ETH_NGN', 'USDC_NGN'];
  //   const rates = await Promise.all(
  //     pairs.map(async (pair) => {
  //       const [src, tgt] = pair.split('_');
  //       const rate = await this.fetchBreetRate(src, tgt);
  //       return {
  //         pair: `${src}/${tgt}`,
  //         buy_rate: rate.buy,
  //         sell_rate: rate.sell,
  //       };
  //     }),
  //   );

  //   return {
  //     rates,
  //     timestamp: new Date().toISOString(),
  //   };
  // }

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
    to: number;
    from: number;
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
      console.log('price', price);

      if (!price) {
        throw new Error(`Price not found for ${options.to}-${options.from}`);
      }

      return {
        price,
      };
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
          assetId,
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
