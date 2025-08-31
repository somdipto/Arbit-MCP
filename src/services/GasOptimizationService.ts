import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { logger } from '@/utils/logger';
import { 
  GasEstimate, 
  GasOptimizationResult,
  ArbitrageOpportunity 
} from '@/types/arbitrage';
import { DatabaseService } from './DatabaseService';
import { MetricsService } from './MetricsService';

export class GasOptimizationService extends EventEmitter {
  private database: DatabaseService;
  private metrics: MetricsService;
  private gasPriceHistory: Map<string, number[]> = new Map();
  private networkCongestion: Map<string, number> = new Map();
  private gasLimitCache: Map<string, number> = new Map();
  private optimizationHistory: Map<string, GasOptimizationResult[]> = new Map();

  constructor(database: DatabaseService, metrics: MetricsService) {
    super();
    
    this.database = database;
    this.metrics = metrics;
  }

  /**
   * Initialize gas optimization service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing gas optimization service...');
      
      // Initialize gas price monitoring
      await this.initializeGasPriceMonitoring();
      
      // Initialize network congestion monitoring
      await this.initializeNetworkMonitoring();
      
      // Load historical gas data
      await this.loadGasHistory();
      
      logger.info('Gas optimization service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize gas optimization service:', error);
      throw error;
    }
  }

  /**
   * Initialize gas price monitoring
   */
  private async initializeGasPriceMonitoring(): Promise<void> {
    try {
      // Initialize default gas prices for different networks
      const defaultGasPrices = {
        'ethereum': 20, // gwei
        'avalanche': 25, // gwei
        'polygon': 30, // gwei
        'arbitrum': 0.1, // gwei
        'optimism': 0.001 // gwei
      };

      Object.entries(defaultGasPrices).forEach(([network, price]) => {
        this.gasPriceHistory.set(network, [price]);
      });

      logger.info('Gas price monitoring initialized');
      
    } catch (error) {
      logger.error('Error initializing gas price monitoring:', error);
    }
  }

  /**
   * Initialize network congestion monitoring
   */
  private async initializeNetworkMonitoring(): Promise<void> {
    try {
      // Initialize default network congestion levels
      const defaultCongestion = {
        'ethereum': 0.5, // 50% congestion
        'avalanche': 0.3, // 30% congestion
        'polygon': 0.4, // 40% congestion
        'arbitrum': 0.2, // 20% congestion
        'optimism': 0.1 // 10% congestion
      };

      Object.entries(defaultCongestion).forEach(([network, congestion]) => {
        this.networkCongestion.set(network, congestion);
      });

      logger.info('Network congestion monitoring initialized');
      
    } catch (error) {
      logger.error('Error initializing network monitoring:', error);
    }
  }

  /**
   * Load gas history from database
   */
  private async loadGasHistory(): Promise<void> {
    try {
      // This would load historical gas price data
      // For now, initialize with empty data
      logger.info('Gas history loaded');
      
    } catch (error) {
      logger.error('Error loading gas history:', error);
    }
  }

  /**
   * Optimize gas settings for a trade
   */
  async optimizeForTrade(trade: any): Promise<any> {
    try {
      logger.info(`Optimizing gas settings for trade ${trade.id}`);
      
      // Get current network conditions
      const network = this.getNetworkFromTrade(trade);
      const currentGasPrice = await this.getCurrentGasPrice(network);
      const congestion = this.networkCongestion.get(network) || 0.5;
      
      // Calculate optimal gas price
      const optimalGasPrice = this.calculateOptimalGasPrice(currentGasPrice, congestion);
      
      // Calculate optimal gas limit
      const optimalGasLimit = await this.calculateOptimalGasLimit(trade, network);
      
      // Calculate priority fee
      const priorityFee = this.calculatePriorityFee(network, congestion);
      
      // Create optimization result
      const optimizationResult: GasOptimizationResult = {
        originalGas: trade.gasEstimate?.totalGas || 500000,
        optimizedGas: optimalGasLimit,
        savings: (trade.gasEstimate?.totalGas || 500000) - optimalGasLimit,
        savingsPercent: (((trade.gasEstimate?.totalGas || 500000) - optimalGasLimit) / (trade.gasEstimate?.totalGas || 500000)) * 100,
        strategy: this.getOptimizationStrategy(network, congestion),
        recommendations: this.generateGasRecommendations(network, congestion, optimalGasPrice, optimalGasLimit)
      };
      
      // Store optimization result
      this.storeOptimizationResult(trade.id, optimizationResult);
      
      // Record metrics
      this.metrics.recordGasOptimization(optimizationResult);
      
      // Return optimized settings
      return {
        gasLimit: optimalGasLimit,
        gasLimitMultiplier: optimalGasLimit / (trade.gasEstimate?.totalGas || 500000),
        gasPrice: optimalGasPrice,
        priorityFee,
        maxFeePerGas: optimalGasPrice + priorityFee,
        strategy: optimizationResult.strategy
      };
      
    } catch (error) {
      logger.error(`Error optimizing gas for trade ${trade.id}:`, error);
      // Return default settings on error
      return {
        gasLimit: trade.gasEstimate?.totalGas || 500000,
        gasLimitMultiplier: 1.0,
        gasPrice: 20,
        priorityFee: 2,
        maxFeePerGas: 22,
        strategy: 'default'
      };
    }
  }

  /**
   * Estimate gas cost for an arbitrage opportunity
   */
  async estimateGasCost(buyPrice: any, sellPrice: any): Promise<GasEstimate> {
    try {
      const network = this.getNetworkFromPrice(buyPrice);
      const currentGasPrice = await this.getCurrentGasPrice(network);
      
      // Estimate gas for buy transaction
      const buyGas = this.estimateBuyGas(buyPrice);
      
      // Estimate gas for sell transaction
      const sellGas = this.estimateSellGas(sellPrice);
      
      // Calculate total gas
      const totalGas = buyGas + sellGas;
      
      // Calculate gas cost
      const gasCost = totalGas * currentGasPrice;
      
      // Calculate priority fee
      const priorityFee = this.calculatePriorityFee(network, this.networkCongestion.get(network) || 0.5);
      
      const gasEstimate: GasEstimate = {
        buyGas,
        sellGas,
        totalGas,
        gasPrice: currentGasPrice,
        totalCost: gasCost,
        gasLimit: totalGas,
        priorityFee
      };
      
      return gasEstimate;
      
    } catch (error) {
      logger.error('Error estimating gas cost:', error);
      // Return default estimate on error
      return {
        buyGas: 250000,
        sellGas: 250000,
        totalGas: 500000,
        gasPrice: 20,
        totalCost: 10000000, // 10 gwei
        gasLimit: 500000,
        priorityFee: 2
      };
    }
  }

  /**
   * Get current gas price for a network
   */
  async getCurrentGasPrice(network: string): Promise<number> {
    try {
      // This would implement actual gas price fetching from network
      // For now, return cached or default values
      
      const cachedPrices = this.gasPriceHistory.get(network);
      if (cachedPrices && cachedPrices.length > 0) {
        return cachedPrices[cachedPrices.length - 1];
      }
      
      // Default gas prices
      const defaultPrices: Record<string, number> = {
        'ethereum': 20,
        'avalanche': 25,
        'polygon': 30,
        'arbitrum': 0.1,
        'optimism': 0.001
      };
      
      return defaultPrices[network] || 20;
      
    } catch (error) {
      logger.error(`Error getting gas price for ${network}:`, error);
      return 20; // Default fallback
    }
  }

  /**
   * Calculate optimal gas price based on network conditions
   */
  private calculateOptimalGasPrice(currentPrice: number, congestion: number): number {
    try {
      let optimalPrice = currentPrice;
      
      // Adjust based on network congestion
      if (congestion > 0.8) {
        // High congestion - increase gas price by 20%
        optimalPrice *= 1.2;
      } else if (congestion > 0.6) {
        // Medium congestion - increase gas price by 10%
        optimalPrice *= 1.1;
      } else if (congestion < 0.3) {
        // Low congestion - decrease gas price by 10%
        optimalPrice *= 0.9;
      }
      
      // Ensure price is within reasonable bounds
      const minPrice = currentPrice * 0.8;
      const maxPrice = currentPrice * 1.5;
      
      return Math.max(minPrice, Math.min(optimalPrice, maxPrice));
      
    } catch (error) {
      logger.error('Error calculating optimal gas price:', error);
      return currentPrice;
    }
  }

  /**
   * Calculate optimal gas limit for a trade
   */
  private async calculateOptimalGasLimit(trade: any, network: string): Promise<number> {
    try {
      // Get base gas limit from trade
      const baseGasLimit = trade.gasEstimate?.totalGas || 500000;
      
      // Get cached gas limit for similar operations
      const cacheKey = `${network}_${trade.tokenPair?.baseToken}_${trade.tokenPair?.quoteToken}`;
      const cachedLimit = this.gasLimitCache.get(cacheKey);
      
      if (cachedLimit) {
        // Use cached limit with small buffer
        return Math.ceil(cachedLimit * 1.05);
      }
      
      // Calculate based on trade complexity
      let gasLimit = baseGasLimit;
      
      // Adjust based on token pair complexity
      if (trade.tokenPair?.baseToken === 'WETH' || trade.tokenPair?.quoteToken === 'WETH') {
        gasLimit *= 1.1; // WETH operations require more gas
      }
      
      // Adjust based on exchange complexity
      if (trade.buyExchange?.type === 'DEX') {
        gasLimit *= 1.05; // DEX operations may require more gas
      }
      
      // Adjust based on network
      const networkMultipliers: Record<string, number> = {
        'ethereum': 1.0,
        'avalanche': 0.9,
        'polygon': 0.8,
        'arbitrum': 0.7,
        'optimism': 0.6
      };
      
      gasLimit *= networkMultipliers[network] || 1.0;
      
      // Cache the calculated limit
      this.gasLimitCache.set(cacheKey, gasLimit);
      
      return Math.ceil(gasLimit);
      
    } catch (error) {
      logger.error('Error calculating optimal gas limit:', error);
      return trade.gasEstimate?.totalGas || 500000;
    }
  }

  /**
   * Calculate priority fee based on network and congestion
   */
  private calculatePriorityFee(network: string, congestion: number): number {
    try {
      // Base priority fees for different networks
      const baseFees: Record<string, number> = {
        'ethereum': 2,
        'avalanche': 1,
        'polygon': 1,
        'arbitrum': 0.01,
        'optimism': 0.001
      };
      
      let priorityFee = baseFees[network] || 2;
      
      // Adjust based on congestion
      if (congestion > 0.8) {
        priorityFee *= 2; // High congestion - double priority fee
      } else if (congestion > 0.6) {
        priorityFee *= 1.5; // Medium congestion - increase priority fee
      } else if (congestion < 0.3) {
        priorityFee *= 0.5; // Low congestion - reduce priority fee
      }
      
      return priorityFee;
      
    } catch (error) {
      logger.error('Error calculating priority fee:', error);
      return 2; // Default fallback
    }
  }

  /**
   * Estimate gas for buy transaction
   */
  private estimateBuyGas(buyPrice: any): number {
    try {
      let gas = 21000; // Base gas for ETH transfer
      
      // Add gas for token operations
      if (buyPrice.baseToken !== 'ETH' && buyPrice.baseToken !== 'AVAX') {
        gas += 65000; // ERC-20 transfer gas
      }
      
      // Add gas for DEX operations
      if (buyPrice.exchange?.type === 'DEX') {
        gas += 150000; // DEX swap gas
      }
      
      // Add gas for complex operations
      if (buyPrice.exchange?.name?.includes('Uniswap')) {
        gas += 50000; // Uniswap specific gas
      }
      
      return gas;
      
    } catch (error) {
      logger.error('Error estimating buy gas:', error);
      return 250000; // Default fallback
    }
  }

  /**
   * Estimate gas for sell transaction
   */
  private estimateSellGas(sellPrice: any): number {
    try {
      let gas = 21000; // Base gas for ETH transfer
      
      // Add gas for token operations
      if (sellPrice.baseToken !== 'ETH' && sellPrice.baseToken !== 'AVAX') {
        gas += 65000; // ERC-20 transfer gas
      }
      
      // Add gas for DEX operations
      if (sellPrice.exchange?.type === 'DEX') {
        gas += 150000; // DEX swap gas
      }
      
      // Add gas for complex operations
      if (sellPrice.exchange?.name?.includes('Uniswap')) {
        gas += 50000; // Uniswap specific gas
      }
      
      return gas;
      
    } catch (error) {
      logger.error('Error estimating sell gas:', error);
      return 250000; // Default fallback
    }
  }

  /**
   * Get optimization strategy based on network conditions
   */
  private getOptimizationStrategy(network: string, congestion: number): string {
    try {
      if (congestion > 0.8) {
        return 'high_congestion_aggressive';
      } else if (congestion > 0.6) {
        return 'medium_congestion_moderate';
      } else if (congestion < 0.3) {
        return 'low_congestion_conservative';
      } else {
        return 'balanced_optimization';
      }
    } catch (error) {
      logger.error('Error getting optimization strategy:', error);
      return 'balanced_optimization';
    }
  }

  /**
   * Generate gas optimization recommendations
   */
  private generateGasRecommendations(
    network: string, 
    congestion: number, 
    gasPrice: number, 
    gasLimit: number
  ): string[] {
    const recommendations: string[] = [];
    
    try {
      // Congestion-based recommendations
      if (congestion > 0.8) {
        recommendations.push('High network congestion detected - consider delaying non-urgent transactions');
        recommendations.push('Increase priority fee to ensure faster transaction processing');
      } else if (congestion < 0.3) {
        recommendations.push('Low network congestion - can use lower gas prices');
        recommendations.push('Consider batching multiple transactions');
      }
      
      // Network-specific recommendations
      if (network === 'ethereum') {
        recommendations.push('Ethereum mainnet - use EIP-1559 fee structure for optimal pricing');
        recommendations.push('Monitor base fee trends for better timing');
      } else if (network === 'avalanche') {
        recommendations.push('Avalanche C-Chain - gas prices are typically stable');
        recommendations.push('Consider using native AVAX for gas fees');
      }
      
      // Gas limit recommendations
      if (gasLimit > 500000) {
        recommendations.push('High gas limit detected - review transaction complexity');
        recommendations.push('Consider splitting complex operations into multiple transactions');
      }
      
      // General recommendations
      recommendations.push('Monitor gas price trends for optimal execution timing');
      recommendations.push('Use gas estimation tools for accurate limit calculation');
      
    } catch (error) {
      logger.error('Error generating gas recommendations:', error);
      recommendations.push('Unable to generate specific recommendations');
    }
    
    return recommendations;
  }

  /**
   * Store optimization result
   */
  private storeOptimizationResult(tradeId: string, result: GasOptimizationResult): void {
    try {
      if (!this.optimizationHistory.has(tradeId)) {
        this.optimizationHistory.set(tradeId, []);
      }
      
      this.optimizationHistory.get(tradeId)!.push(result);
      
      // Keep only last 100 optimizations per trade
      const tradeOptimizations = this.optimizationHistory.get(tradeId)!;
      if (tradeOptimizations.length > 100) {
        tradeOptimizations.splice(0, tradeOptimizations.length - 100);
      }
      
      // Save to database
      this.database.saveGasOptimizationResult(result).catch(error => {
        logger.error('Error saving gas optimization result to database:', error);
      });
      
    } catch (error) {
      logger.error('Error storing gas optimization result:', error);
    }
  }

  /**
   * Get network from trade
   */
  private getNetworkFromTrade(trade: any): string {
    try {
      // Extract network from trade data
      if (trade.buyExchange?.network) {
        return trade.buyExchange.network.toLowerCase();
      }
      
      if (trade.tokenPair?.baseToken === 'AVAX') {
        return 'avalanche';
      }
      
      return 'ethereum'; // Default to Ethereum
      
    } catch (error) {
      logger.error('Error getting network from trade:', error);
      return 'ethereum';
    }
  }

  /**
   * Get network from price data
   */
  private getNetworkFromPrice(price: any): string {
    try {
      // Extract network from price data
      if (price.exchange?.network) {
        return price.exchange.network.toLowerCase();
      }
      
      if (price.baseToken === 'AVAX') {
        return 'avalanche';
      }
      
      return 'ethereum'; // Default to Ethereum
      
    } catch (error) {
      logger.error('Error getting network from price:', error);
      return 'ethereum';
    }
  }

  /**
   * Update gas price for a network
   */
  updateGasPrice(network: string, gasPrice: number): void {
    try {
      if (!this.gasPriceHistory.has(network)) {
        this.gasPriceHistory.set(network, []);
      }
      
      this.gasPriceHistory.get(network)!.push(gasPrice);
      
      // Keep only last 1000 gas prices
      const prices = this.gasPriceHistory.get(network)!;
      if (prices.length > 1000) {
        prices.splice(0, prices.length - 1000);
      }
      
      // Emit gas price update
      this.emit('gasPriceUpdated', { network, gasPrice });
      
    } catch (error) {
      logger.error(`Error updating gas price for ${network}:`, error);
    }
  }

  /**
   * Update network congestion
   */
  updateNetworkCongestion(network: string, congestion: number): void {
    try {
      this.networkCongestion.set(network, congestion);
      
      // Emit congestion update
      this.emit('congestionUpdated', { network, congestion });
      
    } catch (error) {
      logger.error(`Error updating network congestion for ${network}:`, error);
    }
  }

  /**
   * Get gas price statistics for a network
   */
  getGasPriceStats(network: string): any {
    try {
      const prices = this.gasPriceHistory.get(network) || [];
      
      if (prices.length === 0) {
        return {
          network,
          currentPrice: 0,
          averagePrice: 0,
          minPrice: 0,
          maxPrice: 0,
          priceCount: 0
        };
      }
      
      const currentPrice = prices[prices.length - 1];
      const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      
      return {
        network,
        currentPrice,
        averagePrice: averagePrice.toFixed(2),
        minPrice,
        maxPrice,
        priceCount: prices.length
      };
      
    } catch (error) {
      logger.error(`Error getting gas price stats for ${network}:`, error);
      return {
        network,
        currentPrice: 0,
        averagePrice: 0,
        minPrice: 0,
        maxPrice: 0,
        priceCount: 0
      };
    }
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      gasPriceHistorySize: this.gasPriceHistory.size,
      networkCongestionSize: this.networkCongestion.size,
      gasLimitCacheSize: this.gasLimitCache.size,
      optimizationHistorySize: this.optimizationHistory.size,
      networks: Array.from(this.gasPriceHistory.keys())
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Clear caches
      this.gasPriceHistory.clear();
      this.networkCongestion.clear();
      this.gasLimitCache.clear();
      this.optimizationHistory.clear();
      
      logger.info('Gas optimization service cleaned up');
      
    } catch (error) {
      logger.error('Error cleaning up gas optimization service:', error);
    }
  }
}
