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
import { Developer } from './developer.entity';
import { Customer } from './customer.entity';

export enum WalletAsset {
  // BCH = 'BCH',
  // DOGE = 'DOGE',
  // LTC = 'LTC',
  // XRP = 'XRP',
  // AVAX = 'AVAX',
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
  // BITCOIN_CASH = 'Bitcoin_Cash',
  // DOGECOIN = 'Dogecoin',
  // LITECOIN = 'Litecoin',
  // AVALANCHE = 'Avalanche',
  // POLYGON = 'Polygon',
  // XRP = 'XRP',
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
  developer_id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

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

  @ManyToOne(() => Developer, (dev) => dev.deposit_accounts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;
}
