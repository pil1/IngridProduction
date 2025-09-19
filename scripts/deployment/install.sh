#!/bin/bash

# INFOtrac Ubuntu Server Installation Script
# For production deployment on Ubuntu 20.04/22.04
# Domain: info.onbb.ca

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="info.onbb.ca"
APP_NAME="infotrac"
APP_DIR="/opt/${APP_NAME}"
NGINX_CONFIG_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
LOG_DIR="/var/log/${APP_NAME}"

# Logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

# Check Ubuntu version
check_ubuntu() {
    if ! grep -q "Ubuntu" /etc/os-release; then
        error "This script is designed for Ubuntu. Current OS: $(cat /etc/os-release | grep PRETTY_NAME)"
    fi

    local version=$(lsb_release -rs)
    log "Detected Ubuntu version: $version"

    if [[ $(echo "$version < 20.04" | bc -l) -eq 1 ]]; then
        warn "Ubuntu version older than 20.04 detected. Some features may not work correctly."
    fi
}

# Update system packages
update_system() {
    log "Updating system packages..."
    apt update && apt upgrade -y
    apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release bc
}

# Install Docker
install_docker() {
    log "Installing Docker..."

    # Remove old versions
    apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io

    # Start and enable Docker
    systemctl start docker
    systemctl enable docker

    # Add current user to docker group (if not root)
    if [[ $SUDO_USER ]]; then
        usermod -aG docker $SUDO_USER
        log "Added $SUDO_USER to docker group"
    fi

    log "Docker installed successfully"
}

# Install Docker Compose
install_docker_compose() {
    log "Installing Docker Compose..."

    local compose_version=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')

    curl -L "https://github.com/docker/compose/releases/download/${compose_version}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

    # Create symlink for global access
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

    log "Docker Compose installed successfully: $(docker-compose --version)"
}

# Install Nginx (for reverse proxy/SSL termination)
install_nginx() {
    log "Installing Nginx..."

    apt install -y nginx

    # Start and enable Nginx
    systemctl start nginx
    systemctl enable nginx

    # Configure firewall
    ufw allow 'Nginx Full' 2>/dev/null || true

    log "Nginx installed successfully"
}

# Install Certbot for SSL certificates
install_certbot() {
    log "Installing Certbot for SSL certificates..."

    apt install -y certbot python3-certbot-nginx

    log "Certbot installed successfully"
}

# Create application directory
setup_app_directory() {
    log "Setting up application directory..."

    mkdir -p $APP_DIR
    mkdir -p $LOG_DIR
    mkdir -p $APP_DIR/logs/nginx

    # Set permissions
    chown -R $SUDO_USER:$SUDO_USER $APP_DIR 2>/dev/null || chown -R root:root $APP_DIR
    chmod 755 $APP_DIR

    log "Application directory created: $APP_DIR"
}

# Clone repository
clone_repository() {
    log "Cloning INFOtrac repository..."

    if [[ -z "$GITHUB_REPO" ]]; then
        warn "GITHUB_REPO environment variable not set. Please clone manually:"
        echo "  cd $APP_DIR"
        echo "  git clone <your-repo-url> ."
        return
    fi

    cd $APP_DIR
    git clone $GITHUB_REPO .

    # Set permissions
    chown -R $SUDO_USER:$SUDO_USER . 2>/dev/null || chown -R root:root .

    log "Repository cloned successfully"
}

# Setup environment file
setup_environment() {
    log "Setting up environment configuration..."

    cd $APP_DIR

    if [[ ! -f .env.example ]]; then
        warn ".env.example not found. Creating basic template..."
        cat > .env.example << EOF
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
NOTIFICATION_EMAIL_FROM=noreply@${DOMAIN}
NOTIFICATION_EMAIL_TO=admin@${DOMAIN}
SMTP_SERVER=localhost
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EOF
    fi

    if [[ ! -f .env.production ]]; then
        cp .env.example .env.production
        warn "Created .env.production from template. Please edit with your values:"
        echo "  nano $APP_DIR/.env.production"
    fi
}

# Configure Nginx reverse proxy
setup_nginx_config() {
    log "Configuring Nginx reverse proxy..."

    cat > $NGINX_CONFIG_DIR/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Redirect to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # SSL Configuration (will be updated by Certbot)
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log $LOG_DIR/nginx_access.log;
    error_log $LOG_DIR/nginx_error.log;

    # Proxy to Docker container
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;

        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:80/health;
        access_log off;
    }
}
EOF

    # Enable the site
    ln -sf $NGINX_CONFIG_DIR/$DOMAIN $NGINX_ENABLED_DIR/

    # Remove default Nginx site
    rm -f $NGINX_ENABLED_DIR/default

    # Test Nginx configuration
    nginx -t
    systemctl reload nginx

    log "Nginx configuration created and enabled"
}

# Setup SSL certificate
setup_ssl() {
    log "Setting up SSL certificate with Let's Encrypt..."

    if [[ -z "$EMAIL" ]]; then
        warn "EMAIL environment variable not set. Please run certbot manually:"
        echo "  certbot --nginx -d $DOMAIN -d www.$DOMAIN --email your-email@example.com --agree-tos --non-interactive"
        return
    fi

    certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive

    # Setup auto-renewal
    systemctl enable certbot.timer
    systemctl start certbot.timer

    log "SSL certificate configured successfully"
}

# Setup firewall
setup_firewall() {
    log "Configuring firewall..."

    # Enable UFW
    ufw --force enable

    # Default policies
    ufw default deny incoming
    ufw default allow outgoing

    # Allow SSH (be careful not to lock yourself out)
    ufw allow OpenSSH

    # Allow HTTP and HTTPS
    ufw allow 'Nginx Full'

    # Allow Docker daemon (if needed)
    ufw allow 2376/tcp

    log "Firewall configured successfully"
}

# Create systemd service for auto-start
create_systemd_service() {
    log "Creating systemd service for auto-start..."

    cat > /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=INFOtrac Application
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=forking
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0
Restart=on-failure
StartLimitBurst=3

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ${APP_NAME}.service

    log "Systemd service created and enabled"
}

# Setup monitoring and maintenance scripts
setup_monitoring() {
    log "Setting up monitoring and maintenance..."

    # Create backup script
    cat > $APP_DIR/scripts/backup.sh << 'EOF'
#!/bin/bash
# Basic backup script for INFOtrac

BACKUP_DIR="/var/backups/infotrac"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup application data
tar -czf $BACKUP_DIR/infotrac_backup_$DATE.tar.gz -C /opt infotrac

# Keep only last 7 backups
find $BACKUP_DIR -name "infotrac_backup_*.tar.gz" -type f -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/infotrac_backup_$DATE.tar.gz"
EOF

    # Create update script
    cat > $APP_DIR/scripts/update.sh << 'EOF'
#!/bin/bash
# Update script for INFOtrac

cd /opt/infotrac

# Pull latest changes
git pull origin main

# Update Docker images
docker-compose -f docker-compose.prod.yml pull

# Restart services
docker-compose -f docker-compose.prod.yml up -d

# Clean up old images
docker image prune -f

echo "Update completed successfully"
EOF

    # Make scripts executable
    chmod +x $APP_DIR/scripts/*.sh

    # Setup cron job for backups
    (crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/scripts/backup.sh") | crontab -

    log "Monitoring and maintenance scripts created"
}

# Final deployment
deploy_application() {
    log "Deploying INFOtrac application..."

    cd $APP_DIR

    # Build and start containers
    docker-compose -f docker-compose.prod.yml up -d --build

    # Wait for application to start
    log "Waiting for application to start..."
    sleep 30

    # Health check
    if curl -f http://localhost/health > /dev/null 2>&1; then
        log "Application is running successfully!"
    else
        warn "Application may not be responding. Check logs:"
        echo "  docker-compose -f docker-compose.prod.yml logs"
    fi
}

# Main installation function
main() {
    log "Starting INFOtrac installation on Ubuntu server..."
    log "Domain: $DOMAIN"
    log "Installation directory: $APP_DIR"

    check_root
    check_ubuntu
    update_system
    install_docker
    install_docker_compose
    install_nginx
    install_certbot
    setup_app_directory
    clone_repository
    setup_environment
    setup_nginx_config
    setup_ssl
    setup_firewall
    create_systemd_service
    setup_monitoring
    deploy_application

    log "INFOtrac installation completed successfully!"
    echo
    echo -e "${GREEN}Next steps:${NC}"
    echo "1. Edit environment file: nano $APP_DIR/.env.production"
    echo "2. Check application logs: docker-compose -f $APP_DIR/docker-compose.prod.yml logs"
    echo "3. Access your application: https://$DOMAIN"
    echo "4. Monitor with: systemctl status $APP_NAME"
    echo
    echo -e "${YELLOW}Important files:${NC}"
    echo "- Application: $APP_DIR"
    echo "- Logs: $LOG_DIR"
    echo "- Nginx config: $NGINX_CONFIG_DIR/$DOMAIN"
    echo "- Environment: $APP_DIR/.env.production"
}

# Run main function
main "$@"