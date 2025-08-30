import axios, { AxiosInstance } from 'axios';
import { mcpConfig } from '@/config';
import { MCPContext, ArbitrageOpportunity, PriceComparison } from '@/types';
import { logger } from '@/utils/logger';

export class MCPService {
  private client: AxiosInstance;
  private modelId: string;

  constructor() {
    this.client = axios.create({
      baseURL: mcpConfig.apiEndpoint,
      timeout: mcpConfig.timeoutMs,
      headers: {
        'Authorization': `Bearer ${mcpConfig.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    this.modelId = mcpConfig.modelId;
  }

  /**
   * Detect arbitrage opportunities using MCP AI model
   */
  async detectOpportunities(
    priceComparisons: PriceComparison[],
    gasPrices: Record<string, number>,
    historicalPerformance: {
      successRate: number;
      averageProfit: number;
      averageSlippage: number;
    }
  ): Promise<ArbitrageOpportunity[]> {
    try {
      const opportunities: ArbitrageOpportunity[] = [];

      for (const comparison of priceComparisons) {
        const mcpContext = await this.createMCPContext(comparison, gasPrices, historicalPerformance);
        
        const response = await this.client.post('/v1/inference', {
          model_id: this.modelId,
          context: mcpContext,
          parameters: {
            max_tokens: 1000,
            temperature: 0.1,
            top_p: 0.9
          }
        });

        if (response.data && response.data.opportunities) {
          for (const opp of response.data.opportunities) {
            const opportunity: ArbitrageOpportunity = {
              id: this.generateId(),
              tokenPairId: comparison.tokenPair,
              sourceExchangeId: comparison.sourceExchange,
              targetExchangeId: comparison.targetExchange,
              priceDifferencePercent: comparison.priceDifferencePercent,
              expectedProfitPercent: opp.expectedProfit,
              expectedProfitUSD: this.calculateExpectedProfitUSD(comparison, opp.expectedProfit),
              confidence: opp.confidence,
              riskScore: this.calculateRiskScore(opp.confidence, comparison),
              status: 'detected' as any,
              reasoning: opp.reasoning || [],
              detectedAt: new Date(),
              expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
              mcpContext: mcpContext
            };
            opportunities.push(opportunity);
          }
        }
      }

      logger.info(`MCP detected ${opportunities.length} opportunities`);
      return opportunities;

    } catch (error) {
      logger.error('Error detecting opportunities with MCP:', error);
      throw new Error(`MCP opportunity detection failed: ${error}`);
    }
  }

  /**
   * Assess risk for a specific opportunity
   */
  async assessRisk(opportunity: ArbitrageOpportunity): Promise<{
    riskScore: number;
    recommendations: string[];
    executionProbability: number;
  }> {
    try {
      const response = await this.client.post('/v1/inference', {
        model_id: 'risk-assessor-v1',
        context: {
          opportunity: {
            tokenPair: opportunity.tokenPairId,
            sourceExchange: opportunity.sourceExchangeId,
            targetExchange: opportunity.targetExchangeId,
            priceDifference: opportunity.priceDifferencePercent,
            expectedProfit: opportunity.expectedProfitPercent
          },
          marketConditions: opportunity.mcpContext.inputFactors,
          executionHistory: opportunity.mcpContext.inputFactors.historicalPerformance
        },
        parameters: {
          max_tokens: 500,
          temperature: 0.1
        }
      });

      return {
        riskScore: response.data.riskScore || 50,
        recommendations: response.data.recommendations || [],
        executionProbability: response.data.executionProbability || 0.5
      };

    } catch (error) {
      logger.error('Error assessing risk with MCP:', error);
      return {
        riskScore: 50,
        recommendations: ['Risk assessment failed, proceed with caution'],
        executionProbability: 0.5
      };
    }
  }

  /**
   * Create MCP context for AI inference
   */
  private async createMCPContext(
    comparison: PriceComparison,
    gasPrices: Record<string, number>,
    historicalPerformance: {
      successRate: number;
      averageProfit: number;
      averageSlippage: number;
    }
  ): Promise<MCPContext> {
    const prices: Record<string, number> = {
      [`${comparison.sourceExchange}_${comparison.tokenPair}`]: comparison.sourcePrice,
      [`${comparison.targetExchange}_${comparison.tokenPair}`]: comparison.targetPrice
    };

    const liquidity: Record<string, number> = {
      [`${comparison.sourceExchange}_${comparison.tokenPair}`]: comparison.liquidity,
      [`${comparison.targetExchange}_${comparison.tokenPair}`]: comparison.liquidity
    };

    const volatility: Record<string, number> = {
      [`${comparison.tokenPair}`]: this.calculateVolatility(comparison)
    };

    return {
      modelId: this.modelId,
      inputFactors: {
        prices,
        gasPrices,
        liquidity,
        volatility,
        historicalPerformance
      },
      reasoningChain: [],
      confidence: 0,
      verificationProof: ''
    };
  }

  /**
   * Calculate expected profit in USD
   */
  private calculateExpectedProfitUSD(comparison: PriceComparison, profitPercent: number): number {
    const tradeSize = Math.min(comparison.liquidity * 0.1, 1000); // 10% of liquidity or $1000 max
    return (tradeSize * profitPercent) / 100;
  }

  /**
   * Calculate risk score based on confidence and market conditions
   */
  private calculateRiskScore(confidence: number, comparison: PriceComparison): number {
    const baseRisk = 100 - confidence;
    const liquidityRisk = comparison.liquidity < 10000 ? 20 : 0;
    const volatilityRisk = this.calculateVolatility(comparison) > 0.1 ? 15 : 0;
    
    return Math.min(100, baseRisk + liquidityRisk + volatilityRisk);
  }

  /**
   * Calculate price volatility
   */
  private calculateVolatility(comparison: PriceComparison): number {
    // Simplified volatility calculation
    const priceRatio = comparison.sourcePrice / comparison.targetPrice;
    return Math.abs(1 - priceRatio);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `opp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Verify MCP model health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/v1/health');
      return response.status === 200;
    } catch (error) {
      logger.error('MCP health check failed:', error);
      return false;
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(): Promise<any> {
    try {
      const response = await this.client.get(`/v1/models/${this.modelId}`);
      return response.data;
    } catch (error) {
      logger.error('Error getting model info:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const mcpService = new MCPService();
