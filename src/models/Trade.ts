import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  Index
} from 'typeorm';
import { TradeStatus } from '@/types';
import { ArbitrageOpportunity } from './ArbitrageOpportunity';
import { Wallet } from './Wallet';
import { Verification } from './Verification';

@Entity('trades')
@Index(['status', 'createdAt'])
@Index(['walletId', 'createdAt'])
@Index(['opportunityId'])
@Index(['sourceTxHash'], { unique: true, where: '"sourceTxHash" IS NOT NULL' })
@Index(['targetTxHash'], { unique: true, where: '"targetTxHash" IS NOT NULL' })
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  opportunityId: string;

  @Column({ type: 'uuid' })
  walletId: string;

  @Column({ type: 'varchar', length: 20 })
  tokenPair: string;

  @Column({ type: 'varchar', length: 100 })
  sourceExchange: string;

  @Column({ type: 'varchar', length: 100 })
  targetExchange: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  inputAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  outputAmount: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  expectedProfit: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  actualProfit?: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  gasUsed?: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  gasPrice?: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  gasCost?: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  slippage?: number;

  @Column({ type: 'varchar', length: 66, nullable: true })
  sourceTxHash?: string;

  @Column({ type: 'varchar', length: 66, nullable: true })
  targetTxHash?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  sourceBlockNumber?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  targetBlockNumber?: string;

  @Column({
    type: 'enum',
    enum: TradeStatus,
    default: TradeStatus.PENDING
  })
  status: TradeStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', nullable: true })
  executionDetails?: {
    startTime: Date;
    endTime: Date;
    steps: Array<{
      step: number;
      action: string;
      txHash?: string;
      status: string;
      gasUsed?: number;
      error?: string;
    }>;
  };

  @Column({ type: 'timestamp', nullable: true })
  executedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => ArbitrageOpportunity, opportunity => opportunity.trades, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'opportunityId' })
  opportunity: ArbitrageOpportunity;

  @ManyToOne(() => Wallet, wallet => wallet.trades, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @OneToOne(() => Verification, verification => verification.trade)
  verification: Verification;
}
