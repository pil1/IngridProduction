// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('DEBUG: OPTIONS request received for delete-company-and-users');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('DEBUG: delete-company-and-users function invoked.');
    const authHeader = req.headers.get('Authorization');
    console.log('DEBUG: Authorization header received:', authHeader ? authHeader.substring(0, Math.min(authHeader.length, 50)) + '...' : 'Missing');

    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader! } } } // Use authHeader directly
    );

    const { data: { user: currentUser }, error: getUserError } = await supabaseClient.auth.getUser();
    if (getUserError) {
      console.error('ERROR: delete-company-and-users - supabaseClient.auth.getUser() failed:', getUserError.message);
    }
    console.log('DEBUG: delete-company-and-users - Authenticated user (from supabaseClient.auth.getUser()):', currentUser ? currentUser.id : 'None');


    if (!currentUser) {
      console.error('ERROR: delete-company-and-users - Unauthorized: No authenticated user found by supabaseClient.auth.getUser().');
      return new Response(JSON.stringify({ error: 'Unauthorized: No authenticated user.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: currentProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', currentUser.id)
      .single();

    if (profileError) {
      console.error('ERROR: delete-company-and-users - Error fetching current user profile with supabaseAdmin:', profileError.message);
    }
    console.log('DEBUG: delete-company-and-users - Current user profile role:', currentProfile?.role || 'None');


    if (profileError || !currentProfile || currentProfile.role !== 'super-admin') {
      console.error('ERROR: delete-company-and-users - Forbidden: Current user profile not found or not a super-admin.');
      return new Response(JSON.stringify({ error: 'Forbidden: Only Super Admins can delete companies.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { company_id } = await req.json();

    if (!company_id) {
      return new Response(JSON.stringify({ error: 'Missing company_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch all user_ids associated with the company
    const { data: profiles, error: fetchProfilesError } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('company_id', company_id);

    if (fetchProfilesError) {
      console.error('Error fetching profiles for company deletion:', fetchProfilesError.message);
      throw new Error(`Failed to fetch users for company deletion: ${fetchProfilesError.message}`);
    }

    // 2. IMPORTANT: Set company_id to NULL for all profiles associated with this company
    // This breaks the foreign key constraint from profiles to companies, allowing company deletion.
    const { error: updateProfilesError } = await supabaseAdmin
      .from('profiles')
      .update({ company_id: null, updated_at: new Date().toISOString() })
      .eq('company_id', company_id);

    if (updateProfilesError) {
      console.error('Error setting company_id to NULL for profiles:', updateProfilesError.message);
      // Don't throw, try to proceed with other deletions
    } else {
      console.log(`Successfully set company_id to NULL for profiles associated with company ${company_id}.`);
    }

    // 3. Delete records from other tables referencing company_id
    const tablesToClear = [
      'company_smtp_settings',
      'spire_integrations',
      'company_modules',
      'analytics_insights',
      'automations',
      'invitations',
      'gl_accounts',
      'company_email_templates',
      'billing_records',
      'expense_categories',
      'company_locations',
      'vendors',
      'customers',
      'invoices',
      'module_configurations',
    ];

    for (const tableName of tablesToClear) {
      const { error: deleteError } = await supabaseAdmin
        .from(tableName)
        .delete()
        .eq('company_id', company_id);
      if (deleteError) {
        console.error(`Error deleting from ${tableName} for company ${company_id}:`, deleteError.message);
      } else {
        console.log(`Successfully deleted records from ${tableName} for company ${company_id}.`);
      }
    }

    // 4. Delete expenses associated with the company
    // This will cascade delete receipts, expense_line_items, and expense_audit_log entries.
    const { error: deleteExpensesError } = await supabaseAdmin
      .from('expenses')
      .delete()
      .eq('company_id', company_id);
    if (deleteExpensesError) {
      console.error('Error deleting expenses for company deletion:', deleteExpensesError.message);
    } else {
      console.log(`Successfully deleted expenses for company ${company_id}.`);
    }

    // 5. Delete each user from auth.users
    // This will cascade delete entries in the 'profiles' table (since profiles.id references auth.users.id ON DELETE CASCADE).
    // We do this *after* setting company_id to NULL in profiles to avoid issues if the cascade somehow tries to delete the company first.
    if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        if (profile.user_id === currentUser.id) {
          console.warn(`Skipping deletion of current super-admin user ${currentUser.id} from company ${company_id}.`);
          continue;
        }
        const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(profile.user_id);
        if (deleteUserError) {
          console.error(`Error deleting user ${profile.user_id}:`, deleteUserError.message);
        } else {
          console.log(`Successfully deleted user: ${profile.user_id}`);
        }
      }
    }

    // 6. Finally, delete the company itself
    const { error: deleteCompanyError } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', company_id);

    if (deleteCompanyError) {
      console.error('Error deleting company:', deleteCompanyError.message);
      throw new Error(`Failed to delete company: ${deleteCompanyError.message}`);
    }

    return new Response(JSON.stringify({ message: 'Company and associated data deleted successfully.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in delete-company-and-users function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});