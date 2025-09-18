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
    console.log('DEBUG: OPTIONS request received for suggest-system-email-templates');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // @ts-ignore
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAIApiKey) {
      throw new Error("OpenAI API key is not configured.");
    }

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
      .select('role')
      .eq('user_id', currentUser.id)
      .single();

    if (profileError || currentProfile?.role !== 'super-admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Only Super Admins can generate system template suggestions.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { systemLayout } = await req.json(); // Receive systemLayout from frontend

    // Fetch existing system templates to provide context to the AI
    const { data: existingTemplates, error: templatesError } = await supabaseAdmin
      .from("email_templates")
      .select("name, subject");

    if (templatesError) throw templatesError;

    const existingTemplatesContext = existingTemplates.map((t: { name: string, subject: string }) => `Name: ${t.name}, Subject: ${t.subject}`).join("\n");

    // Prepare layout context for the AI
    const layoutContext = systemLayout ? `
      The system has a global email layout.
      Default Company Name: ${systemLayout.default_company_name || 'INFOtrac'}
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
      You are an expert copywriter specializing in corporate communications. Your task is to generate 3-4 professional email templates for a system's automated notifications.
      The available automation triggers are: 'user_invitation', 'new_user_created', 'user_status_updated', 'user_module_access_updated', 'expense.submitted', 'expense.approved', 'expense.rejected', 'expense.commented', 'generate_report'.
      The system already has the email templates listed below. Do not suggest these or very similar ones again.
      For each new template, provide a 'name', a 'subject', and a 'body'.
      - The 'name' should be a concise, user-friendly title for the template (e.g., "User Invitation Email").
      - The 'subject' should be a clear and professional email subject line.
      - The 'body' should be the HTML content of the email. Use modern, responsive HTML practices (e.g., inline styles for critical elements, tables for layout, max-width for images).
      - Use placeholders like <% inviter_name %>, <% company_name %>, <% invitation_link %>, <% invited_role %>, <% new_user_name %>, <% new_user_email %>, <% admin_name %>, <% target_user_name %>, <% target_user_email %>, <% new_status %>, <% users_link %>, <% module_name %>, <% access_status %>, <% modules_link %>, <% public_web_url %>, <% year %>, <% expense_title %>, <% expense_amount %>, <% expense_status %>, <% expense_link %>, <% report_subject %>, <% report_content %> for dynamic content.
      - Ensure the HTML is clean and readable.

      ${layoutContext}

      Return a single JSON object with a key named "suggestions" which contains an array of the template objects. Do NOT include any other text or explanation.
    `;

    const userPrompt = `
      Existing system email templates to avoid suggesting again:
      ${existingTemplatesContext || "None"}

      Please provide new, unique system email template suggestions in the specified JSON format.
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Raw OpenAI Response:", data.choices[0].message.content);
    
    const suggestions = JSON.parse(data.choices[0].message.content);

    // Ensure suggestions is an object with a 'suggestions' key, then extract the array
    const finalSuggestions = suggestions.suggestions && Array.isArray(suggestions.suggestions)
      ? suggestions.suggestions
      : [];

    return new Response(JSON.stringify({ suggestions: finalSuggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in suggest-system-email-templates function:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});