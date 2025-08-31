import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { logger } from '@/utils/logger';
import { ArbitrageOpportunity, TokenPair, Exchange, TradeResult, ProfitCalculation } from '@/types/arbitrage';
import { PriceMonitoringService } from './PriceMonitoringService';
import { TradeExecutionService } from './TradeExecutionService';
import { RiskManagementService } from './RiskManagementService';
import { ProfitOptimizationService } from './ProfitOptimizationService';
import { GasOptimizationService } from './GasOptimizationService';
import { MEVProtectionService } from './MEVProtectionService';
import { DatabaseService } from './DatabaseService';
import { NotificationService } from './NotificationService';
import { MetricsService } from './MetricsService';

export class ArbitrageEngine extends EventEmitter {
  private priceMonitoring: PriceMonitoringService;
  private tradeExecution: TradeExecutionService;
  private riskManagement: RiskManagementService;
  private profitOptimization: ProfitOptimizationService;
  private gasOptimization: GasOptimizationService;
  private mevProtection: MEVProtectionService;
  private database: DatabaseService;
  private notifications: NotificationService;
  private metrics: MetricsService;

  private isRunning: boolean = false;
  private opportunities: Map<string, ArbitrageOpportunity> = new Map();
  private activeTrades: Map<string, any> = new Map();
  private profitThreshold: number;
  private maxTradeSize: number;
  private minTradeSize: number;
  private maxConcurrentTrades: number;
  private slippageTolerance: number;

  constructor(
    priceMonitoring: PriceMonitoringService,
    tradeExecution: TradeExecutionService,
    riskManagement: RiskManagementService,
    profitOptimization: ProfitOptimizationService,
    gasOptimization: GasOptimizationService,
    mevProtection: MEVProtectionService,
    database: DatabaseService,
    notifications: NotificationService,
    metrics: MetricsService
  ) {
    super();
    
    this.priceMonitoring = priceMonitoring;
    this.tradeExecution = tradeExecution;
    this.riskManagement = riskManagement;
    this.profitOptimization = profitOptimization;
    this.gasOptimization = gasOptimization;
    this.mevProtection = mevProtection;
    this.database = database;
    this.notifications = notifications;
    this.metrics = metrics;

    // Load configuration from environment
    this.profitThreshold = parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.5');
    this.maxTradeSize = parseFloat(process.env.MAX_TRADE_SIZE_USD || '10000');
    this.minTradeSize = parseFloat(process.env.MIN_TRADE_SIZE_USD || '100');
    this.maxConcurrentTrades = parseInt(process.env.MAX_CONCURRENT_TRADES || '5');
    this.slippageTolerance = parseFloat(process.env.SLIPPAGE_TOLERANCE || '0.5');

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for price updates
    this.priceMonitoring.on('pricesUpdated', this.handlePriceUpdate.bind(this));
    
    // Listen for trade completion
    this.tradeExecution.on('tradeCompleted', this.handleTradeCompleted.bind(this));
    this.tradeExecution.on('tradeFailed', this.handleTradeFailed.bind(this));
    
    // Listen for risk alerts
    this.riskManagement.on('riskAlert', this.handleRiskAlert.bind(this));
  }

  /**
   * Start the arbitrage engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Arbitrage engine is already running');
      return;
    }

    try {
      logger.info('Starting arbitrage engine...');
      
      // Initialize all services
      await this.initializeServices();
      
      // Start monitoring
      await this.priceMonitoring.start();
      
      this.isRunning = true;
      logger.info('Arbitrage engine started successfully');
      
      this.emit('engineStarted');
      
    } catch (error) {
      logger.error('Failed to start arbitrage engine:', error);
      throw error;
    }
  }

  /**
   * Stop the arbitrage engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Arbitrage engine is not running');
      return;
    }

    try {
      logger.info('Stopping arbitrage engine...');
      
      // Stop price monitoring
      await this.priceMonitoring.stop();
      
      // Cancel all active trades
      await this.cancelAllActiveTrades();
      
      this.isRunning = false;
      logger.info('Arbitrage engine stopped successfully');
      
      this.emit('engineStopped');
      
    } catch (error) {
      logger.error('Failed to stop arbitrage engine:', error);
      throw error;
    }
  }

  /**
   * Initialize all required services
   */
  private async initializeServices(): Promise<void> {
    try {
      await this.database.connect();
      await this.riskManagement.initialize();
      await this.profitOptimization.initialize();
      await this.gasOptimization.initialize();
      await this.mevProtection.initialize();
      
      logger.info('All arbitrage services initialized');
    } catch (error) {
      logger.error('Failed to initialize arbitrage services:', error);
      throw error;
    }
  }

  /**
   * Handle price updates and detect opportunities
   */
  private async handlePriceUpdate(prices: any[]): Promise<void> {
    try {
      // Detect arbitrage opportunities
      const opportunities = await this.detectArbitrageOpportunities(prices);
      
      // Filter opportunities based on profit threshold
      const profitableOpportunities = opportunities.filter(
        opp => opp.expectedProfit.percentage >= this.profitThreshold
      );

      // Update opportunities map
      profitableOpportunities.forEach(opp => {
        this.opportunities.set(opp.id, opp);
      });

      // Emit opportunities for real-time updates
      this.emit('opportunitiesDetected', profitableOpportunities);
      
      // Log metrics
      this.metrics.recordOpportunitiesDetected(profitableOpportunities.length);
      
      // Execute trades for high-priority opportunities
      await this.executeHighPriorityTrades(profitableOpportunities);
      
    } catch (error) {
      logger.error('Error handling price update:', error);
      this.metrics.recordError('price_update_handling', error);
    }
  }

  /**
   * Detect arbitrage opportunities from price data
   */
  private async detectArbitrageOpportunities(prices: any[]): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    
    try {
      // Group prices by token pair
      const priceMap = new Map<string, any[]>();
      prices.forEach(price => {
        const key = `${price.baseToken}-${price.quoteToken}`;
        if (!priceMap.has(key)) {
          priceMap.set(key, []);
        }
        priceMap.get(key)!.push(price);
      });

      // Analyze each token pair for arbitrage opportunities
      for (const [pairKey, pairPrices] of priceMap) {
        if (pairPrices.length < 2) continue;

        // Sort by price (lowest to highest)
        pairPrices.sort((a, b) => a.price - b.price);
        
        const lowestPrice = pairPrices[0];
        const highestPrice = pairPrices[pairPrices.length - 1];
        
        // Calculate potential profit
        const priceSpread = highestPrice.price - lowestPrice.price;
        const profitPercentage = (priceSpread / lowestPrice.price) * 100;
        
        if (profitPercentage > this.profitThreshold) {
          // Calculate optimal trade size
          const optimalSize = await this.calculateOptimalTradeSize(
            lowestPrice,
            highestPrice,
            profitPercentage
          );

          if (optimalSize > 0) {
            const opportunity: ArbitrageOpportunity = {
              id: this.generateOpportunityId(),
              tokenPair: {
                baseToken: lowestPrice.baseToken,
                quoteToken: lowestPrice.quoteToken,
                baseTokenAddress: lowestPrice.baseTokenAddress,
                quoteTokenAddress: lowestPrice.quoteTokenAddress
              },
              buyExchange: lowestPrice.exchange,
              sellExchange: highestPrice.exchange,
              buyPrice: lowestPrice.price,
              sellPrice: highestPrice.price,
              priceSpread,
              expectedProfit: {
                percentage: profitPercentage,
                absolute: priceSpread * optimalSize,
                usd: priceSpread * optimalSize * lowestPrice.price
              },
              optimalTradeSize: optimalSize,
              timestamp: new Date(),
              status: 'detected',
              riskScore: await this.riskManagement.calculateRiskScore(lowestPrice, highestPrice),
              gasEstimate: await this.gasOptimization.estimateGasCost(lowestPrice, highestPrice),
              mevRisk: await this.mevProtection.assessMEVRisk(lowestPrice, highestPrice)
            };

            opportunities.push(opportunity);
          }
        }
      }

      return opportunities;
      
    } catch (error) {
      logger.error('Error detecting arbitrage opportunities:', error);
      throw error;
    }
  }

  /**
   * Calculate optimal trade size considering various factors
   */
  private async calculateOptimalTradeSize(
    buyPrice: any,
    sellPrice: any,
    profitPercentage: number
  ): Promise<number> {
    try {
      // Get available liquidity
      const buyLiquidity = await this.getAvailableLiquidity(buyPrice.exchange, buyPrice.baseToken);
      const sellLiquidity = await this.getAvailableLiquidity(sellPrice.exchange, sellPrice.baseToken);
      
      // Get current balance
      const balance = await this.getAvailableBalance(buyPrice.baseToken);
      
      // Calculate maximum possible trade size
      const maxSize = Math.min(buyLiquidity, sellLiquidity, balance, this.maxTradeSize);
      
      if (maxSize < this.minTradeSize) {
        return 0; // Trade too small
      }

      // Apply profit optimization
      const optimizedSize = await this.profitOptimization.optimizeTradeSize(
        maxSize,
        profitPercentage,
        buyPrice,
        sellPrice
      );

      return Math.max(optimizedSize, this.minTradeSize);
      
    } catch (error) {
      logger.error('Error calculating optimal trade size:', error);
      return 0;
    }
  }

  /**
   * Execute high-priority trades
   */
  private async executeHighPriorityTrades(opportunities: ArbitrageOpportunity[]): Promise<void> {
    try {
      // Sort opportunities by profit potential and risk
      const sortedOpportunities = opportunities.sort((a, b) => {
        const aScore = (a.expectedProfit.percentage * 0.7) + ((1 - a.riskScore) * 0.3);
        const bScore = (b.expectedProfit.percentage * 0.7) + ((1 - b.riskScore) * 0.3);
        return bScore - aScore;
      });

      // Execute trades for top opportunities
      for (const opportunity of sortedOpportunities.slice(0, this.maxConcurrentTrades)) {
        if (this.activeTrades.size >= this.maxConcurrentTrades) {
          break; // Max concurrent trades reached
        }

        if (await this.shouldExecuteTrade(opportunity)) {
          await this.executeTrade(opportunity);
        }
      }
      
    } catch (error) {
      logger.error('Error executing high-priority trades:', error);
      this.metrics.recordError('trade_execution', error);
    }
  }

  /**
   * Determine if a trade should be executed
   */
  private async shouldExecuteTrade(opportunity: ArbitrageOpportunity): Promise<boolean> {
    try {
      // Check if we're already trading this pair
      const activePairTrades = Array.from(this.activeTrades.values()).filter(
        trade => trade.tokenPair.baseToken === opportunity.tokenPair.baseToken
      );
      
      if (activePairTrades.length > 0) {
        return false; // Already trading this pair
      }

      // Check risk management
      if (!await this.riskManagement.validateTrade(opportunity)) {
        logger.warn(`Trade rejected by risk management: ${opportunity.id}`);
        return false;
      }

      // Check MEV protection
      if (opportunity.mevRisk.level === 'high') {
        logger.warn(`Trade rejected due to high MEV risk: ${opportunity.id}`);
        return false;
      }

      // Check gas costs
      const gasCost = opportunity.gasEstimate.totalCost;
      const gasCostPercentage = (gasCost / opportunity.expectedProfit.usd) * 100;
      
      if (gasCostPercentage > 50) { // Gas cost > 50% of profit
        logger.warn(`Trade rejected due to high gas costs: ${opportunity.id}`);
        return false;
      }

      return true;
      
    } catch (error) {
      logger.error('Error checking if trade should execute:', error);
      return false;
    }
  }

  /**
   * Execute an arbitrage trade
   */
  private async executeTrade(opportunity: ArbitrageOpportunity): Promise<void> {
    try {
      logger.info(`Executing arbitrage trade: ${opportunity.id}`);
      
      // Update opportunity status
      opportunity.status = 'executing';
      this.opportunities.set(opportunity.id, opportunity);
      
      // Create trade record
      const tradeId = this.generateTradeId();
      const trade = {
        id: tradeId,
        opportunityId: opportunity.id,
        tokenPair: opportunity.tokenPair,
        buyExchange: opportunity.buyExchange,
        sellExchange: opportunity.sellExchange,
        buyPrice: opportunity.buyPrice,
        sellPrice: opportunity.sellPrice,
        tradeSize: opportunity.optimalTradeSize,
        expectedProfit: opportunity.expectedProfit,
        status: 'pending',
        timestamp: new Date(),
        gasEstimate: opportunity.gasEstimate
      };

      this.activeTrades.set(tradeId, trade);
      
      // Execute the trade
      const result = await this.tradeExecution.executeArbitrageTrade(trade);
      
      // Handle result
      if (result.success) {
        await this.handleSuccessfulTrade(trade, result);
      } else {
        await this.handleFailedTrade(trade, result);
      }
      
    } catch (error) {
      logger.error(`Error executing trade ${opportunity.id}:`, error);
      await this.handleFailedTrade(opportunity, { success: false, error: error.message });
    }
  }

  /**
   * Handle successful trade completion
   */
  private async handleSuccessfulTrade(trade: any, result: TradeResult): Promise<void> {
    try {
      logger.info(`Trade ${trade.id} completed successfully`);
      
      // Update trade status
      trade.status = 'completed';
      trade.actualProfit = result.actualProfit;
      trade.gasUsed = result.gasUsed;
      trade.transactionHash = result.transactionHash;
      trade.completionTime = new Date();
      
      // Remove from active trades
      this.activeTrades.delete(trade.id);
      
      // Update opportunity
      const opportunity = this.opportunities.get(trade.opportunityId);
      if (opportunity) {
        opportunity.status = 'completed';
        this.opportunities.set(opportunity.id, opportunity);
      }
      
      // Save to database
      await this.database.saveTrade(trade);
      
      // Record metrics
      this.metrics.recordSuccessfulTrade(trade);
      
      // Send notifications
      await this.notifications.sendTradeSuccessNotification(trade);
      
      // Emit event
      this.emit('tradeCompleted', trade);
      
    } catch (error) {
      logger.error('Error handling successful trade:', error);
    }
  }

  /**
   * Handle failed trade
   */
  private async handleFailedTrade(trade: any, result: any): Promise<void> {
    try {
      logger.warn(`Trade ${trade.id} failed: ${result.error}`);
      
      // Update trade status
      trade.status = 'failed';
      trade.error = result.error;
      trade.failureTime = new Date();
      
      // Remove from active trades
      this.activeTrades.delete(trade.id);
      
      // Update opportunity
      const opportunity = this.opportunities.get(trade.opportunityId);
      if (opportunity) {
        opportunity.status = 'failed';
        this.opportunities.set(opportunity.id, opportunity);
      }
      
      // Save to database
      await this.database.saveTrade(trade);
      
      // Record metrics
      this.metrics.recordFailedTrade(trade);
      
      // Send notifications
      await this.notifications.sendTradeFailureNotification(trade);
      
      // Emit event
      this.emit('tradeFailed', trade);
      
    } catch (error) {
      logger.error('Error handling failed trade:', error);
    }
  }

  /**
   * Cancel all active trades
   */
  private async cancelAllActiveTrades(): Promise<void> {
    try {
      logger.info('Cancelling all active trades...');
      
      for (const [tradeId, trade] of this.activeTrades) {
        await this.tradeExecution.cancelTrade(tradeId);
        this.activeTrades.delete(tradeId);
      }
      
      logger.info('All active trades cancelled');
      
    } catch (error) {
      logger.error('Error cancelling active trades:', error);
    }
  }

  /**
   * Get available liquidity for a token on an exchange
   */
  private async getAvailableLiquidity(exchange: Exchange, token: string): Promise<number> {
    try {
      // This would integrate with exchange APIs to get real liquidity data
      // For now, return a default value
      return 10000; // $10,000 default liquidity
    } catch (error) {
      logger.error(`Error getting liquidity for ${token} on ${exchange.name}:`, error);
      return 0;
    }
  }

  /**
   * Get available balance for a token
   */
  private async getAvailableBalance(token: string): Promise<number> {
    try {
      // This would integrate with wallet/balance services
      // For now, return a default value
      return 5000; // $5,000 default balance
    } catch (error) {
      logger.error(`Error getting balance for ${token}:`, error);
      return 0;
    }
  }

  /**
   * Generate unique opportunity ID
   */
  private generateOpportunityId(): string {
    return `opp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique trade ID
   */
  private generateTradeId(): string {
    return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current opportunities
   */
  getOpportunities(): ArbitrageOpportunity[] {
    return Array.from(this.opportunities.values());
  }

  /**
   * Get active trades
   */
  getActiveTrades(): any[] {
    return Array.from(this.activeTrades.values());
  }

  /**
   * Get engine status
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      opportunitiesCount: this.opportunities.size,
      activeTradesCount: this.activeTrades.size,
      profitThreshold: this.profitThreshold,
      maxTradeSize: this.maxTradeSize,
      maxConcurrentTrades: this.maxConcurrentTrades
    };
  }
}


