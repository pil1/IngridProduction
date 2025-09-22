/**
 * Ingrid AI Settings Service
 *
 * Handles company-specific AI configuration storage and retrieval
 */

import { supabase } from '@/integrations/supabase/client';

export interface IngridCompanySettings {
  openai_api_key?: string;
  ai_provider?: 'openai' | 'mock';
  ai_model?: string;
  ai_enabled?: boolean;
  ocr_provider?: 'openai-vision' | 'google-vision' | 'aws-textract' | 'azure-document' | 'mock';
  google_vision_api_key?: string;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  aws_region?: string;
  azure_api_key?: string;
  azure_endpoint?: string;
  enable_web_enrichment?: boolean;
  enable_spire_integration?: boolean;
  auto_approval_threshold?: number;
}

export class IngridSettingsService {
  /**
   * Get AI settings for a company
   */
  static async getCompanyAISettings(companyId: string): Promise<IngridCompanySettings> {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select(`
          openai_api_key,
          ai_provider,
          ai_model,
          ai_enabled,
          ocr_provider,
          google_vision_api_key,
          aws_access_key_id,
          aws_secret_access_key,
          aws_region,
          azure_api_key,
          azure_endpoint,
          enable_web_enrichment,
          enable_spire_integration,
          auto_approval_threshold
        `)
        .eq('company_id', companyId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data ?? {};
    } catch (error) {
      console.error('Failed to fetch company AI settings:', error);
      return {};
    }
  }

  /**
   * Update AI settings for a company
   */
  static async updateCompanyAISettings(
    companyId: string,
    settings: Partial<IngridCompanySettings>
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          company_id: companyId,
          ...settings,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'company_id'
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Failed to update company AI settings:', error);
      throw error;
    }
  }

  /**
   * Validate OpenAI API key
   */
  static async validateOpenAIKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }

  /**
   * Get available AI models for a provider
   */
  static getAvailableModels(provider: string): string[] {
    switch (provider) {
      case 'openai':
        return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      default:
        return ['mock-model'];
    }
  }

  /**
   * Get AI configuration status for a company
   */
  static async getAIStatus(companyId: string): Promise<{
    hasApiKey: boolean;
    aiEnabled: boolean;
    provider: string;
    model: string;
  }> {
    const settings = await this.getCompanyAISettings(companyId);

    return {
      hasApiKey: !!settings.openai_api_key,
      aiEnabled: !!settings.ai_enabled,
      provider: settings.ai_provider ?? 'mock',
      model: settings.ai_model ?? 'mock-model'
    };
  }
}