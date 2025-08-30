import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Import configurations
import { serverConfig, securityConfig } from '@/config';
import { initializeDatabase, closeDatabase } from '@/config/database';

// Import services
import { priceMonitoringService } from '@/services/PriceMonitoringService';
import { mcpService } from '@/services/MCPService';

// Import utilities
import { logger, logSystemHealth } from '@/utils/logger';

// Import middleware
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';
import { rateLimiter } from '@/middleware/rateLimiter';
import { authMiddleware } from '@/middleware/auth';

// Import routes
import { authRoutes } from '@/controllers/authController';
import { opportunityRoutes } from '@/controllers/opportunityController';
import { tradeRoutes } from '@/controllers/tradeController';
import { analyticsRoutes } from '@/controllers/analyticsController';
import { systemRoutes } from '@/controllers/systemController';

class CSAABApplication {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: serverConfig.corsOrigin,
        methods: ['GET', 'POST']
      }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: serverConfig.corsOrigin,
      credentials: true
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(requestLogger);

    // Rate limiting
    this.app.use(rateLimiter);

    // Health check endpoint (no auth required)
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
      });
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    const apiPrefix = `/api/${serverConfig.apiVersion}`;

    // Public routes
    this.app.use(`${apiPrefix}/auth`, authRoutes);

    // Protected routes
    this.app.use(`${apiPrefix}/opportunities`, authMiddleware, opportunityRoutes);
    this.app.use(`${apiPrefix}/trades`, authMiddleware, tradeRoutes);
    this.app.use(`${apiPrefix}/analytics`, authMiddleware, analyticsRoutes);
    this.app.use(`${apiPrefix}/system`, authMiddleware, systemRoutes);

    // API documentation
    this.app.get(`${apiPrefix}/docs`, (req, res) => {
      res.json({
        message: 'CSAAB API Documentation',
        version: '1.0.0',
        endpoints: {
          auth: `${apiPrefix}/auth`,
          opportunities: `${apiPrefix}/opportunities`,
          trades: `${apiPrefix}/trades`,
          analytics: `${apiPrefix}/analytics`,
          system: `${apiPrefix}/system`
        }
      });
    });
  }

  /**
   * Setup WebSocket connections
   */
  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      logger.info(`WebSocket client connected: ${socket.id}`);

      // Join user to their room for personalized updates
      socket.on('join', (data) => {
        if (data.userId) {
          socket.join(`user_${data.userId}`);
          logger.info(`User ${data.userId} joined WebSocket room`);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`WebSocket client disconnected: ${socket.id}`);
      });
    });

    // Broadcast price updates
    priceMonitoringService.on('pricesUpdated', (prices) => {
      this.io.emit('priceUpdate', {
        timestamp: new Date(),
        prices: prices.length
      });
    });

    // Broadcast opportunity updates
    priceMonitoringService.on('opportunitiesDetected', (opportunities) => {
      this.io.emit('opportunityUpdate', {
        timestamp: new Date(),
        opportunities: opportunities.length
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.originalUrl
      });
    });

    // Global error handler
    this.app.use(errorHandler);
  }

  /**
   * Initialize application services
   */
  private async initializeServices(): Promise<void> {
    try {
      // Initialize database
      await initializeDatabase();
      logSystemHealth('database', 'healthy');

      // Check MCP service health
      const mcpHealthy = await mcpService.checkHealth();
      logSystemHealth('mcp', mcpHealthy ? 'healthy' : 'unhealthy');

      // Start price monitoring
      await priceMonitoringService.start();
      logSystemHealth('price-monitoring', 'healthy');

      logger.info('All services initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    try {
      // Initialize services
      await this.initializeServices();

      // Start server
      this.server.listen(serverConfig.port, () => {
        logger.info(`CSAAB server started on port ${serverConfig.port}`);
        logger.info(`Environment: ${serverConfig.nodeEnv}`);
        logger.info(`API Version: ${serverConfig.apiVersion}`);
        logger.info(`Health check: http://localhost:${serverConfig.port}/health`);
        logger.info(`API docs: http://localhost:${serverConfig.port}/api/${serverConfig.apiVersion}/docs`);
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop price monitoring
        await priceMonitoringService.stop();
        logger.info('Price monitoring service stopped');

        // Close database connection
        await closeDatabase();
        logger.info('Database connection closed');

        // Close server
        this.server.close(() => {
          logger.info('HTTP server closed');
          process.exit(0);
        });

        // Force exit after 30 seconds
        setTimeout(() => {
          logger.error('Forced shutdown after timeout');
          process.exit(1);
        }, 30000);

      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Get Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get Socket.IO instance
   */
  getIO(): SocketIOServer {
    return this.io;
  }
}

// Create and start application
const app = new CSAABApplication();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
app.start().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

export default app;
