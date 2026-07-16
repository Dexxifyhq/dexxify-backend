import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { Developer } from './developer.entity';

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

export enum WalletStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
  CLOSED = 'closed',
}

@Entity('wallets')
@Unique(['label'])
export class Wallet {
  @PrimaryColumn('text')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  developer_id: string;

  @Column({ type: 'text' })
  label: string;

  // @Column({ type: 'text' })
  // asset_id: string;

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

  @Column({ type: 'text', nullable: true })
  bank_id: string;

  @Column({ type: 'text', nullable: true })
  account_number: string;

  @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.ACTIVE })
  status: WalletStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Developer, (dev) => dev.wallets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;
}
