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
import { Customer } from './customer.entity';
import { WalletAsset, WalletNetwork } from './wallet.entity';
import { PaymentPage } from './payment-page.entity';
import { Invoice } from './invoice.entity';

export enum PaymentSessionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  PARTIAL = 'partial',
}

@Entity('payment_sessions')
@Index(['crypto_asset', 'network'])
export class PaymentSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'text', default: 'test' })
  mode: 'live' | 'test';

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
    default: PaymentSessionStatus.PENDING,
  })
  status: PaymentSessionStatus;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  payment_page_id: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  invoice_id: string | null;

  @Column({ type: 'text', nullable: true })
  transaction_id: string | null;

  @Index()
  @Column({ type: 'text', nullable: true })
  provider_session_reference: string | null;

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

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => PaymentPage, (pp) => pp.payment_sessions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'payment_page_id' })
  payment_page: PaymentPage;

  @ManyToOne(() => Invoice, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;
}
