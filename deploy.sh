#!/bin/bash

# =================================================================
# INFOtrac Docker Deployment Script
# =================================================================
# This script handles the complete deployment of INFOtrac
# =================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    # Check Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Setup environment
setup_environment() {
    log_info "Setting up environment..."

    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_success "Created .env file from .env.example"
        else
            log_error ".env.example not found. Cannot create environment file."
            exit 1
        fi
    else
        log_info ".env file already exists, skipping creation"
    fi

    # Generate secure JWT secret if not set
    if ! grep -q "JWT_SECRET=your-super-secure" .env; then
        log_info "JWT secret already configured"
    else
        log_info "Generating secure JWT secret..."
        if command -v openssl &> /dev/null; then
            JWT_SECRET=$(openssl rand -base64 32)
            sed -i.bak "s/JWT_SECRET=your-super-secure.*/JWT_SECRET=$JWT_SECRET/" .env
            rm -f .env.bak
            log_success "Generated secure JWT secret"
        else
            log_warning "OpenSSL not found. Please manually update JWT_SECRET in .env file"
        fi
    fi

    # Create necessary directories
    mkdir -p uploads logs nginx/ssl

    # Set proper permissions
    chmod +x deploy.sh || true

    log_success "Environment setup completed"
}

# Build and deploy
deploy_services() {
    log_info "Building and deploying services..."

    # Pull base images
    log_info "Pulling base images..."
    docker-compose pull --ignore-pull-failures || log_warning "Some base images could not be pulled, will use cached versions"

    # Build services
    log_info "Building services..."
    docker-compose build --no-cache

    # Start services
    log_info "Starting services..."
    docker-compose up -d

    log_success "Services deployed successfully"
}

# Wait for services
wait_for_services() {
    log_info "Waiting for services to be ready..."

    # Wait for database
    log_info "Waiting for database..."
    for i in {1..30}; do
        if docker-compose exec -T postgres pg_isready -U infotrac_user -d infotrac &> /dev/null; then
            log_success "Database is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "Database failed to start within timeout"
            exit 1
        fi
        sleep 2
    done

    # Wait for backend API
    log_info "Waiting for backend API..."
    for i in {1..30}; do
        if curl -s http://localhost:3001/health &> /dev/null; then
            log_success "Backend API is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "Backend API failed to start within timeout"
            exit 1
        fi
        sleep 2
    done

    # Wait for frontend
    log_info "Waiting for frontend..."
    for i in {1..30}; do
        if curl -s http://localhost:8080/health &> /dev/null; then
            log_success "Frontend is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            log_warning "Frontend health check failed, but deployment may still be successful"
            break
        fi
        sleep 2
    done

    log_success "All services are ready"
}

# Show status
show_status() {
    log_info "Deployment Status:"
    echo
    docker-compose ps
    echo

    log_info "Service URLs:"
    echo -e "  ${BLUE}Application:${NC} http://localhost:8080"
    echo -e "  ${BLUE}API Health:${NC} http://localhost:8080/health"
    echo -e "  ${BLUE}Direct API:${NC} http://localhost:3001/api"
    echo

    log_info "Default Login Credentials:"
    echo -e "  ${YELLOW}Super Admin:${NC} admin@infotrac.com / admin123"
    echo -e "  ${YELLOW}Demo Admin:${NC} admin@demo.infotrac.com / demo123"
    echo

    log_warning "IMPORTANT: Change default passwords in production!"
    echo

    log_info "Useful Commands:"
    echo -e "  ${BLUE}View logs:${NC} docker-compose logs -f"
    echo -e "  ${BLUE}Stop services:${NC} docker-compose down"
    echo -e "  ${BLUE}Restart services:${NC} docker-compose restart"
    echo -e "  ${BLUE}Update services:${NC} docker-compose pull && docker-compose up -d"
}

# Cleanup function
cleanup() {
    log_info "Stopping services..."
    docker-compose down --volumes --remove-orphans
    docker system prune -f
    log_success "Cleanup completed"
}

# Main deployment process
main() {
    echo -e "${BLUE}"
    echo "========================================"
    echo "     INFOtrac Docker Deployment"
    echo "========================================"
    echo -e "${NC}"

    case "${1:-deploy}" in
        "deploy")
            check_prerequisites
            setup_environment
            deploy_services
            wait_for_services
            show_status
            log_success "Deployment completed successfully!"
            ;;
        "cleanup")
            cleanup
            ;;
        "status")
            show_status
            ;;
        "logs")
            docker-compose logs -f
            ;;
        *)
            echo "Usage: $0 [deploy|cleanup|status|logs]"
            echo
            echo "Commands:"
            echo "  deploy  - Deploy all services (default)"
            echo "  cleanup - Stop and remove all services"
            echo "  status  - Show current deployment status"
            echo "  logs    - Show and follow service logs"
            exit 1
            ;;
    esac
}

# Trap signals
trap 'log_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"