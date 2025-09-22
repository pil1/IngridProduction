/**
 * Web Enrichment Service
 *
 * Enriches extracted data with additional information from web sources.
 * Provides company information, vendor verification, and contextual data.
 */

import { IngridConfig, WebEnrichmentData } from '@/types/ingrid';

export interface CompanyEnrichmentResult {
  name: string;
  website?: string;
  description?: string;
  industry?: string;
  employeeCount?: number;
  address?: string;
  phone?: string;
  logo?: string;
  verified: boolean;
  source: string;
}

export interface VendorEnrichmentResult {
  name: string;
  category?: string;
  verified: boolean;
  businessType?: string;
  taxId?: string;
  rating?: number;
  website?: string;
  source: string;
}

export class WebEnrichmentService {
  private config: IngridConfig;

  constructor(config: IngridConfig) {
    this.config = config;
  }

  /**
   * Enrich company data from multiple sources
   */
  async enrichCompanyData(companyName: string): Promise<CompanyEnrichmentResult | null> {
    if (!this.config.enableWebEnrichment) {
      return null;
    }

    try {
      console.log(`🌐 Enriching company data for: ${companyName}`);

      // Try multiple enrichment sources in order of preference
      const enrichmentMethods = [
        () => this.enrichFromClearbit(companyName),
        () => this.enrichFromDomainLookup(companyName),
        () => this.enrichFromOpenData(companyName),
        () => this.generateMockCompanyData(companyName)
      ];

      for (const method of enrichmentMethods) {
        try {
          const result = await method();
          if (result) {
            console.log(`✅ Company enrichment successful: ${result.source}`);
            return result;
          }
        } catch (error) {
          console.warn('⚠️ Enrichment method failed:', error);
          continue;
        }
      }

      return null;

    } catch (error) {
      console.error('🚨 Company enrichment failed:', error);
      return null;
    }
  }

  /**
   * Enrich vendor data for expense categorization
   */
  async enrichVendorData(vendorName: string): Promise<VendorEnrichmentResult | null> {
    if (!this.config.enableWebEnrichment) {
      return null;
    }

    try {
      console.log(`🏪 Enriching vendor data for: ${vendorName}`);

      // Try vendor enrichment methods
      const enrichmentMethods = [
        () => this.enrichVendorFromDatabase(vendorName),
        () => this.enrichVendorFromWebScraping(vendorName),
        () => this.generateMockVendorData(vendorName)
      ];

      for (const method of enrichmentMethods) {
        try {
          const result = await method();
          if (result) {
            console.log(`✅ Vendor enrichment successful: ${result.source}`);
            return result;
          }
        } catch (error) {
          console.warn('⚠️ Vendor enrichment method failed:', error);
          continue;
        }
      }

      return null;

    } catch (error) {
      console.error('🚨 Vendor enrichment failed:', error);
      return null;
    }
  }

  /**
   * Enrich business card contact with company information
   */
  async enrichContactData(contactData: Record<string, any>): Promise<WebEnrichmentData | null> {
    if (!contactData.company) {
      return null;
    }

    const companyInfo = await this.enrichCompanyData(contactData.company);
    if (!companyInfo) {
      return null;
    }

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

  /**
   * Clearbit company enrichment (requires API key)
   */
  private async enrichFromClearbit(companyName: string): Promise<CompanyEnrichmentResult | null> {
    // Clearbit Company API integration would go here
    // For now, throw to move to next method
    throw new Error('Clearbit API not configured');
  }

  /**
   * Domain-based company lookup
   */
  private async enrichFromDomainLookup(companyName: string): Promise<CompanyEnrichmentResult | null> {
    try {
      // Attempt to construct and validate a domain
      const domain = this.guessDomain(companyName);
      if (!domain) {
        throw new Error('Could not guess domain');
      }

      // Check if domain exists (simple check)
      const domainExists = await this.verifyDomain(domain);
      if (!domainExists) {
        throw new Error('Domain does not exist');
      }

      return {
        name: companyName,
        website: `https://${domain}`,
        verified: true,
        source: 'domain_lookup'
      };

    } catch (error) {
      throw new Error(`Domain lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Open data source enrichment
   */
  private async enrichFromOpenData(companyName: string): Promise<CompanyEnrichmentResult | null> {
    try {
      // Simulate API call to open business directory
      await new Promise(resolve => setTimeout(resolve, 200));

      // Mock successful lookup for demonstration
      if (companyName.toLowerCase().includes('microsoft') ||
          companyName.toLowerCase().includes('google') ||
          companyName.toLowerCase().includes('amazon')) {
        return {
          name: companyName,
          description: `${companyName} is a major technology company.`,
          industry: 'Technology',
          employeeCount: 100000,
          verified: true,
          source: 'open_data'
        };
      }

      throw new Error('Not found in open data');

    } catch (error) {
      throw new Error(`Open data lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate mock company data (fallback)
   */
  private async generateMockCompanyData(companyName: string): Promise<CompanyEnrichmentResult> {
    // Enhanced mock data based on company name patterns
    const industries = ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing', 'Services'];
    const employeeRanges = [10, 50, 100, 500, 1000, 5000];

    const domain = this.guessDomain(companyName);

    return {
      name: companyName,
      website: domain ? `https://${domain}` : undefined,
      description: `${companyName} is a business operating in their industry sector.`,
      industry: industries[Math.floor(Math.random() * industries.length)],
      employeeCount: employeeRanges[Math.floor(Math.random() * employeeRanges.length)],
      verified: false,
      source: 'mock_data'
    };
  }

  /**
   * Enrich vendor from internal database
   */
  private async enrichVendorFromDatabase(vendorName: string): Promise<VendorEnrichmentResult | null> {
    // Mock database lookup
    const knownVendors = [
      { name: 'Home Depot', category: 'Hardware & Home Improvement', verified: true },
      { name: 'Staples', category: 'Office Supplies', verified: true },
      { name: 'Amazon', category: 'General Merchandise', verified: true },
      { name: 'Shell', category: 'Gas Station', verified: true },
      { name: 'Starbucks', category: 'Food & Beverage', verified: true }
    ];

    const match = knownVendors.find(v =>
      vendorName.toLowerCase().includes(v.name.toLowerCase()) ||
      v.name.toLowerCase().includes(vendorName.toLowerCase())
    );

    if (match) {
      return {
        name: match.name,
        category: match.category,
        verified: match.verified,
        source: 'internal_database'
      };
    }

    throw new Error('Vendor not found in database');
  }

  /**
   * Enrich vendor from web scraping
   */
  private async enrichVendorFromWebScraping(vendorName: string): Promise<VendorEnrichmentResult | null> {
    // Web scraping would be implemented here
    // For now, throw to move to next method
    throw new Error('Web scraping not implemented');
  }

  /**
   * Generate mock vendor data (fallback)
   */
  private async generateMockVendorData(vendorName: string): Promise<VendorEnrichmentResult> {
    const categories = [
      'Office Supplies', 'Food & Beverage', 'Transportation', 'Technology',
      'Professional Services', 'Utilities', 'Healthcare', 'Entertainment'
    ];

    return {
      name: vendorName,
      category: categories[Math.floor(Math.random() * categories.length)],
      verified: false,
      businessType: 'Unknown',
      source: 'mock_data'
    };
  }

  /**
   * Guess domain from company name
   */
  private guessDomain(companyName: string): string | null {
    if (!companyName) return null;

    // Clean up company name
    const cleaned = companyName
      .toLowerCase()
      .replace(/\s+(inc|ltd|llc|corp|corporation|company|co)\.?$/, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '');

    if (cleaned.length < 2) return null;

    return `${cleaned}.com`;
  }

  /**
   * Verify if a domain exists (simple check)
   */
  private async verifyDomain(domain: string): Promise<boolean> {
    try {
      // Simple domain existence check
      const response = await fetch(`https://${domain}`, {
        method: 'HEAD',
        mode: 'no-cors', // To avoid CORS issues
      });
      return true; // If fetch doesn't throw, domain probably exists
    } catch (error) {
      // Most errors indicate domain doesn't exist or isn't accessible
      return false;
    }
  }

  /**
   * Extract business information from website
   */
  private async extractBusinessInfo(domain: string): Promise<Partial<CompanyEnrichmentResult>> {
    try {
      // Website scraping would be implemented here
      // For now, return basic info
      return {
        website: `https://${domain}`,
        verified: true
      };
    } catch (error) {
      return {};
    }
  }
}