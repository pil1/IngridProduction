import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ListIcon,
  LoaderIcon,
  SaveIcon,
  XCircleIcon,
  EyeIcon,
  EyeOffIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LogOutIcon,
} from "@/lib/icons";
import { useSession } from "@/components/SessionContextProvider";
import { useUserMenuPreferences, MenuItem } from "@/hooks/use-user-menu-preferences";
import { IngridAnimatedAvatar } from "@/components/ingrid/IngridAnimatedAvatar";
import { useToast } from "@/hooks/use-toast";
import NotificationBell from "@/components/NotificationBell";
import UserProfileMenuButton from "@/components/UserProfileMenuButton";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface MynaEnhancedSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
}

interface SortableItemProps {
  item: MenuItem;
  isActive: (path: string) => boolean;
  isEditingMenu: boolean;
  userRole: string | undefined;
  onToggleVisibility: (itemId: string) => void;
  isLocked?: boolean;
  isCollapsed: boolean;
}

const SortableItem = ({
  item,
  isActive,
  isEditingMenu,
  userRole,
  onToggleVisibility,
  isLocked,
  isCollapsed,
}: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !isEditingMenu });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : "auto",
    opacity: isDragging ? 0.7 : 1,
  };

  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (item.children?.some((child) => child.path && isActive(child.path))) {
      setIsOpen(true);
    }
  }, [location.pathname, item.children, isActive]);

  // Handle items with children (collapsible menu items)
  if (item.children && item.children.length > 0) {
    return (
      <div ref={setNodeRef} style={style} className="relative">
        <button
          onClick={() => !isCollapsed && setIsOpen(!isOpen)}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200",
            "hover:bg-accent",
            isActive(item.path ?? "") && "bg-accent font-medium",
            isCollapsed && "justify-center"
          )}
          {...attributes}
          {...listeners}
        >
          <item.icon className={cn("h-5 w-5 flex-shrink-0", isCollapsed && "h-6 w-6")} />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
              <ChevronDownIcon
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
              />
            </>
          )}
        </button>

        {/* Submenu */}
        {!isCollapsed && isOpen && (
          <div className="mt-1 ml-4 space-y-1 border-l-2 border-border pl-2">
            {item.children.map((child) => (
              <Link
                key={child.id}
                to={child.path!}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                  "hover:bg-accent",
                  isActive(child.path!) && "bg-accent font-medium"
                )}
              >
                <child.icon className="h-4 w-4 flex-shrink-0" />
                <span>{child.label}</span>
              </Link>
            ))}
          </div>
        )}

        {/* EditIcon visibility button */}
        {isEditingMenu && !isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleVisibility(item.id)}
            className="h-6 w-6 absolute right-2 top-2"
            disabled={isLocked && userRole !== "super-admin"}
          >
            {item.isHidden ? <EyeOffIcon className="h-3 w-3" /> : <EyeIcon className="h-3 w-3" />}
          </Button>
        )}
      </div>
    );
  }

  // Handle single menu items
  const itemPath =
    item.id === "dashboard" && userRole === "super-admin"
      ? "/super-admin-dashboard"
      : item.path!;

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <Link
        to={itemPath}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200",
          "hover:bg-accent",
          isActive(itemPath) && "bg-accent font-medium",
          isCollapsed && "justify-center"
        )}
        {...attributes}
        {...listeners}
      >
        <item.icon className={cn("h-5 w-5 flex-shrink-0", isCollapsed && "h-6 w-6")} />
        {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
      </Link>

      {isEditingMenu && !isCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleVisibility(item.id)}
          className="h-6 w-6 absolute right-2 top-2"
          disabled={isLocked && userRole !== "super-admin"}
        >
          {item.isHidden ? <EyeOffIcon className="h-3 w-3" /> : <EyeIcon className="h-3 w-3" />}
        </Button>
      )}
    </div>
  );
};

export const MynaEnhancedSidebar: React.FC<MynaEnhancedSidebarProps> = ({
  isCollapsed,
  onToggle,
  className,
}) => {
  const { session, profile } = useSession();
  const location = useLocation();
  const userRole = profile?.role;
  const { toast } = useToast();

  const {
    menuItems,
    editableMenuItems,
    saveMenuPreferences,
    isSavingPreferences,
    isLoading: isLoadingMenuPreferences,
  } = useUserMenuPreferences();

  const [isEditingMenu, setIsEditingMenu] = useState(false);
  const [reorderedItems, setReorderedItems] = React.useState<MenuItem[]>([]);

  React.useEffect(() => {
    if (isEditingMenu) {
      setReorderedItems(editableMenuItems);
    }
  }, [isEditingMenu, editableMenuItems]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setReorderedItems((items) => {
        const findItemIndex = (items: MenuItem[], id: string): number[] => {
          for (let i = 0; i < items.length; i++) {
            if (items[i].id === id) return [i];
            if (items[i].children) {
              const childPath = findItemIndex(items[i].children!, id);
              if (childPath.length > 0) return [i, ...childPath];
            }
          }
          return [];
        };
        const oldPath = findItemIndex(items, active.id as string);
        const newPath = findItemIndex(items, over!.id as string);
        if (oldPath.length === 1 && newPath.length === 1) {
          return arrayMove(items, oldPath[0], newPath[0]);
        }
        return items;
      });
    }
  }

  const toggleItemVisibility = (itemId: string) => {
    const toggleVisibilityRecursive = (items: MenuItem[]): MenuItem[] => {
      return items.map((item) => {
        if (item.id === itemId) {
          return { ...item, isHidden: !item.isHidden };
        }
        if (item.children) {
          return { ...item, children: toggleVisibilityRecursive(item.children) };
        }
        return item;
      });
    };
    setReorderedItems((currentItems) => toggleVisibilityRecursive(currentItems));
  };

  const handleSaveMenuOrder = () => {
    const flattenForSave = (items: MenuItem[]): { id: string; isHidden: boolean }[] => {
      let result: { id: string; isHidden: boolean }[] = [];
      for (const item of items) {
        result.push({ id: item.id, isHidden: item.isHidden ?? false });
        if (item.children) {
          result = result.concat(flattenForSave(item.children));
        }
      }
      return result;
    };
    const newOrderForDb = flattenForSave(reorderedItems);
    saveMenuPreferences(newOrderForDb, {
      onSuccess: () => {
        toast({
          title: "Menu Preferences Saved",
          description: "Your sidebar menu order and visibility have been updated.",
        });
        setIsEditingMenu(false);
      },
      onError: (error: any) => {
        toast({
          title: "Error Saving Preferences",
          description: error.message ?? "Failed to save menu preferences.",
          variant: "destructive",
        });
      },
    });
  };

  const handleCancelEdit = () => {
    setReorderedItems(editableMenuItems);
    setIsEditingMenu(false);
    toast({ title: "EditIcon Canceled", description: "Your menu changes have been discarded." });
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("infotrac_token");
      localStorage.removeItem("supabase.auth.token");

      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });

      window.location.href = "/login";
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({
        title: "Logged out",
        description: "You have been logged out.",
      });
      window.location.href = "/login";
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const itemsToRender = isEditingMenu ? reorderedItems : menuItems;

  if (isLoadingMenuPreferences) {
    return (
      <div className="flex items-center justify-center p-4 text-muted-foreground">
        <LoaderIcon className="h-4 w-4 animate-spin mr-2" /> Loading menu...
      </div>
    );
  }

  return (
    <aside
      className={cn(
        // Base styling with fixed positioning
        "hidden md:flex flex-col h-screen bg-card",
        "border-r border-border shadow-lg",
        "transition-all duration-300 ease-in-out",
        // Fixed positioning to prevent scrolling
        "fixed top-0 left-0 z-30",
        // Width based on collapsed state
        isCollapsed ? "w-20" : "w-64",
        className
      )}
    >
      {/* Header with Logo */}
      <div className={cn("p-4 border-b border-border", isCollapsed && "p-3")}>
        <Link
          to={
            profile?.role === "admin" || profile?.role === "super-admin"
              ? "/super-admin-dashboard"
              : "/"
          }
          className={cn(
            "flex items-center gap-3 font-semibold",
            isCollapsed && "justify-center"
          )}
        >
          <IngridAnimatedAvatar size="sm" status="online" className="flex-shrink-0" />
          {!isCollapsed && (
            <span className="text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
              Ask Ingrid
            </span>
          )}
        </Link>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={itemsToRender.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            {itemsToRender.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                isActive={isActive}
                isEditingMenu={isEditingMenu}
                userRole={userRole}
                onToggleVisibility={toggleItemVisibility}
                isLocked={item.isLocked}
                isCollapsed={isCollapsed}
              />
            ))}
          </SortableContext>
        </DndContext>
      </nav>

      {/* Footer with Actions */}
      <div className={cn("p-4 border-t border-border space-y-3", isCollapsed && "p-2")}>
        {/* Collapse Toggle Button - Now in footer */}
        <Button
          variant="outline"
          className={cn(
            "w-full transition-all duration-200",
            isCollapsed ? "justify-center" : "justify-start"
          )}
          onClick={onToggle}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeftIcon className="mr-2 h-4 w-4" />
              <span>Collapse Menu</span>
            </>
          )}
        </Button>

        {!isCollapsed &&
          (isEditingMenu ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={handleSaveMenuOrder}
                disabled={isSavingPreferences}
              >
                {isSavingPreferences && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
                <SaveIcon className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={handleCancelEdit}
                disabled={isSavingPreferences}
              >
                <XCircleIcon className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setIsEditingMenu(true)}
            >
              <ListIcon className="mr-2 h-4 w-4" />
              EditIcon Menu
            </Button>
          ))}

        <div
          className={cn(
            "flex items-center gap-2",
            isCollapsed ? "flex-col" : "justify-between"
          )}
        >
          <NotificationBell />
          {!isCollapsed && <UserProfileMenuButton isSidebarCollapsed={false} />}
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOutIcon className="h-5 w-5" />
            <span className="sr-only">Logout</span>
          </Button>
        </div>
      </div>
    </aside>
  );
};
