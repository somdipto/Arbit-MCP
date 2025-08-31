#!/bin/bash

# =============================================================================
# PRODUCTION DEPLOYMENT SCRIPT
# CrossSubnet AI Arbitrage Bot (CSAAB)
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="csab"
DOCKER_IMAGE="csab:latest"
DOCKER_CONTAINER="csab-production"
DEPLOYMENT_ENV="production"

# Logging
LOG_FILE="/var/log/csab/deployment.log"
LOG_DIR=$(dirname "$LOG_FILE")

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root for production deployment"
    fi
}

# Check system requirements
check_system_requirements() {
    log "Checking system requirements..."
    
    # Check OS
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        error "This script is designed for Linux systems only"
    fi
    
    # Check available memory
    local mem_total=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    if [[ $mem_total -lt 2048 ]]; then
        error "Insufficient memory. Required: 2GB, Available: ${mem_total}MB"
    fi
    
    # Check available disk space
    local disk_space=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
    if [[ $disk_space -lt 10 ]]; then
        error "Insufficient disk space. Required: 10GB, Available: ${disk_space}GB"
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    log "System requirements check passed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    local dirs=(
        "/var/log/csab"
        "/var/backups/csab"
        "/etc/csab"
        "/var/lib/csab"
        "/opt/csab"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            chmod 755 "$dir"
            log "Created directory: $dir"
        fi
    done
    
    # Set proper permissions
    chown -R csab:csab /var/log/csab /var/backups/csab /var/lib/csab 2>/dev/null || true
}

# Install system dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    # Update package list
    apt-get update
    
    # Install required packages
    local packages=(
        "postgresql-client"
        "redis-tools"
        "curl"
        "wget"
        "unzip"
        "jq"
        "htop"
        "iotop"
        "nethogs"
        "fail2ban"
        "ufw"
        "certbot"
        "nginx"
        "supervisor"
        "logrotate"
        "cron"
    )
    
    for package in "${packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $package "; then
            log "Installing $package..."
            apt-get install -y "$package"
        else
            log "$package is already installed"
        fi
    done
}

# Setup firewall
setup_firewall() {
    log "Setting up firewall..."
    
    # Reset firewall rules
    ufw --force reset
    
    # Default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH
    ufw allow ssh
    
    # Allow HTTP/HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow application port
    ufw allow 3000/tcp
    
    # Allow PostgreSQL
    ufw allow 5432/tcp
    
    # Allow Redis
    ufw allow 6379/tcp
    
    # Enable firewall
    ufw --force enable
    
    log "Firewall configured and enabled"
}

# Setup fail2ban
setup_fail2ban() {
    log "Setting up fail2ban..."
    
    # Create fail2ban configuration
    cat > /etc/fail2ban/jail.local << EOF
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

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[csab-api]
enabled = true
filter = csab-api
port = 3000
logpath = /var/log/csab/application.log
maxretry = 5
bantime = 7200
EOF
    
    # Create custom filter for CSAB API
    cat > /etc/fail2ban/filter.d/csab-api.conf << EOF
[Definition]
failregex = ^.*ERROR.*Authentication failed.*from <HOST>.*$
ignoreregex =
EOF
    
    # Restart fail2ban
    systemctl restart fail2ban
    systemctl enable fail2ban
    
    log "Fail2ban configured and enabled"
}

# Setup PostgreSQL
setup_postgresql() {
    log "Setting up PostgreSQL..."
    
    # Install PostgreSQL if not already installed
    if ! command -v psql &> /dev/null; then
        log "Installing PostgreSQL..."
        apt-get install -y postgresql postgresql-contrib
    fi
    
    # Start and enable PostgreSQL
    systemctl start postgresql
    systemctl enable postgresql
    
    # Create database and user
    sudo -u postgres psql << EOF
CREATE DATABASE csab_production;
CREATE USER csab_user WITH PASSWORD 'your_secure_database_password_here';
GRANT ALL PRIVILEGES ON DATABASE csab_production TO csab_user;
ALTER USER csab_user CREATEDB;
\q
EOF
    
    log "PostgreSQL configured"
}

# Setup Redis
setup_redis() {
    log "Setting up Redis..."
    
    # Install Redis if not already installed
    if ! command -v redis-server &> /dev/null; then
        log "Installing Redis..."
        apt-get install -y redis-server
    fi
    
    # Configure Redis for production
    cat > /etc/redis/redis.conf << EOF
# Network
bind 127.0.0.1
port 6379
timeout 300

# General
daemonize yes
pidfile /var/run/redis/redis-server.pid
loglevel notice
logfile /var/log/redis/redis-server.log

# Snapshotting
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# Replication
replica-serve-stale-data yes
replica-read-only yes

# Security
requirepass your_redis_password_here

# Memory management
maxmemory 256mb
maxmemory-policy allkeys-lru

# Append only file
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
EOF
    
    # Start and enable Redis
    systemctl restart redis-server
    systemctl enable redis-server
    
    log "Redis configured"
}

# Setup Nginx
setup_nginx() {
    log "Setting up Nginx..."
    
    # Create Nginx configuration
    cat > /etc/nginx/sites-available/csab << EOF
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Proxy to application
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Static files
    location /static/ {
        alias /opt/csab/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/csab /etc/nginx/sites-enabled/
    
    # Test configuration
    nginx -t
    
    # Reload Nginx
    systemctl reload nginx
    systemctl enable nginx
    
    log "Nginx configured"
}

# Setup SSL certificate
setup_ssl() {
    log "Setting up SSL certificate..."
    
    # Check if domain is provided
    if [[ -z "$DOMAIN" ]]; then
        warn "No domain provided, skipping SSL setup"
        return
    fi
    
    # Stop Nginx temporarily
    systemctl stop nginx
    
    # Obtain SSL certificate
    certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos --email admin@yourdomain.com
    
    # Start Nginx
    systemctl start nginx
    
    # Setup auto-renewal
    echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
    
    log "SSL certificate configured"
}

# Setup supervisor
setup_supervisor() {
    log "Setting up supervisor..."
    
    # Create supervisor configuration
    cat > /etc/supervisor/conf.d/csab.conf << EOF
[program:csab]
command=/usr/bin/node /opt/csab/dist/index.js
directory=/opt/csab
user=csab
autostart=true
autorestart=true
stderr_logfile=/var/log/csab/supervisor.err.log
stdout_logfile=/var/log/csab/supervisor.out.log
environment=NODE_ENV="production"
EOF
    
    # Reload supervisor
    supervisorctl reread
    supervisorctl update
    
    log "Supervisor configured"
}

# Setup log rotation
setup_logrotate() {
    log "Setting up log rotation..."
    
    # Create logrotate configuration
    cat > /etc/logrotate.d/csab << EOF
/var/log/csab/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 csab csab
    postrotate
        supervisorctl restart csab
    endscript
}
EOF
    
    log "Log rotation configured"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Create monitoring script
    cat > /opt/csab/monitor.sh << 'EOF'
#!/bin/bash

# Health check script
HEALTH_CHECK_URL="http://localhost:3000/health"
LOG_FILE="/var/log/csab/health.log"

# Check application health
if curl -f -s "$HEALTH_CHECK_URL" > /dev/null; then
    echo "$(date): Application is healthy" >> "$LOG_FILE"
else
    echo "$(date): Application health check failed" >> "$LOG_FILE"
    
    # Restart application
    supervisorctl restart csab
    
    # Send alert
    echo "CSAB application health check failed and has been restarted" | \
        mail -s "CSAB Health Alert" admin@yourdomain.com
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2{print $5}' | sed 's/%//')
if [[ $DISK_USAGE -gt 80 ]]; then
    echo "$(date): Disk usage is high: ${DISK_USAGE}%" >> "$LOG_FILE"
    echo "CSAB disk usage is high: ${DISK_USAGE}%" | \
        mail -s "CSAB Disk Alert" admin@yourdomain.com
fi

# Check memory usage
MEM_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [[ $MEM_USAGE -gt 80 ]]; then
    echo "$(date): Memory usage is high: ${MEM_USAGE}%" >> "$LOG_FILE"
    echo "CSAB memory usage is high: ${MEM_USAGE}%" | \
        mail -s "CSAB Memory Alert" admin@yourdomain.com
fi
EOF
    
    # Make script executable
    chmod +x /opt/csab/monitor.sh
    
    # Add to crontab
    echo "*/5 * * * * /opt/csab/monitor.sh" | crontab -
    
    log "Monitoring configured"
}

# Build and deploy application
deploy_application() {
    log "Deploying application..."
    
    # Navigate to project directory
    cd "$SCRIPT_DIR"
    
    # Build Docker image
    log "Building Docker image..."
    docker build -t "$DOCKER_IMAGE" .
    
    # Stop existing container if running
    if docker ps -q -f name="$DOCKER_CONTAINER" | grep -q .; then
        log "Stopping existing container..."
        docker stop "$DOCKER_CONTAINER"
        docker rm "$DOCKER_CONTAINER"
    fi
    
    # Run new container
    log "Starting new container..."
    docker run -d \
        --name "$DOCKER_CONTAINER" \
        --restart unless-stopped \
        -p 3000:3000 \
        --env-file env.production \
        -v /var/log/csab:/app/logs \
        -v /var/backups/csab:/app/backups \
        "$DOCKER_IMAGE"
    
    # Wait for container to start
    sleep 10
    
    # Check if container is running
    if docker ps -q -f name="$DOCKER_CONTAINER" | grep -q .; then
        log "Application deployed successfully"
    else
        error "Failed to deploy application"
    fi
}

# Setup backup
setup_backup() {
    log "Setting up backup system..."
    
    # Create backup script
    cat > /opt/csab/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/csab"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup
pg_dump -h localhost -U csab_user -d csab_production > "$BACKUP_DIR/db_backup_$DATE.sql"

# Application logs backup
tar -czf "$BACKUP_DIR/logs_backup_$DATE.tar.gz" -C /var/log/csab .

# Configuration backup
tar -czf "$BACKUP_DIR/config_backup_$DATE.tar.gz" -C /etc csab

# Remove old backups
find "$BACKUP_DIR" -name "*.sql" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
EOF
    
    # Make script executable
    chmod +x /opt/csab/backup.sh
    
    # Add to crontab (daily at 2 AM)
    echo "0 2 * * * /opt/csab/backup.sh" | crontab -
    
    log "Backup system configured"
}

# Final configuration
final_setup() {
    log "Performing final setup..."
    
    # Set proper permissions
    chown -R csab:csab /opt/csab /var/log/csab /var/backups/csab
    
    # Create systemd service (alternative to supervisor)
    cat > /etc/systemd/system/csab.service << EOF
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
EOF
    
    # Reload systemd
    systemctl daemon-reload
    
    # Enable service
    systemctl enable csab.service
    
    log "Final setup completed"
}

# Main deployment function
main() {
    log "Starting production deployment of CSAB..."
    
    # Check if running as root
    check_root
    
    # Check system requirements
    check_system_requirements
    
    # Create directories
    create_directories
    
    # Install dependencies
    install_dependencies
    
    # Setup firewall
    setup_firewall
    
    # Setup fail2ban
    setup_fail2ban
    
    # Setup PostgreSQL
    setup_postgresql
    
    # Setup Redis
    setup_redis
    
    # Setup Nginx
    setup_nginx
    
    # Setup SSL (if domain provided)
    if [[ -n "$DOMAIN" ]]; then
        setup_ssl
    fi
    
    # Setup supervisor
    setup_supervisor
    
    # Setup log rotation
    setup_logrotate
    
    # Setup monitoring
    setup_monitoring
    
    # Setup backup
    setup_backup
    
    # Deploy application
    deploy_application
    
    # Final setup
    final_setup
    
    log "Production deployment completed successfully!"
    log "Application is running on port 3000"
    log "Nginx is configured and running"
    log "Monitoring and backup systems are active"
    
    # Display status
    echo ""
    echo "=== DEPLOYMENT STATUS ==="
    echo "Application: $(systemctl is-active csab.service)"
    echo "Nginx: $(systemctl is-active nginx)"
    echo "PostgreSQL: $(systemctl is-active postgresql)"
    echo "Redis: $(systemctl is-active redis-server)"
    echo "Fail2ban: $(systemctl is-active fail2ban)"
    echo "========================"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [--domain DOMAIN]"
            echo "  --domain DOMAIN    Domain name for SSL certificate"
            echo "  --help            Show this help message"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Run main deployment
main "$@"


