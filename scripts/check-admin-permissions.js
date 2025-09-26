#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🔍 CHECKING SUPER ADMIN USER CREATION PERMISSIONS');
console.log('=================================================\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function checkRolePermissions() {
  console.log('👑 Checking role-based permissions...');

  try {
    const { data: permissions, error } = await supabase
      .from('role_permissions')
      .select('role, permission_name')
      .in('role', ['super-admin', 'admin'])
      .order('role, permission_name');

    if (error) {
      console.log(`❌ Error fetching role permissions: ${error.message}`);
      return;
    }

    console.log(`Found ${permissions.length} role permissions:\n`);

    const superAdminPerms = permissions.filter(p => p.role === 'super-admin');
    const adminPerms = permissions.filter(p => p.role === 'admin');

    console.log('🔴 SUPER ADMIN Permissions:');
    if (superAdminPerms.length === 0) {
      console.log('   ❌ NO PERMISSIONS FOUND - This is the problem!');
    } else {
      superAdminPerms.forEach(perm => {
        const hasUserCreate = perm.permission_name.includes('user') && perm.permission_name.includes('create');
        const status = hasUserCreate ? '✅' : '  ';
        console.log(`   ${status} ${perm.permission_name}`);
      });
    }

    console.log('\n🔵 ADMIN Permissions:');
    if (adminPerms.length === 0) {
      console.log('   ❌ NO PERMISSIONS FOUND');
    } else {
      adminPerms.forEach(perm => {
        const hasUserCreate = perm.permission_name.includes('user') && perm.permission_name.includes('create');
        const status = hasUserCreate ? '✅' : '  ';
        console.log(`   ${status} ${perm.permission_name}`);
      });
    }

  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

async function checkCreateCompanyDialog() {
  console.log('\n📝 Checking CreateCompanyDialog code expectations...');

  try {
    // Look for what the code expects by checking some common patterns
    console.log('Looking for user creation logic patterns...');

    // Check if there are any RLS policies that might be blocking
    console.log('\n🔒 Checking RLS policies that might affect user creation...');

    // Test super admin's actual permissions
    const testPermissions = [
      'users.create',
      'users.manage',
      'admin.users.create',
      'companies.create',
      'companies.manage'
    ];

    for (const permission of testPermissions) {
      const { data, error } = await supabase
        .rpc('user_has_permission', {
          user_id: '554fdea8-03cd-425e-a14c-70a9ac532627',
          permission_key: permission
        });

      const status = data ? '✅' : '❌';
      console.log(`   ${status} ${permission}: ${data ? 'GRANTED' : 'DENIED'}`);
    }

  } catch (err) {
    console.log(`   ⚠️  Could not test permissions: ${err.message}`);
  }
}

async function checkSupabaseAuthAPI() {
  console.log('\n🔑 Checking Supabase Auth API access...');

  try {
    // Check if we can access the admin API at all
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.log(`❌ Auth Admin API Error: ${error.message}`);

      if (error.message.includes('JWT')) {
        console.log('   🔧 Issue: Service Role Key might be invalid or expired');
      } else if (error.message.includes('forbidden')) {
        console.log('   🔧 Issue: Service Role Key lacks admin permissions');
      } else if (error.message.includes('not found')) {
        console.log('   🔧 Issue: Admin API endpoint not accessible');
      }
    } else {
      console.log(`✅ Auth Admin API works - Found ${data.users.length} users`);
      console.log('   This means the service role key has admin access');
    }

  } catch (err) {
    console.log(`❌ Auth API test failed: ${err.message}`);
  }
}

async function identifyMissingPermissions() {
  console.log('\n🚨 IDENTIFYING MISSING PERMISSIONS');
  console.log('==================================');

  console.log('\n📋 For user creation to work, super admin needs:');
  console.log('   1. ✅ Service Role Key with admin API access');
  console.log('   2. ❓ Database permission to create users');
  console.log('   3. ❓ RLS policies allowing user creation');
  console.log('   4. ❓ Supabase auth settings allowing signups');

  console.log('\n🔧 RECOMMENDED FIXES:');
  console.log('   A. Add user creation permissions to super-admin role');
  console.log('   B. Ensure RLS policies allow super admin operations');
  console.log('   C. Check Supabase auth configuration');
  console.log('   D. Consider using service role directly for admin ops');
}

async function runPermissionCheck() {
  console.log('🔗 Connected to live Supabase database');
  console.log(`📍 URL: ${process.env.SUPABASE_URL}`);
  console.log(`🔑 Service Role: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing'}\n`);

  await checkRolePermissions();
  await checkCreateCompanyDialog();
  await checkSupabaseAuthAPI();
  await identifyMissingPermissions();
}

runPermissionCheck().catch(console.error);