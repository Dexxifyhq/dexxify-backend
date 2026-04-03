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
import { Wallet } from './wallet.entity';
import { Payout } from './payout.entity';
import { OfframpTransaction } from './offramp-transaction.entity';
import { KycVerification } from './kyc-verification.entity';
import { WebhookEndpoint } from './webhook.entity';
import { LedgerEntry } from './ledger-entry.entity';

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
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  @Column({ type: 'varchar', length: 255 })
  business_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  business_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
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

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  email_verified_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Relations
  @OneToMany(() => ApiKey, (key) => key.developer)
  api_keys: ApiKey[];

  @OneToMany(() => Wallet, (w) => w.developer)
  wallets: Wallet[];

  @OneToMany(() => Payout, (p) => p.developer)
  payouts: Payout[];

  @OneToMany(() => OfframpTransaction, (o) => o.developer)
  offramp_transactions: OfframpTransaction[];

  @OneToMany(() => KycVerification, (k) => k.developer)
  kyc_verifications: KycVerification[];

  @OneToMany(() => WebhookEndpoint, (wh: WebhookEndpoint) => wh.developer)
  webhook_endpoints: WebhookEndpoint[];

  @OneToMany(() => LedgerEntry, (le) => le.developer)
  ledger_entries: LedgerEntry[];
}
