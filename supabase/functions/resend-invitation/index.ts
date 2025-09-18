// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9.0.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('DEBUG: OPTIONS request received for resend-invitation');
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
      console.error('ERROR: resend-invitation - Unauthorized: No authenticated user.');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch inviter's profile to get their role and company_id
    const { data: inviterProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, company_id, full_name, email')
      .eq('user_id', user.id)
      .single();

    if (profileError || !inviterProfile) {
      console.error('ERROR: resend-invitation - Error fetching inviter profile:', profileError?.message || 'Profile not found.');
      return new Response(JSON.stringify({ error: 'Inviter profile not found or access denied.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { invitation_id } = await req.json();

    if (!invitation_id) {
      console.error('ERROR: resend-invitation - Missing invitation_id in request body.');
      return new Response(JSON.stringify({ error: 'Missing invitation_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the existing invitation
    const { data: existingInvitation, error: fetchError } = await supabaseClient
      .from('invitations')
      .select('*')
      .eq('id', invitation_id)
      .is('accepted_at', null) // Only resend pending invitations
      .single();

    if (fetchError || !existingInvitation) {
      console.error('ERROR: resend-invitation - Error fetching existing invitation or already accepted:', fetchError?.message || 'Invitation not found or already accepted.');
      return new Response(JSON.stringify({ error: 'Invitation not found or already accepted.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authorization check:
    // Super-admins can resend any invitation.
    // Admins can only resend invitations for their own company.
    if (inviterProfile.role !== 'super-admin') {
      if (!inviterProfile.company_id || inviterProfile.company_id !== existingInvitation.company_id) {
        console.error('ERROR: resend-invitation - Forbidden: User cannot resend invitation for another company.');
        return new Response(JSON.stringify({ error: 'Forbidden: You can only resend invitations for your own company.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Generate a new token and update expiration
    const newToken = uuidv4();
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7); // New token valid for 7 days

    const { error: updateError } = await supabaseClient
      .from('invitations')
      .update({
        token: newToken,
        expires_at: newExpiresAt.toISOString(),
        // Removed: updated_at: new Date().toISOString(), // This will now be handled by the database trigger
      })
      .eq('id', invitation_id);

    if (updateError) {
      console.error('ERROR: resend-invitation - Error updating invitation with new token:', updateError.message);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Construct the new invitation link
    // @ts-ignore
    const invitationLink = `${Deno.env.get('PUBLIC_WEB_URL')}/accept-invite?token=${newToken}`;
    console.log('DEBUG: resend-invitation - Generated new invitation link:', invitationLink);

    // Fetch company name for email template
    let companyName = "Your Company";
    if (existingInvitation.company_id) {
      const { data: companyData, error: companyError } = await supabaseClient
        .from('companies')
        .select('name')
        .eq('id', existingInvitation.company_id)
        .single();
      if (companyError) console.error('ERROR: resend-invitation - Error fetching company name for invitation email:', companyError.message);
      if (companyData) companyName = companyData.name;
    }

    console.log('DEBUG: resend-invitation - Invoking send-email...');
    // Send email using the send-email edge function
    await supabaseClient.functions.invoke('send-email', {
      body: {
        template_name: 'user_invitation',
        recipient_email: existingInvitation.email,
        template_variables: {
          inviter_name: inviterProfile.full_name || inviterProfile.email,
          company_name: companyName,
          invitation_link: invitationLink,
          invited_role: existingInvitation.role,
          year: new Date().getFullYear(),
        },
      },
    });
    console.log('DEBUG: resend-invitation - send-email invocation completed.');

    return new Response(JSON.stringify({ message: 'Invitation resent successfully', invitationLink }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('FATAL ERROR: resend-invitation - Unhandled exception:', (error as Error).message, (error as Error).stack);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});