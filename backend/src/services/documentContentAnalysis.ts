/**
 * Document Content Analysis Service
 *
 * Provides OCR, content extraction, and business document analysis capabilities
 * for the document intelligence system.
 */

import { createHash } from 'crypto';

export interface DocumentContentAnalysis {
  extractedText: string;
  confidence: number;
  businessEntities: {
    amounts: Array<{ value: number; currency: string; confidence: number; position: any }>;
    dates: Array<{ value: string; confidence: number; format: string; position: any }>;
    vendors: Array<{ name: string; confidence: number; position: any }>;
    addresses: Array<{ address: string; confidence: number; type: string; position: any }>;
    phoneNumbers: Array<{ number: string; confidence: number; position: any }>;
    emails: Array<{ email: string; confidence: number; position: any }>;
  };
  documentStructure: {
    hasTable: boolean;
    hasHeader: boolean;
    hasFooter: boolean;
    hasSignature: boolean;
    hasLogo: boolean;
  };
  businessIndicators: {
    invoiceKeywords: string[];
    receiptKeywords: string[];
    businessCardKeywords: string[];
    contractKeywords: string[];
    personalPhotoIndicators: string[];
  };
  metadata: {
    processingTime: number;
    ocrEngine: string;
    imageQuality: number;
  };
}

export interface PerceptualHash {
  hash: string;
  algorithm: 'dhash' | 'phash' | 'ahash';
}

export interface TemporalClassification {
  type: 'one_time' | 'monthly' | 'quarterly' | 'annual' | 'unknown';
  confidence: number;
  indicators: string[];
  detectedPeriod?: {
    startDate?: string;
    endDate?: string;
    billingCycle?: string;
  };
}

export class DocumentContentAnalysisService {
  private businessKeywords = {
    invoice: [
      'invoice', 'bill', 'payment due', 'amount due', 'subtotal', 'total', 'tax',
      'invoice number', 'invoice date', 'due date', 'remit to', 'pay to',
      'billing address', 'service period', 'line item', 'quantity', 'rate'
    ],
    receipt: [
      'receipt', 'transaction', 'purchase', 'sale', 'paid', 'change due',
      'credit card', 'cash', 'debit', 'item', 'qty', 'price', 'discount',
      'store', 'cashier', 'register', 'pos', 'thank you for your business'
    ],
    businessCard: [
      'phone', 'email', 'website', 'address', 'director', 'manager', 'president',
      'ceo', 'cfo', 'llc', 'inc', 'corp', 'ltd', 'company', 'business',
      'office', 'mobile', 'fax', 'consultant', 'services'
    ],
    contract: [
      'agreement', 'contract', 'terms', 'conditions', 'party', 'whereas',
      'effective date', 'term', 'renewal', 'termination', 'liability',
      'confidential', 'signature', 'witness', 'notary', 'exhibit'
    ],
    personalPhoto: [
      'selfie', 'vacation', 'family', 'pet', 'food', 'landscape', 'portrait',
      'no text detected', 'social media', 'personal'
    ]
  };

  private currencyPatterns = [
    /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*USD/gi,
    /USD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
    /£\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
    /€\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g
  ];

  private datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
    /(\d{1,2}-\d{1,2}-\d{2,4})/g,
    /(\d{4}-\d{1,2}-\d{1,2})/g,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/gi,
    /(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/gi
  ];

  private emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  private phonePattern = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;

  /**
   * Analyze document content using OCR and business intelligence
   */
  async analyzeContent(
    fileBuffer: Buffer,
    fileType: string,
    fileName: string
  ): Promise<DocumentContentAnalysis> {
    const startTime = Date.now();

    try {
      // For now, we'll simulate OCR analysis
      // In a real implementation, this would integrate with Tesseract.js or cloud OCR
      const mockOcrResult = await this.simulateOCRAnalysis(fileBuffer, fileType, fileName);

      const businessEntities = this.extractBusinessEntities(mockOcrResult);
      const documentStructure = this.analyzeDocumentStructure(mockOcrResult);
      const businessIndicators = this.identifyBusinessIndicators(mockOcrResult);

      const processingTime = Date.now() - startTime;

      return {
        extractedText: mockOcrResult,
        confidence: this.calculateOverallConfidence(businessEntities, documentStructure),
        businessEntities,
        documentStructure,
        businessIndicators,
        metadata: {
          processingTime,
          ocrEngine: 'mock_tesseract',
          imageQuality: this.assessImageQuality(fileBuffer, fileType)
        }
      };

    } catch (error) {
      console.error('Content analysis failed:', error);
      throw new Error(`Content analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate perceptual hash for visual similarity detection
   */
  async generatePerceptualHash(
    fileBuffer: Buffer,
    fileType: string
  ): Promise<PerceptualHash> {
    if (!fileType.startsWith('image/')) {
      // For non-images, use content-based hash
      const hash = createHash('md5').update(fileBuffer).digest('hex');
      return {
        hash: hash.substring(0, 16), // Use first 16 chars for perceptual hash
        algorithm: 'dhash'
      };
    }

    // Simulate perceptual hashing for images
    // In real implementation, this would use sharp + phash libraries
    const contentHash = createHash('sha256').update(fileBuffer).digest('hex');
    const simulatedPhash = contentHash.substring(0, 16);

    return {
      hash: simulatedPhash,
      algorithm: 'phash'
    };
  }

  /**
   * Classify document temporal characteristics
   */
  classifyTemporal(content: string, extractedEntities: any): TemporalClassification {
    const text = content.toLowerCase();
    const indicators: string[] = [];

    // Check for recurring billing indicators
    if (text.includes('monthly') || text.includes('month') || text.includes('billing cycle')) {
      indicators.push('monthly_billing_language');
    }

    if (text.includes('annual') || text.includes('yearly') || text.includes('year')) {
      indicators.push('annual_billing_language');
    }

    if (text.includes('quarter') || text.includes('quarterly')) {
      indicators.push('quarterly_billing_language');
    }

    // Check for service period dates
    if (text.includes('service period') || text.includes('billing period')) {
      indicators.push('service_period_detected');
    }

    // Analyze date patterns for recurring characteristics
    const dates = extractedEntities.dates || [];
    if (dates.length >= 2) {
      indicators.push('multiple_dates_found');
    }

    // Determine classification
    let type: TemporalClassification['type'] = 'one_time';
    let confidence = 0.3;

    if (indicators.some(i => i.includes('monthly'))) {
      type = 'monthly';
      confidence = 0.8;
    } else if (indicators.some(i => i.includes('annual'))) {
      type = 'annual';
      confidence = 0.8;
    } else if (indicators.some(i => i.includes('quarterly'))) {
      type = 'quarterly';
      confidence = 0.8;
    } else if (indicators.length > 0) {
      type = 'unknown';
      confidence = 0.6;
    }

    return {
      type,
      confidence,
      indicators
    };
  }

  /**
   * Simulate OCR analysis (replace with real OCR in production)
   */
  private async simulateOCRAnalysis(
    fileBuffer: Buffer,
    fileType: string,
    fileName: string
  ): Promise<string> {
    // Simulate different OCR results based on file characteristics
    const fileSize = fileBuffer.length;
    const isImage = fileType.startsWith('image/');

    if (fileName.toLowerCase().includes('receipt')) {
      return `
        STORE NAME: Office Supplies Plus
        Address: 123 Business Ave, City, ST 12345
        Phone: (555) 123-4567

        Receipt #: 12345
        Date: ${new Date().toLocaleDateString()}

        Item                    Qty    Price
        Office Paper           2      $15.99
        Pens (Pack)           1      $8.50
        Folders               3      $12.75

        Subtotal:             $37.24
        Tax:                  $2.98
        Total:                $40.22

        Payment: Credit Card ****1234
        Thank you for your business!
      `;
    } else if (fileName.toLowerCase().includes('invoice')) {
      return `
        INVOICE

        From: ABC Services LLC
        123 Provider Street
        Business City, ST 54321
        Phone: (555) 987-6543
        Email: billing@abcservices.com

        To: Your Company Name
        456 Client Ave
        Client City, ST 98765

        Invoice #: INV-2024-001
        Invoice Date: ${new Date().toLocaleDateString()}
        Due Date: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}

        Service Period: January 2024

        Description               Quantity    Rate      Amount
        Monthly Service Fee       1          $500.00   $500.00
        Additional Hours         5          $75.00    $375.00

        Subtotal:                                      $875.00
        Tax (8%):                                      $70.00
        Total Due:                                     $945.00

        Payment Terms: Net 30 days
        Remit to: ABC Services LLC
      `;
    } else if (fileName.toLowerCase().includes('business') || fileName.toLowerCase().includes('card')) {
      return `
        John Smith
        Senior Manager

        TechCorp Solutions
        789 Innovation Drive
        Tech City, ST 13579

        Phone: (555) 234-5678
        Mobile: (555) 345-6789
        Email: j.smith@techcorp.com
        Website: www.techcorpsolutions.com
      `;
    } else if (!isImage || fileSize < 100000) {
      return `
        This appears to be a personal photo or non-business document.
        No business-related text content detected.
        Image quality: ${fileSize > 50000 ? 'Good' : 'Poor'}
        Type: Personal/Other
      `;
    }

    return `
      Business Document

      Some text content detected but unable to classify specific type.
      Document appears to contain business-related information.

      File size: ${Math.round(fileSize / 1024)}KB
      Type: ${fileType}
    `;
  }

  /**
   * Extract business entities from text
   */
  private extractBusinessEntities(text: string) {
    const amounts = this.extractAmounts(text);
    const dates = this.extractDates(text);
    const vendors = this.extractVendors(text);
    const addresses = this.extractAddresses(text);
    const phoneNumbers = this.extractPhoneNumbers(text);
    const emails = this.extractEmails(text);

    return {
      amounts,
      dates,
      vendors,
      addresses,
      phoneNumbers,
      emails
    };
  }

  /**
   * Analyze document structure characteristics
   */
  private analyzeDocumentStructure(text: string) {
    const lowerText = text.toLowerCase();

    return {
      hasTable: this.detectTable(text),
      hasHeader: lowerText.includes('from:') || lowerText.includes('to:') || lowerText.includes('invoice'),
      hasFooter: lowerText.includes('thank you') || lowerText.includes('terms') || lowerText.includes('payment'),
      hasSignature: lowerText.includes('signature') || lowerText.includes('signed'),
      hasLogo: lowerText.includes('logo') || text.includes('®') || text.includes('™')
    };
  }

  /**
   * Identify business document indicators
   */
  private identifyBusinessIndicators(text: string) {
    const lowerText = text.toLowerCase();
    const foundKeywords = {
      invoiceKeywords: [],
      receiptKeywords: [],
      businessCardKeywords: [],
      contractKeywords: [],
      personalPhotoIndicators: []
    };

    // Check each category of keywords
    for (const [category, keywords] of Object.entries(this.businessKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          foundKeywords[`${category}Keywords`].push(keyword);
        }
      }
    }

    return foundKeywords;
  }

  private extractAmounts(text: string) {
    const amounts = [];

    for (const pattern of this.currencyPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const value = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(value)) {
          amounts.push({
            value,
            currency: 'USD',
            confidence: 0.9,
            position: { start: match.index, end: match.index + match[0].length }
          });
        }
      }
    }

    return amounts;
  }

  private extractDates(text: string) {
    const dates = [];

    for (const pattern of this.datePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        dates.push({
          value: match[1] || match[0],
          confidence: 0.8,
          format: this.detectDateFormat(match[0]),
          position: { start: match.index, end: match.index + match[0].length }
        });
      }
    }

    return dates;
  }

  private extractVendors(text: string) {
    // Simple vendor extraction based on common business name patterns
    const lines = text.split('\n');
    const vendors = [];

    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length > 3 && line.length < 50) {
        // Look for business indicators
        if (line.includes('LLC') || line.includes('Inc') || line.includes('Corp') ||
            line.includes('Ltd') || line.includes('Company') || line.includes('Services')) {
          vendors.push({
            name: line,
            confidence: 0.8,
            position: { line: i }
          });
        }
      }
    }

    return vendors;
  }

  private extractAddresses(text: string) {
    // Simple address detection
    const lines = text.split('\n');
    const addresses = [];

    for (const line of lines) {
      if (line.match(/\d+.*\w+.*\w+.*\d{5}/)) {
        addresses.push({
          address: line.trim(),
          confidence: 0.7,
          type: 'mailing',
          position: { line: lines.indexOf(line) }
        });
      }
    }

    return addresses;
  }

  private extractPhoneNumbers(text: string) {
    const phones = [];
    let match;

    while ((match = this.phonePattern.exec(text)) !== null) {
      phones.push({
        number: match[1],
        confidence: 0.9,
        position: { start: match.index, end: match.index + match[0].length }
      });
    }

    return phones;
  }

  private extractEmails(text: string) {
    const emails = [];
    let match;

    while ((match = this.emailPattern.exec(text)) !== null) {
      emails.push({
        email: match[1],
        confidence: 0.95,
        position: { start: match.index, end: match.index + match[0].length }
      });
    }

    return emails;
  }

  private detectTable(text: string): boolean {
    const lines = text.split('\n');
    let tableLines = 0;

    for (const line of lines) {
      // Look for table-like structures with multiple columns
      if (line.includes('|') ||
          (line.match(/\s{3,}/g) || []).length >= 2 ||
          (line.match(/\t/g) || []).length >= 1) {
        tableLines++;
      }
    }

    return tableLines >= 3;
  }

  private detectDateFormat(dateStr: string): string {
    if (dateStr.includes('/')) return 'MM/DD/YYYY';
    if (dateStr.includes('-') && dateStr.match(/^\d{4}/)) return 'YYYY-MM-DD';
    if (dateStr.includes('-')) return 'MM-DD-YYYY';
    if (dateStr.match(/[A-Za-z]/)) return 'Month DD, YYYY';
    return 'Unknown';
  }

  private calculateOverallConfidence(entities: any, structure: any): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on extracted entities
    if (entities.amounts.length > 0) confidence += 0.2;
    if (entities.dates.length > 0) confidence += 0.1;
    if (entities.vendors.length > 0) confidence += 0.1;
    if (entities.emails.length > 0 || entities.phoneNumbers.length > 0) confidence += 0.1;

    // Increase confidence based on structure
    if (structure.hasTable) confidence += 0.1;
    if (structure.hasHeader) confidence += 0.05;
    if (structure.hasFooter) confidence += 0.05;

    return Math.min(1.0, confidence);
  }

  private assessImageQuality(fileBuffer: Buffer, fileType: string): number {
    // Simple quality assessment based on file size and type
    const fileSize = fileBuffer.length;

    if (!fileType.startsWith('image/')) return 1.0; // Non-images get full quality score

    if (fileSize > 500000) return 0.9; // Large files likely high quality
    if (fileSize > 100000) return 0.7; // Medium files
    if (fileSize > 50000) return 0.5;  // Small files

    return 0.3; // Very small files likely poor quality
  }
}

export const documentContentAnalysisService = new DocumentContentAnalysisService();