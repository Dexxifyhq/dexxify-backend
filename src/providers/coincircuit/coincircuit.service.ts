import {
  Injectable,
  Logger,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletAsset, WalletNetwork } from '../../database/entities';

/** Shape of a CoincircuitMCP API error response body */
interface CCErrorResponse {
  message?: string;
  error?: string;
}

const CC_ASSET_MAP: Partial<Record<WalletAsset, string>> = {
  [WalletAsset.BTC]: 'BTC',
  [WalletAsset.ETH]: 'ETH',
  [WalletAsset.USDT]: 'USDT',
  [WalletAsset.USDC]: 'USDC',
  [WalletAsset.SOL]: 'SOL',
  [WalletAsset.BNB]: 'BNB',
  [WalletAsset.TRX]: 'TRX',
};

const CC_CHAIN_MAP: Partial<Record<WalletNetwork, string>> = {
  [WalletNetwork.BITCOIN]: 'bitcoin',
  [WalletNetwork.ETHEREUM]: 'ethereum',
  [WalletNetwork.SOLANA]: 'solana',
  [WalletNetwork.BINANCE_SMART_CHAIN]: 'bsc',
  [WalletNetwork.TRON]: 'tron',
  [WalletNetwork.BASE]: 'base',
  [WalletNetwork.ARBITRUM]: 'arbitrum',
};

export function toCCAsset(asset: WalletAsset): string {
  const mapped = CC_ASSET_MAP[asset];
  if (!mapped) {
    throw new BadRequestException(
      `Asset ${asset} is not supported by CoincircuitMCP.`,
    );
  }
  return mapped;
}

export function toCCChain(network: WalletNetwork): string {
  const mapped = CC_CHAIN_MAP[network];
  if (!mapped) {
    throw new BadRequestException(
      `Network ${network} is not supported by CoincircuitMCP.`,
    );
  }
  return mapped;
}

@Injectable()
export class CoincircuitService {
  private readonly logger = new Logger(CoincircuitService.name);
  private readonly liveUrl: string;
  private readonly sandboxUrl: string;
  private readonly liveKey: string;
  private readonly testKey: string;

  constructor(private readonly config: ConfigService) {
    this.liveUrl =
      this.config.get<string>('coincircuit.apiUrl') ||
      'https://api.coincircuit.io';
    this.sandboxUrl =
      this.config.get<string>('coincircuit.sandboxApiUrl') ||
      'https://sandbox-api.coincircuit.io';
    this.liveKey = this.config.get<string>('coincircuit.apiKey') || '';
    this.testKey = this.config.get<string>('coincircuit.testApiKey') || '';
  }

  // ── Core HTTP ─────────────────────────────────────────

  private credentials(mode: 'live' | 'test') {
    return mode === 'live'
      ? { baseUrl: this.liveUrl, apiKey: this.liveKey }
      : { baseUrl: this.sandboxUrl, apiKey: this.testKey };
  }

  private async request<T = any>(
    method: string,
    path: string,
    mode: 'live' | 'test',
    body?: Record<string, any>,
    params?: Record<string, string>,
  ): Promise<T> {
    const { baseUrl, apiKey } = this.credentials(mode);
    let url = `${baseUrl}${path}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      url = `${url}?${qs}`;
    }

    const res = await fetch(url, {
      method,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as CCErrorResponse;
      const message = err.message || err.error || res.statusText;
      this.logger.error(`CC API ${method} ${path} → ${res.status}: ${message}`);
      throw new HttpException(message, res.status);
    }

    return res.json() as Promise<T>;
  }

  // ── Customers ─────────────────────────────────────────

  async syncCustomer(
    mode: 'live' | 'test',
    dto: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      metadata?: Record<string, any>;
    },
  ) {
    return this.request<{ data: any }>('POST', '/api/v1/customers', mode, dto);
  }

  async updateCCCustomer(
    mode: 'live' | 'test',
    id: string,
    dto: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    },
  ) {
    return this.request<{ data: any }>(
      'PATCH',
      `/api/v1/customers/${id}`,
      mode,
      dto,
    );
  }

  async getCCCustomer(mode: 'live' | 'test', id: string) {
    return this.request<{ data: any }>('GET', `/api/v1/customers/${id}`, mode);
  }

  // ── Invoices ──────────────────────────────────────────

  async createInvoice(
    mode: 'live' | 'test',
    dto: {
      reference?: string;
      items: Array<{
        name: string;
        quantity: string;
        unitPrice: string;
        description?: string;
        unit?: string;
      }>;
      currency: 'NGN' | 'USD';
      description: string;
      expiresAt: string;
      customer: {
        email: string;
        firstName: string;
        lastName?: string;
        phone?: string;
        telegramId?: string;
      };
      metadata?: Record<string, any>;
      successUrl?: string;
      cancelUrl?: string;
      asset?: string;
      chain?: string;
      periodStart?: string;
      periodEnd?: string;
    },
  ) {
    return this.request<{ data: any }>('POST', '/api/v1/invoices', mode, dto);
  }

  async getInvoice(mode: 'live' | 'test', reference: string) {
    return this.request<{ data: any }>(
      'GET',
      `/api/v1/invoices/reference/${reference}`,
      mode,
    );
  }

  async listCCInvoices(mode: 'live' | 'test', params?: Record<string, string>) {
    return this.request<{ data: any[] }>(
      'GET',
      '/api/v1/invoices',
      mode,
      undefined,
      params,
    );
  }

  // ── Payment Sessions ──────────────────────────────────

  async createPaymentSession(
    mode: 'live' | 'test',
    dto: {
      title: string;
      description: string;
      amount: string;
      currency: 'NGN' | 'USD';
      asset?: string;
      chain?: string;
      customer?: { email: string; firstName?: string; lastName?: string };
      metadata?: Record<string, any>;
      webhookUrl?: string;
      successUrl?: string;
      cancelUrl?: string;
    },
  ) {
    return this.request<{ data: any }>('POST', '/api/v1/payments', mode, dto);
  }

  async generateDepositAddress(
    mode: 'live' | 'test',
    reference: string,
    asset: string,
    chain: string,
    customer?: { email: string; firstName?: string; lastName?: string },
  ) {
    return this.request<{ data: any }>(
      'POST',
      `/api/v1/payments/${reference}/address`,
      mode,
      { asset, chain, ...(customer ? { customer } : {}) },
    );
  }

  async getPaymentSession(mode: 'live' | 'test', reference: string) {
    return this.request<{ data: any }>(
      'GET',
      `/api/v1/payments/reference/${reference}`,
      mode,
    );
  }

  async estimatePayment(
    mode: 'live' | 'test',
    params: {
      asset: string;
      chain: string;
      amount: string;
      currency: string;
      reference?: string;
    },
  ) {
    return this.request<{ data: any }>(
      'GET',
      '/api/v1/payments/estimate',
      mode,
      undefined,
      params as Record<string, string>,
    );
  }

  // ── Payout Recipients ─────────────────────────────────

  async createRecipient(
    mode: 'live' | 'test',
    dto: {
      type: 'ngn_bank_account' | 'crypto_address';
      label?: string;
      isDefault?: boolean;
      details:
        | { accountNumber: string; bankCode: string; accountType?: string }
        | { chain: string; address: string };
    },
  ) {
    return this.request<{ data: any }>('POST', '/api/v1/recipients', mode, dto);
  }

  async validateRecipient(
    mode: 'live' | 'test',
    dto: {
      type: 'ngn_bank_account' | 'crypto_address';
      details:
        | { accountNumber: string; bankCode: string }
        | { chain: string; address: string };
    },
  ) {
    return this.request<{ data: any }>(
      'POST',
      '/api/v1/recipients/validate',
      mode,
      dto,
    );
  }

  async updateRecipient(
    mode: 'live' | 'test',
    id: string,
    dto: { label?: string; isDefault?: boolean },
  ) {
    return this.request<{ data: any }>(
      'PATCH',
      `/api/v1/recipients/${id}`,
      mode,
      dto,
    );
  }

  async deleteRecipient(mode: 'live' | 'test', id: string) {
    return this.request<{ success: boolean }>(
      'DELETE',
      `/api/v1/recipients/${id}`,
      mode,
    );
  }

  async listBanks(mode: 'live' | 'test') {
    return this.request<{ data: any[] }>(
      'GET',
      '/api/v1/recipients/banks',
      mode,
    );
  }

  async listPayoutChains(mode: 'live' | 'test') {
    return this.request<{ data: Record<string, any[]> }>(
      'GET',
      '/api/v1/recipients/chains',
      mode,
    );
  }

  // ── Payouts ───────────────────────────────────────────

  async initiatePayout(
    mode: 'live' | 'test',
    dto: {
      recipientId: string;
      amount: string;
      currency?: string;
      narration?: string;
    },
  ) {
    return this.request<{ data: any }>('POST', '/api/v1/payouts', mode, dto);
  }

  async getPayout(mode: 'live' | 'test', id: string) {
    return this.request<{ data: any }>('GET', `/api/v1/payouts/${id}`, mode);
  }

  // ── Rates & Assets ────────────────────────────────────

  async getSupportedAssets(mode: 'live' | 'test') {
    return this.request<{ data: any }>(
      'GET',
      '/api/v1/blockchain/assets',
      mode,
    );
  }

  async getConversionRate(
    mode: 'live' | 'test',
    from: string,
    to: string,
    amount?: string,
  ) {
    const params: Record<string, string> = { from, to };
    if (amount) params.amount = amount;
    return this.request<{ data: any }>(
      'GET',
      '/api/v1/rates/convert',
      mode,
      undefined,
      params,
    );
  }

  // ── Deposit Accounts ──────────────────────────────────

  async createDepositAccount(mode: 'live' | 'test', customerId: string) {
    return this.request<{ data: any }>(
      'POST',
      '/api/v1/deposits/accounts',
      mode,
      { customerId },
    );
  }

  async getCustomerDepositAccount(mode: 'live' | 'test', ccCustomerId: string) {
    return this.request<{ data: any }>(
      'GET',
      `/api/v1/deposits/accounts/customer/${ccCustomerId}`,
      mode,
    );
  }

  async getDepositAccount(mode: 'live' | 'test', accountId: string) {
    return this.request<{ data: any }>(
      'GET',
      `/api/v1/deposits/accounts/${accountId}`,
      mode,
    );
  }

  async listDepositAccounts(
    mode: 'live' | 'test',
    params?: Record<string, string>,
  ) {
    return this.request<{ data: any[] }>(
      'GET',
      '/api/v1/deposits/accounts',
      mode,
      undefined,
      params,
    );
  }

  async issueDepositIdentity(
    mode: 'live' | 'test',
    accountId: string,
    dto: {
      type: 'static_deposit_address' | 'ngn_virtual_account';
      chain?: string;
      bvn?: string;
      currency?: 'NGN';
    },
  ) {
    return this.request<{ data: any }>(
      'POST',
      `/api/v1/deposits/accounts/${accountId}/identities`,
      mode,
      dto,
    );
  }

  async listPayouts(mode: 'live' | 'test', params?: Record<string, string>) {
    return this.request<{ data: any[] }>(
      'GET',
      '/api/v1/payouts',
      mode,
      undefined,
      params,
    );
  }

  // ── Swaps ─────────────────────────────────────────────

  async estimateSwap(
    mode: 'live' | 'test',
    params: {
      fromCurrency: string;
      toCurrency: string;
      amount: string;
    },
  ) {
    return this.request<{ data: any }>(
      'GET',
      '/api/v1/swap/estimate',
      mode,
      undefined,
      params as Record<string, string>,
    );
  }

  async createSwapQuotation(
    mode: 'live' | 'test',
    dto: {
      fromCurrency: string;
      toCurrency: string;
      amount: string;
    },
  ) {
    return this.request<{ data: any }>(
      'POST',
      '/api/v1/swap/quotation',
      mode,
      dto,
    );
  }

  async getSwapQuotation(mode: 'live' | 'test', quotationId: string) {
    return this.request<{ data: any }>(
      'GET',
      `/api/v1/swap/quotation/${quotationId}`,
      mode,
    );
  }

  async executeSwap(
    mode: 'live' | 'test',
    quotationId: string,
    dto?: {
      webhookUrl?: string;
    },
  ) {
    return this.request<{ data: any }>(
      'POST',
      `/api/v1/swap/execute/${quotationId}`,
      mode,
      dto,
    );
  }

  async listSwaps(mode: 'live' | 'test', params?: Record<string, string>) {
    return this.request<{ data: any[] }>(
      'GET',
      '/api/v1/swaps',
      mode,
      undefined,
      params,
    );
  }

  async getSwap(mode: 'live' | 'test', id: string) {
    return this.request<{ data: any }>('GET', `/api/v1/swaps/${id}`, mode);
  }

  // ── Refunds ───────────────────────────────────────────

  async refundSession(
    mode: 'live' | 'test',
    sessionReference: string,
    dto: {
      refundAddress: string;
      reason?: string;
      feePaidBy?: 'merchant' | 'customer';
    },
  ) {
    return this.request<{ data: any }>(
      'POST',
      `/api/v1/refunds/session/${sessionReference}`,
      mode,
      dto,
    );
  }

  async refundInvoice(
    mode: 'live' | 'test',
    invoiceReference: string,
    dto: {
      refundAddress: string;
      reason?: string;
      feePaidBy?: 'merchant' | 'customer';
    },
  ) {
    return this.request<{ data: any }>(
      'POST',
      `/api/v1/refunds/invoice/${invoiceReference}`,
      mode,
      dto,
    );
  }

  async estimateRefund(
    mode: 'live' | 'test',
    reference: string,
    entity: 'session' | 'invoice',
    feePaidBy?: 'merchant' | 'customer',
  ) {
    const params: Record<string, string> = { entity };
    if (feePaidBy) params.feePaidBy = feePaidBy;
    return this.request<{ data: any }>(
      'GET',
      `/api/v1/refunds/estimate/${reference}`,
      mode,
      undefined,
      params,
    );
  }

  async listRefunds(mode: 'live' | 'test', params?: Record<string, string>) {
    return this.request<{ data: any[] }>(
      'GET',
      '/api/v1/refunds',
      mode,
      undefined,
      params,
    );
  }

  async getRefund(mode: 'live' | 'test', id: string) {
    return this.request<{ data: any }>('GET', `/api/v1/refunds/${id}`, mode);
  }
}
