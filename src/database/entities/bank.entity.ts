import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { Business } from './business.entity';

@Entity('banks')
@Index(['business_id', 'account_number'])
export class Bank {
  @PrimaryColumn('text')
  id: string;

  @Index()
  @Column({ type: 'text' })
  provider_recipient_id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'text', default: 'test' })
  mode: 'live' | 'test';

  @Column({ type: 'text' })
  account_name: string;

  @Column({ type: 'text' })
  account_number: string;

  @Column({ type: 'text' })
  bank_code: string;

  @Column({ type: 'text' })
  bank_name: string;

  @Column({ type: 'text' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  label: string;

  @Column({ type: 'boolean', default: false })
  is_trusted: boolean;

  @Column({ type: 'text', nullable: true })
  type: string;

  @Column({ type: 'boolean', default: false })
  primary: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;
}
