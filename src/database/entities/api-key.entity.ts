import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Developer } from './developer.entity';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  developer_id: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  key_hash: string;

  @Index()
  @Column({ type: 'varchar', length: 12 })
  key_prefix: string;

  @Column({ type: 'varchar', length: 100, default: 'Default' })
  label: string;

  @Column({ type: 'varchar', length: 10, default: 'sandbox' })
  environment: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_used_at: Date;

  @Column({ type: 'text', array: true, nullable: true })
  ip_whitelist: string[];

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  // Relations
  @ManyToOne(() => Developer, (dev) => dev.api_keys, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;
}
