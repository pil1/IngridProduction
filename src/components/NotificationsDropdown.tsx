"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Import useMutation, useQueryClient
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast"; // Import useToast

interface ExpenseNotification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  expense_id: string;
}

const NotificationsDropdown = () => {
  const { profile, isLoading: isLoadingSession } = useSession();
  const currentUserId = profile?.user_id;
  const queryClient = useQueryClient(); // Initialize queryClient
  const { toast } = useToast(); // Initialize toast

  const { data: notifications, isLoading: isLoadingNotifications } = useQuery<ExpenseNotification[]>({
    queryKey: ["unreadNotifications", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];
      const { data, error } = await supabase
        .from("expense_notifications")
        .select("id, title, message, created_at, is_read, expense_id")
        .eq("user_id", currentUserId)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(5); // Limit to 5 most recent unread notifications
      if (error) throw error;
      return data;
    },
    enabled: !!currentUserId,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("expense_notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", currentUserId); // Ensure only current user can mark their own notification as read
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unreadNotifications", currentUserId] }); // Invalidate to update count and remove from dropdown
      queryClient.invalidateQueries({ queryKey: ["notifications", currentUserId] }); // Invalidate full notifications page
      // No toast here, as it would be too many popups for each click
    },
    onError: (error: Error) => {
      toast({
        title: "Error marking notification as read",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const handleNotificationClick = (notification: ExpenseNotification) => {
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }
    // Navigate to the expense detail page regardless of read status
    // The Link component handles navigation, so no explicit navigate() call needed here.
  };

  const unreadCount = notifications?.length ?? 0;

  const isLoading = isLoadingSession || isLoadingNotifications;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 w-4 justify-center rounded-full p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : notifications && notifications.length > 0 ? (
          notifications.map((notification) => (
            <DropdownMenuItem key={notification.id} asChild>
              <Link
                to={`/expenses/${notification.expense_id}`}
                className="flex flex-col items-start gap-1 p-2"
                onClick={() => handleNotificationClick(notification)} // Mark as read on click
              >
                <p className="font-semibold">{notification.title}</p>
                <p className="text-sm text-muted-foreground whitespace-normal">{notification.message}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                </p>
              </Link>
            </DropdownMenuItem>
          ))
        ) : (
          <p className="p-4 text-sm text-center text-muted-foreground">No new notifications</p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/notifications" className="w-full justify-center">
            View All Notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationsDropdown;