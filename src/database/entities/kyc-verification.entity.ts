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

export enum KycType {
  BVN = 'bvn',
  NIN = 'nin',
  DOCUMENT = 'document',
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

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'enum', enum: KycType })
  type: KycType;

  @Index()
  @Column({ type: 'text' })
  status: string;

  @Column({ type: 'text', nullable: true })
  id_number: string;

  @Column({ type: 'text', nullable: true })
  document_url: string;

  @Column({ type: 'text', nullable: true })
  selfie_url: string;

  @Column({ type: 'text', nullable: true })
  first_name: string;

  @Column({ type: 'text', nullable: true })
  last_name: string;

  @Column({ type: 'date', nullable: true })
  date_of_birth: Date;

  @Column({ type: 'text', nullable: true })
  provider_reference: string;

  @Column({ type: 'jsonb', default: {} })
  provider_response: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;
}
