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
    console.log('DEBUG: OPTIONS request received for delete-invitation');
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch deleter's profile to get their role and company_id
    const { data: deleterProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, company_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !deleterProfile) {
      console.error('Error fetching deleter profile:', profileError);
      return new Response(JSON.stringify({ error: 'Deleter profile not found or access denied.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { invitation_id } = await req.json();

    if (!invitation_id) {
      return new Response(JSON.stringify({ error: 'Missing invitation_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the existing invitation to check its company_id
    const { data: existingInvitation, error: fetchError } = await supabaseClient
      .from('invitations')
      .select('company_id, accepted_at')
      .eq('id', invitation_id)
      .single();

    if (fetchError || !existingInvitation) {
      console.error('Error fetching existing invitation:', fetchError);
      return new Response(JSON.stringify({ error: 'Invitation not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existingInvitation.accepted_at) {
      return new Response(JSON.stringify({ error: 'Cannot delete an invitation that has already been accepted.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authorization check:
    // Super-admins can delete any invitation.
    // Admins can only delete invitations for their own company.
    if (deleterProfile.role !== 'super-admin') {
      if (!deleterProfile.company_id || deleterProfile.company_id !== existingInvitation.company_id) {
        return new Response(JSON.stringify({ error: 'Forbidden: You can only delete invitations for your own company.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Delete the invitation
    const { error: deleteError } = await supabaseClient
      .from('invitations')
      .delete()
      .eq('id', invitation_id);

    if (deleteError) {
      console.error('Error deleting invitation:', deleteError);
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message: 'Invitation deleted successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in delete-invitation function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});