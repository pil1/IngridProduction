#!/bin/bash

# Production Migration Deployment Script
# This script deploys the super-admin authentication fixes to production

set -e  # Exit on any error

echo "🚀 Starting production deployment of super-admin fixes..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [[ ! -f "supabase/config.toml" ]]; then
    echo -e "${RED}❌ Error: Not in INFOtrac project directory${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo -e "${BLUE}📋 Checking current migration status...${NC}"

# Check if authenticated
if ! npx supabase status > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Supabase CLI not authenticated${NC}"
    echo "Please authenticate first:"
    echo "  1. Get your access token from: https://supabase.com/dashboard/account/tokens"
    echo "  2. Run: export SUPABASE_ACCESS_TOKEN=\"your-token-here\""
    echo "  3. Or run: npx supabase login --token \"your-token-here\""
    exit 1
fi

echo -e "${BLUE}🔗 Linking to production project...${NC}"

# Try to link to production
if ! npx supabase link --project-ref teyivlpjxmpitqaqmucx; then
    echo -e "${RED}❌ Failed to link to production project${NC}"
    echo "Please check your authentication and project access"
    exit 1
fi

echo -e "${BLUE}📊 Checking migration status...${NC}"

# List current migrations
npx supabase migration list

echo -e "${BLUE}🚀 Deploying migrations to production...${NC}"

# Deploy migrations
if npx supabase db push; then
    echo -e "${GREEN}✅ Migrations deployed successfully!${NC}"
else
    echo -e "${RED}❌ Migration deployment failed${NC}"
    echo "Check the error above and try manual deployment"
    exit 1
fi

echo -e "${BLUE}🔍 Verifying deployment...${NC}"

# Verify deployment
npx supabase migration list

echo -e "${GREEN}🎉 Production deployment completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📝 Super-admin credentials for production:${NC}"
echo "  • super@phantomglass.com / SuperAdmin2024!"
echo "  • admin@infotrac.com / InfotracAdmin2024!"
echo ""
echo -e "${BLUE}🧪 Next steps:${NC}"
echo "  1. Test super-admin login in production environment"
echo "  2. Verify dashboard access without crashes"
echo "  3. Confirm all modules are accessible"
echo ""
echo -e "${GREEN}✨ Efficient development workflow is now established!${NC}"
echo "Future migrations can be deployed with: npx supabase db push"