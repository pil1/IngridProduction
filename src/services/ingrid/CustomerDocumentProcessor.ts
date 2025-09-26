/**
 * Customer Document Processing Service
 *
 * Specialized AI-powered processor for customer documents including:
 * - Business cards
 * - Company brochures
 * - Email signatures
 * - Contact forms
 * - Customer correspondence
 */

import { OCRService } from './OCRService';
import { WebEnrichmentService } from './WebEnrichmentService';
import { CustomerFormValues } from '@/components/AddEditCustomerDialog';

export interface CustomerProcessingResult {
  success: boolean;
  confidence: number;
  message: string;
  prefillData: Partial<CustomerFormValues>;
  analysis: {
    documentType: 'business_card' | 'brochure' | 'email_signature' | 'contact_form' | 'correspondence' | 'unknown';
    extractedFields: string[];
    suggestions: string[];
    confidence: number;
    webEnrichmentUsed: boolean;
  };
}

export interface CustomerProcessingContext {
  userId: string;
  companyId: string;
  role: string;
}

export class CustomerDocumentProcessor {
  private ocrService: OCRService;
  private webEnrichmentService: WebEnrichmentService;

  constructor() {
    this.ocrService = new OCRService();
    this.webEnrichmentService = new WebEnrichmentService();
  }

  /**
   * Process a customer document with AI extraction and web enrichment
   */
  async processCustomerDocument(
    documentFile: File,
    userContext: CustomerProcessingContext
  ): Promise<CustomerProcessingResult> {
    try {
      // Step 1: OCR and text extraction
      const ocrResult = await this.ocrService.extractText(documentFile);

      if (!ocrResult.success || !ocrResult.text) {
        return {
          success: false,
          confidence: 0,
          message: 'Failed to extract text from document',
          prefillData: {},
          analysis: {
            documentType: 'unknown',
            extractedFields: [],
            suggestions: ['Try a clearer image or different file format'],
            confidence: 0,
            webEnrichmentUsed: false
          }
        };
      }

      // Step 2: Analyze document type and extract customer information
      const analysis = await this.analyzeCustomerDocument(ocrResult.text);

      // Step 3: Map extracted data to customer form fields
      let prefillData = this.mapToCustomerFields(analysis);

      // Step 4: Web enrichment for company information
      let webEnrichmentUsed = false;
      if (prefillData.name && prefillData.website) {
        try {
          const enrichedData = await this.webEnrichmentService.enrichCustomerData({
            companyName: prefillData.name,
            website: prefillData.website,
            email: prefillData.email || undefined
          });

          if (enrichedData) {
            prefillData = { ...prefillData, ...enrichedData };
            webEnrichmentUsed = true;
            analysis.suggestions.push('Enhanced with web-based company information');
          }
        } catch (error) {
          console.warn('Web enrichment failed:', error);
        }
      }

      // Step 5: Calculate final confidence score
      const finalConfidence = this.calculateConfidence(analysis, prefillData);

      return {
        success: true,
        confidence: finalConfidence,
        message: this.generateSuccessMessage(analysis.documentType, finalConfidence),
        prefillData,
        analysis: {
          ...analysis,
          confidence: finalConfidence,
          webEnrichmentUsed
        }
      };

    } catch (error) {
      console.error('Customer document processing error:', error);

      return {
        success: false,
        confidence: 0,
        message: 'Document processing failed due to an internal error',
        prefillData: {},
        analysis: {
          documentType: 'unknown',
          extractedFields: [],
          suggestions: ['Please try again or contact support if the issue persists'],
          confidence: 0,
          webEnrichmentUsed: false
        }
      };
    }
  }

  /**
   * Analyze extracted text to identify document type and extract customer data
   */
  private async analyzeCustomerDocument(text: string) {
    // Document type detection patterns
    const documentPatterns = {
      business_card: [
        /\b(?:ceo|president|director|manager|executive)\b/i,
        /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone patterns
        /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/i, // Email
        /\bwww\./i,
        /\b(?:inc|llc|corp|ltd|co)\b/i
      ],
      brochure: [
        /\b(?:about us|our company|services|solutions)\b/i,
        /\b(?:established|founded|since)\s+\d{4}\b/i,
        /\b(?:headquarters|location|address)\b/i
      ],
      email_signature: [
        /^--+$/m,
        /\b(?:sent from|this email|confidential)\b/i,
        /\bmobile:|cell:|desk:/i
      ],
      contact_form: [
        /\b(?:contact information|customer details|inquiry)\b/i,
        /\b(?:first name|last name|company name)\b/i,
        /\b(?:address|city|state|zip)\b/i
      ]
    };

    // Determine document type
    let documentType: CustomerProcessingResult['analysis']['documentType'] = 'unknown';
    let maxMatches = 0;

    for (const [type, patterns] of Object.entries(documentPatterns)) {
      const matches = patterns.reduce((count, pattern) => {
        return count + (pattern.test(text) ? 1 : 0);
      }, 0);

      if (matches > maxMatches) {
        maxMatches = matches;
        documentType = type as CustomerProcessingResult['analysis']['documentType'];
      }
    }

    // Extract customer information using AI analysis patterns
    const extractedData = this.extractCustomerFields(text, documentType);

    return {
      documentType,
      extractedFields: Object.keys(extractedData).filter(key => extractedData[key]),
      extractedData,
      suggestions: this.generateSuggestions(documentType, extractedData)
    };
  }

  /**
   * Extract customer fields from text based on document type
   */
  private extractCustomerFields(text: string, documentType: string) {
    const extractedData: any = {};

    // Company name extraction patterns
    const companyPatterns = [
      /^([A-Z][A-Za-z\s&.,'-]+(?:Inc|LLC|Corp|Ltd|Co\.?|Corporation|Limited|Company))/m,
      /(?:Company:|Business:|Organization:)\s*([A-Za-z\s&.,'-]+)/i,
      /([A-Z][A-Za-z\s&.,'-]+)(?:\s+(?:Inc|LLC|Corp|Ltd|Co\.?))/i
    ];

    for (const pattern of companyPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        extractedData.name = match[1].trim();
        break;
      }
    }

    // Contact person extraction
    const contactPatterns = [
      /(?:Contact:|Name:|Person:)\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s*,\s*(?:CEO|President|Director|Manager))/i
    ];

    for (const pattern of contactPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        extractedData.contact_person = match[1].trim();
        break;
      }
    }

    // Email extraction
    const emailMatch = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
    if (emailMatch) {
      extractedData.email = emailMatch[1];
    }

    // Phone extraction
    const phoneMatch = text.match(/\b(\+?1?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/);
    if (phoneMatch) {
      extractedData.phone = phoneMatch[1];
    }

    // Website extraction
    const websiteMatch = text.match(/\b(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/\S*)?)\b/);
    if (websiteMatch) {
      extractedData.website = websiteMatch[0].startsWith('www.') || websiteMatch[0].startsWith('http')
        ? websiteMatch[0]
        : `www.${websiteMatch[0]}`;
    }

    // Address extraction (basic pattern)
    const addressMatch = text.match(/\b(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln))/i);
    if (addressMatch) {
      extractedData.address_line_1 = addressMatch[1];
    }

    // City, State, ZIP extraction
    const cityStateMatch = text.match(/\b([A-Za-z\s]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/);
    if (cityStateMatch) {
      extractedData.city = cityStateMatch[1].trim();
      extractedData.state_province = cityStateMatch[2];
      extractedData.postal_code = cityStateMatch[3];
    }

    return extractedData;
  }

  /**
   * Map extracted data to CustomerFormValues format
   */
  private mapToCustomerFields(analysis: any): Partial<CustomerFormValues> {
    const { extractedData } = analysis;

    return {
      // Basic Information
      name: extractedData.name || '',
      contact_person: extractedData.contact_person || '',
      email: extractedData.email || '',
      phone: extractedData.phone || '',
      website: extractedData.website || '',

      // Address Information
      address_line_1: extractedData.address_line_1 || '',
      address_line_2: extractedData.address_line_2 || '',
      city: extractedData.city || '',
      state_province: extractedData.state_province || '',
      postal_code: extractedData.postal_code || '',
      country: extractedData.country || 'US', // Default to US

      // Default values
      is_active: true,
      tax_exempt: false,
      upload_flag: true,
      on_hold: false,
      apply_finance_charges: false,
      default_currency_code: 'USD'
    };
  }

  /**
   * Calculate confidence score based on extraction success
   */
  private calculateConfidence(analysis: any, prefillData: Partial<CustomerFormValues>): number {
    let confidence = 0;
    const weights = {
      name: 30,           // Company name is most important
      contact_person: 20, // Contact person is important
      email: 20,         // Email is valuable for communication
      phone: 15,         // Phone is good to have
      address_line_1: 10, // Address adds value
      website: 5         // Website is nice but not critical
    };

    // Calculate base confidence from extracted fields
    Object.entries(weights).forEach(([field, weight]) => {
      if (prefillData[field as keyof CustomerFormValues]) {
        confidence += weight;
      }
    });

    // Bonus for document type identification
    if (analysis.documentType !== 'unknown') {
      confidence += 10;
    }

    // Bonus for web enrichment
    if (analysis.webEnrichmentUsed) {
      confidence += 5;
    }

    return Math.min(confidence, 100);
  }

  /**
   * Generate user-friendly success message
   */
  private generateSuccessMessage(documentType: string, confidence: number): string {
    const typeMessages = {
      business_card: 'Business card processed successfully',
      brochure: 'Company brochure analyzed',
      email_signature: 'Email signature processed',
      contact_form: 'Contact form data extracted',
      correspondence: 'Customer correspondence analyzed',
      unknown: 'Document processed'
    };

    const baseMessage = typeMessages[documentType as keyof typeof typeMessages] || 'Document processed';

    if (confidence >= 80) {
      return `${baseMessage} with high confidence`;
    } else if (confidence >= 60) {
      return `${baseMessage} with moderate confidence`;
    } else {
      return `${baseMessage} with limited information extracted`;
    }
  }

  /**
   * Generate helpful suggestions based on analysis
   */
  private generateSuggestions(documentType: string, extractedData: any): string[] {
    const suggestions: string[] = [];

    if (!extractedData.name) {
      suggestions.push('Consider adding the company name manually');
    }

    if (!extractedData.email && !extractedData.phone) {
      suggestions.push('Add contact information for better customer communication');
    }

    if (!extractedData.address_line_1) {
      suggestions.push('Include billing address if available');
    }

    if (documentType === 'unknown') {
      suggestions.push('Document type could not be determined - verify extracted information');
    }

    return suggestions;
  }
}