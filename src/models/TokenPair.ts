import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index
} from 'typeorm';
import { PriceData } from './PriceData';
import { ArbitrageOpportunity } from './ArbitrageOpportunity';

@Entity('token_pairs')
@Index(['baseToken', 'quoteToken'], { unique: true })
@Index(['isActive'])
export class TokenPair {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  baseToken: string;

  @Column({ type: 'varchar', length: 20 })
  quoteToken: string;

  @Column({ type: 'varchar', length: 42 })
  baseTokenAddress: string;

  @Column({ type: 'varchar', length: 42 })
  quoteTokenAddress: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  minTradeSize: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  maxTradeSize: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0.5 })
  minProfitThreshold: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @OneToMany(() => PriceData, priceData => priceData.tokenPair)
  priceData: PriceData[];

  @OneToMany(() => ArbitrageOpportunity, opportunity => opportunity.tokenPair)
  opportunities: ArbitrageOpportunity[];
}
