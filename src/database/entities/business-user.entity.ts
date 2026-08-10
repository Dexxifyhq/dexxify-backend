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
import { User } from './user.entity';
import { Business } from './business.entity';

export enum BusinessRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  STAFF = 'staff',
}

export enum BusinessUserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

@Unique(['user_id', 'business_id'])
@Entity('business_users')
export class BusinessUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'enum', enum: BusinessRole, default: BusinessRole.STAFF })
  role: BusinessRole;

  @Column({
    type: 'enum',
    enum: BusinessUserStatus,
    default: BusinessUserStatus.PENDING,
  })
  status: BusinessUserStatus;

  @Column({ type: 'uuid', nullable: true })
  invited_by_user_id: string | null;

  @Index()
  @Column({ type: 'text', nullable: true, unique: true })
  invite_token: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  invite_expires_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  joined_at: Date | null;

  @Column({ type: 'text', array: true, default: [] })
  permissions: string[];

  @ManyToOne(() => User, (u) => u.business_memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Business, (b) => b.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
