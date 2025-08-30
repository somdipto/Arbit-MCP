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
import { SubnetType } from '@/types';
import { User } from './User';
import { Trade } from './Trade';
import { WalletBalance } from './WalletBalance';

@Entity('wallets')
@Index(['address', 'subnet'], { unique: true })
@Index(['userId', 'isActive'])
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 42 })
  address: string;

  @Column({ type: 'text' })
  encryptedPrivateKey: string;

  @Column({
    type: 'enum',
    enum: SubnetType
  })
  subnet: SubnetType;

  @Column({ type: 'jsonb', default: {} })
  balance: Record<string, number>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  totalValueUSD: number;

  @Column({ type: 'timestamp', nullable: true })
  lastBalanceUpdate?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => User, user => user.wallets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Trade, trade => trade.wallet)
  trades: Trade[];

  @OneToMany(() => WalletBalance, balance => balance.wallet)
  balances: WalletBalance[];
}
