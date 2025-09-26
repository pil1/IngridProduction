/**
 * Currency Intelligence Service
 *
 * Advanced tax-aware currency detection that leverages company context,
 * sophisticated tax pattern recognition, and intelligent fallback logic
 * to accurately determine invoice currencies and flag potential mismatches.
 */

import { supabase } from '@/integrations/supabase/client';

export interface TaxJurisdiction {
  code: string; // 'CA', 'US', 'UK', etc.
  name: string;
  currency: string;
  confidence: number;
  reason: string;
  patterns: RegExp[];
}

export interface CurrencyDetectionResult {
  currency: string;
  confidence: number;
  reason: string;
  jurisdiction?: TaxJurisdiction;
  companyMismatch: boolean; // True if detected currency differs from company default
  suggestedAction?: 'accept' | 'verify' | 'override';
  warnings: string[];
}

export interface TaxBreakdown {
  taxType: string; // 'HST', 'GST', 'Sales Tax', etc.
  rate: number; // Tax rate as decimal (0.13 = 13%)
  amount: number;
  baseAmount: number; // Amount before tax
  jurisdiction: string;
  confidence: number;
}

export interface CompanyTaxContext {
  companyId: string;
  defaultCurrency: string;
  country: string;
  expectedTaxTypes: string[];
}

export class CurrencyIntelligenceService {
  private static instance: CurrencyIntelligenceService;

  public static getInstance(): CurrencyIntelligenceService {
    if (!CurrencyIntelligenceService.instance) {
      CurrencyIntelligenceService.instance = new CurrencyIntelligenceService();
    }
    return CurrencyIntelligenceService.instance;
  }

  private taxJurisdictions: TaxJurisdiction[] = [
    {
      code: 'CA',
      name: 'Canada',
      currency: 'CAD',
      confidence: 0.95,
      reason: 'Canadian tax type detected',
      patterns: [
        /\bhst\b/i,                           // Harmonized Sales Tax
        /\bgst\b/i,                           // Goods and Services Tax
        /\bpst\b/i,                           // Provincial Sales Tax
        /\bqst\b/i,                           // Quebec Sales Tax
        /harmonized.*sales.*tax/i,
        /goods.*services.*tax/i,
        /provincial.*sales.*tax/i,
        /quebec.*sales.*tax/i,
        /tax.*13%/i,                          // 13% HST rate
        /tax.*15%/i,                          // 15% HST rate (Atlantic)
        /tax.*5%/i,                           // 5% GST rate
        /tax.*12%/i,                          // 12% HST rate (BC, SK)
        /tax.*14\.975%/i,                     // QST rate
        /hst.*1[35]/i,                        // HST with rate
        /gst.*5/i,                            // GST with rate
        /1[35]%.*hst/i,                       // Rate before HST
        /5%.*gst/i,                           // Rate before GST
      ]
    },
    {
      code: 'US',
      name: 'United States',
      currency: 'USD',
      confidence: 0.85,
      reason: 'US tax type detected',
      patterns: [
        /sales\s*tax/i,
        /state\s*tax/i,
        /city\s*tax/i,
        /local\s*tax/i,
        /\bsale\s*tx\b/i,                     // Abbreviated sales tax
        /municipal.*tax/i,
        /county.*tax/i,
        /district.*tax/i,
      ]
    },
    {
      code: 'UK',
      name: 'United Kingdom',
      currency: 'GBP',
      confidence: 0.90,
      reason: 'UK VAT detected',
      patterns: [
        /\bvat\b/i,                           // Value Added Tax
        /value.*added.*tax/i,
        /tax.*20%/i,                          // Standard UK VAT rate
        /20%.*vat/i,
        /vat.*20/i,
      ]
    },
    {
      code: 'EU',
      name: 'European Union',
      currency: 'EUR',
      confidence: 0.80,
      reason: 'EU VAT detected',
      patterns: [
        /\biva\b/i,                           // Spanish/Italian VAT
        /\bmva\b/i,                           // Mehrwertsteuer (German VAT)
        /mehrwertsteuer/i,
        /taxe.*valeur.*ajoutée/i,             // French VAT
        /btw/i,                               // Dutch VAT
      ]
    }
  ];

  /**
   * Main currency detection method that considers company context
   */
  async detectCurrency(
    documentText: string,
    extractedData: any,
    companyId: string
  ): Promise<CurrencyDetectionResult> {
    console.log('🔍 Starting intelligent currency detection');

    try {
      // Get company tax context
      const companyContext = await this.getCompanyTaxContext(companyId);

      // Step 1: Check for explicit currency mentions
      const explicitCurrency = this.detectExplicitCurrency(documentText);
      if (explicitCurrency) {
        return this.buildResult(explicitCurrency, companyContext, 'explicit currency found');
      }

      // Step 2: Tax-based jurisdiction detection
      const taxJurisdiction = this.detectTaxJurisdiction(documentText, extractedData);
      if (taxJurisdiction) {
        return this.buildResult(taxJurisdiction.currency, companyContext, taxJurisdiction.reason);
      }

      // Step 3: Tax rate analysis
      const rateBasedCurrency = this.detectCurrencyByTaxRate(extractedData);
      if (rateBasedCurrency) {
        return this.buildResult(rateBasedCurrency.currency, companyContext, rateBasedCurrency.reason);
      }

      // Step 4: Currency symbol detection
      const symbolCurrency = this.detectCurrencySymbols(documentText);
      if (symbolCurrency) {
        return this.buildResult(symbolCurrency.currency, companyContext, symbolCurrency.reason);
      }

      // Step 5: No tax detected - foreign currency logic
      if (!this.hasTaxAmount(extractedData)) {
        const foreignCurrency = this.detectForeignCurrency(companyContext);
        return this.buildResult(foreignCurrency.currency, companyContext, foreignCurrency.reason);
      }

      // Fallback to company default
      return this.buildResult(companyContext.defaultCurrency, companyContext, 'fallback to company default');

    } catch (error) {
      console.error('❌ Currency detection error:', error);
      return this.buildErrorResult(companyId);
    }
  }

  /**
   * Get company tax context from database
   */
  private async getCompanyTaxContext(companyId: string): Promise<CompanyTaxContext> {
    const { data: companySettings, error } = await supabase
      .from('company_settings')
      .select('currency')
      .eq('company_id', companyId)
      .single();

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('country')
      .eq('id', companyId)
      .single();

    if (error || companyError) {
      console.warn('⚠️ Could not fetch company context, using defaults');
      return {
        companyId,
        defaultCurrency: 'USD',
        country: 'United States',
        expectedTaxTypes: ['sales tax', 'state tax']
      };
    }

    const country = company?.country || 'United States';
    const currency = companySettings?.currency || 'USD';

    // Map country to expected tax types
    const expectedTaxTypes = this.getExpectedTaxTypes(country);

    return {
      companyId,
      defaultCurrency: currency,
      country,
      expectedTaxTypes
    };
  }

  /**
   * Detect explicit currency mentions in text
   */
  private detectExplicitCurrency(text: string): string | null {
    const lowerText = text.toLowerCase();

    const currencyPatterns = [
      { currency: 'CAD', patterns: [/\$\s*cad\b/i, /cad\s*\$/i, /canadian.*dollar/i] },
      { currency: 'USD', patterns: [/\$\s*usd\b/i, /usd\s*\$/i, /us.*dollar/i, /american.*dollar/i] },
      { currency: 'GBP', patterns: [/£/i, /\bpound/i, /sterling/i, /gbp/i] },
      { currency: 'EUR', patterns: [/€/i, /euro/i, /eur\b/i] }
    ];

    for (const { currency, patterns } of currencyPatterns) {
      if (patterns.some(pattern => pattern.test(lowerText))) {
        console.log(`💰 Explicit currency detected: ${currency}`);
        return currency;
      }
    }

    return null;
  }

  /**
   * Detect tax jurisdiction from text patterns
   */
  private detectTaxJurisdiction(text: string, data: any): TaxJurisdiction | null {
    const lowerText = text.toLowerCase();

    for (const jurisdiction of this.taxJurisdictions) {
      for (const pattern of jurisdiction.patterns) {
        if (pattern.test(lowerText)) {
          console.log(`🏛️ Tax jurisdiction detected: ${jurisdiction.name} (${jurisdiction.currency})`);
          return jurisdiction;
        }
      }
    }

    return null;
  }

  /**
   * Detect currency based on tax rate analysis
   */
  private detectCurrencyByTaxRate(data: any): { currency: string; reason: string } | null {
    const taxAmount = data.tax_amount || 0;
    const totalAmount = data.amount || data.original_currency_amount || 0;

    if (taxAmount <= 0 || totalAmount <= 0) {
      return null;
    }

    const taxRate = (taxAmount / (totalAmount - taxAmount)) * 100;
    console.log(`📊 Calculated tax rate: ${taxRate.toFixed(2)}%`);

    // Canadian tax rates
    if (taxRate >= 12.5 && taxRate <= 15.5) {
      return {
        currency: 'CAD',
        reason: `${taxRate.toFixed(1)}% tax rate matches Canadian HST`
      };
    }

    if (taxRate >= 4.5 && taxRate <= 5.5) {
      return {
        currency: 'CAD',
        reason: `${taxRate.toFixed(1)}% tax rate matches Canadian GST`
      };
    }

    // UK VAT
    if (taxRate >= 19.5 && taxRate <= 20.5) {
      return {
        currency: 'GBP',
        reason: `${taxRate.toFixed(1)}% tax rate matches UK VAT`
      };
    }

    // EU VAT (varied rates)
    if (taxRate >= 18 && taxRate <= 27) {
      return {
        currency: 'EUR',
        reason: `${taxRate.toFixed(1)}% tax rate matches EU VAT`
      };
    }

    return null;
  }

  /**
   * Detect currency from symbols in text
   */
  private detectCurrencySymbols(text: string): { currency: string; reason: string } | null {
    if (/£/.test(text)) {
      return { currency: 'GBP', reason: 'British pound symbol (£) detected' };
    }
    if (/€/.test(text)) {
      return { currency: 'EUR', reason: 'Euro symbol (€) detected' };
    }
    // Note: $ symbol is ambiguous (could be CAD, USD, AUD, etc.)
    return null;
  }

  /**
   * Detect foreign currency scenario (no tax = likely foreign)
   */
  private detectForeignCurrency(companyContext: CompanyTaxContext): { currency: string; reason: string } {
    // If no tax detected, likely a foreign currency invoice
    const foreignCurrency = companyContext.defaultCurrency === 'CAD' ? 'USD' : 'CAD';

    return {
      currency: foreignCurrency,
      reason: `No tax detected - likely foreign currency (${foreignCurrency}) for ${companyContext.country} company`
    };
  }

  /**
   * Check if tax amount is present in the data
   */
  private hasTaxAmount(data: any): boolean {
    return (data.tax_amount && data.tax_amount > 0) ||
           (data.taxes && Array.isArray(data.taxes) && data.taxes.length > 0);
  }

  /**
   * Get expected tax types for a country
   */
  private getExpectedTaxTypes(country: string): string[] {
    const countryTaxMap: Record<string, string[]> = {
      'Canada': ['HST', 'GST', 'PST', 'QST'],
      'United States': ['Sales Tax', 'State Tax', 'Local Tax'],
      'United Kingdom': ['VAT'],
      'Germany': ['Mehrwertsteuer', 'VAT'],
      'France': ['TVA', 'VAT'],
      'Spain': ['IVA', 'VAT'],
      'Italy': ['IVA', 'VAT']
    };

    return countryTaxMap[country] || ['Sales Tax'];
  }

  /**
   * Build the final currency detection result
   */
  private buildResult(
    detectedCurrency: string,
    companyContext: CompanyTaxContext,
    reason: string
  ): CurrencyDetectionResult {
    const companyMismatch = detectedCurrency !== companyContext.defaultCurrency;
    const confidence = this.calculateConfidence(reason, companyMismatch);

    const warnings = [];
    let suggestedAction: 'accept' | 'verify' | 'override' = 'accept';

    if (companyMismatch) {
      warnings.push(`Detected currency (${detectedCurrency}) differs from company default (${companyContext.defaultCurrency})`);
      suggestedAction = confidence > 0.8 ? 'verify' : 'override';
    }

    return {
      currency: detectedCurrency,
      confidence,
      reason,
      companyMismatch,
      suggestedAction,
      warnings
    };
  }

  /**
   * Calculate confidence based on detection method
   */
  private calculateConfidence(reason: string, companyMismatch: boolean): number {
    let baseConfidence = 0.8;

    if (reason.includes('explicit')) baseConfidence = 0.98;
    else if (reason.includes('tax rate matches')) baseConfidence = 0.95;
    else if (reason.includes('tax type detected')) baseConfidence = 0.90;
    else if (reason.includes('symbol detected')) baseConfidence = 0.75;
    else if (reason.includes('foreign currency')) baseConfidence = 0.70;
    else if (reason.includes('fallback')) baseConfidence = 0.60;

    // Reduce confidence if there's a company mismatch
    if (companyMismatch) {
      baseConfidence *= 0.85;
    }

    return Math.round(baseConfidence * 100) / 100;
  }

  /**
   * Build error result when detection fails
   */
  private buildErrorResult(companyId: string): CurrencyDetectionResult {
    return {
      currency: 'USD', // Safe fallback
      confidence: 0.1,
      reason: 'Currency detection failed - using fallback',
      companyMismatch: true,
      suggestedAction: 'override',
      warnings: ['Currency detection service encountered an error']
    };
  }

  /**
   * Extract detailed tax breakdown from document data
   */
  extractTaxBreakdown(documentText: string, extractedData: any): TaxBreakdown[] {
    const breakdowns: TaxBreakdown[] = [];
    const lowerText = documentText.toLowerCase();

    // Extract various tax components
    const taxPatterns = [
      { type: 'HST', pattern: /hst[\s:$]*([€£$¥₹]?\s*[\d,]+\.?\d{0,2})/gi, jurisdiction: 'Canada' },
      { type: 'GST', pattern: /gst[\s:$]*([€£$¥₹]?\s*[\d,]+\.?\d{0,2})/gi, jurisdiction: 'Canada' },
      { type: 'PST', pattern: /pst[\s:$]*([€£$¥₹]?\s*[\d,]+\.?\d{0,2})/gi, jurisdiction: 'Canada' },
      { type: 'Sales Tax', pattern: /sales[\s]*tax[\s:$]*([€£$¥₹]?\s*[\d,]+\.?\d{0,2})/gi, jurisdiction: 'US' },
      { type: 'VAT', pattern: /vat[\s:$]*([€£$¥₹]?\s*[\d,]+\.?\d{0,2})/gi, jurisdiction: 'UK/EU' }
    ];

    for (const { type, pattern, jurisdiction } of taxPatterns) {
      const matches = lowerText.match(pattern);
      if (matches && matches.length > 0) {
        // Extract numeric value
        const amountMatch = matches[0].match(/[\d,]+\.?\d{0,2}/);
        if (amountMatch) {
          const amount = parseFloat(amountMatch[0].replace(/,/g, ''));
          if (amount > 0) {
            breakdowns.push({
              taxType: type,
              amount,
              rate: this.estimateTaxRate(type, amount, extractedData.amount),
              baseAmount: extractedData.amount - amount,
              jurisdiction,
              confidence: 0.85
            });
          }
        }
      }
    }

    return breakdowns;
  }

  /**
   * Estimate tax rate based on tax type and amounts
   */
  private estimateTaxRate(taxType: string, taxAmount: number, totalAmount: number): number {
    if (!totalAmount || totalAmount <= taxAmount) return 0;

    const calculatedRate = (taxAmount / (totalAmount - taxAmount)) * 100;

    // Round to common tax rates
    const commonRates = [5, 12, 13, 15, 20, 25];
    const closest = commonRates.reduce((prev, curr) =>
      Math.abs(curr - calculatedRate) < Math.abs(prev - calculatedRate) ? curr : prev
    );

    return closest / 100; // Return as decimal
  }
}

export const currencyIntelligenceService = CurrencyIntelligenceService.getInstance();