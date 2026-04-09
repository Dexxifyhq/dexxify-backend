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

  @Column({ type: 'text' })
  reference_type: string;

  @Index()
  @Column({ type: 'text' })
  reference_id: string;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  debit: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  credit: number;

  @Index()
  @Column({ type: 'text' })
  currency: string;

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
