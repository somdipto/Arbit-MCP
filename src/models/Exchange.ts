import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index
} from 'typeorm';
import { ExchangeType, SubnetType } from '@/types';
import { PriceData } from './PriceData';
import { ArbitrageOpportunity } from './ArbitrageOpportunity';

@Entity('exchanges')
@Index(['name', 'subnet'], { unique: true })
@Index(['isActive'])
export class Exchange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: ExchangeType
  })
  type: ExchangeType;

  @Column({
    type: 'enum',
    enum: SubnetType
  })
  subnet: SubnetType;

  @Column({ type: 'varchar', length: 255 })
  apiEndpoint: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb' })
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };

  @Column({ type: 'text', array: true, default: [] })
  supportedTokens: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  apiKey?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  apiSecret?: string;

  @Column({ type: 'jsonb', nullable: true })
  config?: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  lastHealthCheck?: Date;

  @Column({ type: 'boolean', default: true })
  isHealthy: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToMany(() => PriceData, priceData => priceData.exchange)
  priceData: PriceData[];

  @OneToMany(() => ArbitrageOpportunity, opportunity => opportunity.sourceExchange)
  sourceOpportunities: ArbitrageOpportunity[];

  @OneToMany(() => ArbitrageOpportunity, opportunity => opportunity.targetExchange)
  targetOpportunities: ArbitrageOpportunity[];
}
