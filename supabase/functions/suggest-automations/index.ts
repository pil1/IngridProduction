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
    console.log('DEBUG: OPTIONS request received for suggest-automations');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyId } = await req.json();
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

    // Gather context about the company
    const { data: categories, error: categoriesError } = await supabaseAdmin
      .from("expense_categories")
      .select("name")
      .eq("company_id", companyId);

    if (categoriesError) throw categoriesError;

    // Fetch existing automations to provide context to the AI
    const { data: existingAutomations, error: automationsError } = await supabaseAdmin
      .from("automations")
      .select("name, description")
      .eq("company_id", companyId);

    if (automationsError) throw automationsError;

    const categoryNames = categories.map((c: { name: string }) => c.name).join(", ");
    const existingAutomationsContext = existingAutomations.map((a: { name: string, description: string }) => `Name: ${a.name}, Description: ${a.description}`).join("\n");

    const systemPrompt = `
      You are an expert business process consultant. Your task is to suggest 3 to 4 helpful email automations for a company based on their data.
      The available event triggers are: 'expense.submitted', 'expense.approved', 'expense.rejected', 'expense.commented'.
      The only available action is 'send_email'.
      The company already has the automations listed below. Do not suggest these or very similar ones again.
      For each new suggestion, provide a 'name', a 'trigger_type', and a 'description'.
      The name should be a concise, user-friendly title for the automation.
      The description should explain what the automation does in one sentence.
      Return a single JSON object with a key named "suggestions" which contains an array of the suggestion objects. Do not include any other text or explanation.
    `;

    const userPrompt = `
      Company's expense categories: ${categoryNames || "None specified"}.
      Existing automations to avoid suggesting again:
      ${existingAutomationsContext || "None"}

      Please provide new, unique automation suggestions in the specified JSON format.
    `;

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
    console.log("Parsed Suggestions:", suggestions);

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in suggest-automations function:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});