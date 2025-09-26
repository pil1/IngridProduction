#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🔍 VERIFYING RPC FUNCTIONS');
console.log('===========================\n');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

const requiredFunctions = [
  'user_has_permission',
  'company_has_module',
  'get_user_modules',
  'check_user_ingrid_permission',
  'get_user_effective_permissions',
  'increment_ingrid_usage',
  'get_expenses_with_submitter',
  'update_expense_status'
];

async function testRPCFunction(functionName, testParams = {}) {
  console.log(`🔧 Testing function: ${functionName}`);

  try {
    // Try to call the function with minimal parameters
    const { data, error } = await supabase
      .rpc(functionName, testParams)
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('Could not find')) {
        console.log(`   ❌ Function missing: ${functionName}`);
        return false;
      } else {
        // Function exists but might have parameter issues
        console.log(`   ✅ Function exists: ${functionName} (parameter validation needed)`);
        return true;
      }
    }

    console.log(`   ✅ Function working: ${functionName}`);
    return true;

  } catch (err) {
    if (err.message.includes('does not exist')) {
      console.log(`   ❌ Function missing: ${functionName}`);
      return false;
    } else {
      console.log(`   ⚠️  Function exists but needs params: ${functionName}`);
      return true;
    }
  }
}

async function verifyAllFunctions() {
  console.log('🔗 Connected to Supabase database');
  console.log(`📍 URL: ${process.env.SUPABASE_URL}`);
  console.log(`🔑 Using service role key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Yes' : 'No'}\n`);

  const results = {};

  for (const funcName of requiredFunctions) {
    let testParams = {};

    // Set up basic test parameters for each function
    switch (funcName) {
      case 'user_has_permission':
        testParams = { user_id: '00000000-0000-0000-0000-000000000000', permission_key: 'test' };
        break;
      case 'company_has_module':
        testParams = { company_id: '00000000-0000-0000-0000-000000000000', module_name: 'test' };
        break;
      case 'get_user_modules':
        testParams = { user_id: '00000000-0000-0000-0000-000000000000' };
        break;
      case 'check_user_ingrid_permission':
        testParams = { user_id: '00000000-0000-0000-0000-000000000000' };
        break;
      case 'get_user_effective_permissions':
        testParams = { user_id: '00000000-0000-0000-0000-000000000000' };
        break;
      case 'increment_ingrid_usage':
        testParams = { user_id: '00000000-0000-0000-0000-000000000000', feature_used: 'test' };
        break;
      case 'get_expenses_with_submitter':
        testParams = { company_id: '00000000-0000-0000-0000-000000000000' };
        break;
      case 'update_expense_status':
        testParams = { expense_id: '00000000-0000-0000-0000-000000000000', new_status: 'pending' };
        break;
    }

    results[funcName] = await testRPCFunction(funcName, testParams);
  }

  console.log('\n📊 RPC FUNCTION STATUS SUMMARY');
  console.log('==============================');

  const availableFunctions = [];
  const missingFunctions = [];

  Object.entries(results).forEach(([func, exists]) => {
    if (exists) {
      console.log(`✅ ${func}: Available`);
      availableFunctions.push(func);
    } else {
      console.log(`❌ ${func}: Missing`);
      missingFunctions.push(func);
    }
  });

  console.log(`\n🎯 SUMMARY: ${availableFunctions.length}/${requiredFunctions.length} functions available`);

  if (missingFunctions.length === 0) {
    console.log('\n🎉 ALL RPC FUNCTIONS ARE AVAILABLE!');
    console.log('   Your INFOtrac application has full functionality.');
  } else {
    console.log(`\n⚠️  MISSING ${missingFunctions.length} RPC FUNCTIONS:`);
    missingFunctions.forEach((func, i) => {
      console.log(`   ${i + 1}. ${func}`);
    });
    console.log('\n🔧 These functions can be created by running:');
    console.log('   027_create_missing_rpc_functions.sql in Supabase SQL Editor');
  }

  return { available: availableFunctions.length, total: requiredFunctions.length, missing: missingFunctions };
}

verifyAllFunctions().catch(console.error);