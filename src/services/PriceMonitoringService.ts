import { EventEmitter } from 'events';
import { getRepository } from '@/config/database';
import { PriceData, TokenPair, Exchange } from '@/models';
import { PriceComparison, ExchangeType, SubnetType } from '@/types';
import { logger } from '@/utils/logger';
import { tradingConfig } from '@/config';
import axios from 'axios';

export class PriceMonitoringService extends EventEmitter {
  private isRunning: boolean = false;
  private priceCache: Map<string, PriceData> = new Map();
  private lastUpdate: Date = new Date();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Start price monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Price monitoring service is already running');
      return;
    }

    logger.info('Starting price monitoring service');
    this.isRunning = true;

    // Initial price collection
    await this.collectPrices();

    // Set up periodic price collection
    this.updateInterval = setInterval(async () => {
      await this.collectPrices();
    }, tradingConfig.monitoring.priceUpdateInterval);

    logger.info('Price monitoring service started successfully');
  }

  /**
   * Stop price monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Price monitoring service is not running');
      return;
    }

    logger.info('Stopping price monitoring service');
    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    logger.info('Price monitoring service stopped successfully');
  }

  /**
   * Collect prices from all configured exchanges
   */
  private async collectPrices(): Promise<void> {
    try {
      const tokenPairs = await getRepository(TokenPair).find({
        where: { isActive: true }
      });

      const exchanges = await getRepository(Exchange).find({
        where: { isActive: true, isHealthy: true }
      });

      const pricePromises = tokenPairs.flatMap(pair =>
        exchanges.map(exchange => this.fetchPrice(pair, exchange))
      );

      const prices = await Promise.allSettled(pricePromises);
      const validPrices: PriceData[] = [];

      for (const result of prices) {
        if (result.status === 'fulfilled' && result.value) {
          validPrices.push(result.value);
          this.priceCache.set(this.getCacheKey(result.value), result.value);
        }
      }

      // Save prices to database
      if (validPrices.length > 0) {
        await this.savePrices(validPrices);
      }

      // Detect arbitrage opportunities
      await this.detectArbitrageOpportunities();

      this.lastUpdate = new Date();
      this.emit('pricesUpdated', validPrices);

    } catch (error) {
      logger.error('Error collecting prices:', error);
      this.emit('error', error);
    }
  }

  /**
   * Fetch price from a specific exchange
   */
  private async fetchPrice(tokenPair: TokenPair, exchange: Exchange): Promise<PriceData | null> {
    try {
      let priceData: any = null;

      switch (exchange.type) {
        case ExchangeType.TRADERJOE:
          priceData = await this.fetchTraderJoePrice(tokenPair, exchange);
          break;
        case ExchangeType.PANGOLIN:
          priceData = await this.fetchPangolinPrice(tokenPair, exchange);
          break;
        case ExchangeType.SUSHI:
          priceData = await this.fetchSushiPrice(tokenPair, exchange);
          break;
        default:
          logger.warn(`Unsupported exchange type: ${exchange.type}`);
          return null;
      }

      if (!priceData) {
        return null;
      }

      // Validate price data
      if (!this.isValidPrice(priceData)) {
        logger.warn(`Invalid price data from ${exchange.name} for ${tokenPair.baseToken}/${tokenPair.quoteToken}`);
        return null;
      }

      // Check for price anomalies
      const isAnomalous = this.detectPriceAnomaly(priceData, tokenPair, exchange);

      const price = new PriceData();
      price.tokenPairId = tokenPair.id;
      price.exchangeId = exchange.id;
      price.price = priceData.price;
      price.volume24h = priceData.volume24h || 0;
      price.liquidity = priceData.liquidity || 0;
      price.high24h = priceData.high24h;
      price.low24h = priceData.low24h;
      price.priceChange24h = priceData.priceChange24h;
      price.volumeChange24h = priceData.volumeChange24h;
      price.timestamp = new Date();
      price.source = exchange.name;
      price.isAnomalous = isAnomalous;
      price.metadata = priceData.metadata;

      return price;

    } catch (error) {
      logger.error(`Error fetching price from ${exchange.name} for ${tokenPair.baseToken}/${tokenPair.quoteToken}:`, error);
      return null;
    }
  }

  /**
   * Fetch price from TraderJoe
   */
  private async fetchTraderJoePrice(tokenPair: TokenPair, exchange: Exchange): Promise<any> {
    const response = await axios.get(`${exchange.apiEndpoint}/pairs/${tokenPair.baseTokenAddress}/${tokenPair.quoteTokenAddress}`);
    
    if (response.data && response.data.data) {
      const data = response.data.data;
      return {
        price: parseFloat(data.priceUsd || data.price),
        volume24h: parseFloat(data.volume24h || 0),
        liquidity: parseFloat(data.liquidity || 0),
        high24h: parseFloat(data.high24h),
        low24h: parseFloat(data.low24h),
        priceChange24h: parseFloat(data.priceChange24h || 0),
        volumeChange24h: parseFloat(data.volumeChange24h || 0),
        metadata: data
      };
    }
    return null;
  }

  /**
   * Fetch price from Pangolin
   */
  private async fetchPangolinPrice(tokenPair: TokenPair, exchange: Exchange): Promise<any> {
    const response = await axios.get(`${exchange.apiEndpoint}/pairs/${tokenPair.baseTokenAddress}/${tokenPair.quoteTokenAddress}`);
    
    if (response.data) {
      const data = response.data;
      return {
        price: parseFloat(data.price || 0),
        volume24h: parseFloat(data.volume24h || 0),
        liquidity: parseFloat(data.liquidity || 0),
        high24h: parseFloat(data.high24h),
        low24h: parseFloat(data.low24h),
        priceChange24h: parseFloat(data.priceChange24h || 0),
        volumeChange24h: parseFloat(data.volumeChange24h || 0),
        metadata: data
      };
    }
    return null;
  }

  /**
   * Fetch price from Sushi
   */
  private async fetchSushiPrice(tokenPair: TokenPair, exchange: Exchange): Promise<any> {
    const response = await axios.get(`${exchange.apiEndpoint}/pairs/${tokenPair.baseTokenAddress}/${tokenPair.quoteTokenAddress}`);
    
    if (response.data) {
      const data = response.data;
      return {
        price: parseFloat(data.price || 0),
        volume24h: parseFloat(data.volume24h || 0),
        liquidity: parseFloat(data.liquidity || 0),
        high24h: parseFloat(data.high24h),
        low24h: parseFloat(data.low24h),
        priceChange24h: parseFloat(data.priceChange24h || 0),
        volumeChange24h: parseFloat(data.volumeChange24h || 0),
        metadata: data
      };
    }
    return null;
  }

  /**
   * Save prices to database
   */
  private async savePrices(prices: PriceData[]): Promise<void> {
    try {
      const priceRepository = getRepository(PriceData);
      await priceRepository.save(prices);
      logger.debug(`Saved ${prices.length} price records to database`);
    } catch (error) {
      logger.error('Error saving prices to database:', error);
      throw error;
    }
  }

  /**
   * Detect arbitrage opportunities from current prices
   */
  private async detectArbitrageOpportunities(): Promise<void> {
    try {
      const tokenPairs = await getRepository(TokenPair).find({
        where: { isActive: true }
      });

      const opportunities: PriceComparison[] = [];

      for (const pair of tokenPairs) {
        const pairPrices = Array.from(this.priceCache.values())
          .filter(price => price.tokenPairId === pair.id)
          .sort((a, b) => a.price - b.price);

        if (pairPrices.length >= 2) {
          const lowestPrice = pairPrices[0];
          const highestPrice = pairPrices[pairPrices.length - 1];

          const priceDifference = highestPrice.price - lowestPrice.price;
          const priceDifferencePercent = (priceDifference / lowestPrice.price) * 100;

          if (priceDifferencePercent >= tradingConfig.minProfitThreshold) {
            const opportunity: PriceComparison = {
              tokenPair: `${pair.baseToken}/${pair.quoteToken}`,
              sourceExchange: lowestPrice.source,
              targetExchange: highestPrice.source,
              sourcePrice: lowestPrice.price,
              targetPrice: highestPrice.price,
              priceDifference,
              priceDifferencePercent,
              volume24h: Math.min(lowestPrice.volume24h, highestPrice.volume24h),
              liquidity: Math.min(lowestPrice.liquidity, highestPrice.liquidity),
              timestamp: new Date()
            };

            opportunities.push(opportunity);
          }
        }
      }

      if (opportunities.length > 0) {
        this.emit('opportunitiesDetected', opportunities);
        logger.info(`Detected ${opportunities.length} arbitrage opportunities`);
      }

    } catch (error) {
      logger.error('Error detecting arbitrage opportunities:', error);
    }
  }

  /**
   * Validate price data
   */
  private isValidPrice(priceData: any): boolean {
    return (
      priceData &&
      typeof priceData.price === 'number' &&
      priceData.price > 0 &&
      !isNaN(priceData.price) &&
      isFinite(priceData.price)
    );
  }

  /**
   * Detect price anomalies
   */
  private detectPriceAnomaly(priceData: any, tokenPair: TokenPair, exchange: Exchange): boolean {
    // Simple anomaly detection based on price deviation
    const cacheKey = this.getCacheKey({ tokenPairId: tokenPair.id, exchangeId: exchange.id } as PriceData);
    const cachedPrice = this.priceCache.get(cacheKey);

    if (cachedPrice) {
      const priceChange = Math.abs(priceData.price - cachedPrice.price) / cachedPrice.price;
      return priceChange > 0.1; // 10% price change threshold
    }

    return false;
  }

  /**
   * Get cache key for price data
   */
  private getCacheKey(priceData: PriceData): string {
    return `${priceData.tokenPairId}_${priceData.exchangeId}`;
  }

  /**
   * Get current prices for a token pair
   */
  async getCurrentPrices(tokenPairId: string): Promise<PriceData[]> {
    const prices = Array.from(this.priceCache.values())
      .filter(price => price.tokenPairId === tokenPairId);
    
    return prices.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get price history for a token pair and exchange
   */
  async getPriceHistory(
    tokenPairId: string,
    exchangeId: string,
    hours: number = 24
  ): Promise<PriceData[]> {
    const priceRepository = getRepository(PriceData);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return await priceRepository.find({
      where: {
        tokenPairId,
        exchangeId,
        timestamp: { $gte: since } as any
      },
      order: { timestamp: 'ASC' }
    });
  }

  /**
   * Get system status
   */
  getStatus(): {
    isRunning: boolean;
    lastUpdate: Date;
    cacheSize: number;
    activePairs: number;
  } {
    const activePairs = new Set(Array.from(this.priceCache.values()).map(p => p.tokenPairId)).size;

    return {
      isRunning: this.isRunning,
      lastUpdate: this.lastUpdate,
      cacheSize: this.priceCache.size,
      activePairs
    };
  }
}

// Export singleton instance
export const priceMonitoringService = new PriceMonitoringService();
