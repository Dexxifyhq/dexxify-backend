import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Developer } from './developer.entity';

export enum WalletAsset {
  BTC = 'BTC',
  USDT = 'USDT',
  ETH = 'ETH',
  USDC = 'USDC',
}

export enum WalletStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
  CLOSED = 'closed',
}

@Entity('wallets')
@Unique(['developer_id', 'external_user_id', 'asset'])
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  developer_id: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  external_user_id: string;

  @Column({ type: 'enum', enum: WalletAsset })
  asset: WalletAsset;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  balance: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  locked_balance: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deposit_address: string;

  @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.ACTIVE })
  status: WalletStatus;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  breet_wallet_id: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Developer, (dev) => dev.wallets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;
}
