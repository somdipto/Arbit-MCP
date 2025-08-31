import { EventEmitter } from 'events';
import { Pool, PoolClient } from 'pg';
import { logger } from '@/utils/logger';
import { 
  ArbitrageOpportunity, 
  Trade, 
  TradeResult, 
  PriceData,
  RiskAssessment,
  MEVRisk,
  GasOptimizationResult,
  OptimizationResult
} from '@/types/arbitrage';

export class DatabaseService extends EventEmitter {
  private pool: Pool;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private maxRetries: number = 5;
  private retryDelay: number = 5000;

  constructor() {
    super();
    
    // Initialize database connection pool
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'csab',
      user: process.env.DB_USER || 'csab_user',
      password: process.env.DB_PASSWORD || 'csab_password',
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    this.setupEventListeners();
  }

  /**
   * Setup database event listeners
   */
  private setupEventListeners(): void {
    this.pool.on('connect', (client: PoolClient) => {
      logger.debug('New database client connected');
    });

    this.pool.on('error', (err: Error) => {
      logger.error('Database pool error:', err);
      this.emit('databaseError', err);
    });

    this.pool.on('remove', (client: PoolClient) => {
      logger.debug('Database client removed from pool');
    });
  }

  /**
   * Initialize database service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing database service...');
      
      // Test database connection
      await this.testConnection();
      
      // Create database tables if they don't exist
      await this.createTables();
      
      // Initialize indexes
      await this.createIndexes();
      
      this.isConnected = true;
      logger.info('Database service initialized successfully');
      
      this.emit('databaseReady');
      
    } catch (error) {
      logger.error('Failed to initialize database service:', error);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('Database connection test successful');
      
    } catch (error) {
      logger.error('Database connection test failed:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      // Create arbitrage opportunities table
      await client.query(`
        CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
          id VARCHAR(255) PRIMARY KEY,
          token_pair_base VARCHAR(50) NOT NULL,
          token_pair_quote VARCHAR(50) NOT NULL,
          buy_exchange VARCHAR(100) NOT NULL,
          sell_exchange VARCHAR(100) NOT NULL,
          buy_price DECIMAL(20, 8) NOT NULL,
          sell_price DECIMAL(20, 8) NOT NULL,
          expected_profit_usd DECIMAL(20, 2) NOT NULL,
          expected_profit_percentage DECIMAL(10, 4) NOT NULL,
          optimal_trade_size DECIMAL(20, 8) NOT NULL,
          gas_estimate_total_gas INTEGER NOT NULL,
          gas_estimate_total_cost DECIMAL(20, 8) NOT NULL,
          risk_score DECIMAL(5, 4) NOT NULL,
          mev_risk_level VARCHAR(20) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create trades table
      await client.query(`
        CREATE TABLE IF NOT EXISTS trades (
          id VARCHAR(255) PRIMARY KEY,
          opportunity_id VARCHAR(255) REFERENCES arbitrage_opportunities(id),
          buy_transaction_hash VARCHAR(255),
          sell_transaction_hash VARCHAR(255),
          buy_amount DECIMAL(20, 8) NOT NULL,
          sell_amount DECIMAL(20, 8) NOT NULL,
          actual_profit_usd DECIMAL(20, 2),
          actual_profit_percentage DECIMAL(10, 4),
          gas_used INTEGER,
          gas_cost DECIMAL(20, 8),
          status VARCHAR(50) DEFAULT 'pending',
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create price_data table
      await client.query(`
        CREATE TABLE IF NOT EXISTS price_data (
          id SERIAL PRIMARY KEY,
          exchange VARCHAR(100) NOT NULL,
          base_token VARCHAR(50) NOT NULL,
          quote_token VARCHAR(50) NOT NULL,
          price DECIMAL(20, 8) NOT NULL,
          volume_24h DECIMAL(20, 2),
          liquidity DECIMAL(20, 2),
          timestamp TIMESTAMP NOT NULL,
          source VARCHAR(50) NOT NULL,
          confidence DECIMAL(5, 4) DEFAULT 1.0
        )
      `);

      // Create risk_assessments table
      await client.query(`
        CREATE TABLE IF NOT EXISTS risk_assessments (
          id SERIAL PRIMARY KEY,
          trade_id VARCHAR(255) NOT NULL,
          overall_risk DECIMAL(5, 4) NOT NULL,
          risk_level VARCHAR(20) NOT NULL,
          factors JSONB NOT NULL,
          recommendations TEXT[] NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create mev_risks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS mev_risks (
          id SERIAL PRIMARY KEY,
          opportunity_id VARCHAR(255) NOT NULL,
          risk_level VARCHAR(20) NOT NULL,
          risk_score DECIMAL(5, 4) NOT NULL,
          factors JSONB NOT NULL,
          recommendations TEXT[] NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create gas_optimizations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS gas_optimizations (
          id SERIAL PRIMARY KEY,
          trade_id VARCHAR(255) NOT NULL,
          original_gas INTEGER NOT NULL,
          optimized_gas INTEGER NOT NULL,
          savings INTEGER NOT NULL,
          savings_percent DECIMAL(10, 4) NOT NULL,
          strategy VARCHAR(100) NOT NULL,
          recommendations TEXT[] NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create profit_optimizations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS profit_optimizations (
          id SERIAL PRIMARY KEY,
          original_size DECIMAL(20, 8) NOT NULL,
          optimized_size DECIMAL(20, 8) NOT NULL,
          expected_profit DECIMAL(20, 2) NOT NULL,
          optimized_profit DECIMAL(20, 2) NOT NULL,
          improvement DECIMAL(10, 4) NOT NULL,
          factors JSONB NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create system_metrics table
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_metrics (
          id SERIAL PRIMARY KEY,
          metric_name VARCHAR(100) NOT NULL,
          metric_value DECIMAL(20, 8) NOT NULL,
          metric_unit VARCHAR(50),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      client.release();
      logger.info('Database tables created successfully');
      
    } catch (error) {
      logger.error('Error creating database tables:', error);
      throw error;
    }
  }

  /**
   * Create database indexes
   */
  private async createIndexes(): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      // Create indexes for better query performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_opportunities_token_pair 
        ON arbitrage_opportunities(token_pair_base, token_pair_quote)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_opportunities_status 
        ON arbitrage_opportunities(status)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_opportunities_created_at 
        ON arbitrage_opportunities(created_at)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_trades_opportunity_id 
        ON trades(opportunity_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_trades_status 
        ON trades(status)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_price_data_exchange_token 
        ON price_data(exchange, base_token, quote_token)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_price_data_timestamp 
        ON price_data(timestamp)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_risk_assessments_trade_id 
        ON risk_assessments(trade_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_mev_risks_opportunity_id 
        ON mev_risks(opportunity_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_gas_optimizations_trade_id 
        ON gas_optimizations(trade_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp 
        ON system_metrics(metric_name, timestamp)
      `);

      client.release();
      logger.info('Database indexes created successfully');
      
    } catch (error) {
      logger.error('Error creating database indexes:', error);
      throw error;
    }
  }

  /**
   * Save arbitrage opportunity
   */
  async saveOpportunity(opportunity: ArbitrageOpportunity): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO arbitrage_opportunities (
          id, token_pair_base, token_pair_quote, buy_exchange, sell_exchange,
          buy_price, sell_price, expected_profit_usd, expected_profit_percentage,
          optimal_trade_size, gas_estimate_total_gas, gas_estimate_total_cost,
          risk_score, mev_risk_level, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          updated_at = CURRENT_TIMESTAMP,
          status = EXCLUDED.status
      `;

      const values = [
        opportunity.id,
        opportunity.tokenPair.baseToken,
        opportunity.tokenPair.quoteToken,
        opportunity.buyExchange,
        opportunity.sellExchange,
        opportunity.buyPrice,
        opportunity.sellPrice,
        opportunity.expectedProfit.usd,
        opportunity.expectedProfit.percentage,
        opportunity.optimalTradeSize,
        opportunity.gasEstimate.totalGas,
        opportunity.gasEstimate.totalCost,
        opportunity.riskScore || 0,
        opportunity.mevRisk?.level || 'low',
        opportunity.status || 'pending'
      ];

      await client.query(query, values);
      client.release();
      
      logger.debug(`Saved arbitrage opportunity: ${opportunity.id}`);
      
    } catch (error) {
      logger.error(`Error saving arbitrage opportunity ${opportunity.id}:`, error);
      throw error;
    }
  }

  /**
   * Save trade
   */
  async saveTrade(trade: Trade): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO trades (
          id, opportunity_id, buy_transaction_hash, sell_transaction_hash,
          buy_amount, sell_amount, actual_profit_usd, actual_profit_percentage,
          gas_used, gas_cost, status, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          updated_at = CURRENT_TIMESTAMP,
          status = EXCLUDED.status,
          actual_profit_usd = EXCLUDED.actual_profit_usd,
          actual_profit_percentage = EXCLUDED.actual_profit_percentage,
          gas_used = EXCLUDED.gas_used,
          gas_cost = EXCLUDED.gas_cost,
          error_message = EXCLUDED.error_message
      `;

      const values = [
        trade.id,
        trade.opportunityId,
        trade.buyTransaction?.hash || null,
        trade.sellTransaction?.hash || null,
        trade.buyAmount,
        trade.sellAmount,
        trade.actualProfit?.usd || null,
        trade.actualProfit?.percentage || null,
        trade.gasUsed || null,
        trade.gasCost || null,
        trade.status,
        trade.errorMessage || null
      ];

      await client.query(query, values);
      client.release();
      
      logger.debug(`Saved trade: ${trade.id}`);
      
    } catch (error) {
      logger.error(`Error saving trade ${trade.id}:`, error);
      throw error;
    }
  }

  /**
   * Save price data
   */
  async savePriceData(priceData: PriceData): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO price_data (
          exchange, base_token, quote_token, price, volume_24h, liquidity,
          timestamp, source, confidence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;

      const values = [
        priceData.exchange,
        priceData.baseToken,
        priceData.quoteToken,
        priceData.price,
        priceData.volume24h,
        priceData.liquidity,
        priceData.timestamp,
        priceData.source,
        priceData.confidence
      ];

      await client.query(query, values);
      client.release();
      
      logger.debug(`Saved price data for ${priceData.baseToken}/${priceData.quoteToken} on ${priceData.exchange}`);
      
    } catch (error) {
      logger.error('Error saving price data:', error);
      throw error;
    }
  }

  /**
   * Save risk assessment
   */
  async saveRiskAssessment(assessment: RiskAssessment): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO risk_assessments (
          trade_id, overall_risk, risk_level, factors, recommendations
        ) VALUES ($1, $2, $3, $4, $5)
      `;

      const values = [
        assessment.tradeId,
        assessment.overallRisk,
        assessment.riskLevel,
        JSON.stringify(assessment.factors),
        assessment.recommendations
      ];

      await client.query(query, values);
      client.release();
      
      logger.debug(`Saved risk assessment for trade: ${assessment.tradeId}`);
      
    } catch (error) {
      logger.error(`Error saving risk assessment for trade ${assessment.tradeId}:`, error);
      throw error;
    }
  }

  /**
   * Save MEV risk
   */
  async saveMEVRisk(mevRisk: MEVRisk): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO mev_risks (
          opportunity_id, risk_level, risk_score, factors, recommendations
        ) VALUES ($1, $2, $3, $4, $5)
      `;

      const values = [
        mevRisk.opportunityId || 'unknown',
        mevRisk.level,
        mevRisk.score,
        JSON.stringify(mevRisk.factors),
        mevRisk.recommendations
      ];

      await client.query(query, values);
      client.release();
      
      logger.debug(`Saved MEV risk assessment`);
      
    } catch (error) {
      logger.error('Error saving MEV risk:', error);
      throw error;
    }
  }

  /**
   * Save gas optimization result
   */
  async saveGasOptimizationResult(result: GasOptimizationResult): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO gas_optimizations (
          trade_id, original_gas, optimized_gas, savings, savings_percent,
          strategy, recommendations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      const values = [
        result.tradeId || 'unknown',
        result.originalGas,
        result.optimizedGas,
        result.savings,
        result.savingsPercent,
        result.strategy,
        result.recommendations
      ];

      await client.query(query, values);
      client.release();
      
      logger.debug(`Saved gas optimization result`);
      
    } catch (error) {
      logger.error('Error saving gas optimization result:', error);
      throw error;
    }
  }

  /**
   * Save profit optimization result
   */
  async saveOptimizationResult(result: OptimizationResult): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO profit_optimizations (
          original_size, optimized_size, expected_profit, optimized_profit,
          improvement, factors
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;

      const values = [
        result.originalSize,
        result.optimizedSize,
        result.expectedProfit,
        result.optimizedProfit,
        result.improvement,
        JSON.stringify(result.factors)
      ];

      await client.query(query, values);
      client.release();
      
      logger.debug(`Saved profit optimization result`);
      
    } catch (error) {
      logger.error('Error saving profit optimization result:', error);
      throw error;
    }
  }

  /**
   * Save system metric
   */
  async saveSystemMetric(name: string, value: number, unit?: string): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      const query = `
        INSERT INTO system_metrics (metric_name, metric_value, metric_unit)
        VALUES ($1, $2, $3)
      `;

      const values = [name, value, unit || null];

      await client.query(query, values);
      client.release();
      
      logger.debug(`Saved system metric: ${name} = ${value}${unit ? ' ' + unit : ''}`);
      
    } catch (error) {
      logger.error(`Error saving system metric ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get arbitrage opportunities
   */
  async getOpportunities(limit: number = 100, status?: string): Promise<ArbitrageOpportunity[]> {
    try {
      const client = await this.pool.connect();
      
      let query = `
        SELECT * FROM arbitrage_opportunities
        ORDER BY created_at DESC
        LIMIT $1
      `;
      
      let values = [limit];
      
      if (status) {
        query = `
          SELECT * FROM arbitrage_opportunities
          WHERE status = $2
          ORDER BY created_at DESC
          LIMIT $1
        `;
        values = [limit, status];
      }

      const result = await client.query(query, values);
      client.release();
      
      // Convert database rows to ArbitrageOpportunity objects
      const opportunities = result.rows.map(row => this.mapRowToOpportunity(row));
      
      logger.debug(`Retrieved ${opportunities.length} arbitrage opportunities`);
      return opportunities;
      
    } catch (error) {
      logger.error('Error retrieving arbitrage opportunities:', error);
      throw error;
    }
  }

  /**
   * Get trades
   */
  async getTrades(limit: number = 100, status?: string): Promise<Trade[]> {
    try {
      const client = await this.pool.connect();
      
      let query = `
        SELECT * FROM trades
        ORDER BY created_at DESC
        LIMIT $1
      `;
      
      let values = [limit];
      
      if (status) {
        query = `
          SELECT * FROM trades
          WHERE status = $2
          ORDER BY created_at DESC
          LIMIT $1
        `;
        values = [limit, status];
      }

      const result = await client.query(query, values);
      client.release();
      
      // Convert database rows to Trade objects
      const trades = result.rows.map(row => this.mapRowToTrade(row));
      
      logger.debug(`Retrieved ${trades.length} trades`);
      return trades;
      
    } catch (error) {
      logger.error('Error retrieving trades:', error);
      throw error;
    }
  }

  /**
   * Get price data
   */
  async getPriceData(
    baseToken: string,
    quoteToken: string,
    exchange?: string,
    hours: number = 24
  ): Promise<PriceData[]> {
    try {
      const client = await this.pool.connect();
      
      let query = `
        SELECT * FROM price_data
        WHERE base_token = $1 AND quote_token = $2
        AND timestamp >= NOW() - INTERVAL '${hours} hours'
        ORDER BY timestamp DESC
      `;
      
      let values = [baseToken, quoteToken];
      
      if (exchange) {
        query = `
          SELECT * FROM price_data
          WHERE base_token = $1 AND quote_token = $2 AND exchange = $3
          AND timestamp >= NOW() - INTERVAL '${hours} hours'
          ORDER BY timestamp DESC
        `;
        values = [baseToken, quoteToken, exchange];
      }

      const result = await client.query(query, values);
      client.release();
      
      // Convert database rows to PriceData objects
      const priceData = result.rows.map(row => this.mapRowToPriceData(row));
      
      logger.debug(`Retrieved ${priceData.length} price data records for ${baseToken}/${quoteToken}`);
      return priceData;
      
    } catch (error) {
      logger.error('Error retrieving price data:', error);
      throw error;
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(metricName: string, hours: number = 24): Promise<any[]> {
    try {
      const client = await this.pool.connect();
      
      const query = `
        SELECT * FROM system_metrics
        WHERE metric_name = $1
        AND timestamp >= NOW() - INTERVAL '${hours} hours'
        ORDER BY timestamp DESC
      `;

      const result = await client.query(query, [metricName]);
      client.release();
      
      logger.debug(`Retrieved ${result.rows.length} system metrics for ${metricName}`);
      return result.rows;
      
    } catch (error) {
      logger.error(`Error retrieving system metrics for ${metricName}:`, error);
      throw error;
    }
  }

  /**
   * Map database row to ArbitrageOpportunity
   */
  private mapRowToOpportunity(row: any): ArbitrageOpportunity {
    return {
      id: row.id,
      tokenPair: {
        baseToken: row.token_pair_base,
        quoteToken: row.token_pair_quote,
        baseTokenAddress: '',
        quoteTokenAddress: '',
        baseTokenDecimals: 18,
        quoteTokenDecimals: 6,
        baseTokenSymbol: row.token_pair_base,
        quoteTokenSymbol: row.token_pair_quote
      },
      buyExchange: row.buy_exchange,
      sellExchange: row.sell_exchange,
      buyPrice: parseFloat(row.buy_price),
      sellPrice: parseFloat(row.sell_price),
      expectedProfit: {
        usd: parseFloat(row.expected_profit_usd),
        percentage: parseFloat(row.expected_profit_percentage)
      },
      optimalTradeSize: parseFloat(row.optimal_trade_size),
      gasEstimate: {
        totalGas: parseInt(row.gas_estimate_total_gas),
        totalCost: parseFloat(row.gas_estimate_total_cost)
      },
      riskScore: parseFloat(row.risk_score),
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    } as ArbitrageOpportunity;
  }

  /**
   * Map database row to Trade
   */
  private mapRowToTrade(row: any): Trade {
    return {
      id: row.id,
      opportunityId: row.opportunity_id,
      buyAmount: parseFloat(row.buy_amount),
      sellAmount: parseFloat(row.sell_amount),
      actualProfit: row.actual_profit_usd ? {
        usd: parseFloat(row.actual_profit_usd),
        percentage: parseFloat(row.actual_profit_percentage)
      } : undefined,
      gasUsed: row.gas_used ? parseInt(row.gas_used) : undefined,
      gasCost: row.gas_cost ? parseFloat(row.gas_cost) : undefined,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    } as Trade;
  }

  /**
   * Map database row to PriceData
   */
  private mapRowToPriceData(row: any): PriceData {
    return {
      exchange: row.exchange,
      baseToken: row.base_token,
      quoteToken: row.quote_token,
      price: parseFloat(row.price),
      volume24h: row.volume_24h ? parseFloat(row.volume_24h) : 0,
      liquidity: row.liquidity ? parseFloat(row.liquidity) : 0,
      timestamp: new Date(row.timestamp),
      source: row.source,
      confidence: parseFloat(row.confidence),
      lastUpdate: new Date(row.timestamp)
    } as PriceData;
  }

  /**
   * Save risk state
   */
  async saveRiskState(state: any): Promise<void> {
    try {
      // This would save risk state to database
      // For now, just log it
      logger.debug('Risk state saved:', state);
      
    } catch (error) {
      logger.error('Error saving risk state:', error);
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<any> {
    try {
      const client = await this.pool.connect();
      
      const stats = {};
      
      // Get table row counts
      const tables = [
        'arbitrage_opportunities', 'trades', 'price_data', 'risk_assessments',
        'mev_risks', 'gas_optimizations', 'profit_optimizations', 'system_metrics'
      ];
      
      for (const table of tables) {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        stats[table] = parseInt(result.rows[0].count);
      }
      
      // Get database size
      const sizeResult = await client.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);
      stats.databaseSize = sizeResult.rows[0].size;
      
      client.release();
      
      return stats;
      
    } catch (error) {
      logger.error('Error getting database statistics:', error);
      return {};
    }
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      isConnected: this.isConnected,
      connectionRetries: this.connectionRetries,
      maxRetries: this.maxRetries,
      poolSize: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Close all connections in the pool
      await this.pool.end();
      
      this.isConnected = false;
      logger.info('Database service cleaned up');
      
    } catch (error) {
      logger.error('Error cleaning up database service:', error);
    }
  }
}
