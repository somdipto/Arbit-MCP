import dotenv from 'dotenv';
import { SystemConfig, DatabaseConfig, RedisConfig } from '@/types';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'JWT_SECRET',
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'REDIS_HOST',
  'MCP_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Database Configuration
export const databaseConfig: DatabaseConfig = {
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME!,
  username: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  ssl: process.env.DB_SSL === 'true',
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000')
  }
};

// Redis Configuration
export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST!,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || '',
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3')
};

// Server Configuration
export const serverConfig = {
  port: parseInt(process.env.PORT || '3000'),
  apiVersion: process.env.API_VERSION || 'v1',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
};

// JWT Configuration
export const jwtConfig = {
  secret: process.env.JWT_SECRET!,
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
};

// Avalanche Network Configuration
export const avalancheConfig = {
  cChainRpc: process.env.AVALANCHE_C_CHAIN_RPC || 'https://api.avax.network/ext/bc/C/rpc',
  pChainRpc: process.env.AVALANCHE_P_CHAIN_RPC || 'https://api.avax.network/ext/P',
  xChainRpc: process.env.AVALANCHE_X_CHAIN_RPC || 'https://api.avax.network/ext/bc/X',
  subnetFujiRpc: process.env.SUBNET_FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc',
  subnetLocalRpc: process.env.SUBNET_LOCAL_RPC || 'http://localhost:9650/ext/bc/C/rpc'
};

// DEX API Configuration
export const dexConfig = {
  traderJoe: {
    api: process.env.TRADERJOE_API || 'https://barn.traderjoexyz.com/v1',
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 1000
    }
  },
  pangolin: {
    api: process.env.PANGOLIN_API || 'https://api.pangolin.exchange',
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 1000
    }
  },
  sushi: {
    api: process.env.SUSHI_API || 'https://api.sushi.com',
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 1000
    }
  }
};

// MCP Configuration
export const mcpConfig = {
  apiEndpoint: process.env.MCP_API_ENDPOINT || 'https://api.modelcontextprotocol.com',
  apiKey: process.env.MCP_API_KEY!,
  modelId: process.env.MCP_MODEL_ID || 'arbitrage-detector-v1',
  timeoutMs: parseInt(process.env.MCP_TIMEOUT_MS || '5000')
};

// Trading Configuration
export const tradingConfig = {
  minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.5'),
  maxTradeSizeUSD: parseFloat(process.env.MAX_TRADE_SIZE_USD || '10000'),
  minTradeSizeUSD: parseFloat(process.env.MIN_TRADE_SIZE_USD || '100'),
  gasLimitMultiplier: parseFloat(process.env.GAS_LIMIT_MULTIPLIER || '1.2'),
  slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE || '0.5')
};

// Monitoring Configuration
export const monitoringConfig = {
  priceUpdateInterval: parseInt(process.env.PRICE_UPDATE_INTERVAL || '1000'),
  opportunityCheckInterval: parseInt(process.env.OPPORTUNITY_CHECK_INTERVAL || '1000'),
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000')
};

// Logging Configuration
export const loggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  filePath: process.env.LOG_FILE_PATH || './logs/csab.log',
  maxSize: process.env.LOG_MAX_SIZE || '10m',
  maxFiles: process.env.LOG_MAX_FILES || '5'
};

// Security Configuration
export const securityConfig = {
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  sessionTimeoutMs: parseInt(process.env.SESSION_TIMEOUT_MS || '86400000'),
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
};

// Email Configuration
export const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  secure: process.env.SMTP_SECURE === 'true'
};

// WebSocket Configuration
export const websocketConfig = {
  port: parseInt(process.env.WS_PORT || '3001'),
  path: process.env.WS_PATH || '/ws',
  pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000'),
  pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '5000')
};

// Analytics Configuration
export const analyticsConfig = {
  enabled: process.env.ANALYTICS_ENABLED === 'true',
  retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS || '90'),
  aggregationInterval: parseInt(process.env.ANALYTICS_AGGREGATION_INTERVAL || '3600000')
};

// Backup Configuration
export const backupConfig = {
  enabled: process.env.BACKUP_ENABLED === 'true',
  intervalHours: parseInt(process.env.BACKUP_INTERVAL_HOURS || '24'),
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
  path: process.env.BACKUP_PATH || './backups'
};

// Main System Configuration
export const systemConfig: SystemConfig = {
  trading: tradingConfig,
  monitoring: monitoringConfig,
  security: securityConfig,
  mcp: mcpConfig
};

// Export all configurations
export default {
  server: serverConfig,
  database: databaseConfig,
  redis: redisConfig,
  jwt: jwtConfig,
  avalanche: avalancheConfig,
  dex: dexConfig,
  mcp: mcpConfig,
  trading: tradingConfig,
  monitoring: monitoringConfig,
  logging: loggingConfig,
  security: securityConfig,
  email: emailConfig,
  websocket: websocketConfig,
  analytics: analyticsConfig,
  backup: backupConfig,
  system: systemConfig
};
