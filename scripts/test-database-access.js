#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🔍 Testing Database Access\n');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY, // Using anon key for read access
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function testDatabaseAccess() {
  console.log('📊 Testing database queries...\n');

  // Test 1: List all public tables
  try {
    console.log('1️⃣ Getting list of tables...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(10);

    if (tablesError) {
      console.log('❌ Cannot access information_schema directly');
      console.log('   Error:', tablesError.message);
    } else {
      console.log('✅ Information schema accessible');
      console.log('   Tables:', tables?.map(t => t.table_name).join(', '));
    }
  } catch (error) {
    console.log('❌ Information schema error:', error.message);
  }

  console.log();

  // Test 2: Try to access profiles table
  try {
    console.log('2️⃣ Testing profiles table access...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, role')
      .limit(5);

    if (profilesError) {
      console.log('❌ Profiles table access denied');
      console.log('   Error:', profilesError.message);
    } else {
      console.log('✅ Profiles table accessible');
      console.log(`   Found ${profiles?.length || 0} profiles`);
      if (profiles?.length > 0) {
        console.log('   Sample roles:', profiles.map(p => p.role).filter(Boolean).join(', '));
      }
    }
  } catch (error) {
    console.log('❌ Profiles table error:', error.message);
  }

  console.log();

  // Test 3: Try companies table
  try {
    console.log('3️⃣ Testing companies table access...');
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name')
      .limit(5);

    if (companiesError) {
      console.log('❌ Companies table access denied');
      console.log('   Error:', companiesError.message);
    } else {
      console.log('✅ Companies table accessible');
      console.log(`   Found ${companies?.length || 0} companies`);
      if (companies?.length > 0) {
        console.log('   Company names:', companies.map(c => c.name).join(', '));
      }
    }
  } catch (error) {
    console.log('❌ Companies table error:', error.message);
  }

  console.log();

  // Test 4: Try expenses table
  try {
    console.log('4️⃣ Testing expenses table access...');
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('id, amount')
      .limit(3);

    if (expensesError) {
      console.log('❌ Expenses table access denied');
      console.log('   Error:', expensesError.message);
    } else {
      console.log('✅ Expenses table accessible');
      console.log(`   Found ${expenses?.length || 0} expenses`);
      if (expenses?.length > 0) {
        const totalAmount = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        console.log(`   Total amount in sample: $${totalAmount.toFixed(2)}`);
      }
    }
  } catch (error) {
    console.log('❌ Expenses table error:', error.message);
  }

  console.log('\n🎯 Database Access Summary:');
  console.log('- Connection: ✅ Working with anon key');
  console.log('- Tables: Limited by Row Level Security (RLS)');
  console.log('- For full access, you need the service_role key from Supabase dashboard');
  console.log('\n📝 Next: Get service_role key from:');
  console.log('   https://supabase.com/dashboard/project/teyivlpjxmpitqaqmucx/settings/api');
}

testDatabaseAccess().catch(console.error);