import {
  Injectable,
  Logger,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletAsset, WalletNetwork } from '../../database/entities';

// Maps our WalletAsset enum → CoincircuitMCP asset symbols
const CC_ASSET_MAP: Partial<Record<WalletAsset, string>> = {
  [WalletAsset.BTC]: 'BTC',
  [WalletAsset.ETH]: 'ETH',
  [WalletAsset.USDT]: 'USDT',
  [WalletAsset.USDC]: 'USDC',
  [WalletAsset.SOL]: 'SOL',
  [WalletAsset.BNB]: 'BNB',
  [WalletAsset.TRX]: 'TRX',
};

// Maps our WalletNetwork enum → CoincircuitMCP chain identifiers
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
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    const isProduction =
      this.config.get<string>('app.nodeEnv') === 'production';
    this.baseUrl = isProduction
      ? this.config.get<string>('coincircuit.apiUrl') ||
        'https://api.coincircuit.io'
      : this.config.get<string>('coincircuit.sandboxApiUrl') ||
        'https://sandbox-api.coincircuit.io';
    this.apiKey = isProduction
      ? this.config.get<string>('coincircuit.apiKey') || ''
      : this.config.get<string>('coincircuit.testApiKey') || '';
  }

  // ── Core HTTP ─────────────────────────────────────────

  private get headers() {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async request<T = any>(
    method: string,
    path: string,
    body?: Record<string, any>,
    params?: Record<string, string>,
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      url = `${url}?${qs}`;
    }

    const res = await fetch(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message =
        (err as any).message || (err as any).error || res.statusText;
      this.logger.error(`CC API ${method} ${path} → ${res.status}: ${message}`);
      throw new HttpException(message, res.status);
    }

    return res.json();
  }

  // ── Customers ─────────────────────────────────────────

  async syncCustomer(dto: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    metadata?: Record<string, any>;
  }) {
    return this.request<{ data: any }>('POST', '/api/v1/customers', dto);
  }

  async updateCCCustomer(
    id: string,
    dto: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    },
  ) {
    return this.request<{ data: any }>('PATCH', `/api/v1/customers/${id}`, dto);
  }

  async getCCCustomer(id: string) {
    return this.request<{ data: any }>('GET', `/api/v1/customers/${id}`);
  }

  // ── Invoices ──────────────────────────────────────────

  async createInvoice(dto: {
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
  }) {
    return this.request<{ data: any }>('POST', '/api/v1/invoices', dto);
  }

  async getInvoice(reference: string) {
    return this.request<{ data: any }>(
      'GET',
      `/api/v1/invoices/reference/${reference}`,
    );
  }

  async listCCInvoices(params?: Record<string, string>) {
    return this.request<{ data: any[] }>(
      'GET',
      '/api/v1/invoices',
      undefined,
      params,
    );
  }

  // ── Payment Sessions ──────────────────────────────────

  async createPaymentSession(dto: {
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
  }) {
    return this.request<{ data: any }>('POST', '/api/v1/payments', dto);
  }

  async generateDepositAddress(
    reference: string,
    asset: string,
    chain: string,
    customer?: { email: string; firstName?: string; lastName?: string },
  ) {
    return this.request<{ data: any }>(
      'POST',
      `/api/v1/payments/${reference}/address`,
      { asset, chain, ...(customer ? { customer } : {}) },
    );
  }

  async getPaymentSession(reference: string) {
    return this.request<{ data: any }>(
      'GET',
      `/api/v1/payments/reference/${reference}`,
    );
  }

  async estimatePayment(params: {
    asset: string;
    chain: string;
    amount: string;
    currency: string;
    reference?: string;
  }) {
    return this.request<{ data: any }>(
      'GET',
      '/api/v1/payments/estimate',
      undefined,
      params as Record<string, string>,
    );
  }

  // ── Payout Recipients ─────────────────────────────────

  async createRecipient(dto: {
    type: 'ngn_bank_account' | 'crypto_address';
    label?: string;
    isDefault?: boolean;
    details:
      | { accountNumber: string; bankCode: string; accountType?: string }
      | { chain: string; address: string };
  }) {
    return this.request<{ data: any }>('POST', '/api/v1/recipients', dto);
  }

  async validateRecipient(dto: {
    type: 'ngn_bank_account' | 'crypto_address';
    details:
      | { accountNumber: string; bankCode: string }
      | { chain: string; address: string };
  }) {
    return this.request<{ data: any }>(
      'POST',
      '/api/v1/recipients/validate',
      dto,
    );
  }

  async updateRecipient(
    id: string,
    dto: { label?: string; isDefault?: boolean },
  ) {
    return this.request<{ data: any }>(
      'PATCH',
      `/api/v1/recipients/${id}`,
      dto,
    );
  }

  async deleteRecipient(id: string) {
    return this.request<{ success: boolean }>(
      'DELETE',
      `/api/v1/recipients/${id}`,
    );
  }

  async listBanks() {
    return this.request<{ data: any[] }>('GET', '/api/v1/recipients/banks');
  }

  async listPayoutChains() {
    return this.request<{ data: Record<string, any[]> }>(
      'GET',
      '/api/v1/recipients/chains',
    );
  }

  // ── Payouts ───────────────────────────────────────────

  async initiatePayout(dto: {
    recipientId: string;
    amount: string;
    currency?: string;
    narration?: string;
  }) {
    return this.request<{ data: any }>('POST', '/api/v1/payouts', dto);
  }

  async getPayout(id: string) {
    return this.request<{ data: any }>('GET', `/api/v1/payouts/${id}`);
  }

  // ── Rates & Assets ────────────────────────────────────

  async getSupportedAssets() {
    return this.request<{ data: any }>('GET', '/api/v1/blockchain/assets');
  }

  async getConversionRate(from: string, to: string, amount?: string) {
    const params: Record<string, string> = { from, to };
    if (amount) params.amount = amount;
    return this.request<{ data: any }>(
      'GET',
      '/api/v1/rates/convert',
      undefined,
      params,
    );
  }

  // ── Deposit Accounts ──────────────────────────────────

  async createDepositAccount(customerId: string) {
    return this.request<{ data: any }>('POST', '/api/v1/deposits/accounts', {
      customerId,
    });
  }

  async getCustomerDepositAccount(ccCustomerId: string) {
    return this.request<{ data: any }>(
      'GET',
      `/api/v1/deposits/accounts/customer/${ccCustomerId}`,
    );
  }

  async getDepositAccount(accountId: string) {
    return this.request<{ data: any }>(
      'GET',
      `/api/v1/deposits/accounts/${accountId}`,
    );
  }

  async listDepositAccounts(params?: Record<string, string>) {
    return this.request<{ data: any[] }>(
      'GET',
      '/api/v1/deposits/accounts',
      undefined,
      params,
    );
  }

  async issueDepositIdentity(
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
      dto,
    );
  }

  async listPayouts(params?: Record<string, string>) {
    return this.request<{ data: any[] }>(
      'GET',
      '/api/v1/payouts',
      undefined,
      params,
    );
  }

  // ── Swaps ─────────────────────────────────────────────

  async estimateSwap(params: {
    fromCurrency: string;
    toCurrency: string;
    amount: string;
  }) {
    return this.request<{ data: any }>(
      'GET',
      '/api/v1/swap/estimate',
      undefined,
      params as Record<string, string>,
    );
  }

  async createSwapQuotation(dto: {
    fromCurrency: string;
    toCurrency: string;
    amount: string;
  }) {
    return this.request<{ data: any }>('POST', '/api/v1/swap/quotation', dto);
  }

  async getSwapQuotation(quotationId: string) {
    return this.request<{ data: any }>(
      'GET',
      `/api/v1/swap/quotation/${quotationId}`,
    );
  }

  async executeSwap(quotationId: string) {
    return this.request<{ data: any }>(
      'POST',
      `/api/v1/swap/execute/${quotationId}`,
    );
  }

  async listSwaps(params?: Record<string, string>) {
    return this.request<{ data: any[] }>(
      'GET',
      '/api/v1/swaps',
      undefined,
      params,
    );
  }

  async getSwap(id: string) {
    return this.request<{ data: any }>('GET', `/api/v1/swaps/${id}`);
  }

  // ── Refunds ───────────────────────────────────────────

  async refundSession(
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
      dto,
    );
  }

  async refundInvoice(
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
      dto,
    );
  }

  async estimateRefund(
    reference: string,
    entity: 'session' | 'invoice',
    feePaidBy?: 'merchant' | 'customer',
  ) {
    const params: Record<string, string> = { entity };
    if (feePaidBy) params.feePaidBy = feePaidBy;
    return this.request<{ data: any }>(
      'GET',
      `/api/v1/refunds/estimate/${reference}`,
      undefined,
      params,
    );
  }

  async listRefunds(params?: Record<string, string>) {
    return this.request<{ data: any[] }>(
      'GET',
      '/api/v1/refunds',
      undefined,
      params,
    );
  }

  async getRefund(id: string) {
    return this.request<{ data: any }>('GET', `/api/v1/refunds/${id}`);
  }
}
