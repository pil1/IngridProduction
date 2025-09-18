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
    console.log('DEBUG: OPTIONS request received for smart-add-analysis');
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
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions to use Smart Add.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_input, entity_type } = await req.json();

    if (!user_input || !entity_type) {
      return new Response(JSON.stringify({ error: 'Missing user_input or entity_type.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // @ts-ignore
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY"); // Declared here

    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured. Please set OPENAI_API_KEY in Supabase secrets.");
    }

    const commonFields = `
      name: string (company/vendor/customer name, required)
      contact_person: string (optional, e.g., "John Doe", "Sales Manager")
      email: string (optional, valid email format, e.g., "info@example.com")
      phone: string (optional, e.g., "+1-555-123-4567", "555-123-4567")
      website: string (optional, valid URL format, e.g., "https://www.example.com")
      tax_id: string (optional, e.g., "EIN-123456789", "VAT-GB123456789")
      payment_terms: string (optional, e.g., "Net 30", "Due on Receipt")
      default_currency_code: string (3-letter ISO 4217 code, e.g., USD, CAD, EUR, default to USD if not specified)
      notes: string (optional, any additional relevant information)
      address_line_1: string (optional, e.g., "123 Main St")
      address_line_2: string (optional, e.g., "Suite 100")
      city: string (optional, e.g., "Anytown")
      state_province: string (optional, e.g., "CA", "California")
      postal_code: string (optional, e.g., "90210", "V6B 1T7")
      country: string (optional, e.g., "USA", "Canada")
    `;

    const customerSpecificFields = `
      spire_customer_id: string (optional, Spire's customerNo)
      account_number: string (optional, Spire's code)
      code: string (optional, Spire's code, same as account_number)
      receivable_account: string (optional)
      upload_flag: boolean (optional, default true)
      discount_code: string (optional)
      credit_type: number (optional, integer)
      on_hold: boolean (optional, default false)
      reference_code: string (optional)
      apply_finance_charges: boolean (optional, default false)
      user_def_1: string (optional)
      background_color_int: number (optional, integer)
      default_ship_to_code: string (optional)
      foreground_color_int: number (optional, integer)
      user_def_2: string (optional)
      udf_data: object (optional, JSON object)
      statement_type: string (optional)
      payment_provider_id_int: number (optional, integer)
      special_code: string (optional)
      spire_status: string (optional)
      shipping_address_line_1: string (optional)
      shipping_address_line_2: string (optional)
      shipping_city: string (optional)
      shipping_state_province: string (optional)
      shipping_postal_code: string (optional)
      shipping_country: string (optional)
    `;

    const vendorSpecificFields = `
      spire_id: string (optional, Spire's vendorNo)
      account_number: string (optional)
      tax_exempt: boolean (optional, default false)
      credit_limit: number (optional, positive number)
      payment_method: string (optional)
      shipping_addresses_data: array of objects (optional, JSON array of shipping addresses)
    `;

    const systemPrompt = `
      You are an AI assistant specialized in extracting structured company/contact information from unstructured text.
      The user will provide details about a ${entity_type} (customer or vendor) in plain text.
      Your task is to extract *as much relevant information as possible* from the input and format it into a JSON object.
      Be thorough and try to infer values for all applicable fields.
      If a field is not found or cannot be confidently inferred, omit it from the JSON.
      For boolean fields, infer 'true' or 'false' if possible, otherwise omit.
      For numeric fields, extract the number.
      For URL fields, ensure it's a valid URL.
      For email fields, ensure it's a valid email.
      For currency codes, use ISO 4217 (e.g., USD, CAD).

      Here are the fields you should try to extract for a ${entity_type}:
      ${commonFields}
      ${entity_type === 'customer' ? customerSpecificFields : ''}
      ${entity_type === 'vendor' ? vendorSpecificFields : ''}

      Return only the JSON object. Do not include any other text or explanation.
      Example for a customer: {"name": "Acme Corp", "email": "info@acmecorp.com", "phone": "555-123-4567", "address_line_1": "123 Main St", "city": "Anytown", "country": "USA", "contact_person": "Jane Doe"}
      Example for a vendor: {"name": "Global Supplies Ltd.", "contact_person": "John Smith", "website": "https://globalsupplies.com", "payment_terms": "Net 30", "email": "support@globalsupplies.com", "phone": "555-987-6543"}
    `;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // Or gpt-4-turbo for potentially better results
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: user_input },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2, // Keep it low for factual extraction
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const extractedData = JSON.parse(data.choices[0].message.content);

    return new Response(JSON.stringify({ data: extractedData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in smart-add-analysis function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});