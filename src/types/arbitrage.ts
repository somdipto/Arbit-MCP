// Core arbitrage types
export interface ArbitrageOpportunity {
  id: string;
  tokenPair: TokenPair;
  buyExchange: Exchange;
  sellExchange: Exchange;
  buyPrice: number;
  sellPrice: number;
  priceSpread: number;
  expectedProfit: ProfitCalculation;
  optimalTradeSize: number;
  timestamp: Date;
  status: 'detected' | 'executing' | 'completed' | 'failed' | 'expired';
  riskScore: number;
  gasEstimate: GasEstimate;
  mevRisk: MEVRisk;
  executionTime?: number;
  actualProfit?: ProfitCalculation;
}

export interface TokenPair {
  baseToken: string;
  quoteToken: string;
  baseTokenAddress: string;
  quoteTokenAddress: string;
  baseTokenDecimals: number;
  quoteTokenDecimals: number;
  baseTokenSymbol: string;
  quoteTokenSymbol: string;
}

export interface Exchange {
  id: string;
  name: string;
  type: 'DEX' | 'CEX' | 'Hybrid';
  network: string;
  rpcUrl: string;
  chainId: number;
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  isActive: boolean;
  tradingFees: TradingFees;
  withdrawalFees: WithdrawalFees;
  minOrderSize: number;
  maxOrderSize: number;
  supportedTokens: string[];
  liquidityPools: LiquidityPool[];
}

export interface TradingFees {
  maker: number;
  taker: number;
  gasMultiplier: number;
}

export interface WithdrawalFees {
  baseToken: number;
  quoteToken: number;
}

export interface LiquidityPool {
  tokenA: string;
  tokenB: string;
  reserveA: number;
  reserveB: number;
  totalSupply: number;
  fee: number;
}

export interface ProfitCalculation {
  percentage: number;
  absolute: number;
  usd: number;
  afterFees: number;
  afterGas: number;
  netProfit: number;
}

export interface GasEstimate {
  buyGas: number;
  sellGas: number;
  totalGas: number;
  gasPrice: number;
  totalCost: number;
  gasLimit: number;
  priorityFee: number;
}

export interface MEVRisk {
  level: 'low' | 'medium' | 'high';
  score: number;
  factors: MEVRiskFactor[];
  recommendations: string[];
}

export interface MEVRiskFactor {
  type: 'frontrunning' | 'sandwich' | 'timebandit' | 'liquidation';
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

// Trade execution types
export interface Trade {
  id: string;
  opportunityId: string;
  tokenPair: TokenPair;
  buyExchange: Exchange;
  sellExchange: Exchange;
  buyPrice: number;
  sellPrice: number;
  tradeSize: number;
  expectedProfit: ProfitCalculation;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  timestamp: Date;
  gasEstimate: GasEstimate;
  buyTransaction?: Transaction;
  sellTransaction?: Transaction;
  actualProfit?: ProfitCalculation;
  gasUsed?: number;
  executionTime?: number;
  error?: string;
  failureTime?: Date;
  completionTime?: Date;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: number;
  gasPrice: string;
  nonce: number;
  data: string;
  chainId: number;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  confirmations: number;
  timestamp: Date;
}

export interface TradeResult {
  success: boolean;
  tradeId: string;
  actualProfit?: ProfitCalculation;
  gasUsed?: number;
  transactionHash?: string;
  executionTime?: number;
  error?: string;
  details?: any;
}

export interface TradeExecutionConfig {
  slippageTolerance: number;
  maxGasPrice: number;
  maxGasLimit: number;
  priorityFee: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

// Price monitoring types
export interface PriceData {
  exchange: string;
  baseToken: string;
  quoteToken: string;
  price: number;
  volume24h: number;
  liquidity: number;
  timestamp: Date;
  source: 'api' | 'websocket' | 'onchain';
  confidence: number;
  lastUpdate: Date;
}

export interface PriceUpdate {
  exchange: string;
  tokenPair: string;
  oldPrice: number;
  newPrice: number;
  priceChange: number;
  priceChangePercent: number;
  timestamp: Date;
}

export interface MarketData {
  exchange: string;
  tokenPair: string;
  price: number;
  volume24h: number;
  liquidity: number;
  bid: number;
  ask: number;
  spread: number;
  timestamp: Date;
}

// Risk management types
export interface RiskAssessment {
  tradeId: string;
  overallRisk: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  recommendations: string[];
  timestamp: Date;
}

export interface RiskFactor {
  type: 'liquidity' | 'volatility' | 'correlation' | 'concentration' | 'regulatory';
  severity: number;
  description: string;
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface RiskLimits {
  maxPositionSize: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  maxCorrelation: number;
  minLiquidity: number;
  maxSlippage: number;
}

// Profit optimization types
export interface OptimizationResult {
  originalSize: number;
  optimizedSize: number;
  expectedProfit: number;
  optimizedProfit: number;
  improvement: number;
  factors: OptimizationFactor[];
}

export interface OptimizationFactor {
  type: 'liquidity' | 'fees' | 'gas' | 'slippage' | 'timing';
  impact: number;
  description: string;
  recommendation: string;
}

// Gas optimization types
export interface GasOptimizationResult {
  originalGas: number;
  optimizedGas: number;
  savings: number;
  savingsPercent: number;
  strategy: string;
  recommendations: string[];
}

// MEV protection types
export interface MEVProtectionResult {
  riskLevel: 'low' | 'medium' | 'high';
  protectionApplied: boolean;
  strategies: string[];
  gasAdjustment: number;
  timingAdjustment: number;
  recommendations: string[];
}

// Database types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  poolSize: number;
  connectionTimeout: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
}

// Notification types
export interface NotificationConfig {
  email: EmailConfig;
  telegram: TelegramConfig;
  slack: SlackConfig;
  webhook: WebhookConfig;
}

export interface EmailConfig {
  enabled: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  recipients: string[];
  templates: {
    tradeSuccess: string;
    tradeFailure: string;
    riskAlert: string;
    systemAlert: string;
  };
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  notifications: {
    tradeSuccess: boolean;
    tradeFailure: boolean;
    riskAlert: boolean;
    systemAlert: boolean;
  };
}

export interface SlackConfig {
  enabled: boolean;
  webhookUrl: string;
  channel: string;
  username: string;
  notifications: {
    tradeSuccess: boolean;
    tradeFailure: boolean;
    riskAlert: boolean;
    systemAlert: boolean;
  };
}

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  headers: Record<string, string>;
  events: string[];
}

// Metrics types
export interface MetricsData {
  timestamp: Date;
  opportunitiesDetected: number;
  tradesExecuted: number;
  successfulTrades: number;
  failedTrades: number;
  totalProfit: number;
  totalVolume: number;
  averageExecutionTime: number;
  gasEfficiency: number;
  successRate: number;
  riskMetrics: RiskMetrics;
}

export interface RiskMetrics {
  averageRiskScore: number;
  highRiskTrades: number;
  maxDrawdown: number;
  sharpeRatio: number;
  var95: number;
}

// Configuration types
export interface ArbitrageConfig {
  general: {
    profitThreshold: number;
    maxTradeSize: number;
    minTradeSize: number;
    maxConcurrentTrades: number;
    slippageTolerance: number;
    executionTimeout: number;
  };
  monitoring: {
    priceUpdateInterval: number;
    opportunityCheckInterval: number;
    healthCheckInterval: number;
    maxPriceAge: number;
  };
  risk: {
    maxDailyLoss: number;
    maxPositionSize: number;
    maxDrawdown: number;
    correlationThreshold: number;
    volatilityThreshold: number;
  };
  gas: {
    maxGasPrice: number;
    priorityFee: number;
    gasLimitMultiplier: number;
    gasOptimization: boolean;
  };
  mev: {
    protectionEnabled: boolean;
    maxMEVRisk: 'low' | 'medium' | 'high';
    timingAdjustment: number;
    gasAdjustment: number;
  };
  notifications: {
    enabled: boolean;
    tradeSuccess: boolean;
    tradeFailure: boolean;
    riskAlert: boolean;
    systemAlert: boolean;
  };
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
  requestId: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// WebSocket event types
export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
}

export interface PriceUpdateEvent extends WebSocketEvent {
  type: 'priceUpdate';
  data: PriceUpdate;
}

export interface OpportunityEvent extends WebSocketEvent {
  type: 'opportunityDetected';
  data: ArbitrageOpportunity;
}

export interface TradeEvent extends WebSocketEvent {
  type: 'tradeUpdate';
  data: Trade;
}

export interface SystemEvent extends WebSocketEvent {
  type: 'systemUpdate';
  data: {
    status: string;
    metrics: MetricsData;
    alerts: string[];
  };
}

// Error types
export interface ArbitrageError extends Error {
  code: string;
  details?: any;
  timestamp: Date;
  context?: string;
}

export interface ValidationError extends ArbitrageError {
  code: 'VALIDATION_ERROR';
  field: string;
  value: any;
  constraint: string;
}

export interface ExecutionError extends ArbitrageError {
  code: 'EXECUTION_ERROR';
  tradeId: string;
  step: string;
  retryable: boolean;
}

export interface NetworkError extends ArbitrageError {
  code: 'NETWORK_ERROR';
  endpoint: string;
  statusCode?: number;
  retryable: boolean;
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Event emitter types
export interface ArbitrageEvents {
  opportunityDetected: (opportunity: ArbitrageOpportunity) => void;
  tradeExecuted: (trade: Trade) => void;
  tradeCompleted: (trade: Trade) => void;
  tradeFailed: (trade: Trade) => void;
  riskAlert: (assessment: RiskAssessment) => void;
  profitTargetReached: (amount: number) => void;
  stopLossTriggered: (amount: number) => void;
  engineStarted: () => void;
  engineStopped: () => void;
  error: (error: ArbitrageError) => void;
}


