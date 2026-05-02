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
  @Column({ type: 'text' })
  wallet_address: string;

  @Column({ type: 'text' })
  reference_type: string;

  @Index()
  @Column({ type: 'text' })
  reference_id: string;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  debit: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  credit: number;

  @Column({ type: 'text' })
  asset: string;

  @Column({
    type: 'enum',
    enum: LedgerEntryStatus,
    default: LedgerEntryStatus.INITIATED,
  })
  status: LedgerEntryStatus;

  @Column({ type: 'decimal', precision: 28, scale: 8, nullable: true })
  amount_usd: number; // amount in USD

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
