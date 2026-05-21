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

export enum TxStatus {
  INITIATED = 'initiated',
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  REVERSED = 'reversed',
  FLAGGED = 'flagged',
  AUTO_SETTLED = 'auto_settled',
}

@Entity('offramp_transactions')
export class OfframpTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  developer_id: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  currency: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fee: number;

  @Column({ type: 'numeric', nullable: true })
  destination_bank_id: number;

  @Column({ type: 'text', nullable: true })
  destination_bank_name: string;

  @Column({ type: 'numeric', nullable: true })
  destination_account_number: number;

  @Column({ type: 'text', nullable: true })
  destination_account_name: string;

  @Index()
  @Column({ type: 'enum', enum: TxStatus, default: TxStatus.INITIATED })
  status: TxStatus;

  @Column({ type: 'text', nullable: true })
  breet_reference: string;

  @Column({ type: 'text', nullable: true })
  description: string;

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
}
