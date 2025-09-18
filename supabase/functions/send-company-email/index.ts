// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import { render } from 'https://esm.sh/mustache@4.2.0'; // For template rendering
// @ts-ignore
import { Resend } from 'https://esm.sh/resend@1.1.0'; // Import Resend

declare const Deno: { env: { get: (key: string) => string | undefined } };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decryption utility function (matching the one in upsert-smtp-settings)
function decrypt(encryptedText: string): string {
  try {
    return atob(encryptedText); // Base64 decode
  } catch (e) {
    console.error("Decryption failed:", e);
    return ""; // Return empty string on failure
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('DEBUG: OPTIONS request received for send-company-email');
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

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: profile } = await supabaseAdmin.from('profiles').select('role, company_id').eq('user_id', user.id).single();
    if (!profile || !['admin', 'super-admin'].includes(profile.role)) {
      throw new Error('Forbidden: Insufficient permissions.');
    }

    const { company_id, recipient_email, subject, body, template_name, template_variables } = await req.json();

    if (!company_id || !recipient_email) {
      return new Response(JSON.stringify({ error: 'Missing company_id or recipient_email.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authorization check: Admins can only send emails for their own company
    if (profile.role === 'admin' && company_id !== profile.company_id) {
      throw new Error("Forbidden: Admins can only send emails for their own company.");
    }

    let finalSubject = subject;
    let finalBody = body;

    // 1. Fetch Company SMTP settings
    const { data: companySmtpSettings, error: companySmtpError } = await supabaseAdmin
      .from('company_smtp_settings')
      .select('*')
      .eq('company_id', company_id)
      .single();

    if (companySmtpError && companySmtpError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error fetching company SMTP settings:', companySmtpError);
      throw new Error('Error fetching company email settings.');
    }

    // 2. If template_name is provided, fetch and render template
    if (template_name) {
      const { data: emailTemplate, error: templateError } = await supabaseAdmin
        .from('company_email_templates')
        .select('*')
        .eq('company_id', company_id)
        .eq('name', template_name)
        .single();

      if (templateError || !emailTemplate) {
        console.error('Error fetching company email template:', templateError);
        throw new Error(`Email template "${template_name}" not found for this company.`);
      }

      // Render template with variables using custom delimiters
      finalSubject = render(emailTemplate.subject, template_variables, {}, ['<%', '%>']);
      finalBody = render(emailTemplate.body, template_variables, {}, ['<%', '%>']);
    }

    // Determine which API key to use: company-specific or system-wide
    let resendApiKey: string | undefined;
    let senderEmail: string;

    if (companySmtpSettings?.email_api_key_encrypted) {
      resendApiKey = decrypt(companySmtpSettings.email_api_key_encrypted);
      senderEmail = companySmtpSettings.sender_email;
    } else {
      // Fallback to system-wide settings if company-specific API key is not set
      const { data: systemSmtpSettings, error: systemSmtpError } = await supabaseAdmin
        .from('smtp_settings')
        .select('*')
        .single();

      if (systemSmtpError && systemSmtpError.code !== 'PGRST116') {
        console.error('Error fetching system SMTP settings for fallback:', systemSmtpError);
      }

      if (systemSmtpSettings?.email_api_key_encrypted) {
        resendApiKey = decrypt(systemSmtpSettings.email_api_key_encrypted);
        senderEmail = systemSmtpSettings.sender_email;
      } else {
        resendApiKey = Deno.env.get('RESEND_API_KEY'); // Fallback to global env var
        senderEmail = 'noreply@example.com'; // Final fallback
      }
    }

    // 3. Send Email using Resend or log if no API key
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const { data, error: resendError } = await resend.emails.send({
        from: senderEmail,
        to: recipient_email,
        subject: finalSubject,
        html: finalBody,
      });

      if (resendError) {
        console.error('Resend API error:', resendError);
        throw new Error(`Failed to send email via Resend: ${resendError.message}`);
      }
      console.log('Email sent successfully via Resend:', data);
      return new Response(JSON.stringify({ message: 'Email sent successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.warn('No Resend API key configured (company-specific or system-wide). Email is only logged.');
      console.log(`--- SIMULATED EMAIL SEND ---`);
      console.log(`To: ${recipient_email}`);
      console.log(`From: ${senderEmail}`);
      console.log(`Subject: ${finalSubject}`);
      console.log(`Body (HTML): ${finalBody}`);
      console.log(`----------------------------`);
      return new Response(JSON.stringify({ message: 'Email simulated successfully (no API key set)' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in send-company-email function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});