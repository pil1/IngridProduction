#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🔧 APPLYING RPC FUNCTION FIXES');
console.log('===============================\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function executeSql(sql) {
  try {
    console.log('📝 Executing SQL...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_text: sql });

    if (error) {
      console.log(`❌ Error: ${error.message}`);
      return false;
    }

    console.log('✅ SQL executed successfully');
    return true;

  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
    return false;
  }
}

async function applyFix() {
  try {
    const sqlContent = readFileSync(join(__dirname, '..', 'FINAL_RPC_FIX.sql'), 'utf8');

    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`🔧 Executing statement ${i + 1}/${statements.length}...`);

      try {
        // Execute each statement individually
        const { error } = await supabase
          .from('_temp_exec')
          .select('*')
          .limit(0); // This will fail, but we need to execute raw SQL

        // Try direct RPC execution instead
        const result = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
          },
          body: JSON.stringify({ query: statement + ';' })
        });

        if (!result.ok) {
          console.log(`   ⚠️  Statement ${i + 1} may have failed (${result.status})`);
        } else {
          console.log(`   ✅ Statement ${i + 1} executed`);
        }

      } catch (err) {
        console.log(`   ⚠️  Statement ${i + 1}: ${err.message}`);
      }
    }

    console.log('\n🧪 Testing functions after applying fixes...');

    // Test the main function
    const { data, error } = await supabase
      .rpc('get_user_effective_permissions', {
        user_id: '554fdea8-03cd-425e-a14c-70a9ac532627'
      });

    if (error) {
      console.log(`❌ get_user_effective_permissions still failing: ${error.message}`);
    } else {
      console.log(`✅ get_user_effective_permissions working! Found ${data.length} permissions`);
    }

  } catch (err) {
    console.log(`❌ Failed to read SQL file: ${err.message}`);
  }
}

applyFix().catch(console.error);