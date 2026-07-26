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

export enum SwapRecordStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum SwapRecordType {
  MANUAL = 'manual',
  OFFRAMP = 'offramp',
}

@Entity('swap_records')
export class SwapRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  cc_swap_id: string;

  @Column({ type: 'text' })
  from_currency: string;

  @Column({ type: 'text' })
  to_currency: string;

  @Column({ type: 'decimal', precision: 28, scale: 8 })
  source_amount: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, nullable: true })
  target_amount: number | null;

  @Column({ type: 'enum', enum: SwapRecordStatus, default: SwapRecordStatus.PENDING })
  status: SwapRecordStatus;

  @Column({ type: 'enum', enum: SwapRecordType, default: SwapRecordType.MANUAL })
  type: SwapRecordType;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;
}
