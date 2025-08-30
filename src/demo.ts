#!/usr/bin/env node

/**
 * CSAAB Demo Application
 * A simplified version that demonstrates the core functionality
 * without requiring database setup
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Demo data
const demoOpportunities = [
  {
    id: '1',
    sourceExchange: 'TraderJoe',
    targetExchange: 'Pangolin',
    tokenPair: 'AVAX/USDC',
    sourcePrice: 25.50,
    targetPrice: 25.75,
    profitPercentage: 0.98,
    expectedProfitUSD: 245.00,
    riskScore: 0.2,
    timestamp: new Date().toISOString(),
    status: 'active'
  },
  {
    id: '2',
    sourceExchange: 'SushiSwap',
    targetExchange: 'TraderJoe',
    tokenPair: 'WETH/USDC',
    sourcePrice: 1850.00,
    targetPrice: 1860.00,
    profitPercentage: 0.54,
    expectedProfitUSD: 540.00,
    riskScore: 0.3,
    timestamp: new Date().toISOString(),
    status: 'active'
  }
];

const demoTrades = [
  {
    id: '1',
    opportunityId: '1',
    sourceExchange: 'TraderJoe',
    targetExchange: 'Pangolin',
    tokenPair: 'AVAX/USDC',
    amount: 1000,
    profitUSD: 9.80,
    status: 'completed',
    timestamp: new Date().toISOString()
  }
];

// Create Express app
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'CSAAB Demo'
  });
});

// API Routes
app.get('/api/v1/opportunities', (req, res) => {
  res.json({
    success: true,
    data: demoOpportunities,
    count: demoOpportunities.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/opportunities/:id', (req, res) => {
  const opportunity = demoOpportunities.find(opp => opp.id === req.params.id);
  if (!opportunity) {
    return res.status(404).json({
      success: false,
      error: 'Opportunity not found'
    });
  }
  return res.json({
    success: true,
    data: opportunity
  });
});

app.get('/api/v1/trades', (req, res) => {
  res.json({
    success: true,
    data: demoTrades,
    count: demoTrades.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/trades/:id', (req, res) => {
  const trade = demoTrades.find(t => t.id === req.params.id);
  if (!trade) {
    return res.status(404).json({
      success: false,
      error: 'Trade not found'
    });
  }
  return res.json({
    success: true,
    data: trade
  });
});

app.get('/api/v1/analytics/performance', (req, res) => {
  res.json({
    success: true,
    data: {
      totalTrades: demoTrades.length,
      totalProfit: demoTrades.reduce((sum, trade) => sum + trade.profitUSD, 0),
      successRate: 100,
      averageProfit: demoTrades.length > 0 ? demoTrades.reduce((sum, trade) => sum + trade.profitUSD, 0) / demoTrades.length : 0,
      opportunitiesDetected: demoOpportunities.length,
      activeOpportunities: demoOpportunities.filter(opp => opp.status === 'active').length
    }
  });
});

app.get('/api/v1/system/status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'operational',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '1.0.0',
      services: {
        priceMonitoring: 'active',
        mcp: 'connected',
        database: 'demo_mode',
        redis: 'demo_mode'
      },
      timestamp: new Date().toISOString()
    }
  });
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send initial data
  socket.emit('opportunities', demoOpportunities);
  socket.emit('trades', demoTrades);
  
  // Simulate real-time updates
  const updateInterval = setInterval(() => {
    // Simulate price updates
    const updatedOpportunities = demoOpportunities.map(opp => ({
      ...opp,
      sourcePrice: opp.sourcePrice + (Math.random() - 0.5) * 0.1,
      targetPrice: opp.targetPrice + (Math.random() - 0.5) * 0.1,
      timestamp: new Date().toISOString()
    }));
    
    socket.emit('price_update', updatedOpportunities);
  }, 5000);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clearInterval(updateInterval);
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('🚀 CSAAB Demo Server Started');
  console.log('============================');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`📊 API: http://localhost:${PORT}/api/v1/opportunities`);
  console.log(`📈 Analytics: http://localhost:${PORT}/api/v1/analytics/performance`);
  console.log(`⚙️  Status: http://localhost:${PORT}/api/v1/system/status`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log('');
  console.log('🎯 Demo Features:');
  console.log('   • Arbitrage opportunities detection');
  console.log('   • Trade history and analytics');
  console.log('   • Real-time WebSocket updates');
  console.log('   • System health monitoring');
  console.log('   • RESTful API endpoints');
  console.log('');
  console.log('📝 Test Commands:');
  console.log(`   curl http://localhost:${PORT}/health`);
  console.log(`   curl http://localhost:${PORT}/api/v1/opportunities`);
  console.log(`   curl http://localhost:${PORT}/api/v1/trades`);
  console.log(`   curl http://localhost:${PORT}/api/v1/analytics/performance`);
  console.log('');
  console.log('Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down CSAAB Demo Server...');
  server.close(() => {
    console.log('✅ Server stopped gracefully');
    process.exit(0);
  });
});

export default app;
