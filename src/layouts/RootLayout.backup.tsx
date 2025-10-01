import React, { useState, useEffect } from "react";
import { Outlet, useMatches } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDownIcon, Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/NotificationBell";
import UserProfileMenuButton from "@/components/UserProfileMenuButton";
import { PageHeaderProvider, usePageHeader } from "@/contexts/PageHeaderContext";
import { IngridFloatingButton } from "@/components/navigation/IngridFloatingButton";
import { MobileBottomToolbar } from "@/components/navigation/MobileBottomToolbar";
import { MynaEnhancedSidebar } from "@/components/navigation/MynaEnhancedSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

// Enhanced MynaUI-style Header component with full navigation support

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

  // Handle items with children (collapsible menu items)
  if (item.children && item.children.length > 0) {
    return (
      <SidebarMenuItem ref={setNodeRef} style={style}>
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group/collapsible">
          <SidebarMenuButton
            asChild
            tooltip={isCollapsed ? item.label : undefined}
            isActive={isActive(item.path ?? "")}
            className="w-full"
          >
            <CollapsibleTrigger>
              <item.icon />
              <span>{item.label}</span>
              <ChevronDownIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
            </CollapsibleTrigger>
          </SidebarMenuButton>
          {!isCollapsed && (
            <CollapsibleContent>
              <SidebarMenuSub>
                {item.children.map((child) => (
                  <SidebarMenuSubItem key={child.id}>
                    <SidebarMenuSubButton asChild isActive={isActive(child.path!)}>
                      <Link to={child.path!}>
                        <child.icon />
                        <span>{child.label}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          )}
        </Collapsible>
        {isEditingMenu && !isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleVisibility(item.id)}
            className="h-6 w-6 absolute right-2 top-1"
            disabled={isLocked && userRole !== 'super-admin'}
          >
            {item.isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        )}
      </SidebarMenuItem>
    );
  }

  // Handle single menu items
  const itemPath = item.id === 'dashboard' && userRole === 'super-admin' ? "/super-admin-dashboard" : item.path!;

  return (
    <SidebarMenuItem ref={setNodeRef} style={style}>
      <SidebarMenuButton asChild tooltip={isCollapsed ? item.label : undefined} isActive={isActive(itemPath)}>
        <Link to={itemPath}>
          <item.icon />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
      {isEditingMenu && !isCollapsed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleVisibility(item.id)}
          className="h-6 w-6 absolute right-2 top-1"
          disabled={isLocked && userRole !== 'super-admin'}
        >
          {item.isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </Button>
      )}
    </SidebarMenuItem>
  );
};

const AppSidebar = () => {
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

  const handleSaveMenuOrder = () => {
    const flattenForSave = (items: MenuItem[]): { id: string, isHidden: boolean }[] => {
      let result: { id: string, isHidden: boolean }[] = [];
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
        toast({ title: "Menu Preferences Saved", description: "Your sidebar menu order and visibility have been updated." });
        setIsEditingMenu(false);
      },
      onError: (error: any) => {
        toast({ title: "Error Saving Preferences", description: error.message ?? "Failed to save menu preferences.", variant: "destructive" });
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
      localStorage.removeItem('accessToken');
      localStorage.removeItem('infotrac_token');
      localStorage.removeItem('supabase.auth.token');

      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });

      window.location.href = '/login';
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({
        title: "Logged out",
        description: "You have been logged out.",
      });
      window.location.href = '/login';
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const itemsToRender = isEditingMenu ? reorderedItems : menuItems;

  if (isLoadingMenuPreferences) {
    return (
      <div className="flex items-center justify-center p-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading menu...
      </div>
    );
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-4">
          <Link
            to={profile?.role === "admin" || profile?.role === "super-admin" ? "/super-admin-dashboard" : "/"}
            className="flex items-center gap-2 font-semibold"
          >
            <IngridAnimatedAvatar
              size="sm"
              status="online"
              className="flex-shrink-0"
            />
            <span className="text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">Ask Ingrid</span>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={itemsToRender.map(item => item.id)} strategy={verticalListSortingStrategy}>
              {itemsToRender.map((item) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  isActive={isActive}
                  isEditingMenu={isEditingMenu}
                  userRole={userRole}
                  onToggleVisibility={toggleItemVisibility}
                  isLocked={item.isLocked}
                />
              ))}
            </SortableContext>
          </DndContext>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {isEditingMenu ? (
          <div className="flex gap-2 mb-2">
            <Button size="sm" className="w-full" onClick={handleSaveMenuOrder} disabled={isSavingPreferences}>
              {isSavingPreferences && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            <Button size="sm" variant="outline" className="w-full" onClick={handleCancelEdit} disabled={isSavingPreferences}>
              <XCircleIcon className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full justify-start mb-2" onClick={() => setIsEditingMenu(true)}>
            <List className="mr-2 h-4 w-4" />
            Edit Menu
          </Button>
        )}


        <div className="flex items-center justify-between mt-2">
          <NotificationBell />
          <UserProfileMenuButton isSidebarCollapsed={false} />
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
            <span className="sr-only">Logout</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

// Enhanced MynaUI-style Header component with full navigation support
const DynamicHeader = () => {
  const {
    title,
    subtitle,
    icon: Icon,
    breadcrumbs,
    tabs,
    activeTab,
    onTabChange,
    primaryAction,
    secondaryActions,
    actions,
    showFilters,
    filterComponent,
    activeFilterCount,
    badges
  } = usePageHeader();

  const location = useLocation();

  return (
    <div className="shrink-0 mx-3 mt-3 mb-3 space-y-3">
      {/* Main Header Bar */}
      <header className="flex h-14 items-center gap-3 border border-border rounded-xl bg-gradient-to-r from-slate-50/80 via-white/90 to-blue-50/80 dark:from-slate-900/80 dark:via-slate-950/90 dark:to-blue-950/80 backdrop-blur-sm px-6 shadow-md">
        <SidebarTrigger className="h-8 w-8" />

        {/* Breadcrumbs or Page Title */}
        <div className="h-6 w-px bg-border mx-2" />

        {breadcrumbs && breadcrumbs.length > 0 ? (
          <div className="flex items-center gap-2 flex-1">
            {breadcrumbs.map((breadcrumb, index) => (
              <React.Fragment key={index}>
                {breadcrumb.path ? (
                  <Link
                    to={breadcrumb.path}
                    className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {breadcrumb.icon && <breadcrumb.icon className="h-3.5 w-3.5" />}
                    {breadcrumb.label}
                  </Link>
                ) : (
                  <div className="flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-slate-700 to-blue-600 dark:from-slate-200 dark:to-blue-400 bg-clip-text text-transparent">
                    {breadcrumb.icon && <breadcrumb.icon className="h-3.5 w-3.5" />}
                    {breadcrumb.label}
                  </div>
                )}
                {index < breadcrumbs.length - 1 && (
                  <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground rotate-[-90deg]" />
                )}
              </React.Fragment>
            ))}
          </div>
        ) : title ? (
          <div className="flex items-center gap-3 flex-1">
            {Icon && (
              <div className="p-1.5 bg-gradient-to-br from-slate-100 to-blue-100 dark:from-slate-800 dark:to-blue-900 rounded-lg">
                <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
            )}
            <div className="flex flex-col">
              <h1 className="text-sm font-semibold bg-gradient-to-r from-slate-700 to-blue-600 dark:from-slate-200 dark:to-blue-400 bg-clip-text text-transparent leading-none">{title}</h1>
              {subtitle && (
                <p className="text-xs text-muted-foreground leading-none mt-1">{subtitle}</p>
              )}
            </div>
            {badges && <div className="flex items-center gap-2">{badges}</div>}
          </div>
        ) : null}

        {/* Actions Section */}
        <div className="ml-auto flex items-center gap-2">
          {/* Filter indicator */}
          {showFilters && activeFilterCount !== undefined && activeFilterCount > 0 && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {activeFilterCount} filters
            </Badge>
          )}

          {/* Secondary actions */}
          {secondaryActions}

          {/* Primary action */}
          {primaryAction}

          {/* Legacy actions support */}
          {actions}

          <NotificationBell />
          <UserProfileMenuButton />
        </div>
      </header>

      {/* Tab Navigation */}
      {tabs && tabs.length > 0 && (
        <div className="border border-border rounded-xl bg-gradient-to-r from-slate-50/80 via-white/90 to-blue-50/80 dark:from-slate-900/80 dark:via-slate-950/90 dark:to-blue-950/80 backdrop-blur-sm shadow-md">
          <div className="flex items-center gap-1 p-1.5 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && onTabChange?.(tab.id)}
                disabled={tab.disabled}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  "hover:bg-white/50 dark:hover:bg-slate-800/50",
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md hover:from-blue-700 hover:to-blue-800"
                    : "text-muted-foreground hover:text-foreground",
                  tab.disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {tab.icon && <tab.icon className="h-4 w-4" />}
                {tab.label}
                {tab.count !== undefined && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-1 h-5 min-w-[20px] px-1.5 text-xs",
                      activeTab === tab.id
                        ? "bg-white/20 text-white border-white/30"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {tab.count}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      {showFilters && filterComponent && (
        <div className="border border-border rounded-xl bg-gradient-to-r from-slate-50/80 via-white/90 to-blue-50/80 dark:from-slate-900/80 dark:via-slate-950/90 dark:to-blue-950/80 backdrop-blur-sm shadow-md p-4">
          {filterComponent}
        </div>
      )}
    </div>
  );
};

// Inner RootLayout component
const RootLayoutInner = () => {
  const isMobile = useIsMobile();
  const matches = useMatches();

  // Effect to update document title
  useEffect(() => {
    const currentMatch = matches[matches.length - 1];
    const pageTitle = (currentMatch?.handle as { pageTitle?: string })?.pageTitle;
    if (pageTitle) {
      document.title = `${pageTitle} | Ask Ingrid`;
    } else {
      document.title = "Ask Ingrid - Your AI-Powered Business Assistant";
    }
  }, [matches]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full relative overflow-hidden">
        {/* Background Gradient and Orbs */}
        <div className="fixed inset-0 bg-gradient-to-br from-slate-100 via-gray-200 to-blue-100 dark:from-slate-900 dark:via-gray-900 dark:to-blue-950 -z-10">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-400/15 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-slate-400/20 to-blue-400/15 rounded-full blur-3xl" />
            <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-gradient-to-br from-indigo-300/15 to-transparent rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
        </div>

        <AppSidebar />
        <SidebarInset className="flex flex-col min-h-screen transition-[margin] duration-200 ease-linear peer-data-[state=collapsed]:md:ml-12 peer-data-[state=expanded]:md:ml-64">
          <DynamicHeader />
          <main className="flex-1 px-6 pb-6 mb-16 md:mb-0">
            <Outlet />
          </main>
        </SidebarInset>

        {/* Ingrid AI Floating Button - Desktop only */}
        <div className="hidden md:block">
          <IngridFloatingButton />
        </div>

        {/* Mobile Bottom Toolbar - Mobile/Tablet only */}
        <MobileBottomToolbar />
      </div>
    </SidebarProvider>
  );
};

// Main RootLayout component with PageHeaderProvider
const RootLayout = () => {
  return (
    <PageHeaderProvider>
      <RootLayoutInner />
    </PageHeaderProvider>
  );
};

export default RootLayout;