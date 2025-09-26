#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🔍 DEBUGGING ACTUAL FUNCTION CALL');
console.log('==================================\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function debugCalls() {
  const userId = '554fdea8-03cd-425e-a14c-70a9ac532627';

  console.log('Testing different parameter combinations...\n');

  // Test 1: No parameters (maybe the app calls it with no params?)
  console.log('🧪 Test 1: No parameters');
  try {
    const { data, error } = await supabase.rpc('get_user_effective_permissions', {});
    if (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log(`   Details: ${error.details || 'N/A'}`);
      console.log(`   Hint: ${error.hint || 'N/A'}`);
    } else {
      console.log(`✅ Success: ${data.length} results`);
    }
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
  }

  // Test 2: Just user_id parameter
  console.log('\n🧪 Test 2: user_id parameter');
  try {
    const { data, error } = await supabase.rpc('get_user_effective_permissions', {
      user_id: userId
    });
    if (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log(`   Details: ${error.details || 'N/A'}`);
      console.log(`   Hint: ${error.hint || 'N/A'}`);
    } else {
      console.log(`✅ Success: ${data.length} results`);
    }
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
  }

  // Test 3: check_user_id parameter
  console.log('\n🧪 Test 3: check_user_id parameter');
  try {
    const { data, error } = await supabase.rpc('get_user_effective_permissions', {
      check_user_id: userId
    });
    if (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log(`   Details: ${error.details || 'N/A'}`);
      console.log(`   Hint: ${error.hint || 'N/A'}`);
    } else {
      console.log(`✅ Success: ${data.length} results`);
    }
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
  }

  // Test 4: Both check_user_id and check_company_id
  console.log('\n🧪 Test 4: check_user_id + check_company_id');
  try {
    const { data, error } = await supabase.rpc('get_user_effective_permissions', {
      check_user_id: userId,
      check_company_id: '00000000-0000-0000-0000-000000000001'
    });
    if (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log(`   Details: ${error.details || 'N/A'}`);
      console.log(`   Hint: ${error.hint || 'N/A'}`);
    } else {
      console.log(`✅ Success: ${data.length} results`);
    }
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
  }

  // Test 5: Let's see what functions actually exist
  console.log('\n🧪 Test 5: Check what functions exist in the database');
  try {
    const { data, error } = await supabase
      .from('information_schema.routines')
      .select('routine_name, specific_name, data_type')
      .eq('routine_name', 'get_user_effective_permissions')
      .eq('routine_schema', 'public');

    if (error) {
      console.log(`❌ Error querying functions: ${error.message}`);
    } else {
      console.log(`✅ Found ${data.length} function(s):`);
      data.forEach(func => {
        console.log(`   - ${func.routine_name} (${func.specific_name}) -> ${func.data_type}`);
      });
    }
  } catch (err) {
    console.log(`❌ Exception querying functions: ${err.message}`);
  }

  console.log('\n🎯 The test that matches the browser behavior is the failing one!');
}

debugCalls().catch(console.error);