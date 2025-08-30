// Core Types for CrossSubnet AI Arbitrage Bot

export enum UserRole {
  ADMINISTRATOR = 'administrator',
  TRADER = 'trader',
  ANALYST = 'analyst',
  AUDITOR = 'auditor'
}

export enum TradeStatus {
  PENDING = 'pending',
  EXECUTING = 'executing',
  EXECUTED = 'executed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum OpportunityStatus {
  DETECTED = 'detected',
  ANALYZING = 'analyzing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export enum ExchangeType {
  TRADERJOE = 'traderjoe',
  PANGOLIN = 'pangolin',
  SUSHI = 'sushi',
  UNISWAP = 'uniswap',
  CUSTOM = 'custom'
}

export enum SubnetType {
  C_CHAIN = 'c-chain',
  FUJI = 'fuji',
  LOCAL = 'local',
  CUSTOM = 'custom'
}

export enum AlertType {
  OPPORTUNITY_DETECTED = 'opportunity_detected',
  TRADE_EXECUTED = 'trade_executed',
  TRADE_FAILED = 'trade_failed',
  SYSTEM_ERROR = 'system_error',
  PROFIT_THRESHOLD = 'profit_threshold',
  BALANCE_LOW = 'balance_low'
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

// User Management Types
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

// Wallet Management Types
export interface Wallet {
  id: string;
  userId: string;
  name: string;
  address: string;
  encryptedPrivateKey: string;
  subnet: SubnetType;
  balance: {
    [token: string]: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletBalance {
  walletId: string;
  token: string;
  balance: number;
  usdValue: number;
  lastUpdated: Date;
}

// Token and Exchange Types
export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  isStablecoin: boolean;
  priceUSD?: number;
  lastUpdated?: Date;
}

export interface TokenPair {
  id: string;
  baseToken: string;
  quoteToken: string;
  baseTokenAddress: string;
  quoteTokenAddress: string;
  isActive: boolean;
  minTradeSize: number;
  maxTradeSize: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Exchange {
  id: string;
  name: string;
  type: ExchangeType;
  subnet: SubnetType;
  apiEndpoint: string;
  isActive: boolean;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  supportedTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Price Data Types
export interface PriceData {
  id: string;
  tokenPairId: string;
  exchangeId: string;
  price: number;
  volume24h: number;
  liquidity: number;
  timestamp: Date;
  source: string;
}

export interface PriceComparison {
  tokenPair: string;
  sourceExchange: string;
  targetExchange: string;
  sourcePrice: number;
  targetPrice: number;
  priceDifference: number;
  priceDifferencePercent: number;
  volume24h: number;
  liquidity: number;
  timestamp: Date;
}

// Opportunity Detection Types
export interface ArbitrageOpportunity {
  id: string;
  tokenPairId: string;
  sourceExchangeId: string;
  targetExchangeId: string;
  priceDifferencePercent: number;
  expectedProfitPercent: number;
  expectedProfitUSD: number;
  confidence: number;
  riskScore: number;
  status: OpportunityStatus;
  reasoning: string[];
  detectedAt: Date;
  expiresAt: Date;
  mcpContext: MCPContext;
}

export interface MCPContext {
  modelId: string;
  inputFactors: {
    prices: Record<string, number>;
    gasPrices: Record<string, number>;
    liquidity: Record<string, number>;
    volatility: Record<string, number>;
    historicalPerformance: {
      successRate: number;
      averageProfit: number;
      averageSlippage: number;
    };
  };
  reasoningChain: string[];
  confidence: number;
  verificationProof: string;
}

// Trade Execution Types
export interface Trade {
  id: string;
  opportunityId: string;
  walletId: string;
  tokenPair: string;
  sourceExchange: string;
  targetExchange: string;
  inputAmount: number;
  outputAmount: number;
  expectedProfit: number;
  actualProfit?: number;
  gasUsed?: number;
  gasPrice?: number;
  sourceTxHash?: string;
  targetTxHash?: string;
  status: TradeStatus;
  errorMessage?: string;
  executedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionPlan {
  opportunityId: string;
  steps: ExecutionStep[];
  estimatedGas: number;
  estimatedProfit: number;
  riskAssessment: RiskAssessment;
  fallbackPlan?: ExecutionPlan;
}

export interface ExecutionStep {
  order: number;
  action: 'approve' | 'swap' | 'bridge' | 'transfer';
  exchange: string;
  token: string;
  amount: number;
  gasEstimate: number;
  description: string;
}

export interface RiskAssessment {
  slippageRisk: number;
  executionRisk: number;
  liquidityRisk: number;
  overallRisk: number;
  recommendations: string[];
}

// Verification Types
export interface Verification {
  id: string;
  tradeId: string;
  reasoningChainHash: string;
  onChainProofId: string;
  reasoningData: MCPContext;
  verificationProof: string;
  createdAt: Date;
}

// Analytics Types
export interface PerformanceMetrics {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalProfit: number;
  totalVolume: number;
  averageProfitPerTrade: number;
  successRate: number;
  averageExecutionTime: number;
  gasSpent: number;
  period: {
    start: Date;
    end: Date;
  };
}

export interface TokenPairPerformance {
  tokenPair: string;
  trades: number;
  profit: number;
  volume: number;
  successRate: number;
  averageProfit: number;
}

export interface ExchangePerformance {
  exchange: string;
  trades: number;
  profit: number;
  volume: number;
  successRate: number;
  averageProfit: number;
}

// Alert Types
export interface Alert {
  id: string;
  userId: string;
  type: AlertType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  readAt?: Date;
}

// Configuration Types
export interface SystemConfig {
  trading: {
    minProfitThreshold: number;
    maxTradeSizeUSD: number;
    minTradeSizeUSD: number;
    gasLimitMultiplier: number;
    slippageTolerance: number;
  };
  monitoring: {
    priceUpdateInterval: number;
    opportunityCheckInterval: number;
    healthCheckInterval: number;
  };
  security: {
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
    sessionTimeoutMs: number;
  };
  mcp: {
    apiEndpoint: string;
    apiKey: string;
    modelId: string;
    timeoutMs: number;
  };
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
}

export interface WebSocketEvent {
  opportunity: ArbitrageOpportunity;
  trade: Trade;
  alert: Alert;
  systemStatus: SystemStatus;
}

export interface SystemStatus {
  uptime: number;
  activeConnections: number;
  lastOpportunityCheck: Date;
  lastTradeExecution: Date;
  systemHealth: 'healthy' | 'degraded' | 'unhealthy';
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Database Types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  pool: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
  };
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
}

// Logging Types
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  userId?: string;
  requestId?: string;
  error?: Error;
}

// Error Types
export class CSAABError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'CSAABError';
  }
}

export class ValidationError extends CSAABError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends CSAABError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends CSAABError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends CSAABError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND_ERROR', 404);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends CSAABError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
  }
}
