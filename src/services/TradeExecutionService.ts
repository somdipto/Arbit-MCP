import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { logger } from '@/utils/logger';
import { 
  Trade, 
  TradeResult, 
  Transaction, 
  Exchange, 
  TokenPair,
  TradeExecutionConfig,
  ArbitrageError,
  ExecutionError,
  NetworkError
} from '@/types/arbitrage';
import { WalletService } from './WalletService';
import { GasOptimizationService } from './GasOptimizationService';
import { MEVProtectionService } from './MEVProtectionService';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';

export class TradeExecutionService extends EventEmitter {
  private walletService: WalletService;
  private gasOptimization: GasOptimizationService;
  private mevProtection: MEVProtectionService;
  private database: DatabaseService;
  private notifications: NotificationService;
  
  private config: TradeExecutionConfig;
  private activeTrades: Map<string, Trade> = new Map();
  private pendingTransactions: Map<string, Transaction> = new Map();
  private retryQueue: Map<string, { attempts: number; nextRetry: Date }> = new Map();

  constructor(
    walletService: WalletService,
    gasOptimization: GasOptimizationService,
    mevProtection: MEVProtectionService,
    database: DatabaseService,
    notifications: NotificationService
  ) {
    super();
    
    this.walletService = walletService;
    this.gasOptimization = gasOptimization;
    this.mevProtection = mevProtection;
    this.database = database;
    this.notifications = notifications;

    // Load configuration
    this.config = {
      slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE || '0.5'),
      maxGasPrice: parseFloat(process.env.MAX_GAS_PRICE || '100'),
      maxGasLimit: parseInt(process.env.MAX_GAS_LIMIT || '500000'),
      priorityFee: parseFloat(process.env.PRIORITY_FEE || '2'),
      timeout: parseInt(process.env.EXECUTION_TIMEOUT || '30000'),
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.RETRY_DELAY || '5000')
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for transaction confirmations
    this.walletService.on('transactionConfirmed', this.handleTransactionConfirmed.bind(this));
    this.walletService.on('transactionFailed', this.handleTransactionFailed.bind(this));
  }

  /**
   * Execute an arbitrage trade
   */
  async executeArbitrageTrade(trade: Trade): Promise<TradeResult> {
    try {
      logger.info(`Starting arbitrage trade execution: ${trade.id}`);
      
      // Validate trade
      await this.validateTrade(trade);
      
      // Update trade status
      trade.status = 'executing';
      this.activeTrades.set(trade.id, trade);
      
      // Apply MEV protection
      const mevProtection = await this.mevProtection.applyProtection(trade);
      
      // Optimize gas settings
      const gasOptimization = await this.gasOptimization.optimizeForTrade(trade);
      
      // Execute buy transaction
      const buyResult = await this.executeBuyTransaction(trade, mevProtection, gasOptimization);
      
      if (!buyResult.success) {
        throw new ExecutionError(`Buy transaction failed: ${buyResult.error}`, 'BUY_EXECUTION_FAILED');
      }
      
      // Wait for buy confirmation
      await this.waitForTransactionConfirmation(buyResult.transactionHash!);
      
      // Execute sell transaction
      const sellResult = await this.executeSellTransaction(trade, mevProtection, gasOptimization);
      
      if (!sellResult.success) {
        // If sell fails, we need to handle the bought tokens
        await this.handleFailedSell(trade, buyResult.transactionHash!);
        throw new ExecutionError(`Sell transaction failed: ${sellResult.error}`, 'SELL_EXECUTION_FAILED');
      }
      
      // Wait for sell confirmation
      await this.waitForTransactionConfirmation(sellResult.transactionHash!);
      
      // Calculate actual profit
      const actualProfit = await this.calculateActualProfit(trade, buyResult, sellResult);
      
      // Complete the trade
      const result: TradeResult = {
        success: true,
        tradeId: trade.id,
        actualProfit,
        gasUsed: buyResult.gasUsed! + sellResult.gasUsed!,
        transactionHash: `${buyResult.transactionHash},${sellResult.transactionHash}`,
        executionTime: Date.now() - trade.timestamp.getTime()
      };
      
      // Update trade status
      trade.status = 'completed';
      trade.actualProfit = actualProfit;
      trade.completionTime = new Date();
      
      // Save to database
      await this.database.saveTrade(trade);
      
      // Remove from active trades
      this.activeTrades.delete(trade.id);
      
      // Emit success event
      this.emit('tradeCompleted', trade);
      
      logger.info(`Arbitrage trade ${trade.id} completed successfully`);
      
      return result;
      
    } catch (error) {
      logger.error(`Trade execution failed for ${trade.id}:`, error);
      
      // Update trade status
      trade.status = 'failed';
      trade.error = error instanceof Error ? error.message : 'Unknown error';
      trade.failureTime = new Date();
      
      // Save to database
      await this.database.saveTrade(trade);
      
      // Remove from active trades
      this.activeTrades.delete(trade.id);
      
      // Emit failure event
      this.emit('tradeFailed', trade);
      
      // Send notification
      await this.notifications.sendTradeFailureNotification(trade);
      
      return {
        success: false,
        tradeId: trade.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate trade before execution
   */
  private async validateTrade(trade: Trade): Promise<void> {
    try {
      // Check if trade is already active
      if (this.activeTrades.has(trade.id)) {
        throw new ValidationError('Trade is already being executed', 'DUPLICATE_TRADE');
      }
      
      // Validate token pair
      if (!trade.tokenPair.baseToken || !trade.tokenPair.quoteToken) {
        throw new ValidationError('Invalid token pair', 'INVALID_TOKEN_PAIR');
      }
      
      // Validate exchanges
      if (!trade.buyExchange || !trade.sellExchange) {
        throw new ValidationError('Invalid exchanges', 'INVALID_EXCHANGES');
      }
      
      // Check if exchanges are active
      if (!trade.buyExchange.isActive || !trade.sellExchange.isActive) {
        throw new ValidationError('One or more exchanges are inactive', 'INACTIVE_EXCHANGE');
      }
      
      // Validate trade size
      if (trade.tradeSize <= 0) {
        throw new ValidationError('Invalid trade size', 'INVALID_TRADE_SIZE');
      }
      
      // Check balance
      const balance = await this.walletService.getBalance(trade.tokenPair.baseToken);
      if (balance < trade.tradeSize) {
        throw new ValidationError('Insufficient balance', 'INSUFFICIENT_BALANCE');
      }
      
      // Check if we're already trading this pair
      const activePairTrades = Array.from(this.activeTrades.values()).filter(
        t => t.tokenPair.baseToken === trade.tokenPair.baseToken
      );
      
      if (activePairTrades.length > 0) {
        throw new ValidationError('Already trading this token pair', 'DUPLICATE_PAIR_TRADE');
      }
      
      logger.info(`Trade ${trade.id} validation passed`);
      
    } catch (error) {
      logger.error(`Trade validation failed for ${trade.id}:`, error);
      throw error;
    }
  }

  /**
   * Execute buy transaction
   */
  private async executeBuyTransaction(
    trade: Trade,
    mevProtection: any,
    gasOptimization: any
  ): Promise<any> {
    try {
      logger.info(`Executing buy transaction for trade ${trade.id}`);
      
      // Prepare buy transaction
      const buyTx = await this.prepareBuyTransaction(trade, mevProtection, gasOptimization);
      
      // Execute transaction
      const result = await this.walletService.executeTransaction(buyTx);
      
      // Store pending transaction
      this.pendingTransactions.set(result.transactionHash, {
        ...buyTx,
        hash: result.transactionHash,
        status: 'pending',
        timestamp: new Date()
      });
      
      return result;
      
    } catch (error) {
      logger.error(`Buy transaction execution failed for trade ${trade.id}:`, error);
      throw new ExecutionError(`Buy transaction failed: ${error}`, 'BUY_EXECUTION_FAILED');
    }
  }

  /**
   * Execute sell transaction
   */
  private async executeSellTransaction(
    trade: Trade,
    mevProtection: any,
    gasOptimization: any
  ): Promise<any> {
    try {
      logger.info(`Executing sell transaction for trade ${trade.id}`);
      
      // Prepare sell transaction
      const sellTx = await this.prepareSellTransaction(trade, mevProtection, gasOptimization);
      
      // Execute transaction
      const result = await this.walletService.executeTransaction(sellTx);
      
      // Store pending transaction
      this.pendingTransactions.set(result.transactionHash, {
        ...sellTx,
        hash: result.transactionHash,
        status: 'pending',
        timestamp: new Date()
      });
      
      return result;
      
    } catch (error) {
      logger.error(`Sell transaction execution failed for trade ${trade.id}:`, error);
      throw new ExecutionError(`Sell transaction failed: ${error}`, 'SELL_EXECUTION_FAILED');
    }
  }

  /**
   * Prepare buy transaction
   */
  private async prepareBuyTransaction(
    trade: Trade,
    mevProtection: any,
    gasOptimization: any
  ): Promise<any> {
    try {
      // Get current gas price
      const gasPrice = await this.walletService.getGasPrice();
      
      // Apply MEV protection adjustments
      const adjustedGasPrice = gasPrice * (1 + mevProtection.gasAdjustment);
      
      // Ensure gas price is within limits
      const finalGasPrice = Math.min(adjustedGasPrice, this.config.maxGasPrice);
      
      // Calculate gas limit
      const gasLimit = Math.min(
        trade.gasEstimate.buyGas * gasOptimization.gasLimitMultiplier,
        this.config.maxGasLimit
      );
      
      // Build transaction
      const transaction = {
        to: trade.buyExchange.address,
        value: ethers.parseEther(trade.tradeSize.toString()),
        gasLimit,
        gasPrice: ethers.parseUnits(finalGasPrice.toString(), 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits(this.config.priorityFee.toString(), 'gwei'),
        data: this.buildBuyTransactionData(trade),
        nonce: await this.walletService.getNonce()
      };
      
      return transaction;
      
    } catch (error) {
      logger.error(`Failed to prepare buy transaction for trade ${trade.id}:`, error);
      throw error;
    }
  }

  /**
   * Prepare sell transaction
   */
  private async prepareSellTransaction(
    trade: Trade,
    mevProtection: any,
    gasOptimization: any
  ): Promise<any> {
    try {
      // Get current gas price
      const gasPrice = await this.walletService.getGasPrice();
      
      // Apply MEV protection adjustments
      const adjustedGasPrice = gasPrice * (1 + mevProtection.gasAdjustment);
      
      // Ensure gas price is within limits
      const finalGasPrice = Math.min(adjustedGasPrice, this.config.maxGasPrice);
      
      // Calculate gas limit
      const gasLimit = Math.min(
        trade.gasEstimate.sellGas * gasOptimization.gasLimitMultiplier,
        this.config.maxGasLimit
      );
      
      // Build transaction
      const transaction = {
        to: trade.sellExchange.address,
        value: 0, // No ETH sent for token sales
        gasLimit,
        gasPrice: ethers.parseUnits(finalGasPrice.toString(), 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits(this.config.priorityFee.toString(), 'gwei'),
        data: this.buildSellTransactionData(trade),
        nonce: await this.walletService.getNonce()
      };
      
      return transaction;
      
    } catch (error) {
      logger.error(`Failed to prepare sell transaction for trade ${trade.id}:`, error);
      throw error;
    }
  }

  /**
   * Build buy transaction data
   */
  private buildBuyTransactionData(trade: Trade): string {
    try {
      // This would build the actual transaction data for the specific exchange
      // For now, return a placeholder
      return '0x'; // Placeholder
    } catch (error) {
      logger.error(`Failed to build buy transaction data for trade ${trade.id}:`, error);
      throw error;
    }
  }

  /**
   * Build sell transaction data
   */
  private buildSellTransactionData(trade: Trade): string {
    try {
      // This would build the actual transaction data for the specific exchange
      // For now, return a placeholder
      return '0x'; // Placeholder
    } catch (error) {
      logger.error(`Failed to build sell transaction data for trade ${trade.id}:`, error);
      throw error;
    }
  }

  /**
   * Wait for transaction confirmation
   */
  private async waitForTransactionConfirmation(transactionHash: string): Promise<void> {
    try {
      logger.info(`Waiting for transaction confirmation: ${transactionHash}`);
      
      const startTime = Date.now();
      
      while (Date.now() - startTime < this.config.timeout) {
        const transaction = this.pendingTransactions.get(transactionHash);
        
        if (transaction && transaction.status === 'confirmed') {
          logger.info(`Transaction confirmed: ${transactionHash}`);
          return;
        }
        
        if (transaction && transaction.status === 'failed') {
          throw new ExecutionError(`Transaction failed: ${transactionHash}`, 'TRANSACTION_FAILED');
        }
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      throw new ExecutionError(`Transaction confirmation timeout: ${transactionHash}`, 'CONFIRMATION_TIMEOUT');
      
    } catch (error) {
      logger.error(`Error waiting for transaction confirmation: ${transactionHash}`, error);
      throw error;
    }
  }

  /**
   * Handle failed sell transaction
   */
  private async handleFailedSell(trade: Trade, buyTransactionHash: string): Promise<void> {
    try {
      logger.warn(`Handling failed sell for trade ${trade.id}, bought tokens need attention`);
      
      // This would implement logic to handle the bought tokens
      // Options: hold, sell on different exchange, emergency liquidation
      
      // For now, just log the situation
      logger.warn(`Trade ${trade.id} has bought tokens that need manual intervention`);
      
      // Send emergency notification
      await this.notifications.sendEmergencyNotification({
        type: 'FAILED_SELL',
        tradeId: trade.id,
        buyTransactionHash,
        message: 'Sell transaction failed, bought tokens need attention'
      });
      
    } catch (error) {
      logger.error(`Error handling failed sell for trade ${trade.id}:`, error);
    }
  }

  /**
   * Calculate actual profit after trade execution
   */
  private async calculateActualProfit(
    trade: Trade,
    buyResult: any,
    sellResult: any
  ): Promise<any> {
    try {
      // Get actual amounts from transactions
      const buyAmount = buyResult.amount;
      const sellAmount = sellResult.amount;
      
      // Calculate actual profit
      const actualProfit = sellAmount - buyAmount;
      const profitPercentage = (actualProfit / buyAmount) * 100;
      
      // Calculate gas costs
      const totalGasCost = (buyResult.gasUsed + sellResult.gasUsed) * 
        (buyResult.gasPrice || sellResult.gasPrice);
      
      // Calculate net profit
      const netProfit = actualProfit - totalGasCost;
      
      return {
        percentage: profitPercentage,
        absolute: actualProfit,
        usd: actualProfit * trade.buyPrice,
        afterFees: actualProfit,
        afterGas: netProfit,
        netProfit
      };
      
    } catch (error) {
      logger.error(`Error calculating actual profit for trade ${trade.id}:`, error);
      throw error;
    }
  }

  /**
   * Handle transaction confirmation
   */
  private async handleTransactionConfirmed(transactionHash: string): Promise<void> {
    try {
      const transaction = this.pendingTransactions.get(transactionHash);
      if (transaction) {
        transaction.status = 'confirmed';
        transaction.confirmations = 1;
        this.pendingTransactions.set(transactionHash, transaction);
        
        logger.info(`Transaction confirmed: ${transactionHash}`);
      }
    } catch (error) {
      logger.error(`Error handling transaction confirmation: ${transactionHash}`, error);
    }
  }

  /**
   * Handle transaction failure
   */
  private async handleTransactionFailed(transactionHash: string): Promise<void> {
    try {
      const transaction = this.pendingTransactions.get(transactionHash);
      if (transaction) {
        transaction.status = 'failed';
        this.pendingTransactions.set(transactionHash, transaction);
        
        logger.error(`Transaction failed: ${transactionHash}`);
      }
    } catch (error) {
      logger.error(`Error handling transaction failure: ${transactionHash}`, error);
    }
  }

  /**
   * Cancel a trade
   */
  async cancelTrade(tradeId: string): Promise<boolean> {
    try {
      const trade = this.activeTrades.get(tradeId);
      if (!trade) {
        logger.warn(`Trade ${tradeId} not found for cancellation`);
        return false;
      }
      
      logger.info(`Cancelling trade: ${tradeId}`);
      
      // Update trade status
      trade.status = 'cancelled';
      
      // Remove from active trades
      this.activeTrades.delete(tradeId);
      
      // Cancel pending transactions
      for (const [txHash, tx] of this.pendingTransactions) {
        if (tx.tradeId === tradeId) {
          await this.walletService.cancelTransaction(txHash);
          this.pendingTransactions.delete(txHash);
        }
      }
      
      // Save to database
      await this.database.saveTrade(trade);
      
      logger.info(`Trade ${tradeId} cancelled successfully`);
      return true;
      
    } catch (error) {
      logger.error(`Error cancelling trade ${tradeId}:`, error);
      return false;
    }
  }

  /**
   * Get active trades
   */
  getActiveTrades(): Trade[] {
    return Array.from(this.activeTrades.values());
  }

  /**
   * Get pending transactions
   */
  getPendingTransactions(): Transaction[] {
    return Array.from(this.pendingTransactions.values());
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      activeTrades: this.activeTrades.size,
      pendingTransactions: this.pendingTransactions.size,
      retryQueue: this.retryQueue.size,
      config: this.config
    };
  }
}

// Custom error classes
class ValidationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ValidationError';
  }
}


