# 🧪 CSAAB Testing Guide

This guide provides comprehensive instructions for testing the CrossSubnet AI Arbitrage Bot (CSAAB) implementation.

## 📋 Prerequisites

Before testing, ensure you have the following installed:

- **Node.js 18+**
- **PostgreSQL 13+** (for full testing)
- **Redis 6+** (for full testing)
- **Docker & Docker Compose** (optional, for containerized testing)

## 🚀 Testing Approaches

### 1. **Quick Start - Basic Validation**

Test basic functionality without database setup:

```bash
# Install dependencies
npm install

# Run basic validation
node test-basic.js
```

This will test:
- ✅ TypeScript compilation
- ✅ Configuration loading
- ✅ Type definitions
- ✅ Service instantiation
- ✅ Middleware loading
- ✅ Controller loading

### 2. **Unit Testing**

Run the Jest test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/services/MCPService.test.ts

# Generate coverage report
npm test -- --coverage
```

### 3. **Integration Testing**

Test with a real database:

```bash
# Set up test database
createdb csab_test_db

# Set environment for testing
export NODE_ENV=test

# Run integration tests
npm run test:integration
```

### 4. **Docker Testing**

Test the complete stack using Docker:

```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f csab

# Run tests against containerized services
npm run test:docker

# Stop services
docker-compose down
```

### 5. **Manual API Testing**

Test the API endpoints manually:

```bash
# Start the development server
npm run dev

# Test health endpoint
curl http://localhost:3000/health

# Test API documentation
curl http://localhost:3000/api/v1/docs
```

## 🔧 Test Environment Setup

### Environment Configuration

Create test environment file:

```bash
cp env.example .env.test
```

Configure test environment variables:

```env
# Test Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=csab_test_db
DB_USER=csab_user
DB_PASSWORD=test_password

# Test Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1

# Test JWT
JWT_SECRET=test_jwt_secret_key_for_testing_only

# Test MCP (use mock endpoints)
MCP_API_ENDPOINT=http://localhost:3001/mock-mcp
MCP_API_KEY=test_key
```

### Database Setup

```bash
# Create test database
createdb csab_test_db

# Run migrations (in development mode)
NODE_ENV=test npm run dev
```

## 📊 Test Categories

### 1. **Unit Tests**

Test individual components in isolation:

```bash
# Test services
npm test -- --testPathPattern=services

# Test middleware
npm test -- --testPathPattern=middleware

# Test utilities
npm test -- --testPathPattern=utils
```

### 2. **Integration Tests**

Test component interactions:

```bash
# Test API endpoints
npm test -- --testPathPattern=controllers

# Test database operations
npm test -- --testPathPattern=database

# Test authentication flow
npm test -- --testPathPattern=auth
```

### 3. **End-to-End Tests**

Test complete user workflows:

```bash
# Test arbitrage detection flow
npm test -- --testPathPattern=e2e

# Test trade execution flow
npm test -- --testPathPattern=trading
```

## 🎯 Specific Test Scenarios

### Authentication Testing

```bash
# Test user registration
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "role": "trader"
  }'

# Test user login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

### Opportunity Detection Testing

```bash
# Get current opportunities (requires auth token)
curl -X GET http://localhost:3000/api/v1/opportunities \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### System Health Testing

```bash
# Test system status
curl http://localhost:3000/api/v1/system/status

# Test health endpoint
curl http://localhost:3000/health
```

## 🔍 Debugging Tests

### Enable Debug Logging

```bash
# Set debug level
export LOG_LEVEL=debug

# Run tests with verbose output
npm test -- --verbose
```

### Database Debugging

```bash
# Connect to test database
psql csab_test_db

# Check tables
\dt

# Check data
SELECT * FROM users LIMIT 5;
```

### Redis Debugging

```bash
# Connect to Redis
redis-cli

# Check keys
KEYS *

# Monitor operations
MONITOR
```

## 📈 Performance Testing

### Load Testing

```bash
# Install artillery for load testing
npm install -g artillery

# Run load test
artillery run tests/load/load-test.yml
```

### Stress Testing

```bash
# Run stress test
artillery run tests/load/stress-test.yml
```

## 🐛 Common Issues & Solutions

### 1. **Database Connection Issues**

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U csab_user -d csab_test_db

# Reset database
dropdb csab_test_db && createdb csab_test_db
```

### 2. **Redis Connection Issues**

```bash
# Check Redis status
sudo systemctl status redis

# Test connection
redis-cli ping

# Clear test data
redis-cli -n 1 FLUSHDB
```

### 3. **TypeScript Compilation Errors**

```bash
# Check TypeScript version
npx tsc --version

# Clean and rebuild
rm -rf dist/ && npm run build

# Check for type errors
npx tsc --noEmit
```

### 4. **Test Environment Issues**

```bash
# Clear node modules and reinstall
rm -rf node_modules/ package-lock.json
npm install

# Clear test cache
npm test -- --clearCache
```

## 📝 Test Data Management

### Seed Test Data

```bash
# Run seed script
npm run seed:test

# Or manually insert test data
psql csab_test_db -f tests/data/seed.sql
```

### Clean Test Data

```bash
# Clean all test data
npm run clean:test

# Or manually clean
psql csab_test_db -c "TRUNCATE users, trades, opportunities CASCADE;"
```

## 🎯 Test Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: 70%+ coverage
- **End-to-End Tests**: 50%+ coverage
- **Total Coverage**: 75%+ coverage

## 📊 Test Reporting

### Coverage Reports

```bash
# Generate HTML coverage report
npm test -- --coverage --coverageReporters=html

# View coverage report
open coverage/lcov-report/index.html
```

### Test Results

```bash
# Generate JUnit XML report
npm test -- --reporters=default --reporters=jest-junit

# View test results
cat test-results.xml
```

## 🔄 Continuous Integration

### GitHub Actions

The project includes GitHub Actions workflows for:

- **Pull Request Testing**: Runs on every PR
- **Nightly Testing**: Runs comprehensive tests nightly
- **Release Testing**: Runs before releases

### Local CI Simulation

```bash
# Run CI locally
npm run ci

# This includes:
# - Linting
# - Type checking
# - Unit tests
# - Integration tests
# - Build verification
```

## 🎉 Success Criteria

A successful test run should show:

- ✅ All tests passing
- ✅ Coverage targets met
- ✅ No TypeScript errors
- ✅ No linting errors
- ✅ API endpoints responding
- ✅ Database operations working
- ✅ Redis caching functional
- ✅ WebSocket connections stable

## 📞 Getting Help

If you encounter issues:

1. **Check the logs**: Look for error messages
2. **Verify environment**: Ensure all services are running
3. **Check dependencies**: Verify all packages are installed
4. **Review configuration**: Check environment variables
5. **Consult documentation**: Review README and API docs

For additional support, create an issue in the project repository.
