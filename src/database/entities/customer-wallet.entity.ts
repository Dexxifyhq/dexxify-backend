import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Developer } from './developer.entity';
import { Customer } from './customer.entity';
import { WalletAsset, WalletNetwork } from './wallet.entity';

@Entity('customer_wallets')
@Unique(['developer_id', 'customer_id', 'crypto_asset', 'network'])
export class CustomerWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  developer_id: string;

  @Index()
  @Column({ type: 'uuid' })
  customer_id: string;

  @Column({ type: 'text' })
  asset_id: string;

  @Column({ type: 'enum', enum: WalletAsset })
  crypto_asset: WalletAsset;

  @Column({ type: 'enum', enum: WalletNetwork })
  network: WalletNetwork;

  @Column({ type: 'text' })
  deposit_address: string;

  // Breet wallet ID — kept for webhook reconciliation
  @Column({ type: 'text' })
  breet_wallet_id: string;

  @Column({ type: 'boolean', default: false })
  auto_settled: boolean;

  @Column({ type: 'text' })
  bank_id: string;

  @Column({ type: 'text' })
  account_number: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Developer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}
