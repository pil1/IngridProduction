# 🐳 Simple Docker Deployment

**INFOtrac** - Minimal Docker-only deployment script

## 🎯 What This Does

- ✅ Installs Docker & Docker Compose (if needed)
- ✅ Clones/updates your repository
- ✅ Runs `docker-compose up -d --build`
- ✅ Creates container on port 8080

## ❌ What This Does NOT Do

- ❌ No firewall configuration
- ❌ No Nginx setup
- ❌ No SSL certificates
- ❌ No domain configuration

*Perfect for when you manage your own infrastructure!*

## 🚀 Quick Deployment

### Option 1: One Command
```bash
sudo GITHUB_REPO="https://github.com/pil1/INFOtracClaude.git" \
     GITHUB_TOKEN="your_github_pat" \
     /path/to/simple-deploy.sh
```

### Option 2: Manual Steps
```bash
# 1. Clone the repo
git clone https://github.com/pil1/INFOtracClaude.git /tmp/infotrac

# 2. Run the simple deployment
cd /tmp/infotrac/scripts
sudo GITHUB_REPO="https://github.com/pil1/INFOtracClaude.git" \
     GITHUB_TOKEN="your_github_pat" \
     ./simple-deploy.sh
```

## 🔧 After Deployment

### 1. Configure Environment
```bash
sudo nano /opt/infotrac/.env.production
```

Add your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Restart Container
```bash
cd /opt/infotrac
sudo docker-compose -f docker-compose.prod.yml up -d --build
```

## 📱 Container Details

- **Location:** `/opt/infotrac`
- **Port:** `4211` (http://localhost:4211)
- **Container Name:** `infotrac-frontend`
- **Compose File:** `docker-compose.prod.yml`

## 🛠️ Management Commands

```bash
cd /opt/infotrac

# View status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs

# Restart
sudo docker-compose -f docker-compose.prod.yml restart

# Stop
sudo docker-compose -f docker-compose.prod.yml down

# Update (rebuild)
sudo docker-compose -f docker-compose.prod.yml up -d --build

# Re-run deployment script
sudo GITHUB_TOKEN="your_pat" /opt/infotrac/scripts/simple-deploy.sh
```

## 🔍 Health Check

```bash
# Test application
curl http://localhost:4211/health

# Container stats
docker stats infotrac-frontend
```

## 🔄 Updates

To update your application:

```bash
# Method 1: Re-run deployment script
sudo GITHUB_TOKEN="your_pat" /opt/infotrac/scripts/simple-deploy.sh

# Method 2: Manual update
cd /opt/infotrac
git pull origin main
sudo docker-compose -f docker-compose.prod.yml up -d --build
```

## 🏗️ Your Infrastructure Setup

Since you manage your own infrastructure, you'll need to:

1. **Reverse Proxy:** Point your Nginx to `http://localhost:4211`
2. **SSL:** Handle SSL termination in your Nginx
3. **Firewall:** Ensure port 4211 is accessible from your reverse proxy
4. **Domain:** Configure your DNS and Nginx virtual host

Example Nginx configuration snippet:
```nginx
location / {
    proxy_pass http://localhost:4211;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 🎯 Perfect For

- ✅ Existing server infrastructure
- ✅ Custom Nginx configurations
- ✅ Managed firewalls
- ✅ Custom SSL setups
- ✅ Multi-application servers

Simple, clean, and focused! 🐳