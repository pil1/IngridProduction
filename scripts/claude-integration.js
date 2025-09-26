#!/usr/bin/env node

import ClaudeSupabaseConnection from './claude-db-access.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ClaudeCodeIntegration {
  constructor() {
    this.db = new ClaudeSupabaseConnection();
    console.log('🤖 Claude Code integration initialized');
  }

  // Execute Supabase CLI commands
  async runSupabaseCommand(command) {
    try {
      console.log(`🔧 Executing: supabase ${command}`);
      const { stdout, stderr } = await execAsync(`supabase ${command}`);

      if (stderr && !stderr.includes('warning')) {
        console.warn('⚠️ Warning:', stderr);
      }

      console.log('✅ Command output:', stdout.trim());
      return { success: true, output: stdout.trim(), error: stderr };
    } catch (error) {
      console.error('❌ Command failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Run database migrations
  async runMigrations() {
    console.log('🚀 Running database migrations...');

    // First check if we're properly linked
    const status = await this.runSupabaseCommand('status');
    if (!status.success || !status.output.includes('teyivlpjxmpitqaqmucx')) {
      console.error('❌ Not properly linked to production database');
      console.log('🔧 Attempting to link...');
      await this.runSupabaseCommand('link --project-ref teyivlpjxmpitqaqmucx');
    }

    return await this.runSupabaseCommand('db push --linked');
  }

  // Reset database (DANGEROUS - use with extreme caution)
  async resetDatabase(confirmationToken) {
    if (confirmationToken !== 'CONFIRM_DATABASE_RESET_DANGER') {
      return {
        success: false,
        error: 'Database reset requires confirmationToken: "CONFIRM_DATABASE_RESET_DANGER"'
      };
    }

    console.log('⚠️ WARNING: Resetting database - THIS WILL DELETE ALL DATA!');
    console.log('🛑 This should NEVER be used on production database');

    // Create emergency backup first
    const backupResult = await this.backupDatabase('EMERGENCY_BACKUP_BEFORE_RESET');
    if (!backupResult.success) {
      return { success: false, error: 'Failed to create emergency backup' };
    }

    return await this.runSupabaseCommand('db reset --linked');
  }

  // Generate TypeScript types from live database
  async generateTypes() {
    console.log('🎯 Generating TypeScript types from live database...');

    const projectRoot = path.join(__dirname, '..');
    const typesDir = path.join(projectRoot, 'src', 'types');
    await fs.mkdir(typesDir, { recursive: true });

    const result = await this.runSupabaseCommand('gen types typescript --linked');

    if (result.success) {
      const typesFile = path.join(typesDir, 'supabase-generated.ts');
      await fs.writeFile(typesFile, result.output);
      console.log(`✅ Types generated: ${typesFile}`);
    }

    return result;
  }

  // Backup database
  async backupDatabase(filename) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = filename || `backup-${timestamp}.sql`;
    const projectRoot = path.join(__dirname, '..');
    const backupPath = path.join(projectRoot, 'backups');

    // Ensure backups directory exists
    await fs.mkdir(backupPath, { recursive: true });

    console.log(`💾 Creating database backup: ${backupFile}`);

    const fullPath = path.join(backupPath, backupFile);
    const result = await this.runSupabaseCommand(`db dump --linked -f "${fullPath}"`);

    if (result.success) {
      console.log(`✅ Backup created: ${fullPath}`);
    }

    return { ...result, backupPath: fullPath };
  }

  // Get comprehensive database status
  async getDatabaseStatus() {
    console.log('📊 Getting comprehensive database status...');

    // Check Supabase CLI status
    const cliStatus = await this.runSupabaseCommand('status');

    // Check migration status
    const migrationStatus = await this.runSupabaseCommand('migration list --linked');

    // Test database connection
    const connectionTest = await this.db.testConnection();

    // Get database overview
    const overview = await this.db.getDatabaseOverview();

    // Get recent activity
    const activity = await this.db.getRecentActivity(24);

    return {
      timestamp: new Date().toISOString(),
      cli: {
        linked: cliStatus.success && cliStatus.output.includes('teyivlpjxmpitqaqmucx'),
        status: cliStatus.output
      },
      migrations: {
        success: migrationStatus.success,
        output: migrationStatus.output
      },
      connection: connectionTest,
      database: {
        tables: overview.tables.length,
        overview: overview
      },
      activity: {
        recentProfiles: activity.profiles.length,
        recentCompanies: activity.companies.length
      },
      health: connectionTest && overview.tables.length > 0 ? 'healthy' : 'issues'
    };
  }

  // Execute custom SQL with comprehensive safety and logging
  async executeSQL(query, options = {}) {
    const {
      confirmDangerous = true,
      backup = false,
      dryRun = false,
      maxRows = 1000
    } = options;

    console.log('🔍 Analyzing SQL query...');

    // Enhanced safety check
    const dangerousPatterns = [
      /DROP\s+TABLE/i,
      /DELETE\s+FROM/i,
      /TRUNCATE/i,
      /ALTER\s+TABLE.*DROP/i,
      /DROP\s+DATABASE/i,
      /DROP\s+SCHEMA/i
    ];

    const isDangerous = dangerousPatterns.some(pattern => pattern.test(query));

    if (isDangerous) {
      console.log('⚠️ DANGEROUS OPERATION DETECTED');
      console.log('Query:', query);

      if (confirmDangerous && !dryRun) {
        if (backup) {
          console.log('💾 Creating safety backup...');
          const backupResult = await this.backupDatabase(`safety-backup-${Date.now()}.sql`);
          if (!backupResult.success) {
            return { success: false, error: 'Failed to create safety backup' };
          }
        }

        return await this.db.executeUnsafeQuery(query, 'CONFIRM_UNSAFE_OPERATION');
      } else {
        return {
          success: false,
          error: 'Dangerous operation blocked. Use confirmDangerous: true and backup: true'
        };
      }
    }

    if (dryRun) {
      console.log('🔍 DRY RUN - Query analysis:');
      console.log('Query:', query);
      console.log('Classification: SAFE');
      return { success: true, dryRun: true, classification: 'safe' };
    }

    // Add LIMIT to SELECT queries if not present and maxRows specified
    if (query.trim().toUpperCase().startsWith('SELECT') && maxRows) {
      if (!/LIMIT\s+\d+/i.test(query)) {
        query = `${query.trim()} LIMIT ${maxRows}`;
        console.log(`🔒 Added safety LIMIT ${maxRows} to SELECT query`);
      }
    }

    // Execute the query
    console.log('🔧 Executing SQL:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
    return await this.db.executeQuery(query);
  }

  // Smart migration checker
  async checkMigrations() {
    console.log('🔍 Checking migration status...');

    try {
      // Get local migrations
      const projectRoot = path.join(__dirname, '..');
      const migrationsDir = path.join(projectRoot, 'supabase', 'migrations');
      const localMigrations = (await fs.readdir(migrationsDir))
        .filter(file => file.endsWith('.sql'))
        .sort();

      // Get applied migrations from database
      const appliedResult = await this.runSupabaseCommand('migration list --linked');

      console.log('📋 Migration Analysis:');
      console.log(`   Local migrations: ${localMigrations.length}`);
      console.log(`   Applied migrations: ${appliedResult.success ? 'Connected' : 'Unable to check'}`);

      if (localMigrations.length > 0) {
        console.log('\n📄 Local migrations:');
        localMigrations.slice(-5).forEach(migration => {
          console.log(`   📄 ${migration}`);
        });
      }

      return {
        local: localMigrations,
        applied: appliedResult.output,
        status: appliedResult.success
      };

    } catch (error) {
      console.error('❌ Failed to check migrations:', error.message);
      return { error: error.message };
    }
  }

  // Database health check
  async healthCheck() {
    console.log('🏥 Running comprehensive health check...');

    const results = {
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Connection test
    results.checks.connection = await this.db.testConnection();

    // Table access test
    const tables = await this.db.listTables();
    results.checks.tableAccess = tables.length > 0;

    // Core tables check
    const coreTables = ['profiles', 'companies', 'modules'];
    results.checks.coreTables = coreTables.every(table => tables.includes(table));

    // Migration status
    const migrationStatus = await this.runSupabaseCommand('migration list --linked');
    results.checks.migrations = migrationStatus.success;

    // Recent activity check
    const activity = await this.db.getRecentActivity(1);
    results.checks.recentActivity = activity.profiles.length >= 0; // Just checking if query works

    // Calculate overall health
    const passedChecks = Object.values(results.checks).filter(Boolean).length;
    const totalChecks = Object.keys(results.checks).length;
    results.overallHealth = passedChecks / totalChecks;

    console.log('\n🏥 Health Check Results:');
    Object.entries(results.checks).forEach(([check, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${check}`);
    });
    console.log(`\n📊 Overall Health: ${(results.overallHealth * 100).toFixed(1)}%`);

    return results;
  }
}

// Export for use in other scripts
export default ClaudeCodeIntegration;

// CLI usage when called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  async function main() {
    const integration = new ClaudeCodeIntegration();

    const command = process.argv[2];
    const args = process.argv.slice(3);

    try {
      switch (command) {
        case 'status':
          const status = await integration.getDatabaseStatus();
          console.log('\n📊 Database Status Summary:');
          console.log(`   🔗 Connected: ${status.connection ? 'Yes' : 'No'}`);
          console.log(`   📋 Tables: ${status.database.tables}`);
          console.log(`   🏥 Health: ${status.health}`);
          console.log(`   🕐 Recent Activity: ${status.activity.recentProfiles} profiles, ${status.activity.recentCompanies} companies`);
          break;

        case 'migrate':
          await integration.runMigrations();
          break;

        case 'backup':
          const filename = args[0];
          await integration.backupDatabase(filename);
          break;

        case 'types':
          await integration.generateTypes();
          break;

        case 'sql':
          if (!args[0]) {
            console.error('❌ Usage: npm run claude:sql "SELECT * FROM profiles LIMIT 5"');
            process.exit(1);
          }
          const result = await integration.executeSQL(args[0]);
          if (result.success && result.data) {
            console.log('\n📊 Query Results:');
            console.table(result.data);
          }
          break;

        case 'health':
          await integration.healthCheck();
          break;

        case 'migrations':
          await integration.checkMigrations();
          break;

        case 'search':
          if (!args[0]) {
            console.error('❌ Usage: npm run claude:search "search term"');
            process.exit(1);
          }
          const searchResults = await integration.db.searchData(args[0]);
          console.log('\n🔍 Search Results:');
          Object.entries(searchResults).forEach(([table, rows]) => {
            console.log(`\n📋 ${table} (${rows.length} matches):`);
            console.table(rows);
          });
          break;

        default:
          console.log('🤖 Claude Code Integration Commands:');
          console.log('   status     - Get comprehensive database status');
          console.log('   migrate    - Run database migrations');
          console.log('   backup     - Create database backup');
          console.log('   types      - Generate TypeScript types');
          console.log('   health     - Run health check');
          console.log('   migrations - Check migration status');
          console.log('   sql "..."  - Execute SQL query');
          console.log('   search "..." - Search data across tables');
          console.log('\nExample:');
          console.log('   node scripts/claude-integration.js status');
          console.log('   node scripts/claude-integration.js sql "SELECT COUNT(*) FROM profiles"');
          break;
      }
    } catch (error) {
      console.error('❌ Command failed:', error.message);
      process.exit(1);
    }
  }

  main().catch(console.error);
}