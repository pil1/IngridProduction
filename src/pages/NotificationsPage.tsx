"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Bell, Flag, Archive, ArchiveRestore, ChevronDown, ChevronUp } from "lucide-react"; // Changed Trash2 to Archive, added ArchiveRestore
import { useSession } from "@/components/SessionContextProvider";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { cn, truncateText } from "@/lib/utils";
import { ResizableTable, TableColumn } from "@/components/ResizableTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ExpenseNotification {
  id: string;
  expense_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  is_archived: boolean;
  is_flagged: boolean;
  created_at: string;
  expenses: { title: string } | null;
}

// Type for table row rendering dynamic props
type NotificationDynamicProps = {
  isSubmitPending?: boolean;
  isDeletePending?: boolean;
  expenseToDeleteId?: string | null;
  onEditClick?: (row: ExpenseNotification) => void;
  onSubmitClick?: (id: string) => void;
  onDeleteClick?: (row: ExpenseNotification) => void;
  onRowClick?: (row: ExpenseNotification) => void;
  expandedRowId?: string | null;
};

// Type for Supabase error
type SupabaseError = {
  message: string;
  code?: string;
  details?: string;
};

const NotificationsPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const currentUserId = profile?.user_id;

  const [activeTab, setActiveTab] = useState("all");
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);

  // Fetch ALL notifications for the current user with error handling
  const { data: allNotifications, isLoading, isError, refetch } = useQuery<ExpenseNotification[]>({
    queryKey: ["notifications", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];
      try {
        const { data, error } = await supabase
          .from("expense_notifications")
          .select(`
            *,
            expenses (title)
          `)
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false });

        if (error) {
          // If table doesn't exist (404 error), return empty array instead of throwing
          if (error.message?.includes('relation "public.expense_notifications" does not exist') ||
              error.code === 'PGRST116' ||
              error.code === '42P01') {
            console.warn('Notifications table not found, returning empty notifications');
            return [];
          }
          throw error;
        }

        const typedData: ExpenseNotification[] = (data as any[]).map(item => ({
          ...item,
          expenses: item.expenses && item.expenses.length > 0 ? item.expenses[0] : null,
        }));
        return typedData;
      } catch (error: unknown) {
        const supabaseError = error as SupabaseError;
        // Handle network or other errors gracefully
        if (supabaseError.message?.includes('404') || supabaseError.message?.includes('relation') || supabaseError.code === '42P01') {
          console.warn('Notifications table not available, falling back to empty notifications:', error);
          return [];
        }
        throw error;
      }
    },
    enabled: !!currentUserId,
    retry: false, // Don't retry if table doesn't exist
  });

  const filteredNotifications = useMemo(() => {
    if (!allNotifications) return [];
    switch (activeTab) {
      case "unread":
        return allNotifications.filter(n => !n.is_read && !n.is_archived);
      case "read":
        return allNotifications.filter(n => n.is_read && !n.is_archived);
      case "archive":
        return allNotifications.filter(n => n.is_archived);
      case "all":
      default:
        return allNotifications.filter(n => !n.is_archived); // 'All' excludes archived by default
    }
  }, [allNotifications, activeTab]);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      try {
        const { error } = await supabase
          .from("expense_notifications")
          .update({ is_read: true })
          .eq("id", notificationId)
          .eq("user_id", currentUserId);
        if (error && !error.message?.includes('404')) throw error;
        return null;
      } catch (error: unknown) {
        const supabaseError = error as SupabaseError;
        if (error.message?.includes('404') || error.message?.includes('relation')) {
          console.warn('Cannot mark notification as read - table not available');
          return null;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["unreadNotifications", currentUserId] });
      toast({
        title: "Notification Marked as Read",
        description: "The notification has been marked as read.",
      });
    },
    onError: (error: SupabaseError) => {
      toast({
        title: "Error marking notification as read",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const archiveNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      try {
        const { error } = await supabase
          .from("expense_notifications")
          .update({ is_archived: true, is_read: true }) // Mark as read when archiving
          .eq("id", notificationId)
          .eq("user_id", currentUserId);
        if (error && !error.message?.includes('404')) throw error;
        return null;
      } catch (error: unknown) {
        const supabaseError = error as SupabaseError;
        if (error.message?.includes('404') || error.message?.includes('relation')) {
          console.warn('Cannot archive notification - table not available');
          return null;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["unreadNotifications", currentUserId] });
      toast({
        title: "Notification Cleared",
        description: "The notification has been moved to archive.",
      });
    },
    onError: (error: SupabaseError) => {
      toast({
        title: "Error clearing notification",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const unarchiveNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      try {
        const { error } = await supabase
          .from("expense_notifications")
          .update({ is_archived: false, is_read: true }) // Mark as read when unarchiving
          .eq("id", notificationId)
          .eq("user_id", currentUserId);
        if (error && !error.message?.includes('404')) throw error;
        return null;
      } catch (error: unknown) {
        const supabaseError = error as SupabaseError;
        if (error.message?.includes('404') || error.message?.includes('relation')) {
          console.warn('Cannot unarchive notification - table not available');
          return null;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", currentUserId] });
      queryClient.invalidateQueries({ queryKey: ["unreadNotifications", currentUserId] });
      toast({
        title: "Notification Unarchived",
        description: "The notification has been moved out of archive.",
      });
    },
    onError: (error: SupabaseError) => {
      toast({
        title: "Error unarchiving notification",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const flagNotificationMutation = useMutation({
    mutationFn: async ({ notificationId, isFlagged }: { notificationId: string; isFlagged: boolean }) => {
      try {
        const { error } = await supabase
          .from("expense_notifications")
          .update({ is_flagged: isFlagged })
          .eq("id", notificationId)
          .eq("user_id", currentUserId);
        if (error && !error.message?.includes('404')) throw error;
        return null;
      } catch (error: unknown) {
        const supabaseError = error as SupabaseError;
        if (error.message?.includes('404') || error.message?.includes('relation')) {
          console.warn('Cannot flag notification - table not available');
          return null;
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", currentUserId] });
      toast({
        title: "Notification Flagged",
        description: "The notification flag status has been updated.",
      });
    },
    onError: (error: SupabaseError) => {
      toast({
        title: "Error flagging notification",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const handleToggleExpand = useCallback((notificationId: string) => {
    setExpandedNotificationId(prevId => (prevId === notificationId ? null : notificationId));
  }, []);

  const getFormattedType = (type: string) => {
    return type.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const columns: TableColumn<ExpenseNotification>[] = useMemo(() => [
    {
      key: "expand",
      header: "",
      render: (row) => (
        <Button variant="ghost" size="icon" className="h-6 w-6">
          {expandedNotificationId === row.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      ),
      initialWidth: 40,
      minWidth: 40,
      cellClassName: "text-center",
      headerClassName: "text-center",
    },
    {
      key: "type",
      header: "Type",
      render: (row) => (
        <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-300">
          {getFormattedType(row.type)}
        </Badge>
      ),
      initialWidth: 150,
    },
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.is_flagged && <Flag className="h-4 w-4 text-yellow-500" />}
          {row.title}
        </div>
      ),
      initialWidth: 400, // Increased width for title
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex space-x-2 justify-end">
          {activeTab !== 'archive' && !row.is_read && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); markAsReadMutation.mutate(row.id); }}
              disabled={markAsReadMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); flagNotificationMutation.mutate({ notificationId: row.id, isFlagged: !row.is_flagged }); }}
            disabled={flagNotificationMutation.isPending}
          >
            <Flag className={cn("h-4 w-4", row.is_flagged ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground")} />
          </Button>
          {activeTab !== 'archive' ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => { e.stopPropagation(); archiveNotificationMutation.mutate(row.id); }}
              disabled={archiveNotificationMutation.isPending}
            >
              <Archive className="h-4 w-4" /> {/* Changed to Archive icon */}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); unarchiveNotificationMutation.mutate(row.id); }}
              disabled={unarchiveNotificationMutation.isPending}
            >
              <ArchiveRestore className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
      initialWidth: 200,
      minWidth: 150,
      cellClassName: "text-right",
      headerClassName: "text-right",
    },
  ], [expandedNotificationId, markAsReadMutation.isPending, archiveNotificationMutation.isPending, unarchiveNotificationMutation.isPending, flagNotificationMutation.isPending, handleToggleExpand, activeTab]);

  const renderNotificationRow = useCallback((
    notification: ExpenseNotification,
    _rowIndex: number,
    cols: TableColumn<ExpenseNotification>[],
    colWidths: Record<string, number>,
    dynamicProps: NotificationDynamicProps
  ) => {
    const isExpanded = expandedNotificationId === notification.id;
    const totalColumns = cols.length;

    return (
      <React.Fragment key={notification.id}>
        <TableRow
          className={cn(
            "h-8 border-b-0 hover:bg-muted/50 cursor-pointer",
            isExpanded && "bg-muted/50",
            !notification.is_read && "bg-blue-50/50 dark:bg-blue-950/20" // Light blue background for unread
          )}
          onClick={() => handleToggleExpand(notification.id)}
        >
          {!notification.is_read && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-blue-500 ml-1" /> // Blue dot indicator
          )}
          {cols.map((column) => (
            <TableCell
              key={column.key}
              className={cn(
                "h-8 px-2 py-1 align-middle [&:has([role=checkbox])]:pr-0",
                "whitespace-nowrap overflow-hidden text-ellipsis",
                column.cellClassName,
                column.className,
                column.key === 'expand' && !notification.is_read && "pl-4" // Adjust padding for expand button if unread
              )}
              style={{ width: colWidths[column.key], minWidth: column.minWidth || 50 }}
              title={typeof column.render(notification, dynamicProps) === 'string' ? column.render(notification, dynamicProps) as string : undefined}
            >
              {truncateText(column.render(notification, dynamicProps), colWidths[column.key] - (column.key === 'expand' && !notification.is_read ? 20 : 8 + 10))}
            </TableCell>
          ))}
        </TableRow>
        {isExpanded && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={totalColumns} className="p-0">
              <Card className="w-full rounded-none border-0 border-t bg-muted/50 shadow-none">
                <CardContent className="p-4 grid gap-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium text-muted-foreground">Status</p>
                      <Badge variant={notification.is_read ? "outline" : "default"}>
                        {notification.is_read ? "Read" : "Unread"}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground">Received</p>
                      <p>{format(new Date(notification.created_at), "PPP p")}</p>
                      <p className="text-xs text-muted-foreground">({formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })})</p>
                    </div>
                  </div>
                  {notification.is_flagged && (
                    <div>
                      <p className="font-medium text-muted-foreground flex items-center gap-1">
                        <Flag className="h-4 w-4 text-yellow-500" /> Flagged
                      </p>
                      <p className="text-xs text-muted-foreground">This notification has been flagged for follow-up.</p>
                    </div>
                  )}
                  <div className="col-span-full">
                    <p className="font-medium text-muted-foreground">Message</p>
                    <p className="whitespace-pre-wrap">{notification.message}</p>
                  </div>
                  {notification.expenses?.title && (
                    <div className="col-span-full">
                      <p className="font-medium text-muted-foreground">Related Expense</p>
                      <Link to={`/expenses/${notification.expense_id}`} className="text-blue-600 hover:underline">
                        {notification.expenses.title}
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TableCell>
          </TableRow>
        )}
      </React.Fragment>
    );
  }, [expandedNotificationId, handleToggleExpand]);


  if (isLoadingSession || isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading notifications...</p>
      </div>
    );
  }

  // Only show error if it's not a missing table error
  const hasRealError = isError && !(allNotifications === undefined && !isLoading);

  if (hasRealError) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error loading notifications. Please try again.</p>
        <Button onClick={() => refetch()} className="ml-4">Refresh</Button>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" /> My Notifications
            </CardTitle>
            <CardDescription>
              Manage all your system notifications.
            </CardDescription>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isLoading}>
            <Loader2 className={cn("mr-2 h-4 w-4", { "animate-spin": isLoading })} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="read">Read</TabsTrigger>
              <TabsTrigger value="archive">Archive</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <ResizableTable
                tableId="notifications-table"
                columns={columns}
                data={filteredNotifications || []}
                isLoading={isLoading}
                emptyMessage={allNotifications?.length === 0 && !isError ? "No notifications found." : "Notifications feature not yet configured."}
                renderRow={renderNotificationRow}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
};

export default NotificationsPage;