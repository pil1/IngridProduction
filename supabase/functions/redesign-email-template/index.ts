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
    console.log('DEBUG: OPTIONS request received for redesign-email-template');
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

    if (profileError || !currentProfile || !['admin', 'super-admin'].includes(currentProfile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: Only Admins or Super Admins can redesign email templates.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { templateId, currentSubject, currentBody, userInstructions, isSystemTemplate, companyId } = await req.json();

    if (!templateId || !currentSubject || !currentBody) {
      return new Response(JSON.stringify({ error: 'Missing templateId, currentSubject, or currentBody.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authorization check for company-specific templates
    if (!isSystemTemplate && companyId && currentProfile.role === 'admin' && currentProfile.company_id !== companyId) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admins can only redesign templates for their own company.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // @ts-ignore
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAIApiKey) {
      throw new Error("OpenAI API key is not configured.");
    }

    // Fetch System Email Layout for AI context
    const { data: systemLayout, error: layoutError } = await supabaseAdmin
      .from('system_email_layouts')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000002') // Fixed ID for the singleton row
      .single();

    if (layoutError && layoutError.code !== 'PGRST116') {
      console.error('Error fetching system email layout:', layoutError);
    }

    // Fetch company name if it's a company template
    let companyName = systemLayout?.default_company_name || 'INFOtrac';
    if (!isSystemTemplate && companyId) {
      const { data: fetchedCompany, error: companyNameError } = await supabaseAdmin
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();
      if (companyNameError) console.error('Error fetching company name:', companyNameError);
      if (fetchedCompany) companyName = fetchedCompany.name;
    }

    const layoutContext = systemLayout ? `
      The system has a global email layout.
      Default Company Name: ${companyName}
      Default Logo URL: ${systemLayout.default_logo_url || '/infotrac-logo.png'}
      Default Logo Width: ${systemLayout.default_logo_width || 'auto'}px
      Default Logo Height: ${systemLayout.default_logo_height || 'auto'}px
      Custom Header HTML: ${systemLayout.header_html ? 'Yes' : 'No'}
      Custom Footer HTML: ${systemLayout.footer_html ? 'Yes' : 'No'}

      When generating the 'body' for templates, assume this header and footer will be wrapped around it.
      Therefore, focus only on the main content of the email. Do NOT include <html>, <head>, <body>, or any header/footer elements in the 'body' field.
      The logo and company name will be handled by the global layout.
    ` : `No global email layout is configured. Assume templates should be self-contained HTML.`;

    const systemPrompt = `
      You are an expert copywriter specializing in corporate communications. Your task is to redesign an existing email template based on user instructions.
      You will be provided with the current subject, current body (HTML), and specific instructions for redesign.
      
      Your output should be a JSON object containing the 'subject' and 'body' of the redesigned email.
      - The 'subject' should be a clear and professional email subject line.
      - The 'body' should be the HTML content of the email. Use modern, responsive HTML practices (e.g., inline styles for critical elements, tables for layout, max-width for images).
      - Use placeholders like <% inviter_name %>, <% company_name %>, <% invitation_link %>, <% invited_role %>, <% new_user_name %>, <% new_user_email %>, <% admin_name %>, <% target_user_name %>, <% target_user_email %>, <% new_status %>, <% users_link %>, <% module_name %>, <% access_status %>, <% modules_link %>, <% public_web_url %>, <% year %>, <% expense_title %>, <% expense_amount %>, <% expense_status %>, <% expense_link %>, <% report_subject %>, <% report_content %> for dynamic content.
      - Ensure the HTML is clean and readable.

      ${layoutContext}

      Return only the JSON object. Do not include any other text or explanation.
    `;

    const userPrompt = `
      Current Subject: "${currentSubject}"
      Current Body (HTML):
      ${currentBody}

      Redesign Instructions: "${userInstructions || "Improve the clarity and professionalism."}"
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAIApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o", // Using a more capable model for better HTML generation
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7, // Allow some creativity for redesign
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Raw OpenAI Redesign Response:", data.choices[0].message.content);
    
    const redesignedTemplate = JSON.parse(data.choices[0].message.content);

    if (!redesignedTemplate.subject || !redesignedTemplate.body) {
      throw new Error("AI did not return a valid subject and body for the redesign.");
    }

    return new Response(JSON.stringify({ redesignedTemplate }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('Error in redesign-email-template function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});