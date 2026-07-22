import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ApiKey } from './api-key.entity';
import { DepositAccount } from './wallet.entity';
import { Payout } from './payout.entity';
import { CryptoTransaction } from './crypto-transaction.entity';
import { KycVerification } from './kyc-verification.entity';
import { WebhookEndpoint } from './webhook.entity';
import { LedgerEntry } from './ledger-entry.entity';
import { Bank } from './bank.entity';
import { WithdrawalWallet } from './withdrawal-wallet.entity';
import { Customer } from './customer.entity';
import { PaymentSession } from './payment-session.entity';
import { Invoice } from './invoice.entity';
import { PaymentPage } from './payment-page.entity';

export enum DeveloperStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

export enum SubscriptionPlan {
  STARTER = 'starter',
  GROWTH = 'growth',
  SCALE = 'scale',
  ENTERPRISE = 'enterprise',
}

@Entity('developers')
export class Developer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'text' })
  password_hash: string;

  @Column({ type: 'text' })
  business_name: string;

  @Column({ type: 'text', nullable: true })
  business_type: string;

  @Column({ type: 'text' })
  first_name: string;

  @Column({ type: 'text' })
  last_name: string;

  @Column({ type: 'text', nullable: true })
  phone: string;

  @Column({
    type: 'enum',
    enum: DeveloperStatus,
    default: DeveloperStatus.PENDING,
  })
  status: DeveloperStatus;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.STARTER,
  })
  plan: SubscriptionPlan;

  @Column({ type: 'int', default: 0 })
  api_call_count: number;

  @Column({ type: 'int', default: 500 })
  monthly_api_limit: number;

  // @Column({ type: 'jsonb', default: {} })
  // metadata: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  email_verified_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Relations
  @OneToMany(() => ApiKey, (key) => key.developer)
  api_keys: ApiKey[];

  @OneToMany(() => DepositAccount, (w) => w.developer)
  deposit_accounts: DepositAccount[];

  @OneToMany(() => Payout, (p) => p.developer)
  payouts: Payout[];

  @OneToMany(() => CryptoTransaction, (t) => t.developer)
  crypto_transactions: CryptoTransaction[];

  @OneToMany(() => KycVerification, (k) => k.developer)
  kyc_verifications: KycVerification[];

  @OneToMany(() => WebhookEndpoint, (wh: WebhookEndpoint) => wh.developer)
  webhook_endpoints: WebhookEndpoint[];

  @OneToMany(() => LedgerEntry, (le) => le.developer)
  ledger_entries: LedgerEntry[];

  @OneToMany(() => Bank, (bank) => bank.developer)
  banks: Bank[];

  @OneToMany(() => WithdrawalWallet, (w) => w.developer)
  withdrawal_wallets: WithdrawalWallet[];

  @OneToMany(() => Customer, (c) => c.developer)
  customers: Customer[];

  @OneToMany(() => PaymentSession, (ps) => ps.developer)
  payment_sessions: PaymentSession[];

  @OneToMany(() => Invoice, (inv) => inv.developer)
  invoices: Invoice[];

  @OneToMany(() => PaymentPage, (pp) => pp.developer)
  payment_pages: PaymentPage[];
}
