# INFOtrac Deployment Scripts

This directory contains scripts for deploying and maintaining INFOtrac on Ubuntu server for production use at **info.onbb.ca**.

## 📋 Scripts Overview

### 🚀 `install.sh` - Initial Server Setup
Complete Ubuntu server setup and initial deployment.

**What it does:**
- Installs Docker and Docker Compose
- Configures Nginx reverse proxy
- Sets up SSL with Let's Encrypt
- Creates application directory structure
- Clones repository and configures environment
- Sets up firewall and security
- Creates systemd service for auto-start
- Deploys the application

**Usage:**
```bash
# Run as root with environment variables
sudo GITHUB_REPO="https://github.com/your-username/infotrac.git" \
     EMAIL="your-email@example.com" \
     ./install.sh
```

### 🔄 `deploy.sh` - Application Deployment
Handles application updates and deployments with backup and rollback capabilities.

**Usage:**
```bash
# Deploy latest version
sudo ./deploy.sh deploy

# Rollback to previous version
sudo ./deploy.sh rollback

# Check deployment status
sudo ./deploy.sh status

# Update code only (no deployment)
sudo ./deploy.sh update-only
```

### 🔧 `maintenance.sh` - System Maintenance
Comprehensive maintenance and monitoring tools.

**Usage:**
```bash
# System health check
sudo ./maintenance.sh health

# Create backup
sudo ./maintenance.sh backup

# View application logs
sudo ./maintenance.sh logs 100

# Real-time monitoring
sudo ./maintenance.sh monitor

# Update system packages
sudo ./maintenance.sh update

# Docker maintenance
sudo ./maintenance.sh docker

# Restart application
sudo ./maintenance.sh restart

# Full maintenance routine
sudo ./maintenance.sh full-maintenance
```

## 🖥️ Server Requirements

### Minimum System Requirements
- **OS**: Ubuntu 20.04 LTS or newer
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 20GB available space
- **CPU**: 1 vCPU minimum, 2 vCPU recommended
- **Network**: Public IP with domain pointing to server

### Recommended System Requirements
- **OS**: Ubuntu 22.04 LTS
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **CPU**: 2-4 vCPUs
- **Network**: High-speed internet connection

## 🔧 Installation Process

### Step 1: Prepare Server
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install git if not present
sudo apt install -y git

# Clone repository
git clone https://github.com/your-username/infotrac.git /tmp/infotrac
cd /tmp/infotrac/scripts/deployment
```

### Step 2: Configure Environment
```bash
# Set required environment variables
export GITHUB_REPO="https://github.com/your-username/infotrac.git"
export EMAIL="your-email@example.com"

# Optional: Set notification settings
export NOTIFICATION_EMAIL_FROM="noreply@info.onbb.ca"
export NOTIFICATION_EMAIL_TO="admin@info.onbb.ca"
```

### Step 3: Run Installation
```bash
# Make script executable
chmod +x install.sh

# Run installation (as root)
sudo -E ./install.sh
```

### Step 4: Configure Application
```bash
# Edit environment variables
sudo nano /opt/infotrac/.env.production

# Required variables:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key

# Restart application
sudo ./deploy.sh deploy
```

## 🔒 Security Configuration

### Firewall Rules
The installation script configures UFW with the following rules:
- SSH (port 22): Allowed
- HTTP (port 80): Allowed (redirects to HTTPS)
- HTTPS (port 443): Allowed
- All other ports: Denied by default

### SSL Certificate
- Automatic SSL certificate from Let's Encrypt
- Auto-renewal configured via systemd timer
- HTTPS redirect enforced

### Security Headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000
- Content Security Policy configured

## 📁 Directory Structure

After installation, the following directory structure is created:

```
/opt/infotrac/                 # Main application directory
├── scripts/                   # Deployment and maintenance scripts
│   ├── deployment/
│   │   ├── install.sh
│   │   ├── deploy.sh
│   │   ├── maintenance.sh
│   │   └── README.md
│   ├── backup.sh             # Automated backup script
│   └── update.sh             # Automated update script
├── nginx/                    # Nginx configuration
│   ├── nginx.conf           # Development config
│   └── nginx.prod.conf      # Production config
├── docker-compose.yml       # Development compose
├── docker-compose.prod.yml  # Production compose
├── .env.production         # Production environment
└── logs/                   # Application logs

/var/log/infotrac/           # System logs
├── nginx_access.log
├── nginx_error.log
└── application_*.log

/var/backups/infotrac/       # Backup directory
└── infotrac_backup_*.tar.gz

/etc/nginx/sites-available/  # Nginx site configuration
└── info.onbb.ca

/etc/systemd/system/        # Systemd service
└── infotrac.service
```

## 🔄 Maintenance Tasks

### Daily Tasks (Automated)
- Application health monitoring
- Log rotation
- Backup creation (2 AM daily)
- Security updates (if configured)

### Weekly Tasks (Manual)
```bash
# System health check
sudo ./maintenance.sh health

# Docker maintenance
sudo ./maintenance.sh docker

# SSL certificate check
sudo ./maintenance.sh ssl-renew --dry-run
```

### Monthly Tasks (Manual)
```bash
# Full system update
sudo ./maintenance.sh update

# Full maintenance routine
sudo ./maintenance.sh full-maintenance

# Review and cleanup old backups
ls -la /var/backups/infotrac/
```

## 📊 Monitoring and Alerts

### Health Endpoints
- **Application**: `https://info.onbb.ca/health`
- **System**: Use `maintenance.sh monitor` for real-time stats

### Log Locations
- **Application logs**: `docker-compose logs`
- **Nginx access**: `/var/log/infotrac/nginx_access.log`
- **Nginx errors**: `/var/log/infotrac/nginx_error.log`
- **System logs**: `journalctl -u infotrac`

### Monitoring Commands
```bash
# Real-time application logs
sudo ./maintenance.sh logs

# System resource monitoring
sudo ./maintenance.sh monitor

# Docker container status
docker-compose -f /opt/infotrac/docker-compose.prod.yml ps

# System service status
systemctl status infotrac
```

## 🆘 Troubleshooting

### Common Issues

#### Application Not Starting
```bash
# Check Docker containers
docker-compose -f /opt/infotrac/docker-compose.prod.yml ps

# Check application logs
docker-compose -f /opt/infotrac/docker-compose.prod.yml logs

# Check system service
systemctl status infotrac
```

#### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Test renewal
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal
```

#### High Resource Usage
```bash
# Monitor resources
sudo ./maintenance.sh monitor

# Check Docker stats
docker stats

# Clean up Docker resources
sudo ./maintenance.sh docker
```

#### Database Connection Issues
```bash
# Check environment variables
cat /opt/infotrac/.env.production

# Test Supabase connection
curl -H "apikey: YOUR_ANON_KEY" "YOUR_SUPABASE_URL/rest/v1/"
```

### Emergency Procedures

#### Quick Rollback
```bash
# Rollback to previous version
sudo /opt/infotrac/scripts/deployment/deploy.sh rollback
```

#### Service Recovery
```bash
# Stop all services
sudo systemctl stop infotrac
sudo docker-compose -f /opt/infotrac/docker-compose.prod.yml down

# Start services
sudo systemctl start infotrac
# OR
sudo docker-compose -f /opt/infotrac/docker-compose.prod.yml up -d
```

#### Restore from Backup
```bash
# List available backups
ls -la /var/backups/infotrac/

# Stop application
sudo systemctl stop infotrac

# Restore backup (replace with actual backup file)
cd /opt
sudo tar -xzf /var/backups/infotrac/infotrac_backup_YYYYMMDD_HHMMSS.tar.gz

# Start application
sudo systemctl start infotrac
```

## 📞 Support and Updates

### Getting Help
1. Check application logs: `sudo ./maintenance.sh logs`
2. Run health check: `sudo ./maintenance.sh health`
3. Review troubleshooting section above
4. Check GitHub repository for updates

### Updating Scripts
```bash
# Update repository
cd /opt/infotrac
git pull origin main

# Make scripts executable
chmod +x scripts/deployment/*.sh

# Test deployment
sudo ./scripts/deployment/deploy.sh status
```

### Version Information
- **INFOtrac Version**: Check `package.json` in application directory
- **Docker Version**: `docker --version`
- **Docker Compose Version**: `docker-compose --version`
- **Nginx Version**: `nginx -v`
- **Ubuntu Version**: `lsb_release -a`

---

**For production deployment questions or issues, refer to the main README.md and INFOTRAC_UNIVERSAL_ROADMAP.md files.**