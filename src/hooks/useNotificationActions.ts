import { useCallback } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NotificationActionOptions {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  metadata?: Record<string, any>;
}

export const useNotificationActions = () => {
  const { sendNotification } = useNotifications();

  // Get users for notification targeting
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role');

      if (error) throw error;
      return data ?? [];
    },
  });

  // Send notification to specific user
  const notifyUser = useCallback(async (
    userId: string,
    options: NotificationActionOptions
  ) => {
    try {
      await sendNotification(
        userId,
        options.title,
        options.message,
        options.type,
        options.metadata
      );
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }, [sendNotification]);

  // Send notification to multiple users
  const notifyUsers = useCallback(async (
    userIds: string[],
    options: NotificationActionOptions
  ) => {
    try {
      await Promise.all(
        userIds.map(userId =>
          sendNotification(
            userId,
            options.title,
            options.message,
            options.type,
            options.metadata
          )
        )
      );
    } catch (error) {
      console.error('Failed to send notifications:', error);
    }
  }, [sendNotification]);

  // Send notification to users by role
  const notifyByRole = useCallback(async (
    roles: string[],
    options: NotificationActionOptions
  ) => {
    const targetUsers = users.filter(user => roles.includes(user.role));
    const userIds = targetUsers.map(user => user.id);

    if (userIds.length > 0) {
      await notifyUsers(userIds, options);
    }
  }, [users, notifyUsers]);

  // Expense-related notifications
  const notifyExpenseApproved = useCallback(async (
    submitterId: string,
    expenseDescription: string,
    amount: number
  ) => {
    await notifyUser(submitterId, {
      title: 'Expense Approved',
      message: `Your expense "${expenseDescription}" for $${amount.toFixed(2)} has been approved.`,
      type: 'success',
      metadata: { action: 'expense_approved', amount }
    });
  }, [notifyUser]);

  const notifyExpenseRejected = useCallback(async (
    submitterId: string,
    expenseDescription: string,
    amount: number
  ) => {
    await notifyUser(submitterId, {
      title: 'Expense Rejected',
      message: `Your expense "${expenseDescription}" for $${amount.toFixed(2)} has been rejected. Please review and resubmit.`,
      type: 'error',
      metadata: { action: 'expense_rejected', amount }
    });
  }, [notifyUser]);

  const notifyExpenseInfoRequested = useCallback(async (
    submitterId: string,
    expenseDescription: string
  ) => {
    await notifyUser(submitterId, {
      title: 'Additional Information Required',
      message: `Additional information is required for your expense "${expenseDescription}". Please check your expense and provide the requested details.`,
      type: 'warning',
      metadata: { action: 'expense_info_requested' }
    });
  }, [notifyUser]);

  const notifyNewExpenseSubmitted = useCallback(async (
    expenseDescription: string,
    amount: number,
    submitterName: string
  ) => {
    await notifyByRole(['admin', 'controller', 'super-admin'], {
      title: 'New Expense Submitted',
      message: `${submitterName} submitted a new expense "${expenseDescription}" for $${amount.toFixed(2)} awaiting review.`,
      type: 'info',
      metadata: { action: 'expense_submitted', amount, submitterName }
    });
  }, [notifyByRole]);

  const notifyBulkActionCompleted = useCallback(async (
    targetUserIds: string[],
    action: string,
    itemCount: number,
    itemType: string
  ) => {
    await notifyUsers(targetUserIds, {
      title: 'Bulk Action Completed',
      message: `Bulk ${action} operation completed successfully on ${itemCount} ${itemType}.`,
      type: 'success',
      metadata: { action: 'bulk_action', itemCount, itemType }
    });
  }, [notifyUsers]);

  // System notifications
  const notifySystemMaintenance = useCallback(async (
    message: string,
    scheduledTime?: string
  ) => {
    const allUserIds = users.map(user => user.id);
    await notifyUsers(allUserIds, {
      title: 'System Maintenance Notice',
      message: scheduledTime
        ? `${message} Scheduled for ${scheduledTime}.`
        : message,
      type: 'warning',
      metadata: { action: 'system_maintenance', scheduledTime }
    });
  }, [users, notifyUsers]);

  const notifySystemUpdate = useCallback(async (
    version: string,
    features: string[]
  ) => {
    const allUserIds = users.map(user => user.id);
    await notifyUsers(allUserIds, {
      title: `System Update - v${version}`,
      message: `New features available: ${features.join(', ')}. Check out the latest improvements!`,
      type: 'info',
      metadata: { action: 'system_update', version, features }
    });
  }, [users, notifyUsers]);

  return {
    notifyUser,
    notifyUsers,
    notifyByRole,
    notifyExpenseApproved,
    notifyExpenseRejected,
    notifyExpenseInfoRequested,
    notifyNewExpenseSubmitted,
    notifyBulkActionCompleted,
    notifySystemMaintenance,
    notifySystemUpdate,
    users,
  };
};

export default useNotificationActions;