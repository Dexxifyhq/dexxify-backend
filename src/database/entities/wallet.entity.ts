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
  BTC = 'BTC',
  BCH = 'BCH',
  BNB = 'BNB',
  DOGE = 'DOGE',
  LTC = 'LTC',
  TRX = 'TRX',
  XRP = 'XRP',
  AVAX = 'AVAX',
  TON = 'TON',
  USDT = 'USDT',
  ETH = 'ETH',
  USDC = 'USDC',
  SOL = 'SOL',
}

export enum WalletNetwork {
  BITCOIN_CASH = 'Bitcoin_Cash',
  BINANCE_SMART_CHAIN = 'Binance_Smart_Chain',
  BITCOIN = 'Bitcoin',
  DOGECOIN = 'Dogecoin',
  ETHEREUM = 'Ethereum',
  LITECOIN = 'Litecoin',
  SOLANA = 'Solana',
  TRON = 'Tron',
  BASE = 'Base',
  AVALANCHE = 'Avalanche',
  POLYGON = 'Polygon',
  ARBITRUM = 'Arbitrum',
  TON = 'TON',
  XRP = 'XRP',
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

  // @Index()
  // @Column({ type: 'text' })
  // external_user_id: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'text' })
  asset_id: string;

  // @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  // balance: number;

  // @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  // locked_balance: number;

  @Column({ type: 'text', nullable: true })
  deposit_address: string;

  @Column({ type: 'text', nullable: true })
  bank_id: string;

  @Column({ type: 'text', nullable: true })
  account_number: string;

  @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.ACTIVE })
  status: WalletStatus;

  @Column({ type: 'boolean', default: false })
  auto_settled: boolean;

  // @Index()
  // @Column({ type: 'text' })
  // breet_wallet_id: string;

  // @Column({ type: 'jsonb', default: {} })
  // metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Developer, (dev) => dev.wallets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;
}
