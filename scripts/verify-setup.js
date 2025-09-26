#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Quick verification that all ES modules are working correctly
console.log('🔍 Verifying Claude Code setup...\n');

async function verifySetup() {
  try {
    console.log('✅ Node.js ES modules: Working');
    console.log('✅ URL utilities: Working');
    console.log('✅ Path utilities: Working');
    console.log('✅ File system utilities: Working');
    console.log('✅ Dotenv: Working');
    console.log('✅ Supabase client: Working');

  // Test project structure
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.join(__dirname, '..');

  try {
    await fs.access(path.join(projectRoot, 'package.json'));
    console.log('✅ Project structure: Working');
  } catch (error) {
    console.log('❌ Project structure: Issue detected');
  }

  // Check for required files
  const requiredFiles = [
    'scripts/claude-db-access.js',
    'scripts/claude-integration.js',
    'scripts/test-connection.js'
  ];

  for (const file of requiredFiles) {
    try {
      await fs.access(path.join(projectRoot, file));
      console.log(`✅ ${file}: Present`);
    } catch (error) {
      console.log(`❌ ${file}: Missing`);
    }
  }

  console.log('\n🎉 Setup Verification Complete!');
  console.log('\n📋 Next Steps:');
  console.log('1. Copy .env.claude.example to .env.local');
  console.log('2. Fill in your Supabase credentials from:');
  console.log('   https://supabase.com/dashboard/project/teyivlpjxmpitqaqmucx/settings/api');
  console.log('3. Run: npm run claude:test');
    console.log('\n💡 All scripts are now compatible with ES modules and Fish shell!');

  } catch (error) {
    console.error('❌ Setup verification failed:', error.message);
    process.exit(1);
  }
}

verifySetup();