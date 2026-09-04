import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Business } from './business.entity';

export enum WebhookEventStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

@Entity('webhook_endpoints')
@Index(['business_id', 'mode'], { unique: true })
export class WebhookEndpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'text', default: 'test' })
  mode: 'live' | 'test';

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text' })
  secret: string;

  @Column({ type: 'boolean', default: false })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @OneToMany(() => WebhookEvent, (we) => we.webhook_endpoint)
  webhook_events: WebhookEvent[];
}

@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  webhook_endpoint_id: string;

  @Index()
  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'text' })
  event_type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Index()
  @Column({
    type: 'enum',
    enum: WebhookEventStatus,
    default: WebhookEventStatus.PENDING,
  })
  status: WebhookEventStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_attempt_at: Date;

  @Column({ type: 'int', nullable: true })
  response_status: number;

  @Column({ type: 'text', nullable: true })
  response_body: string;

  @Column({ type: 'timestamptz', nullable: true })
  next_retry_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  delivered_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => WebhookEndpoint, (we) => we.webhook_events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'webhook_endpoint_id' })
  webhook_endpoint: WebhookEndpoint;
}
