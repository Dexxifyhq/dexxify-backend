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
import { Business } from './business.entity';
import { WalletAsset, WalletNetwork } from './wallet.entity';

export enum CryptoTxDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum CryptoTxStatus {
  INITIATED = 'initiated',
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

@Entity('crypto_transactions')
export class CryptoTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'text', default: 'test' })
  mode: 'live' | 'test';

  @Index()
  @Column({ type: 'enum', enum: CryptoTxDirection })
  direction: CryptoTxDirection;

  @Column({ type: 'enum', enum: WalletAsset, nullable: true })
  crypto_asset: WalletAsset | null;

  @Column({ type: 'decimal', precision: 28, scale: 8, nullable: true })
  net_amount: number | null;

  @Column({ type: 'enum', enum: WalletNetwork, nullable: true })
  network: WalletNetwork | null;

  @Column({ type: 'text', nullable: true })
  deposit_type: string | null;

  @Column({ type: 'text', nullable: true })
  from_address: string | null;

  @Column({ type: 'text', nullable: true })
  to_address: string | null;

  @Column({ type: 'text', nullable: true })
  tx_hash: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  amount: number | null;

  @Column({ type: 'text', default: 'NGN' })
  currency: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  fee: number;

  @Index()
  @Column({
    type: 'enum',
    enum: CryptoTxStatus,
    default: CryptoTxStatus.PENDING,
  })
  status: CryptoTxStatus;

  @Column({ type: 'text', nullable: true })
  provider_reference: string | null;

  @Index()
  @Column({ type: 'text', nullable: true })
  cc_transaction_id: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // GIN index for `metadata @> '{"key": "value"}'` containment lookups —
  @Index('idx_crypto_transactions_metadata', { synchronize: false })
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;
}
