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

export enum TxStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('offramp_transactions')
export class OfframpTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  developer_id: string;

  @Index()
  @Column({ type: 'uuid' })
  wallet_id: string;

  @Column({ type: 'enum', enum: WalletAsset })
  crypto_asset: WalletAsset;

  @Column({ type: 'decimal', precision: 28, scale: 8 })
  crypto_amount: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  exchange_rate: number;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  ngn_amount: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  fee_crypto: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  fee_ngn: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  destination_bank_code: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  destination_account_number: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  destination_account_name: string;

  @Index()
  @Column({ type: 'enum', enum: TxStatus, default: TxStatus.PENDING })
  status: TxStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  breet_reference: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paystack_reference: string;

  @Column({ type: 'text', nullable: true })
  failure_reason: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Developer, (dev) => dev.offramp_transactions)
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;
}
