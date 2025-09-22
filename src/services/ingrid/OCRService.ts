/**
 * OCR Service
 *
 * Handles Optical Character Recognition for document processing.
 * Supports multiple OCR providers with a unified interface.
 */

import { IngridConfig } from '@/types/ingrid';

export interface OCRResult {
  text: string;
  confidence: number;
  blocks: OCRBlock[];
  tables?: OCRTable[];
  keyValuePairs?: OCRKeyValue[];
}

export interface OCRBlock {
  text: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  type: 'paragraph' | 'line' | 'word' | 'title' | 'header';
}

export interface OCRTable {
  rows: string[][];
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OCRKeyValue {
  key: string;
  value: string;
  confidence: number;
}

export type OCRProvider = 'openai-vision' | 'google-document-ai';

export class OCRService {
  private config: IngridConfig;
  private provider: OCRProvider;

  constructor(config: IngridConfig, provider: OCRProvider = 'google-document-ai') {
    this.config = config;
    this.provider = provider;
  }

  /**
   * Process a document with OCR
   */
  async processDocument(file: File): Promise<OCRResult> {
    console.log(`📄 OCR processing ${file.name} with ${this.provider}`);

    switch (this.provider) {
      case 'google-document-ai':
        return this.processWithGoogleDocumentAI(file);

      case 'openai-vision':
        return this.processWithOpenAIVision(file);

      default:
        return this.processWithGoogleDocumentAI(file);
    }
  }

  /**
   * OpenAI Vision API integration
   */
  private async processWithOpenAIVision(file: File): Promise<OCRResult> {
    try {
      // Convert file to base64
      const base64 = await this.fileToBase64(file);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `You are an expert document analysis AI specializing in financial document processing. Analyze this receipt/invoice with extreme precision and extract ALL relevant financial information.

**CRITICAL REQUIREMENTS:**
1. **ACCURACY IS PARAMOUNT** - Double-check every extracted value
2. **CURRENCY DETECTION** - Identify the correct currency symbol/code
3. **DATE PARSING** - Handle all date formats (MM/DD/YYYY, DD/MM/YYYY, etc.)
4. **AMOUNT PRECISION** - Extract exact amounts including cents
5. **TAX IDENTIFICATION** - Separate tax amounts from subtotals
6. **VENDOR RECOGNITION** - Extract complete business name and details

**DOCUMENT TYPES TO HANDLE:**
- Receipts (retail, restaurant, gas, etc.)
- Invoices (service, product, subscription)
- Bills (utilities, phone, internet)
- Travel expenses (hotels, flights, parking)
- Professional services (consulting, legal, medical)

**REQUIRED JSON OUTPUT FORMAT:**
{
  "document_type": "receipt|invoice|bill|other",
  "vendor_name": "Full business name as printed",
  "vendor_address": "Complete address if visible",
  "vendor_phone": "Phone number if visible",
  "vendor_website": "Website/email if visible",
  "transaction_date": "YYYY-MM-DD format",
  "transaction_time": "HH:MM if visible",
  "subtotal": "Pre-tax amount (number only)",
  "tax_amount": "Tax amount (number only)",
  "tip_amount": "Tip/gratuity (number only)",
  "total_amount": "Final total (number only)",
  "currency_code": "USD|EUR|GBP|CAD|etc",
  "payment_method": "Cash|Credit|Debit|Check|Other",
  "card_last_four": "Last 4 digits if visible",
  "invoice_number": "Invoice/receipt number",
  "description": "Brief description of purchase/service",
  "line_items": [
    {
      "description": "Item description",
      "quantity": "Number of items",
      "unit_price": "Price per unit",
      "total_price": "Total for this line"
    }
  ],
  "category_suggestion": "Travel|Meals|Office|Utilities|Professional|Other",
  "gl_account_suggestion": "Suggested GL account code",
  "confidence_scores": {
    "vendor_name": 0.95,
    "total_amount": 0.98,
    "date": 0.90,
    "tax_amount": 0.85
  },
  "overall_confidence": 0.92,
  "extraction_notes": "Any issues or uncertainties",
  "ocr_raw_text": "All visible text as extracted"
}

**EXTRACTION RULES:**
1. **Numbers**: Extract as pure numbers (no currency symbols)
2. **Dates**: Convert to YYYY-MM-DD format
3. **Currency**: Detect from symbols ($, €, £) or context
4. **Confidence**: Rate each field 0.0-1.0 based on clarity
5. **Missing Data**: Use null for unavailable fields
6. **Ambiguous Text**: Note in extraction_notes

**COMMON CHALLENGES TO HANDLE:**
- Faded/poor quality text
- Handwritten amounts
- Multiple currencies
- Foreign languages
- Crumpled/folded documents
- Partial/cut-off information
- Receipt paper fade
- Thermal printer degradation

**BUSINESS LOGIC:**
- Total should equal subtotal + tax + tip
- Validate mathematical accuracy
- Flag discrepancies in extraction_notes
- Suggest appropriate expense categories
- Identify recurring vendors/services

Analyze the document and return ONLY the JSON response with maximum accuracy and detail.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${file.type};base64,${base64}`
                  }
                }
              ]
            }
          ],
          max_tokens: this.config.maxTokens,
          temperature: 0.1 // Low temperature for accuracy
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content returned from OpenAI Vision');
      }

      // Parse the structured response
      const parsed = this.parseOpenAIVisionResponse(content);

      // Validate and enhance the parsed result
      const validated = this.validateAndEnhanceResult(parsed);

      console.log('✅ OpenAI Vision processing complete with validation');
      return validated;

    } catch (error) {
      console.error('🚨 OpenAI Vision error:', error);
      throw error;
    }
  }

  /**
   * Google Document AI integration - Premier document processing service
   */
  private async processWithGoogleDocumentAI(file: File): Promise<OCRResult> {
    try {
      console.log('📄 Starting Google Document AI processing via Supabase function for:', file.name);

      const base64 = await this.fileToBase64(file);

      // Use Supabase function for secure authentication
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      if (!supabaseUrl) {
        console.warn('❌ Supabase configuration missing, using mock');
        return this.processWithMock(file);
      }

      // Get the user's session token from Supabase client
      const { data: { session } } = await import('@/integrations/supabase/client').then(m => m.supabase.auth.getSession());

      if (!session?.access_token) {
        throw new Error('❌ No authenticated session found. User must be logged in to process documents.');
      }

      console.log('🔐 Using Supabase function with authenticated user session');

      // Get current user's profile to obtain company ID
      const { data: profileData, error: profileError } = await import('@/integrations/supabase/client')
        .then(m => m.supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', session.user.id)
          .single()
        );

      if (profileError || !profileData?.company_id) {
        throw new Error('❌ No company ID found in user profile. User must be associated with a company.');
      }

      console.log('🏢 Using company ID:', profileData.company_id);

      const response = await fetch(`${supabaseUrl}/functions/v1/analyze-expense`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          fileBase64: base64,
          mimeType: file.type || 'application/pdf',
          companyId: profileData.company_id
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Supabase function failed: ${response.status} - ${errorText}`);
        throw new Error(`Google Document AI processing failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Google Document AI response received via Supabase');
      console.log('📊 Supabase function response data:', data);

      // The Supabase function returns { data: extractedData }, not raw Document AI response
      if (data.data) {
        console.log('📊 Processing Supabase function response with extracted data');
        return this.parseSupabaseFunctionResponse(data.data);
      } else {
        console.warn('📊 Unexpected response format from Supabase function:', data);
        return this.parseSupabaseFunctionResponse(data);
      }

    } catch (error) {
      console.error('🚨 Google Document AI processing error:', error);
      throw error;
    }
  }

  /**
   * Enhanced Google Vision API with financial document focus
   */
  private async processWithGoogleVisionEnhanced(file: File, base64: string, apiKey: string): Promise<OCRResult> {
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64
            },
            features: [
              { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 },
              { type: 'TEXT_DETECTION', maxResults: 50 }
            ],
            imageContext: {
              textDetectionParams: {
                enableTextDetectionConfidenceScore: true
              }
            }
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Google Vision API error: ${response.statusText}`);
    }

    const data = await response.json();
    const annotations = data.responses[0];

    return this.parseGoogleVisionEnhancedResponse(annotations, file.name);
  }


  // Helper methods

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private parseOpenAIVisionResponse(content: string): OCRResult {
    try {
      // Try to parse enhanced JSON response
      const parsed = JSON.parse(content);

      // Extract structured data with enhanced field mapping
      const keyValuePairs: OCRKeyValue[] = [];

      if (parsed.vendor_name) keyValuePairs.push({
        key: 'vendor_name',
        value: parsed.vendor_name,
        confidence: parsed.confidence_scores?.vendor_name || 0.9
      });

      if (parsed.total_amount) keyValuePairs.push({
        key: 'amount',
        value: parsed.total_amount.toString(),
        confidence: parsed.confidence_scores?.total_amount || 0.9
      });

      if (parsed.transaction_date) keyValuePairs.push({
        key: 'expense_date',
        value: parsed.transaction_date,
        confidence: parsed.confidence_scores?.date || 0.9
      });

      if (parsed.tax_amount) keyValuePairs.push({
        key: 'tax_amount',
        value: parsed.tax_amount.toString(),
        confidence: parsed.confidence_scores?.tax_amount || 0.8
      });

      if (parsed.currency_code) keyValuePairs.push({
        key: 'currency_code',
        value: parsed.currency_code,
        confidence: 0.95
      });

      if (parsed.category_suggestion) keyValuePairs.push({
        key: 'category',
        value: parsed.category_suggestion,
        confidence: 0.8
      });

      if (parsed.gl_account_suggestion) keyValuePairs.push({
        key: 'gl_account_code',
        value: parsed.gl_account_suggestion,
        confidence: 0.7
      });

      // Generate description from line items or use provided description
      let description = parsed.description || '';
      if (!description && parsed.line_items && parsed.line_items.length > 0) {
        description = parsed.line_items.map((item: any) => item.description).join(', ');
      }
      if (!description && parsed.vendor_name) {
        description = `Expense from ${parsed.vendor_name}`;
      }

      if (description) keyValuePairs.push({
        key: 'description',
        value: description,
        confidence: 0.85
      });

      // Create structured text summary
      const structuredText = `
VENDOR: ${parsed.vendor_name || 'Unknown'}
DATE: ${parsed.transaction_date || 'Unknown'}
AMOUNT: ${parsed.currency_code || '$'}${parsed.total_amount || '0.00'}
TAX: ${parsed.currency_code || '$'}${parsed.tax_amount || '0.00'}
CATEGORY: ${parsed.category_suggestion || 'Unknown'}
PAYMENT: ${parsed.payment_method || 'Unknown'}
${parsed.line_items ? '\nITEMS:\n' + parsed.line_items.map((item: any) => `- ${item.description}: ${item.total_price}`).join('\n') : ''}
${parsed.extraction_notes ? '\nNOTES: ' + parsed.extraction_notes : ''}
      `.trim();

      return {
        text: parsed.ocr_raw_text || structuredText,
        confidence: parsed.overall_confidence || 0.9,
        blocks: [
          {
            text: structuredText,
            confidence: parsed.overall_confidence || 0.9,
            boundingBox: { x: 0, y: 0, width: 100, height: 100 },
            type: 'paragraph'
          }
        ],
        keyValuePairs,
        tables: parsed.line_items ? [{
          rows: [
            ['Item', 'Qty', 'Price', 'Total'],
            ...parsed.line_items.map((item: any) => [
              item.description || '',
              item.quantity || '1',
              item.unit_price || '',
              item.total_price || ''
            ])
          ],
          confidence: 0.85,
          boundingBox: { x: 0, y: 0, width: 100, height: 50 }
        }] : undefined
      };
    } catch (error) {
      console.warn('Failed to parse enhanced OCR response, falling back to simple parsing:', error);

      // Fallback to simple parsing
      try {
        const parsed = JSON.parse(content);
        return {
          text: parsed.text || content,
          confidence: parsed.confidence || 0.85,
          blocks: [
            {
              text: parsed.text || content,
              confidence: parsed.confidence || 0.85,
              boundingBox: { x: 0, y: 0, width: 100, height: 100 },
              type: 'paragraph'
            }
          ],
          keyValuePairs: this.extractKeyValuesFromParsed(parsed)
        };
      } catch {
        // If not JSON at all, treat as plain text
        return {
          text: content,
          confidence: 0.75,
          blocks: [
            {
              text: content,
              confidence: 0.75,
              boundingBox: { x: 0, y: 0, width: 100, height: 100 },
              type: 'paragraph'
            }
          ],
          keyValuePairs: []
        };
      }
    }
  }

  private parseGoogleDocumentAIResponse(data: any): OCRResult {
    console.log('📄 Parsing Google Document AI response');

    const document = data.document;
    const text = document?.text || '';
    const entities = document?.entities || [];
    const pages = document?.pages || [];

    console.log('📊 Document AI extracted data:', {
      textLength: text.length,
      entitiesCount: entities.length,
      pagesCount: pages.length
    });

    // Extract structured financial data from entities and form fields
    const keyValuePairs: OCRKeyValue[] = [];
    const blocks: OCRBlock[] = [];

    // Parse entities for financial information
    entities.forEach((entity: any) => {
      const type = entity.type;
      const mentionText = entity.mentionText;
      const normalizedValue = entity.normalizedValue;
      const confidence = entity.confidence || 0.9;

      console.log(`📋 Document AI entity: ${type} = "${mentionText}" (confidence: ${confidence})`);

      // Map Document AI entity types to our expected fields
      switch (type) {
        case 'total_amount':
        case 'invoice_total':
        case 'net_amount':
        case 'line_item/amount':
          keyValuePairs.push({
            key: 'amount',
            value: this.extractNumericValue(normalizedValue?.moneyValue?.units || mentionText),
            confidence: confidence
          });
          break;

        case 'supplier_name':
        case 'vendor_name':
        case 'supplier_address':
          // Extract business name from supplier info
          const businessName = this.extractBusinessName(mentionText);
          if (businessName) {
            keyValuePairs.push({
              key: 'vendor_name',
              value: businessName,
              confidence: confidence
            });
          }
          break;

        case 'invoice_date':
        case 'receipt_date':
        case 'document_date':
          keyValuePairs.push({
            key: 'expense_date',
            value: this.formatDateFromDocumentAI(normalizedValue?.datetimeValue || mentionText),
            confidence: confidence
          });
          break;

        case 'vat_amount':
        case 'tax_amount':
        case 'total_tax_amount':
          keyValuePairs.push({
            key: 'tax_amount',
            value: this.extractNumericValue(normalizedValue?.moneyValue?.units || mentionText),
            confidence: confidence
          });
          break;

        case 'currency':
        case 'currency_code':
          keyValuePairs.push({
            key: 'currency_code',
            value: this.mapCurrency(normalizedValue?.text || mentionText),
            confidence: confidence
          });
          break;
      }
    });

    // If we didn't get structured entities, fall back to pattern matching
    if (keyValuePairs.length === 0) {
      return this.parseTextWithPatterns(text);
    }

    return {
      text,
      confidence: 0.95, // Document AI typically has high confidence
      blocks,
      keyValuePairs
    };
  }

  private parseGoogleVisionEnhancedResponse(annotations: any, filename: string): OCRResult {
    console.log('📄 Parsing enhanced Google Vision response');

    const fullText = annotations.fullTextAnnotation?.text || '';
    const textAnnotations = annotations.textAnnotations || [];

    // Use advanced pattern matching for financial documents
    return this.parseTextWithPatterns(fullText, textAnnotations);
  }

  private parseTextWithPatterns(text: string, textAnnotations?: any[]): OCRResult {
    const keyValuePairs: OCRKeyValue[] = [];
    const blocks: OCRBlock[] = [];

    // Advanced regex patterns for financial document parsing
    const patterns = {
      // Amount patterns - handles various currency formats
      amount: /(?:total|amount|sum|grand\s*total|final|charged|paid)[\s:$]*([€£$¥₹]?\s*[\d,]+\.?\d{0,2})/gi,

      // Vendor patterns - business name extraction
      vendor: /^([A-Z][A-Za-z\s&.-]+(?:LLC|LTD|INC|CORP|CO|COMPANY|RESTAURANT|STORE|SHOP|CAFE|BAR|HOTEL)?)/m,

      // Date patterns - multiple formats
      date: /(?:date|on|invoice\s*date)[\s:]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/gi,

      // Tax patterns
      tax: /(?:tax|vat|gst|hst)[\s:$]*([€£$¥₹]?\s*[\d,]+\.?\d{0,2})/gi,

      // Currency detection
      currency: /([€£$¥₹])|(?:USD|EUR|GBP|CAD|JPY|AUD)/gi
    };

    // Extract amounts
    let match;
    while ((match = patterns.amount.exec(text)) !== null) {
      const amount = this.extractNumericValue(match[1]);
      if (parseFloat(amount) > 0) {
        keyValuePairs.push({
          key: 'amount',
          value: amount,
          confidence: 0.9
        });
        break; // Take first valid amount
      }
    }

    // Extract vendor name - try to get the business name from the top of the document
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length > 3 && line.length < 50 && /[A-Za-z]/.test(line)) {
        // Skip obvious non-vendor lines
        if (!/\d{3,}|address|phone|email|receipt|invoice|#|date/i.test(line)) {
          keyValuePairs.push({
            key: 'vendor_name',
            value: line,
            confidence: 0.85
          });
          break;
        }
      }
    }

    // Extract date
    patterns.date.lastIndex = 0; // Reset regex
    match = patterns.date.exec(text);
    if (match) {
      keyValuePairs.push({
        key: 'expense_date',
        value: this.formatDate(match[1]),
        confidence: 0.9
      });
    }

    // Extract tax
    patterns.tax.lastIndex = 0; // Reset regex
    match = patterns.tax.exec(text);
    if (match) {
      keyValuePairs.push({
        key: 'tax_amount',
        value: this.extractNumericValue(match[1]),
        confidence: 0.85
      });
    }

    // Detect currency
    patterns.currency.lastIndex = 0; // Reset regex
    match = patterns.currency.exec(text);
    if (match) {
      keyValuePairs.push({
        key: 'currency_code',
        value: this.mapCurrency(match[0]),
        confidence: 0.95
      });
    }

    // Generate description
    if (keyValuePairs.find(kv => kv.key === 'vendor_name')) {
      const vendor = keyValuePairs.find(kv => kv.key === 'vendor_name')!.value;
      keyValuePairs.push({
        key: 'description',
        value: `Expense from ${vendor}`,
        confidence: 0.8
      });
    }

    return {
      text,
      confidence: 0.88,
      blocks: this.createBlocksFromText(text),
      keyValuePairs
    };
  }

  // Helper methods for parsing
  private extractNumericValue(text: string): string {
    const cleaned = text.replace(/[^\d.,]/g, '');
    const numeric = cleaned.replace(/,/g, '');
    return parseFloat(numeric).toFixed(2);
  }

  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        // Try parsing different formats
        const parts = dateStr.split(/[\/\-\.]/);
        if (parts.length === 3) {
          // Assume MM/DD/YYYY or DD/MM/YYYY
          const month = parseInt(parts[0]) > 12 ? parts[1] : parts[0];
          const day = parseInt(parts[0]) > 12 ? parts[0] : parts[1];
          const year = parts[2];
          return `${year.padStart(4, '20')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }
      return date.toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  private mapCurrency(text: string): string {
    const mapping: Record<string, string> = {
      '$': 'USD',
      '€': 'EUR',
      '£': 'GBP',
      '¥': 'JPY',
      '₹': 'INR',
      'USD': 'USD',
      'EUR': 'EUR',
      'GBP': 'GBP',
      'CAD': 'CAD',
      'JPY': 'JPY',
      'AUD': 'AUD'
    };
    return mapping[text] || 'USD';
  }

  private createBlocksFromText(text: string): OCRBlock[] {
    return text.split('\n').map((line, index) => ({
      text: line.trim(),
      confidence: 0.9,
      boundingBox: { x: 0, y: index * 20, width: 100, height: 18 },
      type: index === 0 ? 'title' as const : 'line' as const
    })).filter(block => block.text.length > 0);
  }

  private extractKeyValuesFromParsed(parsed: any): OCRKeyValue[] {
    const pairs: OCRKeyValue[] = [];

    if (parsed.vendor) pairs.push({ key: 'Vendor', value: parsed.vendor, confidence: 0.9 });
    if (parsed.amount) pairs.push({ key: 'Amount', value: parsed.amount, confidence: 0.95 });
    if (parsed.date) pairs.push({ key: 'Date', value: parsed.date, confidence: 0.9 });

    return pairs;
  }

  private extractVendorFromFilename(filename: string): string {
    const cleanName = filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    const words = cleanName.split(' ');
    return words.slice(0, 2).join(' ').replace(/\d+/g, '').trim() || 'Unknown Vendor';
  }

  /**
   * Validate and enhance OCR results with business logic
   */
  private validateAndEnhanceResult(result: OCRResult): OCRResult {
    const keyValueMap = new Map(result.keyValuePairs?.map(kv => [kv.key, kv]) || []);

    // Extract numeric values for validation
    const amount = parseFloat(keyValueMap.get('amount')?.value?.replace(/[^0-9.-]/g, '') || '0');
    const taxAmount = parseFloat(keyValueMap.get('tax_amount')?.value?.replace(/[^0-9.-]/g, '') || '0');

    // Validate mathematical consistency
    if (amount > 0 && taxAmount > 0) {
      const expectedTotal = amount + taxAmount;
      const taxPercentage = (taxAmount / amount) * 100;

      // Flag suspicious tax calculations
      if (taxPercentage > 25 || taxPercentage < 3) {
        console.warn(`🧮 Suspicious tax calculation: ${taxPercentage.toFixed(1)}% tax rate`);
        // Reduce confidence for tax amount
        const taxKV = keyValueMap.get('tax_amount');
        if (taxKV) {
          taxKV.confidence = Math.min(taxKV.confidence, 0.6);
        }
      }
    }

    // Validate date format
    const dateKV = keyValueMap.get('expense_date');
    if (dateKV) {
      const dateValue = dateKV.value;
      const parsedDate = new Date(dateValue);
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const oneMonthFromNow = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

      // Flag dates outside reasonable range
      if (parsedDate < oneYearAgo || parsedDate > oneMonthFromNow) {
        console.warn(`📅 Suspicious date: ${dateValue}`);
        dateKV.confidence = Math.min(dateKV.confidence, 0.7);
      }
    }

    // Enhance vendor name confidence based on length and content
    const vendorKV = keyValueMap.get('vendor_name');
    if (vendorKV) {
      const vendorName = vendorKV.value;
      if (vendorName.length < 3) {
        vendorKV.confidence = Math.min(vendorKV.confidence, 0.5);
      } else if (vendorName.length > 50) {
        vendorKV.confidence = Math.min(vendorKV.confidence, 0.7);
      }
    }

    // Validate amount is reasonable
    if (amount > 10000) {
      console.warn(`💰 Large amount detected: $${amount}`);
      const amountKV = keyValueMap.get('amount');
      if (amountKV) {
        amountKV.confidence = Math.min(amountKV.confidence, 0.8);
      }
    }

    // Convert map back to array
    result.keyValuePairs = Array.from(keyValueMap.values());

    return result;
  }

  /**
   * Extract business name from Document AI supplier text
   */
  private extractBusinessName(text: string): string | null {
    if (!text) return null;

    // Split by lines and find the business name (usually first non-empty line)
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    for (const line of lines) {
      // Skip addresses, phone numbers, emails
      if (line.includes('@') || /^\d+[\s\-\(\)]+/.test(line) || /(street|ave|road|suite)/i.test(line)) {
        continue;
      }

      // Look for business-like names
      if (line.length > 2 && line.length < 60 && /[A-Za-z]/.test(line)) {
        return line;
      }
    }

    return lines[0] || null;
  }

  /**
   * Format date from Google Document AI normalized value
   */
  private formatDateFromDocumentAI(dateValue: any): string {
    if (typeof dateValue === 'string') {
      try {
        const date = new Date(dateValue);
        return date.toISOString().split('T')[0];
      } catch {
        return dateValue;
      }
    }

    if (dateValue && typeof dateValue === 'object') {
      const { year, month, day } = dateValue;
      if (year && month && day) {
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    }

    return new Date().toISOString().split('T')[0];
  }

  /**
   * Map currency from Document AI to standard currency codes
   */
  private mapCurrency(currencyText: string): string {
    if (!currencyText) return 'USD';

    const currency = currencyText.toUpperCase();

    // Handle currency symbols
    if (currency.includes('$')) return 'USD';
    if (currency.includes('€')) return 'EUR';
    if (currency.includes('£')) return 'GBP';
    if (currency.includes('¥')) return 'JPY';

    // Handle currency codes
    const currencyMap: Record<string, string> = {
      'USD': 'USD', 'DOLLAR': 'USD', 'US': 'USD',
      'EUR': 'EUR', 'EURO': 'EUR',
      'GBP': 'GBP', 'POUND': 'GBP', 'STERLING': 'GBP',
      'CAD': 'CAD', 'CANADIAN': 'CAD',
      'AUD': 'AUD', 'AUSTRALIAN': 'AUD',
      'JPY': 'JPY', 'YEN': 'JPY'
    };

    return currencyMap[currency] || 'USD';
  }

  /**
   * Parse response from existing Supabase analyze-expense function
   */
  private parseSupabaseFunctionResponse(data: any): OCRResult {
    console.log('📄 Parsing Supabase function response');
    console.log('📊 Response data keys:', Object.keys(data));

    // Handle the existing function response format
    const keyValuePairs: OCRKeyValue[] = [];

    // Map vendor_name
    if (data.vendor_name) {
      keyValuePairs.push({
        key: 'vendor_name',
        value: data.vendor_name,
        confidence: data.ai_confidence_score || 0.9
      });
    }

    // Map amount (from original_currency_amount or amount)
    const amount = data.original_currency_amount || data.amount;
    if (amount) {
      keyValuePairs.push({
        key: 'amount',
        value: amount.toString(),
        confidence: data.ai_confidence_score || 0.9
      });
    }

    // Map expense_date
    if (data.expense_date) {
      keyValuePairs.push({
        key: 'expense_date',
        value: data.expense_date,
        confidence: data.ai_confidence_score || 0.9
      });
    }

    // Map tax_amount
    if (data.tax_amount) {
      keyValuePairs.push({
        key: 'tax_amount',
        value: data.tax_amount.toString(),
        confidence: data.ai_confidence_score || 0.8
      });
    }

    // Map currency_code with smart detection based on tax patterns
    let currency = data.original_currency_code || data.currency_code;
    let currencyConfidence = 0.95;

    // Smart currency detection based on tax patterns
    if (!currency || currency === 'USD') {
      const textContent = data.receipt_summary || data.raw_text || '';
      const smartCurrency = this.detectCurrencyFromTaxPatterns(data, textContent);
      if (smartCurrency.currency !== currency) {
        currency = smartCurrency.currency;
        currencyConfidence = smartCurrency.confidence;
        console.log(`💰 Smart currency detection: ${currency} (${Math.round(currencyConfidence * 100)}% confidence based on ${smartCurrency.reason})`);
      }
    }

    if (currency) {
      keyValuePairs.push({
        key: 'currency_code',
        value: currency,
        confidence: currencyConfidence
      });
    }

    // Map description
    if (data.description) {
      keyValuePairs.push({
        key: 'description',
        value: data.description,
        confidence: data.ai_confidence_score || 0.8
      });
    }

    // Map category if present
    if (data.category_id) {
      keyValuePairs.push({
        key: 'category',
        value: data.category_id,
        confidence: data.ai_confidence_score || 0.7
      });
    }

    // Map gl_account_code if present
    if (data.gl_account_code) {
      keyValuePairs.push({
        key: 'gl_account_code',
        value: data.gl_account_code,
        confidence: data.ai_confidence_score || 0.7
      });
    }

    return {
      text: data.receipt_summary || data.raw_text || '',
      confidence: data.ai_confidence_score || 0.8,
      blocks: [],
      keyValuePairs: keyValuePairs
    };
  }

  /**
   * Smart currency detection based on tax patterns and context clues
   */
  private detectCurrencyFromTaxPatterns(data: any, text: string): {
    currency: string;
    confidence: number;
    reason: string;
  } {
    const defaultCurrency = 'USD';
    const lowConfidence = 0.6;
    const mediumConfidence = 0.8;
    const highConfidence = 0.95;

    // Convert text to lowercase for pattern matching
    const lowerText = text.toLowerCase();
    const taxAmount = data.tax_amount || 0;
    const totalAmount = data.original_currency_amount || data.amount || 0;

    console.log(`🔍 Currency detection analyzing text: "${text.substring(0, 200)}${text.length > 200 ? '...' : ''}"`);
    console.log(`💰 Tax amount: ${taxAmount}, Total amount: ${totalAmount}`);

    // Canadian indicators - Enhanced patterns
    const canadianTaxPatterns = [
      /\bhst\b/i,                    // Harmonized Sales Tax (Canada)
      /\bgst\b/i,                    // Goods and Services Tax (Canada)
      /\bpst\b/i,                    // Provincial Sales Tax (Canada)
      /\bqst\b/i,                    // Quebec Sales Tax (Canada)
      /harmonized.*sales.*tax/i,      // Full HST name
      /goods.*services.*tax/i,        // Full GST name
      /provincial.*sales.*tax/i,      // Full PST name
      /quebec.*sales.*tax/i,          // Full QST name
      /tax.*13%/i,                   // 13% HST rate
      /tax.*15%/i,                   // 15% HST rate (Atlantic provinces)
      /tax.*5%/i,                    // 5% GST rate
      /tax.*12%/i,                   // 12% HST rate (BC, SK)
      /tax.*14\.975%/i,             // QST rate
      /tax.*9\.975%/i,              // QST rate variant
      /hst.*13/i,                   // HST with rate
      /hst.*15/i,                   // HST with rate
      /gst.*5/i,                    // GST with rate
      /13%.*hst/i,                  // Rate before HST
      /15%.*hst/i,                  // Rate before HST
      /5%.*gst/i,                   // Rate before GST
    ];

    // US indicators
    const usTaxPatterns = [
      /sales\s*tax/i,       // Sales Tax (US)
      /state\s*tax/i,       // State Tax (US)
      /city\s*tax/i,        // City Tax (US)
      /local\s*tax/i,       // Local Tax (US)
      /\bsale\s*tx\b/i,    // Abbreviated sales tax
    ];

    // Currency symbol detection in text
    const currencySymbols = {
      CAD: [/\$\s*cad\b/i, /cad\s*\$/i, /canadian/i],
      USD: [/\$\s*usd\b/i, /usd\s*\$/i, /us\s*dollar/i, /american/i]
    };

    // Check for explicit currency mentions
    for (const [curr, patterns] of Object.entries(currencySymbols)) {
      for (const pattern of patterns) {
        if (pattern.test(lowerText)) {
          return {
            currency: curr,
            confidence: highConfidence,
            reason: `explicit ${curr} currency symbol/text found`
          };
        }
      }
    }

    // Check Canadian tax patterns
    for (const pattern of canadianTaxPatterns) {
      if (pattern.test(lowerText)) {
        return {
          currency: 'CAD',
          confidence: highConfidence,
          reason: 'Canadian tax type detected (HST/GST/PST/QST)'
        };
      }
    }

    // Check US tax patterns
    for (const pattern of usTaxPatterns) {
      if (pattern.test(lowerText)) {
        return {
          currency: 'USD',
          confidence: mediumConfidence,
          reason: 'US tax type detected (sales/state/local tax)'
        };
      }
    }

    // Tax rate analysis (if we have both tax amount and total)
    if (taxAmount > 0 && totalAmount > 0) {
      const taxRate = (taxAmount / (totalAmount - taxAmount)) * 100;

      // Canadian tax rates
      if (taxRate >= 12.5 && taxRate <= 15.5) {
        return {
          currency: 'CAD',
          confidence: highConfidence,
          reason: `${taxRate.toFixed(1)}% tax rate matches Canadian HST`
        };
      }

      if (taxRate >= 4.5 && taxRate <= 5.5) {
        return {
          currency: 'CAD',
          confidence: mediumConfidence,
          reason: `${taxRate.toFixed(1)}% tax rate matches Canadian GST`
        };
      }

      // US tax rates (varies widely by state, 0-11%)
      if (taxRate >= 6 && taxRate <= 11) {
        return {
          currency: 'USD',
          confidence: mediumConfidence,
          reason: `${taxRate.toFixed(1)}% tax rate matches typical US sales tax`
        };
      }

      // Zero tax could indicate international purchase by Canadian company
      if (taxRate === 0 && totalAmount > 50) {
        return {
          currency: 'USD',
          confidence: lowConfidence,
          reason: 'no tax detected - possibly international purchase'
        };
      }
    }

    // Vendor name analysis for known chains
    const vendorName = (data.vendor_name || '').toLowerCase();
    const canadianChains = [
      'tim hortons', 'canadian tire', 'loblaws', 'metro', 'sobeys',
      'rona', 'home hardware', 'lcbo', 'saq', 'petro-canada'
    ];
    const usChains = [
      'walmart', 'target', 'home depot', 'lowes', 'best buy',
      'mcdonalds', 'starbucks', 'amazon', 'costco'
    ];

    for (const chain of canadianChains) {
      if (vendorName.includes(chain)) {
        return {
          currency: 'CAD',
          confidence: mediumConfidence,
          reason: `Canadian vendor chain detected: ${chain}`
        };
      }
    }

    for (const chain of usChains) {
      if (vendorName.includes(chain)) {
        return {
          currency: 'USD',
          confidence: lowConfidence, // Lower confidence as these chains exist in both countries
          reason: `US vendor chain detected: ${chain}`
        };
      }
    }

    // Default fallback
    return {
      currency: defaultCurrency,
      confidence: lowConfidence,
      reason: 'no clear currency indicators found'
    };
  }
}