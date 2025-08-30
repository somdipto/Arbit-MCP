import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index
} from 'typeorm';
import { OpportunityStatus } from '@/types';
import { TokenPair } from './TokenPair';
import { Exchange } from './Exchange';
import { Trade } from './Trade';

@Entity('arbitrage_opportunities')
@Index(['status', 'detectedAt'])
@Index(['tokenPairId', 'detectedAt'])
@Index(['expiresAt'])
export class ArbitrageOpportunity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tokenPairId: string;

  @Column({ type: 'uuid' })
  sourceExchangeId: string;

  @Column({ type: 'uuid' })
  targetExchangeId: string;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  priceDifferencePercent: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  expectedProfitPercent: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  expectedProfitUSD: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  confidence: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  riskScore: number;

  @Column({
    type: 'enum',
    enum: OpportunityStatus,
    default: OpportunityStatus.DETECTED
  })
  status: OpportunityStatus;

  @Column({ type: 'text', array: true })
  reasoning: string[];

  @Column({ type: 'timestamp' })
  detectedAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'jsonb' })
  mcpContext: {
    modelId: string;
    inputFactors: {
      prices: Record<string, number>;
      gasPrices: Record<string, number>;
      liquidity: Record<string, number>;
      volatility: Record<string, number>;
      historicalPerformance: {
        successRate: number;
        averageProfit: number;
        averageSlippage: number;
      };
    };
    reasoningChain: string[];
    confidence: number;
    verificationProof: string;
  };

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  sourcePrice?: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  targetPrice?: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  estimatedGasCost?: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  netProfitAfterGas?: number;

  @Column({ type: 'jsonb', nullable: true })
  executionPlan?: {
    steps: Array<{
      order: number;
      action: string;
      exchange: string;
      token: string;
      amount: number;
      gasEstimate: number;
      description: string;
    }>;
    estimatedGas: number;
    estimatedProfit: number;
    riskAssessment: {
      slippageRisk: number;
      executionRisk: number;
      liquidityRisk: number;
      overallRisk: number;
      recommendations: string[];
    };
  };

  @Column({ type: 'timestamp', nullable: true })
  approvedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  approvedBy?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rejectionReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => TokenPair, tokenPair => tokenPair.opportunities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tokenPairId' })
  tokenPair: TokenPair;

  @ManyToOne(() => Exchange, exchange => exchange.sourceOpportunities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sourceExchangeId' })
  sourceExchange: Exchange;

  @ManyToOne(() => Exchange, exchange => exchange.targetOpportunities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetExchangeId' })
  targetExchange: Exchange;

  @OneToMany(() => Trade, trade => trade.opportunity)
  trades: Trade[];
}
