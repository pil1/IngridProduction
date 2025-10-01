import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutIcon,
  FileTextIcon,
  AIIcon,
  BellIcon,
  UserIcon,
  HomeIcon,
  SettingsIcon,
  ReceiptIcon
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/components/SessionContextProvider";

interface ToolbarButtonProps {
  icon: React.ElementType;
  label: string;
  path: string;
  isActive: boolean;
  badge?: number;
  variant?: "default" | "primary";
  onClick?: () => void;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon: Icon,
  label,
  path,
  isActive,
  badge,
  variant = "default",
  onClick,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(path);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        // Base styles
        "flex flex-col items-center justify-center",
        "relative w-full h-full",
        "transition-all duration-200",
        // Text styles
        "text-xs font-medium",
        // Active state
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground",
        // Primary variant (Ingrid)
        variant === "primary" && [
          "text-accent-foreground",
          isActive && "text-primary"
        ]
      )}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
    >
      {/* Icon container with background effect */}
      <div className={cn(
        "relative mb-1 p-2 rounded-xl transition-all duration-200",
        isActive && "bg-accent",
        variant === "primary" && !isActive && "bg-accent/20"
      )}>
        <Icon className={cn(
          "w-5 h-5",
          variant === "primary" && !isActive && "text-accent-foreground"
        )} />

        {/* Badge for notifications */}
        {badge !== undefined && badge > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] font-bold flex items-center justify-center"
          >
            {badge > 99 ? "99+" : badge}
          </Badge>
        )}

        {/* Active indicator */}
        {isActive && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
        )}
      </div>

      {/* Label */}
      <span className={cn(
        "text-[10px] leading-none",
        variant === "primary" && !isActive && "font-semibold text-accent-foreground"
      )}>
        {label}
      </span>
    </button>
  );
};

export const MobileBottomToolbar: React.FC = () => {
  const location = useLocation();
  const { profile } = useSession();
  const navigate = useNavigate();

  // Check for unread notifications (placeholder - replace with actual logic)
  const unreadNotifications = 0; // TODO: Integrate with notification system

  // Determine if user is admin/super-admin for dashboard routing
  const dashboardPath = profile?.role === "admin" || profile?.role === "super-admin"
    ? "/super-admin-dashboard"
    : "/";

  const isActive = (path: string) => {
    if (path === dashboardPath) {
      return location.pathname === "/" || location.pathname === "/super-admin-dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className={cn(
        // Only show on mobile/tablet
        "md:hidden",
        // Fixed positioning
        "fixed bottom-0 left-0 right-0 z-40",
        // Height and layout
        "h-16",
        // Background with blur
        "border-t border-border",
        "bg-card",
        "backdrop-blur-lg",
        // Shadow
        "shadow-lg"
      )}
      role="navigation"
      aria-label="Mobile bottom navigation"
    >
      <div className="flex items-center justify-around h-full px-2">
        {/* Dashboard */}
        <ToolbarButton
          icon={LayoutIcon}
          label="Dashboard"
          path={dashboardPath}
          isActive={isActive(dashboardPath)}
        />

        {/* Expenses */}
        <ToolbarButton
          icon={ReceiptIcon}
          label="Expenses"
          path="/expenses"
          isActive={isActive("/expenses")}
        />

        {/* Ingrid AI - Center, prominent */}
        <ToolbarButton
          icon={AIIcon}
          label="Ingrid"
          path="/ingrid-ai"
          isActive={isActive("/ingrid-ai")}
          variant="primary"
        />

        {/* Notifications */}
        <ToolbarButton
          icon={BellIcon}
          label="Alerts"
          path="/notifications"
          isActive={isActive("/notifications")}
          badge={unreadNotifications}
        />

        {/* Profile */}
        <ToolbarButton
          icon={UserIcon}
          label="Profile"
          path="/settings"
          isActive={isActive("/settings")}
        />
      </div>
    </nav>
  );
};
