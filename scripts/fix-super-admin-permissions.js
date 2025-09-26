#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🔧 FIXING SUPER ADMIN PERMISSIONS');
console.log('=================================\n');

// Create Supabase client with service role
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function checkCurrentSuperAdmin() {
  console.log('👤 Checking current super admin status...');

  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, role, company_id')
      .eq('email', 'admin@infotrac.com');

    if (error) {
      console.log(`❌ Error fetching super admin: ${error.message}`);
      return null;
    }

    if (profiles && profiles.length > 0) {
      const admin = profiles[0];
      console.log('✅ Super admin found:');
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   User ID: ${admin.user_id}`);
      console.log(`   Company: ${admin.company_id || 'None assigned'}`);
      return admin;
    }

    console.log('❌ Super admin not found');
    return null;

  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return null;
  }
}

async function fixSuperAdminCompany() {
  console.log('\n🏢 Fixing super admin company assignment...');

  try {
    // Get the main INFOtrac company
    const { data: companies, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', '00000000-0000-0000-0000-000000000001');

    if (companyError || !companies || companies.length === 0) {
      console.log('❌ Main INFOtrac company not found. Creating it...');

      // Create the main company
      const { data: newCompany, error: createError } = await supabase
        .from('companies')
        .insert({
          id: '00000000-0000-0000-0000-000000000001',
          name: 'INFOtrac',
          slug: 'infotrac',
          subscription_plan: 'enterprise',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.log(`❌ Failed to create main company: ${createError.message}`);
        return false;
      }

      console.log('✅ Main INFOtrac company created');
    } else {
      console.log(`✅ Main company found: ${companies[0].name}`);
    }

    // Assign super admin to main company
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        company_id: '00000000-0000-0000-0000-000000000001',
        role: 'super-admin',
        updated_at: new Date().toISOString()
      })
      .eq('email', 'admin@infotrac.com');

    if (updateError) {
      console.log(`❌ Failed to update super admin: ${updateError.message}`);
      return false;
    }

    console.log('✅ Super admin assigned to main company');
    return true;

  } catch (err) {
    console.log(`❌ Error fixing company assignment: ${err.message}`);
    return false;
  }
}

async function enableAllModulesForMainCompany() {
  console.log('\n📦 Enabling all modules for main company...');

  try {
    // Get all modules
    const { data: modules, error: modulesError } = await supabase
      .from('modules')
      .select('id, name')
      .eq('is_active', true);

    if (modulesError || !modules) {
      console.log(`❌ Failed to fetch modules: ${modulesError?.message}`);
      return false;
    }

    console.log(`Found ${modules.length} active modules`);

    // Enable all modules for main company
    const companyModules = modules.map(module => ({
      company_id: '00000000-0000-0000-0000-000000000001',
      module_id: module.id,
      is_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase
      .from('company_modules')
      .upsert(companyModules, {
        onConflict: 'company_id,module_id',
        ignoreDuplicates: false
      });

    if (insertError) {
      console.log(`❌ Failed to enable modules: ${insertError.message}`);
      return false;
    }

    console.log('✅ All modules enabled for main company');
    return true;

  } catch (err) {
    console.log(`❌ Error enabling modules: ${err.message}`);
    return false;
  }
}

async function grantSuperAdminUserModules() {
  console.log('\n👥 Granting super admin access to all modules...');

  try {
    // Get super admin user ID
    const { data: admin, error: adminError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', 'admin@infotrac.com')
      .single();

    if (adminError || !admin) {
      console.log(`❌ Super admin not found: ${adminError?.message}`);
      return false;
    }

    // Get all modules
    const { data: modules, error: modulesError } = await supabase
      .from('modules')
      .select('id, name')
      .eq('is_active', true);

    if (modulesError || !modules) {
      console.log(`❌ Failed to fetch modules: ${modulesError?.message}`);
      return false;
    }

    // Grant super admin access to all modules
    const userModules = modules.map(module => ({
      user_id: admin.user_id,
      module_id: module.id,
      company_id: '00000000-0000-0000-0000-000000000001',
      is_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase
      .from('user_modules')
      .upsert(userModules, {
        onConflict: 'user_id,module_id,company_id',
        ignoreDuplicates: false
      });

    if (insertError) {
      console.log(`❌ Failed to grant user modules: ${insertError.message}`);
      return false;
    }

    console.log('✅ Super admin granted access to all modules');
    return true;

  } catch (err) {
    console.log(`❌ Error granting user modules: ${err.message}`);
    return false;
  }
}

async function runSuperAdminFix() {
  console.log('🔗 Connected to live Supabase database');
  console.log(`📍 URL: ${process.env.SUPABASE_URL}\n`);

  const admin = await checkCurrentSuperAdmin();

  if (!admin) {
    console.log('\n❌ Cannot proceed without super admin');
    return;
  }

  console.log('\n🔧 Starting super admin permission fixes...');

  const companyFixed = await fixSuperAdminCompany();
  const modulesEnabled = await enableAllModulesForMainCompany();
  const userModulesGranted = await grantSuperAdminUserModules();

  console.log('\n📊 SUPER ADMIN FIX SUMMARY');
  console.log('==========================');
  console.log(`✅ Company assignment: ${companyFixed ? 'Fixed' : 'Failed'}`);
  console.log(`✅ Company modules: ${modulesEnabled ? 'Enabled' : 'Failed'}`);
  console.log(`✅ User modules: ${userModulesGranted ? 'Granted' : 'Failed'}`);

  if (companyFixed && modulesEnabled && userModulesGranted) {
    console.log('\n🎉 SUPER ADMIN SETUP COMPLETE!');
    console.log('   Your super admin now has full permissions to create companies and users.');
    console.log('   Try creating a new company again - it should work now!');
  } else {
    console.log('\n⚠️  Some fixes failed. Please check the errors above.');
  }
}

runSuperAdminFix().catch(console.error);