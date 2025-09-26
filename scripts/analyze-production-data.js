#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🔍 ANALYZING PRODUCTION DATA FOR CLEANUP');
console.log('========================================\n');

// Create Supabase client with service role for admin access
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function analyzeUsers() {
  console.log('👥 ANALYZING USERS');
  console.log('==================');

  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, role, company_id, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.log(`❌ Error fetching profiles: ${error.message}`);
      return [];
    }

    console.log(`Found ${profiles.length} users:\n`);

    profiles.forEach((profile, index) => {
      const isAdmin = profile.email === 'admin@infotrac.com' || profile.role === 'super-admin';
      const status = isAdmin ? '🔒 KEEP (Super Admin)' : '❌ DELETE (Test User)';

      console.log(`${index + 1}. ${profile.full_name || 'No Name'}`);
      console.log(`   Email: ${profile.email}`);
      console.log(`   Role: ${profile.role}`);
      console.log(`   User ID: ${profile.user_id}`);
      console.log(`   Company ID: ${profile.company_id}`);
      console.log(`   Created: ${new Date(profile.created_at).toLocaleDateString()}`);
      console.log(`   Action: ${status}`);
      console.log('');
    });

    return profiles;

  } catch (err) {
    console.log(`❌ Error analyzing users: ${err.message}`);
    return [];
  }
}

async function analyzeCompanies() {
  console.log('🏢 ANALYZING COMPANIES');
  console.log('=====================');

  try {
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name, created_at, updated_at, subscription_plan')
      .order('created_at', { ascending: true });

    if (error) {
      console.log(`❌ Error fetching companies: ${error.message}`);
      return [];
    }

    console.log(`Found ${companies.length} companies:\n`);

    // Get user count for each company
    for (const company of companies) {
      const { data: userCount } = await supabase
        .from('profiles')
        .select('user_id', { count: 'exact' })
        .eq('company_id', company.id);

      const isInfotrac = company.name.toLowerCase().includes('infotrac') &&
                        company.id === '00000000-0000-0000-0000-000000000001';
      const status = isInfotrac ? '🔒 KEEP (Main Company)' : '❌ DELETE (Test Company)';

      console.log(`🏢 ${company.name}`);
      console.log(`   ID: ${company.id}`);
      console.log(`   Users: ${userCount?.length || 0}`);
      console.log(`   Plan: ${company.subscription_plan || 'free'}`);
      console.log(`   Created: ${new Date(company.created_at).toLocaleDateString()}`);
      console.log(`   Action: ${status}`);
      console.log('');
    }

    return companies;

  } catch (err) {
    console.log(`❌ Error analyzing companies: ${err.message}`);
    return [];
  }
}

async function findRelatedData(companyIds, userIds) {
  console.log('🔗 ANALYZING RELATED DATA');
  console.log('=========================');

  const tables = [
    'expenses',
    'vendors',
    'expense_categories',
    'notifications',
    'company_modules',
    'user_modules',
    'ingrid_suggested_categories',
    'ingrid_suggested_vendors',
    'company_api_keys'
  ];

  for (const table of tables) {
    try {
      // Check by company_id
      let companyCount = 0;
      if (companyIds.length > 0) {
        const { data, error } = await supabase
          .from(table)
          .select('id', { count: 'exact' })
          .in('company_id', companyIds);

        if (!error) companyCount = data?.length || 0;
      }

      // Check by user_id
      let userCount = 0;
      if (userIds.length > 0) {
        const { data, error } = await supabase
          .from(table)
          .select('id', { count: 'exact' })
          .in('user_id', userIds);

        if (!error) userCount = data?.length || 0;
      }

      const totalCount = companyCount + userCount;
      if (totalCount > 0) {
        console.log(`📊 ${table}: ${totalCount} records to delete`);
      }

    } catch (err) {
      // Table might not exist, continue
      console.log(`⚠️  ${table}: Cannot analyze (table may not exist)`);
    }
  }
}

async function generateCleanupSQL(profiles, companies) {
  console.log('\n📝 GENERATING CLEANUP SQL');
  console.log('=========================');

  // Find items to delete
  const testUsers = profiles.filter(p =>
    p.email !== 'admin@infotrac.com' &&
    p.role !== 'super-admin'
  );

  const testCompanies = companies.filter(c =>
    !(c.name.toLowerCase().includes('infotrac') &&
      c.id === '00000000-0000-0000-0000-000000000001')
  );

  const testUserIds = testUsers.map(u => u.user_id);
  const testCompanyIds = testCompanies.map(c => c.id);

  console.log(`\n🎯 CLEANUP SUMMARY:`);
  console.log(`   Users to delete: ${testUsers.length}`);
  console.log(`   Companies to delete: ${testCompanies.length}`);

  if (testUsers.length === 0 && testCompanies.length === 0) {
    console.log('\n✅ NO CLEANUP NEEDED - Database is already clean!');
    return;
  }

  console.log(`\n🚨 WARNING: This will permanently delete ${testUsers.length} users and ${testCompanies.length} companies!`);
  console.log(`🔒 PRESERVED: admin@infotrac.com and main INFOtrac company`);

  // Generate SQL
  let sql = `-- =====================================================\n`;
  sql += `-- INFOTRAC PRODUCTION DATABASE CLEANUP\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- =====================================================\n`;
  sql += `-- ⚠️  WARNING: This will permanently delete test data!\n`;
  sql += `-- 🔒 PRESERVED: admin@infotrac.com and main company\n`;
  sql += `-- =====================================================\n\n`;

  if (testUserIds.length > 0 || testCompanyIds.length > 0) {
    await findRelatedData(testCompanyIds, testUserIds);
  }

  sql += `-- Step 1: Delete related data first (to avoid foreign key constraints)\n\n`;

  const relatedTables = [
    'notifications',
    'user_modules',
    'company_modules',
    'expenses',
    'vendors',
    'expense_categories',
    'ingrid_suggested_categories',
    'ingrid_suggested_vendors',
    'company_api_keys',
    'api_key_usage_log',
    'ingrid_usage_log'
  ];

  for (const table of relatedTables) {
    if (testCompanyIds.length > 0) {
      sql += `DELETE FROM public.${table} WHERE company_id IN (${testCompanyIds.map(id => `'${id}'`).join(', ')});\n`;
    }
    if (testUserIds.length > 0) {
      sql += `DELETE FROM public.${table} WHERE user_id IN (${testUserIds.map(id => `'${id}'`).join(', ')});\n`;
    }
  }

  sql += `\n-- Step 2: Delete user profiles\n`;
  if (testUserIds.length > 0) {
    sql += `DELETE FROM public.profiles WHERE user_id IN (${testUserIds.map(id => `'${id}'`).join(', ')});\n`;
  }

  sql += `\n-- Step 3: Delete companies\n`;
  if (testCompanyIds.length > 0) {
    sql += `DELETE FROM public.companies WHERE id IN (${testCompanyIds.map(id => `'${id}'`).join(', ')});\n`;
  }

  sql += `\n-- Step 4: Delete from auth.users (Supabase auth table)\n`;
  if (testUserIds.length > 0) {
    sql += `DELETE FROM auth.users WHERE id IN (${testUserIds.map(id => `'${id}'`).join(', ')});\n`;
  }

  sql += `\n-- Verification queries\n`;
  sql += `SELECT 'Remaining users:' as status, count(*) as count FROM public.profiles;\n`;
  sql += `SELECT 'Remaining companies:' as status, count(*) as count FROM public.companies;\n`;
  sql += `SELECT 'Cleanup completed successfully!' as result;\n`;

  return sql;
}

async function runAnalysis() {
  console.log('🔗 Connected to live Supabase database');
  console.log(`📍 URL: ${process.env.SUPABASE_URL}`);
  console.log(`🔑 Using service role key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Yes' : 'No'}\n`);

  const profiles = await analyzeUsers();
  console.log('\n');
  const companies = await analyzeCompanies();

  const cleanupSQL = await generateCleanupSQL(profiles, companies);

  if (cleanupSQL) {
    // Write the SQL to a file
    const fs = await import('fs');
    fs.writeFileSync(join(__dirname, '..', 'PRODUCTION_CLEANUP.sql'), cleanupSQL);
    console.log(`\n✅ Generated: PRODUCTION_CLEANUP.sql`);
    console.log('\n🚨 NEXT STEPS:');
    console.log('1. Review the PRODUCTION_CLEANUP.sql file carefully');
    console.log('2. Backup your database if needed');
    console.log('3. Run the SQL in Supabase Dashboard SQL Editor');
    console.log('4. Verify results with the included verification queries');
  }
}

runAnalysis().catch(console.error);