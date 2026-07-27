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
import { Business } from './business.entity';
import { User } from './user.entity';

export enum KycType {
  BVN = 'bvn',
  NIN = 'nin',
  VNIN = 'vnin',
  CAC = 'cac',
}

export enum KycStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

@Entity('kyc_verifications')
export class KycVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Set for individual KYC (BVN/NIN/vNIN) — one record per user per type
  @Index()
  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  // Set for business KYC (CAC) — one record per business
  @Index()
  @Column({ type: 'uuid', nullable: true })
  business_id: string | null;

  @Column({ type: 'enum', enum: KycType })
  type: KycType;

  @Index()
  @Column({
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING,
  })
  status: KycStatus;

  @Column({ type: 'text' })
  id_number: string;

  // Validation fields sent to Kora for matching (shape varies by KYC type)
  @Column({ type: 'jsonb', nullable: true })
  validation_input: Record<string, any> | null;

  // Match results returned by Kora per validation field
  @Column({ type: 'jsonb', nullable: true })
  validation_result: Record<string, { value: string; match: boolean }> | null;

  @Index()
  @Column({ type: 'text', nullable: true })
  provider_reference: string | null;

  @Column({ type: 'jsonb', default: {} })
  provider_response: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @ManyToOne(() => Business, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business | null;
}
