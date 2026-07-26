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

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  VIEWED = 'viewed',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  VOID = 'void',
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

@Entity('invoices')
export class Invoice {
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
  invoice_number: string;

  @Index()
  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Column({ type: 'text', default: 'USD' })
  currency: string;

  @Column({ type: 'jsonb', default: [] })
  line_items: InvoiceLineItem[];

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  tax_rate: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  tax_amount: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  discount_amount: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'timestamptz', nullable: true })
  due_date: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Index()
  @Column({ type: 'text', nullable: true })
  provider_invoice_reference: string | null;

  @Column({ type: 'text', nullable: true })
  cc_invoice_url: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

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
}
