#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🧪 TESTING RPC FUNCTIONS');
console.log('========================\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function testFunction(functionName, params = {}) {
  console.log(`🔧 Testing ${functionName}...`);

  try {
    const { data, error } = await supabase
      .rpc(functionName, params);

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
      console.log(`   Details: ${error.details || 'No details'}`);
      console.log(`   Hint: ${error.hint || 'No hint'}`);
      return false;
    }

    console.log(`   ✅ Success: ${JSON.stringify(data)}`);
    return true;

  } catch (err) {
    console.log(`   ❌ Exception: ${err.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🔗 Connected to Supabase database');
  console.log(`📍 URL: ${process.env.SUPABASE_URL}\n`);

  const superAdminId = '554fdea8-03cd-425e-a14c-70a9ac532627';
  const mainCompanyId = '00000000-0000-0000-0000-000000000001';

  console.log('Testing critical RPC functions that the app expects:\n');

  // Test the failing function first
  await testFunction('get_user_effective_permissions', { user_id: superAdminId });

  // Test other functions the app uses
  await testFunction('user_has_permission', {
    user_id: superAdminId,
    permission_key: 'users.create'
  });

  await testFunction('company_has_module', {
    company_id: mainCompanyId,
    module_name: 'User Management'
  });

  await testFunction('get_user_modules', { user_id: superAdminId });

  await testFunction('check_user_ingrid_permission', { user_id: superAdminId });

  console.log('\n📊 If any functions failed, they need to be created/fixed in the database.');
}

runTests().catch(console.error);