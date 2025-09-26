# 🐳 INFOtrac Docker Production Deployment

**Status**: Production Ready with PostgreSQL Database
**Date**: September 24, 2025

## 🚀 **Quick Start Deployment**

### **Prerequisites**
- Docker 20.0+ installed
- Docker Compose installed
- Server with domain access
- Local PostgreSQL database setup complete

### **1-Command Deployment**
```bash
# Make deployment script executable
chmod +x deploy-infotrac.sh

# Deploy with interactive setup
./deploy-infotrac.sh
```

That's it! The script will:
- ✅ **Check prerequisites** (Docker, Docker Compose)
- ✅ **Build complete stack** (PostgreSQL, Redis, Backend, Frontend, Nginx)
- ✅ **Interactive environment setup** (prompts for all required vars)
- ✅ **Deploy and start** the full application stack
- ✅ **Health checks** and status verification
- ✅ **Show logs** and management commands

## 📋 **Environment Variables Required**

During deployment, you'll be prompted for:

### **Required (Database)**
- `DATABASE_URL` - PostgreSQL connection string
- `POSTGRES_DB` - PostgreSQL database name (default: infotrac)
- `POSTGRES_USER` - Database username (default: infotrac_user)
- `POSTGRES_PASSWORD` - Database password (generated if not set)
- `JWT_SECRET` - JWT token signing secret (generated if not set)

### **Optional (API Keys)**
- `OPENAI_API_KEY` - For AI features
- `REDIS_URL` - Redis connection string (auto-configured)
- `SMTP_HOST` - For email functionality
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password

### **Auto-Configured**
- `NODE_ENV=production`
- `VITE_API_URL=http://backend:3001/api`
- Port `80` (HTTP) and `443` (HTTPS) configuration

## 🛠️ **Manual Deployment Steps**

If you prefer manual control:

### **1. Build the Complete Stack**
```bash
docker-compose -f docker-compose.production.yml build
```

### **2. Start All Services**
```bash
docker-compose -f docker-compose.production.yml up -d
```

### **3. Configure Environment**
The stack will automatically initialize with default configurations.

### **4. Verify Deployment**
```bash
# Check all container status
docker-compose ps

# Test backend health endpoint
curl -f http://localhost:3001/health

# Test frontend
curl -f http://localhost

# View all logs
docker-compose -f docker-compose.production.yml logs -f
```

## 📁 **File Structure**

```
INFOtrac/
├── docker/
│   ├── Dockerfile.production      # Production-optimized Dockerfile
│   ├── nginx-production.conf      # Nginx configuration
│   └── entrypoint.sh             # Container startup script
├── backend/
│   ├── Dockerfile.dev            # Backend development container
│   └── package.json              # Node.js backend dependencies
├── database/
│   ├── init/                     # Database initialization scripts
│   └── migrations/               # PostgreSQL migration files
├── docker-compose.yml            # Production compose config
├── docker-compose.dev.yml        # Development compose config
├── deploy-infotrac.sh            # One-command deployment
├── dev-setup.sh                  # Development environment setup
├── .dockerignore                 # Build optimization
└── DOCKER_DEPLOYMENT.md          # This documentation
```

## 🔧 **Configuration Details**

### **Nginx Configuration**
- **Port**: 4211 (as specified)
- **Domain**: info.onbb.ca
- **SSL**: Ready for SSL termination
- **Gzip**: Enabled for performance
- **Security headers**: Full security hardening
- **Health endpoint**: `/health.json`

### **Container Features**
- **Multi-stage build** for optimized image size
- **Non-root user** for security
- **Health checks** with automatic restart
- **Volume persistence** for config and logs
- **Resource limits** (512MB RAM, 0.5 CPU)
- **Security hardening** (no-new-privileges)

### **Environment Management**
- **Interactive setup** on first run
- **Persistent configuration** in volumes
- **Validation** of required variables
- **Connectivity testing** to Supabase
- **Runtime config injection** for frontend

## 🌐 **Access Information**

### **Application URLs**
- **Main App**: `http://localhost:8080` (development) or configured domain
- **API Health**: `http://localhost:3001/health`
- **Database**: `localhost:5432` (PostgreSQL)
- **Redis**: `localhost:6379`

### **Container Management**
```bash
# View logs
docker-compose -f docker-compose.production.yml logs -f

# Stop application
docker-compose -f docker-compose.production.yml down

# Restart application
docker-compose -f docker-compose.production.yml restart

# Update deployment
./deploy-infotrac.sh

# Shell access
docker exec -it infotrac-production /bin/sh
```
- Domain pointing to your server (info.onbb.ca)
- Supabase project with database

### 1. Installation (Private Repository)

Since this is a private repository, you'll need to clone it manually with your GitHub Personal Access Token:

```bash
# Clone the repository with your GitHub PAT
git clone https://github.com/pil1/INFOtracClaude.git /tmp/infotrac

# Navigate to deployment scripts
cd /tmp/infotrac/scripts/deployment

# Make scripts executable
chmod +x *.sh

# Run installation with PAT support
sudo GITHUB_REPO="https://github.com/pil1/INFOtracClaude.git" \
     GITHUB_TOKEN="your_github_pat_here" \
     EMAIL="your-email@example.com" \
     ./install.sh
```

**Alternative: Set PAT as environment variable**
```bash
export GITHUB_TOKEN="your_personal_access_token"
sudo -E GITHUB_REPO="https://github.com/pil1/INFOtracClaude.git" \
       EMAIL="your-email@example.com" \
       ./install.sh
```

### 2. Configure Your Environment

```bash
# Edit the environment file with your Supabase credentials
sudo nano /opt/infotrac/.env.production
```

Add your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Deploy the Application

```bash
cd /opt/infotrac/scripts/deployment
sudo ./deploy.sh deploy
```

## 🏗️ Architecture

```
Internet → Nginx (SSL/HTTPS) → React Frontend (Vite)
                                       ↓
                              Node.js/Express Backend
                                       ↓
                          PostgreSQL + Redis Containers
                                       ↓
                                JWT Authentication
```

### What Gets Installed:
- ✅ **Docker & Docker Compose** - Container runtime
- ✅ **Nginx Container** - Reverse proxy with SSL termination
- ✅ **PostgreSQL Container** - Primary database
- ✅ **Redis Container** - Session storage and caching
- ✅ **Node.js Backend Container** - REST API and business logic
- ✅ **React Frontend Container** - User interface

### What Does NOT Get Installed:
- ❌ Node.js (runs inside container)
- ❌ npm/yarn (runs inside container)
- ❌ Application dependencies (bundled in container)

## 🛠️ Management Commands

```bash
cd /opt/infotrac/scripts/deployment

# Deploy updates
sudo ./deploy.sh deploy

# Check application health
sudo ./maintenance.sh health

# View logs
sudo ./maintenance.sh logs

# Monitor resources
sudo ./maintenance.sh monitor

# Restart application
sudo ./maintenance.sh restart

# Rollback to previous version
sudo ./deploy.sh rollback
```

## 🔍 Verify Installation

1. **Check Docker containers:**
   ```bash
   docker ps
   ```

2. **Test application:**
   ```bash
   curl -f http://localhost:8080/health
   ```

3. **Access your app:**
   - Local: http://localhost:8080
   - Public: https://info.onbb.ca

## 📊 Container Details

### Main Application Container
- **Name:** `infotrac-frontend`
- **Port:** 8080 → 80 (internal)
- **Base Image:** nginx:alpine
- **Size:** ~50MB (optimized multi-stage build)

### Auto-Update Container (Optional)
- **Name:** `infotrac-watchtower`
- **Function:** Automatically updates containers daily at 2 AM
- **Notifications:** Email alerts for updates

## 🔧 Troubleshooting

### Container Not Starting
```bash
# Check container logs
docker logs infotrac-frontend

# Check compose status
docker-compose -f /opt/infotrac/docker-compose.prod.yml ps
```

### SSL Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificates
sudo certbot renew
```

### High Resource Usage
```bash
# Monitor container resources
docker stats infotrac-frontend

# Clean up unused Docker resources
sudo ./maintenance.sh docker
```

## 🚀 Benefits of Container-Only Deployment

1. **Isolated Environment** - No conflicts with system packages
2. **Consistent Deployment** - Same environment everywhere
3. **Easy Updates** - Pull new container images
4. **Resource Efficiency** - Optimized multi-stage builds
5. **Security** - Containers run with minimal privileges
6. **Rollback Support** - Quick rollback to previous versions

## 📁 File Locations

```
/opt/infotrac/                    # Application directory
├── docker-compose.prod.yml      # Production container config
├── .env.production              # Environment variables
├── logs/                        # Application logs
└── scripts/deployment/          # Management scripts

/var/log/infotrac/               # System logs
├── nginx_access.log
└── nginx_error.log

/etc/nginx/sites-available/      # Nginx configuration
└── info.onbb.ca
```

## ⚡ Performance

- **Cold Start:** ~30 seconds
- **Memory Usage:** ~100MB per container
- **Build Time:** ~2-3 minutes
- **SSL Setup:** ~2 minutes (automatic)

Your INFOtrac application is now running entirely in Docker containers! 🎉