import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Developer } from './developer.entity';
import { PaymentSession } from './payment-session.entity';

export enum PaymentPageStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('payment_pages')
export class PaymentPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  developer_id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index({ unique: true })
  @Column({ type: 'text', unique: true })
  slug: string;

  @Column({ type: 'text', default: 'USD' })
  currency: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  amount: number | null;

  @Index()
  @Column({
    type: 'enum',
    enum: PaymentPageStatus,
    default: PaymentPageStatus.DRAFT,
  })
  status: PaymentPageStatus;

  @Column({ type: 'boolean', default: false })
  auto_settlement: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Developer, (dev) => dev.payment_pages)
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;

  @OneToMany(() => PaymentSession, (ps) => ps.payment_page)
  payment_sessions: PaymentSession[];
}
