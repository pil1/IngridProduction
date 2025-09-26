#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🚀 CREATING MISSING TABLES VIA SUPABASE INSERT');
console.log('===============================================\n');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function checkTableExists(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error && error.message.includes('does not exist')) {
      return false;
    }

    return true;
  } catch (err) {
    return false;
  }
}

async function createIngridsuggestedcategories() {
  console.log('🔍 Checking if ingrid_suggested_categories exists...');

  const exists = await checkTableExists('ingrid_suggested_categories');
  if (exists) {
    console.log('✅ Table ingrid_suggested_categories already exists');
    return true;
  }

  console.log('📋 Creating ingrid_suggested_categories table...');
  console.log('   This table is required for AI category suggestions');

  // Since we can't create tables directly via the client, we'll verify it's missing
  // and inform the user what needs to be done
  return false;
}

async function createIngridSuggestedVendors() {
  console.log('🔍 Checking if ingrid_suggested_vendors exists...');

  const exists = await checkTableExists('ingrid_suggested_vendors');
  if (exists) {
    console.log('✅ Table ingrid_suggested_vendors already exists');
    return true;
  }

  console.log('📋 Missing ingrid_suggested_vendors table...');
  console.log('   This table is required for AI vendor suggestions');

  return false;
}

async function createCompanyApiKeys() {
  console.log('🔍 Checking if company_api_keys exists...');

  const exists = await checkTableExists('company_api_keys');
  if (exists) {
    console.log('✅ Table company_api_keys already exists');
    return true;
  }

  console.log('📋 Missing company_api_keys table...');
  console.log('   This table is required for API key management');

  return false;
}

async function testDatabaseConnection() {
  console.log('🔗 Testing database connection...');

  try {
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name')
      .limit(3);

    if (error) {
      console.log(`❌ Database connection failed: ${error.message}`);
      return false;
    }

    console.log(`✅ Connected successfully - Found ${companies.length} companies`);
    companies.forEach(company => {
      console.log(`   • ${company.name} (${company.id})`);
    });

    return true;
  } catch (err) {
    console.log(`❌ Connection error: ${err.message}`);
    return false;
  }
}

async function checkAllRequiredTables() {
  const connection = await testDatabaseConnection();
  if (!connection) {
    return;
  }

  console.log('\n🔍 CHECKING REQUIRED TABLES');
  console.log('============================');

  const results = {
    categories: await createIngridsuggestedcategories(),
    vendors: await createIngridSuggestedVendors(),
    apiKeys: await createCompanyApiKeys()
  };

  console.log('\n📊 TABLE STATUS SUMMARY');
  console.log('=======================');

  const missingTables = [];

  Object.entries(results).forEach(([table, exists]) => {
    if (exists) {
      console.log(`✅ ${table}: Available`);
    } else {
      console.log(`❌ ${table}: Missing`);
      missingTables.push(table);
    }
  });

  if (missingTables.length === 0) {
    console.log('\n🎉 ALL REQUIRED TABLES ARE PRESENT!');
    console.log('   Your INFOtrac application should work fully.');
  } else {
    console.log(`\n⚠️  MISSING ${missingTables.length} CRITICAL TABLES`);
    console.log('   Your application may have limited functionality.');
    console.log('\n🔧 NEXT STEPS:');
    console.log('   1. Go to Supabase Dashboard SQL Editor');
    console.log('   2. Run the migration files manually:');
    missingTables.forEach((table, i) => {
      const migrationMap = {
        categories: '024_create_ingrid_suggested_categories.sql',
        vendors: '025_create_ingrid_suggested_vendors.sql',
        apiKeys: '026_create_company_api_keys.sql'
      };
      console.log(`      ${i + 1}. ${migrationMap[table]}`);
    });
    console.log('   3. Refresh and test your application');
  }
}

checkAllRequiredTables().catch(console.error);