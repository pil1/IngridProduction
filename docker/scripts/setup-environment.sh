#!/bin/bash

# INFOtrac Environment Setup Script
# Interactive setup for Docker deployment on info.onbb.ca:4211

set -e

echo "========================================="
echo "🚀 INFOtrac Production Deployment Setup"
echo "========================================="
echo ""
echo "Setting up INFOtrac for deployment on info.onbb.ca:4211"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to read input with validation
read_required() {
    local prompt="$1"
    local var_name="$2"
    local value=""

    while [ -z "$value" ]; do
        echo -e "${BLUE}$prompt${NC}"
        read -r value
        if [ -z "$value" ]; then
            echo -e "${RED}❌ This field is required. Please enter a value.${NC}"
        fi
    done

    export $var_name="$value"
}

# Function to read optional input
read_optional() {
    local prompt="$1"
    local var_name="$2"
    local default="$3"

    echo -e "${BLUE}$prompt${NC}"
    if [ -n "$default" ]; then
        echo -e "${YELLOW}  (Default: $default)${NC}"
    fi
    read -r value

    if [ -z "$value" ] && [ -n "$default" ]; then
        value="$default"
    fi

    export $var_name="$value"
}

echo "📋 Please provide the following environment variables:"
echo ""

# Required Supabase Configuration
echo -e "${GREEN}=== SUPABASE CONFIGURATION ===${NC}"
read_required "🔗 SUPABASE_URL (e.g., https://abc123.supabase.co):" SUPABASE_URL
read_required "🔑 SUPABASE_ANON_KEY (JWT token starting with eyJ...):" SUPABASE_ANON_KEY
read_required "🔐 SUPABASE_SERVICE_ROLE_KEY (JWT token for admin access):" SUPABASE_SERVICE_ROLE_KEY

echo ""

# Optional Database Configuration
echo -e "${GREEN}=== DATABASE CONFIGURATION (Optional) ===${NC}"
read_optional "🗄️  SUPABASE_DB_URL (PostgreSQL connection string):" SUPABASE_DB_URL ""
read_optional "📂 SUPABASE_PROJECT_REF (Project reference ID):" SUPABASE_PROJECT_REF ""

echo ""

# Optional API Keys
echo -e "${GREEN}=== API KEYS (Optional) ===${NC}"
read_optional "📧 RESEND_API_KEY (for email sending):" RESEND_API_KEY "YOUR_RESEND_API_KEY"
read_optional "🤖 OPENAI_API_KEY (for AI features):" OPENAI_API_KEY "YOUR_OPENAI_API_KEY"
read_optional "🔒 NEXTAUTH_SECRET (authentication secret):" NEXTAUTH_SECRET "YOUR_NEXTAUTH_SECRET"

echo ""

# Claude Code Configuration
echo -e "${GREEN}=== CLAUDE CODE INTEGRATION ===${NC}"
read_optional "🎯 SUPABASE_ACCESS_TOKEN (Claude API access token):" SUPABASE_ACCESS_TOKEN ""

echo ""

# Application Configuration
echo -e "${GREEN}=== APPLICATION SETTINGS ===${NC}"
read_optional "🌐 Application Environment:" VITE_APP_ENV "production"
read_optional "🏷️  Application Version:" VITE_APP_VERSION "2.0.0"

echo ""
echo -e "${GREEN}✅ Configuration Complete!${NC}"
echo ""

# Create the environment file
ENV_FILE="/app/config/.env.local"

echo "📝 Creating environment file..."

cat > "$ENV_FILE" << EOL
# INFOtrac Production Environment Configuration
# Generated on: $(date)
# Deployed to: info.onbb.ca:4211

# SUPABASE CONFIGURATION (REQUIRED)
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

# VITE ENVIRONMENT VARIABLES (Build-time)
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
VITE_APP_ENV=${VITE_APP_ENV}
VITE_API_BASE_URL=https://info.onbb.ca:4211
VITE_APP_VERSION=${VITE_APP_VERSION}
VITE_APP_NAME="INFOtrac"
VITE_APP_DESCRIPTION="Expense Management & Business Automation Platform"

EOL

# Add optional configurations if provided
if [ -n "$SUPABASE_DB_URL" ]; then
    echo "SUPABASE_DB_URL=${SUPABASE_DB_URL}" >> "$ENV_FILE"
fi

if [ -n "$SUPABASE_PROJECT_REF" ]; then
    echo "SUPABASE_PROJECT_REF=${SUPABASE_PROJECT_REF}" >> "$ENV_FILE"
fi

if [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "SUPABASE_ACCESS_TOKEN=${SUPABASE_ACCESS_TOKEN}" >> "$ENV_FILE"
fi

if [ -n "$RESEND_API_KEY" ] && [ "$RESEND_API_KEY" != "YOUR_RESEND_API_KEY" ]; then
    echo "RESEND_API_KEY=${RESEND_API_KEY}" >> "$ENV_FILE"
fi

if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "YOUR_OPENAI_API_KEY" ]; then
    echo "OPENAI_API_KEY=${OPENAI_API_KEY}" >> "$ENV_FILE"
fi

if [ -n "$NEXTAUTH_SECRET" ] && [ "$NEXTAUTH_SECRET" != "YOUR_NEXTAUTH_SECRET" ]; then
    echo "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}" >> "$ENV_FILE"
fi

# Add Claude Code configuration
cat >> "$ENV_FILE" << EOL

# CLAUDE CODE SPECIFIC SETTINGS
ENABLE_CLAUDE_DB_ACCESS=true
CLAUDE_DB_OPERATIONS=true
NODE_ENV=production

# CLAUDE OPERATION SETTINGS
CLAUDE_SAFETY_MODE=true
CLAUDE_AUTO_BACKUP=true
CLAUDE_LOG_QUERIES=true

# CLAUDE OPERATION LIMITS
CLAUDE_MAX_ROWS=10000
CLAUDE_QUERY_TIMEOUT=30000
CLAUDE_CONCURRENT_QUERIES=5

# CLAUDE SECURITY SETTINGS
CLAUDE_REQUIRE_CONFIRMATION=true
CLAUDE_BLOCK_DANGEROUS_OPS=true
CLAUDE_AUDIT_ALL_OPERATIONS=true
EOL

# Set proper permissions
chmod 600 "$ENV_FILE"

echo ""
echo -e "${GREEN}🎉 Environment setup complete!${NC}"
echo ""
echo "📁 Configuration file created at: $ENV_FILE"
echo "🔐 File permissions set to 600 (owner read/write only)"
echo ""
echo "🔍 Configuration Summary:"
echo "========================="
echo "• Supabase URL: $SUPABASE_URL"
echo "• Environment: $VITE_APP_ENV"
echo "• Version: $VITE_APP_VERSION"
echo "• Port: 4211"
echo "• Domain: info.onbb.ca"
echo ""
echo -e "${GREEN}✅ Ready to start INFOtrac!${NC}"
echo ""