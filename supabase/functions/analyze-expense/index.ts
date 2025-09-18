// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import *as jose from 'https://deno.land/x/jose@v5.2.4/index.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import { parse as parseDate, isValid as isValidDate } from 'https://esm.sh/date-fns@2.30.0';
// Removed: import { createHash } from 'https://deno.land/std@0.224.0/hash/mod.ts'; // Removed Deno std hash import

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Advanced date parsing function
const parseDateString = (dateString: string): string | undefined => {
  console.log(`DEBUG: parseDateString received: "${dateString}"`);
  const dateFormats = [
    'MM/dd/yyyy', 'M/d/yyyy', 'MM-dd-yyyy', 'M-d-yyyy',
    'dd/MM/yyyy', 'd/M/yyyy', 'dd-MM-yyyy', 'd-M-yyyy',
    'yyyy-MM-dd', 'yyyy/MM/dd',
    'MMM dd, yyyy', 'MMMM dd, yyyy', 'dd MMM yyyy', 'dd MMMM yyyy',
    'dd.MM.yyyy', 'd.M.yyyy',
    'MMMM d, yyyy', // e.g., September 5, 2025
    'MMM d, yyyy', // e.g., Sep 5, 2025
  ];

  for (const formatString of dateFormats) {
    const parsed = parseDate(dateString, formatString, new Date());
    if (isValidDate(parsed)) {
      const formattedDate = parsed.toISOString().split('T')[0];
      console.log(`DEBUG: parseDateString parsed "${dateString}" as "${formattedDate}" using format "${formatString}"`);
      return formattedDate;
    }
  }
  console.log(`DEBUG: parseDateString failed to parse "${dateString}"`);
  return undefined;
};

// Function to generate a SHA-256 hash of text content using Web Crypto API
const generateTextHash = async (text: string): Promise<string> => {
  const textEncoder = new TextEncoder();
  const data = textEncoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hexHash;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('DEBUG: OPTIONS request received for analyze-expense');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient( // Use admin client for fetching categories and company info
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseClient = createClient( // Use regular client for user auth
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

    const { fileBase64, mimeType, companyId } = await req.json();

    console.log('DEBUG: Received mimeType from client:', mimeType);

    if (!fileBase64 || !mimeType || !companyId) {
      console.error('Error: Missing fileBase64, mimeType, or companyId');
      return new Response(JSON.stringify({ error: 'Missing fileBase64, mimeType, or companyId' }), {
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
    const rawTextFromDocument = document?.text || "";
    console.log("DEBUG: Document AI raw text:", rawTextFromDocument);

    let extractedData: {
      title?: string;
      description?: string;
      original_currency_amount?: number;
      original_currency_code?: string;
      expense_date?: string;
      vendor_name?: string;
      merchant_address?: string;
      receipt_summary?: string;
      ai_confidence_score?: number;
      category_id?: string;
      line_items?: Array<{
        description: string;
        quantity?: number;
        unit_price?: number;
        line_amount: number;
        currency_code: string;
      }>;
      document_type_classification?: string; // New field
      document_type_confidence?: number; // New field
      is_duplicate?: boolean; // New field
      duplicate_expense_id?: string; // New field
      text_hash?: string; // New field
    } = {};

    // --- LLM Enhancement (OpenAI) ---
    if (rawTextFromDocument.trim()) {
      console.log("DEBUG: Sending raw text to OpenAI LLM for detailed expense extraction and classification.");

      // Fetch company's expense categories for AI context
      const { data: categories, error: categoriesError } = await supabaseAdmin
        .from('expense_categories')
        .select('id, name, description')
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (categoriesError) {
        console.error("Error fetching categories for AI analysis:", categoriesError);
        // Continue without categories if there's an error
      }

      const categoryNames = categories ? categories.map((c: any) => `ID: ${c.id}, Name: ${c.name}, Description: ${c.description || ''}`).join('\n') : 'No categories available.';

      const llmSystemPrompt = `
        You are an AI assistant specialized in extracting detailed expense information from receipts and invoices.
        Your task is to extract as much relevant information as possible from the provided text and format it into a JSON object.
        Prioritize accuracy and completeness for expense creation.
        If a field is not found or cannot be confidently inferred, omit it from the JSON.
        For numeric fields, extract the number.
        For currency codes, use ISO 4217 (e.g., USD, CAD).

        Additionally, classify the document type and provide a confidence score for this classification.

        Extract the following fields:
        vendor_name: string (Name of the merchant/vendor)
        merchant_address: string (Full address of the merchant)
        expense_date: string (Date of the expense in YYYY-MM-DD format)
        original_currency_amount: number (Total amount of the expense)
        original_currency_code: string (3-letter ISO 4217 code for the original currency, default to USD if not found)
        receipt_summary: string (A concise summary of the items/services on the receipt, max 100 characters)
        description: string (A more detailed description of the expense, potentially including key line items)
        line_items: array of objects (Detailed breakdown of items/services)
          - description: string (Description of the line item)
          - quantity: number (Optional, quantity of the item)
          - unit_price: number (Optional, unit price of the item)
          - line_amount: number (Total amount for this line item)
          - currency_code: string (Currency code for this line item, default to original_currency_code if not found)
        ai_confidence_score: number (A score from 0.0 to 1.0 indicating confidence in extraction)
        category_id: string (UUID of the most relevant expense category from the list below. If no strong match, omit.)
        document_type_classification: string ('receipt', 'invoice', 'other')
        document_type_confidence: number (A score from 0.0 to 1.0 indicating confidence in document type classification)

        Available Expense Categories for inference (use their IDs):
        ${categoryNames}

        Return only the JSON object. Do not include any other text or explanation.
      `;

      const llmResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o", // Using a more capable model for better extraction
          messages: [
            { role: "system", content: llmSystemPrompt },
            { role: "user", content: `Receipt Text:\n${rawTextFromDocument}` },
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

      extractedData = llmExtracted;

      // Post-processing and defaulting
      extractedData.original_currency_code = extractedData.original_currency_code || 'USD';
      extractedData.ai_confidence_score = extractedData.ai_confidence_score ?? 0.7; // Default confidence if LLM doesn't provide
      extractedData.expense_date = extractedData.expense_date ? parseDateString(extractedData.expense_date) : undefined;
      extractedData.document_type_classification = extractedData.document_type_classification || 'other';
      extractedData.document_type_confidence = extractedData.document_type_confidence ?? 0.5;

      // Ensure line items have currency code
      if (extractedData.line_items) {
        extractedData.line_items = extractedData.line_items.map(item => ({
          ...item,
          currency_code: item.currency_code || extractedData.original_currency_code || 'USD',
        }));
      }

      // If LLM didn't provide a title, create one
      if (!extractedData.title) {
        extractedData.title = extractedData.vendor_name && extractedData.receipt_summary
          ? `${extractedData.vendor_name} - ${extractedData.receipt_summary}`
          : extractedData.vendor_name || extractedData.receipt_summary || "AI Analyzed Expense";
      }
    } else {
      extractedData.title = "AI Analyzed Expense (No Text)";
      extractedData.ai_confidence_score = 0.1;
      extractedData.document_type_classification = 'other';
      extractedData.document_type_confidence = 0.1;
      console.log("DEBUG: No document text found for LLM analysis.");
    }

    // --- Duplicate Detection (USER-SPECIFIC) ---
    const textHash = await generateTextHash(rawTextFromDocument); // Await the async hash function
    extractedData.text_hash = textHash; // Store hash in extracted data

    const { data: existingReceipts, error: duplicateCheckError } = await supabaseAdmin
      .from('receipts')
      .select('id, expense_id')
      .eq('uploaded_by', currentUser.id) // ONLY check for duplicates uploaded by the current user
      .eq('text_hash', textHash)
      .limit(1);

    if (duplicateCheckError) {
      console.error("Error checking for duplicate receipts:", duplicateCheckError);
    } else if (existingReceipts && existingReceipts.length > 0) {
      extractedData.is_duplicate = true;
      extractedData.duplicate_expense_id = existingReceipts[0].expense_id;
      console.log(`DEBUG: Duplicate detected! Existing receipt ID: ${existingReceipts[0].id}, Expense ID: ${existingReceipts[0].expense_id}`);
    } else {
      extractedData.is_duplicate = false;
    }

    // Fetch company's default currency for base_currency_amount calculation
    const { data: companyData, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('default_currency')
      .eq('id', companyId)
      .single();

    if (companyError) {
      console.error("Error fetching company default currency:", companyError);
      // Proceed with USD as fallback if company currency cannot be fetched
    }
    const companyDefaultCurrency = companyData?.default_currency || 'USD';

    let baseCurrencyAmount: number | undefined;
    let exchangeRate: number | undefined;

    if (extractedData.original_currency_amount && extractedData.original_currency_code && companyDefaultCurrency) {
      if (extractedData.original_currency_code === companyDefaultCurrency) {
        baseCurrencyAmount = extractedData.original_currency_amount;
        exchangeRate = 1;
      } else {
        // Placeholder for actual currency conversion API call
        // In a real app, you'd call an external API like ExchangeRate-API or Open Exchange Rates
        // For now, we'll simulate a fixed exchange rate or use a simple placeholder.
        console.warn(`DEBUG: Currency conversion from ${extractedData.original_currency_code} to ${companyDefaultCurrency} is a placeholder.`);
        // Example: 1 USD = 1.35 CAD
        if (extractedData.original_currency_code === 'USD' && companyDefaultCurrency === 'CAD') {
          exchangeRate = 1.35;
          baseCurrencyAmount = extractedData.original_currency_amount * exchangeRate;
        } else if (extractedData.original_currency_code === 'CAD' && companyDefaultCurrency === 'USD') {
          exchangeRate = 0.74; // 1/1.35
          baseCurrencyAmount = extractedData.original_currency_amount * exchangeRate;
        } else {
          // Fallback to 1:1 if no specific rate or API is integrated
          exchangeRate = 1;
          baseCurrencyAmount = extractedData.original_currency_amount;
        }
      }
    }

    const finalExtractedData = {
      ...extractedData,
      base_currency_amount: baseCurrencyAmount,
      exchange_rate: exchangeRate,
      // Ensure amount and currency_code map to original_currency_amount and original_currency_code for form
      amount: extractedData.original_currency_amount,
      currency_code: extractedData.original_currency_code,
    };

    console.log("DEBUG: Final Extracted Data for Response:", JSON.stringify(finalExtractedData, null, 2));

    return new Response(JSON.stringify({ data: finalExtractedData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-expense function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});