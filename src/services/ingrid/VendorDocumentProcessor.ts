/**
 * Vendor Document Processor
 *
 * AI-powered vendor document processing for automatic vendor creation.
 * Extracts vendor information from invoices, receipts, emails, and business cards.
 */

import { DocumentAnalysis, ActionCard, WebEnrichmentResult, IngridConfig } from '@/types/ingrid';
import { OCRService, OCRResult } from './OCRService';
import { WebEnrichmentService } from './WebEnrichmentService';

export interface VendorDocumentData {
  vendorName?: string;
  companyName?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  taxId?: string;
  businessNumber?: string;
  accountNumber?: string;
  paymentTerms?: string;
  currency?: string;
  industry?: string;
  notes?: string;
}

export interface VendorDocumentAnalysis extends DocumentAnalysis {
  documentType: 'invoice' | 'receipt' | 'business_card' | 'email' | 'other';
  extractedData: VendorDocumentData;
  webEnrichment?: WebEnrichmentResult;
  duplicateCheck?: {
    existingVendors: any[];
    potentialDuplicates: any[];
    confidence: number;
  };
  confidence: number;
  suggestions: string[];
}

export interface VendorProcessingResult {
  analysis: VendorDocumentAnalysis;
  actionCards: ActionCard[];
  message: string;
  prefillData: Record<string, any>;
  confidence: number;
}

export class VendorDocumentProcessor {
  private ocrService: OCRService;
  private webEnrichment: WebEnrichmentService;

  constructor(config?: IngridConfig) {
    this.ocrService = new OCRService(config || {} as IngridConfig);
    this.webEnrichment = new WebEnrichmentService(config);
  }

  /**
   * Process vendor document and extract vendor information
   */
  async processVendorDocument(
    documentFile: File,
    userContext: { userId: string; companyId: string; role: string }
  ): Promise<VendorProcessingResult> {
    try {
      console.log(`📄 VendorDocumentProcessor: Processing ${documentFile.name}`);

      // Step 1: OCR extraction using existing Google Document AI
      const ocrResult = await this.ocrService.processDocument(documentFile);
      const vendorData = this.parseVendorData(ocrResult, documentFile.name);

      console.log(`🏢 Extracted vendor: ${vendorData.vendorName || 'Unknown'}`);

      // Step 2: Determine document type
      const documentType = this.determineDocumentType(ocrResult.text, documentFile.name);

      // Step 3: Web enrichment for vendor data
      let webEnrichment: WebEnrichmentResult | undefined;
      if (vendorData.vendorName || vendorData.companyName) {
        try {
          const searchName = vendorData.vendorName || vendorData.companyName!;
          webEnrichment = await this.webEnrichment.enrichVendorData(
            searchName,
            vendorData.website || vendorData.email
          );
          console.log(`🌐 Web enrichment complete: ${webEnrichment?.confidence || 0}% confidence`);
        } catch (error) {
          console.warn(`🌐 Web enrichment failed:`, error);
        }
      }

      // Step 4: Merge web enrichment with extracted data
      const enhancedVendorData = this.mergeWithWebEnrichment(vendorData, webEnrichment);

      // Step 5: Check for duplicate vendors
      const duplicateCheck = await this.checkForDuplicateVendors(enhancedVendorData, userContext.companyId);

      // Step 6: Calculate confidence and generate suggestions
      const confidence = this.calculateConfidence(enhancedVendorData, webEnrichment, ocrResult);
      const suggestions = this.generateSuggestions(enhancedVendorData, duplicateCheck, documentType);

      // Step 7: Create analysis object
      const analysis: VendorDocumentAnalysis = {
        documentType,
        extractedData: enhancedVendorData,
        webEnrichment,
        duplicateCheck,
        confidence,
        suggestions
      };

      // Step 8: Generate prefill data for vendor form
      const prefillData = this.generatePrefillData(enhancedVendorData, webEnrichment);

      // Step 9: Generate action cards
      const actionCards = this.generateActionCards(analysis, userContext);

      // Step 10: Generate conversational message
      const message = this.generateConversationalMessage(analysis, actionCards);

      console.log(`✅ Vendor document processing complete: ${confidence}% confidence`);

      return {
        analysis,
        actionCards,
        message,
        prefillData,
        confidence
      };

    } catch (error) {
      console.error('🚨 Vendor document processing error:', error);

      // Return fallback result
      const fallbackData: VendorDocumentData = { vendorName: 'Unknown Vendor' };
      return {
        analysis: {
          documentType: 'other',
          extractedData: fallbackData,
          confidence: 0.1,
          suggestions: ['Please verify the document quality and try again']
        },
        actionCards: [],
        message: "I had trouble reading this document. Could you try a clearer image or enter the vendor details manually?",
        prefillData: {},
        confidence: 0.1
      };
    }
  }

  /**
   * Parse OCR result into vendor data structure
   */
  private parseVendorData(ocrResult: OCRResult, filename: string): VendorDocumentData {
    const data: VendorDocumentData = {};

    // Extract from OCR key-value pairs
    if (ocrResult.keyValuePairs) {
      for (const kv of ocrResult.keyValuePairs) {
        switch (kv.key) {
          case 'vendor_name':
            data.vendorName = kv.value;
            data.companyName = kv.value;
            break;
          case 'amount':
            // We can use amount info to improve confidence but not store it
            break;
          case 'expense_date':
            // Date info helps with document classification
            break;
          case 'tax_amount':
            // Tax info helps with location/currency detection
            break;
          case 'currency_code':
            data.currency = kv.value;
            break;
          case 'description':
            if (!data.notes) {
              data.notes = kv.value;
            }
            break;
        }
      }
    }

    // Fallback: parse from raw text using patterns
    if (!data.vendorName) {
      data.vendorName = this.extractVendorNameFromText(ocrResult.text);
      data.companyName = data.vendorName;
    }

    // Extract contact information using patterns
    const contactInfo = this.extractContactInfo(ocrResult.text);
    Object.assign(data, contactInfo);

    // Extract address information
    const addressInfo = this.extractAddressInfo(ocrResult.text);
    if (addressInfo) {
      data.address = addressInfo;
    }

    return data;
  }

  /**
   * Extract vendor name from text using intelligent patterns
   */
  private extractVendorNameFromText(text: string): string | undefined {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];

      // Skip obvious non-vendor lines
      if (this.isNonVendorLine(line)) continue;

      // Look for company-like patterns
      if (this.isCompanyName(line)) {
        return line;
      }
    }

    // Try to find business entity suffixes
    for (const line of lines.slice(0, 10)) {
      if (/(LLC|LTD|INC|CORP|CORPORATION|COMPANY|CO\.|GROUP|ASSOCIATES|PARTNERS|SOLUTIONS|SERVICES|SYSTEMS)$/i.test(line)) {
        return line;
      }
    }

    return undefined;
  }

  /**
   * Check if line is unlikely to be a vendor name
   */
  private isNonVendorLine(line: string): boolean {
    const nonVendorPatterns = [
      /^\d+$/, // Pure numbers
      /^[\d\s\-\(\)]+$/, // Phone numbers
      /invoice|receipt|bill|statement|date|total|amount|tax|subtotal/i,
      /@/, // Email addresses
      /^\$/, // Currency amounts
      /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})$/, // Dates
      /^thank you|visit|return|address|phone|email|website/i
    ];

    return nonVendorPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if line looks like a company name
   */
  private isCompanyName(line: string): boolean {
    // Good length for company names
    if (line.length < 2 || line.length > 80) return false;

    // Contains letters
    if (!/[A-Za-z]/.test(line)) return false;

    // Not just a single word unless it's clearly a business
    const words = line.split(/\s+/);
    if (words.length === 1 && !/restaurant|cafe|shop|store|market|hotel|inn|bar|pub/i.test(line)) {
      return false;
    }

    return true;
  }

  /**
   * Extract contact information using patterns
   */
  private extractContactInfo(text: string): Partial<VendorDocumentData> {
    const info: Partial<VendorDocumentData> = {};

    // Email extraction
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      info.email = emailMatch[1].toLowerCase();
    }

    // Phone extraction
    const phoneMatch = text.match(/(\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/);
    if (phoneMatch) {
      info.phone = this.formatPhone(phoneMatch[1]);
    }

    // Website extraction
    const websiteMatch = text.match(/((?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/);
    if (websiteMatch) {
      let website = websiteMatch[1];
      if (!website.startsWith('http')) {
        website = 'https://' + website;
      }
      info.website = website;
    }

    return info;
  }

  /**
   * Extract address information
   */
  private extractAddressInfo(text: string): VendorDocumentData['address'] | undefined {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    for (const line of lines) {
      // Look for address patterns
      if (line.match(/\d+.*?(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|place|pl)/i)) {
        return this.parseAddress(line);
      }

      // Look for ZIP codes
      if (line.match(/\b\d{5}(-\d{4})?\b/) || line.match(/\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/)) {
        return this.parseAddress(line);
      }
    }

    return undefined;
  }

  /**
   * Parse address line into components
   */
  private parseAddress(addressLine: string): VendorDocumentData['address'] {
    // Simple address parsing - could be enhanced
    const parts = addressLine.split(',').map(part => part.trim());

    if (parts.length >= 2) {
      return {
        line1: parts[0],
        city: parts[1],
        state: parts[2],
        postalCode: this.extractPostalCode(addressLine)
      };
    }

    return {
      line1: addressLine,
      postalCode: this.extractPostalCode(addressLine)
    };
  }

  /**
   * Extract postal code from address
   */
  private extractPostalCode(text: string): string | undefined {
    // US ZIP code
    const zipMatch = text.match(/\b\d{5}(-\d{4})?\b/);
    if (zipMatch) return zipMatch[0];

    // Canadian postal code
    const postalMatch = text.match(/\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/);
    if (postalMatch) return postalMatch[0];

    return undefined;
  }

  /**
   * Format phone number consistently
   */
  private formatPhone(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    return cleaned;
  }

  /**
   * Determine document type based on content
   */
  private determineDocumentType(text: string, filename: string): VendorDocumentAnalysis['documentType'] {
    const lowerText = text.toLowerCase();
    const lowerFilename = filename.toLowerCase();

    // Invoice patterns
    if (lowerText.includes('invoice') || lowerText.includes('bill to') || lowerText.includes('due date') ||
        lowerFilename.includes('invoice')) {
      return 'invoice';
    }

    // Receipt patterns
    if (lowerText.includes('receipt') || lowerText.includes('thank you') || lowerText.includes('total') ||
        lowerFilename.includes('receipt')) {
      return 'receipt';
    }

    // Business card patterns
    if (lowerText.match(/\b(ceo|cto|president|director|manager)\b/) ||
        (lowerText.includes('@') && lowerText.length < 500)) {
      return 'business_card';
    }

    // Email patterns
    if (lowerText.includes('from:') || lowerText.includes('subject:') ||
        lowerFilename.includes('email') || lowerFilename.includes('.msg')) {
      return 'email';
    }

    return 'other';
  }

  /**
   * Merge extracted data with web enrichment
   */
  private mergeWithWebEnrichment(
    vendorData: VendorDocumentData,
    webEnrichment?: WebEnrichmentResult
  ): VendorDocumentData {
    if (!webEnrichment) return vendorData;

    return {
      ...vendorData,
      // Prefer extracted data over web data for core fields
      vendorName: vendorData.vendorName || webEnrichment.companyName,
      companyName: vendorData.companyName || webEnrichment.companyName,
      // Use web data to fill gaps
      email: vendorData.email || webEnrichment.email,
      phone: vendorData.phone || webEnrichment.phone,
      website: vendorData.website || webEnrichment.website,
      // Merge address data
      address: {
        ...webEnrichment.address,
        ...vendorData.address // Extracted address takes priority
      },
      industry: webEnrichment.industry,
      // Append web description to notes
      notes: [vendorData.notes, webEnrichment.description].filter(Boolean).join('\n\n')
    };
  }

  /**
   * Check for duplicate vendors in the system
   */
  private async checkForDuplicateVendors(
    vendorData: VendorDocumentData,
    companyId: string
  ): Promise<VendorDocumentAnalysis['duplicateCheck']> {
    try {
      // This would integrate with the existing VendorMappingService
      // For now, return a mock result
      return {
        existingVendors: [],
        potentialDuplicates: [],
        confidence: 0.95
      };
    } catch (error) {
      console.warn('Duplicate vendor check failed:', error);
      return {
        existingVendors: [],
        potentialDuplicates: [],
        confidence: 0.5
      };
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    vendorData: VendorDocumentData,
    webEnrichment?: WebEnrichmentResult,
    ocrResult?: OCRResult
  ): number {
    let score = 0;
    let maxScore = 0;

    // Vendor name (40 points)
    maxScore += 40;
    if (vendorData.vendorName) score += 40;

    // Contact info (30 points total)
    maxScore += 30;
    if (vendorData.email) score += 15;
    if (vendorData.phone) score += 15;

    // Address (15 points)
    maxScore += 15;
    if (vendorData.address?.line1) score += 15;

    // Website (10 points)
    maxScore += 10;
    if (vendorData.website) score += 10;

    // Web enrichment bonus (5 points)
    maxScore += 5;
    if (webEnrichment && webEnrichment.confidence > 0.8) {
      score += 5;
    }

    // OCR quality bonus/penalty
    if (ocrResult && ocrResult.confidence > 0.9) {
      score += 5;
    } else if (ocrResult && ocrResult.confidence < 0.7) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
  }

  /**
   * Generate suggestions based on analysis
   */
  private generateSuggestions(
    vendorData: VendorDocumentData,
    duplicateCheck?: VendorDocumentAnalysis['duplicateCheck'],
    documentType?: VendorDocumentAnalysis['documentType']
  ): string[] {
    const suggestions: string[] = [];

    if (!vendorData.vendorName) {
      suggestions.push('Vendor name not clearly identified - please verify');
    }

    if (!vendorData.email && !vendorData.phone) {
      suggestions.push('No contact information found - consider adding email or phone');
    }

    if (!vendorData.address?.line1) {
      suggestions.push('Address not detected - may need to be added manually');
    }

    if (duplicateCheck && duplicateCheck.potentialDuplicates.length > 0) {
      suggestions.push(`Found ${duplicateCheck.potentialDuplicates.length} potential duplicate vendor(s)`);
    }

    if (documentType === 'other') {
      suggestions.push('Document type unclear - extracted data may be incomplete');
    }

    if (suggestions.length === 0) {
      suggestions.push('All key vendor information extracted successfully');
    }

    return suggestions;
  }

  /**
   * Generate prefill data for vendor form
   */
  private generatePrefillData(
    vendorData: VendorDocumentData,
    webEnrichment?: WebEnrichmentResult
  ): Record<string, any> {
    const prefill: Record<string, any> = {};

    // Basic info
    if (vendorData.vendorName) prefill.name = vendorData.vendorName;
    if (vendorData.contactPerson) prefill.contact_person = vendorData.contactPerson;
    if (vendorData.email) prefill.email = vendorData.email;
    if (vendorData.phone) prefill.phone = vendorData.phone;
    if (vendorData.website) prefill.website = vendorData.website;

    // Address
    if (vendorData.address) {
      if (vendorData.address.line1) prefill.address_line_1 = vendorData.address.line1;
      if (vendorData.address.line2) prefill.address_line_2 = vendorData.address.line2;
      if (vendorData.address.city) prefill.city = vendorData.address.city;
      if (vendorData.address.state) prefill.state_province = vendorData.address.state;
      if (vendorData.address.postalCode) prefill.postal_code = vendorData.address.postalCode;
      if (vendorData.address.country) prefill.country = vendorData.address.country;
    }

    // Business details
    if (vendorData.taxId) prefill.tax_id = vendorData.taxId;
    if (vendorData.paymentTerms) prefill.payment_terms = vendorData.paymentTerms;
    if (vendorData.currency) prefill.default_currency_code = vendorData.currency;
    if (vendorData.notes) prefill.notes = vendorData.notes;

    // Set defaults
    prefill.is_active = true;
    prefill.tax_exempt = false;
    if (!prefill.country) prefill.country = 'US';

    return prefill;
  }

  /**
   * Generate action cards for vendor processing
   */
  private generateActionCards(
    analysis: VendorDocumentAnalysis,
    userContext: { userId: string; companyId: string; role: string }
  ): ActionCard[] {
    const cards: ActionCard[] = [];
    const { extractedData, webEnrichment } = analysis;

    // Primary action: Create Vendor
    cards.push({
      id: `create_vendor_${Date.now()}`,
      type: 'create_vendor',
      title: 'Create New Vendor',
      description: `Add ${extractedData.vendorName || 'this vendor'} to your vendor database`,
      confidence: analysis.confidence,
      priority: 'high',
      data: this.generatePrefillData(extractedData, webEnrichment),
      suggestedAction: 'create_vendor',
      estimatedTime: 3,
      approval_required: false
    });

    // Secondary action: Review and edit (if confidence is low)
    if (analysis.confidence < 80) {
      cards.push({
        id: `review_vendor_${Date.now()}`,
        type: 'review_vendor',
        title: 'Review Vendor Details',
        description: 'Some information may need verification before creating the vendor',
        confidence: 0.9,
        priority: 'medium',
        data: {
          issues: analysis.suggestions,
          extractedData: extractedData
        },
        suggestedAction: 'review_vendor',
        estimatedTime: 5,
        approval_required: false
      });
    }

    return cards;
  }

  /**
   * Generate conversational message for vendor processing
   */
  private generateConversationalMessage(
    analysis: VendorDocumentAnalysis,
    actionCards: ActionCard[]
  ): string {
    const { extractedData, documentType, confidence } = analysis;

    let message = `Great! I've analyzed your ${documentType}. `;

    if (extractedData.vendorName) {
      message += `I found vendor information for ${extractedData.vendorName}`;
      if (extractedData.address?.city) {
        message += ` from ${extractedData.address.city}`;
      }
      message += '.';
    } else {
      message += `I extracted some vendor information from the document.`;
    }

    if (confidence >= 80) {
      message += ` The information looks complete and accurate.`;
    } else if (confidence >= 60) {
      message += ` Most information was extracted successfully, but you may want to review a few details.`;
    } else {
      message += ` Some information may need verification or manual entry.`;
    }

    if (actionCards.length > 0) {
      const createCard = actionCards.find(card => card.type === 'create_vendor');
      if (createCard) {
        message += ` Would you like me to create this vendor record for you?`;
      }
    }

    return message;
  }
}

// Export singleton instance for convenience
export const vendorDocumentProcessor = new VendorDocumentProcessor();