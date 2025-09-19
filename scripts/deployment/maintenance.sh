#!/bin/bash

# INFOtrac Maintenance Script
# For system monitoring, backups, and maintenance tasks

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
}

# System health check
system_health() {
    log "System Health Check"
    echo "==================="

    # Memory usage
    local mem_usage=$(free | awk '/Mem:/ {printf "%.1f", $3/$2 * 100}')
    echo -e "Memory Usage: ${mem_usage}%"
    if (( $(echo "$mem_usage > 80" | bc -l) )); then
        warn "High memory usage detected"
    fi

    # Disk usage
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    echo -e "Disk Usage: ${disk_usage}%"
    if [[ $disk_usage -gt 80 ]]; then
        warn "High disk usage detected"
    fi

    # Load average
    local load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    echo -e "Load Average: $load"

    # Docker status
    echo -e "\nDocker Containers:"
    if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -q "$APP_NAME"; then
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep "$APP_NAME"
    else
        warn "No INFOtrac containers running"
    fi

    # Application health
    echo -e "\nApplication Health:"
    if curl -f http://localhost:4211/health > /dev/null 2>&1; then
        log "✅ Application responding"
    else
        error "❌ Application not responding"
    fi

    # SSL certificate expiry
    check_ssl_expiry

    echo
}

# Check SSL certificate expiry
check_ssl_expiry() {
    local domain="info.onbb.ca"

    if command -v openssl > /dev/null; then
        local expiry_date=$(echo | openssl s_client -servername $domain -connect $domain:443 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)

        if [[ -n "$expiry_date" ]]; then
            local expiry_epoch=$(date -d "$expiry_date" +%s)
            local current_epoch=$(date +%s)
            local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))

            echo -e "SSL Certificate expires in: $days_until_expiry days"

            if [[ $days_until_expiry -lt 30 ]]; then
                warn "SSL certificate expires soon ($days_until_expiry days)"
            fi
        fi
    fi
}

# Create backup
backup() {
    log "Creating backup..."

    mkdir -p "$BACKUP_DIR"

    local backup_name="${APP_NAME}_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    local backup_path="$BACKUP_DIR/$backup_name"

    # Create backup
    tar -czf "$backup_path" \
        --exclude='node_modules' \
        --exclude='dist' \
        --exclude='.git' \
        -C "/opt" "$APP_NAME"

    log "Backup created: $backup_path"

    # Cleanup old backups (keep last 14 days)
    find "$BACKUP_DIR" -name "${APP_NAME}_backup_*.tar.gz" -type f -mtime +14 -delete

    # Show backup size
    local backup_size=$(du -h "$backup_path" | cut -f1)
    log "Backup size: $backup_size"
}

# Rotate logs
rotate_logs() {
    log "Rotating logs..."

    # Nginx logs
    if [[ -f "$LOG_DIR/nginx_access.log" ]]; then
        logrotate -f /etc/logrotate.d/nginx 2>/dev/null || true
    fi

    # Docker container logs
    docker-compose -f "$APP_DIR/docker-compose.prod.yml" logs --tail=1000 > "$LOG_DIR/application_$(date +%Y%m%d).log" 2>/dev/null || true

    # Cleanup old application logs (keep last 30 days)
    find "$LOG_DIR" -name "application_*.log" -type f -mtime +30 -delete

    log "Log rotation completed"
}

# Update system packages
update_system() {
    log "Updating system packages..."

    apt update
    apt list --upgradable

    # Security updates only
    if [[ "${1:-}" == "--security" ]]; then
        unattended-upgrades -d
    else
        read -p "Proceed with full system update? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            apt upgrade -y
            apt autoremove -y
            apt autoclean
        fi
    fi

    log "System update completed"
}

# Docker maintenance
docker_maintenance() {
    log "Docker maintenance..."

    # Update base images
    cd "$APP_DIR"
    docker-compose -f docker-compose.prod.yml pull

    # Remove unused images
    docker image prune -f

    # Remove unused containers
    docker container prune -f

    # Remove unused volumes
    docker volume prune -f

    # Remove unused networks
    docker network prune -f

    # Show docker system usage
    echo -e "\nDocker System Usage:"
    docker system df

    log "Docker maintenance completed"
}

# Monitor resources
monitor() {
    log "Resource Monitoring"
    echo "==================="

    while true; do
        clear
        echo -e "${BLUE}INFOtrac Resource Monitor${NC}"
        echo "Press Ctrl+C to exit"
        echo "Updated: $(date)"
        echo

        # System stats
        echo -e "${YELLOW}System Resources:${NC}"
        echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')"
        echo "Memory: $(free -h | awk '/^Mem:/ {print $3 "/" $2 " (" int($3/$2 * 100) "%)"}')"
        echo "Disk: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')"
        echo "Load: $(uptime | awk -F'load average:' '{print $2}')"
        echo

        # Docker stats
        echo -e "${YELLOW}Docker Containers:${NC}"
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | grep -E "(CONTAINER|$APP_NAME)" || echo "No containers running"
        echo

        # Network connections
        echo -e "${YELLOW}Network Connections:${NC}"
        netstat -tuln | grep -E ":80|:443|:22" | head -5
        echo

        sleep 5
    done
}

# Show application logs
logs() {
    local lines="${1:-100}"

    log "Showing last $lines lines of application logs..."

    cd "$APP_DIR"
    docker-compose -f docker-compose.prod.yml logs --tail="$lines" -f
}

# Restart application
restart() {
    log "Restarting application..."

    cd "$APP_DIR"

    # Graceful restart
    docker-compose -f docker-compose.prod.yml restart

    # Wait for application to start
    sleep 15

    # Health check
    if curl -f http://localhost:4211/health > /dev/null 2>&1; then
        log "✅ Application restarted successfully"
    else
        error "❌ Application failed to start after restart"
    fi
}

# SSL certificate renewal
renew_ssl() {
    log "Renewing SSL certificates..."

    # Dry run first
    certbot renew --dry-run

    if [[ $? -eq 0 ]]; then
        # Actual renewal
        certbot renew
        systemctl reload nginx
        log "SSL certificates renewed successfully"
    else
        error "SSL certificate renewal failed"
    fi
}

# Main function
main() {
    local action="${1:-health}"

    case $action in
        "health")
            system_health
            ;;
        "backup")
            backup
            ;;
        "logs")
            logs "${2:-100}"
            ;;
        "monitor")
            monitor
            ;;
        "update")
            update_system "${2:-}"
            ;;
        "docker")
            docker_maintenance
            ;;
        "restart")
            restart
            ;;
        "rotate-logs")
            rotate_logs
            ;;
        "ssl-renew")
            renew_ssl
            ;;
        "full-maintenance")
            log "Starting full maintenance routine..."
            backup
            rotate_logs
            docker_maintenance
            update_system --security
            system_health
            log "✅ Full maintenance completed"
            ;;
        *)
            echo "INFOtrac Maintenance Script"
            echo "Usage: $0 {command} [options]"
            echo
            echo "Commands:"
            echo "  health          - System health check (default)"
            echo "  backup          - Create application backup"
            echo "  logs [lines]    - Show application logs (default: 100)"
            echo "  monitor         - Real-time resource monitoring"
            echo "  update          - Update system packages"
            echo "  docker          - Docker maintenance and cleanup"
            echo "  restart         - Restart application"
            echo "  rotate-logs     - Rotate application logs"
            echo "  ssl-renew       - Renew SSL certificates"
            echo "  full-maintenance - Run complete maintenance routine"
            echo
            echo "Examples:"
            echo "  $0 health"
            echo "  $0 logs 50"
            echo "  $0 update --security"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'echo -e "\n${YELLOW}Maintenance interrupted${NC}"; exit 0' INT TERM

# Run main function
main "$@"