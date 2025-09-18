// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import * as jose from 'https://deno.land/x/jose@v5.2.4/index.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('DEBUG: OPTIONS request received for analyze-vendor-invoice');
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

    const { fileBase64, mimeType, user_text_input } = await req.json(); // Added user_text_input

    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'Missing fileBase64 or mimeType.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Retrieve Google Cloud credentials from Supabase secrets
    // @ts-ignore
    const GOOGLE_PROJECT_ID = Deno.env.get('GOOGLE_PROJECT_ID');
    // @ts-ignore
    const GOOGLE_LOCATION = Deno.env.get('GOOGLE_LOCATION');
    // @ts-ignore
    const GOOGLE_DOCUMENT_AI_PROCESSOR_ID = Deno.env.get('GOOGLE_DOCUMENT_AI_PROCESSOR_ID');
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenRequestBody),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`Failed to get Google access token: ${tokenResponse.status} - ${errorText}`);
      throw new Error(`Failed to get Google access token: ${tokenResponse.status} - ${errorText}`);
    }

    const { access_token } = await tokenResponse.json();
    console.log('Google access token obtained.');

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
        rawDocument: {
          content: fileBase64,
          mimeType: mimeType,
        },
      }),
    });

    if (!documentAiResponse.ok) {
      const errorText = await documentAiResponse.text();
      console.error(`Document AI API error: ${documentAiResponse.status} - ${errorText}`);
      throw new Error(`Document AI API error: ${documentAiResponse.status} - ${errorText}`);
    }

    const result = await documentAiResponse.json();
    const document = result.document;

    console.log("DEBUG: Document AI raw response document:", JSON.stringify(document, null, 2));

    let extractedData: {
      name?: string;
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
      spire_id?: string;
      is_active?: boolean;
      credit_limit?: number;
      payment_method?: string;
      shipping_address_line_1?: string;
      shipping_address_line_2?: string;
      shipping_city?: string;
      shipping_state_province?: string;
      shipping_postal_code?: string;
      shipping_country?: string;
      shipping_addresses_data?: any;
    } = {};

    let docAiVendorName: string | undefined;
    let docAiContactPerson: string | undefined;
    let docAiEmail: string | undefined;
    let docAiPhone: string | undefined;
    let docAiWebsite: string | undefined;
    let docAiTaxId: string | undefined;
    let docAiPaymentTerms: string | undefined;
    let docAiCurrencyCode: string | undefined;
    let docAiNotes: string | undefined;
    let docAiAddressLine1: string | undefined;
    let docAiAddressLine2: string | undefined;
    let docAiCity: string | undefined;
    let docAiStateProvince: string | undefined;
    let docAiPostalCode: string | undefined;
    let docAiCountry: string | undefined;
    let docAiSpireId: string | undefined; // Using invoice_id as a potential Spire ID


    if (document && document.entities && document.entities.length > 0) {
      const getEntityValue = (type: string) => {
        const entity = document.entities.find((e: any) => e.type === type);
        return entity?.mentionText || entity?.normalizedValue?.text;
      };

      docAiVendorName = getEntityValue('vendor_name');
      docAiContactPerson = getEntityValue('supplier_contact_name');
      docAiEmail = getEntityValue('supplier_email');
      docAiPhone = getEntityValue('supplier_phone');
      docAiWebsite = getEntityValue('supplier_website');
      docAiTaxId = getEntityValue('supplier_tax_id');
      docAiPaymentTerms = getEntityValue('payment_terms');
      docAiNotes = getEntityValue('description');
      docAiSpireId = getEntityValue('invoice_id'); // Use invoice_id as a potential Spire ID

      // Address fields from supplier_address
      const supplierAddress = document.entities.find((e: any) => e.type === 'supplier_address');
      if (supplierAddress && supplierAddress.parsedValue) {
        docAiAddressLine1 = supplierAddress.parsedValue.streetAddress;
        docAiCity = supplierAddress.parsedValue.city;
        docAiStateProvince = supplierAddress.parsedValue.state;
        docAiPostalCode = supplierAddress.parsedValue.postalCode;
        docAiCountry = supplierAddress.parsedValue.country;
      } else if (supplierAddress && supplierAddress.mentionText) {
        // Fallback to parsing mentionText if structured data isn't available
        const addressText = supplierAddress.mentionText;
        const parts = addressText.split(',').map((p: string) => p.trim());
        if (parts.length >= 3) {
          docAiAddressLine1 = parts[0];
          docAiCity = parts[1];
          docAiStateProvince = parts[2];
          const lastPart = parts[parts.length - 1];
          const postalCodeMatch = lastPart.match(/\b\d{5}(?:-\d{4})?\b|\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i);
          if (postalCodeMatch) {
            docAiPostalCode = postalCodeMatch[0];
            docAiCountry = lastPart.replace(postalCodeMatch[0], '').trim();
          } else {
            extractedData.country = lastPart; // Assign to extractedData directly
          }
        } else {
          docAiAddressLine1 = addressText;
        }
      }

      // Currency from total_amount
      const totalAmountEntity = document.entities.find((e: any) => e.type === 'total_amount');
      if (totalAmountEntity && totalAmountEntity.normalizedValue && totalAmountEntity.normalizedValue.currency) {
        docAiCurrencyCode = totalAmountEntity.normalizedValue.currency;
      }

      // Populate extractedData with Document AI results
      if (docAiVendorName) extractedData.name = docAiVendorName;
      if (docAiContactPerson) extractedData.contact_person = docAiContactPerson;
      if (docAiEmail) extractedData.email = docAiEmail;
      if (docAiPhone) extractedData.phone = docAiPhone;
      if (docAiWebsite) extractedData.website = docAiWebsite;
      if (docAiTaxId) extractedData.tax_id = docAiTaxId;
      if (docAiPaymentTerms) extractedData.payment_terms = docAiPaymentTerms;
      if (docAiCurrencyCode) extractedData.default_currency_code = docAiCurrencyCode;
      if (docAiNotes) extractedData.notes = docAiNotes;
      if (docAiAddressLine1) extractedData.address_line_1 = docAiAddressLine1;
      if (docAiAddressLine2) extractedData.address_line_2 = docAiAddressLine2;
      if (docAiCity) extractedData.city = docAiCity;
      if (docAiStateProvince) extractedData.state_province = docAiStateProvince;
      if (docAiPostalCode) extractedData.postal_code = docAiPostalCode;
      if (docAiCountry) extractedData.country = docAiCountry;
      if (docAiSpireId) extractedData.spire_id = docAiSpireId;
      extractedData.is_active = true; // Default to active
    }

    // --- LLM Fallback/Enhancement (OpenAI) ---
    // If Document AI didn't provide a good name or other key details, use LLM
    // This block now also handles the user_text_input for merging
    const fullText = document?.text || "";
    const combinedTextInput = user_text_input && fullText ? `${fullText}\n\nUser Provided Text:\n${user_text_input}` : (user_text_input || fullText);

    if (!extractedData.name || Object.keys(extractedData).length < 5 || user_text_input) { // Trigger LLM if initial extraction is weak OR user provided text
      console.log("DEBUG: Document AI results insufficient or user text provided, falling back to OpenAI LLM.");

      const llmSystemPrompt = `
        You are an expert data extractor for vendor information from invoices and user-provided text.
        Your task is to extract as much relevant information as possible from the provided text and format it into a JSON object.
        Prioritize accuracy and completeness for vendor creation.
        If a field is not found or cannot be confidently inferred, omit it from the JSON.
        For boolean fields, infer 'true' or 'false' if possible, otherwise omit.
        For numeric fields, extract the number.
        For URL fields, ensure it's a valid URL.
        For email fields, ensure it's a valid email.
        For currency codes, use ISO 4217 (e.g., USD, CAD).

        Special instruction for 'contact_person': Only extract this field if it is explicitly mentioned as a contact person *for the vendor*. Do not infer from names that might be the invoice recipient or generic roles (e.g., "Accounts Payable"). If unsure, leave it blank.

        Extract the following fields:
        name: string (Vendor's official name, e.g., "Acme Corp", "Global Supplies Ltd.")
        contact_person: string (Optional, e.g., "John Doe", "Sales Manager")
        email: string (Optional, Vendor's primary email)
        phone: string (Optional, Vendor's primary phone number)
        website: string (Optional, Vendor's website URL)
        tax_id: string (Optional, Vendor's Tax ID, VAT No, or EIN)
        payment_terms: string (Optional, e.g., "Net 30", "Due on Receipt", "15 Days")
        default_currency_code: string (Optional, 3-letter ISO 4217 code, e.g., USD, CAD, EUR)
        notes: string (Optional, any additional relevant information from the invoice that doesn't fit other fields)
        address_line_1: string (Optional, Vendor's street address line 1)
        address_line_2: string (Optional, Vendor's street address line 2)
        city: string (Optional, Vendor's city)
        state_province: string (Optional, Vendor's state/province)
        postal_code: string (Optional, Vendor's postal code)
        country: string (Optional, Vendor's country)
        spire_id: string (Optional, often an Invoice ID or Vendor ID if present)
        credit_limit: number (Optional, if a credit limit is explicitly mentioned)
        payment_method: string (Optional, e.g., "Bank Transfer", "Credit Card", "Check")

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
            { role: "user", content: `Combined Text for Analysis:\n${combinedTextInput}` },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1, // Keep low for factual extraction
        }),
      });

      if (!llmResponse.ok) {
        const errorText = await llmResponse.text();
        console.error(`OpenAI LLM API error: ${llmResponse.status} - ${errorText}`);
        // Don't throw, just log and proceed with Document AI data
      } else {
        const llmData = await llmResponse.json();
        const llmExtracted = JSON.parse(llmData.choices[0].message.content);
        console.log("DEBUG: OpenAI LLM Extracted Data:", JSON.stringify(llmExtracted, null, 2));

        // Merge LLM results, prioritizing LLM for potentially better parsing
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
          spire_id: llmExtracted.spire_id || extractedData.spire_id,
          credit_limit: llmExtracted.credit_limit || extractedData.credit_limit,
          payment_method: llmExtracted.payment_method || extractedData.payment_method,
          is_active: extractedData.is_active ?? true, // Keep Document AI's default or LLM's if present
        };
      }
    }

    // Final cleanup and ensure name is not empty or generic
    if (!extractedData.name || extractedData.name.toLowerCase().includes('invoice') || extractedData.name.toLowerCase().includes('receipt')) {
      extractedData.name = "AI Analyzed Vendor";
    }
    extractedData.is_active = extractedData.is_active ?? true; // Ensure active status is set

    // Post-processing for contact_person: Clear if it looks like a generic role or matches vendor name
    if (extractedData.contact_person) {
      const lowerContact = extractedData.contact_person.toLowerCase();
      const genericRoles = ['accounts payable', 'customer service', 'billing department', 'sales department', 'info', 'support'];
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
    console.error('Error in analyze-vendor-invoice function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});