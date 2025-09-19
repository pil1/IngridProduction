#!/bin/bash

# INFOtrac Deployment Script
# For updating existing installation

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
BACKUP_DIR="/var/backups/${APP_NAME}"

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

# Check if directory exists
check_installation() {
    if [[ ! -d "$APP_DIR" ]]; then
        error "INFOtrac installation not found at $APP_DIR. Run install.sh first."
    fi
}

# Create backup before deployment
create_backup() {
    log "Creating backup before deployment..."

    mkdir -p "$BACKUP_DIR"

    local backup_name="${APP_NAME}_pre_deploy_$(date +%Y%m%d_%H%M%S).tar.gz"
    local backup_path="$BACKUP_DIR/$backup_name"

    # Stop application
    cd "$APP_DIR"
    docker-compose -f docker-compose.prod.yml down || true

    # Create backup
    tar -czf "$backup_path" -C "/opt" "$APP_NAME"

    log "Backup created: $backup_path"

    # Keep only last 10 backups
    find "$BACKUP_DIR" -name "${APP_NAME}_pre_deploy_*.tar.gz" -type f | \
        sort -r | tail -n +11 | xargs rm -f
}

# Pull latest changes
update_code() {
    log "Updating code from repository..."

    cd "$APP_DIR"

    # Stash any local changes
    git stash

    # Check if we need to update remote URL with token
    if [[ -n "$GITHUB_TOKEN" ]]; then
        log "Updating git remote with authentication token..."
        local current_remote=$(git remote get-url origin)
        local auth_remote=$(echo "$current_remote" | sed "s|https://github.com|https://${GITHUB_TOKEN}@github.com|")
        git remote set-url origin "$auth_remote"
    fi

    # Pull latest changes
    git pull origin main

    log "Code updated successfully"
}

# Update Docker images
update_images() {
    log "Updating Docker images..."

    cd "$APP_DIR"

    # Pull latest base images
    docker-compose -f docker-compose.prod.yml pull

    log "Docker images updated"
}

# Build and deploy
deploy() {
    log "Deploying application..."

    cd "$APP_DIR"

    # Build and start containers
    docker-compose -f docker-compose.prod.yml up -d --build

    log "Application deployed"
}

# Health check
health_check() {
    log "Performing health check..."

    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -f http://localhost:4211/health > /dev/null 2>&1; then
            log "✅ Health check passed"
            return 0
        fi

        log "Attempt $attempt/$max_attempts - waiting for application..."
        sleep 10
        ((attempt++))
    done

    error "❌ Health check failed after $max_attempts attempts"
}

# Cleanup old images and containers
cleanup() {
    log "Cleaning up old Docker resources..."

    # Remove unused images
    docker image prune -f

    # Remove unused containers
    docker container prune -f

    # Remove unused volumes
    docker volume prune -f

    log "Cleanup completed"
}

# Rollback function
rollback() {
    warn "Rolling back to previous version..."

    cd "$APP_DIR"

    # Stop current version
    docker-compose -f docker-compose.prod.yml down

    # Find latest backup
    local latest_backup=$(find "$BACKUP_DIR" -name "${APP_NAME}_pre_deploy_*.tar.gz" -type f | sort -r | head -n1)

    if [[ -z "$latest_backup" ]]; then
        error "No backup found for rollback"
    fi

    log "Restoring from backup: $latest_backup"

    # Extract backup
    cd "/opt"
    tar -xzf "$latest_backup"

    # Start application
    cd "$APP_DIR"
    docker-compose -f docker-compose.prod.yml up -d

    log "Rollback completed"
}

# Show deployment status
show_status() {
    log "Deployment Status:"
    echo

    # Docker containers status
    echo -e "${BLUE}Docker Containers:${NC}"
    docker-compose -f "$APP_DIR/docker-compose.prod.yml" ps
    echo

    # Application logs (last 20 lines)
    echo -e "${BLUE}Recent Application Logs:${NC}"
    docker-compose -f "$APP_DIR/docker-compose.prod.yml" logs --tail=20
    echo

    # System resources
    echo -e "${BLUE}System Resources:${NC}"
    echo "Memory Usage: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
    echo "Disk Usage: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')"
    echo "Load Average: $(uptime | awk -F'load average:' '{print $2}')"
}

# Main function
main() {
    local action="${1:-deploy}"

    case $action in
        "deploy")
            log "Starting deployment process..."
            check_installation
            create_backup
            update_code
            update_images
            deploy
            health_check
            cleanup
            log "✅ Deployment completed successfully!"
            ;;
        "rollback")
            log "Starting rollback process..."
            check_installation
            rollback
            health_check
            log "✅ Rollback completed successfully!"
            ;;
        "status")
            check_installation
            show_status
            ;;
        "update-only")
            log "Updating code only (no deployment)..."
            check_installation
            update_code
            log "✅ Code updated successfully!"
            ;;
        *)
            echo "Usage: $0 {deploy|rollback|status|update-only}"
            echo
            echo "Commands:"
            echo "  deploy      - Full deployment with backup"
            echo "  rollback    - Rollback to previous version"
            echo "  status      - Show deployment status"
            echo "  update-only - Update code without deploying"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'error "Deployment interrupted"' INT TERM

# Run main function
main "$@"