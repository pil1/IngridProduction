# 🐳 Docker-Only Deployment Guide

**INFOtrac** - Fully Containerized Deployment for Ubuntu Server

## 🚀 Quick Deployment

Your entire application runs in Docker containers - **no local Node.js installation required!**

### Prerequisites
- Ubuntu 20.04+ server
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
Internet → Nginx (SSL/HTTPS) → Docker Container (React App)
                                     ↓
                              Supabase (Database)
```

### What Gets Installed:
- ✅ **Docker & Docker Compose** - Container runtime
- ✅ **Nginx** - Reverse proxy with SSL termination
- ✅ **Let's Encrypt SSL** - Automatic HTTPS certificates
- ✅ **UFW Firewall** - Security configuration
- ✅ **INFOtrac Container** - Your React application

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