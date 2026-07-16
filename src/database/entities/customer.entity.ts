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
  Unique,
} from 'typeorm';
import { Developer } from './developer.entity';

export enum CustomerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('customers')
@Unique(['email'])
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  developer_id: string;

  @Index()
  @Column({ type: 'text', nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  first_name: string;

  @Column({ type: 'text', nullable: true })
  last_name: string;

  @Column({
    type: 'enum',
    enum: CustomerStatus,
    default: CustomerStatus.ACTIVE,
  })
  status: CustomerStatus;

  @Index()
  @Column({ type: 'text', nullable: true })
  cc_customer_id: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Developer, (dev) => dev.customers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;
}
