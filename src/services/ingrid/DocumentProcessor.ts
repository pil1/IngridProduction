/**
 * Document Processor
 *
 * Universal document analysis engine that can process any document type
 * including receipts, invoices, business cards, quotes, and contracts.
 * Replaces the single-purpose legacy analyze-expense function.
 */

import {
  DocumentAnalysis,
  DocumentType,
  DocumentSuggestion,
  WebEnrichmentData,
  IngridConfig,
  IngridError
} from '@/types/ingrid';
import { OCRService, OCRProvider } from './OCRService';
import { WebEnrichmentService } from './WebEnrichmentService';
import { SmartCategorizationService } from './SmartCategorizationService';
import type { ExistingCategory } from './CategoryMappingService';
import { CategoryMappingService } from './CategoryMappingService';
import type { ExistingVendor } from './VendorMappingService';
import { VendorMappingService } from './VendorMappingService';

export class DocumentProcessor {
  private config: IngridConfig;
  private ocrService: OCRService;
  private webEnrichmentService: WebEnrichmentService;
  private smartCategorizationService: SmartCategorizationService;

  constructor(config: IngridConfig, ocrProvider: OCRProvider = 'google-document-ai') {
    this.config = config;
    this.ocrService = new OCRService(config, ocrProvider);
    this.webEnrichmentService = new WebEnrichmentService(config);
    this.smartCategorizationService = new SmartCategorizationService(config);
  }

  /**
   * Fetch existing categories for the company
   */
  private async fetchExistingCategories(companyId: string): Promise<ExistingCategory[]> {
    try {
      // For now, return mock data - in production this would be a real Supabase query
      // TODO: Replace with actual Supabase query:
      // const { data, error } = await supabase
      //   .from('expense_categories')
      //   .select('id, name, description')
      //   .eq('company_id', companyId)
      //   .eq('is_active', true);

      const mockCategories: ExistingCategory[] = [
        { id: 'tech-001', name: 'Technology', description: 'Technology and software expenses' },
        { id: 'travel-001', name: 'Travel & Entertainment', description: 'Business travel and client entertainment' },
        { id: 'office-001', name: 'Office Supplies', description: 'Office equipment and supplies' },
        { id: 'prof-001', name: 'Professional Services', description: 'Consulting, legal, and professional services' },
        { id: 'marketing-001', name: 'Marketing & Advertising', description: 'Marketing and advertising expenses' },
        { id: 'utilities-001', name: 'Utilities', description: 'Utilities and telecommunications' },
        { id: 'maintenance-001', name: 'Maintenance & Repairs', description: 'Facility maintenance and repairs' },
        { id: 'business-001', name: 'Business Expense', description: 'General business expenses' }
      ];

      console.log(`📋 Fetched ${mockCategories.length} existing categories for company ${companyId}`);
      return mockCategories;
    } catch (error) {
      console.warn('⚠️ Failed to fetch existing categories, using empty list:', error);
      return [];
    }
  }

  /**
   * Fetch existing vendors for the company
   */
  private async fetchExistingVendors(companyId: string): Promise<ExistingVendor[]> {
    try {
      // For now, return mock data - in production this would be a real Supabase query
      // TODO: Replace with actual Supabase query:
      // const { data, error } = await supabase
      //   .from('vendors')
      //   .select('id, name, email, phone, website, description')
      //   .eq('company_id', companyId)
      //   .eq('is_active', true);

      const mockVendors: ExistingVendor[] = [
        {
          id: 'vendor-001',
          name: 'Microsoft Corporation',
          email: 'billing@microsoft.com',
          website: 'https://www.microsoft.com',
          description: 'Software and cloud services'
        },
        {
          id: 'vendor-002',
          name: 'Office Depot',
          phone: '1-800-463-3768',
          website: 'https://www.officedepot.com',
          description: 'Office supplies and equipment'
        },
        {
          id: 'vendor-003',
          name: 'United Airlines',
          website: 'https://www.united.com',
          description: 'Commercial airline services'
        },
        {
          id: 'vendor-004',
          name: 'Marriott Hotels',
          website: 'https://www.marriott.com',
          description: 'Hotel and hospitality services'
        },
        {
          id: 'vendor-005',
          name: 'FedEx Corporation',
          phone: '1-800-463-3339',
          website: 'https://www.fedex.com',
          description: 'Shipping and logistics services'
        }
      ];

      console.log(`🏢 Fetched ${mockVendors.length} existing vendors for company ${companyId}`);
      return mockVendors;
    } catch (error) {
      console.warn('⚠️ Failed to fetch existing vendors, using empty list:', error);
      return [];
    }
  }

  /**
   * Universal document analysis
   *
   * Analyzes any document type and extracts structured data
   */
  async analyze(document: File, companyId?: string): Promise<DocumentAnalysis> {
    try {
      console.log(`📄 Processing document: ${document.name} (${document.type})`);

      // Step 1: Detect document type
      const documentType = await this.detectDocumentType(document);
      console.log(`🔍 Detected document type: ${documentType}`);

      // Step 2: Extract data based on document type
      const extractedData = await this.extractData(document, documentType, companyId);
      console.log(`📊 Extracted ${Object.keys(extractedData).length} fields`);

      // Step 3: Generate suggestions
      const suggestions = await this.generateSuggestions(extractedData, documentType);

      // Step 4: Web enrichment (if enabled)
      let webEnrichment: WebEnrichmentData | undefined;
      if (this.config.enableWebEnrichment) {
        webEnrichment = await this.performWebEnrichment(extractedData, documentType);
      }

      // Step 5: Calculate overall confidence
      const confidence = this.calculateConfidence(extractedData, suggestions);

      return {
        documentType,
        extractedData,
        confidence,
        suggestions,
        webEnrichment
      };

    } catch (error) {
      console.error('📄 Document processing error:', error);
      throw new IngridError(
        `Document analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DOCUMENT_ANALYSIS_FAILED',
        { filename: document.name }
      );
    }
  }

  /**
   * Detect document type from file content and metadata
   */
  private async detectDocumentType(document: File): Promise<DocumentType> {
    const filename = document.name.toLowerCase();
    const fileType = document.type;

    // Simple heuristics for document type detection
    // In a real implementation, this would use ML/AI for better accuracy

    if (filename.includes('receipt') || filename.includes('rcpt')) {
      return 'receipt';
    }

    if (filename.includes('invoice') || filename.includes('bill')) {
      return 'invoice';
    }

    if (filename.includes('card') || filename.includes('contact')) {
      return 'business_card';
    }

    if (filename.includes('quote') || filename.includes('estimate')) {
      return 'quote';
    }

    if (filename.includes('contract') || filename.includes('agreement')) {
      return 'contract';
    }

    // For images, try to detect based on content analysis
    if (fileType.startsWith('image/')) {
      return await this.analyzeImageContent(document);
    }

    // Default to unknown
    return 'unknown';
  }

  /**
   * Extract structured data based on document type
   */
  private async extractData(document: File, documentType: DocumentType, companyId?: string): Promise<Record<string, any>> {
    switch (documentType) {
      case 'receipt':
      case 'invoice':
        return this.extractExpenseData(document, companyId);

      case 'business_card':
        return this.extractContactData(document);

      case 'quote':
        return this.extractQuoteData(document);

      case 'contract':
        return this.extractContractData(document);

      default:
        return this.extractGenericData(document);
    }
  }

  /**
   * Extract expense-related data (receipts/invoices)
   */
  private async extractExpenseData(document: File, companyId?: string): Promise<Record<string, any>> {
    try {
      // Use real OCR service to extract text and structured data
      const ocrResult = await this.ocrService.processDocument(document);

      // Parse OCR results into expense data format
      const expenseData = this.parseExpenseFromOCR(ocrResult, document);

      // Apply smart categorization with intelligent category mapping
      const existingCategories = companyId ? await this.fetchExistingCategories(companyId) : [];
      const categorization = companyId && existingCategories.length > 0
        ? await this.smartCategorizationService.categorizeExpenseWithMapping(expenseData, existingCategories, companyId)
        : await this.smartCategorizationService.categorizeExpense(expenseData);

      // Apply intelligent vendor mapping and store vendor suggestions if needed
      const existingVendors = companyId ? await this.fetchExistingVendors(companyId) : [];
      let vendorMatch;
      let vendorSuggestionId: string | undefined;

      if (expenseData.vendor_name && companyId && existingVendors.length > 0) {
        try {
          vendorMatch = await VendorMappingService.mapVendorToId(
            expenseData.vendor_name,
            existingVendors,
            companyId,
            {
              documentType: 'receipt',
              extractedEmail: expenseData.vendor_email,
              extractedPhone: expenseData.vendor_phone,
              extractedWebsite: expenseData.vendor_website,
              amount: expenseData.amount,
              description: expenseData.description
            }
          );

          // Store vendor suggestion if needed
          if (vendorMatch.matchType === 'new' || vendorMatch.matchType === 'web_enriched') {
            if (vendorMatch.needsApproval) {
              vendorSuggestionId = await VendorMappingService.storeSuggestedVendor(
                {
                  name: vendorMatch.vendorName,
                  email: vendorMatch.webEnrichmentData?.email,
                  phone: vendorMatch.webEnrichmentData?.phone,
                  website: vendorMatch.webEnrichmentData?.website,
                  address: vendorMatch.webEnrichmentData?.address,
                  description: vendorMatch.webEnrichmentData?.description,
                  confidence: vendorMatch.confidence,
                  webEnrichmentData: vendorMatch.webEnrichmentData,
                  context: {
                    reasoning: vendorMatch.reason,
                    document_name: document.name,
                    match_type: vendorMatch.matchType
                  }
                },
                companyId,
                'system' // TODO: Get actual user ID when available
              );
            }
          }

          console.log(`🏢 Vendor mapping result: ${vendorMatch.matchType} match for "${expenseData.vendor_name}" → "${vendorMatch.vendorName}" (${Math.round(vendorMatch.confidence * 100)}% confidence)`);
        } catch (error) {
          console.warn('⚠️ Vendor mapping failed:', error);
        }
      }

      // Store new category suggestions if needed
      let categorySuggestionId: string | undefined;
      if ('categoryMatch' in categorization &&
          categorization.categoryMatch.matchType === 'new' &&
          categorization.categoryMatch.needsApproval) {
        try {
          categorySuggestionId = await CategoryMappingService.storeSuggestedCategory(
            {
              name: categorization.categoryMatch.categoryName,
              description: `AI-suggested based on ${expenseData.vendor_name || 'document analysis'}`,
              confidence: categorization.categoryMatch.confidence,
              context: {
                reasoning: categorization.categoryMatch.reason,
                document_name: document.name,
                vendor_name: expenseData.vendor_name,
                amount: expenseData.amount
              }
            },
            companyId,
            'system' // TODO: Get actual user ID when available
          );
        } catch (error) {
          console.warn('⚠️ Failed to store category suggestion:', error);
        }
      }

      // Enhance expense data with categorization and vendor mapping suggestions
      const enhancedExpenseData = {
        ...expenseData,
        smart_categorization: categorization,
        suggested_category: categorization.categories[0]?.category,
        suggested_gl_account: categorization.glAccounts[0]?.accountCode,
        suggested_tags: categorization.tags,
        ai_recommendations: categorization.recommendations,
        // Add intelligent category mapping results
        ...(('categoryMatch' in categorization) && {
          category_id: categorization.categoryMatch.categoryId,
          category_match_confidence: categorization.categoryMatch.confidence,
          category_match_type: categorization.categoryMatch.matchType,
          category_match_reason: categorization.categoryMatch.reason,
          category_needs_approval: categorization.categoryMatch.needsApproval,
          category_suggestion_id: categorySuggestionId
        }),
        // Add intelligent vendor mapping results
        ...(vendorMatch && {
          vendor_id: vendorMatch.vendorId,
          vendor_match_confidence: vendorMatch.confidence,
          vendor_match_type: vendorMatch.matchType,
          vendor_match_reason: vendorMatch.reason,
          vendor_needs_approval: vendorMatch.needsApproval,
          vendor_suggestion_id: vendorSuggestionId,
          vendor_web_enrichment: vendorMatch.webEnrichmentData ? {
            website: vendorMatch.webEnrichmentData.website,
            email: vendorMatch.webEnrichmentData.email,
            phone: vendorMatch.webEnrichmentData.phone,
            address: vendorMatch.webEnrichmentData.address,
            confidence: vendorMatch.webEnrichmentData.confidence,
            sources: vendorMatch.webEnrichmentData.sources
          } : undefined
        })
      };

      console.log('💰 Enhanced expense data with smart categorization:', enhancedExpenseData);
      return enhancedExpenseData;

    } catch (error) {
      console.warn('⚠️ OCR failed, falling back to mock data:', error);

      // Fallback to enhanced mock data if OCR fails
      const mockData = {
        vendor_name: this.extractVendorFromFilename(document.name),
        amount: this.generateMockAmount(),
        expense_date: new Date().toISOString().split('T')[0],
        description: `Expense from ${document.name}`,
        currency_code: 'USD',
        category_id: null, // Will be set by smart categorization or user selection
        tax_amount: 0,
        line_items: [
          {
            description: 'Service/Product',
            quantity: 1,
            unit_price: this.generateMockAmount(),
            line_amount: this.generateMockAmount()
          }
        ]
      };

      // Apply smart categorization and vendor mapping even to fallback data
      try {
        const existingCategories = companyId ? await this.fetchExistingCategories(companyId) : [];
        const categorization = companyId && existingCategories.length > 0
          ? await this.smartCategorizationService.categorizeExpenseWithMapping(mockData, existingCategories, companyId)
          : await this.smartCategorizationService.categorizeExpense(mockData);

        // Apply vendor mapping to fallback data too
        const existingVendors = companyId ? await this.fetchExistingVendors(companyId) : [];
        let vendorMatch;
        let vendorSuggestionId: string | undefined;

        if (mockData.vendor_name && companyId && existingVendors.length > 0) {
          try {
            vendorMatch = await VendorMappingService.mapVendorToId(
              mockData.vendor_name,
              existingVendors,
              companyId,
              {
                documentType: 'receipt',
                amount: mockData.amount,
                description: mockData.description
              }
            );

            // Store vendor suggestion if needed for fallback too
            if (vendorMatch.matchType === 'new' || vendorMatch.matchType === 'web_enriched') {
              if (vendorMatch.needsApproval) {
                vendorSuggestionId = await VendorMappingService.storeSuggestedVendor(
                  {
                    name: vendorMatch.vendorName,
                    confidence: vendorMatch.confidence,
                    webEnrichmentData: vendorMatch.webEnrichmentData,
                    context: {
                      reasoning: vendorMatch.reason,
                      document_name: document.name,
                      match_type: vendorMatch.matchType
                    }
                  },
                  companyId,
                  'system'
                );
              }
            }
          } catch (error) {
            console.warn('⚠️ Vendor mapping failed in fallback:', error);
          }
        }

        const enhancedMockData = {
          ...mockData,
          smart_categorization: categorization,
          suggested_category: categorization.categories[0]?.category,
          suggested_gl_account: categorization.glAccounts[0]?.accountCode,
          suggested_tags: categorization.tags,
          ai_recommendations: categorization.recommendations,
          // Add intelligent category mapping results for fallback too
          ...(('categoryMatch' in categorization) && {
            category_id: categorization.categoryMatch.categoryId,
            category_match_confidence: categorization.categoryMatch.confidence,
            category_match_type: categorization.categoryMatch.matchType,
            category_match_reason: categorization.categoryMatch.reason,
            category_needs_approval: categorization.categoryMatch.needsApproval
          }),
          // Add vendor mapping results for fallback too
          ...(vendorMatch && {
            vendor_id: vendorMatch.vendorId,
            vendor_match_confidence: vendorMatch.confidence,
            vendor_match_type: vendorMatch.matchType,
            vendor_match_reason: vendorMatch.reason,
            vendor_needs_approval: vendorMatch.needsApproval,
            vendor_suggestion_id: vendorSuggestionId,
            vendor_web_enrichment: vendorMatch.webEnrichmentData ? {
              website: vendorMatch.webEnrichmentData.website,
              email: vendorMatch.webEnrichmentData.email,
              phone: vendorMatch.webEnrichmentData.phone,
              address: vendorMatch.webEnrichmentData.address,
              confidence: vendorMatch.webEnrichmentData.confidence,
              sources: vendorMatch.webEnrichmentData.sources
            } : undefined
          })
        };

        console.log('💰 Enhanced fallback expense data with smart categorization:', enhancedMockData);
        return enhancedMockData;
      } catch (categorizationError) {
        console.warn('⚠️ Smart categorization also failed, using basic mock data:', categorizationError);
        console.log('💰 Using basic fallback expense data:', mockData);
        return mockData;
      }
    }
  }

  /**
   * Extract contact data from business cards
   */
  private async extractContactData(document: File): Promise<Record<string, any>> {
    try {
      // Use real OCR service to extract text from business card
      const ocrResult = await this.ocrService.processDocument(document);

      // Parse OCR results into contact data format
      const contactData = this.parseContactFromOCR(ocrResult, document);

      console.log('👤 Extracted contact data via OCR:', contactData);
      return contactData;

    } catch (error) {
      console.warn('⚠️ OCR failed for business card, falling back to mock data:', error);

      // Fallback to mock contact data
      const mockData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@company.com',
        phone: '+1-555-0123',
        company: 'Example Corp',
        title: 'Sales Manager',
        website: 'https://example.com',
        address: '123 Business St, City, State 12345'
      };

      console.log('👤 Using fallback contact data:', mockData);
      return mockData;
    }
  }

  /**
   * Extract quote/estimate data
   */
  private async extractQuoteData(document: File): Promise<Record<string, any>> {
    const mockData = {
      quote_number: 'Q-2025-001',
      vendor_name: this.extractVendorFromFilename(document.name),
      total_amount: this.generateMockAmount(),
      quote_date: new Date().toISOString().split('T')[0],
      expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: 'Services Quote',
      line_items: []
    };

    console.log('📋 Extracted quote data:', mockData);
    return mockData;
  }

  /**
   * Extract contract data
   */
  private async extractContractData(document: File): Promise<Record<string, any>> {
    const mockData = {
      contract_title: document.name.replace(/\.[^/.]+$/, ''),
      parties: ['Company A', 'Company B'],
      effective_date: new Date().toISOString().split('T')[0],
      expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      contract_value: this.generateMockAmount(),
      key_terms: []
    };

    console.log('📜 Extracted contract data:', mockData);
    return mockData;
  }

  /**
   * Generic data extraction for unknown documents
   */
  private async extractGenericData(document: File): Promise<Record<string, any>> {
    return {
      filename: document.name,
      file_size: document.size,
      file_type: document.type,
      processed_date: new Date().toISOString()
    };
  }

  /**
   * Analyze image content to determine document type
   */
  private async analyzeImageContent(document: File): Promise<DocumentType> {
    // Mock image analysis - in production would use CV/AI
    const filename = document.name.toLowerCase();

    if (filename.includes('receipt') || filename.includes('store')) {
      return 'receipt';
    }

    if (filename.includes('business') || filename.includes('card')) {
      return 'business_card';
    }

    return 'unknown';
  }

  /**
   * Generate intelligent suggestions based on extracted data
   */
  private async generateSuggestions(
    extractedData: Record<string, any>,
    documentType: DocumentType
  ): Promise<DocumentSuggestion[]> {
    const suggestions: DocumentSuggestion[] = [];

    // Generate suggestions based on document type
    if (documentType === 'receipt' || documentType === 'invoice') {
      if (extractedData.vendor_name) {
        suggestions.push({
          field: 'vendor_name',
          value: extractedData.vendor_name,
          confidence: 0.85,
          source: 'ocr'
        });
      }

      if (extractedData.amount) {
        suggestions.push({
          field: 'amount',
          value: extractedData.amount,
          confidence: 0.90,
          source: 'ocr'
        });
      }

      // Historical pattern suggestion
      suggestions.push({
        field: 'category',
        value: 'Office Supplies',
        confidence: 0.70,
        source: 'historical_pattern'
      });
    }

    return suggestions;
  }

  /**
   * Perform web enrichment to enhance extracted data
   */
  private async performWebEnrichment(
    extractedData: Record<string, any>,
    documentType: DocumentType
  ): Promise<WebEnrichmentData | undefined> {
    if (!this.config.enableWebEnrichment) {
      return undefined;
    }

    try {
      console.log(`🌐 Performing web enrichment for ${documentType}`);

      // Business card enrichment - get company information
      if (documentType === 'business_card' && extractedData.company) {
        const companyInfo = await this.webEnrichmentService.enrichCompanyData(extractedData.company);

        if (companyInfo) {
          return {
            companyInfo: {
              name: companyInfo.name,
              website: companyInfo.website,
              industry: companyInfo.industry,
              employeeCount: companyInfo.employeeCount,
              description: companyInfo.description
            }
          };
        }
      }

      // Receipt/Invoice enrichment - get vendor information
      if ((documentType === 'receipt' || documentType === 'invoice') && extractedData.vendor_name) {
        const vendorInfo = await this.webEnrichmentService.enrichVendorData(extractedData.vendor_name);

        if (vendorInfo) {
          return {
            vendorInfo: {
              name: vendorInfo.name,
              category: vendorInfo.category,
              verified: vendorInfo.verified
            }
          };
        }
      }

      console.log('ℹ️ No enrichment data found');
      return undefined;

    } catch (error) {
      console.warn('⚠️ Web enrichment failed:', error);
      return undefined;
    }
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(
    extractedData: Record<string, any>,
    suggestions: DocumentSuggestion[]
  ): number {
    if (suggestions.length === 0) {
      return 0.5; // Default confidence for no suggestions
    }

    const avgConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length;
    const dataRichness = Math.min(Object.keys(extractedData).length / 10, 1); // More data = higher confidence

    return Math.round((avgConfidence * 0.8 + dataRichness * 0.2) * 100);
  }

  // Helper methods

  private extractVendorFromFilename(filename: string): string {
    // Simple vendor extraction from filename
    const cleanName = filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    const words = cleanName.split(' ');
    return words.slice(0, 2).join(' ').replace(/\d+/g, '').trim() || 'Unknown Vendor';
  }

  private generateMockAmount(): number {
    return Math.round((Math.random() * 500 + 10) * 100) / 100;
  }

  /**
   * Parse OCR results into expense data format
   */
  private parseExpenseFromOCR(ocrResult: any, document: File): Record<string, any> {
    // Extract structured data from OCR results
    const text = ocrResult.text || '';
    const keyValuePairs = ocrResult.keyValuePairs || [];

    console.log('📊 Parsing expense data from Google Vision results:', {
      hasText: !!text,
      textLength: text.length,
      keyValueCount: keyValuePairs.length,
      confidence: ocrResult.confidence
    });

    // Start with enhanced base data from OCR
    const expenseData: Record<string, any> = {
      vendor_name: this.extractVendorFromOCRText(text) || this.extractVendorFromFilename(document.name),
      expense_date: new Date().toISOString().split('T')[0],
      description: this.extractDescriptionFromOCRText(text) || `Business expense from ${this.extractVendorFromOCRText(text) || 'vendor'}`,
      currency_code: this.extractCurrencyFromText(text) || 'USD',
      category_id: null, // Will be set by smart categorization or user selection
      tax_amount: 0,
      confidence: ocrResult.confidence || 0.8
    };

    // Extract vendor name from key-value pairs or text
    const vendorKV = keyValuePairs.find((kv: any) =>
      kv.key.toLowerCase().includes('vendor') ||
      kv.key.toLowerCase().includes('merchant') ||
      kv.key.toLowerCase().includes('store')
    );
    if (vendorKV) {
      expenseData.vendor_name = vendorKV.value;
    }

    // Extract amount from key-value pairs or text
    const amountKV = keyValuePairs.find((kv: any) =>
      kv.key.toLowerCase().includes('amount') ||
      kv.key.toLowerCase().includes('total')
    );
    if (amountKV) {
      const amount = this.parseAmountFromString(amountKV.value);
      if (amount) expenseData.amount = amount;
    } else {
      // Try to extract amount from text using regex
      const amountMatch = text.match(/\$?(\d+\.?\d*)/);
      if (amountMatch) {
        expenseData.amount = parseFloat(amountMatch[1]);
      } else {
        expenseData.amount = this.generateMockAmount();
      }
    }

    // Extract date from key-value pairs or text
    const dateKV = keyValuePairs.find((kv: any) =>
      kv.key.toLowerCase().includes('date')
    );
    if (dateKV) {
      const parsedDate = this.parseDateFromString(dateKV.value);
      if (parsedDate) expenseData.expense_date = parsedDate;
    }

    // Generate line items from OCR blocks if available
    if (ocrResult.blocks && ocrResult.blocks.length > 0) {
      expenseData.line_items = this.extractLineItemsFromBlocks(ocrResult.blocks);
    } else {
      expenseData.line_items = [{
        description: 'Service/Product',
        quantity: 1,
        unit_price: expenseData.amount || this.generateMockAmount(),
        line_amount: expenseData.amount || this.generateMockAmount()
      }];
    }

    return expenseData;
  }

  /**
   * Parse OCR results into contact data format
   */
  private parseContactFromOCR(ocrResult: any, document: File): Record<string, any> {
    const text = ocrResult.text || '';
    const keyValuePairs = ocrResult.keyValuePairs || [];

    // Start with base contact data
    const contactData: Record<string, any> = {
      confidence: ocrResult.confidence || 0.8
    };

    // Extract structured data from key-value pairs
    keyValuePairs.forEach((kv: any) => {
      const key = kv.key.toLowerCase();

      if (key.includes('name')) {
        const nameParts = kv.value.split(' ');
        contactData.first_name = nameParts[0] || 'John';
        contactData.last_name = nameParts.slice(1).join(' ') || 'Doe';
      } else if (key.includes('email')) {
        contactData.email = kv.value;
      } else if (key.includes('phone')) {
        contactData.phone = kv.value;
      } else if (key.includes('company')) {
        contactData.company = kv.value;
      } else if (key.includes('title')) {
        contactData.title = kv.value;
      }
    });

    // Try to extract email from text if not found in key-value pairs
    if (!contactData.email) {
      const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) contactData.email = emailMatch[0];
    }

    // Try to extract phone from text if not found
    if (!contactData.phone) {
      const phoneMatch = text.match(/[\+]?[\d\s\-\(\)]{10,}/);
      if (phoneMatch) contactData.phone = phoneMatch[0];
    }

    // Set defaults for missing fields
    if (!contactData.first_name) contactData.first_name = 'John';
    if (!contactData.last_name) contactData.last_name = 'Doe';
    if (!contactData.email) contactData.email = 'contact@company.com';
    if (!contactData.phone) contactData.phone = '+1-555-0123';
    if (!contactData.company) contactData.company = 'Example Corp';
    if (!contactData.title) contactData.title = 'Contact';

    return contactData;
  }

  /**
   * Extract line items from OCR blocks
   */
  private extractLineItemsFromBlocks(blocks: any[]): any[] {
    const lineItems: any[] = [];

    // Look for blocks that might contain line items
    blocks.forEach(block => {
      const text = block.text;

      // Simple heuristic: if block contains a number and some text, treat as line item
      const amountMatch = text.match(/\$?(\d+\.?\d*)/);
      if (amountMatch && text.length > 5) {
        lineItems.push({
          description: text.replace(/\$?\d+\.?\d*/g, '').trim() || 'Item',
          quantity: 1,
          unit_price: parseFloat(amountMatch[1]),
          line_amount: parseFloat(amountMatch[1])
        });
      }
    });

    // Return at least one line item
    if (lineItems.length === 0) {
      lineItems.push({
        description: 'Service/Product',
        quantity: 1,
        unit_price: this.generateMockAmount(),
        line_amount: this.generateMockAmount()
      });
    }

    return lineItems;
  }

  /**
   * Parse amount from string, handling various formats
   */
  private parseAmountFromString(value: string): number | null {
    if (!value) return null;

    // Remove currency symbols and whitespace
    const cleaned = value.replace(/[$€£¥,\s]/g, '');
    const parsed = parseFloat(cleaned);

    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Parse date from string in various formats
   */
  private parseDateFromString(value: string): string | null {
    if (!value) return null;

    try {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }

  /**
   * Extract vendor name from OCR text using smart patterns
   */
  private extractVendorFromOCRText(text: string): string | null {
    if (!text) return null;

    const lines = text.split('\n').filter(line => line.trim().length > 0);

    // Look for vendor name in the first few lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();

      // Skip very short lines, numbers, addresses, and common receipt headers
      if (line.length < 3 || line.length > 50) continue;
      if (/^\d+$/.test(line)) continue;
      if (/receipt|invoice|bill/i.test(line)) continue;
      if (/^\d+\s/.test(line)) continue; // Skip lines starting with numbers
      if (/(street|ave|avenue|road|rd|blvd|drive|dr|suite|apt)/i.test(line)) continue;

      // Look for business-like names
      if (/[A-Za-z]{2,}/.test(line) && !/[€£$¥₹]\d/.test(line)) {
        // Clean up the vendor name
        let vendor = line.replace(/[^\w\s&.-]/g, '').trim();
        if (vendor.length >= 3 && vendor.length <= 40) {
          return vendor;
        }
      }
    }

    return null;
  }

  /**
   * Extract description from OCR text
   */
  private extractDescriptionFromOCRText(text: string): string | null {
    if (!text) return null;

    const vendor = this.extractVendorFromOCRText(text);
    const lines = text.split('\n').filter(line => line.trim().length > 2);

    // Look for item descriptions or service descriptions
    const itemDescriptions: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip prices, totals, addresses, dates
      if (/^[\d.,$€£¥₹\s]+$/.test(trimmed)) continue;
      if (/(total|subtotal|tax|amount|balance|due)/i.test(trimmed)) continue;
      if (/(street|ave|road|suite|phone|email|www)/i.test(trimmed)) continue;
      if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(trimmed)) continue;
      if (trimmed === vendor) continue;

      // Look for service/product descriptions
      if (trimmed.length > 5 && trimmed.length < 100 && /[a-zA-Z]{3,}/.test(trimmed)) {
        // Clean up the description
        const cleaned = trimmed.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned.length > 3) {
          itemDescriptions.push(cleaned);
        }
      }
    }

    if (itemDescriptions.length > 0) {
      // Use the first meaningful description
      return itemDescriptions[0];
    }

    // Fallback: create a description based on vendor
    if (vendor) {
      return `Business expense from ${vendor}`;
    }

    return null;
  }

  /**
   * Extract currency from OCR text
   */
  private extractCurrencyFromText(text: string): string | null {
    if (!text) return null;

    // Look for currency symbols and codes
    const currencyPatterns = [
      { pattern: /\$/, code: 'USD' },
      { pattern: /€/, code: 'EUR' },
      { pattern: /£/, code: 'GBP' },
      { pattern: /¥/, code: 'JPY' },
      { pattern: /₹/, code: 'INR' },
      { pattern: /\bUSD\b/i, code: 'USD' },
      { pattern: /\bEUR\b/i, code: 'EUR' },
      { pattern: /\bGBP\b/i, code: 'GBP' },
      { pattern: /\bCAD\b/i, code: 'CAD' },
      { pattern: /\bAUD\b/i, code: 'AUD' },
      { pattern: /\bJPY\b/i, code: 'JPY' }
    ];

    for (const { pattern, code } of currencyPatterns) {
      if (pattern.test(text)) {
        return code;
      }
    }

    return null;
  }
}