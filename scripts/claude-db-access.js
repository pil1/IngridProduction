#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Configure dotenv for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

class ClaudeSupabaseConnection {
  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        '❌ Missing Supabase credentials. Please check .env.local file.\n' +
        'Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    // Service role client for full database access
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        }
      }
    );

    // Direct PostgreSQL connection for migrations and schema operations
    this.dbUrl = process.env.SUPABASE_DB_URL;
    this.projectRef = process.env.SUPABASE_PROJECT_REF || 'teyivlpjxmpitqaqmucx';

    console.log('✅ Claude Code connected to Supabase database');
    console.log(`📊 Project: ${this.projectRef}`);
    console.log(`🔗 URL: ${process.env.SUPABASE_URL}`);
  }

  // Test database connectivity
  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('count')
        .limit(1);

      if (error) throw error;

      console.log('✅ Database connection successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
  }

  // Execute raw SQL queries (with safety checks)
  async executeQuery(query, params = []) {
    try {
      // Safety check for dangerous operations
      const dangerousKeywords = ['DROP TABLE', 'DELETE FROM', 'TRUNCATE', 'ALTER TABLE'];
      const queryUpper = query.toUpperCase();
      const isDangerous = dangerousKeywords.some(keyword => queryUpper.includes(keyword));

      if (isDangerous) {
        console.warn('⚠️ DANGEROUS OPERATION DETECTED');
        console.warn('Query:', query);
        console.warn('Use executeUnsafeQuery() if you really need to run this');
        return { success: false, error: 'Dangerous operation blocked for safety' };
      }

      // Log query execution
      this.logQuery(query, 'safe');

      const { data, error } = await this.supabase.rpc('execute_sql', {
        query: query
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('❌ Query execution failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Execute potentially dangerous queries (with explicit confirmation)
  async executeUnsafeQuery(query, confirmationToken) {
    if (confirmationToken !== 'CONFIRM_UNSAFE_OPERATION') {
      return {
        success: false,
        error: 'Unsafe operations require confirmationToken: "CONFIRM_UNSAFE_OPERATION"'
      };
    }

    try {
      this.logQuery(query, 'unsafe');
      console.warn('⚠️ EXECUTING UNSAFE QUERY:', query);

      const { data, error } = await this.supabase.rpc('execute_sql', {
        query: query
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('❌ Unsafe query execution failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get table information
  async getTableInfo(tableName) {
    try {
      const { data, error } = await this.supabase
        .from('information_schema.columns')
        .select(`
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        `)
        .eq('table_name', tableName)
        .eq('table_schema', 'public')
        .order('ordinal_position');

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`❌ Failed to get table info for ${tableName}:`, error.message);
      return null;
    }
  }

  // List all tables
  async listTables() {
    try {
      const { data, error } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE')
        .order('table_name');

      if (error) throw error;
      return data.map(row => row.table_name);
    } catch (error) {
      console.error('❌ Failed to list tables:', error.message);
      return [];
    }
  }

  // Get table row counts
  async getTableCounts() {
    try {
      const tables = await this.listTables();
      const counts = {};

      for (const table of tables) {
        const { count, error } = await this.supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (!error) {
          counts[table] = count;
        }
      }

      return counts;
    } catch (error) {
      console.error('❌ Failed to get table counts:', error.message);
      return {};
    }
  }

  // Get database schema overview
  async getDatabaseOverview() {
    try {
      const tables = await this.listTables();
      const counts = await this.getTableCounts();

      console.log('\n📊 Database Overview:');
      console.log('─'.repeat(50));

      for (const table of tables) {
        const count = counts[table] || 'N/A';
        console.log(`📋 ${table.padEnd(25)} | ${count.toString().padStart(8)} rows`);
      }

      console.log('─'.repeat(50));
      console.log(`📊 Total tables: ${tables.length}`);

      return { tables, counts };
    } catch (error) {
      console.error('❌ Failed to get database overview:', error.message);
      return { tables: [], counts: {} };
    }
  }

  // Search for data across tables
  async searchData(searchTerm, tables = null) {
    if (!tables) {
      tables = await this.listTables();
    }

    const results = {};

    for (const table of tables) {
      try {
        // Get string columns for the table
        const columns = await this.getTableInfo(table);
        const stringColumns = columns
          .filter(col => ['text', 'varchar', 'character varying'].includes(col.data_type))
          .map(col => col.column_name);

        if (stringColumns.length === 0) continue;

        // Search in each string column
        const searchConditions = stringColumns.map(col => `${col} ILIKE '%${searchTerm}%'`);
        const query = `
          SELECT * FROM ${table}
          WHERE ${searchConditions.join(' OR ')}
          LIMIT 10
        `;

        const result = await this.executeQuery(query);
        if (result.success && result.data && result.data.length > 0) {
          results[table] = result.data;
        }
      } catch (error) {
        console.warn(`⚠️ Search failed for table ${table}:`, error.message);
      }
    }

    return results;
  }

  // Log query execution for audit purposes
  logQuery(query, type = 'safe') {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type,
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      user: 'claude-code'
    };

    console.log(`📝 [${timestamp}] ${type.toUpperCase()}: ${logEntry.query}`);

    // In production, you might want to store these logs in a table
    // await this.supabase.from('operation_logs').insert(logEntry);
  }

  // Get recent activity/changes
  async getRecentActivity(hours = 24) {
    try {
      const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      // Check recent profile updates
      const { data: profiles, error: profileError } = await this.supabase
        .from('profiles')
        .select('id, email, updated_at, created_at')
        .or(`updated_at.gte.${hoursAgo},created_at.gte.${hoursAgo}`)
        .order('updated_at', { ascending: false })
        .limit(10);

      // Check recent company activity
      const { data: companies, error: companyError } = await this.supabase
        .from('companies')
        .select('id, name, updated_at, created_at')
        .or(`updated_at.gte.${hoursAgo},created_at.gte.${hoursAgo}`)
        .order('updated_at', { ascending: false })
        .limit(10);

      return {
        profiles: profileError ? [] : profiles,
        companies: companyError ? [] : companies,
        timeframe: `${hours} hours`
      };
    } catch (error) {
      console.error('❌ Failed to get recent activity:', error.message);
      return { profiles: [], companies: [], timeframe: `${hours} hours` };
    }
  }
}

// Export for use in other scripts
export default ClaudeSupabaseConnection;

// CLI usage when called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  async function main() {
    try {
      const db = new ClaudeSupabaseConnection();

      // Test connection
      await db.testConnection();

      // Get database overview
      await db.getDatabaseOverview();

      // Get recent activity
      const activity = await db.getRecentActivity(24);
      console.log('\n🕐 Recent Activity (24h):');
      console.log(`👥 Profile changes: ${activity.profiles.length}`);
      console.log(`🏢 Company changes: ${activity.companies.length}`);

      // Example safe query
      const userCount = await db.executeQuery(`
        SELECT
          role,
          COUNT(*) as count
        FROM profiles
        WHERE role IS NOT NULL
        GROUP BY role
        ORDER BY count DESC
      `);

      if (userCount.success) {
        console.log('\n👥 User Distribution:');
        userCount.data.forEach(row => {
          console.log(`   ${row.role}: ${row.count} users`);
        });
      }

    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      console.error('\n💡 Setup Help:');
      console.error('1. Ensure Supabase CLI is installed: npm install -g supabase');
      console.error('2. Login to Supabase: supabase login');
      console.error('3. Link project: supabase link --project-ref teyivlpjxmpitqaqmucx');
      console.error('4. Set up .env.local with credentials');
      process.exit(1);
    }
  }

  main().catch(console.error);
}