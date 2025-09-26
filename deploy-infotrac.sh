#!/bin/bash

# INFOtrac Production Deployment Script
# Deploys INFOtrac to info.onbb.ca:4211 with interactive environment setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Banner
echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}🚀 INFOtrac Production Deployment${NC}"
echo -e "${BOLD}================================================${NC}"
echo ""
echo -e "${GREEN}Target: info.onbb.ca:4211${NC}"
echo -e "${BLUE}Version: 2.0.0${NC}"
echo -e "${YELLOW}Date: $(date)${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${YELLOW}⚠️  docker-compose not found, checking for 'docker compose'...${NC}"
    if ! docker compose version >/dev/null 2>&1; then
        echo -e "${RED}❌ Neither docker-compose nor 'docker compose' found${NC}"
        echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    else
        COMPOSE_CMD="docker compose"
    fi
else
    COMPOSE_CMD="docker-compose"
fi

echo -e "${GREEN}✅ Docker and Docker Compose are available${NC}"
echo ""

# Create required directories
echo -e "${BLUE}📁 Creating deployment directories...${NC}"
mkdir -p docker/data/config
mkdir -p docker/data/logs
echo -e "${GREEN}✅ Directories created${NC}"
echo ""

# Set proper permissions
chmod 755 docker/scripts/*.sh docker/entrypoint.sh

# Interactive mode check
INTERACTIVE=true
if [ "$1" = "--non-interactive" ]; then
    INTERACTIVE=false
    echo -e "${YELLOW}Running in non-interactive mode${NC}"
fi

# Environment setup
if [ "$INTERACTIVE" = true ]; then
    echo -e "${BLUE}🔧 Environment Configuration${NC}"
    echo "Do you want to configure environment variables now? (y/n)"
    read -r configure_env

    if [ "$configure_env" = "y" ] || [ "$configure_env" = "Y" ]; then
        # Run environment setup interactively
        echo -e "${GREEN}Starting interactive environment setup...${NC}"
        echo ""

        # We'll handle this during container startup for better UX
        echo -e "${YELLOW}Environment setup will run when the container starts.${NC}"
        echo -e "${YELLOW}The container will prompt you for all required variables.${NC}"
    fi
fi

echo ""

# Build and deployment options
echo -e "${BLUE}🏗️  Build Options${NC}"
echo "1. Build and deploy (recommended)"
echo "2. Deploy existing image"
echo "3. Build only (no deployment)"

if [ "$INTERACTIVE" = true ]; then
    read -p "Choose option (1-3): " build_option
else
    build_option=1
fi

case $build_option in
    1)
        echo -e "${GREEN}Building and deploying INFOtrac...${NC}"
        BUILD_AND_DEPLOY=true
        ;;
    2)
        echo -e "${GREEN}Deploying existing INFOtrac image...${NC}"
        BUILD_AND_DEPLOY=false
        ;;
    3)
        echo -e "${GREEN}Building INFOtrac image only...${NC}"
        BUILD_ONLY=true
        ;;
    *)
        echo -e "${YELLOW}Invalid option, defaulting to build and deploy${NC}"
        BUILD_AND_DEPLOY=true
        ;;
esac

echo ""

# Stop existing containers
echo -e "${BLUE}🛑 Stopping existing INFOtrac containers...${NC}"
$COMPOSE_CMD -f docker-compose.production.yml down || true
docker stop infotrac-production || true
docker rm infotrac-production || true
echo -e "${GREEN}✅ Cleanup complete${NC}"
echo ""

# Build phase
if [ "$BUILD_AND_DEPLOY" = true ] || [ "$BUILD_ONLY" = true ]; then
    echo -e "${BLUE}🏗️  Building INFOtrac production image...${NC}"

    # Build with progress output
    $COMPOSE_CMD -f docker-compose.production.yml build --no-cache --progress=plain

    echo -e "${GREEN}✅ Build complete${NC}"
    echo ""
fi

# Deploy phase
if [ "$BUILD_AND_DEPLOY" = true ] || [ "$BUILD_AND_DEPLOY" = false ]; then
    echo -e "${BLUE}🚀 Deploying INFOtrac to production...${NC}"

    # Start the container
    $COMPOSE_CMD -f docker-compose.production.yml up -d

    echo -e "${GREEN}✅ Deployment started${NC}"
    echo ""

    # Wait for container to be ready
    echo -e "${BLUE}⏳ Waiting for INFOtrac to start...${NC}"

    # Give it some time to start
    sleep 10

    # Check container status
    if docker ps | grep -q infotrac-production; then
        echo -e "${GREEN}✅ Container is running${NC}"

        # Check health
        echo -e "${BLUE}🏥 Checking application health...${NC}"
        sleep 5

        if curl -s -f http://localhost:4211/health.json >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Health check passed${NC}"
        else
            echo -e "${YELLOW}⚠️  Health check failed, but container is running${NC}"
            echo -e "${YELLOW}   The application may still be starting up${NC}"
        fi

    else
        echo -e "${RED}❌ Container failed to start${NC}"
        echo "Checking logs..."
        $COMPOSE_CMD -f docker-compose.production.yml logs --tail=50
        exit 1
    fi
fi

echo ""
echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}🎉 INFOtrac Deployment Complete!${NC}"
echo -e "${BOLD}================================================${NC}"
echo ""
echo -e "${GREEN}Application Details:${NC}"
echo "• URL: https://info.onbb.ca:4211"
echo "• Health Check: https://info.onbb.ca:4211/health.json"
echo "• Container: infotrac-production"
echo "• Port: 4211"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "• View logs: $COMPOSE_CMD -f docker-compose.production.yml logs -f"
echo "• Stop app: $COMPOSE_CMD -f docker-compose.production.yml down"
echo "• Restart: $COMPOSE_CMD -f docker-compose.production.yml restart"
echo "• Update: ./deploy-infotrac.sh"
echo ""

# Show container logs if requested
if [ "$INTERACTIVE" = true ]; then
    echo "Would you like to view the application logs? (y/n)"
    read -r show_logs

    if [ "$show_logs" = "y" ] || [ "$show_logs" = "Y" ]; then
        echo -e "${BLUE}📋 Showing application logs (Ctrl+C to exit)...${NC}"
        echo ""
        $COMPOSE_CMD -f docker-compose.production.yml logs -f
    fi
fi

echo -e "${GREEN}🚀 INFOtrac is now running at https://info.onbb.ca:4211${NC}"