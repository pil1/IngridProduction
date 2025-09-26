import { createClient } from '@supabase/supabase-js';

// Admin client for service role operations
// This client has elevated permissions for admin operations like user creation

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing VITE_SUPABASE_SERVICE_ROLE_KEY environment variable - required for admin operations');
}

// Create admin client with service role key
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper function to check if current user can use admin functions
export async function canUseAdminClient(): Promise<boolean> {
  try {
    // Check if the current user is a super admin
    const { data: { user } } = await import('./client').then(m => m.supabase.auth.getUser());

    if (!user) return false;

    // Check user's role in profiles table
    const { data: profile } = await import('./client').then(m =>
      m.supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()
    );

    return profile?.role === 'super-admin';
  } catch (error) {
    console.error('Error checking admin permissions:', error);
    return false;
  }
}

// Wrapper function for secure admin operations
export async function executeAdminOperation<T>(
  operation: () => Promise<T>,
  requireSuperAdmin = true
): Promise<T> {
  if (requireSuperAdmin) {
    const canUseAdmin = await canUseAdminClient();
    if (!canUseAdmin) {
      throw new Error('Insufficient permissions for admin operation');
    }
  }

  return operation();
}