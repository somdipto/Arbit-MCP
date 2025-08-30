# CrossSubnet AI Arbitrage Bot (CSAAB)

A sophisticated arbitrage bot that leverages Model Context Protocol (MCP) to identify and execute profitable arbitrage opportunities across Avalanche subnets with transparent, verifiable AI decision-making.

## 🚀 Features

- **AI-Powered Opportunity Detection**: Uses MCP for intelligent arbitrage identification
- **Multi-Subnet Support**: Monitors prices across multiple Avalanche subnets
- **Real-time Price Monitoring**: Continuous price tracking from major DEXs
- **Automated Trade Execution**: Smart execution with risk management
- **On-Chain Verification**: Complete transparency with verifiable decision chains
- **Advanced Analytics**: Comprehensive performance tracking and reporting
- **Role-based Access Control**: Secure multi-user system with different permission levels
- **WebSocket Real-time Updates**: Live price and opportunity feeds
- **MEV Protection**: Advanced protection against front-running attacks

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Dashboard │    │   Mobile App    │    │   API Clients   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      API Gateway          │
                    │   (Express + Socket.IO)   │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
┌─────────▼─────────┐  ┌─────────▼─────────┐  ┌─────────▼─────────┐
│  Price Monitoring │  │  MCP Integration  │  │  Trade Execution  │
│      Service      │  │      Service      │  │      Service      │
└─────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      Database Layer       │
                    │   (PostgreSQL + Redis)    │
                    └───────────────────────────┘
```

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 13+
- Redis 6+
- Docker (optional)
- Avalanche node access
- MCP API credentials

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-org/crosssubnet-ai-arbitrage-bot.git
cd crosssubnet-ai-arbitrage-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the environment template and configure your settings:

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=csab_db
DB_USER=csab_user
DB_PASSWORD=your_secure_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here

# MCP Configuration
MCP_API_ENDPOINT=https://api.modelcontextprotocol.com
MCP_API_KEY=your_mcp_api_key_here

# Avalanche Network Configuration
AVALANCHE_C_CHAIN_RPC=https://api.avax.network/ext/bc/C/rpc
```

### 4. Database Setup

Create the database and run migrations:

```bash
# Create database
createdb csab_db

# Run migrations (in development)
npm run dev
```

### 5. Build and Start

```bash
# Build the project
npm run build

# Start the application
npm start

# Or run in development mode
npm run dev
```

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Manual Docker Build

```bash
# Build the image
docker build -t csab .

# Run the container
docker run -p 3000:3000 --env-file .env csab
```

## 📊 API Documentation

### Authentication

```bash
# Register a new user
POST /api/v1/auth/register
{
  "username": "trader1",
  "email": "trader@example.com",
  "password": "securepassword123",
  "role": "trader"
}

# Login
POST /api/v1/auth/login
{
  "username": "trader1",
  "password": "securepassword123"
}
```

### Opportunities

```bash
# Get current opportunities
GET /api/v1/opportunities
Authorization: Bearer <token>

# Get specific opportunity
GET /api/v1/opportunities/:id
Authorization: Bearer <token>
```

### Trades

```bash
# Get trade history
GET /api/v1/trades
Authorization: Bearer <token>

# Get specific trade
GET /api/v1/trades/:id
Authorization: Bearer <token>
```

### Analytics

```bash
# Get performance metrics
GET /api/v1/analytics/performance
Authorization: Bearer <token>
```

### System Status

```bash
# Get system health
GET /api/v1/system/status
Authorization: Bearer <token>
```

## 🔧 Configuration

### Trading Parameters

- `MIN_PROFIT_THRESHOLD`: Minimum profit percentage (default: 0.5%)
- `MAX_TRADE_SIZE_USD`: Maximum trade size in USD (default: $10,000)
- `MIN_TRADE_SIZE_USD`: Minimum trade size in USD (default: $100)
- `GAS_LIMIT_MULTIPLIER`: Gas limit multiplier (default: 1.2)
- `SLIPPAGE_TOLERANCE`: Slippage tolerance percentage (default: 0.5%)

### Monitoring Settings

- `PRICE_UPDATE_INTERVAL`: Price update frequency in milliseconds (default: 1000ms)
- `OPPORTUNITY_CHECK_INTERVAL`: Opportunity check frequency (default: 1000ms)
- `HEALTH_CHECK_INTERVAL`: Health check frequency (default: 30000ms)

## 🔒 Security

### Authentication & Authorization

- JWT-based authentication with refresh tokens
- Role-based access control (Administrator, Trader, Analyst, Auditor)
- Session management with automatic expiration
- Rate limiting to prevent abuse

### Wallet Security

- AES-256 encryption for private keys
- Hardware wallet integration support
- Multi-signature wallet support
- Secure key management

### API Security

- Helmet.js for security headers
- CORS configuration
- Rate limiting
- Input validation and sanitization

## 📈 Performance Metrics

The system tracks comprehensive performance metrics:

- **Success Rate**: Percentage of successful trades
- **Average Profit**: Average profit per trade
- **Total Volume**: Total trading volume
- **Gas Efficiency**: Gas cost optimization
- **Execution Speed**: Average execution time
- **Risk Metrics**: Risk assessment scores

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test suite
npm test -- --grep "opportunity detection"

# Generate coverage report
npm test -- --coverage
```

## 📝 Logging

The application uses structured logging with Winston:

- **Console logging** for development
- **File logging** for production
- **JSON format** for machine readability
- **Log levels**: error, warn, info, debug
- **Request tracking** with unique IDs

## 🔍 Monitoring

### Health Checks

- Database connectivity
- Redis connectivity
- MCP service health
- Price monitoring status
- System resource usage

### Alerts

- Opportunity detection alerts
- Trade execution notifications
- System error alerts
- Performance threshold alerts
- Balance low warnings

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify connection credentials
   - Ensure database exists

2. **MCP Service Unavailable**
   - Verify API credentials
   - Check network connectivity
   - Review MCP service status

3. **Price Data Not Updating**
   - Check exchange API endpoints
   - Verify rate limits
   - Review network connectivity

4. **Authentication Issues**
   - Verify JWT secret configuration
   - Check token expiration
   - Review user account status

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](https://github.com/your-org/crosssubnet-ai-arbitrage-bot/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-org/crosssubnet-ai-arbitrage-bot/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/crosssubnet-ai-arbitrage-bot/discussions)
- **Email**: support@csab.com

## ⚠️ Disclaimer

This software is for educational and research purposes. Trading cryptocurrencies involves significant risk. Use at your own risk and never invest more than you can afford to lose.

## 🔄 Version History

- **v1.0.0** - Initial release with core arbitrage functionality
- **v1.1.0** - Added MCP integration and advanced analytics
- **v1.2.0** - Enhanced security and performance optimizations
- **v1.3.0** - Added MEV protection and cross-subnet bridges

---

**Built with ❤️ by the CSAAB Team**
