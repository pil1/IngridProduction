#!/bin/bash

# =================================================================
# INFOtrac Development Environment Setup Script
# =================================================================
# This script sets up the local development environment with PostgreSQL
# =================================================================

set -e  # Exit on any error

echo "🚀 Setting up INFOtrac Development Environment..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Determine Docker Compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

echo "✅ Docker Compose is available"

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from development template..."
    cp .env.development .env
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
$DOCKER_COMPOSE -f docker-compose.dev.yml down --volumes --remove-orphans

# Build and start the development environment
echo "🏗️  Building and starting development environment..."
$DOCKER_COMPOSE -f docker-compose.dev.yml up -d --build

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# Check PostgreSQL health
echo "🔍 Checking PostgreSQL connection..."
if $DOCKER_COMPOSE -f docker-compose.dev.yml exec postgres pg_isready -U infotrac_user -d infotrac; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready"
    exit 1
fi

# Check Redis health
echo "🔍 Checking Redis connection..."
if $DOCKER_COMPOSE -f docker-compose.dev.yml exec redis redis-cli ping | grep -q PONG; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready"
    exit 1
fi

# Wait for backend to be healthy
echo "⏳ Waiting for backend to start..."
for i in {1..30}; do
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ Backend is ready"
        break
    fi
    echo "   Attempt $i/30 - waiting for backend..."
    sleep 2
done

if ! curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "❌ Backend failed to start"
    echo "📋 Backend logs:"
    $DOCKER_COMPOSE -f docker-compose.dev.yml logs backend
    exit 1
fi

echo ""
echo "🎉 Development environment is ready!"
echo ""
echo "📊 Service Status:"
echo "   PostgreSQL: http://localhost:5432"
echo "   Redis:      http://localhost:6379"
echo "   Backend:    http://localhost:3001"
echo "   Frontend:   Start with 'npm run dev'"
echo ""
echo "🔧 Useful commands:"
echo "   View logs:           $DOCKER_COMPOSE -f docker-compose.dev.yml logs -f"
echo "   Stop services:       $DOCKER_COMPOSE -f docker-compose.dev.yml down"
echo "   Reset database:      $DOCKER_COMPOSE -f docker-compose.dev.yml down -v && ./dev-setup.sh"
echo "   Backend shell:       $DOCKER_COMPOSE -f docker-compose.dev.yml exec backend sh"
echo "   Database shell:      $DOCKER_COMPOSE -f docker-compose.dev.yml exec postgres psql -U infotrac_user -d infotrac"
echo ""
echo "🚀 Ready to develop! Start the frontend with 'npm run dev'"