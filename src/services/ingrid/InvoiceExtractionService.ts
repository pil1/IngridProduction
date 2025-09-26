/**
 * Invoice Extraction Service
 *
 * Converts OCR results into structured invoice data for the invoice view.
 * Handles data transformation, confidence mapping, and validation.
 */

import {
  InvoiceStructure,
  InvoiceHeader,
  InvoiceLineItem,
  EnhancedTaxLineItem,
  InvoiceSummary,
  InvoiceMetadata,
  InvoiceFieldConfidences
} from '@/types/expenses';
import { InvoiceOCRData } from './OCRService';

export interface InvoiceExtractionOptions {
  companyDefaultCurrency: string;
  enableTaxValidation: boolean;
  strictModeEnabled: boolean;
  confidenceThreshold: number;
}

export class InvoiceExtractionService {
  private options: InvoiceExtractionOptions;

  constructor(options: Partial<InvoiceExtractionOptions> = {}) {
    this.options = {
      companyDefaultCurrency: 'USD',
      enableTaxValidation: true,
      strictModeEnabled: false,
      confidenceThreshold: 0.6,
      ...options
    };
  }

  /**
   * Convert OCR data to InvoiceStructure
   */
  async extractInvoiceFromOCR(
    ocrData: InvoiceOCRData,
    processingTimeMs: number = 0,
    modelUsed: string = 'openai-vision-preview'
  ): Promise<InvoiceStructure> {
    const header = this.buildInvoiceHeader(ocrData);
    const lineItems = this.buildLineItems(ocrData);
    const taxBreakdown = this.buildTaxBreakdown(ocrData);
    const summary = this.buildInvoiceSummary(ocrData);
    const metadata = this.buildInvoiceMetadata(ocrData, processingTimeMs, modelUsed);

    return {
      header,
      lineItems,
      taxBreakdown,
      summary,
      metadata
    };
  }

  /**
   * Build invoice header with confidence mapping
   */
  private buildInvoiceHeader(ocrData: InvoiceOCRData): InvoiceHeader {
    const confidence: InvoiceFieldConfidences = {
      invoiceNumber: this.calculateFieldConfidence(ocrData.header.invoiceNumber),
      purchaseOrderNumber: this.calculateFieldConfidence(ocrData.header.purchaseOrderNumber),
      issueDate: this.calculateFieldConfidence(ocrData.header.issueDate),
      dueDate: this.calculateFieldConfidence(ocrData.header.dueDate),
      vendorName: this.calculateFieldConfidence(ocrData.vendor.name),
      vendorAddress: this.calculateFieldConfidence(ocrData.vendor.address),
      vendorContact: Math.max(
        this.calculateFieldConfidence(ocrData.vendor.phone),
        this.calculateFieldConfidence(ocrData.vendor.email)
      ),
      billToInfo: this.calculateFieldConfidence(ocrData.billTo.name),
      overallConfidence: ocrData.overallConfidence
    };

    return {
      invoiceNumber: ocrData.header.invoiceNumber || null,
      purchaseOrderNumber: ocrData.header.purchaseOrderNumber || null,
      issueDate: ocrData.header.issueDate ? new Date(ocrData.header.issueDate) : null,
      dueDate: ocrData.header.dueDate ? new Date(ocrData.header.dueDate) : null,
      paymentTerms: null, // Could be extracted from OCR text analysis
      reference: ocrData.header.reference || null,

      // Vendor information
      vendorName: ocrData.vendor.name,
      vendorAddress: ocrData.vendor.address || null,
      vendorPhone: ocrData.vendor.phone || null,
      vendorEmail: ocrData.vendor.email || null,
      vendorWebsite: ocrData.vendor.website || null,
      vendorTaxNumber: ocrData.vendor.taxNumber || null,

      // Bill-to information
      billToName: ocrData.billTo.name || null,
      billToAddress: ocrData.billTo.address || null,

      confidence
    };
  }

  /**
   * Build line items from OCR data
   */
  private buildLineItems(ocrData: InvoiceOCRData): InvoiceLineItem[] {
    return ocrData.lineItems.map((item, index) => ({
      // ExpenseLineItem properties
      id: `temp-${index}`, // Temporary ID for new items
      description: item.description,
      quantity: item.quantity || null,
      unit_price: item.unitPrice || null,
      line_amount: item.amount,
      currency_code: ocrData.totals.currency,
      category_id: null, // To be filled by categorization service
      gl_account_id: null, // To be filled by GL mapping
      extracted_from_receipt_id: null, // To be filled when receipt is saved

      // InvoiceLineItem enhancements
      lineNumber: item.lineNumber || (index + 1),
      productCode: item.productCode || null,
      taxRate: item.taxRate || null,
      taxAmount: item.taxAmount || null,
      discountRate: null, // Could be calculated from OCR data
      discountAmount: null,
      netAmount: item.unitPrice && item.quantity ?
        (item.unitPrice * item.quantity) : item.amount,
      grossAmount: item.amount + (item.taxAmount || 0),
      taxJurisdiction: this.inferTaxJurisdiction(item.taxRate),
      taxType: this.inferTaxType(item.taxRate),
      confidence: item.confidence
    }));
  }

  /**
   * Build enhanced tax breakdown
   */
  private buildTaxBreakdown(ocrData: InvoiceOCRData): EnhancedTaxLineItem[] {
    return ocrData.taxes.map((tax, index) => ({
      // TaxLineItem properties
      id: `temp-tax-${index}`,
      taxType: tax.type,
      rate: tax.rate,
      baseAmount: tax.baseAmount,
      taxAmount: tax.taxAmount,
      jurisdiction: tax.jurisdiction || this.inferTaxJurisdiction(tax.rate),
      confidence: tax.confidence,
      isCalculated: false, // Extracted from document

      // EnhancedTaxLineItem properties
      lineItemIds: [], // To be filled by line item association
      extractedFromDocument: true,
      verificationStatus: tax.confidence >= this.options.confidenceThreshold ?
        'verified' : 'needs_review',
      complianceNotes: this.generateTaxComplianceNotes(tax)
    }));
  }

  /**
   * Build invoice summary
   */
  private buildInvoiceSummary(ocrData: InvoiceOCRData): InvoiceSummary {
    const currencyMismatch = ocrData.totals.currency !== this.options.companyDefaultCurrency;

    return {
      subtotal: ocrData.totals.subtotal,
      taxLines: ocrData.taxes.map(tax => ({
        id: `summary-tax-${Math.random()}`,
        taxType: tax.type,
        rate: tax.rate,
        baseAmount: tax.baseAmount,
        taxAmount: tax.taxAmount,
        jurisdiction: tax.jurisdiction || 'Unknown',
        confidence: tax.confidence,
        isCalculated: false
      })),
      totalTax: ocrData.totals.totalTax,
      grandTotal: ocrData.totals.grandTotal,
      currency: ocrData.totals.currency,
      currencyConfidence: ocrData.totals.confidence,
      currencyReason: currencyMismatch ?
        'Currency detected from document differs from company default' :
        'Currency matches company default',
      hasCompanyMismatch: currencyMismatch
    };
  }

  /**
   * Build invoice metadata
   */
  private buildInvoiceMetadata(
    ocrData: InvoiceOCRData,
    processingTimeMs: number,
    modelUsed: string
  ): InvoiceMetadata {
    const warnings = [];
    const manualOverrides = [];

    // Check for low confidence fields
    if (ocrData.overallConfidence < this.options.confidenceThreshold) {
      warnings.push('Overall confidence below threshold - review recommended');
    }

    // Check for missing critical fields
    if (!ocrData.vendor.name) warnings.push('Vendor name not detected');
    if (!ocrData.totals.grandTotal) warnings.push('Grand total not detected');
    if (ocrData.lineItems.length === 0) warnings.push('No line items detected');

    return {
      processingMethod: 'ai_extracted',
      documentQuality: ocrData.documentQuality,
      processingTime: processingTimeMs,
      aiModelUsed: modelUsed,
      extractionWarnings: warnings,
      manualOverrides: manualOverrides,
      reviewRequired: ocrData.overallConfidence < this.options.confidenceThreshold ||
                     warnings.length > 0,
      processingDate: new Date()
    };
  }

  /**
   * Calculate field confidence based on value presence and quality
   */
  private calculateFieldConfidence(value: string | null | undefined): number {
    if (!value) return 0;

    // Basic confidence calculation - could be enhanced with ML models
    let confidence = 0.5; // Base confidence for any detected value

    // Length-based confidence boost
    if (value.length > 3) confidence += 0.2;
    if (value.length > 10) confidence += 0.1;

    // Pattern-based confidence (basic examples)
    if (/^\d+$/.test(value)) confidence += 0.1; // Numbers
    if (/^[A-Z0-9-]+$/.test(value)) confidence += 0.1; // Codes/IDs
    if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(value)) confidence += 0.2; // Dates

    return Math.min(confidence, 1.0);
  }

  /**
   * Infer tax jurisdiction from rate
   */
  private inferTaxJurisdiction(rate: number | null): string | null {
    if (!rate) return null;

    const ratePercent = Math.round(rate * 100);

    // Common tax rates (simplified)
    switch (ratePercent) {
      case 5: return 'Canada Federal'; // GST
      case 13: return 'Ontario'; // HST
      case 15: return 'Atlantic Canada'; // HST
      case 7: case 8: case 10: return 'Provincial'; // PST variants
      default: return 'Unknown';
    }
  }

  /**
   * Infer tax type from rate
   */
  private inferTaxType(rate: number | null): string | null {
    if (!rate) return null;

    const ratePercent = Math.round(rate * 100);

    switch (ratePercent) {
      case 5: return 'GST';
      case 13: case 15: return 'HST';
      case 7: case 8: case 10: return 'PST';
      default: return 'Sales Tax';
    }
  }

  /**
   * Generate tax compliance notes
   */
  private generateTaxComplianceNotes(tax: any): string | null {
    const notes = [];

    if (tax.confidence < 0.7) {
      notes.push('Low confidence tax extraction - verify manually');
    }

    if (!tax.jurisdiction) {
      notes.push('Tax jurisdiction could not be determined');
    }

    const expectedRate = this.getExpectedTaxRate(tax.type, tax.jurisdiction);
    if (expectedRate && Math.abs(tax.rate - expectedRate) > 0.005) {
      notes.push(`Tax rate ${(tax.rate * 100).toFixed(1)}% differs from expected ${(expectedRate * 100).toFixed(1)}%`);
    }

    return notes.length > 0 ? notes.join('; ') : null;
  }

  /**
   * Get expected tax rate for validation
   */
  private getExpectedTaxRate(taxType: string, jurisdiction?: string): number | null {
    // Simplified tax rate validation - could be expanded with comprehensive tax tables
    const taxRates: Record<string, Record<string, number>> = {
      'GST': { 'Canada': 0.05 },
      'HST': { 'Ontario': 0.13, 'Atlantic Canada': 0.15 },
      'PST': { 'British Columbia': 0.07, 'Saskatchewan': 0.06 }
    };

    return taxRates[taxType]?.[jurisdiction || 'Canada'] || null;
  }

  /**
   * Validate invoice structure for completeness and accuracy
   */
  validateInvoiceStructure(invoice: InvoiceStructure): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors = [];
    const warnings = [];

    // Required field validation
    if (!invoice.header.vendorName) {
      errors.push('Vendor name is required');
    }

    if (invoice.lineItems.length === 0) {
      errors.push('At least one line item is required');
    }

    if (!invoice.summary.grandTotal || invoice.summary.grandTotal <= 0) {
      errors.push('Valid grand total is required');
    }

    // Confidence validation
    if (invoice.header.confidence.overallConfidence < this.options.confidenceThreshold) {
      warnings.push('Overall extraction confidence is low');
    }

    // Math validation
    const calculatedSubtotal = invoice.lineItems.reduce((sum, item) => sum + item.line_amount, 0);
    if (Math.abs(calculatedSubtotal - invoice.summary.subtotal) > 0.01) {
      warnings.push('Subtotal calculation mismatch detected');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export default InvoiceExtractionService;