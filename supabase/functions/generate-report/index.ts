// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import Mustache from 'https://esm.sh/mustache@4.2.0'; // Corrected import for Mustache

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define an interface for the admin profile data returned by Supabase
interface AdminProfile {
  email: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('DEBUG: OPTIONS request received for generate-report');
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

    if (profileError || !currentProfile || !['admin', 'controller', 'super-admin'].includes(currentProfile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: Only Admins, Controllers, or Super Admins can generate reports.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { company_id, report_type, report_format, recipient, specific_email_recipient } = await req.json();

    if (!company_id || !report_type || !recipient) {
      return new Response(JSON.stringify({ error: 'Missing company_id, report_type, or recipient.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Placeholder for actual report generation logic
    let reportContent = `This is a placeholder report for ${report_type} in ${report_format} format for company ${company_id}.`;
    let reportSubject = `INFOtrac Report: ${report_type} for Company ${company_id}`;

    // In a real scenario, you would fetch data from your database (e.g., AR, AP, Sales)
    // and then use a library to generate the report in the specified format (PDF, CSV).
    // For now, we'll just simulate the content.

    let targetEmails: string[] = [];

    if (recipient === 'user') {
      targetEmails.push(currentUser.email!);
    } else if (recipient === 'admin') {
      const { data: admins, error: adminsError } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('company_id', company_id)
        .eq('role', 'admin');
      if (adminsError) console.error('Error fetching admins for report:', adminsError);
      // Explicitly type 'a' as AdminProfile
      if (admins) targetEmails = targetEmails.concat(admins.map((a: AdminProfile) => a.email));
    } else if (recipient === 'specific_email' && specific_email_recipient) {
      targetEmails.push(specific_email_recipient);
    }

    if (targetEmails.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid recipients found for the report.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send the report via email (using the existing send-email edge function)
    for (const email of targetEmails) {
      await supabaseAdmin.functions.invoke('send-email', {
        body: {
          template_name: 'generic_report_email', // A new generic template might be needed
          recipient_email: email,
          template_variables: {
            report_subject: reportSubject,
            report_content: reportContent, // For now, embed content directly
            company_name: "Your Company", // Placeholder
            year: new Date().getFullYear(),
          },
        },
      });
    }

    return new Response(JSON.stringify({ message: `Report "${report_type}" generated and sent to ${targetEmails.join(', ')}.` }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-report function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});