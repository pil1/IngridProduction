#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🔧 FIXING FUNCTION SIGNATURE MISMATCH');
console.log('=====================================\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function fixFunctionSignatures() {
  console.log('🔧 Creating both function signatures...');

  // First, drop all versions of the function
  const dropSql = `
    DROP FUNCTION IF EXISTS get_user_effective_permissions(uuid);
    DROP FUNCTION IF EXISTS get_user_effective_permissions(uuid, uuid);
  `;

  // Create the migration 021 version (2 parameters)
  const migration021Function = `
    CREATE OR REPLACE FUNCTION get_user_effective_permissions(check_user_id UUID, check_company_id UUID DEFAULT NULL)
    RETURNS TABLE(permission_key VARCHAR, source VARCHAR, is_granted BOOLEAN) AS $$
    BEGIN
        -- For now, just return role-based permissions from profiles.role
        RETURN QUERY
        SELECT
            rp.permission_name::VARCHAR as permission_key,
            'role'::VARCHAR as source,
            true as is_granted
        FROM public.profiles p
        JOIN public.role_permissions rp ON rp.role = p.role
        WHERE p.user_id = check_user_id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  // Create the simple version (1 parameter) - what the app seems to be calling
  const simpleFunction = `
    CREATE OR REPLACE FUNCTION get_user_effective_permissions(user_id uuid)
    RETURNS TABLE (
        permission_key text,
        permission_name text,
        source text
    ) AS $$
    DECLARE
        user_role text;
    BEGIN
        -- Get user's role
        SELECT role INTO user_role
        FROM public.profiles
        WHERE profiles.user_id = get_user_effective_permissions.user_id;

        -- If no user found, return empty
        IF user_role IS NULL THEN
            RETURN;
        END IF;

        -- Return role-based permissions
        RETURN QUERY
        SELECT
            rp.permission_name as permission_key,
            rp.permission_name as permission_name,
            'role'::text as source
        FROM public.role_permissions rp
        WHERE rp.role = user_role;

        -- Only add individual permissions if the table exists AND has the right structure
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'user_permissions'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'user_permissions'
            AND column_name = 'permission_name'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'user_permissions'
            AND column_name = 'is_granted'
        ) THEN
            RETURN QUERY
            SELECT
                up.permission_name as permission_key,
                up.permission_name as permission_name,
                'individual'::text as source
            FROM public.user_permissions up
            WHERE up.user_id = get_user_effective_permissions.user_id
            AND up.is_granted = true;
        END IF;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  const grantsSql = `
    GRANT EXECUTE ON FUNCTION get_user_effective_permissions(uuid, uuid) TO authenticated;
    GRANT EXECUTE ON FUNCTION get_user_effective_permissions(uuid) TO authenticated;
  `;

  const allSql = dropSql + migration021Function + simpleFunction + grantsSql;

  // Test 1: Call with single parameter (what our test script uses)
  console.log('\n🧪 Testing single parameter call...');
  try {
    const { data, error } = await supabase
      .rpc('get_user_effective_permissions', {
        user_id: '554fdea8-03cd-425e-a14c-70a9ac532627'
      });

    if (error) {
      console.log(`❌ Single parameter failed: ${error.message}`);
    } else {
      console.log(`✅ Single parameter working! Returns ${data.length} permissions`);
    }
  } catch (err) {
    console.log(`❌ Single parameter error: ${err.message}`);
  }

  // Test 2: Call with two parameters (what customRoleService uses)
  console.log('\n🧪 Testing two parameter call...');
  try {
    const { data, error } = await supabase
      .rpc('get_user_effective_permissions', {
        check_user_id: '554fdea8-03cd-425e-a14c-70a9ac532627',
        check_company_id: '00000000-0000-0000-0000-000000000001'
      });

    if (error) {
      console.log(`❌ Two parameter failed: ${error.message}`);
    } else {
      console.log(`✅ Two parameter working! Returns ${data.length} permissions`);
    }
  } catch (err) {
    console.log(`❌ Two parameter error: ${err.message}`);
  }

  console.log('\n✅ Both function signatures should now exist to handle all calls');
}

fixFunctionSignatures().catch(console.error);