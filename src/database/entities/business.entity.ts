import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { BusinessUser } from './business-user.entity';

export enum SettlementCurrency {
  NGN = 'NGN',
  USDT = 'USDT',
  USDC = 'USDC',
}

export enum PayoutMethod {
  CRYPTO = 'crypto',
  BANK = 'bank',
}

export enum BusinessType {
  ECOMMERCE = 'ecommerce',
  SAAS = 'saas',
  MARKETPLACE = 'marketplace',
  FINTECH = 'fintech',
  HEALTHCARE = 'healthcare',
  EDUCATION = 'education',
  LOGISTICS = 'logistics',
  REAL_ESTATE = 'real_estate',
  TRAVEL = 'travel',
  FOOD_AND_BEVERAGE = 'food_and_beverage',
  MEDIA_AND_ENTERTAINMENT = 'media_and_entertainment',
  GAMING = 'gaming',
  RETAIL = 'retail',
  PROFESSIONAL_SERVICES = 'professional_services',
  NONPROFIT = 'nonprofit',
  FREELANCE = 'freelance',
  OTHER = 'other',
}

@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  owner_user_id: string;

  @Column({ type: 'text' })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'enum', enum: BusinessType, nullable: true })
  type: BusinessType | null;

  @Column({ type: 'text', nullable: true })
  support_email: string | null;

  @Column({ type: 'text', nullable: true })
  logo_url: string | null;

  @Column({ type: 'boolean', default: false })
  show_branding_on_checkout: boolean;

  @Column({ type: 'text', nullable: true })
  website_url: string | null;

  @Column({
    type: 'enum',
    enum: SettlementCurrency,
    default: SettlementCurrency.USDT,
  })
  settlement_currency: SettlementCurrency;

  @Column({ type: 'enum', enum: PayoutMethod, default: PayoutMethod.CRYPTO })
  default_payout_method: PayoutMethod;

  @Column({ type: 'boolean', default: false })
  instant_payouts_enabled: boolean;

  @Column({ type: 'jsonb', default: {} })
  notification_preferences: Record<string, boolean>;

  @ManyToOne(() => User, (u) => u.owned_businesses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User;

  @OneToMany(() => BusinessUser, (bu) => bu.business)
  members: BusinessUser[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
