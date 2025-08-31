# Production Deployment Guide
# CrossSubnet AI Arbitrage Bot (CSAAB)

This guide provides comprehensive instructions for deploying the CSAAB arbitrage bot to production environments with enterprise-grade security, monitoring, and reliability.

## 🚀 Quick Start

### Prerequisites

- **Operating System**: Ubuntu 20.04 LTS or later (recommended)
- **Hardware**: Minimum 2GB RAM, 10GB disk space
- **Network**: Stable internet connection with static IP (recommended)
- **Domain**: Registered domain name for SSL certificates
- **Access**: Root or sudo access to the server

### 1. Clone and Prepare

```bash
# Clone the repository
git clone https://github.com/your-org/crosssubnet-ai-arbitrage-bot.git
cd crosssubnet-ai-arbitrage-bot

# Make deployment script executable
chmod +x deploy-production.sh
```

### 2. Configure Environment

```bash
# Copy production environment template
cp env.production .env

# Edit configuration with your values
nano .env
```

**Critical Configuration Items:**
- `WALLET_PRIVATE_KEY`: Your wallet private key
- `DB_PASSWORD`: Secure database password
- `JWT_SECRET`: Long, random JWT secret
- `MCP_API_KEY`: Your MCP API key
- Exchange API keys and endpoints

### 3. Deploy to Production

```bash
# Run deployment script (requires root)
sudo ./deploy-production.sh --domain yourdomain.com
```

The script will automatically:
- Install all dependencies
- Configure security (firewall, fail2ban)
- Setup databases (PostgreSQL, Redis)
- Configure web server (Nginx)
- Setup SSL certificates
- Deploy the application
- Configure monitoring and backup

## 🔧 Manual Deployment Steps

If you prefer manual deployment or need to customize specific components:

### System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git build-essential

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Database Setup

#### PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE csab_production;
CREATE USER csab_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE csab_production TO csab_user;
ALTER USER csab_user CREATEDB;
\q
EOF
```

#### Redis

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis for production
sudo nano /etc/redis/redis.conf

# Key configurations:
# bind 127.0.0.1
# requirepass your_redis_password
# maxmemory 256mb
# maxmemory-policy allkeys-lru

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

### Application Deployment

#### Build and Run

```bash
# Build Docker image
docker build -t csab:latest .

# Run container
docker run -d \
  --name csab-production \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  -v /var/log/csab:/app/logs \
  -v /var/backups/csab:/app/backups \
  csab:latest
```

#### Systemd Service

```bash
# Create service file
sudo nano /etc/systemd/system/csab.service
```

```ini
[Unit]
Description=CrossSubnet AI Arbitrage Bot
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=csab
WorkingDirectory=/opt/csab
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable csab
sudo systemctl start csab
```

### Web Server Configuration

#### Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Create site configuration
sudo nano /etc/nginx/sites-available/csab
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site and restart Nginx
sudo ln -s /etc/nginx/sites-available/csab /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### SSL Certificate

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Setup auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Security Configuration

#### Firewall

```bash
# Install UFW
sudo apt install -y ufw

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw enable
```

#### Fail2ban

```bash
# Install Fail2ban
sudo apt install -y fail2ban

# Create configuration
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[csab-api]
enabled = true
filter = csab-api
port = 3000
logpath = /var/log/csab/application.log
maxretry = 5
bantime = 7200
```

```bash
# Restart Fail2ban
sudo systemctl restart fail2ban
sudo systemctl enable fail2ban
```

## 📊 Monitoring and Maintenance

### Health Checks

```bash
# Check application status
curl http://localhost:3000/health

# Check service status
sudo systemctl status csab

# Check logs
sudo journalctl -u csab -f
```

### Monitoring Script

```bash
# Create monitoring script
sudo nano /opt/csab/monitor.sh
```

```bash
#!/bin/bash

HEALTH_CHECK_URL="http://localhost:3000/health"
LOG_FILE="/var/log/csab/health.log"

# Check application health
if curl -f -s "$HEALTH_CHECK_URL" > /dev/null; then
    echo "$(date): Application is healthy" >> "$LOG_FILE"
else
    echo "$(date): Application health check failed" >> "$LOG_FILE"
    sudo systemctl restart csab
fi

# Check system resources
DISK_USAGE=$(df / | awk 'NR==2{print $5}' | sed 's/%//')
if [[ $DISK_USAGE -gt 80 ]]; then
    echo "$(date): Disk usage is high: ${DISK_USAGE}%" >> "$LOG_FILE"
fi
```

```bash
# Make executable and add to crontab
sudo chmod +x /opt/csab/monitor.sh
sudo crontab -e
# Add: */5 * * * * /opt/csab/monitor.sh
```

### Backup System

```bash
# Create backup script
sudo nano /opt/csab/backup.sh
```

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/csab"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Database backup
pg_dump -h localhost -U csab_user -d csab_production > "$BACKUP_DIR/db_backup_$DATE.sql"

# Application logs backup
tar -czf "$BACKUP_DIR/logs_backup_$DATE.tar.gz" -C /var/log/csab .

# Remove old backups (keep 7 days)
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
```

```bash
# Make executable and add to crontab
sudo chmod +x /opt/csab/backup.sh
sudo crontab -e
# Add: 0 2 * * * /opt/csab/backup.sh
```

## 🔐 Security Best Practices

### 1. Access Control

- Use SSH keys instead of passwords
- Disable root login
- Change default SSH port
- Use fail2ban for brute force protection

### 2. Network Security

- Configure firewall rules
- Use VPN for remote access
- Monitor network traffic
- Regular security audits

### 3. Application Security

- Regular security updates
- Secure API endpoints
- Input validation
- Rate limiting
- HTTPS enforcement

### 4. Data Protection

- Encrypt sensitive data
- Regular backups
- Access logging
- Data retention policies

## 🚨 Emergency Procedures

### Emergency Stop

```bash
# Stop all trading
curl -X POST http://localhost:3000/api/v1/system/emergency-stop \
  -H "Authorization: Bearer YOUR_TOKEN"

# Or stop service
sudo systemctl stop csab
```

### Recovery Procedures

```bash
# Restore from backup
pg_restore -h localhost -U csab_user -d csab_production /var/backups/csab/db_backup_YYYYMMDD_HHMMSS.sql

# Restart services
sudo systemctl restart postgresql
sudo systemctl restart redis-server
sudo systemctl restart csab
```

### Incident Response

1. **Immediate Actions**
   - Stop affected services
   - Isolate compromised systems
   - Document incident details

2. **Investigation**
   - Review logs and alerts
   - Identify root cause
   - Assess impact

3. **Recovery**
   - Restore from clean backup
   - Patch vulnerabilities
   - Update security measures

4. **Post-Incident**
   - Document lessons learned
   - Update procedures
   - Conduct security review

## 📈 Performance Optimization

### Database Optimization

```sql
-- Create indexes for performance
CREATE INDEX idx_trades_timestamp ON trades(timestamp);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_transactions_hash ON transactions(hash);

-- Analyze table statistics
ANALYZE trades;
ANALYZE opportunities;
ANALYZE transactions;
```

### Application Optimization

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Use PM2 for process management
npm install -g pm2
pm2 start dist/index.js --name csab --max-memory-restart 1G
```

### System Optimization

```bash
# Optimize PostgreSQL
sudo nano /etc/postgresql/*/main/postgresql.conf

# Key settings:
# shared_buffers = 256MB
# effective_cache_size = 1GB
# work_mem = 4MB
# maintenance_work_mem = 64MB

# Restart PostgreSQL
sudo systemctl restart postgresql
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Application Won't Start

```bash
# Check logs
sudo journalctl -u csab -n 50

# Check environment
sudo systemctl show csab --property=Environment

# Verify dependencies
node --version
npm --version
```

#### 2. Database Connection Issues

```bash
# Test connection
psql -h localhost -U csab_user -d csab_production

# Check service status
sudo systemctl status postgresql

# Check logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### 3. Performance Issues

```bash
# Monitor system resources
htop
iotop
nethogs

# Check database performance
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=debug

# Run in debug mode
NODE_ENV=development npm run dev

# Check WebSocket connections
netstat -an | grep :3000
```

## 📋 Maintenance Checklist

### Daily
- [ ] Check application health
- [ ] Review error logs
- [ ] Monitor system resources
- [ ] Verify backup completion

### Weekly
- [ ] Review performance metrics
- [ ] Check security logs
- [ ] Update system packages
- [ ] Test backup restoration

### Monthly
- [ ] Security audit
- [ ] Performance optimization
- [ ] Update dependencies
- [ ] Review access logs

### Quarterly
- [ ] Full security review
- [ ] Disaster recovery test
- [ ] Performance benchmarking
- [ ] Documentation update

## 📞 Support and Resources

### Documentation
- [API Reference](https://docs.yourdomain.com/api)
- [Configuration Guide](https://docs.yourdomain.com/config)
- [Troubleshooting Guide](https://docs.yourdomain.com/troubleshooting)

### Community
- [GitHub Issues](https://github.com/your-org/crosssubnet-ai-arbitrage-bot/issues)
- [Discord Community](https://discord.gg/your-community)
- [Telegram Group](https://t.me/your-group)

### Professional Support
- **Email**: support@yourdomain.com
- **Phone**: +1-XXX-XXX-XXXX
- **Emergency**: +1-XXX-XXX-XXXX (24/7)

## ⚠️ Important Disclaimers

1. **Risk Warning**: Cryptocurrency trading involves significant risk. Never invest more than you can afford to lose.

2. **Regulatory Compliance**: Ensure compliance with local regulations and tax requirements.

3. **Security Responsibility**: You are responsible for securing your private keys and API credentials.

4. **No Warranty**: This software is provided "as is" without warranty of any kind.

5. **Testing**: Always test in a staging environment before production deployment.

---

**Last Updated**: $(date +%Y-%m-%d)
**Version**: 1.0.0
**Maintainer**: CSAAB Team


