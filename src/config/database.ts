import { DataSource } from 'typeorm';
import { databaseConfig } from '@/config';
import { User } from '@/models/User';
import { UserSession } from '@/models/UserSession';
import { Wallet } from '@/models/Wallet';
import { WalletBalance } from '@/models/WalletBalance';
import { TokenPair } from '@/models/TokenPair';
import { Exchange } from '@/models/Exchange';
import { PriceData } from '@/models/PriceData';
import { ArbitrageOpportunity } from '@/models/ArbitrageOpportunity';
import { Trade } from '@/models/Trade';
import { Verification } from '@/models/Verification';
import { Alert } from '@/models/Alert';

// Create TypeORM DataSource
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: databaseConfig.host,
  port: databaseConfig.port,
  username: databaseConfig.username,
  password: databaseConfig.password,
  database: databaseConfig.database,
  ssl: databaseConfig.ssl,
  synchronize: process.env.NODE_ENV === 'development', // Only in development
  logging: process.env.NODE_ENV === 'development',
  entities: [
    User,
    UserSession,
    Wallet,
    WalletBalance,
    TokenPair,
    Exchange,
    PriceData,
    ArbitrageOpportunity,
    Trade,
    Verification,
    Alert
  ],
  migrations: ['src/migrations/*.ts'],
  subscribers: ['src/subscribers/*.ts'],
  // Pool configuration handled by extra options
  extra: {
    max: databaseConfig.pool.max,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: databaseConfig.pool.idleTimeoutMillis
  }
});

// Initialize database connection
export const initializeDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw error;
  }
};

// Close database connection
export const closeDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.destroy();
    console.log('Database connection closed successfully');
  } catch (error) {
    console.error('Error closing database connection:', error);
    throw error;
  }
};

// Get repository helpers
export const getRepository = <T>(entity: new () => T) => {
  return AppDataSource.getRepository(entity);
};

// Health check
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await AppDataSource.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
};

// Export default data source
export default AppDataSource;
