/**
 * Smart Document Naming Service
 *
 * AI-powered intelligent document naming system that generates meaningful
 * filenames based on document content, context, and configurable templates.
 */

import { db } from '@/config/database';
import crypto from 'crypto';
import path from 'path';

export interface DocumentNamingData {
  // Document metadata
  originalFileName: string;
  fileExtension: string;
  documentType?: string;

  // AI extracted data
  vendor?: string;
  merchant?: string;
  amount?: number;
  currency?: string;
  date?: Date;
  invoiceNumber?: string;
  receiptNumber?: string;

  // Contact information
  contactName?: string;
  companyName?: string;

  // Document specifics
  reportType?: string;
  period?: string;
  accountNumber?: string;
  contractType?: string;

  // Context
  companyId: string;
  userId: string;
  associatedEntityType?: string;
  associatedEntityId?: string;

  // Confidence scores
  overallConfidence?: number;
  dataConfidence?: { [key: string]: number };
}

export interface SmartNamingResult {
  smartFileName: string;
  displayName: string;
  confidence: number;
  template: string;
  metadata: Record<string, any>;
  fallbackReason?: string;
}

export interface NamingTemplate {
  id: string;
  pattern: string;
  description: string;
  dateFormat: string;
  currencyFormat: string;
  maxLength: number;
  priority: number;
}

export class SmartDocumentNamingService {
  private readonly MAX_FILENAME_LENGTH = 255;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.3;
  private readonly HIGH_CONFIDENCE_THRESHOLD = 0.8;

  /**
   * Generate smart document name based on extracted data and templates
   */
  async generateSmartName(data: DocumentNamingData): Promise<SmartNamingResult> {
    try {
      // Get naming template for document type
      const template = await this.getNamingTemplate(
        data.documentType || 'other',
        data.companyId
      );

      // Determine confidence level
      const confidence = data.overallConfidence || this.calculateOverallConfidence(data);

      // Generate name based on confidence level
      let result: SmartNamingResult;

      if (confidence >= this.HIGH_CONFIDENCE_THRESHOLD) {
        result = await this.generateHighConfidenceName(data, template);
      } else if (confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
        result = await this.generateMediumConfidenceName(data, template);
      } else {
        result = this.generateFallbackName(data);
      }

      // Ensure filename is within length limits
      result.smartFileName = this.truncateFileName(result.smartFileName, data.fileExtension);
      result.displayName = this.truncateFileName(result.displayName, data.fileExtension);

      return result;

    } catch (error) {
      console.error('Smart naming failed:', error);
      return this.generateFallbackName(data);
    }
  }

  /**
   * Generate high-confidence smart name using full template
   */
  private async generateHighConfidenceName(
    data: DocumentNamingData,
    template: NamingTemplate
  ): Promise<SmartNamingResult> {
    const variables = this.extractVariables(data);
    const fileName = this.applyTemplate(template.pattern, variables, template);

    return {
      smartFileName: `${fileName}.${data.fileExtension}`,
      displayName: `${fileName}.${data.fileExtension}`,
      confidence: data.overallConfidence || 0.9,
      template: template.pattern,
      metadata: {
        namingStrategy: 'high_confidence',
        templateId: template.id,
        extractedVariables: variables,
        originalTemplate: template.pattern
      }
    };
  }

  /**
   * Generate medium-confidence name with partial data
   */
  private async generateMediumConfidenceName(
    data: DocumentNamingData,
    template: NamingTemplate
  ): Promise<SmartNamingResult> {
    const variables = this.extractVariables(data);

    // Use simplified template for medium confidence
    const simplifiedPattern = this.simplifyTemplate(template.pattern, variables);
    const fileName = this.applyTemplate(simplifiedPattern, variables, template);

    // Add timestamp for uniqueness
    const timestamp = this.formatDate(new Date(), 'YYYY-MM-DD_HHmm');
    const finalFileName = `${fileName}_${timestamp}`;

    return {
      smartFileName: `${finalFileName}.${data.fileExtension}`,
      displayName: `${fileName}.${data.fileExtension}`,
      confidence: data.overallConfidence || 0.6,
      template: simplifiedPattern,
      metadata: {
        namingStrategy: 'medium_confidence',
        templateId: template.id,
        simplifiedFrom: template.pattern,
        extractedVariables: variables,
        timestampAdded: true
      }
    };
  }

  /**
   * Generate fallback name when confidence is too low
   */
  private generateFallbackName(data: DocumentNamingData): SmartNamingResult {
    const docType = data.documentType || 'Document';
    const timestamp = this.formatDate(new Date(), 'YYYY-MM-DD_HHmmss');
    const hash = crypto.createHash('md5')
      .update(data.originalFileName + timestamp)
      .digest('hex')
      .substring(0, 8);

    const fileName = `${docType}_${timestamp}_${hash}`;

    return {
      smartFileName: `${fileName}.${data.fileExtension}`,
      displayName: data.originalFileName, // Keep original for display
      confidence: 0.1,
      template: 'fallback',
      metadata: {
        namingStrategy: 'fallback',
        reason: 'low_confidence',
        originalFileName: data.originalFileName
      },
      fallbackReason: 'Insufficient data confidence for smart naming'
    };
  }

  /**
   * Get naming template for document type and company
   */
  private async getNamingTemplate(
    documentType: string,
    companyId: string
  ): Promise<NamingTemplate> {
    const result = await db.query(`
      SELECT id, template_pattern, description, date_format,
             currency_format, max_length, priority
      FROM document_naming_templates
      WHERE document_type = $1
        AND (company_id = $2 OR company_id IS NULL)
        AND is_active = true
      ORDER BY company_id NULLS LAST, priority ASC
      LIMIT 1
    `, [documentType, companyId]);

    if (result.rows.length === 0) {
      // Return default template
      return {
        id: 'default',
        pattern: '{type}_{date}_{time}',
        description: 'Default naming pattern',
        dateFormat: 'YYYY-MM-DD',
        currencyFormat: 'symbol_amount',
        maxLength: 200,
        priority: 999
      };
    }

    return {
      id: result.rows[0].id,
      pattern: result.rows[0].template_pattern,
      description: result.rows[0].description,
      dateFormat: result.rows[0].date_format,
      currencyFormat: result.rows[0].currency_format,
      maxLength: result.rows[0].max_length,
      priority: result.rows[0].priority
    };
  }

  /**
   * Extract variables from document data
   */
  private extractVariables(data: DocumentNamingData): Record<string, string> {
    const variables: Record<string, string> = {};

    // Core variables
    variables.type = this.sanitizeForFilename(data.documentType || 'Document');
    variables.category = variables.type;

    // Vendor/Merchant
    if (data.vendor) {
      variables.vendor = this.sanitizeForFilename(data.vendor);
    }
    if (data.merchant) {
      variables.merchant = this.sanitizeForFilename(data.merchant);
    }
    if (data.companyName) {
      variables.company = this.sanitizeForFilename(data.companyName);
    }

    // Financial data
    if (data.amount && data.currency) {
      variables.amount = this.formatCurrency(data.amount, data.currency);
    }

    // Dates
    if (data.date) {
      variables.date = this.formatDate(data.date, 'YYYY-MM-DD');
      variables.year = this.formatDate(data.date, 'YYYY');
      variables.month = this.formatDate(data.date, 'MM');
      variables.day = this.formatDate(data.date, 'DD');
    } else {
      const now = new Date();
      variables.date = this.formatDate(now, 'YYYY-MM-DD');
      variables.year = this.formatDate(now, 'YYYY');
      variables.month = this.formatDate(now, 'MM');
      variables.day = this.formatDate(now, 'DD');
    }

    // Time
    const now = new Date();
    variables.time = this.formatDate(now, 'HHmm');
    variables.timestamp = this.formatDate(now, 'YYYY-MM-DD_HHmmss');

    // Document numbers
    if (data.invoiceNumber) {
      variables.invoice_number = this.sanitizeForFilename(data.invoiceNumber);
      variables.number = variables.invoice_number;
    }
    if (data.receiptNumber) {
      variables.receipt_number = this.sanitizeForFilename(data.receiptNumber);
      if (!variables.number) variables.number = variables.receipt_number;
    }

    // Contact information
    if (data.contactName) {
      variables.contact = this.sanitizeForFilename(data.contactName);
      variables.name = variables.contact;
    }

    // Document specifics
    if (data.reportType) {
      variables.report_type = this.sanitizeForFilename(data.reportType);
    }
    if (data.period) {
      variables.period = this.sanitizeForFilename(data.period);
    }
    if (data.contractType) {
      variables.contract_type = this.sanitizeForFilename(data.contractType);
    }

    return variables;
  }

  /**
   * Apply template pattern with variables
   */
  private applyTemplate(
    pattern: string,
    variables: Record<string, string>,
    template: NamingTemplate
  ): string {
    let result = pattern;

    // Replace all variables in the pattern
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      result = result.replace(regex, variables[key] || '');
    });

    // Clean up any remaining unreplaced variables
    result = result.replace(/\{[^}]+\}/g, '');

    // Clean up multiple separators
    result = result.replace(/[_-]{2,}/g, '_');
    result = result.replace(/^[_-]+|[_-]+$/g, '');

    return this.sanitizeForFilename(result);
  }

  /**
   * Simplify template for medium confidence scenarios
   */
  private simplifyTemplate(
    pattern: string,
    availableVariables: Record<string, string>
  ): string {
    // Extract available variable names
    const available = new Set(Object.keys(availableVariables));

    // Common simplification patterns
    const simplifications: Record<string, string> = {
      '{category}_{vendor}_{date}_{amount}': '{category}_{vendor}_{date}',
      '{type}_{vendor}_{invoice_number}_{date}': '{type}_{vendor}_{date}',
      '{type}_{company}_{contact}_{date}': '{type}_{company}_{date}',
    };

    // Try predefined simplifications first
    if (simplifications[pattern]) {
      return simplifications[pattern];
    }

    // Generic simplification: keep only variables we have data for
    const parts = pattern.split('_');
    const simplified = parts.filter(part => {
      if (!part.includes('{')) return true; // Keep literal text

      const variable = part.replace(/[{}]/g, '');
      return available.has(variable);
    });

    return simplified.join('_') || '{type}_{date}';
  }

  /**
   * Calculate overall confidence from individual data confidences
   */
  private calculateOverallConfidence(data: DocumentNamingData): number {
    const confidences = data.dataConfidence || {};
    const scores = Object.values(confidences).filter(score => typeof score === 'number');

    if (scores.length === 0) {
      // Base confidence on available data completeness
      let completeness = 0;
      let total = 0;

      const checkFields = [
        'vendor', 'merchant', 'amount', 'date',
        'invoiceNumber', 'contactName', 'companyName'
      ];

      checkFields.forEach(field => {
        total++;
        if (data[field as keyof DocumentNamingData]) completeness++;
      });

      return Math.min(completeness / total, 0.8); // Cap at 0.8 without AI confidence
    }

    // Calculate weighted average
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Format date according to specified format
   */
  private formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  /**
   * Format currency amount
   */
  private formatCurrency(amount: number, currency: string): string {
    const symbols: Record<string, string> = {
      'USD': '$', 'CAD': 'C$', 'EUR': '€', 'GBP': '£',
      'JPY': '¥', 'AUD': 'A$', 'CHF': 'CHF'
    };

    const symbol = symbols[currency] || currency;
    const formatted = amount.toFixed(2).replace(/\.?0+$/, ''); // Remove trailing zeros

    return `${symbol}${formatted}`;
  }

  /**
   * Sanitize string for use in filename
   */
  private sanitizeForFilename(input: string): string {
    return input
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove invalid filename characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/[^\w\-_.]/g, '') // Keep only word characters, hyphens, underscores, dots
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      .substring(0, 50); // Limit individual component length
  }

  /**
   * Truncate filename to maximum length while preserving extension
   */
  private truncateFileName(fileName: string, extension: string): string {
    const maxNameLength = this.MAX_FILENAME_LENGTH - extension.length - 1; // -1 for dot

    if (fileName.length <= this.MAX_FILENAME_LENGTH) {
      return fileName;
    }

    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.substring(0, maxNameLength - 8); // -8 for hash
    const hash = crypto.createHash('md5')
      .update(nameWithoutExt)
      .digest('hex')
      .substring(0, 8);

    return `${truncatedName}_${hash}.${extension}`;
  }

  /**
   * Validate template pattern
   */
  async validateTemplate(pattern: string): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check for valid variable syntax
    const variableRegex = /\{([^}]+)\}/g;
    const matches = pattern.match(variableRegex);

    if (matches) {
      for (const match of matches) {
        const variable = match.slice(1, -1); // Remove { }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable)) {
          errors.push(`Invalid variable name: ${variable}`);
        }
      }
    }

    // Check for invalid filename characters in literal parts
    const literalParts = pattern.split(/\{[^}]+\}/).join('');
    if (/[<>:"/\\|?*\x00-\x1f]/.test(literalParts)) {
      errors.push('Template contains invalid filename characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get available variables for template building
   */
  getAvailableVariables(): Record<string, string> {
    return {
      // Document type
      'type': 'Document type (expense, invoice, etc.)',
      'category': 'Document category (alias for type)',

      // Vendors and companies
      'vendor': 'Vendor or supplier name',
      'merchant': 'Merchant name',
      'company': 'Company name',

      // Financial
      'amount': 'Formatted amount with currency symbol',
      'currency': 'Currency code (USD, EUR, etc.)',

      // Dates
      'date': 'Document date (YYYY-MM-DD)',
      'year': 'Document year (YYYY)',
      'month': 'Document month (MM)',
      'day': 'Document day (DD)',
      'time': 'Upload time (HHMM)',
      'timestamp': 'Upload timestamp (YYYY-MM-DD_HHMMSS)',

      // Document numbers
      'number': 'Document number (invoice/receipt)',
      'invoice_number': 'Invoice number',
      'receipt_number': 'Receipt number',

      // Contacts
      'contact': 'Contact person name',
      'name': 'Contact name (alias)',

      // Specific types
      'report_type': 'Type of report',
      'period': 'Reporting period',
      'contract_type': 'Type of contract'
    };
  }
}