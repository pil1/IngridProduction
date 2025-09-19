#!/bin/bash

# Simple INFOtrac Docker Deployment
# No firewall, Nginx, or SSL setup - just Docker container deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_NAME="infotrac"
APP_DIR="/opt/${APP_NAME}"

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

# Install Docker if not present
install_docker() {
    if command -v docker &> /dev/null; then
        log "Docker is already installed: $(docker --version)"
        return
    fi

    log "Installing Docker..."

    # Install Docker
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh

    # Start and enable Docker
    systemctl start docker
    systemctl enable docker

    log "Docker installed successfully"
}

# Install Docker Compose if not present
install_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        log "Docker Compose is already installed: $(docker-compose --version)"
        return
    fi

    log "Installing Docker Compose..."

    local compose_version=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
    curl -L "https://github.com/docker/compose/releases/download/${compose_version}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

    log "Docker Compose installed successfully"
}

# Setup application directory
setup_app_directory() {
    log "Setting up application directory..."

    mkdir -p $APP_DIR
    chown -R $SUDO_USER:$SUDO_USER $APP_DIR 2>/dev/null || chown -R root:root $APP_DIR
    chmod 755 $APP_DIR

    log "Application directory created: $APP_DIR"
}

# Clone or update repository
setup_repository() {
    log "Setting up repository..."

    if [[ -z "$GITHUB_REPO" ]]; then
        error "GITHUB_REPO environment variable not set"
    fi

    if [[ -d "$APP_DIR/.git" ]]; then
        log "Repository exists, pulling latest changes..."
        cd $APP_DIR

        # Stash any local changes
        git stash

        # Update with PAT if provided
        if [[ -n "$GITHUB_TOKEN" ]]; then
            local current_remote=$(git remote get-url origin)
            local auth_remote=$(echo "$current_remote" | sed "s|https://github.com|https://${GITHUB_TOKEN}@github.com|")
            git remote set-url origin "$auth_remote"
        fi

        git pull origin main
    else
        log "Cloning repository..."
        cd $(dirname $APP_DIR)

        if [[ -n "$GITHUB_TOKEN" ]]; then
            local auth_repo=$(echo "$GITHUB_REPO" | sed "s|https://github.com|https://${GITHUB_TOKEN}@github.com|")
            git clone "$auth_repo" $(basename $APP_DIR)
        else
            git clone $GITHUB_REPO $(basename $APP_DIR)
        fi
    fi

    # Set permissions
    chown -R $SUDO_USER:$SUDO_USER $APP_DIR 2>/dev/null || chown -R root:root $APP_DIR

    log "Repository setup completed"
}

# Setup environment file
setup_environment() {
    log "Setting up environment configuration..."

    cd $APP_DIR

    if [[ ! -f .env.production ]]; then
        if [[ -f .env.example ]]; then
            cp .env.example .env.production
        else
            cat > .env.production << EOF
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
EOF
        fi
        warn "Created .env.production from template. Please edit with your values:"
        echo "  nano $APP_DIR/.env.production"
    fi

    # Create logs directory
    mkdir -p $APP_DIR/logs/nginx
    chown -R $SUDO_USER:$SUDO_USER $APP_DIR/logs 2>/dev/null || chown -R root:root $APP_DIR/logs

    log "Environment configured"
}

# Deploy application
deploy_application() {
    log "Deploying application with Docker..."

    cd $APP_DIR

    # Stop existing containers
    docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

    # Build and start containers
    docker-compose -f docker-compose.prod.yml up -d --build

    # Wait for application to start
    log "Waiting for application to start..."
    sleep 15

    # Health check
    local max_attempts=10
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -f http://localhost:4211/health > /dev/null 2>&1; then
            log "✅ Application is running successfully!"
            log "Container is available at: http://localhost:4211"
            return 0
        fi

        log "Attempt $attempt/$max_attempts - waiting for application..."
        sleep 10
        ((attempt++))
    done

    warn "Application may not be responding. Check logs:"
    echo "  docker-compose -f $APP_DIR/docker-compose.prod.yml logs"
}

# Show container status
show_status() {
    log "Docker Container Status:"
    echo
    docker-compose -f "$APP_DIR/docker-compose.prod.yml" ps
    echo
    log "Recent logs:"
    docker-compose -f "$APP_DIR/docker-compose.prod.yml" logs --tail=10
}

# Main deployment function
main() {
    log "Starting simple INFOtrac Docker deployment..."
    log "This script only handles Docker - no firewall or Nginx configuration"

    check_root
    install_docker
    install_docker_compose
    setup_app_directory
    setup_repository
    setup_environment
    deploy_application
    show_status

    log "✅ Simple deployment completed!"
    echo
    echo -e "${GREEN}Next steps:${NC}"
    echo "1. Edit environment file: nano $APP_DIR/.env.production"
    echo "2. Redeploy if needed: cd $APP_DIR && docker-compose -f docker-compose.prod.yml up -d --build"
    echo "3. View logs: docker-compose -f $APP_DIR/docker-compose.prod.yml logs"
    echo "4. Container runs on: http://localhost:4211"
    echo
    echo -e "${BLUE}Useful commands:${NC}"
    echo "- Stop: docker-compose -f $APP_DIR/docker-compose.prod.yml down"
    echo "- Restart: docker-compose -f $APP_DIR/docker-compose.prod.yml restart"
    echo "- Update: sudo $0 (run this script again)"
}

# Handle script interruption
trap 'error "Deployment interrupted"' INT TERM

# Run main function
main "$@"