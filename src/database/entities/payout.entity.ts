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

export enum PayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('payouts')
export class Payout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  developer_id: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  fee: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  bank_code: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  account_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  account_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  narration: string;

  @Index()
  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.PENDING })
  status: PayoutStatus;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  batch_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  provider_reference: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  provider_payout_id: string;

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
  @ManyToOne(() => Developer, (dev) => dev.payouts)
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;
}
