/**
 * Cleanup Script: Delete All Expenses
 *
 * This script deletes all existing expenses across all companies
 * to start fresh with the new AI metadata schema.
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to replace these with your actual Supabase credentials
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'your-supabase-url';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';

async function cleanupExpenses() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || SUPABASE_URL === 'your-supabase-url') {
    console.error('❌ Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
    console.log('You can find these in your Supabase dashboard:');
    console.log('- URL: Project Settings → API → Project URL');
    console.log('- Service Key: Project Settings → API → Project API keys → service_role');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('🧹 Starting expense cleanup...');

    // First, get a count of existing expenses
    const { count, error: countError } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting expenses:', countError);
      return;
    }

    console.log(`📊 Found ${count} expenses to delete`);

    if (count === 0) {
      console.log('✅ No expenses found. Database is already clean!');
      return;
    }

    // Confirm before deletion
    console.log('⚠️  This will permanently delete ALL expenses in the system!');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete all expenses
    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using impossible condition)

    if (deleteError) {
      console.error('❌ Error deleting expenses:', deleteError);
      return;
    }

    console.log('✅ Successfully deleted all expenses!');
    console.log('🚀 System is ready for fresh data with new AI metadata schema');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the cleanup
cleanupExpenses();