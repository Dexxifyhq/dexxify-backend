import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  PrimaryColumn,
  Unique,
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
@Unique(['breet_bank_id', 'id', 'account_number'])
export class Bank {
  @PrimaryColumn('text')
  id: string;

  @Index()
  @Column({ type: 'text' })
  breet_bank_id: string;

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

  @Column({ type: 'boolean', default: false })
  auto_settlement: boolean;

  @Column({ type: 'text', nullable: true })
  avatar: string;

  @Column({ type: 'text' })
  bank_name: string;

  @Column({ type: 'text' })
  currency: string;

  @Column({ type: 'boolean', default: false })
  disabled: boolean;

  @Column({ type: 'text', nullable: true })
  integration_id: string;

  @Column({ type: 'boolean', default: false })
  is_business: boolean;

  @Column({ type: 'text', nullable: true })
  narration: string;

  @Column({ type: 'text' })
  type: string;

  //   @Column({ type: 'enum', enum: BankType, default: BankType.NUBAN })
  //   type: BankType;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
