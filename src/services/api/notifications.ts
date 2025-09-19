import { BaseApiService, ApiResponse } from './base';
import { supabase } from '@/integrations/supabase/client';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  action_url?: string;
  metadata?: Record<string, any>;
  created_at: string;
  read_at?: string;
  expires_at?: string;
}

export interface CreateNotificationData {
  user_id: string;
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  action_url?: string;
  metadata?: Record<string, any>;
  expires_at?: string;
}

export class NotificationService extends BaseApiService {
  /**
   * Get notifications for the current user
   */
  async getUserNotifications(limit = 50, unreadOnly = false): Promise<ApiResponse<Notification[]>> {
    return this.handleRequest(async () => {
      try {
        let query = supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (unreadOnly) {
          query = query.eq('read', false);
        }

        // Add expiration filter
        query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

        const { data, error } = await query;
        return { data, error };
      } catch (error) {
        // Gracefully handle if table doesn't exist
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as { message: string }).message;
          if (errorMessage.includes('relation "notifications" does not exist')) {
            console.warn('Notifications table not yet created. Returning empty array.');
            return { data: [], error: null };
          }
        }
        throw error;
      }
    });
  }

  /**
   * Create a new notification
   */
  async createNotification(notificationData: CreateNotificationData): Promise<ApiResponse<Notification>> {
    return this.handleRequest(async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .insert(notificationData)
          .select()
          .single();

        return { data, error };
      } catch (error) {
        // Gracefully handle if table doesn't exist
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as { message: string }).message;
          if (errorMessage.includes('relation "notifications" does not exist')) {
            console.warn('Notifications table not yet created. Notification not stored.');
            return { data: null, error: { message: 'Notifications table not available' } };
          }
        }
        throw error;
      }
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({
            read: true,
            read_at: new Date().toISOString()
          })
          .eq('id', notificationId);

        return { data: undefined, error };
      } catch (error) {
        // Gracefully handle if table doesn't exist
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as { message: string }).message;
          if (errorMessage.includes('relation "notifications" does not exist')) {
            console.warn('Notifications table not yet created. Mark as read ignored.');
            return { data: undefined, error: null };
          }
        }
        throw error;
      }
    });
  }

  /**
   * Mark all notifications as read for current user
   */
  async markAllAsRead(): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({
            read: true,
            read_at: new Date().toISOString()
          })
          .eq('read', false);

        return { data: undefined, error };
      } catch (error) {
        // Gracefully handle if table doesn't exist
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as { message: string }).message;
          if (errorMessage.includes('relation "notifications" does not exist')) {
            console.warn('Notifications table not yet created. Mark all as read ignored.');
            return { data: undefined, error: null };
          }
        }
        throw error;
      }
    });
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<ApiResponse<void>> {
    return this.handleRequest(async () => {
      try {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId);

        return { data: undefined, error };
      } catch (error) {
        // Gracefully handle if table doesn't exist
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as { message: string }).message;
          if (errorMessage.includes('relation "notifications" does not exist')) {
            console.warn('Notifications table not yet created. Delete ignored.');
            return { data: undefined, error: null };
          }
        }
        throw error;
      }
    });
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<ApiResponse<number>> {
    return this.handleRequest(async () => {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('read', false)
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

        return { data: count ?? 0, error };
      } catch (error) {
        // Gracefully handle if table doesn't exist
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as { message: string }).message;
          if (errorMessage.includes('relation "notifications" does not exist')) {
            console.warn('Notifications table not yet created. Returning count 0.');
            return { data: 0, error: null };
          }
        }
        throw error;
      }
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();