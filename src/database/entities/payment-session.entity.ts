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
import { Customer } from './customer.entity';
import { WalletAsset, WalletNetwork } from './wallet.entity';
import { PaymentPage } from './payment-page.entity';

export enum PaymentSessionStatus {
  INITIATED = 'initiated',
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('payment_sessions')
@Index(['crypto_asset', 'network'])
export class PaymentSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  developer_id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  customer_id: string | null;

  @Index({ unique: true })
  @Column({ type: 'text', unique: true })
  reference: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  amount: number | null;

  @Column({ type: 'text', default: 'USD' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  deposit_address: string | null;

  @Column({ type: 'enum', enum: WalletAsset, nullable: true })
  crypto_asset: WalletAsset | null;

  @Column({ type: 'enum', enum: WalletNetwork, nullable: true })
  network: WalletNetwork | null;

  @Index()
  @Column({
    type: 'enum',
    enum: PaymentSessionStatus,
    default: PaymentSessionStatus.INITIATED,
  })
  status: PaymentSessionStatus;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  payment_page_id: string | null;

  @Column({ type: 'text', nullable: true })
  transaction_id: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Developer, (dev) => dev.payment_sessions)
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => PaymentPage, (pp) => pp.payment_sessions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'payment_page_id' })
  payment_page: PaymentPage;
}
