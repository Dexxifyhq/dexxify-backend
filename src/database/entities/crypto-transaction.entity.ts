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
  FAILED = 'failed',
  REVERSED = 'reversed',
}

@Entity('crypto_transactions')
export class CryptoTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  developer_id: string;

  @Index()
  @Column({ type: 'enum', enum: CryptoTxDirection })
  direction: CryptoTxDirection;

  @Column({ type: 'enum', enum: WalletAsset, nullable: true })
  crypto_asset: WalletAsset | null;

  @Column({ type: 'decimal', precision: 28, scale: 8, nullable: true })
  crypto_amount: number | null;

  @Column({ type: 'enum', enum: WalletNetwork, nullable: true })
  network: WalletNetwork | null;

  @Column({ type: 'text', nullable: true })
  wallet_address: string | null;

  @Column({ type: 'text', nullable: true })
  tx_hash: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  fiat_amount: number | null;

  @Column({ type: 'text', default: 'NGN' })
  fiat_currency: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  exchange_rate: number | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  fee: number;

  @Index()
  @Column({
    type: 'enum',
    enum: CryptoTxStatus,
    default: CryptoTxStatus.PENDING,
  })
  status: CryptoTxStatus;

  @Column({ type: 'text', nullable: true })
  reference: string | null;

  @Column({ type: 'text', nullable: true })
  provider_reference: string | null;

  @Index()
  @Column({ type: 'text', nullable: true })
  cc_transaction_id: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Developer)
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;
}
