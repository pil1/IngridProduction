#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🔧 FIXING RPC FUNCTIONS NOW');
console.log('============================\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function createFunction() {
  console.log('🔧 Creating get_user_effective_permissions function...');

  const functionSql = `
    DROP FUNCTION IF EXISTS get_user_effective_permissions(uuid);

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

    GRANT EXECUTE ON FUNCTION get_user_effective_permissions(uuid) TO authenticated;
    COMMENT ON FUNCTION get_user_effective_permissions(uuid) IS 'Get all effective permissions for a user from all sources';
  `;

  // Use the SQL editor approach via the REST API
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        query: functionSql
      })
    });

    console.log(`Response status: ${response.status}`);

    if (response.ok) {
      console.log('✅ Function created successfully via REST API');
    } else {
      const errorText = await response.text();
      console.log(`❌ REST API failed: ${errorText}`);
    }

  } catch (err) {
    console.log(`❌ REST API error: ${err.message}`);
  }

  // Test the function
  console.log('\n🧪 Testing the function...');

  try {
    const { data, error } = await supabase
      .rpc('get_user_effective_permissions', {
        user_id: '554fdea8-03cd-425e-a14c-70a9ac532627'
      });

    if (error) {
      console.log(`❌ Function test failed: ${error.message}`);
      console.log(`Details: ${error.details || 'No details'}`);
      console.log(`Hint: ${error.hint || 'No hint'}`);
    } else {
      console.log(`✅ Function working! Returns ${data.length} permissions`);
      console.log('First few permissions:', data.slice(0, 3));
    }

  } catch (err) {
    console.log(`❌ Test error: ${err.message}`);
  }
}

createFunction().catch(console.error);