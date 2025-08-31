import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { 
  MetricsData, 
  PerformanceMetrics, 
  SystemMetrics,
  TradeMetrics 
} from '@/types/arbitrage';
import { DatabaseService } from './DatabaseService';

export class MetricsService extends EventEmitter {
  private database: DatabaseService;
  private metricsCache: Map<string, any> = new Map();
  private performanceMetrics: PerformanceMetrics;
  private systemMetrics: SystemMetrics;
  private tradeMetrics: TradeMetrics;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(database: DatabaseService) {
    super();
    
    this.database = database;
    
    // Initialize metrics structures
    this.performanceMetrics = {
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalProfit: 0,
      totalLoss: 0,
      averageProfit: 0,
      successRate: 0,
      totalVolume: 0,
      averageExecutionTime: 0,
      gasEfficiency: 0
    };

    this.systemMetrics = {
      uptime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      activeConnections: 0,
      databaseHealth: 'healthy',
      redisHealth: 'healthy',
      lastUpdate: new Date()
    };

    this.tradeMetrics = {
      opportunitiesDetected: 0,
      opportunitiesExecuted: 0,
      opportunitiesMissed: 0,
      averageOpportunityValue: 0,
      bestOpportunity: 0,
      worstOpportunity: 0,
      totalGasUsed: 0,
      averageGasCost: 0
    };
  }

  /**
   * Initialize metrics service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing metrics service...');
      
      // Load historical metrics from database
      await this.loadHistoricalMetrics();
      
      // Start metrics update loop
      this.startMetricsUpdateLoop();
      
      // Start system monitoring
      this.startSystemMonitoring();
      
      logger.info('Metrics service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize metrics service:', error);
      throw error;
    }
  }

  /**
   * Load historical metrics from database
   */
  private async loadHistoricalMetrics(): Promise<void> {
    try {
      // Load performance metrics
      const performanceData = await this.database.getSystemMetrics('performance', 24);
      if (performanceData.length > 0) {
        const latest = performanceData[0];
        this.performanceMetrics = {
          ...this.performanceMetrics,
          ...JSON.parse(latest.metric_value)
        };
      }

      // Load trade metrics
      const tradeData = await this.database.getSystemMetrics('trades', 24);
      if (tradeData.length > 0) {
        const latest = tradeData[0];
        this.tradeMetrics = {
          ...this.tradeMetrics,
          ...JSON.parse(latest.metric_value)
        };
      }

      logger.info('Historical metrics loaded successfully');
      
    } catch (error) {
      logger.error('Error loading historical metrics:', error);
    }
  }

  /**
   * Start metrics update loop
   */
  private startMetricsUpdateLoop(): void {
    this.updateInterval = setInterval(async () => {
      try {
        await this.updateMetrics();
      } catch (error) {
        logger.error('Error in metrics update loop:', error);
      }
    }, parseInt(process.env.METRICS_UPDATE_INTERVAL || '30000')); // 30 seconds
  }

  /**
   * Start system monitoring
   */
  private startSystemMonitoring(): void {
    // Monitor system resources every 10 seconds
    setInterval(() => {
      this.updateSystemMetrics();
    }, 10000);
  }

  /**
   * Update all metrics
   */
  private async updateMetrics(): Promise<void> {
    try {
      // Update performance metrics
      this.updatePerformanceMetrics();
      
      // Update trade metrics
      this.updateTradeMetrics();
      
      // Save metrics to database
      await this.saveMetrics();
      
      // Emit metrics update event
      this.emit('metricsUpdated', {
        performance: this.performanceMetrics,
        system: this.systemMetrics,
        trades: this.tradeMetrics
      });
      
    } catch (error) {
      logger.error('Error updating metrics:', error);
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    try {
      // Calculate success rate
      if (this.performanceMetrics.totalTrades > 0) {
        this.performanceMetrics.successRate = 
          (this.performanceMetrics.successfulTrades / this.performanceMetrics.totalTrades) * 100;
      }

      // Calculate average profit
      if (this.performanceMetrics.successfulTrades > 0) {
        this.performanceMetrics.averageProfit = 
          this.performanceMetrics.totalProfit / this.performanceMetrics.successfulTrades;
      }

      // Calculate gas efficiency
      if (this.tradeMetrics.totalGasUsed > 0) {
        this.performanceMetrics.gasEfficiency = 
          this.performanceMetrics.totalProfit / this.tradeMetrics.totalGasUsed;
      }

      this.performanceMetrics.lastUpdate = new Date();
      
    } catch (error) {
      logger.error('Error updating performance metrics:', error);
    }
  }

  /**
   * Update trade metrics
   */
  private updateTradeMetrics(): void {
    try {
      // Calculate average opportunity value
      if (this.tradeMetrics.opportunitiesDetected > 0) {
        this.tradeMetrics.averageOpportunityValue = 
          this.performanceMetrics.totalProfit / this.tradeMetrics.opportunitiesDetected;
      }

      // Calculate average gas cost
      if (this.tradeMetrics.opportunitiesExecuted > 0) {
        this.tradeMetrics.averageGasCost = 
          this.tradeMetrics.totalGasUsed / this.tradeMetrics.opportunitiesExecuted;
      }

      this.tradeMetrics.lastUpdate = new Date();
      
    } catch (error) {
      logger.error('Error updating trade metrics:', error);
    }
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    try {
      // Update uptime
      this.systemMetrics.uptime = process.uptime();

      // Update memory usage
      const memUsage = process.memoryUsage();
      this.systemMetrics.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB

      // Update CPU usage (simplified)
      this.systemMetrics.cpuUsage = this.getCPUUsage();

      // Update last update time
      this.systemMetrics.lastUpdate = new Date();
      
    } catch (error) {
      logger.error('Error updating system metrics:', error);
    }
  }

  /**
   * Get CPU usage (simplified implementation)
   */
  private getCPUUsage(): number {
    try {
      // This is a simplified CPU usage calculation
      // In production, you'd use a more sophisticated method
      const startUsage = process.cpuUsage();
      
      // Simulate some work
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const cpuPercent = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
        this.systemMetrics.cpuUsage = cpuPercent;
      }, 100);
      
      return this.systemMetrics.cpuUsage;
      
    } catch (error) {
      logger.error('Error getting CPU usage:', error);
      return 0;
    }
  }

  /**
   * Save metrics to database
   */
  private async saveMetrics(): Promise<void> {
    try {
      // Save performance metrics
      await this.database.saveSystemMetric(
        'performance',
        JSON.stringify(this.performanceMetrics),
        'json'
      );

      // Save trade metrics
      await this.database.saveSystemMetric(
        'trades',
        JSON.stringify(this.tradeMetrics),
        'json'
      );

      // Save system metrics
      await this.database.saveSystemMetric(
        'system',
        JSON.stringify(this.systemMetrics),
        'json'
      );

      logger.debug('Metrics saved to database');
      
    } catch (error) {
      logger.error('Error saving metrics to database:', error);
    }
  }

  /**
   * Record trade execution
   */
  recordTradeExecution(trade: any): void {
    try {
      this.performanceMetrics.totalTrades++;
      this.tradeMetrics.opportunitiesExecuted++;
      
      if (trade.status === 'completed') {
        this.performanceMetrics.successfulTrades++;
        
        if (trade.actualProfit?.usd) {
          this.performanceMetrics.totalProfit += trade.actualProfit.usd;
        }
      } else if (trade.status === 'failed') {
        this.performanceMetrics.failedTrades++;
        
        if (trade.actualProfit?.usd && trade.actualProfit.usd < 0) {
          this.performanceMetrics.totalLoss += Math.abs(trade.actualProfit.usd);
        }
      }

      // Update volume
      if (trade.buyAmount) {
        this.performanceMetrics.totalVolume += trade.buyAmount;
      }

      // Update gas metrics
      if (trade.gasUsed) {
        this.tradeMetrics.totalGasUsed += trade.gasUsed;
      }

      // Update execution time
      if (trade.executionTime) {
        const totalTime = this.performanceMetrics.averageExecutionTime * (this.performanceMetrics.totalTrades - 1);
        this.performanceMetrics.averageExecutionTime = (totalTime + trade.executionTime) / this.performanceMetrics.totalTrades;
      }

      logger.debug(`Trade execution recorded: ${trade.id}`);
      
    } catch (error) {
      logger.error('Error recording trade execution:', error);
    }
  }

  /**
   * Record opportunity detection
   */
  recordOpportunityDetection(opportunity: any): void {
    try {
      this.tradeMetrics.opportunitiesDetected++;
      
      // Update best/worst opportunity tracking
      if (opportunity.expectedProfit?.usd) {
        if (opportunity.expectedProfit.usd > this.tradeMetrics.bestOpportunity) {
          this.tradeMetrics.bestOpportunity = opportunity.expectedProfit.usd;
        }
        
        if (opportunity.expectedProfit.usd < this.tradeMetrics.worstOpportunity || 
            this.tradeMetrics.worstOpportunity === 0) {
          this.tradeMetrics.worstOpportunity = opportunity.expectedProfit.usd;
        }
      }

      logger.debug('Opportunity detection recorded');
      
    } catch (error) {
      logger.error('Error recording opportunity detection:', error);
    }
  }

  /**
   * Record missed opportunity
   */
  recordMissedOpportunity(opportunity: any): void {
    try {
      this.tradeMetrics.opportunitiesMissed++;
      
      logger.debug('Missed opportunity recorded');
      
    } catch (error) {
      logger.error('Error recording missed opportunity:', error);
    }
  }

  /**
   * Record risk assessment
   */
  recordRiskAssessment(assessment: any): void {
    try {
      // Store risk assessment in cache for analysis
      const key = `risk_${Date.now()}`;
      this.metricsCache.set(key, assessment);
      
      // Keep only last 1000 assessments
      if (this.metricsCache.size > 1000) {
        const firstKey = this.metricsCache.keys().next().value;
        this.metricsCache.delete(firstKey);
      }

      logger.debug('Risk assessment recorded');
      
    } catch (error) {
      logger.error('Error recording risk assessment:', error);
    }
  }

  /**
   * Record MEV risk
   */
  recordMEVRisk(mevRisk: any): void {
    try {
      // Store MEV risk in cache for analysis
      const key = `mev_${Date.now()}`;
      this.metricsCache.set(key, mevRisk);
      
      logger.debug('MEV risk recorded');
      
    } catch (error) {
      logger.error('Error recording MEV risk:', error);
    }
  }

  /**
   * Record MEV protection
   */
  recordMEVProtection(protection: any): void {
    try {
      // Store MEV protection in cache for analysis
      const key = `protection_${Date.now()}`;
      this.metricsCache.set(key, protection);
      
      logger.debug('MEV protection recorded');
      
    } catch (error) {
      logger.error('Error recording MEV protection:', error);
    }
  }

  /**
   * Record gas optimization
   */
  recordGasOptimization(optimization: any): void {
    try {
      // Store gas optimization in cache for analysis
      const key = `gas_${Date.now()}`;
      this.metricsCache.set(key, optimization);
      
      logger.debug('Gas optimization recorded');
      
    } catch (error) {
      logger.error('Error recording gas optimization:', error);
    }
  }

  /**
   * Record prices updated
   */
  recordPricesUpdated(count: number): void {
    try {
      // Store price update count in cache
      const key = `prices_${Date.now()}`;
      this.metricsCache.set(key, { count, timestamp: new Date() });
      
      logger.debug(`${count} prices updated recorded`);
      
    } catch (error) {
      logger.error('Error recording prices updated:', error);
    }
  }

  /**
   * Record opportunities detected
   */
  recordOpportunitiesDetected(count: number): void {
    try {
      // Store opportunities detected count in cache
      const key = `opportunities_${Date.now()}`;
      this.metricsCache.set(key, { count, timestamp: new Date() });
      
      logger.debug(`${count} opportunities detected recorded`);
      
    } catch (error) {
      logger.error('Error recording opportunities detected:', error);
    }
  }

  /**
   * Record optimization result
   */
  recordOptimizationResult(result: any): void {
    try {
      // Store optimization result in cache
      const key = `optimization_${Date.now()}`;
      this.metricsCache.set(key, result);
      
      logger.debug('Optimization result recorded');
      
    } catch (error) {
      logger.error('Error recording optimization result:', error);
    }
  }

  /**
   * Record error
   */
  recordError(errorType: string, error: any): void {
    try {
      // Store error in cache for analysis
      const key = `error_${Date.now()}`;
      this.metricsCache.set(key, {
        type: errorType,
        error: error.message || error.toString(),
        timestamp: new Date(),
        stack: error.stack
      });
      
      logger.debug(`Error recorded: ${errorType}`);
      
    } catch (err) {
      logger.error('Error recording error:', err);
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Get trade metrics
   */
  getTradeMetrics(): TradeMetrics {
    return { ...this.tradeMetrics };
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): MetricsData {
    return {
      performance: this.getPerformanceMetrics(),
      system: this.getSystemMetrics(),
      trades: this.getTradeMetrics(),
      timestamp: new Date()
    };
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): any {
    try {
      const summary = {
        performance: {
          successRate: `${this.performanceMetrics.successRate.toFixed(2)}%`,
          totalProfit: `$${this.performanceMetrics.totalProfit.toFixed(2)}`,
          totalLoss: `$${this.performanceMetrics.totalLoss.toFixed(2)}`,
          averageProfit: `$${this.performanceMetrics.averageProfit.toFixed(2)}`,
          totalVolume: `$${this.performanceMetrics.totalVolume.toFixed(2)}`,
          gasEfficiency: `${this.performanceMetrics.gasEfficiency.toFixed(4)}`
        },
        system: {
          uptime: `${Math.floor(this.systemMetrics.uptime / 3600)}h ${Math.floor((this.systemMetrics.uptime % 3600) / 60)}m`,
          memoryUsage: `${this.systemMetrics.memoryUsage.toFixed(2)} MB`,
          cpuUsage: `${this.systemMetrics.cpuUsage.toFixed(2)}%`,
          databaseHealth: this.systemMetrics.databaseHealth,
          redisHealth: this.systemMetrics.redisHealth
        },
        trades: {
          opportunitiesDetected: this.tradeMetrics.opportunitiesDetected,
          opportunitiesExecuted: this.tradeMetrics.opportunitiesExecuted,
          opportunitiesMissed: this.tradeMetrics.opportunitiesMissed,
          averageOpportunityValue: `$${this.tradeMetrics.averageOpportunityValue.toFixed(2)}`,
          bestOpportunity: `$${this.tradeMetrics.bestOpportunity.toFixed(2)}`,
          worstOpportunity: `$${this.tradeMetrics.worstOpportunity.toFixed(2)}`,
          averageGasCost: `${this.tradeMetrics.averageGasCost.toFixed(0)} gas`
        }
      };

      return summary;
      
    } catch (error) {
      logger.error('Error generating metrics summary:', error);
      return {};
    }
  }

  /**
   * Get metrics history
   */
  async getMetricsHistory(metricName: string, hours: number = 24): Promise<any[]> {
    try {
      return await this.database.getSystemMetrics(metricName, hours);
    } catch (error) {
      logger.error(`Error getting metrics history for ${metricName}:`, error);
      return [];
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    try {
      // Reset performance metrics
      this.performanceMetrics = {
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        totalProfit: 0,
        totalLoss: 0,
        averageProfit: 0,
        successRate: 0,
        totalVolume: 0,
        averageExecutionTime: 0,
        gasEfficiency: 0
      };

      // Reset trade metrics
      this.tradeMetrics = {
        opportunitiesDetected: 0,
        opportunitiesExecuted: 0,
        opportunitiesMissed: 0,
        averageOpportunityValue: 0,
        bestOpportunity: 0,
        worstOpportunity: 0,
        totalGasUsed: 0,
        averageGasCost: 0
      };

      // Clear cache
      this.metricsCache.clear();

      logger.info('Metrics reset successfully');
      
    } catch (error) {
      logger.error('Error resetting metrics:', error);
    }
  }

  /**
   * Update database health
   */
  updateDatabaseHealth(health: string): void {
    try {
      this.systemMetrics.databaseHealth = health;
      logger.debug(`Database health updated: ${health}`);
      
    } catch (error) {
      logger.error('Error updating database health:', error);
    }
  }

  /**
   * Update Redis health
   */
  updateRedisHealth(health: string): void {
    try {
      this.systemMetrics.redisHealth = health;
      logger.debug(`Redis health updated: ${health}`);
      
    } catch (error) {
      logger.error('Error updating Redis health:', error);
    }
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      isInitialized: true,
      updateInterval: process.env.METRICS_UPDATE_INTERVAL || '30000',
      metricsCacheSize: this.metricsCache.size,
      lastUpdate: this.systemMetrics.lastUpdate,
      uptime: this.systemMetrics.uptime
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Clear update interval
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }

      // Clear cache
      this.metricsCache.clear();

      // Save final metrics
      await this.saveMetrics();

      logger.info('Metrics service cleaned up');
      
    } catch (error) {
      logger.error('Error cleaning up metrics service:', error);
    }
  }
}
