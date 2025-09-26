/**
 * Business Card Processor - Phase 4 Week 3-4
 *
 * AI-powered business card processing for contact creation.
 * Extracts contact information and creates smart action cards.
 *
 * @example
 * ```typescript
 * const processor = new BusinessCardProcessor();
 * const result = await processor.processBusinessCard(cardFile, userContext);
 *
 * // Returns:
 * // message: "I see Sarah Johnson, VP Sales at TechCorp. Create as prospect or customer?"
 * // actionCards: [CreateContactActionCard with prefilled data + company research]
 * // webEnrichment: { website, phone, address, description }
 * ```
 */

import { DocumentAnalysis, ActionCard, WebEnrichmentResult } from '@/types/ingrid';
import { OCRService } from './OCRService';
import { WebEnrichmentService } from './WebEnrichmentService';

export interface BusinessCardData {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  linkedin?: string;
  twitter?: string;
  notes?: string;
}

export interface BusinessCardAnalysis extends DocumentAnalysis {
  extractedData: BusinessCardData;
  companyResearch?: WebEnrichmentResult;
  duplicateCheck?: {
    existingContacts: any[];
    potentialDuplicates: any[];
    confidence: number;
  };
}

export interface BusinessCardProcessingResult {
  analysis: BusinessCardAnalysis;
  actionCards: ActionCard[];
  message: string;
  confidence: number;
  suggestions: string[];
}

/**
 * Advanced Business Card Processing Service
 *
 * Processes business cards with OCR, web enrichment, and intelligent
 * contact creation suggestions following Phase 4 requirements.
 */
export class BusinessCardProcessor {
  private ocrService: OCRService;
  private webEnrichment: WebEnrichmentService;

  constructor() {
    this.ocrService = new OCRService();
    this.webEnrichment = new WebEnrichmentService();
  }

  /**
   * Process business card and generate intelligent action cards
   *
   * @param cardFile - Business card image file
   * @param userContext - Current user context for permissions and company
   * @returns Promise<BusinessCardProcessingResult> - Complete analysis with action cards
   */
  async processBusinessCard(
    cardFile: File,
    userContext: { userId: string; companyId: string; role: string }
  ): Promise<BusinessCardProcessingResult> {
    try {
      console.log(`🎴 BusinessCardProcessor: Processing ${cardFile.name}`);

      // Step 1: OCR extraction
      const ocrText = await this.ocrService.extractText(cardFile);
      const businessCardData = this.parseBusinessCardData(ocrText);

      console.log(`📱 Extracted contact: ${businessCardData.fullName || 'Unknown'} from ${businessCardData.company || 'Unknown Company'}`);

      // Step 2: Web enrichment for company data
      let companyResearch: WebEnrichmentResult | undefined;
      if (businessCardData.company) {
        try {
          companyResearch = await this.webEnrichment.enrichCompanyData(
            businessCardData.company,
            businessCardData.website || businessCardData.email
          );
          console.log(`🌐 Company research complete: ${companyResearch.confidence}% confidence`);
        } catch (error) {
          console.warn(`🌐 Company research failed:`, error);
        }
      }

      // Step 3: Duplicate detection
      const duplicateCheck = await this.checkForDuplicates(businessCardData, userContext.companyId);

      // Step 4: Create analysis object
      const analysis: BusinessCardAnalysis = {
        documentType: 'business_card',
        extractedData: businessCardData,
        confidence: this.calculateConfidence(businessCardData, companyResearch),
        suggestions: this.generateSuggestions(businessCardData, duplicateCheck),
        companyResearch,
        duplicateCheck
      };

      // Step 5: Generate action cards
      const actionCards = await this.generateActionCards(analysis, userContext);

      // Step 6: Generate conversational message
      const message = this.generateConversationalMessage(analysis, actionCards);

      console.log(`✅ Business card processing complete: ${actionCards.length} action cards generated`);

      return {
        analysis,
        actionCards,
        message,
        confidence: analysis.confidence,
        suggestions: analysis.suggestions
      };

    } catch (error) {
      console.error('🚨 Business card processing error:', error);

      // Return fallback result
      return {
        analysis: {
          documentType: 'business_card',
          extractedData: { fullName: 'Unknown Contact' },
          confidence: 0.1,
          suggestions: ['Please verify the card image quality and try again']
        },
        actionCards: [],
        message: "I had trouble reading this business card. Could you try taking a clearer photo or entering the contact details manually?",
        confidence: 0.1,
        suggestions: ['Retake photo with better lighting', 'Enter contact details manually', 'Try a different angle']
      };
    }
  }

  /**
   * Parse OCR text into structured business card data
   */
  private parseBusinessCardData(ocrText: string): BusinessCardData {
    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const data: BusinessCardData = {};

    for (const line of lines) {
      // Email detection
      const emailMatch = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch && !data.email) {
        data.email = emailMatch[1].toLowerCase();
        continue;
      }

      // Phone detection
      const phoneMatch = line.match(/(\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/);
      if (phoneMatch && !data.phone) {
        data.phone = phoneMatch[1].replace(/[^\d+]/g, '');
        if (data.phone.length === 10) data.phone = '+1' + data.phone;
        continue;
      }

      // Website detection
      const websiteMatch = line.match(/((?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/);
      if (websiteMatch && !data.website) {
        let website = websiteMatch[1];
        if (!website.startsWith('http')) {
          website = 'https://' + website;
        }
        data.website = website;
        continue;
      }

      // Title detection (common business titles)
      const titleMatch = line.match(/\b(CEO|CTO|CFO|COO|President|Vice President|VP|Director|Manager|Consultant|Engineer|Developer|Designer|Analyst|Coordinator|Assistant|Specialist|Representative|Sales|Marketing|Finance|HR|Human Resources)\b/i);
      if (titleMatch && !data.title) {
        data.title = line;
        continue;
      }

      // Company detection (look for common business entities)
      const companyMatch = line.match(/\b(Inc|LLC|Corp|Corporation|Company|Co|Ltd|Limited|Group|Associates|Partners|Solutions|Services|Systems|Technologies|Tech)\b/i);
      if (companyMatch && !data.company && line.length > 3) {
        data.company = line;
        continue;
      }

      // Name detection (assume first non-email/phone/website line is name)
      if (!data.fullName && line.length > 2 && line.length < 50 &&
          !line.includes('@') && !phoneMatch && !websiteMatch && !titleMatch && !companyMatch) {
        data.fullName = line;
        const nameParts = line.split(/\s+/);
        if (nameParts.length >= 2) {
          data.firstName = nameParts[0];
          data.lastName = nameParts[nameParts.length - 1];
        }
        continue;
      }

      // Address detection (longer lines that might contain address info)
      if (!data.address && line.length > 10 &&
          (line.match(/\d+.*?(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|place|pl)/i) ||
           line.match(/\b\d{5}\b/) || // ZIP code
           line.match(/\b[A-Z]{2}\s+\d{5}\b/))) { // State + ZIP
        data.address = line;
      }
    }

    return data;
  }

  /**
   * Check for duplicate contacts in the system
   */
  private async checkForDuplicates(
    businessCardData: BusinessCardData,
    companyId: string
  ): Promise<BusinessCardAnalysis['duplicateCheck']> {
    try {
      // In a real implementation, this would query the contacts database
      // For now, return a mock result
      return {
        existingContacts: [],
        potentialDuplicates: [],
        confidence: 0.95
      };
    } catch (error) {
      console.warn('Duplicate check failed:', error);
      return {
        existingContacts: [],
        potentialDuplicates: [],
        confidence: 0.5
      };
    }
  }

  /**
   * Calculate confidence score based on extracted data quality
   */
  private calculateConfidence(
    data: BusinessCardData,
    companyResearch?: WebEnrichmentResult
  ): number {
    let score = 0;
    let maxScore = 0;

    // Name (30 points)
    maxScore += 30;
    if (data.fullName) score += 30;
    else if (data.firstName || data.lastName) score += 15;

    // Company (25 points)
    maxScore += 25;
    if (data.company) score += 25;

    // Email (20 points)
    maxScore += 20;
    if (data.email) score += 20;

    // Phone (15 points)
    maxScore += 15;
    if (data.phone) score += 15;

    // Title (10 points)
    maxScore += 10;
    if (data.title) score += 10;

    // Web enrichment bonus
    if (companyResearch && companyResearch.confidence > 0.8) {
      score += 10;
    }

    return Math.round((score / maxScore) * 100);
  }

  /**
   * Generate suggestions based on analysis
   */
  private generateSuggestions(
    data: BusinessCardData,
    duplicateCheck?: BusinessCardAnalysis['duplicateCheck']
  ): string[] {
    const suggestions: string[] = [];

    if (!data.email) {
      suggestions.push('Consider asking for email address');
    }

    if (!data.phone) {
      suggestions.push('Phone number not detected - verify contact info');
    }

    if (duplicateCheck && duplicateCheck.potentialDuplicates.length > 0) {
      suggestions.push(`Found ${duplicateCheck.potentialDuplicates.length} potential duplicate(s)`);
    }

    if (!data.company) {
      suggestions.push('Company name not clearly identified');
    }

    if (suggestions.length === 0) {
      suggestions.push('All key information extracted successfully');
    }

    return suggestions;
  }

  /**
   * Generate action cards for business card processing
   */
  private async generateActionCards(
    analysis: BusinessCardAnalysis,
    userContext: { userId: string; companyId: string; role: string }
  ): Promise<ActionCard[]> {
    const cards: ActionCard[] = [];
    const { extractedData, companyResearch } = analysis;

    // Primary action: Create Contact
    cards.push({
      id: `create_contact_${Date.now()}`,
      type: 'create_contact',
      title: 'Create New Contact',
      description: `Add ${extractedData.fullName || 'this person'} to your contacts`,
      confidence: analysis.confidence,
      priority: 'high',
      data: {
        contact_type: 'prospect',
        first_name: extractedData.firstName,
        last_name: extractedData.lastName,
        full_name: extractedData.fullName,
        email: extractedData.email,
        phone: extractedData.phone,
        company: extractedData.company,
        title: extractedData.title,
        website: extractedData.website,
        address: extractedData.address,
        notes: `Contact created from business card on ${new Date().toLocaleDateString()}`
      },
      suggestedAction: 'create_contact',
      estimatedTime: 2,
      approval_required: false
    });

    // Secondary action: Create Customer (if company info is good)
    if (extractedData.company && companyResearch && companyResearch.confidence > 0.7) {
      cards.push({
        id: `create_customer_${Date.now()}`,
        type: 'create_customer',
        title: 'Create Customer Record',
        description: `Add ${extractedData.company} as a new customer`,
        confidence: companyResearch.confidence,
        priority: 'medium',
        data: {
          company_name: extractedData.company,
          contact_person: extractedData.fullName,
          email: extractedData.email,
          phone: extractedData.phone,
          website: companyResearch.website || extractedData.website,
          address: companyResearch.address || extractedData.address,
          description: companyResearch.description,
          industry: companyResearch.industry,
          notes: `Customer created from business card analysis on ${new Date().toLocaleDateString()}`
        },
        suggestedAction: 'create_customer',
        estimatedTime: 5,
        approval_required: true
      });
    }

    // Follow-up action: Schedule Meeting
    if (extractedData.email) {
      cards.push({
        id: `schedule_meeting_${Date.now()}`,
        type: 'schedule_meeting',
        title: 'Schedule Follow-up Meeting',
        description: `Send calendar invite to ${extractedData.fullName}`,
        confidence: 0.8,
        priority: 'low',
        data: {
          attendee_email: extractedData.email,
          attendee_name: extractedData.fullName,
          subject: `Follow-up meeting with ${extractedData.company || 'new contact'}`,
          duration: 30,
          type: 'discovery_call'
        },
        suggestedAction: 'schedule_meeting',
        estimatedTime: 3,
        approval_required: false
      });
    }

    return cards;
  }

  /**
   * Generate conversational message for business card processing
   */
  private generateConversationalMessage(
    analysis: BusinessCardAnalysis,
    actionCards: ActionCard[]
  ): string {
    const { extractedData, companyResearch } = analysis;

    let message = "Great! I've analyzed this business card. ";

    if (extractedData.fullName && extractedData.company) {
      message += `I found ${extractedData.fullName}`;
      if (extractedData.title) {
        message += `, ${extractedData.title}`;
      }
      message += ` from ${extractedData.company}.`;
    } else if (extractedData.fullName) {
      message += `I found contact information for ${extractedData.fullName}.`;
    } else {
      message += `I extracted some contact information from the card.`;
    }

    if (companyResearch && companyResearch.confidence > 0.8) {
      message += ` I also found some additional company information online to enrich the record.`;
    }

    if (actionCards.length > 0) {
      message += ` I've prepared ${actionCards.length} suggested action${actionCards.length > 1 ? 's' : ''} for you. `;

      const createContactCard = actionCards.find(card => card.type === 'create_contact');
      const createCustomerCard = actionCards.find(card => card.type === 'create_customer');

      if (createContactCard && createCustomerCard) {
        message += `Would you like to add them as a contact, create a customer record, or both?`;
      } else if (createContactCard) {
        message += `Shall I add them to your contacts?`;
      } else {
        message += `What would you like me to do with this information?`;
      }
    }

    return message;
  }
}