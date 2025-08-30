import { MCPService } from '@/services/MCPService';
import { PriceComparison } from '@/types';

describe('MCPService', () => {
  let mcpService: MCPService;

  beforeEach(() => {
    mcpService = new MCPService();
  });

  describe('detectOpportunities', () => {
    it('should detect opportunities from price comparisons', async () => {
      const priceComparisons: PriceComparison[] = [
        {
          tokenPair: 'AVAX/USDC',
          sourceExchange: 'traderjoe',
          targetExchange: 'pangolin',
          sourcePrice: 100,
          targetPrice: 101,
          priceDifference: 1,
          priceDifferencePercent: 1.0,
          volume24h: 1000000,
          liquidity: 500000,
          timestamp: new Date()
        }
      ];

      const gasPrices = {
        'c-chain': 25,
        'fuji': 20
      };

      const historicalPerformance = {
        successRate: 0.85,
        averageProfit: 0.8,
        averageSlippage: 0.2
      };

      // Mock the MCP API call
      jest.spyOn(mcpService as any, 'client', 'get').mockImplementation(() => ({
        post: jest.fn().mockResolvedValue({
          data: {
            opportunities: [
              {
                expectedProfit: 0.8,
                confidence: 85,
                reasoning: ['Price difference exceeds threshold', 'High liquidity available']
              }
            ]
          }
        })
      }));

      const opportunities = await mcpService.detectOpportunities(
        priceComparisons,
        gasPrices,
        historicalPerformance
      );

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].tokenPairId).toBe('AVAX/USDC');
      expect(opportunities[0].expectedProfitPercent).toBe(0.8);
      expect(opportunities[0].confidence).toBe(85);
    });

    it('should handle API errors gracefully', async () => {
      const priceComparisons: PriceComparison[] = [];
      const gasPrices = {};
      const historicalPerformance = {
        successRate: 0.85,
        averageProfit: 0.8,
        averageSlippage: 0.2
      };

      // Mock API error
      jest.spyOn(mcpService as any, 'client', 'get').mockImplementation(() => ({
        post: jest.fn().mockRejectedValue(new Error('API Error'))
      }));

      await expect(
        mcpService.detectOpportunities(priceComparisons, gasPrices, historicalPerformance)
      ).rejects.toThrow('MCP opportunity detection failed: Error: API Error');
    });
  });

  describe('assessRisk', () => {
    it('should assess risk for an opportunity', async () => {
      const opportunity = {
        id: 'test-opp',
        tokenPairId: 'AVAX/USDC',
        sourceExchangeId: 'traderjoe',
        targetExchangeId: 'pangolin',
        priceDifferencePercent: 1.0,
        expectedProfitPercent: 0.8,
        mcpContext: {
          inputFactors: {
            prices: {},
            gasPrices: {},
            liquidity: {},
            volatility: {},
            historicalPerformance: {
              successRate: 0.85,
              averageProfit: 0.8,
              averageSlippage: 0.2
            }
          }
        }
      } as any;

      // Mock the risk assessment API call
      jest.spyOn(mcpService as any, 'client', 'get').mockImplementation(() => ({
        post: jest.fn().mockResolvedValue({
          data: {
            riskScore: 25,
            recommendations: ['Execute with standard parameters'],
            executionProbability: 0.9
          }
        })
      }));

      const riskAssessment = await mcpService.assessRisk(opportunity);

      expect(riskAssessment.riskScore).toBe(25);
      expect(riskAssessment.recommendations).toContain('Execute with standard parameters');
      expect(riskAssessment.executionProbability).toBe(0.9);
    });
  });

  describe('checkHealth', () => {
    it('should return true when MCP service is healthy', async () => {
      jest.spyOn(mcpService as any, 'client', 'get').mockImplementation(() => ({
        get: jest.fn().mockResolvedValue({ status: 200 })
      }));

      const isHealthy = await mcpService.checkHealth();
      expect(isHealthy).toBe(true);
    });

    it('should return false when MCP service is unhealthy', async () => {
      jest.spyOn(mcpService as any, 'client', 'get').mockImplementation(() => ({
        get: jest.fn().mockRejectedValue(new Error('Service unavailable'))
      }));

      const isHealthy = await mcpService.checkHealth();
      expect(isHealthy).toBe(false);
    });
  });
});
