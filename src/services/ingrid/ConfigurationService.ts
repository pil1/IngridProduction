/**
 * Ingrid Configuration Service
 *
 * Manages configuration for AI providers, API keys, and feature toggles.
 * Allows users to upgrade from mock services to real AI integration.
 */

import { IngridConfig } from '@/types/ingrid';

export class ConfigurationService {
  private static readonly CONFIG_KEY = 'ingrid_config';
  private static readonly DEFAULT_CONFIG: IngridConfig = {
    aiProvider: 'openai',
    model: 'gpt-4',
    maxTokens: 2000,
    temperature: 0.3,
    enableWebEnrichment: true,
    enableSPIREIntegration: true,
    autoApprovalThreshold: 0.95,
    conversationTimeout: 30,
    ocrProvider: 'google-document-ai'
  };

  /**
   * Get current configuration from localStorage or defaults
   */
  static getConfig(): IngridConfig {
    try {
      const stored = localStorage.getItem(this.CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Force update OCR provider to Google Document AI if it's currently set to old values
        if (parsed.ocrProvider !== 'google-document-ai' && parsed.ocrProvider !== 'openai-vision') {
          parsed.ocrProvider = 'google-document-ai';
          this.saveConfig(parsed);
        }
        return { ...this.DEFAULT_CONFIG, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load Ingrid config from localStorage:', error);
    }

    return { ...this.DEFAULT_CONFIG };
  }

  /**
   * Save configuration to localStorage
   */
  static saveConfig(config: Partial<IngridConfig>): IngridConfig {
    const currentConfig = this.getConfig();
    const newConfig = { ...currentConfig, ...config };

    try {
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(newConfig));
      console.log('✅ Ingrid configuration saved');
    } catch (error) {
      console.error('Failed to save Ingrid config:', error);
    }

    return newConfig;
  }

  /**
   * Configure OpenAI API key and enable real AI features
   */
  static enableOpenAI(apiKey: string): IngridConfig {
    return this.saveConfig({
      aiProvider: 'openai',
      apiKey: apiKey,
      ocrProvider: 'openai-vision' // Upgrade OCR to real AI too
    });
  }


  /**
   * Check if real AI is available and configured
   */
  static isRealAIEnabled(): boolean {
    const config = this.getConfig();
    return !!(config.apiKey && config.aiProvider === 'openai');
  }

  /**
   * Get configuration status for UI display
   */
  static getConfigurationStatus(): {
    realAI: boolean;
    realOCR: boolean;
    webEnrichment: boolean;
    spireIntegration: boolean;
    provider: string;
    ocrProvider: string;
  } {
    const config = this.getConfig();
    return {
      realAI: this.isRealAIEnabled(),
      realOCR: true, // Always true now since we only support real OCR providers
      webEnrichment: config.enableWebEnrichment,
      spireIntegration: config.enableSPIREIntegration,
      provider: config.aiProvider,
      ocrProvider: config.ocrProvider
    };
  }

  /**
   * Validate API key by making a test request
   */
  static async validateOpenAIKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('OpenAI API key validation failed:', error);
      return false;
    }
  }

  /**
   * Reset configuration to defaults
   */
  static resetToDefaults(): IngridConfig {
    try {
      localStorage.removeItem(this.CONFIG_KEY);
      console.log('✅ Ingrid configuration reset to defaults');
    } catch (error) {
      console.error('Failed to reset Ingrid config:', error);
    }

    return { ...this.DEFAULT_CONFIG };
  }

  /**
   * Export configuration for backup
   */
  static exportConfig(): string {
    const config = this.getConfig();
    // Remove sensitive data from export
    const exportConfig = { ...config };
    delete exportConfig.apiKey;
    return JSON.stringify(exportConfig, null, 2);
  }

  /**
   * Import configuration from backup
   */
  static importConfig(configJson: string): IngridConfig {
    try {
      const imported = JSON.parse(configJson);
      return this.saveConfig(imported);
    } catch (error) {
      console.error('Failed to import Ingrid config:', error);
      throw new Error('Invalid configuration format');
    }
  }
}