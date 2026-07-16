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
import { Developer } from './developer.entity';

// export enum BankType {
//   NUBAN = 'nuban',
//   MOBILE_MONEY = 'mobile_money',
// }

// export enum BankCurrency {
//   NGN = 'ngn',
//   GHS = 'ghs',
// }

@Entity('banks')
@Index(['developer_id', 'account_number'])
export class Bank {
  @PrimaryColumn('text')
  id: string;

  @Index()
  @Column({ type: 'text' })
  provider_recipient_id: string;

  @ManyToOne(() => Developer, (developer) => developer.banks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;

  @Index()
  @Column({ type: 'text' })
  developer_id: string;

  @Column({ type: 'text' })
  account_name: string;

  @Column({ type: 'text' })
  account_number: string;

  @Column({ type: 'text' })
  bank_code: string;

  // @Column({ type: 'boolean', default: false })
  // auto_settlement: boolean;

  @Column({ type: 'text' })
  bank_name: string;

  @Column({ type: 'text' })
  currency: string;

  // @Column({ type: 'boolean', default: false })
  // disabled: boolean;

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
}
