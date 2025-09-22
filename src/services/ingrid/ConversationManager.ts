/**
 * Conversation Manager
 *
 * Manages chat state, conversation history, and message flow
 * for the Ingrid AI assistant.
 */

import {
  ConversationContext,
  ConversationMessage,
  ConversationStatus,
  IngridConfig,
  IngridError
} from '@/types/ingrid';

export class ConversationManager {
  private config: IngridConfig;
  private conversations: Map<string, ConversationContext> = new Map();

  constructor(config: IngridConfig) {
    this.config = config;
  }

  /**
   * Create a new conversation
   */
  async createConversation(userId: string, companyId: string): Promise<string> {
    const conversationId = this.generateConversationId();
    const now = new Date().toISOString();

    const conversation: ConversationContext = {
      id: conversationId,
      userId,
      companyId,
      startedAt: now,
      lastActivity: now,
      status: 'active',
      messages: [],
      metadata: {}
    };

    this.conversations.set(conversationId, conversation);
    console.log(`💬 New conversation created: ${conversationId}`);

    return conversationId;
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(conversationId: string, message: ConversationMessage): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new IngridError('Conversation not found', 'CONVERSATION_NOT_FOUND');
    }

    conversation.messages.push(message);
    conversation.lastActivity = new Date().toISOString();

    console.log(`💬 Message added to conversation ${conversationId}: ${message.role}`);
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<ConversationContext | undefined> {
    return this.conversations.get(conversationId);
  }

  /**
   * Get recent conversations for a user
   */
  async getUserConversations(userId: string, limit = 10): Promise<ConversationContext[]> {
    const userConversations = Array.from(this.conversations.values())
      .filter(conv => conv.userId === userId)
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
      .slice(0, limit);

    return userConversations;
  }

  /**
   * Update conversation status
   */
  async updateStatus(conversationId: string, status: ConversationStatus): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new IngridError('Conversation not found', 'CONVERSATION_NOT_FOUND');
    }

    conversation.status = status;
    conversation.lastActivity = new Date().toISOString();

    console.log(`💬 Conversation ${conversationId} status updated to: ${status}`);
  }

  /**
   * Clean up old conversations
   */
  async cleanupOldConversations(): Promise<void> {
    const cutoffTime = new Date(Date.now() - this.config.conversationTimeout * 60 * 1000);
    let cleaned = 0;

    for (const [id, conversation] of this.conversations.entries()) {
      const lastActivity = new Date(conversation.lastActivity);
      if (lastActivity < cutoffTime && conversation.status !== 'waiting_approval') {
        this.conversations.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old conversations`);
    }
  }

  /**
   * Generate conversation summary
   */
  async generateSummary(conversationId: string): Promise<string> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new IngridError('Conversation not found', 'CONVERSATION_NOT_FOUND');
    }

    const messageCount = conversation.messages.length;
    const duration = this.calculateDuration(conversation.startedAt, conversation.lastActivity);
    const actionCards = conversation.messages
      .flatMap(m => m.actionCards || [])
      .length;

    return `Conversation with ${messageCount} messages over ${duration}. Generated ${actionCards} action cards.`;
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateDuration(start: string, end: string): string {
    const startTime = new Date(start);
    const endTime = new Date(end);
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'less than a minute';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''}`;

    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  }
}