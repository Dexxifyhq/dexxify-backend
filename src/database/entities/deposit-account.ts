import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { Business } from './business.entity';
import { Customer } from './customer.entity';

export enum WalletAsset {
  BTC = 'BTC',
  TRX = 'TRX',
  BNB = 'BNB',
  TON = 'TON',
  USDT = 'USDT',
  ETH = 'ETH',
  USDC = 'USDC',
  SOL = 'SOL',
}

export enum WalletNetwork {
  BITCOIN = 'Bitcoin',
  BINANCE_SMART_CHAIN = 'Binance_Smart_Chain',
  ETHEREUM = 'Ethereum',
  SOLANA = 'Solana',
  TRON = 'Tron',
  BASE = 'Base',
  ARBITRUM = 'Arbitrum',
  TON = 'TON',
}

export enum DepositAccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('deposit_accounts')
export class DepositAccount {
  @PrimaryColumn('text')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'text', default: 'test' })
  mode: 'live' | 'test';

  @Index()
  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Column({
    type: 'enum',
    enum: DepositAccountStatus,
    default: DepositAccountStatus.ACTIVE,
  })
  status: DepositAccountStatus;

  @Column({ type: 'jsonb', default: [] })
  deposit_addresses: Array<{
    chain: string;
    address: string;
    createdAt: string;
  }>;

  @Column({ type: 'jsonb', default: [] })
  ngn_virtual_accounts: Array<{
    currency: string;
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
    accountReference: string;
    createdAt: string;
  }>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;
}
