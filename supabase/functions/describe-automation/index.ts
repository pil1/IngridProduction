// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define available triggers, actions, and report types for the AI's context
const AVAILABLE_TRIGGER_TYPES = [
  { value: 'expense.submitted', label: 'Expense Submitted' },
  { value: 'expense.approved', label: 'Expense Approved' },
  { value: 'expense.rejected', label: 'Expense Rejected' },
  { value: 'expense.commented', label: 'Expense Commented' },
  { value: 'schedule.daily', label: 'Daily Schedule' },
  { value: 'schedule.weekly', label: 'Weekly Schedule' },
  { value: 'schedule.monthly', label: 'Monthly Schedule' },
];

const AVAILABLE_ACTION_TYPES = [
  { value: 'send_email', label: 'Send an Email' },
  { value: 'generate_report', label: 'Generate a Report' },
];

const AVAILABLE_REPORT_TYPES = [
  { value: 'order_summary', label: 'Order Summary' },
  { value: 'ar_aging', label: 'AR Aging' },
  { value: 'ap_aging', label: 'AP Aging' },
];

const AVAILABLE_RECIPIENT_TYPES = [
  { value: 'user', label: 'The user who triggered the event' },
  { value: 'admin', label: 'All company admins' },
  { value: 'submitter', label: 'The original submitter of the expense' },
  { value: 'specific_email', label: 'A specific email address' },
];

// Define an interface for the company email template objects
interface CompanyEmailTemplate {
  id: string;
  name: string;
  subject: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('DEBUG: OPTIONS request received for describe-automation');
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
      return new Response(JSON.stringify({ error: 'Forbidden: Only Admins, Controllers, or Super Admins can generate automations.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { companyId, userDescription } = await req.json();

    if (!companyId || !userDescription) {
      return new Response(JSON.stringify({ error: 'Missing companyId or userDescription.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch company-specific email templates for AI context
    const { data: companyEmailTemplates, error: templatesError } = await supabaseAdmin
      .from('company_email_templates')
      .select('id, name, subject')
      .eq('company_id', companyId);

    if (templatesError) {
      console.error('Error fetching company email templates:', templatesError);
      // Continue without templates if there's an error, AI can still suggest other actions
    }

    const templateContext = companyEmailTemplates ? companyEmailTemplates.map((t: CompanyEmailTemplate) => `ID: ${t.id}, Name: ${t.name}, Subject: ${t.subject}`).join('\n') : 'None available.';

    // @ts-ignore
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAIApiKey) {
      throw new Error("OpenAI API key is not configured.");
    }

    const systemPrompt = `
      You are an AI assistant that helps users create automations for a business application.
      Your task is to parse a user's natural language description and convert it into a structured JSON object representing an automation.
      
      Here are the available triggers, actions, and report types:
      - Triggers: ${JSON.stringify(AVAILABLE_TRIGGER_TYPES)}
      - Actions: ${JSON.stringify(AVAILABLE_ACTION_TYPES)}
      - Report Types: ${JSON.stringify(AVAILABLE_REPORT_TYPES)}
      - Recipient Types: ${JSON.stringify(AVAILABLE_RECIPIENT_TYPES)}
      - Company Email Templates (for 'send_email' action):
        ${templateContext}

      The output JSON should have the following structure, matching the AutomationFormValues type:
      {
        "name": "string",
        "description": "string (optional)",
        "trigger_type": "string (from AVAILABLE_TRIGGER_TYPES.value)",
        "action_type": "string (from AVAILABLE_ACTION_TYPES.value)",
        "action_template_id": "string (required if action_type is 'send_email', must be an ID from Company Email Templates)",
        "action_recipient": "string (from AVAILABLE_RECIPIENT_TYPES.value)",
        "specific_email_recipient": "string (required if action_recipient is 'specific_email', must be a valid email)",
        "report_type": "string (required if action_type is 'generate_report', from AVAILABLE_REPORT_TYPES.value)",
        "report_format": "string ('PDF' or 'CSV', default 'PDF' if generate_report)",
        "channels": "array of strings (e.g., ['in_app', 'email'], default ['in_app', 'email'])",
        "is_active": "boolean (default true)",
        "schedule_time": "string (HH:MM format, required for schedule.daily/weekly/monthly)",
        "schedule_day_of_week": "string (e.g., 'Monday', required for schedule.weekly)",
        "schedule_day_of_month": "number (1-31, required for schedule.monthly)",
        "warning": "string (optional, if the request is partially fulfilled or has limitations)",
        "message": "string (optional, a friendly message to the user)"
      }

      Constraints:
      1. If the user asks for something not directly supported by the available triggers/actions/report types, provide a helpful 'message' explaining the limitation and suggest what *can* be done. Do NOT generate an automation object if it's completely out of scope.
      2. For 'generate_report' actions, if a specific customer is mentioned (e.g., "Customer XYZ"), state in the 'warning' that "Specific customer filtering for AR/AP reports is not yet supported. This automation will generate a general [report_type] report."
      3. Always try to infer a reasonable 'name' and 'description' for the automation.
      4. For 'send_email' actions, if a template name is mentioned, try to match it to an 'action_template_id' from the provided Company Email Templates. If no specific template is mentioned, suggest a generic one if available (e.g., 'generic_report_email' for reports, or 'expense_approved_notification' for expense approvals).
      5. Default 'channels' to ['in_app', 'email'] if not specified.
      6. For scheduled triggers, infer 'schedule_time', 'schedule_day_of_week', 'schedule_day_of_month' if mentioned. Default 'schedule_time' to '09:00' if not specified for scheduled triggers.
      7. Ensure 'is_active' defaults to true.
      8. The output MUST be a single JSON object.
    `;

    const userPrompt = `User's automation request: "${userDescription}"`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAIApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Raw OpenAI Response:", data.choices[0].message.content);
    
    const aiOutput = JSON.parse(data.choices[0].message.content);

    // Basic validation to ensure it's an automation object or a message
    if (aiOutput.automation || aiOutput.message) {
      return aiOutput;
    } else {
      // Fallback if AI doesn't return expected structure
      return { message: "AI could not generate a suitable automation. Please try a different description.", automation: null };
    }

  } catch (error) {
    console.error('Error in describe-automation function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});