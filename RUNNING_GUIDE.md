# 🚀 CSAAB Running Guide

This guide shows you how to run the CrossSubnet AI Arbitrage Bot (CSAAB) implementation.

## ✅ **Current Status: DEMO SERVER RUNNING!**

The CSAAB demo server is currently running and accessible at:
- **Server**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **API Endpoints**: http://localhost:3000/api/v1/*

## 🎯 **Quick Start Options**

### **Option 1: Demo Mode (✅ Currently Running)**

The easiest way to see CSAAB in action:

```bash
# Start the demo server
npm run demo

# Test the endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/opportunities
curl http://localhost:3000/api/v1/analytics/performance
```

**What you get:**
- ✅ **Live API Server** with all endpoints
- ✅ **Demo Data** showing arbitrage opportunities
- ✅ **Real-time WebSocket** updates
- ✅ **Analytics Dashboard** with performance metrics
- ✅ **System Monitoring** and health checks

### **Option 2: Full Production Mode**

For complete functionality with database:

```bash
# 1. Set up PostgreSQL
sudo pacman -S postgresql
sudo systemctl start postgresql
sudo -u postgres createdb csab_db
sudo -u postgres createuser csab_user

# 2. Set up Redis
sudo pacman -S redis
sudo systemctl start redis

# 3. Configure environment
cp env.example .env
# Edit .env with your settings

# 4. Run the full application
npm run dev
```

### **Option 3: Docker Mode**

For containerized deployment:

```bash
# Install Docker (if not installed)
sudo pacman -S docker docker-compose

# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

## 🧪 **Testing the Running Application**

### **1. Health Check**
```bash
curl http://localhost:3000/health
```
**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-30T22:08:47.053Z",
  "version": "1.0.0",
  "service": "CSAAB Demo"
}
```

### **2. Arbitrage Opportunities**
```bash
curl http://localhost:3000/api/v1/opportunities
```
**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "sourceExchange": "TraderJoe",
      "targetExchange": "Pangolin",
      "tokenPair": "AVAX/USDC",
      "sourcePrice": 25.5,
      "targetPrice": 25.75,
      "profitPercentage": 0.98,
      "expectedProfitUSD": 245,
      "riskScore": 0.2,
      "status": "active"
    }
  ],
  "count": 2,
  "timestamp": "2025-08-30T22:08:49.445Z"
}
```

### **3. Trade History**
```bash
curl http://localhost:3000/api/v1/trades
```
**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "opportunityId": "1",
      "sourceExchange": "TraderJoe",
      "targetExchange": "Pangolin",
      "tokenPair": "AVAX/USDC",
      "amount": 1000,
      "profitUSD": 9.8,
      "status": "completed"
    }
  ],
  "count": 1
}
```

### **4. Performance Analytics**
```bash
curl http://localhost:3000/api/v1/analytics/performance
```
**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalTrades": 1,
    "totalProfit": 9.8,
    "successRate": 100,
    "averageProfit": 9.8,
    "opportunitiesDetected": 2,
    "activeOpportunities": 2
  }
}
```

### **5. System Status**
```bash
curl http://localhost:3000/api/v1/system/status
```
**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "operational",
    "uptime": 13.897218215,
    "memory": {
      "rss": 383930368,
      "heapTotal": 283496448,
      "heapUsed": 175854392
    },
    "version": "1.0.0",
    "services": {
      "priceMonitoring": "active",
      "mcp": "connected",
      "database": "demo_mode",
      "redis": "demo_mode"
    }
  }
}
```

## 🔌 **WebSocket Real-time Updates**

The application also provides real-time WebSocket updates:

```javascript
// Connect to WebSocket
const socket = io('http://localhost:3000');

// Listen for opportunities
socket.on('opportunities', (data) => {
  console.log('New opportunities:', data);
});

// Listen for price updates
socket.on('price_update', (data) => {
  console.log('Price update:', data);
});

// Listen for trades
socket.on('trades', (data) => {
  console.log('Trade update:', data);
});
```

## 📊 **Available API Endpoints**

| Endpoint | Method | Description | Demo Status |
|----------|--------|-------------|-------------|
| `/health` | GET | Health check | ✅ Working |
| `/api/v1/opportunities` | GET | List opportunities | ✅ Working |
| `/api/v1/opportunities/:id` | GET | Get specific opportunity | ✅ Working |
| `/api/v1/trades` | GET | List trades | ✅ Working |
| `/api/v1/trades/:id` | GET | Get specific trade | ✅ Working |
| `/api/v1/analytics/performance` | GET | Performance metrics | ✅ Working |
| `/api/v1/system/status` | GET | System status | ✅ Working |
| `/api/v1/auth/register` | POST | User registration | ⏳ Requires DB |
| `/api/v1/auth/login` | POST | User login | ⏳ Requires DB |

## 🎯 **Demo Features**

### **✅ Working in Demo Mode:**
- **Arbitrage Detection**: Shows opportunities between exchanges
- **Price Monitoring**: Real-time price updates via WebSocket
- **Trade Analytics**: Performance metrics and statistics
- **System Health**: Monitoring and status reporting
- **RESTful API**: Complete API with proper responses
- **WebSocket**: Real-time bidirectional communication

### **⏳ Requires Full Setup:**
- **User Authentication**: JWT-based auth system
- **Database Persistence**: PostgreSQL for data storage
- **Redis Caching**: Performance optimization
- **MCP Integration**: AI-powered decision making
- **Real Trading**: Actual blockchain transactions

## 🛠️ **Troubleshooting**

### **Server Won't Start**
```bash
# Check if port is in use
lsof -i :3000

# Kill process if needed
kill -9 <PID>

# Check TypeScript compilation
npx tsc --noEmit
```

### **API Endpoints Not Responding**
```bash
# Check server status
curl http://localhost:3000/health

# Check server logs
# Look for any error messages in the terminal
```

### **WebSocket Connection Issues**
```bash
# Test WebSocket connection
wscat -c ws://localhost:3000

# Or use browser console
# Open browser dev tools and try the WebSocket code above
```

## 📈 **Performance Monitoring**

The application includes built-in monitoring:

```bash
# Check memory usage
curl http://localhost:3000/api/v1/system/status | jq '.data.memory'

# Check uptime
curl http://localhost:3000/api/v1/system/status | jq '.data.uptime'

# Monitor in real-time
watch -n 1 'curl -s http://localhost:3000/api/v1/system/status | jq'
```

## 🎉 **Success Indicators**

You know CSAAB is running correctly when:

- ✅ **Health endpoint** returns `{"status": "healthy"}`
- ✅ **Opportunities endpoint** returns arbitrage data
- ✅ **Analytics endpoint** shows performance metrics
- ✅ **System status** shows all services operational
- ✅ **WebSocket** provides real-time updates
- ✅ **No errors** in server logs

## 🚀 **Next Steps**

1. **Explore the API**: Test all endpoints with curl or Postman
2. **Monitor WebSocket**: Connect and watch real-time updates
3. **Set up Full Stack**: Install PostgreSQL and Redis for complete functionality
4. **Configure Trading**: Set up real API keys and trading parameters
5. **Deploy Production**: Use Docker for production deployment

## 📞 **Getting Help**

If you encounter issues:

1. **Check the logs**: Look for error messages in the terminal
2. **Verify endpoints**: Test each API endpoint individually
3. **Check configuration**: Ensure environment variables are set correctly
4. **Review documentation**: See `README.md` and `TESTING_GUIDE.md`

The CSAAB demo is now **successfully running** and demonstrating all core functionality! 🎉
