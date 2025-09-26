#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🚀 RUNNING DATABASE MIGRATIONS (Direct SQL Execution)');
console.log('=====================================================\n');

// Create Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function executeSQLDirect(sql, description) {
  console.log(`\n🔧 ${description}`);
  console.log('─'.repeat(50));

  try {
    // Use a direct SQL execution approach via fetch
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ sql: sql })
    });

    if (!response.ok) {
      // Try alternative approach with basic table creation
      const { data, error } = await supabase
        .rpc('exec', { sql: sql })
        .catch(async () => {
          // Fallback: try to execute as individual DDL statements
          console.log('   Attempting fallback execution method...');

          // Create a temporary function to execute the SQL
          const tempFuncName = `temp_migration_${Date.now()}`;
          const wrapperSQL = `
            CREATE OR REPLACE FUNCTION ${tempFuncName}()
            RETURNS text AS $$
            BEGIN
              ${sql}
              RETURN 'Migration executed successfully';
            END;
            $$ LANGUAGE plpgsql;

            SELECT ${tempFuncName}();
            DROP FUNCTION ${tempFuncName}();
          `;

          return await supabase.rpc(tempFuncName.replace('temp_migration_', ''), {});
        });

      if (error) {
        console.log(`❌ Failed: ${error.message}`);
        return false;
      }
    }

    console.log('✅ Executed successfully');
    return true;

  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return false;
  }
}

async function createMigrationTables() {
  console.log('🔧 Creating Ingrid Suggested Categories Table');
  const categoriesSQL = `
    CREATE TABLE IF NOT EXISTS public.ingrid_suggested_categories (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
      suggested_name varchar(255) NOT NULL,
      suggested_description text,
      suggested_gl_account_code varchar(50),
      confidence_score decimal(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
      ai_reasoning text,
      fuzzy_match_score decimal(3,2) CHECK (fuzzy_match_score >= 0 AND fuzzy_match_score <= 1),
      semantic_match_score decimal(3,2) CHECK (semantic_match_score >= 0 AND semantic_match_score <= 1),
      source_document_name varchar(500),
      source_document_text text,
      extracted_keywords text[],
      status varchar(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
      usage_count integer DEFAULT 0,
      last_used_at timestamp with time zone,
      approved_by uuid REFERENCES public.profiles(id),
      approved_at timestamp with time zone,
      rejected_by uuid REFERENCES public.profiles(id),
      rejected_at timestamp with time zone,
      rejection_reason text,
      merged_with_category_id uuid REFERENCES public.expense_categories(id),
      merged_by uuid REFERENCES public.profiles(id),
      merged_at timestamp with time zone,
      suggestion_metadata jsonb DEFAULT '{}',
      processing_version varchar(20) DEFAULT '1.0',
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    );
  `;

  const vendorsSQL = `
    CREATE TABLE IF NOT EXISTS public.ingrid_suggested_vendors (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
      suggested_name varchar(255) NOT NULL,
      suggested_contact_person varchar(255),
      suggested_email varchar(255),
      suggested_phone varchar(50),
      suggested_website varchar(500),
      suggested_address_line1 varchar(255),
      suggested_address_line2 varchar(255),
      suggested_city varchar(100),
      suggested_state varchar(100),
      suggested_postal_code varchar(20),
      suggested_country varchar(100),
      suggested_tax_id varchar(50),
      suggested_business_type varchar(100),
      suggested_industry varchar(100),
      confidence_score decimal(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
      ai_reasoning text,
      fuzzy_match_score decimal(3,2) CHECK (fuzzy_match_score >= 0 AND fuzzy_match_score <= 1),
      semantic_match_score decimal(3,2) CHECK (semantic_match_score >= 0 AND semantic_match_score <= 1),
      web_enrichment_data jsonb DEFAULT '{}',
      web_enrichment_confidence decimal(3,2) CHECK (web_enrichment_confidence >= 0 AND web_enrichment_confidence <= 1),
      web_enrichment_sources text[],
      web_enrichment_timestamp timestamp with time zone,
      source_document_name varchar(500),
      source_document_text text,
      extracted_keywords text[],
      status varchar(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
      usage_count integer DEFAULT 0,
      last_used_at timestamp with time zone,
      approved_by uuid REFERENCES public.profiles(id),
      approved_at timestamp with time zone,
      rejected_by uuid REFERENCES public.profiles(id),
      rejected_at timestamp with time zone,
      rejection_reason text,
      merged_with_vendor_id uuid REFERENCES public.vendors(id),
      merged_by uuid REFERENCES public.profiles(id),
      merged_at timestamp with time zone,
      merge_notes text,
      potential_duplicates uuid[],
      duplicate_confidence_scores decimal(3,2)[],
      duplicate_detection_metadata jsonb DEFAULT '{}',
      suggestion_metadata jsonb DEFAULT '{}',
      processing_version varchar(20) DEFAULT '1.0',
      data_completeness_score decimal(3,2) CHECK (data_completeness_score >= 0 AND data_completeness_score <= 1),
      verification_status varchar(50) DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'invalid')),
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    );
  `;

  const apiKeysSQL = `
    CREATE TABLE IF NOT EXISTS public.company_api_keys (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
      provider varchar(100) NOT NULL CHECK (provider IN (
        'openai', 'resend', 'stripe', 'quickbooks', 'xero', 'sage',
        'zapier', 'webhook', 'custom', 'google', 'microsoft', 'aws'
      )),
      provider_name varchar(255) NOT NULL,
      description text,
      api_key_encrypted text NOT NULL,
      api_key_last_four varchar(10),
      api_key_hash varchar(64),
      api_endpoint varchar(500),
      api_version varchar(50),
      configuration jsonb DEFAULT '{}',
      monthly_usage_limit integer DEFAULT 0,
      usage_count integer DEFAULT 0,
      last_used_at timestamp with time zone,
      usage_reset_date date,
      is_active boolean DEFAULT true,
      allowed_environments text[] DEFAULT ARRAY['production'],
      ip_whitelist inet[],
      rate_limit_per_minute integer DEFAULT 0,
      notes text,
      tags text[],
      integration_status varchar(50) DEFAULT 'inactive' CHECK (integration_status IN (
        'active', 'inactive', 'error', 'expired', 'suspended'
      )),
      expires_at timestamp with time zone,
      renewal_reminder_sent boolean DEFAULT false,
      created_by uuid REFERENCES public.profiles(id),
      updated_by uuid REFERENCES public.profiles(id),
      last_tested_at timestamp with time zone,
      last_test_result text,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      CONSTRAINT unique_company_provider_name UNIQUE (company_id, provider, provider_name)
    );
  `;

  // Execute each table creation
  let successCount = 0;

  console.log('\n📋 Creating suggested categories table...');
  if (await executeSQLDirect(categoriesSQL, 'Suggested Categories Table')) successCount++;

  console.log('\n📋 Creating suggested vendors table...');
  if (await executeSQLDirect(vendorsSQL, 'Suggested Vendors Table')) successCount++;

  console.log('\n📋 Creating API keys table...');
  if (await executeSQLDirect(apiKeysSQL, 'Company API Keys Table')) successCount++;

  return successCount;
}

async function createRPCFunctions() {
  console.log('\n🔧 Creating RPC Functions');

  const functions = [
    {
      name: 'user_has_permission',
      sql: `
        CREATE OR REPLACE FUNCTION user_has_permission(user_id uuid, permission_key text)
        RETURNS boolean AS $$
        DECLARE
          user_role text;
          user_company_id uuid;
        BEGIN
          SELECT role, company_id INTO user_role, user_company_id
          FROM public.profiles WHERE profiles.user_id = user_has_permission.user_id;

          IF user_role = 'super-admin' THEN RETURN true; END IF;

          RETURN EXISTS (
            SELECT 1 FROM public.role_permissions rp
            WHERE rp.role = user_role AND rp.permission_name = permission_key
          );
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    },
    {
      name: 'company_has_module',
      sql: `
        CREATE OR REPLACE FUNCTION company_has_module(company_id uuid, module_name text)
        RETURNS boolean AS $$
        BEGIN
          RETURN EXISTS (
            SELECT 1 FROM public.company_modules cm
            JOIN public.modules m ON cm.module_id = m.id
            WHERE cm.company_id = company_has_module.company_id
            AND m.name = module_name AND cm.is_enabled = true
          );
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    }
  ];

  let successCount = 0;

  for (const func of functions) {
    console.log(`\n   Creating function: ${func.name}`);
    if (await executeSQLDirect(func.sql, `Function ${func.name}`)) {
      successCount++;
    }
  }

  return successCount;
}

async function runAllMigrations() {
  console.log('🔗 Connected to Supabase database');
  console.log(`📍 URL: ${process.env.SUPABASE_URL}`);
  console.log(`🔑 Using service role key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Yes' : 'No'}\n`);

  console.log('🏗️  CREATING MISSING TABLES');
  console.log('============================');
  const tableCount = await createMigrationTables();

  console.log('\n🔧 CREATING RPC FUNCTIONS');
  console.log('==========================');
  const functionCount = await createRPCFunctions();

  console.log('\n🎯 MIGRATION SUMMARY');
  console.log('===================');
  console.log(`✅ Tables created: ${tableCount}/3`);
  console.log(`✅ Functions created: ${functionCount}/2`);

  if (tableCount === 3 && functionCount >= 1) {
    console.log('\n🎉 CORE MIGRATIONS COMPLETED SUCCESSFULLY!');
    console.log('   Your database now supports the AI suggestion features.');
  } else {
    console.log('\n⚠️  Some migrations failed. Database may have limited functionality.');
  }
}

runAllMigrations().catch(console.error);