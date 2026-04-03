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

export enum KycType {
  BVN = 'bvn',
  NIN = 'nin',
  DOCUMENT = 'document',
  LIVENESS = 'liveness',
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
  developer_id: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  external_user_id: string;

  @Column({ type: 'enum', enum: KycType })
  type: KycType;

  @Index()
  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  status: KycStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  id_number: string;

  @Column({ type: 'text', nullable: true })
  document_url: string;

  @Column({ type: 'text', nullable: true })
  selfie_url: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  first_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  last_name: string;

  @Column({ type: 'date', nullable: true })
  date_of_birth: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  provider_reference: string; // Kora reference ID

  @Column({ type: 'jsonb', default: {} })
  provider_response: Record<string, any>;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidence_score: number;

  @Column({ type: 'text', nullable: true })
  failure_reason: string;

  @Column({ type: 'timestamptz', nullable: true })
  verified_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Developer, (dev) => dev.kyc_verifications)
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;
}
