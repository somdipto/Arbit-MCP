import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { Trade } from './Trade';

@Entity('verifications')
@Index(['tradeId'], { unique: true })
@Index(['onChainProofId'])
export class Verification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tradeId: string;

  @Column({ type: 'varchar', length: 255 })
  reasoningChainHash: string;

  @Column({ type: 'varchar', length: 255 })
  onChainProofId: string;

  @Column({ type: 'jsonb' })
  reasoningData: {
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

  @Column({ type: 'text' })
  verificationProof: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  blockchainTxHash?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  blockchainBlockNumber?: string;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  verifiedBy?: string;

  @Column({ type: 'jsonb', nullable: true })
  verificationMetadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  // Relationships
  @OneToOne(() => Trade, trade => trade.verification, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tradeId' })
  trade: Trade;
}
