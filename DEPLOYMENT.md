# 🚀 INFOtrac Production Deployment Guide

## Overview

This guide establishes the efficient development → production workflow for INFOtrac database changes, resolving the super-admin authentication issues permanently.

## Quick Deployment (Recommended)

### 1. Authenticate with Supabase
```bash
# Get your access token from: https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN="your-access-token-here"
```

### 2. Deploy to Production
```bash
npm run db:deploy
```

That's it! The script handles linking, migration deployment, and verification.

## Manual Deployment Steps

If the automated script doesn't work:

### Step 1: Link to Production
```bash
npm run db:link
```

### Step 2: Deploy Migrations
```bash
npm run db:push
```

### Step 3: Verify Deployment
```bash
npm run db:migrations
```

## Alternative: Manual SQL Execution

If CLI deployment fails, execute the SQL scripts manually:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/teyivlpjxmpitqaqmucx)
2. Navigate to SQL Editor
3. Copy and execute scripts from `deploy-to-production.md`

## What Gets Deployed

### 🔧 Schema Changes (Migration 017)
- Adds `first_name` and `last_name` columns to profiles table
- Migrates existing `full_name` data to separate fields
- Creates indexes for name-based searches

### 👑 Super-Admin Accounts (Migration 018)
- Creates production auth users with proper bcrypt passwords
- Creates profiles bound to INFOtrac company
- Enables all modules for super-admin users

### 🔒 Security Policies (Migration 019)
- Fixes any RLS policy conflicts if needed

## Production Credentials

After deployment, these super-admin accounts will be available:

- **Email**: `super@phantomglass.com`
- **Password**: `SuperAdmin2024!`

- **Email**: `admin@infotrac.com`
- **Password**: `InfotracAdmin2024!`

## Verification Checklist

After deployment, verify:

- [ ] Super-admin login works in production
- [ ] Dashboard loads without crashes
- [ ] No profile completion loops
- [ ] All modules are accessible
- [ ] Users can create accounts with first/last name requirements

## Future Development Workflow

Once linked, database changes are streamlined:

```bash
# Create new migration
npx supabase migration new "description_of_change"

# Edit the generated .sql file in supabase/migrations/

# Deploy to production
npm run db:push

# Verify deployment
npm run db:migrations
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run db:deploy` | Full automated deployment script |
| `npm run db:link` | Link local project to production |
| `npm run db:push` | Deploy migrations to production |
| `npm run db:migrations` | List migration status |
| `npm run db:start` | Start local Supabase |
| `npm run db:reset` | Reset local database |
| `npm run db:studio` | Open local database studio |

## Development vs Production

### Local Development
- **Database**: Local Supabase instance (port 54322)
- **URL**: `http://127.0.0.1:54321`
- **Purpose**: Development and testing

### Production
- **Database**: Hosted Supabase instance
- **URL**: `https://teyivlpjxmpitqaqmucx.supabase.co`
- **Purpose**: Live application

## Troubleshooting

### "Access token not provided"
- Get token from [Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens)
- Set environment variable: `export SUPABASE_ACCESS_TOKEN="your-token"`

### "Project not found"
- Verify project reference: `teyivlpjxmpitqaqmucx`
- Check project access permissions in Supabase dashboard

### "Migration failed"
- Check error logs for specific issues
- Try manual SQL execution as backup
- Verify schema compatibility

### Super-admin login still fails
- Verify migrations were applied: `npm run db:migrations`
- Check auth.users table has the super-admin entries
- Verify profiles table has the accounts with correct company binding

## Success Indicators

✅ **Local Development**: Super-admin login works locally
✅ **Production Deployment**: Migrations applied successfully
✅ **Production Testing**: Super-admin login works in production
✅ **Efficient Workflow**: Future changes deploy with one command

This establishes the production-ready, efficient development workflow you need!