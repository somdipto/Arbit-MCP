import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { AlertType } from '@/types';
import { User } from './User';

@Entity('alerts')
@Index(['userId', 'isRead'])
@Index(['type', 'createdAt'])
@Index(['priority', 'createdAt'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: AlertType
  })
  type: AlertType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, any>;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  })
  priority: 'low' | 'medium' | 'high' | 'critical';

  @Column({ type: 'boolean', default: false })
  isEmailSent: boolean;

  @Column({ type: 'timestamp', nullable: true })
  emailSentAt?: Date;

  @Column({ type: 'boolean', default: false })
  isPushSent: boolean;

  @Column({ type: 'timestamp', nullable: true })
  pushSentAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  readByIp?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => User, user => user.alerts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
