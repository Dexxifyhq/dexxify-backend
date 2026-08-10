import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Business } from './business.entity';
import { BusinessUser } from './business-user.entity';
import { ApiKey } from './api-key.entity';

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

export enum SubscriptionPlan {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  password_hash: string | null;

  @Column({ type: 'text' })
  first_name: string;

  @Column({ type: 'text' })
  last_name: string;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.FREE,
  })
  subscription_plan: SubscriptionPlan;

  @Column({ type: 'text', nullable: true })
  theme_preference: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  email_verified_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  last_active_business_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // ── Relations ────────────────────────────────────────────

  @OneToMany(() => Business, (b) => b.owner)
  owned_businesses: Business[];

  @OneToMany(() => BusinessUser, (bu) => bu.user)
  business_memberships: BusinessUser[];

  @OneToMany(() => ApiKey, (k) => k.user)
  api_keys: ApiKey[];
}
