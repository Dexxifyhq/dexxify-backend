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
import { Wallet, WalletAsset } from './wallet.entity';
import { TxStatus } from './offramp-transaction.entity';

@Entity('onramp_transactions')
export class OnrampTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  developer_id: string;

  @Index()
  @Column({ type: 'uuid' })
  wallet_id: string;

  @Column({ type: 'enum', enum: WalletAsset })
  crypto_asset: WalletAsset;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  ngn_amount: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  exchange_rate: number;

  @Column({ type: 'decimal', precision: 28, scale: 8 })
  crypto_amount: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  fee_ngn: number;

  @Column({ type: 'decimal', precision: 28, scale: 8, default: 0 })
  fee_crypto: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  payment_reference: string;

  @Index()
  @Column({ type: 'enum', enum: TxStatus, default: TxStatus.PENDING })
  status: TxStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  breet_reference: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paystack_reference: string;

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
  @ManyToOne(() => Developer)
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;
}
