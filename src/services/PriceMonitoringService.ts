import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import { 
  PriceData, 
  PriceUpdate, 
  MarketData, 
  Exchange,
  TokenPair 
} from '@/types/arbitrage';
import { DatabaseService } from './DatabaseService';
import { MetricsService } from './MetricsService';

export class PriceMonitoringService extends EventEmitter {
  private database: DatabaseService;
  private metrics: MetricsService;
  private isRunning: boolean = false;
  private priceCache: Map<string, PriceData> = new Map();
  private exchanges: Map<string, Exchange> = new Map();
  private supportedPairs: TokenPair[] = [];
  private updateInterval: number;
  private maxPriceAge: number;
  private priceSources: string[];
  private confidenceThreshold: number;

  constructor(database: DatabaseService, metrics: MetricsService) {
    super();
    
    this.database = database;
    this.metrics = metrics;

    // Load configuration from environment
    this.updateInterval = parseInt(process.env.PRICE_UPDATE_INTERVAL || '1000');
    this.maxPriceAge = parseInt(process.env.MAX_PRICE_AGE || '5000');
    this.priceSources = (process.env.PRICE_SOURCES || 'coingecko,chainlink,dex').split(',');
    this.confidenceThreshold = parseFloat(process.env.PRICE_CONFIDENCE_THRESHOLD || '0.8');

    this.initializeSupportedPairs();
  }

  /**
   * Initialize supported token pairs
   */
  private initializeSupportedPairs(): void {
    this.supportedPairs = [
      {
        baseToken: 'ETH',
        quoteToken: 'USDC',
        baseTokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        quoteTokenAddress: '0xA0b86a33E6441b8c4C0C0C0C0C0C0C0C0C0C0C0',
        baseTokenDecimals: 18,
        quoteTokenDecimals: 6,
        baseTokenSymbol: 'ETH',
        quoteTokenSymbol: 'USDC'
      },
      {
        baseToken: 'AVAX',
        quoteToken: 'USDC',
        baseTokenAddress: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        quoteTokenAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
        baseTokenDecimals: 18,
        quoteTokenDecimals: 6,
        baseTokenSymbol: 'AVAX',
        quoteTokenSymbol: 'USDC'
      },
      {
        baseToken: 'WETH',
        quoteToken: 'USDC',
        baseTokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        quoteTokenAddress: '0xA0b86a33E6441b8c4C0C0C0C0C0C0C0C0C0C0C0',
        baseTokenDecimals: 18,
        quoteTokenDecimals: 6,
        baseTokenSymbol: 'WETH',
        quoteTokenSymbol: 'USDC'
      }
    ];
  }

  /**
   * Start price monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Price monitoring service is already running');
      return;
    }

    try {
      logger.info('Starting price monitoring service...');
      
      // Initialize exchanges
      await this.initializeExchanges();
      
      // Start price update loop
      this.startPriceUpdateLoop();
      
      // Start price aggregation
      this.startPriceAggregation();
      
      this.isRunning = true;
      logger.info('Price monitoring service started successfully');
      
      this.emit('serviceStarted');
      
    } catch (error) {
      logger.error('Failed to start price monitoring service:', error);
      throw error;
    }
  }

  /**
   * Stop price monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Price monitoring service is not running');
      return;
    }

    try {
      logger.info('Stopping price monitoring service...');
      
      this.isRunning = false;
      
      // Clear intervals
      if (this.priceUpdateTimer) {
        clearInterval(this.priceUpdateTimer);
      }
      
      if (this.aggregationTimer) {
        clearInterval(this.aggregationTimer);
      }
      
      logger.info('Price monitoring service stopped successfully');
      
      this.emit('serviceStopped');
      
    } catch (error) {
      logger.error('Failed to stop price monitoring service:', error);
      throw error;
    }
  }

  private priceUpdateTimer: NodeJS.Timeout | null = null;
  private aggregationTimer: NodeJS.Timeout | null = null;

  /**
   * Start price update loop
   */
  private startPriceUpdateLoop(): void {
    this.priceUpdateTimer = setInterval(async () => {
      try {
        await this.updateAllPrices();
      } catch (error) {
        logger.error('Error in price update loop:', error);
        this.metrics.recordError('price_update_loop', error);
      }
    }, this.updateInterval);
  }

  /**
   * Start price aggregation
   */
  private startPriceAggregation(): void {
    this.aggregationTimer = setInterval(async () => {
      try {
        await this.aggregatePrices();
      } catch (error) {
        logger.error('Error in price aggregation:', error);
        this.metrics.recordError('price_aggregation', error);
      }
    }, this.updateInterval * 2);
  }

  /**
   * Initialize exchanges
   */
  private async initializeExchanges(): Promise<void> {
    try {
      // Initialize major exchanges
      const exchanges: Exchange[] = [
        {
          id: 'uniswap_v3',
          name: 'Uniswap V3',
          type: 'DEX',
          network: 'Ethereum',
          rpcUrl: process.env.UNISWAP_V3_RPC || 'https://mainnet.infura.io/v3/your_key',
          chainId: 1,
          isActive: true,
          tradingFees: { maker: 0.003, taker: 0.003, gasMultiplier: 1.0 },
          withdrawalFees: { baseToken: 0, quoteToken: 0 },
          minOrderSize: 0.001,
          maxOrderSize: 1000000,
          supportedTokens: ['ETH', 'USDC', 'WETH'],
          liquidityPools: []
        },
        {
          id: 'trader_joe',
          name: 'Trader Joe',
          type: 'DEX',
          network: 'Avalanche',
          rpcUrl: process.env.TRADER_JOE_RPC || 'https://api.avax.network/ext/bc/C/rpc',
          chainId: 43114,
          isActive: true,
          tradingFees: { maker: 0.003, taker: 0.003, gasMultiplier: 1.0 },
          withdrawalFees: { baseToken: 0, quoteToken: 0 },
          minOrderSize: 0.001,
          maxOrderSize: 1000000,
          supportedTokens: ['AVAX', 'USDC', 'WETH'],
          liquidityPools: []
        },
        {
          id: 'pangolin',
          name: 'Pangolin',
          type: 'DEX',
          network: 'Avalanche',
          rpcUrl: process.env.PANGOLIN_RPC || 'https://api.avax.network/ext/bc/C/rpc',
          chainId: 43114,
          isActive: true,
          tradingFees: { maker: 0.003, taker: 0.003, gasMultiplier: 1.0 },
          withdrawalFees: { baseToken: 0, quoteToken: 0 },
          minOrderSize: 0.001,
          maxOrderSize: 1000000,
          supportedTokens: ['AVAX', 'USDC', 'WETH'],
          liquidityPools: []
        }
      ];

      exchanges.forEach(exchange => {
        this.exchanges.set(exchange.id, exchange);
      });

      logger.info(`Initialized ${exchanges.length} exchanges`);
      
    } catch (error) {
      logger.error('Error initializing exchanges:', error);
      throw error;
    }
  }

  /**
   * Update all prices from all sources
   */
  private async updateAllPrices(): Promise<void> {
    try {
      const updatePromises: Promise<void>[] = [];

      // Update prices from each exchange
      for (const exchange of this.exchanges.values()) {
        if (exchange.isActive) {
          updatePromises.push(this.updateExchangePrices(exchange));
        }
      }

      // Update prices from external APIs
      if (this.priceSources.includes('coingecko')) {
        updatePromises.push(this.updateCoinGeckoPrices());
      }

      if (this.priceSources.includes('chainlink')) {
        updatePromises.push(this.updateChainlinkPrices());
      }

      // Wait for all updates to complete
      await Promise.allSettled(updatePromises);

      // Emit price update event
      const allPrices = Array.from(this.priceCache.values());
      this.emit('pricesUpdated', allPrices);

      // Record metrics
      this.metrics.recordPricesUpdated(allPrices.length);
      
    } catch (error) {
      logger.error('Error updating all prices:', error);
      throw error;
    }
  }

  /**
   * Update prices from a specific exchange
   */
  private async updateExchangePrices(exchange: Exchange): Promise<void> {
    try {
      for (const pair of this.supportedPairs) {
        if (exchange.supportedTokens.includes(pair.baseToken) && 
            exchange.supportedTokens.includes(pair.quoteToken)) {
          
          const price = await this.fetchExchangePrice(exchange, pair);
          if (price) {
            this.updatePriceCache(price);
          }
        }
      }
    } catch (error) {
      logger.error(`Error updating prices for exchange ${exchange.name}:`, error);
    }
  }

  /**
   * Fetch price from a specific exchange
   */
  private async fetchExchangePrice(exchange: Exchange, pair: TokenPair): Promise<PriceData | null> {
    try {
      // This would implement actual exchange API calls
      // For now, return mock data
      const mockPrice = this.generateMockPrice(exchange, pair);
      
      // In production, this would make actual API calls:
      // - Uniswap V3: Use Quoter contract
      // - Trader Joe: Use Router contract
      // - Pangolin: Use Router contract
      
      return mockPrice;
      
    } catch (error) {
      logger.error(`Error fetching price from ${exchange.name} for ${pair.baseToken}/${pair.quoteToken}:`, error);
      return null;
    }
  }

  /**
   * Generate mock price data for testing
   */
  private generateMockPrice(exchange: Exchange, pair: TokenPair): PriceData {
    const basePrice = this.getBasePrice(pair.baseToken);
    const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
    
    return {
      exchange: exchange.id,
      baseToken: pair.baseToken,
      quoteToken: pair.quoteToken,
      price: basePrice * (1 + variation),
      volume24h: Math.random() * 1000000 + 100000,
      liquidity: Math.random() * 5000000 + 1000000,
      timestamp: new Date(),
      source: 'api',
      confidence: 0.9 + Math.random() * 0.1,
      lastUpdate: new Date()
    };
  }

  /**
   * Get base price for a token
   */
  private getBasePrice(token: string): number {
    const basePrices: Record<string, number> = {
      'ETH': 2000,
      'AVAX': 50,
      'WETH': 2000,
      'USDC': 1,
      'USDT': 1
    };
    
    return basePrices[token] || 1;
  }

  /**
   * Update CoinGecko prices
   */
  private async updateCoinGeckoPrices(): Promise<void> {
    try {
      const apiKey = process.env.COINGECKO_API_KEY;
      const apiUrl = process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';
      
      for (const pair of this.supportedPairs) {
        try {
          const response = await fetch(
            `${apiUrl}/simple/price?ids=${pair.baseToken.toLowerCase()}&vs_currencies=usd&x_cg_demo_api_key=${apiKey}`,
            { timeout: 5000 }
          );
          
          if (response.ok) {
            const data = await response.json();
            const price = data[pair.baseToken.toLowerCase()]?.usd;
            
            if (price) {
              const priceData: PriceData = {
                exchange: 'coingecko',
                baseToken: pair.baseToken,
                quoteToken: 'USD',
                price,
                volume24h: 0, // Would need separate API call
                liquidity: 0,
                timestamp: new Date(),
                source: 'api',
                confidence: 0.95,
                lastUpdate: new Date()
              };
              
              this.updatePriceCache(priceData);
            }
          }
        } catch (error) {
          logger.warn(`Failed to fetch CoinGecko price for ${pair.baseToken}:`, error);
        }
      }
      
    } catch (error) {
      logger.error('Error updating CoinGecko prices:', error);
    }
  }

  /**
   * Update Chainlink prices
   */
  private async updateChainlinkPrices(): Promise<void> {
    try {
      // This would implement Chainlink price feed calls
      // For now, just log that it's not implemented
      logger.debug('Chainlink price updates not yet implemented');
      
    } catch (error) {
      logger.error('Error updating Chainlink prices:', error);
    }
  }

  /**
   * Update price cache
   */
  private updatePriceCache(priceData: PriceData): void {
    const cacheKey = `${priceData.exchange}_${priceData.baseToken}_${priceData.quoteToken}`;
    
    // Check if price is too old
    const priceAge = Date.now() - priceData.timestamp.getTime();
    if (priceAge > this.maxPriceAge) {
      logger.warn(`Price for ${cacheKey} is too old: ${priceAge}ms`);
      return;
    }
    
    // Update cache
    this.priceCache.set(cacheKey, priceData);
    
    // Emit price update event
    this.emit('priceUpdated', priceData);
  }

  /**
   * Aggregate prices and detect opportunities
   */
  private async aggregatePrices(): Promise<void> {
    try {
      const aggregatedPrices = new Map<string, PriceData[]>();
      
      // Group prices by token pair
      for (const price of this.priceCache.values()) {
        const pairKey = `${price.baseToken}_${price.quoteToken}`;
        
        if (!aggregatedPrices.has(pairKey)) {
          aggregatedPrices.set(pairKey, []);
        }
        
        aggregatedPrices.get(pairKey)!.push(price);
      }
      
      // Analyze each pair for price discrepancies
      for (const [pairKey, prices] of aggregatedPrices) {
        if (prices.length >= 2) {
          const opportunities = this.detectPriceDiscrepancies(pairKey, prices);
          
          if (opportunities.length > 0) {
            this.emit('opportunitiesDetected', opportunities);
            this.metrics.recordOpportunitiesDetected(opportunities.length);
          }
        }
      }
      
    } catch (error) {
      logger.error('Error aggregating prices:', error);
      throw error;
    }
  }

  /**
   * Detect price discrepancies for arbitrage opportunities
   */
  private detectPriceDiscrepancies(pairKey: string, prices: PriceData[]): any[] {
    const opportunities: any[] = [];
    
    try {
      // Sort prices by value
      const sortedPrices = prices.sort((a, b) => a.price - b.price);
      
      // Check for significant price differences
      for (let i = 0; i < sortedPrices.length - 1; i++) {
        for (let j = i + 1; j < sortedPrices.length; j++) {
          const lowPrice = sortedPrices[i];
          const highPrice = sortedPrices[j];
          
          const priceDifference = highPrice.price - lowPrice.price;
          const priceDifferencePercent = (priceDifference / lowPrice.price) * 100;
          
          // Check if difference is significant (configurable threshold)
          const minDifferencePercent = parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.5');
          
          if (priceDifferencePercent >= minDifferencePercent) {
            const opportunity = {
              pairKey,
              buyExchange: lowPrice.exchange,
              sellExchange: highPrice.exchange,
              buyPrice: lowPrice.price,
              sellPrice: highPrice.price,
              priceDifference,
              priceDifferencePercent,
              timestamp: new Date(),
              confidence: Math.min(lowPrice.confidence, highPrice.confidence)
            };
            
            opportunities.push(opportunity);
          }
        }
      }
      
    } catch (error) {
      logger.error(`Error detecting price discrepancies for ${pairKey}:`, error);
    }
    
    return opportunities;
  }

  /**
   * Get current prices for a token pair
   */
  getPricesForPair(baseToken: string, quoteToken: string): PriceData[] {
    const prices: PriceData[] = [];
    
    for (const price of this.priceCache.values()) {
      if (price.baseToken === baseToken && price.quoteToken === quoteToken) {
        prices.push(price);
      }
    }
    
    return prices;
  }

  /**
   * Get all current prices
   */
  getAllPrices(): PriceData[] {
    return Array.from(this.priceCache.values());
  }

  /**
   * Get price for specific exchange and pair
   */
  getPrice(exchange: string, baseToken: string, quoteToken: string): PriceData | null {
    const cacheKey = `${exchange}_${baseToken}_${quoteToken}`;
    return this.priceCache.get(cacheKey) || null;
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      exchangesCount: this.exchanges.size,
      supportedPairsCount: this.supportedPairs.length,
      priceCacheSize: this.priceCache.size,
      updateInterval: this.updateInterval,
      maxPriceAge: this.maxPriceAge,
      priceSources: this.priceSources,
      confidenceThreshold: this.confidenceThreshold
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.stop();
      
      // Clear cache
      this.priceCache.clear();
      
      logger.info('Price monitoring service cleaned up');
      
    } catch (error) {
      logger.error('Error cleaning up price monitoring service:', error);
    }
  }
}
