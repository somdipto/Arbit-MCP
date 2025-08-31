import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { 
  ArbitrageOpportunity, 
  RiskAssessment, 
  RiskFactor, 
  RiskLimits,
  Trade
} from '@/types/arbitrage';
import { DatabaseService } from './DatabaseService';
import { MetricsService } from './MetricsService';

export class RiskManagementService extends EventEmitter {
  private database: DatabaseService;
  private metrics: MetricsService;
  private riskLimits: RiskLimits;
  private dailyLoss: number = 0;
  private dailyLossResetTime: Date;
  private positionCorrelations: Map<string, number> = new Map();
  private volatilityCache: Map<string, number> = new Map();

  constructor(database: DatabaseService, metrics: MetricsService) {
    super();
    
    this.database = database;
    this.metrics = metrics;
    
    // Initialize risk limits from environment
    this.riskLimits = {
      maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '5000'),
      maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '1000'),
      maxDrawdown: parseFloat(process.env.MAX_DRAWDOWN || '20'),
      correlationThreshold: parseFloat(process.env.CORRELATION_THRESHOLD || '0.8'),
      volatilityThreshold: parseFloat(process.env.VOLATILITY_THRESHOLD || '50'),
      minLiquidity: parseFloat(process.env.MIN_LIQUIDITY || '10000'),
      maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || '2.0')
    };

    // Set daily loss reset time (midnight UTC)
    this.dailyLossResetTime = new Date();
    this.dailyLossResetTime.setUTCHours(24, 0, 0, 0);

    // Start daily reset timer
    this.startDailyResetTimer();
  }

  /**
   * Start daily reset timer
   */
  private startDailyResetTimer(): void {
    const now = new Date();
    const timeUntilReset = this.dailyLossResetTime.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetDailyLoss();
      this.startDailyResetTimer(); // Schedule next reset
    }, timeUntilReset);
  }

  /**
   * Reset daily loss counter
   */
  private resetDailyLoss(): void {
    this.dailyLoss = 0;
    this.dailyLossResetTime.setUTCDate(this.dailyLossResetTime.getUTCDate() + 1);
    logger.info('Daily loss counter reset');
  }

  /**
   * Initialize risk management service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing risk management service...');
      
      // Load historical data for correlation analysis
      await this.loadHistoricalData();
      
      // Initialize volatility calculations
      await this.initializeVolatilityCache();
      
      logger.info('Risk management service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize risk management service:', error);
      throw error;
    }
  }

  /**
   * Load historical data for risk analysis
   */
  private async loadHistoricalData(): Promise<void> {
    try {
      // This would load historical trade data for correlation analysis
      // For now, initialize with empty data
      logger.info('Historical data loaded for risk analysis');
      
    } catch (error) {
      logger.error('Error loading historical data:', error);
    }
  }

  /**
   * Initialize volatility cache
   */
  private async initializeVolatilityCache(): Promise<void> {
    try {
      // This would calculate historical volatility for supported tokens
      // For now, initialize with default values
      const defaultVolatility = 25; // 25% default volatility
      
      ['ETH', 'AVAX', 'USDC', 'WETH'].forEach(token => {
        this.volatilityCache.set(token, defaultVolatility);
      });
      
      logger.info('Volatility cache initialized');
      
    } catch (error) {
      logger.error('Error initializing volatility cache:', error);
    }
  }

  /**
   * Validate a trade before execution
   */
  async validateTrade(opportunity: ArbitrageOpportunity): Promise<boolean> {
    try {
      logger.info(`Validating trade for opportunity ${opportunity.id}`);
      
      // Perform comprehensive risk assessment
      const assessment = await this.performRiskAssessment(opportunity);
      
      // Check if risk level is acceptable
      if (assessment.riskLevel === 'critical') {
        logger.warn(`Trade rejected due to critical risk level: ${opportunity.id}`);
        this.emit('riskAlert', assessment);
        return false;
      }
      
      // Check if risk level is high and requires manual approval
      if (assessment.riskLevel === 'high') {
        logger.warn(`High risk trade requires manual approval: ${opportunity.id}`);
        this.emit('riskAlert', assessment);
        // In production, this would trigger a manual approval workflow
        return false;
      }
      
      // Check daily loss limits
      if (!this.checkDailyLossLimit(opportunity)) {
        logger.warn(`Trade rejected due to daily loss limit: ${opportunity.id}`);
        return false;
      }
      
      // Check position size limits
      if (!this.checkPositionSizeLimit(opportunity)) {
        logger.warn(`Trade rejected due to position size limit: ${opportunity.id}`);
        return false;
      }
      
      // Check correlation limits
      if (!this.checkCorrelationLimit(opportunity)) {
        logger.warn(`Trade rejected due to correlation limit: ${opportunity.id}`);
        return false;
      }
      
      // Check liquidity requirements
      if (!this.checkLiquidityRequirement(opportunity)) {
        logger.warn(`Trade rejected due to insufficient liquidity: ${opportunity.id}`);
        return false;
      }
      
      logger.info(`Trade validation passed for opportunity ${opportunity.id}`);
      return true;
      
    } catch (error) {
      logger.error(`Error validating trade for opportunity ${opportunity.id}:`, error);
      return false;
    }
  }

  /**
   * Perform comprehensive risk assessment
   */
  async performRiskAssessment(opportunity: ArbitrageOpportunity): Promise<RiskAssessment> {
    try {
      const factors: RiskFactor[] = [];
      let overallRisk = 0;
      
      // Assess market risk
      const marketRisk = await this.assessMarketRisk(opportunity);
      factors.push(marketRisk);
      overallRisk += marketRisk.severity * 0.3;
      
      // Assess liquidity risk
      const liquidityRisk = this.assessLiquidityRisk(opportunity);
      factors.push(liquidityRisk);
      overallRisk += liquidityRisk.severity * 0.25;
      
      // Assess execution risk
      const executionRisk = this.assessExecutionRisk(opportunity);
      factors.push(executionRisk);
      overallRisk += executionRisk.severity * 0.25;
      
      // Assess regulatory risk
      const regulatoryRisk = this.assessRegulatoryRisk(opportunity);
      factors.push(regulatoryRisk);
      overallRisk += regulatoryRisk.severity * 0.2;
      
      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (overallRisk <= 0.3) {
        riskLevel = 'low';
      } else if (overallRisk <= 0.6) {
        riskLevel = 'medium';
      } else if (overallRisk <= 0.8) {
        riskLevel = 'high';
      } else {
        riskLevel = 'critical';
      }
      
      // Generate recommendations
      const recommendations = this.generateRiskRecommendations(factors, overallRisk);
      
      const assessment: RiskAssessment = {
        tradeId: opportunity.id,
        overallRisk,
        riskLevel,
        factors,
        recommendations,
        timestamp: new Date()
      };
      
      // Save assessment to database
      await this.database.saveRiskAssessment(assessment);
      
      // Record metrics
      this.metrics.recordRiskAssessment(assessment);
      
      return assessment;
      
    } catch (error) {
      logger.error('Error performing risk assessment:', error);
      throw error;
    }
  }

  /**
   * Assess market risk
   */
  private async assessMarketRisk(opportunity: ArbitrageOpportunity): Promise<RiskFactor> {
    try {
      let severity = 0;
      let description = '';
      
      // Check volatility
      const baseTokenVolatility = this.volatilityCache.get(opportunity.tokenPair.baseToken) || 25;
      if (baseTokenVolatility > this.riskLimits.volatilityThreshold) {
        severity += 0.4;
        description += `High volatility detected for ${opportunity.tokenPair.baseToken} (${baseTokenVolatility}%). `;
      }
      
      // Check price stability
      const priceChange = Math.abs(opportunity.sellPrice - opportunity.buyPrice) / opportunity.buyPrice;
      if (priceChange > 0.05) { // 5% price change threshold
        severity += 0.3;
        description += `Significant price change detected (${(priceChange * 100).toFixed(2)}%). `;
      }
      
      // Check market conditions
      const marketConditions = await this.getMarketConditions();
      if (marketConditions === 'bear' || marketConditions === 'volatile') {
        severity += 0.3;
        description += `Unfavorable market conditions (${marketConditions}). `;
      }
      
      return {
        type: 'volatility',
        severity: Math.min(severity, 1),
        description: description || 'Market conditions appear stable',
        impact: severity > 0.7 ? 'high' : severity > 0.4 ? 'medium' : 'low',
        mitigation: 'Consider reducing position size or waiting for better conditions'
      };
      
    } catch (error) {
      logger.error('Error assessing market risk:', error);
      return {
        type: 'volatility',
        severity: 0.5,
        description: 'Unable to assess market risk due to error',
        impact: 'medium',
        mitigation: 'Manual review required'
      };
    }
  }

  /**
   * Assess liquidity risk
   */
  private assessLiquidityRisk(opportunity: ArbitrageOpportunity): RiskFactor {
    try {
      let severity = 0;
      let description = '';
      
      // Check if liquidity meets minimum requirements
      const minLiquidity = this.riskLimits.minLiquidity;
      if (opportunity.optimalTradeSize > minLiquidity * 0.1) { // Trade size > 10% of min liquidity
        severity += 0.4;
        description += `Trade size (${opportunity.optimalTradeSize}) may impact liquidity. `;
      }
      
      // Check exchange liquidity
      const buyExchangeLiquidity = this.getExchangeLiquidity(opportunity.buyExchange);
      const sellExchangeLiquidity = this.getExchangeLiquidity(opportunity.sellExchange);
      
      if (opportunity.optimalTradeSize > buyExchangeLiquidity * 0.05) {
        severity += 0.3;
        description += `Trade size exceeds 5% of buy exchange liquidity. `;
      }
      
      if (opportunity.optimalTradeSize > sellExchangeLiquidity * 0.05) {
        severity += 0.3;
        description += `Trade size exceeds 5% of sell exchange liquidity. `;
      }
      
      return {
        type: 'liquidity',
        severity: Math.min(severity, 1),
        description: description || 'Sufficient liquidity available',
        impact: severity > 0.7 ? 'high' : severity > 0.4 ? 'medium' : 'low',
        mitigation: 'Reduce trade size or split into multiple smaller trades'
      };
      
    } catch (error) {
      logger.error('Error assessing liquidity risk:', error);
      return {
        type: 'liquidity',
        severity: 0.5,
        description: 'Unable to assess liquidity risk due to error',
        impact: 'medium',
        mitigation: 'Manual review required'
      };
    }
  }

  /**
   * Assess execution risk
   */
  private assessExecutionRisk(opportunity: ArbitrageOpportunity): RiskFactor {
    try {
      let severity = 0;
      let description = '';
      
      // Check gas costs relative to profit
      const gasCostPercentage = (opportunity.gasEstimate.totalCost / opportunity.expectedProfit.usd) * 100;
      if (gasCostPercentage > 30) {
        severity += 0.4;
        description += `High gas costs (${gasCostPercentage.toFixed(2)}% of profit). `;
      }
      
      // Check slippage risk
      const expectedSlippage = this.calculateExpectedSlippage(opportunity);
      if (expectedSlippage > this.riskLimits.maxSlippage) {
        severity += 0.3;
        description += `Expected slippage (${expectedSlippage.toFixed(2)}%) exceeds limit. `;
      }
      
      // Check execution timing
      const executionTime = this.estimateExecutionTime(opportunity);
      if (executionTime > 30000) { // 30 seconds
        severity += 0.3;
        description += `Long execution time expected (${executionTime}ms). `;
      }
      
      return {
        type: 'execution',
        severity: Math.min(severity, 1),
        description: description || 'Execution risk appears manageable',
        impact: severity > 0.7 ? 'high' : severity > 0.4 ? 'medium' : 'low',
        mitigation: 'Optimize gas settings and consider execution timing'
      };
      
    } catch (error) {
      logger.error('Error assessing execution risk:', error);
      return {
        type: 'execution',
        severity: 0.5,
        description: 'Unable to assess execution risk due to error',
        impact: 'medium',
        mitigation: 'Manual review required'
      };
    }
  }

  /**
   * Assess regulatory risk
   */
  private assessRegulatoryRisk(opportunity: ArbitrageOpportunity): RiskFactor {
    try {
      let severity = 0;
      let description = '';
      
      // Check if trading pair involves regulated tokens
      const regulatedTokens = ['USDC', 'USDT', 'DAI'];
      if (regulatedTokens.includes(opportunity.tokenPair.baseToken) || 
          regulatedTokens.includes(opportunity.tokenPair.quoteToken)) {
        severity += 0.2;
        description += 'Trading involves regulated stablecoins. ';
      }
      
      // Check jurisdiction compliance
      const jurisdiction = this.getTradingJurisdiction();
      if (jurisdiction === 'restricted') {
        severity += 0.4;
        description += 'Trading in restricted jurisdiction. ';
      }
      
      // Check if opportunity size requires reporting
      if (opportunity.expectedProfit.usd > 10000) { // $10,000 threshold
        severity += 0.3;
        description += 'Large profit may require regulatory reporting. ';
      }
      
      return {
        type: 'regulatory',
        severity: Math.min(severity, 1),
        description: description || 'Regulatory compliance appears satisfactory',
        impact: severity > 0.7 ? 'high' : severity > 0.4 ? 'medium' : 'low',
        mitigation: 'Consult legal counsel and ensure compliance with local regulations'
      };
      
    } catch (error) {
      logger.error('Error assessing regulatory risk:', error);
      return {
        type: 'regulatory',
        severity: 0.5,
        description: 'Unable to assess regulatory risk due to error',
        impact: 'medium',
        mitigation: 'Manual review required'
      };
    }
  }

  /**
   * Check daily loss limit
   */
  private checkDailyLossLimit(opportunity: ArbitrageOpportunity): boolean {
    // Check if we've exceeded daily loss limit
    if (this.dailyLoss >= this.riskLimits.maxDailyLoss) {
      return false;
    }
    
    // Check if this trade could exceed the limit
    const potentialLoss = opportunity.optimalTradeSize * 0.1; // Assume 10% max loss
    if (this.dailyLoss + potentialLoss > this.riskLimits.maxDailyLoss) {
      return false;
    }
    
    return true;
  }

  /**
   * Check position size limit
   */
  private checkPositionSizeLimit(opportunity: ArbitrageOpportunity): boolean {
    return opportunity.optimalTradeSize <= this.riskLimits.maxPositionSize;
  }

  /**
   * Check correlation limit
   */
  private checkCorrelationLimit(opportunity: ArbitrageOpportunity): boolean {
    const pairKey = `${opportunity.tokenPair.baseToken}_${opportunity.tokenPair.quoteToken}`;
    const correlation = this.positionCorrelations.get(pairKey) || 0;
    
    return correlation <= this.riskLimits.correlationThreshold;
  }

  /**
   * Check liquidity requirement
   */
  private checkLiquidityRequirement(opportunity: ArbitrageOpportunity): boolean {
    const buyLiquidity = this.getExchangeLiquidity(opportunity.buyExchange);
    const sellLiquidity = this.getExchangeLiquidity(opportunity.sellExchange);
    
    const minLiquidity = Math.min(buyLiquidity, sellLiquidity);
    return minLiquidity >= this.riskLimits.minLiquidity;
  }

  /**
   * Calculate risk score for an opportunity
   */
  async calculateRiskScore(buyPrice: any, sellPrice: any): Promise<number> {
    try {
      let riskScore = 0;
      
      // Price volatility risk
      const priceChange = Math.abs(sellPrice.price - buyPrice.price) / buyPrice.price;
      if (priceChange > 0.1) { // 10% price change
        riskScore += 0.3;
      }
      
      // Exchange reliability risk
      if (buyPrice.exchange === sellPrice.exchange) {
        riskScore += 0.2; // Same exchange reduces arbitrage opportunity
      }
      
      // Liquidity risk
      const liquidity = Math.min(buyPrice.liquidity || 0, sellPrice.liquidity || 0);
      if (liquidity < 10000) { // Less than $10k liquidity
        riskScore += 0.3;
      }
      
      // Confidence risk
      const avgConfidence = (buyPrice.confidence + sellPrice.confidence) / 2;
      if (avgConfidence < 0.8) {
        riskScore += 0.2;
      }
      
      return Math.min(riskScore, 1);
      
    } catch (error) {
      logger.error('Error calculating risk score:', error);
      return 0.5; // Default medium risk
    }
  }

  /**
   * Generate risk recommendations
   */
  private generateRiskRecommendations(factors: RiskFactor[], overallRisk: number): string[] {
    const recommendations: string[] = [];
    
    // High-level recommendations based on overall risk
    if (overallRisk > 0.7) {
      recommendations.push('Consider postponing trade until risk conditions improve');
      recommendations.push('Reduce position size to minimize potential losses');
    }
    
    // Specific recommendations based on risk factors
    factors.forEach(factor => {
      if (factor.severity > 0.6) {
        recommendations.push(factor.mitigation);
      }
    });
    
    // Add general risk management recommendations
    recommendations.push('Monitor market conditions closely during execution');
    recommendations.push('Have contingency plans for adverse price movements');
    
    return recommendations;
  }

  /**
   * Get market conditions
   */
  private async getMarketConditions(): Promise<string> {
    try {
      // This would implement actual market analysis
      // For now, return a default value
      return 'neutral';
    } catch (error) {
      logger.error('Error getting market conditions:', error);
      return 'neutral';
    }
  }

  /**
   * Get exchange liquidity
   */
  private getExchangeLiquidity(exchange: any): number {
    // This would implement actual liquidity checking
    // For now, return a default value
    return 100000; // $100k default liquidity
  }

  /**
   * Calculate expected slippage
   */
  private calculateExpectedSlippage(opportunity: ArbitrageOpportunity): number {
    // This would implement actual slippage calculation
    // For now, return a default value
    return 0.5; // 0.5% default slippage
  }

  /**
   * Estimate execution time
   */
  private estimateExecutionTime(opportunity: ArbitrageOpportunity): number {
    // This would implement actual execution time estimation
    // For now, return a default value
    return 15000; // 15 seconds default
  }

  /**
   * Get trading jurisdiction
   */
  private getTradingJurisdiction(): string {
    // This would implement actual jurisdiction detection
    // For now, return a default value
    return 'unrestricted';
  }

  /**
   * Update daily loss
   */
  updateDailyLoss(loss: number): void {
    this.dailyLoss += loss;
    
    if (this.dailyLoss > this.riskLimits.maxDailyLoss) {
      this.emit('riskAlert', {
        type: 'daily_loss_exceeded',
        message: `Daily loss limit exceeded: $${this.dailyLoss}`,
        severity: 'high'
      });
    }
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      dailyLoss: this.dailyLoss,
      maxDailyLoss: this.riskLimits.maxDailyLoss,
      riskLimits: this.riskLimits,
      volatilityCacheSize: this.volatilityCache.size,
      positionCorrelationsSize: this.positionCorrelations.size
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Clear timers
      // Save final state
      await this.database.saveRiskState({
        dailyLoss: this.dailyLoss,
        timestamp: new Date()
      });
      
      logger.info('Risk management service cleaned up');
      
    } catch (error) {
      logger.error('Error cleaning up risk management service:', error);
    }
  }
}
