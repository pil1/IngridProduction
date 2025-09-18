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
    console.log('DEBUG: OPTIONS request received for upsert-system-email-layout');
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
      throw new Error('Forbidden: Only Super Admins can manage system email layout.');
    }

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('system_email_layouts')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000002') // Fixed ID for the singleton row
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 means "no rows found"

      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (req.method === 'POST') {
      const { header_html, footer_html, default_logo_url, default_company_name, default_logo_width, default_logo_height } = await req.json();

      const updatePayload = {
        id: '00000000-0000-0000-0000-000000000002', // Fixed ID for the singleton row
        header_html: header_html || null,
        footer_html: footer_html || null,
        default_logo_url: default_logo_url || null,
        default_company_name: default_company_name || null,
        default_logo_width: default_logo_width || null,
        default_logo_height: default_logo_height || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from('system_email_layouts')
        .upsert(updatePayload, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ message: 'System email layout saved successfully', data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in upsert-system-email-layout function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});