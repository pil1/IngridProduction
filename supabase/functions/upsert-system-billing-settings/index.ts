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
    console.log('DEBUG: OPTIONS request received for upsert-system-billing-settings');
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
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
    if (!currentUser) throw new Error('Unauthorized');

    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('user_id', currentUser.id).single();
    if (!profile || profile.role !== 'super-admin') {
      throw new Error('Forbidden: Only Super Admins can manage system billing settings.');
    }

    const { billing_currency_code } = await req.json();

    if (!billing_currency_code) {
      return new Response(JSON.stringify({ error: 'Billing currency code is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updatePayload = {
      id: '00000000-0000-0000-0000-000000000000', // Fixed ID for the singleton row
      billing_currency_code: billing_currency_code,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('system_billing_settings')
      .upsert(updatePayload, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ message: 'System billing settings saved successfully', data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});