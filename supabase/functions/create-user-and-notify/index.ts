declare const Deno: any; // Declare Deno global object for TypeScript

// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9.0.1';
// Removed: import { jwtDecode } from 'https://esm.sh/jwt-decode@4.0.0'; // Removed jwt-decode

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('DEBUG: OPTIONS request received for invite-user');
    return new Response(null, { headers: corsHeaders });
  }

  try { // TOP-LEVEL TRY BLOCK ADDED
    console.log('DEBUG: invite-user function invoked.');
    const authHeader = req.headers.get('Authorization');
    console.log('DEBUG: Authorization header received:', authHeader ? authHeader.substring(0, Math.min(authHeader.length, 50)) + '...' : 'Missing');

    // Use currentUser from supabaseClient.auth.getUser() directly
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
    if (!currentUser) {
      console.error('ERROR: invite-user - Unauthorized: No authenticated user found by supabaseClient.auth.getUser().');
      return new Response(JSON.stringify({ error: 'Unauthorized: No authenticated user.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const currentUserId = currentUser.id; // Use this

    // Initialize supabaseAdmin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch inviter's profile to get their role and company_id
    // This implicitly verifies that a user with currentUserId exists and has a profile.
    const { data: inviterProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, company_id, full_name, email')
      .eq('user_id', currentUserId) // Use currentUserId from decoded token
      .single();

    if (profileError || !inviterProfile) {
      console.error('ERROR: invite-user - Error fetching inviter profile with supabaseAdmin:', profileError?.message || 'Profile not found.');
      return new Response(JSON.stringify({ error: 'Forbidden: Inviter profile not found or access denied.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, role, company_id: invited_company_id_from_client, first_name, last_name, selectedTemplateName } = await req.json();

    console.log(`DEBUG: invite-user - Request payload: email=${email}, role=${role}, company_id_from_client=${invited_company_id_from_client}, first_name=${first_name}, last_name=${last_name}, selectedTemplateName=${selectedTemplateName}`);


    if (!email || !role) {
      console.error('ERROR: invite-user - Missing email or role in request body.');
      return new Response(JSON.stringify({ error: 'Missing email or role.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let targetCompanyId = invited_company_id_from_client;

    // If inviter is not a super-admin, they can only invite to their own company
    if (inviterProfile.role !== 'super-admin') {
      if (!inviterProfile.company_id) {
        console.error('ERROR: invite-user - Inviter is not associated with a company.');
        return new Response(JSON.stringify({ error: 'Forbidden: Inviter is not associated with a company.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      targetCompanyId = inviterProfile.company_id;
      // Ensure admin cannot invite super-admin
      if (role === 'super-admin') {
        return new Response(JSON.stringify({ error: 'Forbidden: Admins cannot invite Super Admin users.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // If the invited role is 'super-admin', force company_id to null
    if (role === 'super-admin') {
      targetCompanyId = null;
    }

    // --- Direct User Creation (as currently implemented) ---
    console.log(`DEBUG: invite-user - Attempting to create user directly via admin API for email: ${email}`);
    const userMetadata = {
      first_name: first_name || null,
      last_name: last_name || null,
      role: role,
      company_id: targetCompanyId,
    };
    console.log('DEBUG: invite-user - user_metadata payload for createUser:', JSON.stringify(userMetadata));

    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: uuidv4(), // Generate a random password as it's not an invite flow
      email_confirm: true, // Automatically confirm email
      user_metadata: userMetadata,
    });

    if (authError) {
      console.error('ERROR: invite-user - Error creating auth user:', authError);
      if (authError.message.includes('User already registered')) {
        return new Response(JSON.stringify({ error: 'A user with this email already exists.' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`DEBUG: invite-user - User created successfully: ${newUser.user?.id}`);

    // --- Send email notification to company admins (if applicable) ---
    if (targetCompanyId) {
      const { data: companyAdmins, error: adminsError } = await supabaseAdmin
        .from('profiles')
        .select('email, first_name, full_name')
        .eq('company_id', targetCompanyId)
        .eq('role', 'admin');

      if (adminsError) {
        console.error('ERROR: invite-user - Error fetching company admins for email notification:', adminsError);
      } else if (companyAdmins && companyAdmins.length > 0) {
        const companyNameResult = await supabaseAdmin.from('companies').select('name').eq('id', targetCompanyId).single();
        const companyName = companyNameResult.data?.name || 'Your Company';

        for (const admin of companyAdmins) {
          try {
            await supabaseAdmin.functions.invoke('send-email', {
              body: {
                template_name: selectedTemplateName || 'new_user_created', // Use selected template or default
                recipient_email: admin.email,
                template_variables: {
                  admin_name: admin.first_name || admin.full_name || admin.email,
                  new_user_name: `${first_name} ${last_name}`,
                  new_user_email: email,
                  company_name: companyName,
                  // @ts-ignore
                  login_link: `${Deno.env.get('PUBLIC_WEB_URL')}/login`,
                  year: new Date().getFullYear(),
                },
              },
            });
          } catch (adminEmailError: any) {
            console.error(`ERROR: invite-user - Failed to send new user notification email to admin ${admin.email}:`, adminEmailError.message);
          }
        }
      }
    }
    // --- End email notification ---

    return new Response(JSON.stringify({ message: 'User created successfully and notification sent (if applicable).', userId: newUser.user?.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('FATAL ERROR: invite-user - Unhandled exception:', (error as Error).message, (error as Error).stack);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});