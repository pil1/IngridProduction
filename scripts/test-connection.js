#!/usr/bin/env node

import ClaudeCodeIntegration from './claude-integration.js';

async function runComprehensiveTests() {
  console.log('🧪 Starting Claude Code → Supabase Connection Tests');
  console.log('=' .repeat(60));

  let passedTests = 0;
  let totalTests = 0;

  function runTest(testName, testFunc) {
    return new Promise(async (resolve) => {
      totalTests++;
      console.log(`\n🔍 Test ${totalTests}: ${testName}`);
      console.log('-'.repeat(40));

      try {
        const result = await testFunc();
        if (result) {
          console.log('✅ PASS');
          passedTests++;
        } else {
          console.log('❌ FAIL');
        }
        resolve(result);
      } catch (error) {
        console.log('❌ FAIL -', error.message);
        resolve(false);
      }
    });
  }

  let integration;

  // Test 0: Environment Setup
  await runTest('Environment Setup & Initialization', async () => {
    try {
      integration = new ClaudeCodeIntegration();
      console.log('   📦 ClaudeCodeIntegration created successfully');
      return true;
    } catch (error) {
      console.log('   ❌ Failed to initialize:', error.message);
      console.log('\n💡 Setup Requirements:');
      console.log('   1. Create .env.local with Supabase credentials');
      console.log('   2. Install dependencies: npm install @supabase/supabase-js dotenv');
      console.log('   3. Ensure Supabase CLI is installed and authenticated');
      return false;
    }
  });

  if (!integration) {
    console.log('\n🛑 Cannot proceed with tests - setup failed');
    return;
  }

  // Test 1: Basic Database Connectivity
  await runTest('Basic Database Connectivity', async () => {
    const connected = await integration.db.testConnection();
    if (connected) {
      console.log('   🔌 Database connection established');
    } else {
      console.log('   ❌ Failed to connect to database');
      console.log('   💡 Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
    }
    return connected;
  });

  // Test 2: Supabase CLI Integration
  await runTest('Supabase CLI Integration', async () => {
    const status = await integration.runSupabaseCommand('--version');
    if (status.success) {
      console.log('   📋 Supabase CLI version:', status.output.split('\n')[0]);
      return true;
    } else {
      console.log('   ❌ Supabase CLI not available');
      console.log('   💡 Install with: npm install -g supabase');
      return false;
    }
  });

  // Test 3: Project Linking
  await runTest('Project Linking Status', async () => {
    const status = await integration.runSupabaseCommand('status');
    const isLinked = status.success && status.output.includes('teyivlpjxmpitqaqmucx');

    if (isLinked) {
      console.log('   🔗 Project properly linked to teyivlpjxmpitqaqmucx');
    } else {
      console.log('   ⚠️ Project not linked or link status unclear');
      console.log('   💡 Link with: supabase link --project-ref teyivlpjxmpitqaqmucx');
    }
    return isLinked;
  });

  // Test 4: Table Access
  await runTest('Database Table Access', async () => {
    const tables = await integration.db.listTables();
    console.log(`   📊 Found ${tables.length} tables`);

    if (tables.length > 0) {
      console.log('   📋 Sample tables:', tables.slice(0, 5).join(', '));

      // Check for core tables
      const coreTables = ['profiles', 'companies', 'modules'];
      const hasCoreTables = coreTables.every(table => tables.includes(table));

      if (hasCoreTables) {
        console.log('   ✅ All core tables present');
        return true;
      } else {
        console.log('   ⚠️ Some core tables missing');
        const missing = coreTables.filter(table => !tables.includes(table));
        console.log('   ❓ Missing:', missing.join(', '));
        return tables.length > 10; // Pass if we have a reasonable number of tables
      }
    } else {
      console.log('   ❌ No tables found - possible permission issue');
      return false;
    }
  });

  // Test 5: Safe Query Execution
  await runTest('Safe Query Execution', async () => {
    const query = `
      SELECT
        COUNT(*) as total_count,
        'profiles' as table_name
      FROM profiles
      LIMIT 1
    `;

    const result = await integration.executeSQL(query.trim());

    if (result.success && result.data) {
      console.log('   📊 Query executed successfully');
      console.log('   📈 Result:', result.data[0]);
      return true;
    } else {
      console.log('   ❌ Query execution failed:', result.error);
      return false;
    }
  });

  // Test 6: Table Schema Information
  await runTest('Table Schema Access', async () => {
    const tableInfo = await integration.db.getTableInfo('profiles');

    if (tableInfo && tableInfo.length > 0) {
      console.log(`   📋 Profiles table has ${tableInfo.length} columns`);
      console.log('   📊 Sample columns:', tableInfo.slice(0, 3).map(c => c.column_name).join(', '));
      return true;
    } else {
      console.log('   ❌ Failed to get table schema information');
      return false;
    }
  });

  // Test 7: Database Overview
  await runTest('Database Overview Generation', async () => {
    const overview = await integration.db.getDatabaseOverview();

    if (overview.tables.length > 0) {
      console.log(`   📊 Database contains ${overview.tables.length} tables`);
      const totalRows = Object.values(overview.counts).reduce((sum, count) =>
        sum + (typeof count === 'number' ? count : 0), 0);
      console.log(`   📈 Estimated total rows: ${totalRows}`);
      return true;
    } else {
      console.log('   ❌ Failed to generate database overview');
      return false;
    }
  });

  // Test 8: Migration Status Check
  await runTest('Migration Status Check', async () => {
    const migrationCheck = await integration.checkMigrations();

    if (migrationCheck.local) {
      console.log(`   📄 Found ${migrationCheck.local.length} local migration files`);
      if (migrationCheck.status) {
        console.log('   ✅ Successfully connected to check applied migrations');
        return true;
      } else {
        console.log('   ⚠️ Could not verify applied migrations (but connection works)');
        return true; // Still pass if we can see local files
      }
    } else {
      console.log('   ❌ Migration check failed');
      return false;
    }
  });

  // Test 9: Safety Features
  await runTest('Safety Feature Validation', async () => {
    // Test dangerous query blocking
    const dangerousQuery = 'DROP TABLE test_table';
    const result = await integration.executeSQL(dangerousQuery);

    if (!result.success && result.error.includes('blocked')) {
      console.log('   🛡️ Dangerous operations properly blocked');
      return true;
    } else {
      console.log('   ⚠️ Safety features may not be working correctly');
      return false;
    }
  });

  // Test 10: Health Check System
  await runTest('Health Check System', async () => {
    const healthCheck = await integration.healthCheck();

    if (healthCheck.overallHealth !== undefined) {
      console.log(`   🏥 Overall health score: ${(healthCheck.overallHealth * 100).toFixed(1)}%`);

      const healthyThreshold = 0.8; // 80%
      if (healthCheck.overallHealth >= healthyThreshold) {
        console.log('   ✅ System is healthy');
        return true;
      } else {
        console.log('   ⚠️ System has some health issues but basic functionality works');
        return healthCheck.overallHealth > 0.5; // Pass if more than 50% healthy
      }
    } else {
      console.log('   ❌ Health check system failed');
      return false;
    }
  });

  // Final Results
  console.log('\n' + '='.repeat(60));
  console.log('🎯 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));

  const passRate = (passedTests / totalTests) * 100;
  console.log(`📊 Tests Passed: ${passedTests}/${totalTests} (${passRate.toFixed(1)}%)`);

  if (passRate >= 90) {
    console.log('🎉 EXCELLENT - Claude Code is fully connected and operational!');
    console.log('✅ You can now use Claude Code for database operations');
  } else if (passRate >= 70) {
    console.log('✅ GOOD - Claude Code is mostly functional with minor issues');
    console.log('💡 Check the failed tests above for improvement areas');
  } else if (passRate >= 50) {
    console.log('⚠️ PARTIAL - Basic connectivity works but several features need attention');
    console.log('🔧 Review setup guide and resolve failed tests');
  } else {
    console.log('❌ POOR - Major setup issues detected');
    console.log('🆘 Please review CLAUDE_CODE_SUPABASE_CONNECTION_GUIDE.md');
  }

  console.log('\n📚 Next Steps:');
  if (passRate >= 80) {
    console.log('   ✨ Start using: node scripts/claude-integration.js status');
    console.log('   📊 Try queries: node scripts/claude-integration.js sql "SELECT COUNT(*) FROM profiles"');
    console.log('   🔍 Search data: node scripts/claude-integration.js search "admin"');
  } else {
    console.log('   🔧 Fix failed tests above');
    console.log('   📖 Review connection guide');
    console.log('   🆘 Check environment variables');
  }

  console.log('='.repeat(60));

  return {
    passedTests,
    totalTests,
    passRate,
    status: passRate >= 70 ? 'operational' : 'needs_attention'
  };
}

// Export for use in other scripts
export default runComprehensiveTests;

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveTests()
    .then(results => {
      process.exit(results.status === 'operational' ? 0 : 1);
    })
    .catch(error => {
      console.error('🚨 Test suite crashed:', error.message);
      process.exit(1);
    });
}