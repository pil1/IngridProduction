#!/bin/bash
set -e

# Enhanced INFOtrac Deployment Script
# Supports local development and production deployments with monitoring

# Configuration
APP_NAME="infotrac"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_VERSION="${BUILD_VERSION:-$(git describe --tags --always 2>/dev/null || echo "latest")}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    echo "Enhanced INFOtrac Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  build       Build Docker images only"
    echo "  deploy      Full deployment (build + start services)"
    echo "  restart     Restart running services"
    echo "  stop        Stop all services"
    echo "  logs        Show service logs"
    echo "  health      Check service health"
    echo "  cleanup     Clean up unused Docker resources"
    echo "  monitor     Show monitoring information"
    echo "  rollback    Rollback to previous version"
    echo ""
    echo "Options:"
    echo "  --env ENV         Environment (production, staging)"
    echo "  --no-cache        Build without cache"
    echo "  --force           Force operation without confirmation"
    echo "  --version VER     Specific version to deploy"
    echo ""
    echo "Examples:"
    echo "  $0 deploy --env production"
    echo "  $0 build --no-cache"
    echo "  $0 rollback --version v1.2.3"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    # Check environment file
    if [[ ! -f ".env.production" ]]; then
        log_warn "No .env.production file found. Creating from example..."
        if [[ -f ".env.production.example" ]]; then
            cp .env.production.example .env.production
            log_warn "Please edit .env.production with your actual values"
            exit 1
        fi
    fi

    log_success "Prerequisites check passed"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."

    local build_args="--build-arg BUILD_DATE='$BUILD_DATE'"
    build_args="$build_args --build-arg GIT_COMMIT='$GIT_COMMIT'"
    build_args="$build_args --build-arg BUILD_VERSION='$BUILD_VERSION'"

    if [[ "$NO_CACHE" == "true" ]]; then
        build_args="$build_args --no-cache"
    fi

    # Export environment variables
    export BUILD_DATE
    export GIT_COMMIT
    export BUILD_VERSION

    # Build with docker-compose
    docker-compose -f "$DOCKER_COMPOSE_FILE" build $build_args

    log_success "Docker images built successfully"
}

# Deploy services
deploy_services() {
    log_info "Deploying services..."

    # Create necessary directories
    mkdir -p logs/nginx

    # Export build variables
    export BUILD_DATE
    export GIT_COMMIT
    export BUILD_VERSION

    # Start services
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d

    log_success "Services deployed successfully"

    # Wait for health checks
    log_info "Waiting for health checks..."
    sleep 30
    check_health
}

# Check service health
check_health() {
    log_info "Checking service health..."

    local services=("infotrac-frontend")
    local healthy=true

    for service in "${services[@]}"; do
        local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "unknown")

        case $health_status in
            "healthy")
                log_success "$service: Healthy"
                ;;
            "unhealthy")
                log_error "$service: Unhealthy"
                healthy=false
                ;;
            "starting")
                log_warn "$service: Still starting..."
                ;;
            *)
                log_warn "$service: Health status unknown"
                ;;
        esac
    done

    if [[ "$healthy" == "true" ]]; then
        log_success "All services are healthy"
        show_access_info
    else
        log_error "Some services are unhealthy. Check logs for details."
        return 1
    fi
}

# Show access information
show_access_info() {
    echo ""
    log_info "=== Access Information ==="
    log_info "Application: http://localhost:4211"
    log_info "Health Check: http://localhost:4211/health"
    log_info "Monitoring: http://localhost:9100 (Node Exporter)"
    echo ""
    log_info "=== Useful Commands ==="
    echo "  View logs: $0 logs"
    echo "  Check health: $0 health"
    echo "  Monitor resources: $0 monitor"
    echo ""
}

# Show service logs
show_logs() {
    local service="${1:-}"

    if [[ -n "$service" ]]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f --tail=50 "$service"
    else
        docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f --tail=50
    fi
}

# Show monitoring information
show_monitoring() {
    log_info "=== Container Status ==="
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps

    echo ""
    log_info "=== Resource Usage ==="
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

    echo ""
    log_info "=== Disk Usage ==="
    docker system df

    echo ""
    log_info "=== Health Checks ==="
    check_health
}

# Cleanup unused resources
cleanup_resources() {
    log_info "Cleaning up unused Docker resources..."

    if [[ "$FORCE" != "true" ]]; then
        read -p "This will remove unused images, containers, and networks. Continue? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Cleanup cancelled"
            exit 0
        fi
    fi

    docker system prune -f
    docker volume prune -f
    docker image prune -f

    log_success "Cleanup completed"
}

# Stop services
stop_services() {
    log_info "Stopping services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    log_success "Services stopped"
}

# Restart services
restart_services() {
    log_info "Restarting services..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" restart
    log_success "Services restarted"

    # Wait for health checks
    sleep 15
    check_health
}

# Rollback to previous version
rollback_version() {
    local version="$1"

    if [[ -z "$version" ]]; then
        log_error "Please specify version to rollback to"
        exit 1
    fi

    log_info "Rolling back to version: $version"

    # Stop current services
    stop_services

    # Set version and redeploy
    export BUILD_VERSION="$version"
    deploy_services
}

# Parse command line arguments
COMMAND=""
ENVIRONMENT="production"
NO_CACHE="false"
FORCE="false"
VERSION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        build|deploy|restart|stop|logs|health|cleanup|monitor|rollback)
            COMMAND="$1"
            shift
            ;;
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --no-cache)
            NO_CACHE="true"
            shift
            ;;
        --force)
            FORCE="true"
            shift
            ;;
        --version)
            VERSION="$2"
            BUILD_VERSION="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    log_info "INFOtrac Enhanced Deployment Script"
    log_info "Environment: $ENVIRONMENT"
    log_info "Version: $BUILD_VERSION"
    log_info "Git Commit: $GIT_COMMIT"
    echo ""

    case "$COMMAND" in
        build)
            check_prerequisites
            build_images
            ;;
        deploy)
            check_prerequisites
            build_images
            deploy_services
            ;;
        restart)
            restart_services
            ;;
        stop)
            stop_services
            ;;
        logs)
            show_logs "$2"
            ;;
        health)
            check_health
            ;;
        cleanup)
            cleanup_resources
            ;;
        monitor)
            show_monitoring
            ;;
        rollback)
            rollback_version "$VERSION"
            ;;
        *)
            log_error "No command specified"
            show_help
            exit 1
            ;;
    esac
}

main "$@"