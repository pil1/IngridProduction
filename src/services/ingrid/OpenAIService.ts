/**
 * OpenAI Service for Ingrid AI
 *
 * Provides permission-aware OpenAI integration using company API keys.
 * Includes usage tracking, guardrails, and proper error handling.
 */

import { apiKeyService } from '@/services/api/apiKeys';
import { permissionGuard } from '@/services/permissions/PermissionGuardService';
import { ingridPermissionsService } from '@/services/api/ingridPermissions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  finish_reason: string;
}

export interface IngridContext {
  userId: string;
  companyId: string;
  userRole: string;
  currentPage: string;
  permissions: string[];
  sessionId: string;
}

export class OpenAIService {
  private static instance: OpenAIService;

  static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  /**
   * Get company's OpenAI API key securely
   */
  private async getCompanyApiKey(companyId: string): Promise<string | null> {
    try {
      const response = await apiKeyService.getByCompany(companyId);

      if (!response.success || !response.data) {
        console.warn(`No API keys found for company ${companyId}`);
        return null;
      }

      const openaiKey = response.data.find(
        key => key.provider === 'openai' && key.is_active
      );

      if (!openaiKey?.api_key_encrypted) {
        console.warn(`No active OpenAI API key found for company ${companyId}`);
        return null;
      }

      // In production, properly decrypt the key
      // For now, remove the "encrypted_" prefix
      return openaiKey.api_key_encrypted.replace('encrypted_', '');
    } catch (error) {
      console.error('Error retrieving company API key:', error);

      // If the table doesn't exist, return null gracefully
      if (error instanceof Error && error.message.includes('does not exist')) {
        console.warn('API Keys table not yet created. Migration needed.');
        return null;
      }

      return null;
    }
  }

  /**
   * Generate system prompt with permission awareness and guardrails
   */
  private generateSystemPrompt(context: IngridContext): string {
    const { userRole, currentPage, permissions } = context;

    let systemPrompt = `You are Ingrid, an intelligent AI assistant for INFOtrac, a business expense management platform.

CORE IDENTITY:
- Professional, helpful, and efficient
- Expert in expense management, document processing, and business workflows
- Always maintain user privacy and data security
- Provide accurate, actionable advice

USER CONTEXT:
- Role: ${userRole}
- Current Page: ${currentPage}
- Available Permissions: ${permissions.join(', ')}

CAPABILITIES YOU CAN HELP WITH:`;

    // Add permission-aware capabilities
    if (permissions.includes('expenses:create') || permissions.includes('expenses:edit')) {
      systemPrompt += `
- ✅ Process receipt images and extract expense data
- ✅ Create and manage expense records
- ✅ Suggest expense categories and GL accounts`;
    }

    if (permissions.includes('vendors:create') || permissions.includes('vendors:edit')) {
      systemPrompt += `
- ✅ Process business cards and create vendor records
- ✅ Enrich vendor data from web sources
- ✅ Manage vendor relationships and contacts`;
    }

    if (permissions.includes('analytics:view')) {
      systemPrompt += `
- ✅ Generate reports and business insights
- ✅ Analyze spending patterns and trends
- ✅ Create custom dashboards`;
    }

    systemPrompt += `

STRICT GUARDRAILS:
- NEVER access or reference data you don't have permission to see
- NEVER perform actions the user lacks permissions for
- NEVER provide information about other companies or users
- NEVER generate or process sensitive financial data without explicit permission
- NEVER access company API keys or encryption details
- NEVER impersonate other users or escalate privileges

RESPONSE STYLE:
- Be conversational but professional
- Provide specific, actionable suggestions
- Use emojis sparingly and appropriately
- Keep responses concise but comprehensive
- Always explain what you can and cannot do based on user permissions

If asked to do something outside your permissions, politely explain the limitation and suggest alternatives.`;

    return systemPrompt;
  }

  /**
   * Apply content filtering and guardrails
   */
  private applyGuardrails(content: string, context: IngridContext): string {
    // Remove any potential sensitive information
    const filtered = content
      .replace(/sk-[a-zA-Z0-9]{48}/g, '[API_KEY_REDACTED]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD_NUMBER_REDACTED]');

    // Add permission context if suggesting restricted actions
    if (content.includes('create') || content.includes('delete') || content.includes('modify')) {
      const permissionCheck = permissionGuard.checkPermission(context.userId, 'general:create');
      if (!permissionCheck.hasPermission) {
        return filtered + '\n\n⚠️ Note: Some suggested actions may require additional permissions. Please contact your administrator if you need access.';
      }
    }

    return filtered;
  }

  /**
   * Send message to OpenAI with permission-aware context
   */
  async sendMessage(
    messages: ChatMessage[],
    context: IngridContext
  ): Promise<OpenAIResponse | null> {
    try {
      // Check if user is super-admin (they don't have a company context)
      if (context.userRole === 'super-admin' || !context.companyId) {
        return {
          content: `👑 **Super-Admin Notice**: As a super-admin, you don't have a company context for Ingrid AI chat.

Super-admins can:
• Manage API keys for all companies via the API Key Manager
• Configure Ingrid AI settings for other companies
• Monitor usage across all organizations

To test Ingrid AI:
1. Switch to a regular company user account
2. Or use the API Key Manager to test AI functionality

Need assistance with super-admin features? I can help with:
• API key management guidance
• Company administration
• System configuration
• Platform oversight`,
          model: 'super-admin-notice',
          finish_reason: 'super_admin_notice',
        };
      }

      // Check if user has Ingrid chat permission
      const hasPermission = await ingridPermissionsService.checkUserPermission(
        context.userId,
        'chat'
      );

      if (!hasPermission.success || !hasPermission.data) {
        return {
          content: `🔒 **Access Required**: You need Ingrid AI chat permissions to use this feature.

Contact your administrator to:
• Enable Ingrid AI module for your company
• Grant you chat permissions
• Configure your access level

Your administrator can manage Ingrid permissions in Company Settings > Ingrid AI.`,
          model: 'permission-denied',
          finish_reason: 'no_permission',
        };
      }

      // Get company's API key
      const apiKey = await this.getCompanyApiKey(context.companyId);

      if (!apiKey) {
        // Return a helpful fallback response instead of throwing an error
        return {
          content: `🔧 **Setup Required**: I need an OpenAI API key to provide AI-powered responses.

To enable my full capabilities:
1. Contact your super-admin to configure an OpenAI API key
2. Go to API Key Manager in the admin panel
3. Add your company's OpenAI API key

For now, I can still help you with:
• Document processing workflows
• Business process guidance
• Feature explanations
• General INFOtrac assistance

What can I help you with today?`,
          model: 'fallback',
          finish_reason: 'no_api_key',
        };
      }

      // Generate permission-aware system prompt
      const systemPrompt = this.generateSystemPrompt(context);

      // Prepare messages with system prompt
      const requestMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: requestMessages,
          max_tokens: 1000,
          temperature: 0.7,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      if (!choice) {
        throw new Error('No response from OpenAI');
      }

      // Apply guardrails to response content
      const filteredContent = this.applyGuardrails(choice.message.content, context);

      // Track API usage
      await this.trackUsage(context.companyId, data.usage?.total_tokens || 0);

      // Track user Ingrid usage
      await ingridPermissionsService.incrementUsage(context.userId, 'chat', 1);

      return {
        content: filteredContent,
        usage: data.usage,
        model: data.model,
        finish_reason: choice.finish_reason,
      };

    } catch (error) {
      console.error('OpenAI Service error:', error);

      // Return user-friendly error
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          return {
            content: "I'm unable to connect to my AI services right now. Please check that your company has a valid OpenAI API key configured, or contact your administrator for assistance.",
            model: 'error',
            finish_reason: 'api_key_error',
          };
        }

        if (error.message.includes('quota') || error.message.includes('limit')) {
          return {
            content: "I've temporarily reached my usage limits. Please try again in a few moments, or contact your administrator to review your API quota.",
            model: 'error',
            finish_reason: 'quota_exceeded',
          };
        }
      }

      return {
        content: "I'm experiencing technical difficulties right now. Please try again in a moment, or contact support if the issue persists.",
        model: 'error',
        finish_reason: 'service_error',
      };
    }
  }

  /**
   * Track API usage for billing and monitoring
   */
  private async trackUsage(companyId: string, tokens: number): Promise<void> {
    try {
      // Find the OpenAI API key record
      const response = await apiKeyService.getByCompany(companyId);

      if (response.success && response.data) {
        const openaiKey = response.data.find(
          key => key.provider === 'openai' && key.is_active
        );

        if (openaiKey) {
          // Increment usage count (approximate token usage)
          const estimatedCalls = Math.ceil(tokens / 1000); // Rough estimate
          await apiKeyService.incrementUsage(openaiKey.id, estimatedCalls);
        }
      }
    } catch (error) {
      console.error('Error tracking API usage:', error);
      // Don't fail the request if usage tracking fails
    }
  }

  /**
   * Check if user has permission to use AI features
   */
  isAIAccessAllowed(context: IngridContext): boolean {
    // Basic permission check - can be expanded based on business rules
    const requiredPermissions = ['ai:chat', 'general:read'];

    return requiredPermissions.some(permission =>
      context.permissions.includes(permission)
    );
  }

  /**
   * Get usage limits for the company
   */
  async getUsageLimits(companyId: string): Promise<{
    current: number;
    limit: number | null;
    percentage: number;
  }> {
    try {
      const response = await apiKeyService.getByCompany(companyId);

      if (response.success && response.data) {
        const openaiKey = response.data.find(
          key => key.provider === 'openai' && key.is_active
        );

        if (openaiKey) {
          const current = openaiKey.usage_count || 0;
          const limit = openaiKey.monthly_usage_limit;
          const percentage = limit ? (current / limit) * 100 : 0;

          return { current, limit, percentage };
        }
      }
    } catch (error) {
      console.error('Error getting usage limits:', error);
    }

    return { current: 0, limit: null, percentage: 0 };
  }
}

export const openAIService = OpenAIService.getInstance();