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

export enum WithdrawalWalletNetwork {
  SOL = 'SOL',
  TON = 'TON',
  BSC = 'BSC',
  ERC20 = 'EERC20',
  TRC20 = 'TRC20',
}

export enum WithdrawalWalletToken {
  USDT = 'USDT',
  USDC = 'USDC',
}

@Entity('withdrawal_wallets')
export class WithdrawalWallet {
  @PrimaryColumn('text')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'text', default: 'test' })
  mode: 'live' | 'test';

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'enum', enum: WithdrawalWalletNetwork })
  network: WithdrawalWalletNetwork;

  @Column({ type: 'enum', enum: WithdrawalWalletToken })
  token: WithdrawalWalletToken;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'boolean', default: false })
  primary: boolean;

  @Column({ type: 'text', nullable: true })
  avatar: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;
}
