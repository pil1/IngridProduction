#!/usr/bin/env node

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

class ClaudeSupabaseConnection {
  constructor() {
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

    console.log('✅ Claude Code connected to Supabase database');
    console.log(`📊 Project: ${process.env.SUPABASE_PROJECT_REF}`);
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

  // Execute raw SQL queries
  async executeQuery(query, params = []) {
    try {
      const { data, error } = await this.supabase.rpc('exec_sql', {
        query: query,
        params: params
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('❌ Query execution failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get table information
  async getTableInfo(tableName) {
    try {
      const { data, error } = await this.supabase
        .from('information_schema.columns')
        .select('*')
        .eq('table_name', tableName)
        .eq('table_schema', 'public');

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
        .eq('table_type', 'BASE TABLE');

      if (error) throw error;
      return data.map(row => row.table_name);
    } catch (error) {
      console.error('❌ Failed to list tables:', error.message);
      return [];
    }
  }
}

// Export for use in other scripts
module.exports = ClaudeSupabaseConnection;

// CLI usage when called directly
if (require.main === module) {
  async function main() {
    const db = new ClaudeSupabaseConnection();

    // Test connection
    await db.testConnection();

    // List tables
    const tables = await db.listTables();
    console.log('📋 Available tables:', tables);

    // Example query
    const result = await db.executeQuery(
      'SELECT COUNT(*) as total_users FROM profiles'
    );
    console.log('👥 Total users:', result.data);
  }

  main().catch(console.error);
}
