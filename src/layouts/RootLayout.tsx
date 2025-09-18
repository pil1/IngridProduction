"use client";

import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, Outlet, useMatches } from "react-router-dom"; // Import useMatches
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelGroupHandle } from "react-resizable-panels";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, List, Loader2, GripVertical, Save, XCircle, Eye, EyeOff, ChevronDown, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSession } from "@/components/SessionContextProvider";
import { cn } from "@/lib/utils";
import ImpersonationDropdown from "@/components/ImpersonationDropdown";
import { useUserMenuPreferences, MenuItem } from "@/hooks/use-user-menu-preferences";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import UserProfileMenuButton from "@/components/UserProfileMenuButton";

import { supabase } from "@/integrations/supabase/client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from '@dnd-kit/sortable';

const SIDEBAR_WIDTH_STORAGE_KEY = "sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 22;
const COLLAPSED_SIDEBAR_WIDTH = 5; // Made more narrow
const COLLAPSED_SIDEBAR_THRESHOLD = 8; // Adjusted threshold

interface SortableItemProps {
  item: MenuItem;
  isActive: (path: string) => boolean;
  isSidebarCollapsed: boolean;
  isEditingMenu: boolean;
  userRole: string | undefined;
  onToggleVisibility: (itemId: string) => void;
  isLocked?: boolean; // New prop
}

const SortableItem = ({ item, isActive, isSidebarCollapsed, isEditingMenu, userRole, onToggleVisibility, isLocked }: SortableItemProps) => {
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
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.7 : 1,
  };

  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (item.children?.some(child => child.path && isActive(child.path))) {
      setIsOpen(true);
    }
  }, [location.pathname, item.children, isActive]);

  if (item.children && item.children.length > 0) {
    return (
      <div ref={setNodeRef} style={style}>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className={cn("flex items-center rounded-lg transition-all", isEditingMenu && "border border-dashed border-muted-foreground/50")}>
            {isEditingMenu && (
              <div {...listeners} {...attributes} className="cursor-grab p-3 -ml-1 -my-1 rounded-sm hover:bg-muted-foreground/10">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <CollapsibleTrigger asChild>
              <div className={cn(
                "flex flex-1 items-center rounded-lg h-10 cursor-pointer transition-all",
                isActive(item.path || "")
                  ? "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent"
                  : "text-sidebar-foreground hover:bg-muted",
                isSidebarCollapsed ? "justify-center" : "justify-start px-3" // Centered when collapsed, px-3 when expanded
              )}>
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!isSidebarCollapsed && <span className="ml-3 flex-1 min-w-0 overflow-hidden whitespace-nowrap text-ellipsis">{item.label}</span>}
                {!isSidebarCollapsed && <ChevronDown className={cn("h-4 w-4 flex-shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />}
              </div>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className={cn("pl-7 mt-1 space-y-1", isSidebarCollapsed && "hidden")}>
            {item.children.map(child => (
              <Link
                key={child.id}
                to={child.path!}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 h-10 transition-all",
                  isActive(child.path!)
                    ? "bg-brand-accent text-brand-accent-foreground"
                    : "text-sidebar-foreground hover:bg-muted"
                )}
              >
                <child.icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 min-w-0 overflow-hidden whitespace-nowrap text-ellipsis">{child.label}</span>
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  const itemPath = item.id === 'dashboard' && userRole === 'super-admin' ? "/super-admin-dashboard" : item.path!;
  return (
    <div ref={setNodeRef} style={style} className={cn(isEditingMenu && "border border-dashed border-muted-foreground/50")}>
      <div className="flex items-center">
        {isEditingMenu && (
          <div {...listeners} {...attributes} className="cursor-grab p-3 -ml-1 -my-1 rounded-sm hover:bg-muted-foreground/10">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <Link
          to={itemPath}
          className={cn(
            "flex flex-1 items-center gap-3 rounded-lg h-10 transition-all",
            isActive(itemPath)
              ? "bg-brand-accent text-brand-accent-foreground"
              : "text-sidebar-foreground hover:bg-muted",
            isSidebarCollapsed ? "justify-center" : "justify-start px-3" // Centered when collapsed, px-3 when expanded
          )}
        >
          <item.icon className="h-4 w-4 flex-shrink-0" />
          {!isSidebarCollapsed && <span className="flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>}
        </Link>
        {isEditingMenu && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleVisibility(item.id)}
            className="h-6 w-6 flex-shrink-0"
            disabled={isLocked && userRole !== 'super-admin'} // Disable if locked and not super-admin
          >
            {item.isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            <span className="sr-only">{item.isHidden ? "Show" : "Hide"}</span>
          </Button>
        )}
      </div>
    </div>
  );
};

const RootLayout = () => {
  const isMobile = useIsMobile();
  const { session, profile, impersonatedProfile } = useSession();
  const location = useLocation();
  const userRole = profile?.role;
  const { toast } = useToast();
  const matches = useMatches(); // Hook to access route matches

  const {
    menuItems,
    editableMenuItems,
    saveMenuPreferences,
    isSavingPreferences,
    isLoading: isLoadingMenuPreferences,
  } = useUserMenuPreferences();

  const [isEditingMenu, setIsEditingMenu] = useState(false);
  const [reorderedItems, setReorderedItems] = React.useState<MenuItem[]>([]);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true); // New state for manual expand/collapse
  const [currentPanelSize, setCurrentPanelSize] = useState(DEFAULT_SIDEBAR_WIDTH); // To track actual panel size
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false); // New state for tracking drag

  const panelGroupRef = useRef<ImperativePanelGroupHandle>(null); // Corrected type

  React.useEffect(() => {
    if (isEditingMenu) {
      setReorderedItems(editableMenuItems);
    }
  }, [isEditingMenu, editableMenuItems]);

  // Effect to update document title
  useEffect(() => {
    const currentMatch = matches[matches.length - 1]; // Get the last matched route
    const pageTitle = (currentMatch?.handle as { pageTitle?: string })?.pageTitle;
    if (pageTitle) {
      document.title = pageTitle;
    } else {
      document.title = "INFOtrac"; // Default title if no pageTitle is set
    }
  }, [matches]); // Re-run when route matches change


  // Initialize sidebar expanded state from local storage or default
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedWidth = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
      const initialWidth = storedWidth ? parseFloat(storedWidth) : DEFAULT_SIDEBAR_WIDTH;
      setCurrentPanelSize(initialWidth);
      setIsSidebarExpanded(initialWidth > COLLAPSED_SIDEBAR_THRESHOLD);
    }
  }, []);

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
        // For now, only allow top-level reordering
        if (oldPath.length === 1 && newPath.length === 1) {
          return arrayMove(items, oldPath[0], newPath[0]);
        }
        return items;
      });
    }
  }

  const toggleItemVisibility = (itemId: string) => {
    const toggleVisibilityRecursive = (items: MenuItem[]): MenuItem[] => {
      return items.map(item => {
        if (item.id === itemId) {
          return { ...item, isHidden: !item.isHidden };
        }
        if (item.children) {
          return { ...item, children: toggleVisibilityRecursive(item.children) };
        }
        return item;
      });
    };
    setReorderedItems(currentItems => toggleVisibilityRecursive(currentItems));
  };

  // This function will be called by PanelGroup's onLayout and Panel's onResize
  const handlePanelResize = (size: number) => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, size.toString());
    setCurrentPanelSize(size);
    setIsSidebarExpanded(size > COLLAPSED_SIDEBAR_THRESHOLD);
  };

  const toggleSidebar = () => {
    if (panelGroupRef.current) {
      if (isSidebarExpanded) {
        panelGroupRef.current.setLayout([COLLAPSED_SIDEBAR_WIDTH, 100 - COLLAPSED_SIDEBAR_WIDTH]);
        setIsSidebarExpanded(false);
        localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, COLLAPSED_SIDEBAR_WIDTH.toString());
      } else {
        panelGroupRef.current.setLayout([DEFAULT_SIDEBAR_WIDTH, 100 - DEFAULT_SIDEBAR_WIDTH]);
        setIsSidebarExpanded(true);
        localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, DEFAULT_SIDEBAR_WIDTH.toString());
      }
    }
  };

  const isSidebarCollapsed = !isSidebarExpanded; // Derived from the new state

  const handleSaveMenuOrder = () => {
    const flattenForSave = (items: MenuItem[]): { id: string, isHidden: boolean }[] => {
      let result: { id: string, isHidden: boolean }[] = [];
      for (const item of items) {
        result.push({ id: item.id, isHidden: item.isHidden || false });
        if (item.children) {
          result = result.concat(flattenForSave(item.children));
        }
      }
      return result;
    };
    const newOrderForDb = flattenForSave(reorderedItems);
    saveMenuPreferences(newOrderForDb, {
      onSuccess: () => {
        toast({ title: "Menu Preferences Saved", description: "Your sidebar menu order and visibility have been updated." });
        setIsEditingMenu(false);
      },
      onError: (error: any) => {
        toast({ title: "Error Saving Preferences", description: error.message || "Failed to save menu preferences.", variant: "destructive" });
      },
    });
  };

  const handleCancelEdit = () => {
    setReorderedItems(editableMenuItems);
    setIsEditingMenu(false);
    toast({ title: "Edit Canceled", description: "Your menu changes have been discarded." });
  };

  const handleLogout = async () => {
    console.log("Attempting logout. Current session:", session);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Check for specific "auth session missing" error
        if (error.message.includes("Auth session missing!") || error.message.includes("No current session")) {
          console.warn("Logout: Supabase reported no active session. Treating as successful logout.");
          toast({
            title: "Logged out",
            description: "You have been successfully logged out.",
          });
        } else {
          console.error("Logout error from Supabase:", error);
          toast({
            title: "Logout Error",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        console.log("Successfully signed out from Supabase.");
        toast({
          title: "Logged out",
          description: "You have been successfully logged out.",
        });
      }
    } catch (e: any) {
      console.error("Unexpected error during logout:", e);
      toast({
        title: "Unexpected Logout Error",
        description: e.message || "An unexpected error occurred during logout.",
        variant: "destructive",
      });
    } finally {
      // Always perform a full page reload to ensure all client-side state is reset
      // This is the most reliable way to clear everything after logout.
      window.location.reload();
    }
  };

  const SidebarContent = () => {
    const isActive = (path: string) => location.pathname === path;
    const itemsToRender = isEditingMenu ? reorderedItems : menuItems;

    if (isLoadingMenuPreferences) {
      return <div className="flex items-center justify-center p-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading menu...</div>;
    }

    return (
      <nav className="flex flex-col gap-1 p-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={itemsToRender.map(item => item.id)} strategy={verticalListSortingStrategy}>
            {itemsToRender.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                isActive={isActive}
                isSidebarCollapsed={isSidebarCollapsed}
                isEditingMenu={isEditingMenu}
                userRole={userRole}
                onToggleVisibility={toggleItemVisibility}
                isLocked={item.isLocked} // Pass isLocked prop
              />
            ))}
          </SortableContext>
        </DndContext>
      </nav>
    );
  };

  const LogoBox = () => (
    <div
      className="relative flex items-center h-16 border-b bg-sidebar-background flex-shrink-0 group"
    >
      <Link
        to="/"
        className={cn("flex items-center gap-2 font-semibold", isSidebarCollapsed ? "justify-center w-full" : "justify-start flex-1 px-4")}
        onClick={isSidebarCollapsed ? toggleSidebar : undefined}
      >
        <img
          src="/infotrac-logo.png"
          alt="INFOtrac Logo"
          className={cn("w-auto flex-shrink-0 object-contain", isSidebarCollapsed ? "h-10 w-10" : "h-8")}
        />
        {!isSidebarCollapsed && <span className="text-lg text-brand-accent">INFOtrac</span>}
      </Link>
      {!isMobile && (
        (isSidebarExpanded && (
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Collapse sidebar</span>
          </Button>
        )) ||
        (isSidebarCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Expand sidebar</span>
          </Button>
        ))
      )}
    </div>
  );

  const SidebarFooter = () => (
    <div className="mt-auto p-2 border-t bg-sidebar-background flex-shrink-0">
      {isEditingMenu ? (
        <div className="flex gap-2 mb-2">
          <Button size="sm" className="w-full" onClick={handleSaveMenuOrder} disabled={isSavingPreferences}>
            {isSavingPreferences && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" /> {!isSidebarCollapsed && "Save"}
          </Button>
          <Button size="sm" variant="outline" className="w-full" onClick={handleCancelEdit} disabled={isSavingPreferences}>
            <XCircle className="mr-2 h-4 w-4" /> {!isSidebarCollapsed && "Cancel"}
          </Button>
        </div>
      ) : (
        !isSidebarCollapsed && (
          <Button variant="outline" className="w-full justify-start mb-2" onClick={() => setIsEditingMenu(true)} size={isSidebarCollapsed ? "icon" : "default"}>
            <List className={cn("h-4 w-4", !isSidebarCollapsed && "mr-2")} /> {!isSidebarCollapsed && "Edit Menu"}
          </Button>
        )
      )}
      <ImpersonationDropdown isSidebarCollapsed={isSidebarCollapsed} />
      <div className={cn(
        "flex items-center mt-2",
        isSidebarCollapsed ? "flex-col gap-2" : "justify-between"
      )}>
        <NotificationsDropdown />
        <UserProfileMenuButton isSidebarCollapsed={isSidebarCollapsed} />
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="h-5 w-5" />
          <span className="sr-only">Logout</span>
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <div className="flex items-center justify-between h-16 px-4 border-b bg-background">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col bg-sidebar-background p-0">
              <LogoBox />
              <div className="flex-1 overflow-auto"><SidebarContent /></div>
              {impersonatedProfile && <div className="p-4 text-sm text-red-500 bg-red-100 dark:bg-red-900 dark:text-red-200 rounded-md mx-4">Impersonating: {impersonatedProfile.full_name || impersonatedProfile.email} ({impersonatedProfile.role})</div>}
              <SidebarFooter />
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <img src="/infotrac-logo.png" alt="INFOtrac Logo" className="h-6 w-auto flex-shrink-0 object-contain" />
            <span className="text-lg text-brand-accent">INFOtrac</span>
          </Link>
          {/* NotificationsDropdown is now in SidebarFooter for mobile as well */}
        </div>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-muted/40 overflow-hidden">
      <PanelGroup
        ref={panelGroupRef}
        direction="horizontal"
        className="flex-1"
        onLayout={(sizes: number[]) => handlePanelResize(sizes[0])}
        onDragStart={() => setIsDraggingSidebar(true)}
        onDragEnd={() => setIsDraggingSidebar(false)}
      >
        <Panel
          defaultSize={currentPanelSize}
          onResize={handlePanelResize}
          minSize={COLLAPSED_SIDEBAR_WIDTH}
          maxSize={DEFAULT_SIDEBAR_WIDTH}
          className={cn(
            "flex flex-col border-r bg-sidebar-background",
            isDraggingSidebar ? "no-transition" : "transition-all duration-300 ease-in-out"
          )}
        >
          <LogoBox />
          <div className="flex-1 overflow-auto"><SidebarContent /></div>
          {impersonatedProfile && <div className="p-2 text-xs text-center text-red-500 bg-red-100 dark:bg-red-900 dark:text-red-200 rounded-md mx-2">Impersonating: {impersonatedProfile.full_name || impersonatedProfile.email} ({impersonatedProfile.role})</div>}
          <SidebarFooter />
        </Panel>
        <PanelResizeHandle className="w-2 bg-border hover:bg-primary transition-colors" />
        <Panel className="flex flex-col">
          <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6 overflow-auto"><Outlet /></main>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default RootLayout;