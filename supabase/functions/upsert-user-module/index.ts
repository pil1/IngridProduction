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
    console.log('DEBUG: OPTIONS request received for upsert-user-module');
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
    if (!currentUser) throw new Error('Unauthorized: No authenticated user.');

    const { data: currentProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id')
      .eq('user_id', currentUser.id)
      .single();

    if (profileError || !currentProfile) {
      console.error('Error fetching current user profile:', profileError);
      throw new Error('Forbidden: Current user profile not found or access denied.');
    }

    const requestBody = await req.json();
    const { target_user_id, target_user_role, company_id, module_id, is_enabled } = requestBody;

    if (!target_user_id || !company_id || !module_id || typeof is_enabled !== 'boolean' || !target_user_role) {
      return new Response(JSON.stringify({ error: 'Missing required parameters. Required: target_user_id, company_id, module_id, is_enabled, target_user_role.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authorization checks
    if (currentProfile.role === 'super-admin') {
      // Super-admin can manage any user in any company
    } else if (currentProfile.role === 'admin') {
      // Admin can only manage users within their own company
      if (!currentProfile.company_id || currentProfile.company_id !== company_id) {
        throw new Error("Forbidden: Admins can only manage modules for users within their own company.");
      }
      // Additionally, verify the target_user_id belongs to the same company
      const { data: targetUserProfile, error: targetProfileError } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('user_id', target_user_id)
        .single();

      if (targetProfileError || !targetUserProfile || targetUserProfile.company_id !== company_id) {
        throw new Error("Forbidden: Target user is not in the admin's company.");
      }
      
      // System Module Locking check for admins
      const { data: companyModule, error: companyModuleError } = await supabaseAdmin
        .from('company_modules')
        .select('is_locked_by_system')
        .eq('company_id', company_id)
        .eq('module_id', module_id)
        .single();

      if (companyModuleError) {
        console.error('Error checking company module lock status:', companyModuleError);
        throw new Error('Could not verify module properties.');
      }

      // Admins cannot disable a system-locked module.
      if (companyModule?.is_locked_by_system && is_enabled === false) {
        throw new Error("Forbidden: Admins cannot disable a system-locked module for a user.");
      }

    } else {
      throw new Error('Forbidden: Insufficient permissions to manage user modules.');
    }

    // Determine default state based on role
    const isDefaultEnabled = target_user_role === 'admin' || target_user_role === 'controller';

    let operationError = null;

    if (is_enabled === isDefaultEnabled) {
      // If the new state matches the default, remove any specific override.
      const { error } = await supabaseAdmin
        .from('user_modules')
        .delete()
        .eq('user_id', target_user_id)
        .eq('module_id', module_id);
      operationError = error;
    } else {
      // If the new state is different from default, upsert an override.
      const payload = {
        user_id: target_user_id,
        company_id: company_id,
        module_id: module_id,
        is_enabled: is_enabled,
      };
      const { error } = await supabaseAdmin
        .from('user_modules')
        .upsert(payload, { onConflict: 'user_id,module_id' });
      operationError = error;
    }

    if (operationError) {
      console.error('Error updating user module:', operationError);
      throw new Error(`Failed to update user module: ${operationError.message}`);
    }

    return new Response(JSON.stringify({ message: 'User module updated successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in upsert-user-module function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});