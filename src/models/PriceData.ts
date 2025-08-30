import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { TokenPair } from './TokenPair';
import { Exchange } from './Exchange';

@Entity('price_data')
@Index(['tokenPairId', 'exchangeId', 'timestamp'])
@Index(['timestamp'])
@Index(['tokenPairId', 'timestamp'])
export class PriceData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tokenPairId: string;

  @Column({ type: 'uuid' })
  exchangeId: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  price: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  volume24h: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  liquidity: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  high24h?: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  low24h?: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  priceChange24h?: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  volumeChange24h?: number;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'varchar', length: 100 })
  source: string;

  @Column({ type: 'boolean', default: false })
  isAnomalous: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  // Relationships
  @ManyToOne(() => TokenPair, tokenPair => tokenPair.priceData, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tokenPairId' })
  tokenPair: TokenPair;

  @ManyToOne(() => Exchange, exchange => exchange.priceData, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exchangeId' })
  exchange: Exchange;
}
