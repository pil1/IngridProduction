// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import * as jose from 'https://deno.land/x/jose@v5.2.4/index.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// Removed: import { parse as parseVcard } from 'https://esm.sh/vcard@1.0.0'; // Removed external vcard module

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Basic inline vCard parser
function parseVcardContent(vcardContent: string): any | null {
  const lines = vcardContent.split(/\r?\n/);
  const vcard: any = {};
  let currentKey = '';

  for (const line of lines) {
    if (line.startsWith('BEGIN:VCARD') || line.startsWith('END:VCARD') || line.startsWith('VERSION:')) {
      continue;
    }

    const parts = line.split(':');
    if (parts.length < 2) {
      continue;
    }

    let key = parts[0].trim().toUpperCase();
    let value = parts.slice(1).join(':').trim();

    // Handle folded lines (lines starting with whitespace)
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (currentKey) {
        vcard[currentKey] += value;
      }
      continue;
    } else {
      currentKey = key;
    }

    // Handle common vCard fields
    if (key.includes('FN')) { // Formatted Name
      vcard.fn = [{ value: value }];
    } else if (key.includes('ORG')) { // Organization
      vcard.org = [{ value: value }];
    } else if (key.includes('EMAIL')) {
      vcard.email = [{ value: value }];
    } else if (key.includes('TEL')) { // Telephone
      vcard.tel = [{ value: value }];
    } else if (key.includes('URL')) {
      vcard.url = [{ value: value }];
    } else if (key.includes('ADR')) { // Address
      const addrParts = value.split(';');
      vcard.adr = [{
        value: {
          postbox: addrParts[0] || '',
          extended: addrParts[1] || '',
          street: addrParts[2] || '',
          city: addrParts[3] || '',
          region: addrParts[4] || '', // State/Region
          postcode: addrParts[5] || '', // Postal Code
          country: addrParts[6] || '',
        }
      }];
    }
    // Add more fields as needed
  }
  return Object.keys(vcard).length > 0 ? vcard : null;
}


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('DEBUG: OPTIONS request received for analyze-customer-contact');
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

    const { fileBase64, mimeType, user_text_input } = await req.json();

    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'Missing fileBase64 or mimeType.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Retrieve Google Cloud credentials and OpenAI API key from Supabase secrets
    // @ts-ignore
    const GOOGLE_PROJECT_ID = Deno.env.get('GOOGLE_PROJECT_ID');
    // @ts-ignore
    const GOOGLE_LOCATION = Deno.env.get('GOOGLE_LOCATION');
    // @ts-ignore
    const GOOGLE_DOCUMENT_AI_PROCESSOR_ID = Deno.env.get('GOOGLE_DOCUMENT_AI_PROCESSOR_ID'); // Generic OCR/Form parser
    // @ts-ignore
    const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    // @ts-ignore
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!GOOGLE_PROJECT_ID || !GOOGLE_LOCATION || !GOOGLE_DOCUMENT_AI_PROCESSOR_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) {
      console.error('Error: Missing Google Cloud environment variables for Document AI.');
      throw new Error('Missing Google Cloud environment variables for Document AI. Please ensure GOOGLE_PROJECT_ID, GOOGLE_LOCATION, GOOGLE_DOCUMENT_AI_PROCESSOR_ID, and GOOGLE_SERVICE_ACCOUNT_JSON are set in Supabase secrets.');
    }
    if (!OPENAI_API_KEY) {
      console.error('Error: Missing OpenAI API key.');
      throw new Error('Missing OpenAI API key. Please set OPENAI_API_KEY in Supabase secrets.');
    }

    let extractedData: {
      name?: string; // Maps to customer.name
      contact_person?: string;
      email?: string;
      phone?: string;
      website?: string;
      tax_id?: string;
      payment_terms?: string;
      default_currency_code?: string;
      notes?: string;
      address_line_1?: string;
      address_line_2?: string;
      city?: string;
      state_province?: string;
      postal_code?: string;
      country?: string;
      spire_customer_id?: string;
      is_active?: boolean;
      credit_limit?: number;
      payment_method?: string;
      code?: string;
      receivable_account?: string;
      upload_flag?: boolean;
      discount_code?: string;
      credit_type?: number;
      on_hold?: boolean;
      reference_code?: string;
      apply_finance_charges?: boolean;
      user_def_1?: string;
      background_color_int?: number;
      default_ship_to_code?: string;
      foreground_color_int?: number;
      user_def_2?: string;
      udf_data?: any;
      statement_type?: string;
      payment_provider_id_int?: number;
      special_code?: string;
      spire_status?: string;
      shipping_address_line_1?: string;
      shipping_address_line_2?: string;
      shipping_city?: string;
      shipping_state_province?: string;
      shipping_postal_code?: string;
      shipping_country?: string;
      account_number?: string; // Added account_number to the type definition
    } = {};

    let rawTextFromDocument = "";

    if (mimeType === 'text/vcard' || mimeType === 'text/x-vcard') {
      console.log("DEBUG: Processing vCard file.");
      const vcardContent = atob(fileBase64); // Decode Base64
      const parsedVcard = parseVcardContent(vcardContent); // Use inline parser

      if (parsedVcard) {
        extractedData.name = parsedVcard.fn?.[0]?.value || parsedVcard.org?.[0]?.value; // Full name or organization name
        extractedData.contact_person = parsedVcard.fn?.[0]?.value; // Full name as contact person
        extractedData.email = parsedVcard.email?.[0]?.value;
        extractedData.phone = parsedVcard.tel?.[0]?.value;
        extractedData.website = parsedVcard.url?.[0]?.value;

        if (parsedVcard.adr && parsedVcard.adr.length > 0) {
          const addr = parsedVcard.adr[0].value;
          extractedData.address_line_1 = addr.street;
          extractedData.city = addr.city;
          extractedData.state_province = addr.region;
          extractedData.postal_code = addr.postcode;
          extractedData.country = addr.country;
        }
        extractedData.is_active = true;
        rawTextFromDocument = vcardContent; // Use vCard content as raw text for LLM if needed
      }
    } else if (mimeType.startsWith('image/')) {
      console.log("DEBUG: Processing image file with Document AI.");
      const serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
      const privateKey = await jose.importPKCS8(serviceAccount.private_key, 'RS256');
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + 3600;

      const jwt = new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/cloud-platform' });
      jwt.setProtectedHeader({ alg: 'RS256', typ: 'JWT' });
      jwt.setIssuedAt(now);
      jwt.setExpirationTime(expiry);
      jwt.setAudience('https://oauth2.googleapis.com/token');
      jwt.setIssuer(serviceAccount.client_email);
      jwt.setSubject(serviceAccount.client_email);
      
      const signedJwt = await jwt.sign(privateKey);

      const tokenRequestBody = {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJwt,
      };

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokenRequestBody),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`Failed to get Google access token: ${tokenResponse.status} - ${errorText}`);
        throw new Error(`Failed to get Google access token: ${tokenResponse.status} - ${errorText}`);
      }
      const { access_token } = await tokenResponse.json();

      const processorPath = `projects/${GOOGLE_PROJECT_ID}/locations/${GOOGLE_LOCATION}/processors/${GOOGLE_DOCUMENT_AI_PROCESSOR_ID}`;
      const documentAiEndpoint = `https://documentai.googleapis.com/v1/${processorPath}:process`;

      const documentAiResponse = await fetch(documentAiEndpoint, {
        method: 'POST',
        headers: {
          ...corsHeaders,
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawDocument: { content: fileBase64, mimeType: mimeType },
        }),
      });

      if (!documentAiResponse.ok) {
        const errorText = await documentAiResponse.text();
        console.error(`Document AI API error: ${documentAiResponse.status} - ${errorText}`);
        throw new Error(`Document AI API error: ${documentAiResponse.status} - ${errorText}`);
      }

      const docAiResult = await documentAiResponse.json();
      const document = docAiResult.document;
      rawTextFromDocument = document?.text || "";
      console.log("DEBUG: Document AI raw text:", rawTextFromDocument);

      // For business cards, Document AI might not have specific entities,
      // so we primarily rely on the LLM for structuring from rawTextFromDocument.
      // We can do some basic entity extraction here if Document AI provides it,
      // but the LLM will be the main parser.
    } else {
      throw new Error("Unsupported file type for customer contact analysis.");
    }

    // --- LLM Enhancement (OpenAI) ---
    // Always use LLM to structure data, combining file/image text with user_text_input
    const combinedTextInput = user_text_input && rawTextFromDocument ? `${rawTextFromDocument}\n\nUser Provided Text:\n${user_text_input}` : (user_text_input || rawTextFromDocument);

    if (combinedTextInput.trim()) {
      console.log("DEBUG: Sending combined text to OpenAI LLM for customer contact extraction.");

      const llmSystemPrompt = `
        You are an expert data extractor for customer contact information from text, vCards, or business cards.
        Your task is to extract as much relevant information as possible from the provided text and format it into a JSON object.
        Prioritize accuracy and completeness for customer creation.
        If a field is not found or cannot be confidently inferred, omit it from the JSON.
        For boolean fields, infer 'true' or 'false' if possible, otherwise omit.
        For numeric fields, extract the number.
        For URL fields, ensure it's a valid URL.
        For email fields, ensure it's a valid email.
        For currency codes, use ISO 4217 (e.g., USD, CAD).

        Special instruction for 'contact_person': Only extract this field if it is explicitly mentioned as a contact person *for the customer*. Do not infer from names that might be the company name or generic roles (e.g., "Customer Service"). If unsure, leave it blank.
        Special instruction for 'name': This should be the *company name* if identifiable. If only a person's name is present and no company, use the person's name for 'name' and 'contact_person'.

        Extract the following fields:
        name: string (Customer's company name, or person's full name if no company)
        contact_person: string (Optional, e.g., "John Doe", "Sales Manager")
        email: string (Optional, Customer's primary email)
        phone: string (Optional, Customer's primary phone number)
        website: string (Optional, Customer's website URL)
        tax_id: string (Optional, Customer's Tax ID, VAT No, or EIN)
        payment_terms: string (Optional, e.g., "Net 30", "Due on Receipt", "15 Days")
        default_currency_code: string (Optional, 3-letter ISO 4217 code, e.g., USD, CAD, EUR)
        notes: string (Optional, any additional relevant information that doesn't fit other fields)
        address_line_1: string (Optional, Customer's street address line 1)
        address_line_2: string (Optional, Customer's street address line 2)
        city: string (Optional, Customer's city)
        state_province: string (Optional, Customer's state/province)
        postal_code: string (Optional, Customer's postal code)
        country: string (Optional, Customer's country)
        spire_customer_id: string (Optional, Spire's customerNo)
        account_number: string (Optional, Spire's code)
        code: string (Optional, Spire's code, same as account_number)
        receivable_account: string (Optional)
        upload_flag: boolean (Optional, default true)
        discount_code: string (Optional)
        credit_type: number (Optional, integer)
        on_hold: boolean (Optional, default false)
        reference_code: string (Optional)
        apply_finance_charges: boolean (Optional, default false)
        user_def_1: string (Optional)
        background_color_int: number (Optional, integer)
        default_ship_to_code: string (Optional)
        foreground_color_int: number (Optional, integer)
        user_def_2: string (Optional)
        udf_data: object (Optional, JSON object)
        statement_type: string (Optional)
        payment_provider_id_int: number (Optional, integer)
        special_code: string (Optional)
        spire_status: string (Optional)
        shipping_address_line_1: string (Optional)
        shipping_address_line_2: string (Optional)
        shipping_city: string (Optional)
        shipping_state_province: string (Optional)
        shipping_postal_code: string (Optional)
        shipping_country: string (Optional)

        Return only the JSON object. Do not include any other text or explanation.
      `;

      const llmResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: llmSystemPrompt },
            { role: "user", content: `Customer Contact Text:\n${combinedTextInput}` },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1, // Keep low for factual extraction
        }),
      });

      if (!llmResponse.ok) {
        const errorText = await llmResponse.text();
        console.error(`OpenAI LLM API error: ${llmResponse.status} - ${errorText}`);
        throw new Error(`OpenAI LLM API error: ${llmResponse.statusText} - ${errorText}`);
      }

      const llmData = await llmResponse.json();
      const llmExtracted = JSON.parse(llmData.choices[0].message.content);
      console.log("DEBUG: OpenAI LLM Extracted Data:", JSON.stringify(llmExtracted, null, 2));

      // Merge LLM results, prioritizing LLM for comprehensive parsing
      extractedData = {
        name: llmExtracted.name || extractedData.name,
        contact_person: llmExtracted.contact_person || extractedData.contact_person,
        email: llmExtracted.email || extractedData.email,
        phone: llmExtracted.phone || extractedData.phone,
        website: llmExtracted.website || extractedData.website,
        tax_id: llmExtracted.tax_id || extractedData.tax_id,
        payment_terms: llmExtracted.payment_terms || extractedData.payment_terms,
        default_currency_code: llmExtracted.default_currency_code || extractedData.default_currency_code,
        notes: llmExtracted.notes || extractedData.notes,
        address_line_1: llmExtracted.address_line_1 || extractedData.address_line_1,
        address_line_2: llmExtracted.address_line_2 || extractedData.address_line_2,
        city: llmExtracted.city || extractedData.city,
        state_province: llmExtracted.state_province || extractedData.state_province,
        postal_code: llmExtracted.postal_code || extractedData.postal_code,
        country: llmExtracted.country || extractedData.country,
        spire_customer_id: llmExtracted.spire_customer_id || extractedData.spire_customer_id,
        account_number: llmExtracted.account_number || extractedData.account_number,
        code: llmExtracted.code || extractedData.code,
        receivable_account: llmExtracted.receivable_account || extractedData.receivable_account,
        upload_flag: llmExtracted.upload_flag ?? extractedData.upload_flag ?? true,
        discount_code: llmExtracted.discount_code || extractedData.discount_code,
        credit_type: llmExtracted.credit_type || extractedData.credit_type,
        on_hold: llmExtracted.on_hold ?? extractedData.on_hold ?? false,
        reference_code: llmExtracted.reference_code || extractedData.reference_code,
        apply_finance_charges: llmExtracted.apply_finance_charges ?? extractedData.apply_finance_charges ?? false,
        user_def_1: llmExtracted.user_def_1 || extractedData.user_def_1,
        background_color_int: llmExtracted.background_color_int || extractedData.background_color_int,
        default_ship_to_code: llmExtracted.default_ship_to_code || extractedData.default_ship_to_code,
        foreground_color_int: llmExtracted.foreground_color_int || extractedData.foreground_color_int,
        user_def_2: llmExtracted.user_def_2 || extractedData.user_def_2,
        udf_data: llmExtracted.udf_data || extractedData.udf_data || {},
        statement_type: llmExtracted.statement_type || extractedData.statement_type,
        payment_provider_id_int: llmExtracted.payment_provider_id_int || extractedData.payment_provider_id_int,
        special_code: llmExtracted.special_code || extractedData.special_code,
        spire_status: llmExtracted.spire_status || extractedData.spire_status,
        shipping_address_line_1: llmExtracted.shipping_address_line_1 || extractedData.shipping_address_line_1,
        shipping_address_line_2: llmExtracted.shipping_address_line_2 || extractedData.shipping_address_line_2,
        shipping_city: llmExtracted.shipping_city || extractedData.shipping_city,
        shipping_state_province: llmExtracted.state_province || extractedData.state_province,
        shipping_postal_code: llmExtracted.postal_code || extractedData.postal_code,
        shipping_country: llmExtracted.country || extractedData.country,
        is_active: extractedData.is_active ?? true, // Default to active
      };
    } else if (!extractedData.name) {
      extractedData.name = "AI Analyzed Customer"; // Fallback if no name found at all
    }
    extractedData.is_active = extractedData.is_active ?? true; // Ensure active status is set

    // Post-processing for contact_person: Clear if it looks like a generic role or matches company name
    if (extractedData.contact_person) {
      const lowerContact = extractedData.contact_person.toLowerCase();
      const genericRoles = ['customer service', 'support', 'info', 'sales'];
      if (genericRoles.some(role => lowerContact.includes(role)) || (extractedData.name && lowerContact.includes(extractedData.name.toLowerCase()))) {
        extractedData.contact_person = undefined; // Clear ambiguous contact person
      }
    }

    // Clean up null/undefined values to match form schema expectations
    const cleanedData: typeof extractedData = {};
    for (const key in extractedData) {
      // @ts-ignore
      if (extractedData[key] !== null && extractedData[key] !== undefined) {
        // @ts-ignore
        cleanedData[key] = extractedData[key];
      }
    }

    return new Response(JSON.stringify({ data: cleanedData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-customer-contact function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});