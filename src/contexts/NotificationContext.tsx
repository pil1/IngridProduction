import React, { useEffect, useState, useCallback, startTransition } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { NotificationContext, Notification } from './NotificationContextTypes';
import { RealtimeChannel } from '@supabase/supabase-js';

// Type for Supabase errors
interface SupabaseError {
  code?: string;
  message: string;
  details?: string;
}


interface NotificationProviderProps {
  children: React.ReactNode;
}

// Create the provider component
function NotificationProvider({ children }: NotificationProviderProps) {
  const { session, profile, isLoading: sessionLoading } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch notifications for the current user
  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;

    setIsLoading(true);
    try {
      // Check if notifications table exists, fallback to expense_notifications or disable
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        // If notifications table doesn't exist, silently fail instead of crashing
        if (error.code === 'PGRST205') {
          console.warn('Notifications table not found - feature disabled');
          startTransition(() => {
            setNotifications([]);
          });
          return;
        }
        throw error;
      }

      startTransition(() => {
        setNotifications(data ?? []);
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      // Don't show toast error for missing table - fail silently
      if (supabaseError.code !== 'PGRST205') {
        toast.error('Failed to load notifications');
      }
      startTransition(() => {
        setNotifications([]);
      });
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id]);

  // Set up real-time subscription
  useEffect(() => {
    // Don't initialize if session is still loading or no profile
    if (sessionLoading || !profile?.id) return;

    let isNotificationsTableAvailable = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const initializeNotifications = async () => {
      try {
        await fetchNotifications();
      } catch (error: unknown) {
        const supabaseError = error as SupabaseError;
        console.error('Failed to initialize notifications:', error);
        // If notifications table doesn't exist, don't set up real-time subscription
        if (supabaseError?.code === 'PGRST205') {
          isNotificationsTableAvailable = false;
        }
      }
    };

    // Initialize notifications and set up polling
    initializeNotifications().then(() => {
      // Only set up real-time subscription if the table exists
      if (!isNotificationsTableAvailable) {
        console.warn('Notifications table not available - skipping real-time subscription');
        return;
      }

      // TODO: Implement real-time notifications with PostgreSQL backend
      // For now, disable real-time subscription during PostgreSQL migration
      console.log('Real-time notifications temporarily disabled during PostgreSQL migration');

      // Set up periodic polling as a temporary workaround
      pollInterval = setInterval(() => {
        if (profile?.id) {
          fetchNotifications().catch(console.error);
        }
      }, 30000); // Poll every 30 seconds
    });

    // Cleanup function
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [sessionLoading, profile?.id, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        // If notifications table doesn't exist, silently fail
        if (error.code === 'PGRST205') {
          console.warn('Notifications table not found - mark as read disabled');
          return;
        }
        throw error;
      }

      startTransition(() => {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
      });
    } catch (error: unknown) {
      const supabaseError = error as SupabaseError;
      console.error('Error marking notification as read:', error);
      // Don't show toast error for missing table - fail silently
      if (supabaseError.code !== 'PGRST205') {
        startTransition(() => {
          toast.error('Failed to mark notification as read');
        });
      }
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', profile.id)
        .eq('read', false);

      if (error) {
        // If notifications table doesn't exist, silently fail
        if (error.code === 'PGRST205') {
          console.warn('Notifications table not found - mark all as read disabled');
          return;
        }
        throw error;
      }

      startTransition(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      });
      startTransition(() => {
        toast.success('All notifications marked as read');
      });
    } catch (error: unknown) {
      const supabaseError = error as SupabaseError;
      console.error('Error marking all notifications as read:', error);
      // Don't show toast error for missing table - fail silently
      if (supabaseError.code !== 'PGRST205') {
        startTransition(() => {
          toast.error('Failed to mark all notifications as read');
        });
      }
    }
  }, [profile?.id]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        // If notifications table doesn't exist, silently fail
        if (error.code === 'PGRST205') {
          console.warn('Notifications table not found - delete notification disabled');
          return;
        }
        throw error;
      }

      startTransition(() => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
      });
    } catch (error: unknown) {
      const supabaseError = error as SupabaseError;
      console.error('Error deleting notification:', error);
      // Don't show toast error for missing table - fail silently
      if (supabaseError.code !== 'PGRST205') {
        startTransition(() => {
          toast.error('Failed to delete notification');
        });
      }
    }
  }, []);

  const clearAll = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', profile.id);

      if (error) {
        // If notifications table doesn't exist, silently fail
        if (error.code === 'PGRST205') {
          console.warn('Notifications table not found - clear all disabled');
          return;
        }
        throw error;
      }

      startTransition(() => {
        setNotifications([]);
      });
      startTransition(() => {
        toast.success('All notifications cleared');
      });
    } catch (error: unknown) {
      const supabaseError = error as SupabaseError;
      console.error('Error clearing notifications:', error);
      // Don't show toast error for missing table - fail silently
      if (supabaseError.code !== 'PGRST205') {
        startTransition(() => {
          toast.error('Failed to clear notifications');
        });
      }
    }
  }, [profile?.id]);

  const sendNotification = useCallback(async (
    userId: string,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    metadata?: Record<string, unknown>
  ) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type,
          metadata,
          read: false,
        });

      if (error) {
        // If notifications table doesn't exist, silently fail
        if (error.code === 'PGRST205') {
          console.warn('Notifications table not found - send notification disabled');
          return;
        }
        throw error;
      }
    } catch (error: unknown) {
      const supabaseError = error as SupabaseError;
      console.error('Error sending notification:', error);
      // Don't throw error for missing table - fail silently
      if (supabaseError.code !== 'PGRST205') {
        throw error;
      }
    }
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Provide loading state if session is still loading
  const contextValue = sessionLoading ? {
    notifications: [],
    unreadCount: 0,
    markAsRead: async () => {},
    markAllAsRead: async () => {},
    deleteNotification: async () => {},
    clearAll: async () => {},
    isLoading: true,
    sendNotification: async () => {},
  } : {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    isLoading,
    sendNotification,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export { NotificationProvider };
export default NotificationProvider;