import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { 
  ArbitrageOpportunity, 
  OptimizationResult, 
  OptimizationFactor 
} from '@/types/arbitrage';
import { DatabaseService } from './DatabaseService';
import { MetricsService } from './MetricsService';

export class ProfitOptimizationService extends EventEmitter {
  private database: DatabaseService;
  private metrics: MetricsService;
  private optimizationHistory: Map<string, OptimizationResult[]> = new Map();
  private marketConditions: Map<string, string> = new Map();
  private volatilityCache: Map<string, number> = new Map();

  constructor(database: DatabaseService, metrics: MetricsService) {
    super();
    
    this.database = database;
    this.metrics = metrics;
  }

  /**
   * Initialize profit optimization service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing profit optimization service...');
      
      // Load historical optimization data
      await this.loadOptimizationHistory();
      
      // Initialize market condition monitoring
      await this.initializeMarketMonitoring();
      
      logger.info('Profit optimization service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize profit optimization service:', error);
      throw error;
    }
  }

  /**
   * Load optimization history from database
   */
  private async loadOptimizationHistory(): Promise<void> {
    try {
      // This would load historical optimization results
      // For now, initialize with empty data
      logger.info('Optimization history loaded');
      
    } catch (error) {
      logger.error('Error loading optimization history:', error);
    }
  }

  /**
   * Initialize market condition monitoring
   */
  private async initializeMarketMonitoring(): Promise<void> {
    try {
      // Initialize default market conditions
      const defaultConditions = {
        'ETH': 'neutral',
        'AVAX': 'neutral',
        'USDC': 'stable',
        'WETH': 'neutral'
      };

      Object.entries(defaultConditions).forEach(([token, condition]) => {
        this.marketConditions.set(token, condition);
      });

      // Initialize volatility cache
      const defaultVolatility = {
        'ETH': 25,
        'AVAX': 35,
        'USDC': 5,
        'WETH': 25
      };

      Object.entries(defaultVolatility).forEach(([token, volatility]) => {
        this.volatilityCache.set(token, volatility);
      });

      logger.info('Market condition monitoring initialized');
      
    } catch (error) {
      logger.error('Error initializing market monitoring:', error);
    }
  }

  /**
   * Optimize trade size for maximum profit
   */
  async optimizeTradeSize(
    maxSize: number,
    profitPercentage: number,
    buyPrice: any,
    sellPrice: any
  ): Promise<number> {
    try {
      logger.info(`Optimizing trade size for ${profitPercentage.toFixed(2)}% profit opportunity`);
      
      // Calculate base optimization
      const baseOptimization = this.calculateBaseOptimization(maxSize, profitPercentage);
      
      // Apply market condition adjustments
      const marketAdjusted = this.applyMarketAdjustments(baseOptimization, buyPrice, sellPrice);
      
      // Apply volatility adjustments
      const volatilityAdjusted = this.applyVolatilityAdjustments(marketAdjusted, buyPrice, sellPrice);
      
      // Apply liquidity adjustments
      const liquidityAdjusted = this.applyLiquidityAdjustments(volatilityAdjusted, buyPrice, sellPrice);
      
      // Apply timing adjustments
      const timingAdjusted = this.applyTimingAdjustments(liquidityAdjusted, buyPrice, sellPrice);
      
      // Ensure final size is within bounds
      const finalSize = Math.max(
        parseFloat(process.env.MIN_TRADE_SIZE_USD || '100'),
        Math.min(timingAdjusted, maxSize)
      );
      
      // Calculate optimization improvement
      const improvement = ((finalSize - baseOptimization) / baseOptimization) * 100;
      
      // Create optimization result
      const optimizationResult: OptimizationResult = {
        originalSize: maxSize,
        optimizedSize: finalSize,
        expectedProfit: maxSize * (profitPercentage / 100),
        optimizedProfit: finalSize * (profitPercentage / 100),
        improvement,
        factors: this.generateOptimizationFactors(maxSize, finalSize, buyPrice, sellPrice)
      };
      
      // Store optimization result
      this.storeOptimizationResult(optimizationResult);
      
      // Record metrics
      this.metrics.recordOptimizationResult(optimizationResult);
      
      logger.info(`Trade size optimized: ${maxSize} → ${finalSize} (${improvement.toFixed(2)}% improvement)`);
      
      return finalSize;
      
    } catch (error) {
      logger.error('Error optimizing trade size:', error);
      // Return original size on error
      return maxSize;
    }
  }

  /**
   * Calculate base optimization
   */
  private calculateBaseOptimization(maxSize: number, profitPercentage: number): number {
    try {
      // Base optimization considers profit percentage and risk
      let optimizedSize = maxSize;
      
      // Adjust based on profit percentage
      if (profitPercentage > 5) {
        // High profit opportunity - increase size
        optimizedSize *= 1.2;
      } else if (profitPercentage > 2) {
        // Medium profit opportunity - moderate increase
        optimizedSize *= 1.1;
      } else if (profitPercentage < 1) {
        // Low profit opportunity - reduce size
        optimizedSize *= 0.8;
      }
      
      // Apply risk-based adjustments
      const riskMultiplier = this.calculateRiskMultiplier(profitPercentage);
      optimizedSize *= riskMultiplier;
      
      return optimizedSize;
      
    } catch (error) {
      logger.error('Error calculating base optimization:', error);
      return maxSize;
    }
  }

  /**
   * Calculate risk multiplier based on profit percentage
   */
  private calculateRiskMultiplier(profitPercentage: number): number {
    try {
      // Higher profit = higher risk tolerance
      if (profitPercentage > 10) {
        return 1.3; // 30% increase
      } else if (profitPercentage > 5) {
        return 1.2; // 20% increase
      } else if (profitPercentage > 2) {
        return 1.1; // 10% increase
      } else if (profitPercentage < 0.5) {
        return 0.7; // 30% decrease
      } else {
        return 1.0; // No change
      }
    } catch (error) {
      logger.error('Error calculating risk multiplier:', error);
      return 1.0;
    }
  }

  /**
   * Apply market condition adjustments
   */
  private applyMarketAdjustments(size: number, buyPrice: any, sellPrice: any): number {
    try {
      let adjustedSize = size;
      
      // Get market conditions for the base token
      const baseToken = buyPrice.baseToken || 'ETH';
      const marketCondition = this.marketConditions.get(baseToken) || 'neutral';
      
      switch (marketCondition) {
        case 'bull':
          // Bull market - increase size
          adjustedSize *= 1.15;
          break;
        case 'bear':
          // Bear market - decrease size
          adjustedSize *= 0.85;
          break;
        case 'volatile':
          // Volatile market - decrease size
          adjustedSize *= 0.9;
          break;
        case 'stable':
          // Stable market - moderate increase
          adjustedSize *= 1.05;
          break;
        default:
          // Neutral market - no change
          break;
      }
      
      return adjustedSize;
      
    } catch (error) {
      logger.error('Error applying market adjustments:', error);
      return size;
    }
  }

  /**
   * Apply volatility adjustments
   */
  private applyVolatilityAdjustments(size: number, buyPrice: any, sellPrice: any): number {
    try {
      let adjustedSize = size;
      
      const baseToken = buyPrice.baseToken || 'ETH';
      const volatility = this.volatilityCache.get(baseToken) || 25;
      
      // High volatility reduces optimal trade size
      if (volatility > 50) {
        adjustedSize *= 0.7; // 30% reduction
      } else if (volatility > 30) {
        adjustedSize *= 0.85; // 15% reduction
      } else if (volatility < 15) {
        adjustedSize *= 1.1; // 10% increase
      }
      
      return adjustedSize;
      
    } catch (error) {
      logger.error('Error applying volatility adjustments:', error);
      return size;
    }
  }

  /**
   * Apply liquidity adjustments
   */
  private applyLiquidityAdjustments(size: number, buyPrice: any, sellPrice: any): number {
    try {
      let adjustedSize = size;
      
      // Get liquidity information
      const buyLiquidity = buyPrice.liquidity || 100000;
      const sellLiquidity = sellPrice.liquidity || 100000;
      const minLiquidity = Math.min(buyLiquidity, sellLiquidity);
      
      // Adjust based on liquidity relative to trade size
      const liquidityRatio = size / minLiquidity;
      
      if (liquidityRatio > 0.1) {
        // Trade size > 10% of liquidity - reduce size
        adjustedSize *= 0.8;
      } else if (liquidityRatio > 0.05) {
        // Trade size > 5% of liquidity - moderate reduction
        adjustedSize *= 0.9;
      } else if (liquidityRatio < 0.01) {
        // Trade size < 1% of liquidity - can increase size
        adjustedSize *= 1.1;
      }
      
      return adjustedSize;
      
    } catch (error) {
      logger.error('Error applying liquidity adjustments:', error);
      return size;
    }
  }

  /**
   * Apply timing adjustments
   */
  private applyTimingAdjustments(size: number, buyPrice: any, sellPrice: any): number {
    try {
      let adjustedSize = size;
      
      // Get current time
      const now = new Date();
      const hour = now.getUTCHours();
      
      // Adjust based on market hours
      if (hour >= 13 && hour <= 17) {
        // US market hours - increase size
        adjustedSize *= 1.05;
      } else if (hour >= 2 && hour <= 6) {
        // Asian market hours - moderate increase
        adjustedSize *= 1.02;
      } else if (hour >= 22 || hour <= 2) {
        // Low activity hours - decrease size
        adjustedSize *= 0.95;
      }
      
      // Adjust based on day of week
      const dayOfWeek = now.getUTCDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Weekend - decrease size
        adjustedSize *= 0.9;
      }
      
      return adjustedSize;
      
    } catch (error) {
      logger.error('Error applying timing adjustments:', error);
      return size;
    }
  }

  /**
   * Generate optimization factors
   */
  private generateOptimizationFactors(
    originalSize: number,
    optimizedSize: number,
    buyPrice: any,
    sellPrice: any
  ): OptimizationFactor[] {
    const factors: OptimizationFactor[] = [];
    
    try {
      // Market condition factor
      const baseToken = buyPrice.baseToken || 'ETH';
      const marketCondition = this.marketConditions.get(baseToken) || 'neutral';
      
      factors.push({
        type: 'liquidity',
        impact: Math.abs(optimizedSize - originalSize) / originalSize,
        description: `Market condition: ${marketCondition}`,
        recommendation: this.getMarketRecommendation(marketCondition)
      });
      
      // Volatility factor
      const volatility = this.volatilityCache.get(baseToken) || 25;
      factors.push({
        type: 'volatility',
        impact: volatility > 30 ? 0.15 : volatility < 15 ? -0.1 : 0,
        description: `Volatility: ${volatility}%`,
        recommendation: this.getVolatilityRecommendation(volatility)
      });
      
      // Liquidity factor
      const buyLiquidity = buyPrice.liquidity || 100000;
      const sellLiquidity = sellPrice.liquidity || 100000;
      const minLiquidity = Math.min(buyLiquidity, sellLiquidity);
      
      factors.push({
        type: 'liquidity',
        impact: (originalSize / minLiquidity) > 0.1 ? 0.2 : 0,
        description: `Min liquidity: $${minLiquidity.toLocaleString()}`,
        recommendation: this.getLiquidityRecommendation(originalSize, minLiquidity)
      });
      
      // Timing factor
      const now = new Date();
      const hour = now.getUTCHours();
      const isMarketHours = hour >= 13 && hour <= 17;
      
      factors.push({
        type: 'timing',
        impact: isMarketHours ? -0.05 : 0.05,
        description: `Market hours: ${isMarketHours ? 'Yes' : 'No'}`,
        recommendation: isMarketHours ? 'Consider larger size during market hours' : 'Reduce size during off-hours'
      });
      
    } catch (error) {
      logger.error('Error generating optimization factors:', error);
    }
    
    return factors;
  }

  /**
   * Get market condition recommendation
   */
  private getMarketRecommendation(condition: string): string {
    switch (condition) {
      case 'bull':
        return 'Bull market - consider increasing position size';
      case 'bear':
        return 'Bear market - reduce position size and increase caution';
      case 'volatile':
        return 'High volatility - reduce position size and monitor closely';
      case 'stable':
        return 'Stable market - optimal conditions for arbitrage';
      default:
        return 'Neutral market - standard position sizing';
    }
  }

  /**
   * Get volatility recommendation
   */
  private getVolatilityRecommendation(volatility: number): string {
    if (volatility > 50) {
      return 'Extreme volatility - significantly reduce position size';
    } else if (volatility > 30) {
      return 'High volatility - reduce position size';
    } else if (volatility < 15) {
      return 'Low volatility - can increase position size';
    } else {
      return 'Normal volatility - standard position sizing';
    }
  }

  /**
   * Get liquidity recommendation
   */
  private getLiquidityRecommendation(tradeSize: number, liquidity: number): string {
    const ratio = tradeSize / liquidity;
    
    if (ratio > 0.1) {
      return 'Trade size too large relative to liquidity - reduce size';
    } else if (ratio > 0.05) {
      return 'Trade size approaching liquidity limits - moderate size';
    } else {
      return 'Sufficient liquidity available - optimal size';
    }
  }

  /**
   * Store optimization result
   */
  private storeOptimizationResult(result: OptimizationResult): void {
    try {
      const key = `optimization_${Date.now()}`;
      this.optimizationHistory.set(key, [result]);
      
      // Keep only last 1000 optimizations
      if (this.optimizationHistory.size > 1000) {
        const firstKey = this.optimizationHistory.keys().next().value;
        this.optimizationHistory.delete(firstKey);
      }
      
      // Save to database
      this.database.saveOptimizationResult(result).catch(error => {
        logger.error('Error saving optimization result to database:', error);
      });
      
    } catch (error) {
      logger.error('Error storing optimization result:', error);
    }
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): any {
    try {
      const results = Array.from(this.optimizationHistory.values()).flat();
      
      if (results.length === 0) {
        return {
          totalOptimizations: 0,
          averageImprovement: 0,
          bestImprovement: 0,
          worstImprovement: 0
        };
      }
      
      const improvements = results.map(r => r.improvement);
      const totalImprovement = improvements.reduce((sum, imp) => sum + imp, 0);
      const averageImprovement = totalImprovement / improvements.length;
      const bestImprovement = Math.max(...improvements);
      const worstImprovement = Math.min(...improvements);
      
      return {
        totalOptimizations: results.length,
        averageImprovement: averageImprovement.toFixed(2),
        bestImprovement: bestImprovement.toFixed(2),
        worstImprovement: worstImprovement.toFixed(2),
        recentOptimizations: results.slice(-10)
      };
      
    } catch (error) {
      logger.error('Error getting optimization stats:', error);
      return {
        totalOptimizations: 0,
        averageImprovement: 0,
        bestImprovement: 0,
        worstImprovement: 0
      };
    }
  }

  /**
   * Update market conditions
   */
  updateMarketConditions(token: string, condition: string): void {
    try {
      this.marketConditions.set(token, condition);
      logger.info(`Updated market condition for ${token}: ${condition}`);
      
      // Emit market condition update
      this.emit('marketConditionUpdated', { token, condition });
      
    } catch (error) {
      logger.error(`Error updating market condition for ${token}:`, error);
    }
  }

  /**
   * Update volatility for a token
   */
  updateVolatility(token: string, volatility: number): void {
    try {
      this.volatilityCache.set(token, volatility);
      logger.info(`Updated volatility for ${token}: ${volatility}%`);
      
      // Emit volatility update
      this.emit('volatilityUpdated', { token, volatility });
      
    } catch (error) {
      logger.error(`Error updating volatility for ${token}:`, error);
    }
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      optimizationHistorySize: this.optimizationHistory.size,
      marketConditionsSize: this.marketConditions.size,
      volatilityCacheSize: this.volatilityCache.size,
      stats: this.getOptimizationStats()
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Clear caches
      this.optimizationHistory.clear();
      this.marketConditions.clear();
      this.volatilityCache.clear();
      
      logger.info('Profit optimization service cleaned up');
      
    } catch (error) {
      logger.error('Error cleaning up profit optimization service:', error);
    }
  }
}
