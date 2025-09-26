#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🔍 CHECKING TABLE STRUCTURES FOR CLEANUP');
console.log('=========================================\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

const tablesToCheck = [
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

async function checkTableStructure(tableName) {
  console.log(`🔧 Checking ${tableName} table structure...`);

  try {
    // Get a sample record to see the column structure
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
      return null;
    }

    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log(`   ✅ Columns: ${columns.join(', ')}`);
      return columns;
    } else {
      // Table exists but is empty, try to get structure another way
      const { data: emptyData, error: emptyError } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);

      if (!emptyError) {
        console.log(`   ✅ Table exists but is empty`);
        return [];
      }
    }

    return null;

  } catch (err) {
    console.log(`   ❌ Table may not exist: ${err.message}`);
    return null;
  }
}

async function generateCorrectedCleanupSQL() {
  console.log('\n📝 GENERATING CORRECTED CLEANUP SQL');
  console.log('===================================\n');

  const testUserIds = [
    '5ff70f21-d623-4250-9065-63945ee48b47',
    '37110760-b30d-43c7-a6d6-ccdbf3a5c3c9',
    'b8a1f3e9-8c4a-4d2e-9f7b-6a5c3d8e1f0a',
    '4d7c69d6-f095-46f0-b5fd-d335a5f13643'
  ];

  const testCompanyIds = [
    'd1e83a1e-8d19-4126-afcf-0c1953854ade',
    '1e9b9a85-66a1-44e8-83d0-135d419f0394',
    '78f40fdb-1c4b-44a5-a152-98933a9126d1'
  ];

  let sql = `-- =====================================================\n`;
  sql += `-- INFOTRAC PRODUCTION DATABASE CLEANUP (CORRECTED)\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- =====================================================\n`;
  sql += `-- ⚠️  WARNING: This will permanently delete test data!\n`;
  sql += `-- 🔒 PRESERVED: admin@infotrac.com and main company\n`;
  sql += `-- =====================================================\n\n`;

  sql += `-- Step 1: Delete related data (with correct column names)\n\n`;

  for (const tableName of tablesToCheck) {
    const columns = await checkTableStructure(tableName);

    if (columns) {
      // Check if table has company_id column
      if (columns.includes('company_id')) {
        sql += `DELETE FROM public.${tableName} WHERE company_id IN (${testCompanyIds.map(id => `'${id}'`).join(', ')});\n`;
      }

      // Check if table has user_id column
      if (columns.includes('user_id')) {
        sql += `DELETE FROM public.${tableName} WHERE user_id IN (${testUserIds.map(id => `'${id}'`).join(', ')});\n`;
      }

      // Special cases for different column names
      if (columns.includes('recipient_id')) {
        sql += `DELETE FROM public.${tableName} WHERE recipient_id IN (${testUserIds.map(id => `'${id}'`).join(', ')});\n`;
      }

      if (columns.includes('created_by')) {
        sql += `DELETE FROM public.${tableName} WHERE created_by IN (${testUserIds.map(id => `'${id}'`).join(', ')});\n`;
      }

      if (columns.includes('updated_by')) {
        sql += `DELETE FROM public.${tableName} WHERE updated_by IN (${testUserIds.map(id => `'${id}'`).join(', ')});\n`;
      }

      sql += '\n';
    }
  }

  sql += `-- Step 2: Delete user profiles\n`;
  sql += `DELETE FROM public.profiles WHERE user_id IN (${testUserIds.map(id => `'${id}'`).join(', ')});\n\n`;

  sql += `-- Step 3: Delete companies\n`;
  sql += `DELETE FROM public.companies WHERE id IN (${testCompanyIds.map(id => `'${id}'`).join(', ')});\n\n`;

  sql += `-- Step 4: Delete from auth.users (Supabase auth table)\n`;
  sql += `DELETE FROM auth.users WHERE id IN (${testUserIds.map(id => `'${id}'`).join(', ')});\n\n`;

  sql += `-- Verification queries\n`;
  sql += `SELECT 'Remaining users:' as status, count(*) as count FROM public.profiles;\n`;
  sql += `SELECT 'Remaining companies:' as status, count(*) as count FROM public.companies;\n`;
  sql += `SELECT 'Cleanup completed successfully!' as result;\n`;

  return sql;
}

async function runTableCheck() {
  console.log('🔗 Connected to live Supabase database');
  console.log(`📍 URL: ${process.env.SUPABASE_URL}\n`);

  const correctedSQL = await generateCorrectedCleanupSQL();

  // Write the corrected SQL to a file
  const fs = await import('fs');
  fs.writeFileSync(join(__dirname, '..', 'PRODUCTION_CLEANUP_FIXED.sql'), correctedSQL);

  console.log(`\n✅ Generated: PRODUCTION_CLEANUP_FIXED.sql`);
  console.log('\n🚨 NEXT STEPS:');
  console.log('1. Review the PRODUCTION_CLEANUP_FIXED.sql file');
  console.log('2. This version uses correct column names for each table');
  console.log('3. Run the SQL in Supabase Dashboard SQL Editor');
  console.log('4. Verify results with the included verification queries');
}

runTableCheck().catch(console.error);