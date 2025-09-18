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
    console.log('DEBUG: OPTIONS request received for assign-company-module');
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

    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized: No authenticated user.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: currentProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id')
      .eq('user_id', currentUser.id)
      .single();

    if (profileError || !currentProfile) {
      console.error('Error fetching current user profile:', profileError);
      return new Response(JSON.stringify({ error: 'Forbidden: Current user profile not found or access denied.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { companyId, moduleId, isEnabled, monthly_price, per_user_price } = await req.json();

    if (!companyId || !moduleId) {
      return new Response(JSON.stringify({ error: 'Missing companyId or moduleId.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authorization check
    if (currentProfile.role === 'super-admin') {
      // Super-admin can manage any company's modules
    } else if (currentProfile.role === 'admin') {
      // Admin can only manage modules for their own company
      if (!currentProfile.company_id || currentProfile.company_id !== companyId) {
        return new Response(JSON.stringify({ error: 'Forbidden: Admins can only manage modules for their own company.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions to assign company modules.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if the module is locked by the system and fetch existing prices if it exists
    const { data: existingCompanyModule, error: fetchModuleError } = await supabaseAdmin
      .from('company_modules')
      .select('is_locked_by_system, monthly_price, per_user_price') // Fetch prices too
      .eq('company_id', companyId)
      .eq('module_id', moduleId)
      .single();

    if (fetchModuleError && fetchModuleError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error fetching existing company module for lock check:', fetchModuleError);
      throw new Error('Error checking module lock status.');
    }

    const isLockedBySystem = existingCompanyModule?.is_locked_by_system ?? false;
    const existingMonthlyPrice = existingCompanyModule?.monthly_price;
    const existingPerUserPrice = existingCompanyModule?.per_user_price;

    if (isLockedBySystem && currentProfile.role !== 'super-admin') {
      if (!isEnabled) {
        return new Response(JSON.stringify({ error: 'Forbidden: This essential module cannot be disabled.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // If it's locked and enabled, ensure prices are not changed by non-super-admins
      // The UI should prevent this, but this is a backend safeguard.
      // We will use the existing prices for the upsert payload.
      if (isEnabled) { // If it's enabled (and locked)
        const upsertPayload: any = {
          company_id: companyId,
          module_id: moduleId,
          is_enabled: true, // Must remain enabled
          monthly_price: existingMonthlyPrice, // Use existing locked price
          per_user_price: existingPerUserPrice, // Use existing locked price
          is_locked_by_system: true, // Must remain locked
        };
        const { error } = await supabaseAdmin
          .from("company_modules")
          .upsert(upsertPayload, { onConflict: 'company_id, module_id' })
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ message: 'Company module assignment updated successfully (locked module prices retained)' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // If not locked, or if super-admin, proceed with the requested changes
    if (isEnabled) {
      const upsertPayload: any = {
        company_id: companyId,
        module_id: moduleId,
        is_enabled: true,
        monthly_price: monthly_price,
        per_user_price: per_user_price,
      };
      // If it was already locked, keep it locked unless super-admin explicitly unlocks (not in current UI)
      if (isLockedBySystem) {
        upsertPayload.is_locked_by_system = true;
      }

      const { error } = await supabaseAdmin
        .from("company_modules")
        .upsert(upsertPayload, { onConflict: 'company_id, module_id' })
        .select()
        .single();
      if (error) throw error;
    } else {
      // If disabling a non-locked module
      const { error } = await supabaseAdmin
        .from("company_modules")
        .delete()
        .eq("company_id", companyId)
        .eq("module_id", moduleId);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ message: 'Company module assignment updated successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in assign-company-module function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});