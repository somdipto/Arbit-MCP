import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { logger } from '@/utils/logger';
import { 
  Transaction, 
  Exchange, 
  TokenPair,
  ArbitrageError,
  NetworkError
} from '@/types/arbitrage';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';

export interface WalletConfig {
  privateKey: string;
  rpcUrl: string;
  chainId: number;
  gasLimit: number;
  maxGasPrice: number;
  priorityFee: number;
  nonceOffset: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface BalanceInfo {
  token: string;
  balance: string;
  decimals: number;
  symbol: string;
  usdValue: number;
  lastUpdated: Date;
}

export interface TransactionRequest {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: number;
  gasPrice?: string;
  maxPriorityFeePerGas?: string;
  maxFeePerGas?: string;
  nonce?: number;
  chainId?: number;
}

export interface TransactionResult {
  success: boolean;
  transactionHash?: string;
  gasUsed?: number;
  gasPrice?: string;
  amount?: number;
  error?: string;
  details?: any;
}

export class WalletService extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private config: WalletConfig;
  private database: DatabaseService;
  private notifications: NotificationService;
  
  private nonceCache: Map<string, number> = new Map();
  private pendingTransactions: Map<string, Transaction> = new Map();
  private balanceCache: Map<string, BalanceInfo> = new Map();
  private lastBalanceUpdate: Date = new Date(0);
  private balanceUpdateInterval: number = 30000; // 30 seconds

  constructor(
    config: WalletConfig,
    database: DatabaseService,
    notifications: NotificationService
  ) {
    super();
    
    this.config = config;
    this.database = database;
    this.notifications = notifications;

    // Initialize provider and wallet
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);

    // Validate wallet configuration
    this.validateWalletConfig();

    // Setup event listeners
    this.setupEventListeners();

    // Start balance monitoring
    this.startBalanceMonitoring();

    logger.info(`Wallet service initialized for address: ${this.wallet.address}`);
  }

  private validateWalletConfig(): void {
    try {
      if (!this.config.privateKey || this.config.privateKey.length !== 66) {
        throw new Error('Invalid private key format');
      }

      if (!this.config.rpcUrl) {
        throw new Error('RPC URL is required');
      }

      if (this.config.chainId <= 0) {
        throw new Error('Invalid chain ID');
      }

      logger.info('Wallet configuration validated successfully');
    } catch (error) {
      logger.error('Wallet configuration validation failed:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Listen for transaction confirmations
    this.provider.on('block', this.handleNewBlock.bind(this));
  }

  private startBalanceMonitoring(): void {
    setInterval(async () => {
      try {
        await this.updateAllBalances();
      } catch (error) {
        logger.error('Error updating balances:', error);
      }
    }, this.balanceUpdateInterval);
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Get wallet balance for a specific token
   */
  async getBalance(token: string): Promise<number> {
    try {
      // Check cache first
      const cached = this.balanceCache.get(token);
      if (cached && Date.now() - cached.lastUpdated.getTime() < this.balanceUpdateInterval) {
        return parseFloat(cached.balance);
      }

      // Update balance
      await this.updateBalance(token);
      
      const updated = this.balanceCache.get(token);
      return updated ? parseFloat(updated.balance) : 0;
      
    } catch (error) {
      logger.error(`Error getting balance for token ${token}:`, error);
      return 0;
    }
  }

  /**
   * Get all token balances
   */
  async getAllBalances(): Promise<BalanceInfo[]> {
    try {
      await this.updateAllBalances();
      return Array.from(this.balanceCache.values());
    } catch (error) {
      logger.error('Error getting all balances:', error);
      return [];
    }
  }

  /**
   * Update balance for a specific token
   */
  private async updateBalance(token: string): Promise<void> {
    try {
      let balance: string;
      let decimals: number;
      let symbol: string;

      if (token.toLowerCase() === 'eth' || token.toLowerCase() === 'avax') {
        // Native token
        balance = await this.provider.getBalance(this.wallet.address);
        decimals = 18;
        symbol = token.toUpperCase();
      } else {
        // ERC-20 token
        const tokenContract = new ethers.Contract(
          token,
          ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'],
          this.provider
        );

        const [balanceResult, decimalsResult, symbolResult] = await Promise.all([
          tokenContract.balanceOf(this.wallet.address),
          tokenContract.decimals(),
          tokenContract.symbol()
        ]);

        balance = balanceResult.toString();
        decimals = decimalsResult;
        symbol = symbolResult;
      }

      // Calculate USD value (this would integrate with price feeds)
      const usdValue = await this.calculateUSDValue(token, balance, decimals);

      const balanceInfo: BalanceInfo = {
        token,
        balance: ethers.formatUnits(balance, decimals),
        decimals,
        symbol,
        usdValue,
        lastUpdated: new Date()
      };

      this.balanceCache.set(token, balanceInfo);
      
    } catch (error) {
      logger.error(`Error updating balance for token ${token}:`, error);
      throw error;
    }
  }

  /**
   * Update all token balances
   */
  private async updateAllBalances(): Promise<void> {
    try {
      // Get supported tokens from configuration
      const supportedTokens = ['ETH', 'AVAX', 'USDC', 'USDT', 'WETH'];
      
      // Update native token balance first
      await this.updateBalance('ETH');
      
      // Update ERC-20 token balances
      for (const token of supportedTokens) {
        if (token !== 'ETH') {
          try {
            await this.updateBalance(token);
          } catch (error) {
            logger.warn(`Failed to update balance for ${token}:`, error);
          }
        }
      }

      this.lastBalanceUpdate = new Date();
      
    } catch (error) {
      logger.error('Error updating all balances:', error);
      throw error;
    }
  }

  /**
   * Calculate USD value for a token
   */
  private async calculateUSDValue(token: string, balance: string, decimals: number): Promise<number> {
    try {
      // This would integrate with price feeds (Chainlink, CoinGecko, etc.)
      // For now, return a placeholder value
      
      const tokenAmount = parseFloat(ethers.formatUnits(balance, decimals));
      
      // Placeholder prices (in production, fetch from price feeds)
      const prices: Record<string, number> = {
        'ETH': 2000,
        'AVAX': 50,
        'USDC': 1,
        'USDT': 1,
        'WETH': 2000
      };

      const price = prices[token.toUpperCase()] || 0;
      return tokenAmount * price;
      
    } catch (error) {
      logger.error(`Error calculating USD value for ${token}:`, error);
      return 0;
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<number> {
    try {
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
      
      // Ensure gas price is within limits
      const maxGasPrice = ethers.parseUnits(this.config.maxGasPrice.toString(), 'gwei');
      return Math.min(Number(gasPrice), Number(maxGasPrice));
      
    } catch (error) {
      logger.error('Error getting gas price:', error);
      // Return fallback gas price
      return Number(ethers.parseUnits('20', 'gwei'));
    }
  }

  /**
   * Get current nonce
   */
  async getNonce(): Promise<number> {
    try {
      const address = this.wallet.address;
      
      // Check cache first
      if (this.nonceCache.has(address)) {
        const cachedNonce = this.nonceCache.get(address)!;
        this.nonceCache.set(address, cachedNonce + 1);
        return cachedNonce;
      }

      // Get nonce from network
      const networkNonce = await this.provider.getTransactionCount(address, 'pending');
      const adjustedNonce = networkNonce + this.config.nonceOffset;
      
      this.nonceCache.set(address, adjustedNonce + 1);
      return adjustedNonce;
      
    } catch (error) {
      logger.error('Error getting nonce:', error);
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  async executeTransaction(txRequest: TransactionRequest): Promise<TransactionResult> {
    try {
      logger.info(`Executing transaction to ${txRequest.to}`);

      // Prepare transaction
      const transaction = await this.prepareTransaction(txRequest);
      
      // Sign and send transaction
      const tx = await this.wallet.sendTransaction(transaction);
      
      logger.info(`Transaction sent: ${tx.hash}`);
      
      // Store pending transaction
      const pendingTx: Transaction = {
        hash: tx.hash,
        from: tx.from!,
        to: tx.to!,
        value: tx.value?.toString() || '0',
        gas: Number(tx.gasLimit),
        gasPrice: tx.gasPrice?.toString() || '0',
        nonce: tx.nonce,
        data: tx.data || '0x',
        chainId: tx.chainId!,
        status: 'pending',
        confirmations: 0,
        timestamp: new Date()
      };

      this.pendingTransactions.set(tx.hash, pendingTx);
      
      // Save to database
      await this.database.saveTransaction(pendingTx);
      
      // Return result
      const result: TransactionResult = {
        success: true,
        transactionHash: tx.hash,
        gasUsed: 0, // Will be updated when confirmed
        gasPrice: tx.gasPrice?.toString() || '0',
        amount: parseFloat(ethers.formatEther(tx.value || '0')),
        details: {
          nonce: tx.nonce,
          chainId: tx.chainId
        }
      };

      return result;
      
    } catch (error) {
      logger.error('Transaction execution failed:', error);
      
      const result: TransactionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: { originalError: error }
      };

      return result;
    }
  }

  /**
   * Prepare transaction with proper gas estimation
   */
  private async prepareTransaction(txRequest: TransactionRequest): Promise<any> {
    try {
      // Get current gas price
      const gasPrice = await this.getGasPrice();
      
      // Estimate gas limit if not provided
      let gasLimit = txRequest.gasLimit;
      if (!gasLimit) {
        try {
          gasLimit = await this.provider.estimateGas({
            from: this.wallet.address,
            to: txRequest.to,
            value: txRequest.value || '0x0',
            data: txRequest.data || '0x'
          });
          
          // Add buffer to gas limit
          gasLimit = gasLimit * 12n / 10n; // 20% buffer
        } catch (error) {
          logger.warn('Gas estimation failed, using default:', error);
          gasLimit = BigInt(this.config.gasLimit);
        }
      }

      // Ensure gas limit is within bounds
      const maxGasLimit = BigInt(this.config.gasLimit);
      if (gasLimit > maxGasLimit) {
        logger.warn(`Gas limit ${gasLimit} exceeds maximum ${maxGasLimit}, capping`);
        gasLimit = maxGasLimit;
      }

      // Build transaction
      const transaction: any = {
        to: txRequest.to,
        value: txRequest.value || '0x0',
        data: txRequest.data || '0x',
        gasLimit,
        chainId: txRequest.chainId || this.config.chainId
      };

      // Use EIP-1559 if supported
      if (await this.supportsEIP1559()) {
        const feeData = await this.provider.getFeeData();
        transaction.maxPriorityFeePerGas = ethers.parseUnits(
          this.config.priorityFee.toString(), 
          'gwei'
        );
        transaction.maxFeePerGas = feeData.maxFeePerGas || 
          (ethers.parseUnits(gasPrice.toString(), 'gwei') + 
           ethers.parseUnits(this.config.priorityFee.toString(), 'gwei'));
      } else {
        // Legacy gas pricing
        transaction.gasPrice = ethers.parseUnits(gasPrice.toString(), 'gwei');
      }

      // Set nonce if not provided
      if (txRequest.nonce === undefined) {
        transaction.nonce = await this.getNonce();
      } else {
        transaction.nonce = txRequest.nonce;
      }

      return transaction;
      
    } catch (error) {
      logger.error('Error preparing transaction:', error);
      throw error;
    }
  }

  /**
   * Check if network supports EIP-1559
   */
  private async supportsEIP1559(): Promise<boolean> {
    try {
      const feeData = await this.provider.getFeeData();
      return feeData.maxFeePerGas !== null && feeData.maxPriorityFeePerGas !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cancel a pending transaction
   */
  async cancelTransaction(transactionHash: string): Promise<boolean> {
    try {
      const transaction = this.pendingTransactions.get(transactionHash);
      if (!transaction) {
        logger.warn(`Transaction ${transactionHash} not found for cancellation`);
        return false;
      }

      // Create cancellation transaction (same nonce, higher gas price, no data)
      const cancellationTx = {
        to: this.wallet.address,
        value: '0x0',
        data: '0x',
        nonce: transaction.nonce,
        gasLimit: 21000n, // Standard ETH transfer gas
        gasPrice: ethers.parseUnits(
          (parseFloat(transaction.gasPrice) * 1.2).toString(), 
          'wei'
        ) // 20% higher gas price
      };

      // Send cancellation transaction
      const tx = await this.wallet.sendTransaction(cancellationTx);
      
      logger.info(`Cancellation transaction sent: ${tx.hash}`);
      
      // Update original transaction status
      transaction.status = 'cancelled';
      this.pendingTransactions.set(transactionHash, transaction);
      
      // Save to database
      await this.database.saveTransaction(transaction);
      
      return true;
      
    } catch (error) {
      logger.error(`Error cancelling transaction ${transactionHash}:`, error);
      return false;
    }
  }

  /**
   * Handle new block events
   */
  private async handleNewBlock(blockNumber: number): Promise<void> {
    try {
      // Update pending transactions
      await this.updatePendingTransactions(blockNumber);
      
    } catch (error) {
      logger.error('Error handling new block:', error);
    }
  }

  /**
   * Update pending transactions status
   */
  private async updatePendingTransactions(blockNumber: number): Promise<void> {
    try {
      for (const [hash, transaction] of this.pendingTransactions) {
        if (transaction.status === 'pending') {
          try {
            const receipt = await this.provider.getTransactionReceipt(hash);
            
            if (receipt) {
              if (receipt.status === 1) {
                // Transaction confirmed
                transaction.status = 'confirmed';
                transaction.blockNumber = Number(receipt.blockNumber);
                transaction.confirmations = Number(blockNumber - receipt.blockNumber + 1n);
                
                // Update gas used
                transaction.gasUsed = Number(receipt.gasUsed);
                
                // Emit confirmation event
                this.emit('transactionConfirmed', hash, transaction);
                
                logger.info(`Transaction confirmed: ${hash}`);
                
              } else {
                // Transaction failed
                transaction.status = 'failed';
                this.emit('transactionFailed', hash, transaction);
                
                logger.error(`Transaction failed: ${hash}`);
              }
              
              // Save to database
              await this.database.saveTransaction(transaction);
              
              // Remove from pending if completed
              if (transaction.status !== 'pending') {
                this.pendingTransactions.delete(hash);
              }
            }
            
          } catch (error) {
            // Transaction not yet mined, continue
            continue;
          }
        }
      }
      
    } catch (error) {
      logger.error('Error updating pending transactions:', error);
    }
  }

  /**
   * Get pending transactions
   */
  getPendingTransactions(): Transaction[] {
    return Array.from(this.pendingTransactions.values());
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(hash: string): Promise<Transaction | null> {
    try {
      // Check pending transactions first
      const pending = this.pendingTransactions.get(hash);
      if (pending) {
        return pending;
      }

      // Check database
      return await this.database.getTransaction(hash);
      
    } catch (error) {
      logger.error(`Error getting transaction ${hash}:`, error);
      return null;
    }
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      address: this.wallet.address,
      chainId: this.config.chainId,
      pendingTransactions: this.pendingTransactions.size,
      lastBalanceUpdate: this.lastBalanceUpdate,
      balanceCacheSize: this.balanceCache.size,
      nonceCacheSize: this.nonceCache.size
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Remove event listeners
      this.provider.removeAllListeners();
      
      // Clear caches
      this.nonceCache.clear();
      this.balanceCache.clear();
      this.pendingTransactions.clear();
      
      logger.info('Wallet service cleaned up');
      
    } catch (error) {
      logger.error('Error cleaning up wallet service:', error);
    }
  }
}


