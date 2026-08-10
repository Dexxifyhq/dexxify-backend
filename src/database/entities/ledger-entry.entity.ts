import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Business } from './business.entity';
import { DepositAccount } from './wallet.entity';

export enum TxType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER = 'transfer',
  ONRAMP = 'onramp',
  OFFRAMP = 'offramp',
  FEE = 'fee',
  SWAP = 'swap',
  REFUND = 'refund',
}

export enum LedgerEntryStatus {
  INITIATED = 'initiated',
  PENDING = 'pending',
  COMPLETED = 'completed',
  PROCESSING = 'processing',
  REJECTED = 'rejected',
  REVERSED = 'reversed',
}

export enum LedgerCurrency {
  NGN = 'NGN',
  USD = 'USD',
  USDT = 'USDT',
  USDC = 'USDC',
}

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'text', default: 'test' })
  mode: 'live' | 'test';

  @Index()
  @Column({ type: 'enum', enum: TxType })
  tx_type: TxType;

  @Index()
  @Column({ type: 'text', nullable: true })
  deposit_account_id: string;

  @Column({ type: 'text' })
  reference_type: string;

  @Index()
  @Column({ type: 'text', unique: true })
  reference_id: string;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  debit_ngn: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  credit_ngn: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  debit_usdt: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  credit_usdt: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  debit_usdc: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  credit_usdc: number;

  @Column({ type: 'enum', enum: LedgerCurrency, default: LedgerCurrency.NGN })
  currency: LedgerCurrency;

  @Column({ type: 'text', nullable: true })
  asset: string;

  @Column({ type: 'text', nullable: true })
  network: string;

  @Column({
    type: 'enum',
    enum: LedgerEntryStatus,
    default: LedgerEntryStatus.INITIATED,
  })
  status: LedgerEntryStatus;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => DepositAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deposit_account_id' })
  deposit_account: DepositAccount;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;
}
