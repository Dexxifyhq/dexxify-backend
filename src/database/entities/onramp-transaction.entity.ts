import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Developer } from './developer.entity';
import { Wallet, WalletAsset } from './wallet.entity';
import { LedgerEntryStatus } from './ledger-entry.entity';

@Entity('onramp_transactions')
export class OnrampTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  developer_id: string;

  @Index()
  @Column({ type: 'text' })
  wallet_address: string;

  @Column({ type: 'enum', enum: WalletAsset })
  crypto_asset: WalletAsset;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  usd_amount: number;

  @Column({ type: 'decimal', precision: 28, scale: 8 })
  crypto_amount: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  exchange_rate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fee_percentage: number;

  @Index()
  @Column({
    type: 'enum',
    enum: LedgerEntryStatus,
    default: LedgerEntryStatus.PENDING,
  })
  status: LedgerEntryStatus;

  @Column({ type: 'text', nullable: true })
  reference: string;

  @Column({ type: 'text', nullable: true })
  tx_hash: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Developer)
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;
}
