import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Developer } from './developer.entity';

export enum TxType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER = 'transfer',
  ONRAMP = 'onramp',
  OFFRAMP = 'offramp',
  PAYOUT = 'payout',
  FEE = 'fee',
}

export enum LedgerEntryStatus {
  INITIATED = 'initiated',
  PENDING = 'pending',
  COMPLETED = 'completed',
  FLAGGED = 'flagged',
  PROCESSING = 'processing',
  REJECTED = 'rejected',
  REVERSED = 'reversed',
  AUTO_SETTLED = 'auto_settled',
}

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  developer_id: string;

  @Index()
  @Column({ type: 'enum', enum: TxType })
  tx_type: TxType;

  @Index()
  @Column({ type: 'text', nullable: true })
  wallet_address: string;

  @Column({ type: 'text' })
  reference_type: string;

  @Index()
  @Column({ type: 'text' })
  reference_id: string;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  debit_ngn: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  credit_ngn: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  debit_usd: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  credit_usd: number;

  @Column({ type: 'text', nullable: true })
  asset: string;

  @Column({
    type: 'enum',
    enum: LedgerEntryStatus,
    default: LedgerEntryStatus.INITIATED,
  })
  status: LedgerEntryStatus;

  @Column({ type: 'decimal', precision: 28, scale: 8, nullable: true })
  amount_usd: number; // amount in USD

  @Column({ type: 'decimal', precision: 28, scale: 8, nullable: true })
  amount_crypto: number; // amount in crypto

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations
  @ManyToOne(() => Developer, (dev) => dev.ledger_entries)
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;
}
