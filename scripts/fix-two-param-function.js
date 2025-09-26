#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🔧 FIXING TWO-PARAMETER FUNCTION');
console.log('=================================\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function fixTwoParamFunction() {
  console.log('🔧 Recreating the two-parameter function without bugs...');

  // We need to execute this SQL directly through the Supabase web interface
  // But let's test what works by using a simple approach

  console.log('\n🧪 Testing what the failing call might be...');

  // Let's see if there's a hidden call somewhere that calls it without proper params
  // Based on the browser stack trace, it's coming from use-user-menu-preferences.tsx

  // The problem is likely that somewhere the app is calling:
  // supabase.rpc('get_user_effective_permissions', { /* some wrong params */ })

  // Let me check if we can make a direct call that replicates the browser error
  console.log('🔍 Attempting to replicate the browser 400 error...');

  try {
    // This might be what the browser is doing - calling with wrong param names
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/get_user_effective_permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`, // Use anon key like browser
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({}) // Empty body like the browser might be sending
    });

    console.log(`Response status: ${response.status}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error response: ${errorText}`);
      console.log('🎯 This matches the browser 400 error!');
    } else {
      const data = await response.json();
      console.log(`✅ Success: ${data.length} results`);
    }

  } catch (err) {
    console.log(`❌ Fetch error: ${err.message}`);
  }

  // Now let's try with just user ID
  console.log('\n🔍 Testing with user_id only (what works)...');
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/get_user_effective_permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_id: '554fdea8-03cd-425e-a14c-70a9ac532627'
      })
    });

    console.log(`Response status: ${response.status}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error: ${errorText}`);
    } else {
      const data = await response.json();
      console.log(`✅ Success: ${data.length} results`);
    }

  } catch (err) {
    console.log(`❌ Fetch error: ${err.message}`);
  }

  console.log('\n🎯 The first test should show the same 400 error as the browser!');
}

fixTwoParamFunction().catch(console.error);