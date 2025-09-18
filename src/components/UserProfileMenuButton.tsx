"use client";

import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/SessionContextProvider";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface UserProfileMenuButtonProps {
  isSidebarCollapsed: boolean;
}

const UserProfileMenuButton = ({ isSidebarCollapsed }: UserProfileMenuButtonProps) => {
  const { profile, isLoading: isLoadingSession } = useSession();
  const navigate = useNavigate();

  const handleProfileClick = () => {
    navigate("/settings");
  };

  if (isLoadingSession) {
    return (
      <Button variant="ghost" size="icon" className={cn("relative h-9 w-9 rounded-full", isSidebarCollapsed ? "mx-auto" : "")} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="sr-only">Loading profile</span>
      </Button>
    );
  }

  const avatarUrl = profile?.avatar_url;
  const firstNameInitial = profile?.first_name ? profile.first_name.charAt(0).toUpperCase() : "";
  const fallbackText = firstNameInitial || (profile?.email ? profile.email.charAt(0).toUpperCase() : "?");

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "relative h-9 w-9 rounded-full",
        isSidebarCollapsed ? "mx-auto" : "",
        "hover:bg-muted-foreground/10"
      )}
      onClick={handleProfileClick}
      aria-label="View Profile Settings"
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatarUrl || undefined} alt="User Avatar" />
        <AvatarFallback className="bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium">
          {fallbackText}
        </AvatarFallback>
      </Avatar>
      <span className="sr-only">Profile Settings</span>
    </Button>
  );
};

export default UserProfileMenuButton;