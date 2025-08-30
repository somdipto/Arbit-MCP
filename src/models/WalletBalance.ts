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
import { Wallet } from './Wallet';

@Entity('wallet_balances')
@Index(['walletId', 'token'], { unique: true })
@Index(['token', 'lastUpdated'])
export class WalletBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  walletId: string;

  @Column({ type: 'varchar', length: 20 })
  token: string;

  @Column({ type: 'decimal', precision: 30, scale: 18 })
  balance: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  usdValue: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  priceUSD?: number;

  @UpdateDateColumn()
  lastUpdated: Date;

  @CreateDateColumn()
  createdAt: Date;

  // Relationships
  @ManyToOne(() => Wallet, wallet => wallet.balances, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;
}
