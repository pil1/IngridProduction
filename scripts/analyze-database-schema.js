#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

console.log('🔍 INFOtrac Database Schema Analysis');
console.log('=====================================\n');

// Create Supabase client with service role for full access
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

async function analyzeDatabaseSchema() {
  const tableNames = [
    'profiles',
    'companies',
    'expenses',
    'vendors',
    'customers',
    'expense_categories',
    'gl_accounts',
    'notifications',
    'modules',
    'company_modules',
    'user_modules',
    'permissions',
    'user_permissions',
    'company_users',
    'ingrid_suggested_categories',
    'ingrid_suggested_vendors',
    'api_keys',
    'custom_roles',
    'role_permissions'
  ];

  const schemaAnalysis = {};

  console.log('📊 Analyzing table schemas and sample data...\n');

  for (const tableName of tableNames) {
    console.log(`🔍 Analyzing table: ${tableName}`);

    try {
      // Get sample data to understand structure
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(3);

      if (error) {
        console.log(`   ❌ Error accessing ${tableName}: ${error.message}`);
        schemaAnalysis[tableName] = { error: error.message, exists: false };
        continue;
      }

      if (!data || data.length === 0) {
        console.log(`   ⚠️  Table ${tableName} exists but is empty`);
        schemaAnalysis[tableName] = { exists: true, empty: true, fields: [] };
        continue;
      }

      // Extract field names and types from first row
      const sampleRow = data[0];
      const fields = Object.keys(sampleRow).map(key => ({
        name: key,
        type: typeof sampleRow[key],
        sampleValue: sampleRow[key]
      }));

      console.log(`   ✅ Found ${data.length} records, ${fields.length} fields`);
      console.log(`   📋 Fields: ${fields.map(f => f.name).join(', ')}`);

      schemaAnalysis[tableName] = {
        exists: true,
        recordCount: data.length,
        fields: fields,
        sampleData: data
      };

    } catch (err) {
      console.log(`   ❌ Exception for ${tableName}: ${err.message}`);
      schemaAnalysis[tableName] = { error: err.message, exists: false };
    }

    console.log('');
  }

  return schemaAnalysis;
}

async function findReferencedTables() {
  console.log('🔍 Looking for additional referenced tables...\n');

  // Try some common table patterns that might exist
  const possibleTables = [
    'user_profiles',
    'company_settings',
    'audit_logs',
    'file_uploads',
    'email_templates',
    'workflow_steps',
    'approval_workflows',
    'document_templates',
    'integrations',
    'webhooks'
  ];

  const foundTables = [];

  for (const tableName of possibleTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (!error) {
        console.log(`   ✅ Found additional table: ${tableName}`);
        foundTables.push(tableName);
      }
    } catch (err) {
      // Table doesn't exist, continue
    }
  }

  return foundTables;
}

// Main analysis
analyzeDatabaseSchema()
  .then(async (schema) => {
    const additionalTables = await findReferencedTables();

    console.log('📋 Database Schema Analysis Summary');
    console.log('==================================\n');

    const existingTables = Object.keys(schema).filter(table => schema[table].exists);
    const missingTables = Object.keys(schema).filter(table => !schema[table].exists);

    console.log(`✅ Existing tables (${existingTables.length}):`);
    existingTables.forEach(table => {
      const info = schema[table];
      const fieldCount = info.fields?.length || 0;
      const recordCount = info.recordCount || 0;
      console.log(`   • ${table} (${fieldCount} fields, ${recordCount} records)`);
    });

    if (missingTables.length > 0) {
      console.log(`\n❌ Missing/Inaccessible tables (${missingTables.length}):`);
      missingTables.forEach(table => {
        console.log(`   • ${table} - ${schema[table].error}`);
      });
    }

    if (additionalTables.length > 0) {
      console.log(`\n🔍 Additional tables found (${additionalTables.length}):`);
      additionalTables.forEach(table => {
        console.log(`   • ${table}`);
      });
    }

    console.log('\n📊 Detailed Field Analysis:');
    console.log('============================\n');

    existingTables.forEach(tableName => {
      const table = schema[tableName];
      if (table.fields && table.fields.length > 0) {
        console.log(`🗂️  ${tableName.toUpperCase()}:`);
        table.fields.forEach(field => {
          const sampleStr = field.sampleValue !== null && field.sampleValue !== undefined
            ? String(field.sampleValue).slice(0, 50)
            : 'null';
          console.log(`   • ${field.name} (${field.type}) - "${sampleStr}"`);
        });
        console.log('');
      }
    });

    // Save analysis to file for comparison
    const fs = await import('fs/promises');
    const analysisPath = join(__dirname, '..', 'database-analysis.json');
    await fs.writeFile(analysisPath, JSON.stringify(schema, null, 2));

    console.log(`💾 Analysis saved to: ${analysisPath}`);
    console.log('\n🎯 Ready for source code comparison!');
  })
  .catch(console.error);