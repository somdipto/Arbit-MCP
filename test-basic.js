#!/usr/bin/env node

/**
 * Basic Test Script for CSAAB
 * This script tests basic functionality without requiring a full database setup
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 CSAAB Basic Testing Suite');
console.log('============================\n');

// Test 1: Check if TypeScript compiles
console.log('1. Testing TypeScript compilation...');
try {
  const tsc = spawn('npx', ['tsc', '--noEmit'], { stdio: 'pipe' });
  
  tsc.on('close', (code) => {
    if (code === 0) {
      console.log('✅ TypeScript compilation successful');
    } else {
      console.log('❌ TypeScript compilation failed');
    }
    
    // Test 2: Check if configuration loads
    console.log('\n2. Testing configuration loading...');
    try {
      // Test config loading without database
      const config = require('./src/config');
      console.log('✅ Configuration loaded successfully');
      console.log(`   - Server port: ${config.serverConfig.port}`);
      console.log(`   - API version: ${config.serverConfig.apiVersion}`);
      console.log(`   - Environment: ${config.serverConfig.nodeEnv}`);
    } catch (error) {
      console.log('❌ Configuration loading failed:', error.message);
    }
    
    // Test 3: Check if types are properly defined
    console.log('\n3. Testing type definitions...');
    try {
      const types = require('./src/types');
      console.log('✅ Type definitions loaded successfully');
      console.log(`   - User roles: ${Object.keys(types.UserRole).join(', ')}`);
      console.log(`   - Trade statuses: ${Object.keys(types.TradeStatus).join(', ')}`);
      console.log(`   - Exchange types: ${Object.keys(types.ExchangeType).join(', ')}`);
    } catch (error) {
      console.log('❌ Type definitions failed:', error.message);
    }
    
    // Test 4: Check if services can be instantiated
    console.log('\n4. Testing service instantiation...');
    try {
      const { MCPService } = require('./src/services/MCPService');
      const { PriceMonitoringService } = require('./src/services/PriceMonitoringService');
      
      const mcpService = new MCPService();
      const priceService = new PriceMonitoringService();
      
      console.log('✅ Services instantiated successfully');
      console.log(`   - MCP Service: ${mcpService.constructor.name}`);
      console.log(`   - Price Monitoring Service: ${priceService.constructor.name}`);
    } catch (error) {
      console.log('❌ Service instantiation failed:', error.message);
    }
    
    // Test 5: Check if middleware can be loaded
    console.log('\n5. Testing middleware loading...');
    try {
      const { errorHandler } = require('./src/middleware/errorHandler');
      const { requestLogger } = require('./src/middleware/requestLogger');
      const { rateLimiterMiddleware } = require('./src/middleware/rateLimiter');
      const { authMiddleware } = require('./src/middleware/auth');
      
      console.log('✅ Middleware loaded successfully');
      console.log(`   - Error Handler: ${typeof errorHandler}`);
      console.log(`   - Request Logger: ${typeof requestLogger}`);
      console.log(`   - Rate Limiter: ${typeof rateLimiterMiddleware}`);
      console.log(`   - Auth Middleware: ${typeof authMiddleware}`);
    } catch (error) {
      console.log('❌ Middleware loading failed:', error.message);
    }
    
    // Test 6: Check if controllers can be loaded
    console.log('\n6. Testing controller loading...');
    try {
      const { authRoutes } = require('./src/controllers/authController');
      const { opportunityRoutes } = require('./src/controllers/opportunityController');
      const { tradeRoutes } = require('./src/controllers/tradeController');
      
      console.log('✅ Controllers loaded successfully');
      console.log(`   - Auth Routes: ${authRoutes.stack?.length || 0} routes`);
      console.log(`   - Opportunity Routes: ${opportunityRoutes.stack?.length || 0} routes`);
      console.log(`   - Trade Routes: ${tradeRoutes.stack?.length || 0} routes`);
    } catch (error) {
      console.log('❌ Controller loading failed:', error.message);
    }
    
    console.log('\n🎉 Basic testing completed!');
    console.log('\nNext steps:');
    console.log('1. Set up PostgreSQL and Redis for full testing');
    console.log('2. Run: npm test (for unit tests)');
    console.log('3. Run: npm run dev (for development server)');
    console.log('4. Run: docker-compose up (for full stack testing)');
  });
  
  tsc.stderr.on('data', (data) => {
    console.log('TypeScript errors:', data.toString());
  });
  
} catch (error) {
  console.log('❌ Test setup failed:', error.message);
}
