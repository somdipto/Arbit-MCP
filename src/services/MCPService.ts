import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { 
  ArbitrageOpportunity, 
  PriceData, 
  MarketAnalysis,
  AIRecommendation 
} from '@/types/arbitrage';
import { DatabaseService } from './DatabaseService';
import { MetricsService } from './MetricsService';
import { NotificationService } from './NotificationService';

export class MCPService extends EventEmitter {
  private database: DatabaseService;
  private metrics: MetricsService;
  private notifications: NotificationService;
  private mcpClient: any;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private maxRetries: number = 5;
  private retryDelay: number = 5000;
  private analysisCache: Map<string, MarketAnalysis> = new Map();
  private recommendationHistory: Map<string, AIRecommendation[]> = new Map();

  constructor(
    database: DatabaseService, 
    metrics: MetricsService, 
    notifications: NotificationService
  ) {
    super();
    
    this.database = database;
    this.metrics = metrics;
    this.notifications = notifications;
  }

  /**
   * Initialize MCP service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing MCP service...');
      
      // Initialize MCP client
      await this.initializeMCPClient();
      
      // Test connection
      await this.testConnection();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.isConnected = true;
      logger.info('MCP service initialized successfully');
      
      this.emit('mcpReady');
      
    } catch (error) {
      logger.error('Failed to initialize MCP service:', error);
      throw error;
    }
  }

  /**
   * Initialize MCP client
   */
  private async initializeMCPClient(): Promise<void> {
    try {
      // This would implement actual MCP client initialization
      // For now, create a mock client
      this.mcpClient = {
        connect: async () => {
          logger.debug('Mock MCP client connecting...');
          return Promise.resolve();
        },
        disconnect: async () => {
          logger.debug('Mock MCP client disconnecting...');
          return Promise.resolve();
        },
        isConnected: () => this.isConnected,
        analyzeMarket: async (data: any) => {
          logger.debug('Mock MCP market analysis...');
          return this.generateMockAnalysis(data);
        },
        getRecommendations: async (data: any) => {
          logger.debug('Mock MCP recommendations...');
          return this.generateMockRecommendations(data);
        }
      };

      logger.info('MCP client initialized');
      
    } catch (error) {
      logger.error('Error initializing MCP client:', error);
      throw error;
    }
  }

  /**
   * Test MCP connection
   */
  private async testConnection(): Promise<void> {
    try {
      await this.mcpClient.connect();
      
      // Test basic functionality
      const testData = { test: true };
      const analysis = await this.mcpClient.analyzeMarket(testData);
      
      if (!analysis) {
        throw new Error('MCP analysis test failed');
      }
      
      logger.info('MCP connection test successful');
      
    } catch (error) {
      logger.error('MCP connection test failed:', error);
      throw error;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    // Monitor MCP connection health every 30 seconds
    setInterval(async () => {
      try {
        if (!this.mcpClient.isConnected()) {
          logger.warn('MCP connection lost, attempting reconnection...');
          await this.reconnect();
        }
      } catch (error) {
        logger.error('Error in MCP health monitoring:', error);
      }
    }, 30000);
  }

  /**
   * Reconnect to MCP
   */
  private async reconnect(): Promise<void> {
    try {
      if (this.connectionRetries >= this.maxRetries) {
        logger.error('Max MCP reconnection attempts reached');
        this.emit('mcpConnectionFailed');
        return;
      }

      this.connectionRetries++;
      logger.info(`Attempting MCP reconnection (${this.connectionRetries}/${this.maxRetries})`);

      await this.mcpClient.connect();
      this.isConnected = true;
      this.connectionRetries = 0;
      
      logger.info('MCP reconnection successful');
      this.emit('mcpReconnected');
      
    } catch (error) {
      logger.error(`MCP reconnection attempt ${this.connectionRetries} failed:`, error);
      
      // Schedule next retry
      setTimeout(() => this.reconnect(), this.retryDelay);
    }
  }

  /**
   * Analyze market data using MCP
   */
  async analyzeMarket(prices: PriceData[]): Promise<MarketAnalysis> {
    try {
      if (!this.isConnected) {
        throw new Error('MCP service not connected');
      }

      logger.info(`Analyzing market data for ${prices.length} price points`);
      
      // Prepare data for MCP analysis
      const analysisData = this.prepareAnalysisData(prices);
      
      // Get cached analysis if available
      const cacheKey = this.generateCacheKey(analysisData);
      const cachedAnalysis = this.analysisCache.get(cacheKey);
      
      if (cachedAnalysis && this.isCacheValid(cachedAnalysis)) {
        logger.debug('Using cached market analysis');
        return cachedAnalysis;
      }
      
      // Perform MCP analysis
      const analysis = await this.mcpClient.analyzeMarket(analysisData);
      
      // Cache the analysis
      this.analysisCache.set(cacheKey, analysis);
      
      // Keep cache size manageable
      if (this.analysisCache.size > 1000) {
        const firstKey = this.analysisCache.keys().next().value;
        this.analysisCache.delete(firstKey);
      }
      
      // Record metrics
      this.metrics.recordError('mcp_analysis', { count: prices.length });
      
      logger.info('Market analysis completed successfully');
      return analysis;
      
    } catch (error) {
      logger.error('Error analyzing market data:', error);
      this.metrics.recordError('mcp_analysis_error', error);
      
      // Return fallback analysis
      return this.generateFallbackAnalysis(prices);
    }
  }

  /**
   * Get AI recommendations for arbitrage opportunities
   */
  async getRecommendations(opportunity: ArbitrageOpportunity): Promise<AIRecommendation[]> {
    try {
      if (!this.isConnected) {
        throw new Error('MCP service not connected');
      }

      logger.info(`Getting AI recommendations for opportunity ${opportunity.id}`);
      
      // Prepare opportunity data for MCP
      const recommendationData = this.prepareRecommendationData(opportunity);
      
      // Get recommendations from MCP
      const recommendations = await this.mcpClient.getRecommendations(recommendationData);
      
      // Store recommendations in history
      this.storeRecommendationHistory(opportunity.id, recommendations);
      
      // Record metrics
      this.metrics.recordError('mcp_recommendations', { count: recommendations.length });
      
      logger.info(`AI recommendations received: ${recommendations.length} recommendations`);
      return recommendations;
      
    } catch (error) {
      logger.error('Error getting AI recommendations:', error);
      this.metrics.recordError('mcp_recommendations_error', error);
      
      // Return fallback recommendations
      return this.generateFallbackRecommendations(opportunity);
    }
  }

  /**
   * Validate arbitrage opportunity using AI
   */
  async validateOpportunity(opportunity: ArbitrageOpportunity): Promise<boolean> {
    try {
      if (!this.isConnected) {
        logger.warn('MCP service not connected, skipping AI validation');
        return true; // Default to valid if MCP unavailable
      }

      logger.info(`Validating opportunity ${opportunity.id} using AI`);
      
      // Get AI recommendations
      const recommendations = await this.getRecommendations(opportunity);
      
      // Analyze recommendations for validation
      const validationScore = this.calculateValidationScore(recommendations);
      
      // Determine if opportunity is valid
      const isValid = validationScore >= 0.7; // 70% threshold
      
      if (isValid) {
        logger.info(`AI validation passed for opportunity ${opportunity.id} (score: ${validationScore.toFixed(2)})`);
      } else {
        logger.warn(`AI validation failed for opportunity ${opportunity.id} (score: ${validationScore.toFixed(2)})`);
      }
      
      // Send notification if validation fails
      if (!isValid) {
        this.notifications.queueNotification(
          'risk',
          `AI validation failed for opportunity ${opportunity.id}`,
          'high',
          { opportunityId: opportunity.id, validationScore, recommendations }
        );
      }
      
      return isValid;
      
    } catch (error) {
      logger.error(`Error validating opportunity ${opportunity.id}:`, error);
      return true; // Default to valid on error
    }
  }

  /**
   * Optimize trade parameters using AI
   */
  async optimizeTradeParameters(opportunity: ArbitrageOpportunity): Promise<any> {
    try {
      if (!this.isConnected) {
        logger.warn('MCP service not connected, using default parameters');
        return this.getDefaultTradeParameters(opportunity);
      }

      logger.info(`Optimizing trade parameters for opportunity ${opportunity.id}`);
      
      // Get AI recommendations
      const recommendations = await this.getRecommendations(opportunity);
      
      // Extract optimization parameters
      const optimizedParams = this.extractOptimizationParameters(recommendations);
      
      // Apply optimizations to opportunity
      const optimizedOpportunity = this.applyOptimizations(opportunity, optimizedParams);
      
      logger.info(`Trade parameters optimized for opportunity ${opportunity.id}`);
      return optimizedOpportunity;
      
    } catch (error) {
      logger.error(`Error optimizing trade parameters for opportunity ${opportunity.id}:`, error);
      return this.getDefaultTradeParameters(opportunity);
    }
  }

  /**
   * Prepare analysis data for MCP
   */
  private prepareAnalysisData(prices: PriceData[]): any {
    try {
      // Group prices by token pair
      const groupedPrices: Record<string, PriceData[]> = {};
      
      prices.forEach(price => {
        const pairKey = `${price.baseToken}_${price.quoteToken}`;
        if (!groupedPrices[pairKey]) {
          groupedPrices[pairKey] = [];
        }
        groupedPrices[pairKey].push(price);
      });
      
      // Calculate basic statistics for each pair
      const analysisData = Object.entries(groupedPrices).map(([pair, pairPrices]) => {
        const prices = pairPrices.map(p => p.price);
        const volumes = pairPrices.map(p => p.volume24h || 0);
        const liquidities = pairPrices.map(p => p.liquidity || 0);
        
        return {
          pair,
          baseToken: pairPrices[0].baseToken,
          quoteToken: pairPrices[0].quoteToken,
          priceStats: {
            current: prices[prices.length - 1],
            average: prices.reduce((sum, p) => sum + p, 0) / prices.length,
            min: Math.min(...prices),
            max: Math.max(...prices),
            volatility: this.calculateVolatility(prices)
          },
          volumeStats: {
            current: volumes[volumes.length - 1],
            average: volumes.reduce((sum, v) => sum + v, 0) / volumes.length,
            trend: this.calculateTrend(volumes)
          },
          liquidityStats: {
            current: liquidities[liquidities.length - 1],
            average: liquidities.reduce((sum, l) => sum + l, 0) / liquidities.length,
            trend: this.calculateTrend(liquidities)
          },
          exchanges: pairPrices.map(p => p.exchange),
          timestamp: new Date().toISOString()
        };
      });
      
      return {
        analysisId: `analysis_${Date.now()}`,
        timestamp: new Date().toISOString(),
        pairs: analysisData,
        marketConditions: this.assessMarketConditions(analysisData)
      };
      
    } catch (error) {
      logger.error('Error preparing analysis data:', error);
      throw error;
    }
  }

  /**
   * Prepare recommendation data for MCP
   */
  private prepareRecommendationData(opportunity: ArbitrageOpportunity): any {
    try {
      return {
        opportunityId: opportunity.id,
        tokenPair: opportunity.tokenPair,
        buyExchange: opportunity.buyExchange,
        sellExchange: opportunity.sellExchange,
        buyPrice: opportunity.buyPrice,
        sellPrice: opportunity.sellPrice,
        expectedProfit: opportunity.expectedProfit,
        optimalTradeSize: opportunity.optimalTradeSize,
        gasEstimate: opportunity.gasEstimate,
        riskScore: opportunity.riskScore,
        timestamp: new Date().toISOString(),
        marketContext: {
          volatility: this.getMarketVolatility(),
          liquidity: this.getMarketLiquidity(),
          trend: this.getMarketTrend()
        }
      };
      
    } catch (error) {
      logger.error('Error preparing recommendation data:', error);
      throw error;
    }
  }

  /**
   * Calculate validation score from recommendations
   */
  private calculateValidationScore(recommendations: AIRecommendation[]): number {
    try {
      if (recommendations.length === 0) {
        return 0.5; // Neutral score if no recommendations
      }
      
      let totalScore = 0;
      let weightSum = 0;
      
      recommendations.forEach(rec => {
        const weight = this.getRecommendationWeight(rec.type);
        const score = this.normalizeRecommendationScore(rec.score);
        
        totalScore += score * weight;
        weightSum += weight;
      });
      
      return weightSum > 0 ? totalScore / weightSum : 0.5;
      
    } catch (error) {
      logger.error('Error calculating validation score:', error);
      return 0.5;
    }
  }

  /**
   * Extract optimization parameters from recommendations
   */
  private extractOptimizationParameters(recommendations: AIRecommendation[]): any {
    try {
      const params: any = {};
      
      recommendations.forEach(rec => {
        if (rec.type === 'trade_size') {
          params.tradeSizeMultiplier = rec.value || 1.0;
        } else if (rec.type === 'timing') {
          params.executionDelay = rec.value || 0;
        } else if (rec.type === 'gas_strategy') {
          params.gasStrategy = rec.value || 'balanced';
        } else if (rec.type === 'slippage') {
          params.slippageTolerance = rec.value || 0.5;
        }
      });
      
      return params;
      
    } catch (error) {
      logger.error('Error extracting optimization parameters:', error);
      return {};
    }
  }

  /**
   * Apply optimizations to opportunity
   */
  private applyOptimizations(opportunity: ArbitrageOpportunity, params: any): ArbitrageOpportunity {
    try {
      const optimized = { ...opportunity };
      
      // Apply trade size optimization
      if (params.tradeSizeMultiplier) {
        optimized.optimalTradeSize *= params.tradeSizeMultiplier;
      }
      
      // Apply gas strategy optimization
      if (params.gasStrategy) {
        optimized.gasEstimate = {
          ...optimized.gasEstimate,
          strategy: params.gasStrategy
        };
      }
      
      // Apply slippage optimization
      if (params.slippageTolerance) {
        optimized.slippageTolerance = params.slippageTolerance;
      }
      
      return optimized;
      
    } catch (error) {
      logger.error('Error applying optimizations:', error);
      return opportunity;
    }
  }

  /**
   * Get default trade parameters
   */
  private getDefaultTradeParameters(opportunity: ArbitrageOpportunity): any {
    return {
      tradeSizeMultiplier: 1.0,
      executionDelay: 0,
      gasStrategy: 'balanced',
      slippageTolerance: 0.5
    };
  }

  /**
   * Generate cache key for analysis
   */
  private generateCacheKey(data: any): string {
    try {
      const keyData = {
        pairs: data.pairs?.map((p: any) => `${p.baseToken}_${p.quoteToken}`).sort(),
        timestamp: data.timestamp?.split('T')[0] // Date only
      };
      
      return `mcp_${JSON.stringify(keyData)}`;
      
    } catch (error) {
      logger.error('Error generating cache key:', error);
      return `mcp_${Date.now()}`;
    }
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(analysis: MarketAnalysis): boolean {
    try {
      const cacheAge = Date.now() - new Date(analysis.timestamp).getTime();
      const maxAge = parseInt(process.env.MCP_CACHE_MAX_AGE || '300000'); // 5 minutes
      
      return cacheAge < maxAge;
      
    } catch (error) {
      logger.error('Error checking cache validity:', error);
      return false;
    }
  }

  /**
   * Store recommendation history
   */
  private storeRecommendationHistory(opportunityId: string, recommendations: AIRecommendation[]): void {
    try {
      if (!this.recommendationHistory.has(opportunityId)) {
        this.recommendationHistory.set(opportunityId, []);
      }
      
      this.recommendationHistory.get(opportunityId)!.push(...recommendations);
      
      // Keep only last 100 recommendations per opportunity
      const oppRecommendations = this.recommendationHistory.get(opportunityId)!;
      if (oppRecommendations.length > 100) {
        oppRecommendations.splice(0, oppRecommendations.length - 100);
      }
      
    } catch (error) {
      logger.error('Error storing recommendation history:', error);
    }
  }

  /**
   * Helper methods for data preparation
   */
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const first = values[0];
    const last = values[values.length - 1];
    const change = (last - first) / first;
    
    if (change > 0.05) return 'up';
    if (change < -0.05) return 'down';
    return 'stable';
  }

  private assessMarketConditions(analysisData: any[]): string {
    const volatility = analysisData.reduce((sum, pair) => sum + pair.priceStats.volatility, 0) / analysisData.length;
    
    if (volatility > 0.1) return 'volatile';
    if (volatility > 0.05) return 'moderate';
    return 'stable';
  }

  private getMarketVolatility(): number {
    return 0.15; // Mock value
  }

  private getMarketLiquidity(): number {
    return 1000000; // Mock value
  }

  private getMarketTrend(): string {
    return 'neutral'; // Mock value
  }

  private getRecommendationWeight(type: string): number {
    const weights: Record<string, number> = {
      'trade_size': 0.3,
      'timing': 0.2,
      'gas_strategy': 0.2,
      'slippage': 0.15,
      'risk_assessment': 0.15
    };
    
    return weights[type] || 0.1;
  }

  private normalizeRecommendationScore(score: number): number {
    // Normalize score to 0-1 range
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Mock methods for testing
   */
  private generateMockAnalysis(data: any): MarketAnalysis {
    return {
      analysisId: data.analysisId,
      timestamp: new Date().toISOString(),
      marketSentiment: 'neutral',
      volatilityAssessment: 'moderate',
      liquidityAssessment: 'good',
      riskFactors: ['market_volatility', 'liquidity_risk'],
      opportunities: ['arbitrage', 'scalping'],
      recommendations: ['monitor_volatility', 'ensure_liquidity']
    };
  }

  private generateMockRecommendations(data: any): AIRecommendation[] {
    return [
      {
        type: 'trade_size',
        score: 0.8,
        value: 1.2,
        confidence: 0.85,
        reasoning: 'Market conditions favorable for increased position size'
      },
      {
        type: 'timing',
        score: 0.7,
        value: 1000,
        confidence: 0.75,
        reasoning: 'Optimal execution timing to minimize slippage'
      },
      {
        type: 'gas_strategy',
        score: 0.9,
        value: 'aggressive',
        confidence: 0.9,
        reasoning: 'High profit opportunity justifies aggressive gas strategy'
      }
    ];
  }

  private generateFallbackAnalysis(prices: PriceData[]): MarketAnalysis {
    return {
      analysisId: `fallback_${Date.now()}`,
      timestamp: new Date().toISOString(),
      marketSentiment: 'neutral',
      volatilityAssessment: 'unknown',
      liquidityAssessment: 'unknown',
      riskFactors: ['analysis_unavailable'],
      opportunities: ['standard_arbitrage'],
      recommendations: ['proceed_with_caution', 'monitor_manually']
    };
  }

  private generateFallbackRecommendations(opportunity: ArbitrageOpportunity): AIRecommendation[] {
    return [
      {
        type: 'trade_size',
        score: 0.5,
        value: 1.0,
        confidence: 0.5,
        reasoning: 'Default recommendation due to MCP unavailability'
      }
    ];
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      isConnected: this.isConnected,
      connectionRetries: this.connectionRetries,
      maxRetries: this.maxRetries,
      analysisCacheSize: this.analysisCache.size,
      recommendationHistorySize: this.recommendationHistory.size,
      lastAnalysis: this.analysisCache.size > 0 ? 'available' : 'none',
      lastRecommendations: this.recommendationHistory.size > 0 ? 'available' : 'none'
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Disconnect MCP client
      if (this.mcpClient && this.mcpClient.disconnect) {
        await this.mcpClient.disconnect();
      }
      
      // Clear caches
      this.analysisCache.clear();
      this.recommendationHistory.clear();
      
      this.isConnected = false;
      logger.info('MCP service cleaned up');
      
    } catch (error) {
      logger.error('Error cleaning up MCP service:', error);
    }
  }
}
