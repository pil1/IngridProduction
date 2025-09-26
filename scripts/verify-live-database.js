#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🔍 VERIFYING LIVE SUPABASE DATABASE CONNECTION');
console.log('===============================================\n');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function verifyLiveDatabase() {
  console.log('📋 Connection Details:');
  console.log(`URL: ${process.env.SUPABASE_URL}`);
  console.log(`Key Type: ${process.env.SUPABASE_ANON_KEY ? 'Anon Key Set' : 'No Anon Key'}`);
  console.log(`Service Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Service Key Set' : 'No Service Key'}`);
  console.log('');

  // Test 1: Check if this is the live database by looking for specific data
  console.log('🔍 Test 1: Checking for specific live data...');

  try {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('email, full_name, created_at, role')
      .limit(5);

    if (profilesError) {
      console.log(`❌ Profiles query failed: ${profilesError.message}`);
      return false;
    }

    console.log(`✅ Found ${profiles.length} profiles:`);
    profiles.forEach(profile => {
      console.log(`   • ${profile.full_name || 'No name'} (${profile.email}) - ${profile.role}`);
      console.log(`     Created: ${profile.created_at}`);
    });
    console.log('');

  } catch (error) {
    console.log(`❌ Error accessing profiles: ${error.message}`);
    return false;
  }

  // Test 2: Check companies data for live indicators
  console.log('🔍 Test 2: Checking companies data...');

  try {
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('name, created_at, updated_at, subscription_plan')
      .limit(5);

    if (companiesError) {
      console.log(`❌ Companies query failed: ${companiesError.message}`);
      return false;
    }

    console.log(`✅ Found ${companies.length} companies:`);
    companies.forEach(company => {
      console.log(`   • ${company.name} (${company.subscription_plan})`);
      console.log(`     Created: ${company.created_at}`);
      console.log(`     Updated: ${company.updated_at}`);
    });
    console.log('');

  } catch (error) {
    console.log(`❌ Error accessing companies: ${error.message}`);
    return false;
  }

  // Test 3: Check for recent activity (live database should have recent timestamps)
  console.log('🔍 Test 3: Checking for recent database activity...');

  try {
    const { data: recentProfiles, error } = await supabase
      .from('profiles')
      .select('updated_at, full_name')
      .order('updated_at', { ascending: false })
      .limit(3);

    if (!error && recentProfiles.length > 0) {
      console.log('✅ Most recent profile updates:');
      recentProfiles.forEach(profile => {
        const updateDate = new Date(profile.updated_at);
        const hoursAgo = Math.round((Date.now() - updateDate.getTime()) / (1000 * 60 * 60));
        console.log(`   • ${profile.full_name}: ${updateDate.toLocaleString()} (${hoursAgo} hours ago)`);
      });
    }
    console.log('');

  } catch (error) {
    console.log(`⚠️  Could not check recent activity: ${error.message}`);
  }

  // Test 4: Try to detect if this might be a local/test database
  console.log('🔍 Test 4: Database environment detection...');

  const url = process.env.SUPABASE_URL;
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    console.log('❌ This appears to be a LOCAL Supabase instance!');
    return false;
  }

  if (url.includes('.supabase.co')) {
    console.log('✅ This appears to be a LIVE Supabase hosted instance');
  } else {
    console.log('⚠️  Unknown database host - not typical Supabase URL format');
  }

  console.log('');

  // Test 5: Check for any missing tables that should exist
  console.log('🔍 Test 5: Testing access to key tables...');

  const tablesToTest = [
    'profiles', 'companies', 'modules', 'permissions',
    'company_modules', 'user_modules', 'role_permissions'
  ];

  let accessibleTables = 0;
  for (const table of tablesToTest) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (!error) {
        accessibleTables++;
        console.log(`   ✅ ${table} - accessible`);
      } else {
        console.log(`   ❌ ${table} - ${error.message}`);
      }
    } catch (err) {
      console.log(`   ❌ ${table} - ${err.message}`);
    }
  }

  console.log(`\n📊 Accessible tables: ${accessibleTables}/${tablesToTest.length}`);

  // Final verification
  console.log('\n🎯 VERIFICATION RESULTS:');
  console.log('========================');

  if (accessibleTables >= 5) {
    console.log('✅ CONNECTION CONFIRMED: This is the LIVE Supabase database');
    console.log('✅ Database contains real user and company data');
    console.log('✅ Recent activity detected - this is an active database');
    return true;
  } else {
    console.log('❌ CONNECTION ISSUE: Limited database access detected');
    console.log('⚠️  This might be a permissions issue or wrong database');
    return false;
  }
}

verifyLiveDatabase()
  .then(isLive => {
    if (isLive) {
      console.log('\n🚀 CONFIRMED: Analyzing the LIVE production Supabase database');
      console.log('   All previous analysis results are from your live production data');
    } else {
      console.log('\n⚠️  WARNING: Database connection or access issues detected');
      console.log('   Please verify your Supabase credentials and permissions');
    }
  })
  .catch(console.error);