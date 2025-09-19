import { createContext } from 'react';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  created_at: string;
  user_id: string;
  metadata?: Record<string, any>;
}

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
  clearAll: () => void;
  isLoading: boolean;
  sendNotification: (
    userId: string,
    title: string,
    message: string,
    type?: 'info' | 'success' | 'warning' | 'error',
    metadata?: Record<string, any>
  ) => Promise<void>;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);