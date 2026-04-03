import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
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

  @Column({ type: 'varchar', length: 50 })
  reference_type: string;

  @Index()
  @Column({ type: 'uuid' })
  reference_id: string;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  debit: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  credit: number;

  @Index()
  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'decimal', precision: 28, scale: 8, nullable: true })
  balance_after: number;

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
