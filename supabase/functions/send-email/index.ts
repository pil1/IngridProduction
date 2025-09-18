// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import Mustache from 'https://esm.sh/mustache@4.2.0'; // Corrected import for Mustache
// @ts-ignore
import { Resend } from 'https://esm.sh/resend@1.1.0'; // Import Resend

declare const Deno: { env: { get: (key: string) => string | undefined } };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decryption utility function (matching the one in upsert-smtp-settings)
function decrypt(encryptedText: string | null | undefined): string | null {
  if (!encryptedText) {
    return null; // Return null if no text to decrypt
  }
  try {
    return atob(encryptedText); // Base64 decode
  } catch (e) {
    console.error(`ERROR: send-email - Decryption failed for text: "${encryptedText}". Error:`, e);
    return null; // Return null on failure
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('DEBUG: OPTIONS request received for send-email');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('DEBUG: send-email function invoked.');
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { template_name, recipient_email, template_variables, subject: directSubject, body: directBody } = await req.json();

    console.log(`DEBUG: send-email - Recipient: ${recipient_email}, Template Name: ${template_name || 'N/A'}, Direct Subject: ${directSubject || 'N/A'}`);

    if (!recipient_email) {
      console.error('ERROR: send-email - Recipient email is required.');
      return new Response(JSON.stringify({ error: 'Recipient email is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let finalSubject = directSubject;
    let finalBody = directBody;

    // Get PUBLIC_WEB_URL from environment variables
    // @ts-ignore
    const publicWebUrl = Deno.env.get('PUBLIC_WEB_URL') || 'http://localhost:8080'; // Fallback for local development
    console.log('DEBUG: send-email - PUBLIC_WEB_URL:', publicWebUrl);

    // 1. Fetch System Email Layout
    console.log('DEBUG: send-email - Fetching system email layout...');
    const { data: systemLayout, error: layoutError } = await supabaseAdmin
      .from('system_email_layouts')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000002') // Fixed ID for the singleton row
      .single();

    if (layoutError && layoutError.code !== 'PGRST116') {
      console.error('ERROR: send-email - Error fetching system email layout:', layoutError);
      // Continue without layout if there's an error, but log it
    }
    console.log('DEBUG: send-email - System email layout fetched:', systemLayout ? 'present' : 'not found');

    // Robust defaultLogoUrl construction using URL API
    let finalLogoUrl: string;
    try {
      const base = new URL(publicWebUrl);
      const storedLogoUrl = systemLayout?.default_logo_url;

      if (storedLogoUrl) {
        finalLogoUrl = new URL(storedLogoUrl, base).href;
      } else {
        finalLogoUrl = new URL('/infotrac-logo.png', base).href;
      }
    } catch (e: any) {
      console.error("ERROR: send-email - Error constructing finalLogoUrl for email send:", e);
      finalLogoUrl = `${publicWebUrl}/infotrac-logo.png`; // Fallback to simple concatenation
    }
    
    const defaultCompanyName = systemLayout?.default_company_name || 'INFOtrac';
    const defaultLogoWidth = systemLayout?.default_logo_width || null;
    const defaultLogoHeight = systemLayout?.default_logo_height || null;

    // Combine provided template variables with system-injected variables
    const combinedTemplateVariables = {
      ...template_variables,
      public_web_url: publicWebUrl, // Inject public web URL
      logo_url: finalLogoUrl, // Inject default logo URL
      logo_width: defaultLogoWidth, // Inject default logo width
      logo_height: defaultLogoHeight, // Inject default logo height
      company_name: defaultCompanyName, // Inject default company name
      year: new Date().getFullYear(), // Inject current year
    };
    console.log('DEBUG: send-email - Combined template variables prepared.');

    // If a template name is provided, fetch and render the template
    if (template_name) {
      console.log(`DEBUG: send-email - Fetching email template: "${template_name}"...`);
      const { data: emailTemplate, error: templateError } = await supabaseAdmin
        .from('email_templates')
        .select('*')
        .eq('name', template_name)
        .single();

      if (templateError || !emailTemplate) {
        console.error('ERROR: send-email - Error fetching email template:', templateError?.message || `Template "${template_name}" not found.`);
        throw new Error(`Email template "${template_name}" not found.`);
      }
      console.log(`DEBUG: send-email - Template "${template_name}" fetched.`);

      try { // Added try-catch for Mustache rendering
        finalSubject = Mustache.render(emailTemplate.subject, combinedTemplateVariables, {}, ['<%', '%>']);
        finalBody = Mustache.render(emailTemplate.body, combinedTemplateVariables, {}, ['<%', '%>']);
        console.log('DEBUG: send-email - Template rendered. Subject:', finalSubject);
      } catch (mustacheError: any) {
        console.error('ERROR: send-email - Mustache rendering failed:', mustacheError.message);
        throw new Error(`Failed to render email template: ${mustacheError.message}`);
      }
    } else if (!finalSubject || !finalBody) {
      // If no template and no direct subject/body, then it's an invalid request
      console.error('ERROR: send-email - Either a template_name or a direct subject and body are required, but neither was provided or rendered successfully.');
      return new Response(JSON.stringify({ error: 'Either a template_name or a direct subject and body are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('DEBUG: send-email - Final subject and body determined.');

    // 2. Wrap the finalBody with the system layout (if available)
    let emailHtml = finalBody;
    let renderedHeader = '';
    let renderedFooter = '';

    console.log('DEBUG: send-email - Rendering header...');
    if (systemLayout?.header_html) {
      renderedHeader = Mustache.render(systemLayout.header_html, combinedTemplateVariables, {}, ['<%', '%>']);
    } else {
      // Default header if no custom header HTML is provided, now also rendered with Mustache
      renderedHeader = Mustache.render(`
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8f8f8; padding: 20px 0; border-bottom: 1px solid #eeeeee;">
          <tr>
            <td align="center" valign="top">
              <table border="0" cellspacing="0" cellpadding="0" width="600" style="max-width: 600px;">
                <tr>
                  <td align="center" valign="top" style="padding: 0 20px;">
                    <a href="<% public_web_url %>" target="_blank" style="text-decoration: none;">
                      <img src="<% logo_url %>" alt="<% company_name %> Logo"
                           width="<% logo_width %>"
                           height="<% logo_height %>"
                           style="display: block; max-width: 100%; height: auto; border: 0; outline: none; text-decoration: none; margin: 0 auto; padding-bottom: 10px;"
                           onerror="this.onerror=null;this.src='<% public_web_url %>/infotrac-logo.png';"
                      >
                    </a>
                    <% #company_name %>
                    <p style="font-family: Arial, sans-serif; font-size: 18px; line-height: 24px; color: #2F424F; margin: 0; padding: 0;">
                      <strong><% company_name %></strong>
                    </p>
                    <% /company_name %>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `, combinedTemplateVariables, {}, ['<%', '%>']);
    }
    console.log('DEBUG: send-email - Header rendered.');

    console.log('DEBUG: send-email - Rendering footer...');
    if (systemLayout?.footer_html) {
      renderedFooter = Mustache.render(systemLayout.footer_html, combinedTemplateVariables, {}, ['<%', '%>']);
    } else {
      // Default footer if no custom footer HTML is provided, now also rendered with Mustache
      renderedFooter = Mustache.render(`
        <div style="text-align: center; padding: 20px; font-size: 0.8em; color: #777; border-top: 1px solid #eee; margin-top: 20px;">
          &copy; <% year %> <% company_name %>. All rights reserved. <br>
          <a href="<% public_web_url %>" style="color: #2F424F;">Visit our website</a>
        </div>
      `, combinedTemplateVariables, {}, ['<%', '%>']);
    }
    console.log('DEBUG: send-email - Footer rendered.');
    
    emailHtml = renderedHeader + finalBody + renderedFooter;
    console.log('DEBUG: send-email - Full email HTML assembled.');


    // 3. Fetch SMTP settings
    console.log('DEBUG: send-email - Fetching SMTP settings...');
    const { data: smtpSettings, error: smtpError } = await supabaseAdmin
      .from('smtp_settings')
      .select('*')
      .single();

    if (smtpError && smtpError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      console.error('ERROR: send-email - Error fetching SMTP settings:', smtpError);
      throw new Error(`Failed to fetch SMTP settings: ${smtpError.message}`); // Still throw if there's a real DB error
    }
    console.log('DEBUG: send-email - SMTP settings fetched:', smtpSettings ? 'present' : 'not found');
    
    // Decrypt API key from DB or get from environment
    let resendApiKey: string | null = null;
    if (smtpSettings?.email_api_key_encrypted) {
      resendApiKey = decrypt(smtpSettings.email_api_key_encrypted);
      console.log('DEBUG: send-email - Using Resend API key from DB settings.');
    } else {
      // @ts-ignore
      const envResendKey = Deno.env.get('RESEND_API_KEY');
      if (envResendKey && envResendKey.trim() !== '') {
        resendApiKey = envResendKey;
      }
      console.log('DEBUG: send-email - Using Resend API key from environment variable (if set).');
    }

    const senderEmail = smtpSettings?.sender_email || 'noreply@example.com'; // Fallback sender
    console.log('DEBUG: send-email - Sender Email:', senderEmail);
    console.log('DEBUG: send-email - Resend API Key status (null if not set/invalid):', resendApiKey ? 'Present' : 'Not Present');
    console.log('DEBUG: send-email - Email HTML length:', emailHtml.length);

    // --- NEW: Explicitly check for valid API key before sending ---
    if (resendApiKey && resendApiKey.trim() !== '') {
      console.log('DEBUG: send-email - Attempting to send email via Resend...');
      try {
        const resend = new Resend(resendApiKey);
        const { data, error: resendError } = await resend.emails.send({
          from: senderEmail,
          to: recipient_email,
          subject: finalSubject,
          html: emailHtml, // Use the layout-wrapped HTML
        });

        if (resendError) {
          console.error('ERROR: send-email - Resend API error:', resendError);
          throw new Error(`Failed to send email via Resend: ${resendError.message}`);
        }
        console.log('DEBUG: send-email - Email sent successfully via Resend:', data);
        return new Response(JSON.stringify({ message: 'Email sent successfully' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (resendClientError: any) {
        console.error('ERROR: send-email - Resend client or send operation failed:', resendClientError.message, resendClientError.stack);
        throw new Error(`Resend client error: ${resendClientError.message}`);
      }
    } else {
      console.warn('WARN: send-email - RESEND_API_KEY is not configured (or decryption failed/empty). Email is only logged (simulated send).');
      console.log(`--- SIMULATED EMAIL SEND ---`);
      console.log(`To: ${recipient_email}`);
      console.log(`From: ${senderEmail}`);
      console.log(`Subject: ${finalSubject}`);
      console.log(`Body (HTML): ${emailHtml}`); // Log the layout-wrapped HTML
      console.log(`----------------------------`);
      return new Response(JSON.stringify({ message: 'Email simulated successfully (RESEND_API_KEY not set)' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('FATAL ERROR: send-email - Unhandled exception:', (error as Error).message, (error as Error).stack);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});