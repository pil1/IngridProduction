#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🔍 Quick Connection Test\n');

// Check environment variables
console.log('📋 Environment Check:');
console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
console.log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}`);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('\n❌ Missing credentials. Please check .env.local');
  process.exit(1);
}

// Test connection with timeout
console.log('\n🔌 Testing Connection...');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY, // Try with anon key first
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

// Simple test with timeout
async function testWithTimeout() {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
  );

  const testPromise = supabase
    .from('profiles')
    .select('count')
    .limit(1);

  try {
    const { data, error } = await Promise.race([testPromise, timeoutPromise]);

    if (error) {
      console.log('❌ Connection failed:', error.message);
      return false;
    }

    console.log('✅ Connection successful!');
    return true;
  } catch (err) {
    console.log('❌ Connection error:', err.message);
    return false;
  }
}

testWithTimeout().then(success => {
  process.exit(success ? 0 : 1);
});