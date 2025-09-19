import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle,
  XCircle,
  Trash2,
  Download,
  Archive,
  MessageSquare,
  Users,
  X,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export interface BulkAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "destructive" | "outline";
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationDescription?: string;
  roles?: string[];
}

interface BulkActionsToolbarProps {
  selectedItems: string[];
  onClearSelection: () => void;
  onBulkAction: (actionId: string, selectedItems: string[]) => Promise<void>;
  totalItems: number;
  itemType: string; // e.g., "expenses", "users", "vendors"
  actions: BulkAction[];
  isLoading?: boolean;
  userRole?: string;
}

const DEFAULT_EXPENSE_ACTIONS: BulkAction[] = [
  {
    id: "approve",
    label: "Approve",
    icon: CheckCircle,
    variant: "default",
    requiresConfirmation: true,
    confirmationTitle: "Approve selected expenses?",
    confirmationDescription: "This action will approve all selected expenses that are currently submitted.",
    roles: ["admin", "controller", "super-admin"],
  },
  {
    id: "reject",
    label: "Reject",
    icon: XCircle,
    variant: "destructive",
    requiresConfirmation: true,
    confirmationTitle: "Reject selected expenses?",
    confirmationDescription: "This action will reject all selected expenses. This cannot be undone.",
    roles: ["admin", "controller", "super-admin"],
  },
  {
    id: "request_info",
    label: "Request Info",
    icon: MessageSquare,
    variant: "outline",
    requiresConfirmation: true,
    confirmationTitle: "Request information for selected expenses?",
    confirmationDescription: "This will request additional information from the submitters.",
    roles: ["admin", "controller", "super-admin"],
  },
  {
    id: "assign_reviewer",
    label: "Assign Reviewer",
    icon: Users,
    variant: "outline",
    roles: ["admin", "super-admin"],
  },
  {
    id: "export",
    label: "Export",
    icon: Download,
    variant: "outline",
  },
  {
    id: "archive",
    label: "Archive",
    icon: Archive,
    variant: "outline",
    requiresConfirmation: true,
    confirmationTitle: "Archive selected expenses?",
    confirmationDescription: "Archived expenses will be hidden from the main view but can be restored later.",
    roles: ["admin", "controller", "super-admin"],
  },
  {
    id: "delete",
    label: "Delete",
    icon: Trash2,
    variant: "destructive",
    requiresConfirmation: true,
    confirmationTitle: "Delete selected expenses?",
    confirmationDescription: "This action cannot be undone. Only draft expenses can be deleted.",
    roles: ["admin", "super-admin"],
  },
];

export const BulkActionsToolbar = ({
  selectedItems,
  onClearSelection,
  onBulkAction,
  totalItems,
  itemType,
  actions = DEFAULT_EXPENSE_ACTIONS,
  isLoading = false,
  userRole = "user",
}: BulkActionsToolbarProps) => {
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    action?: BulkAction;
  }>({ isOpen: false });

  const filteredActions = actions.filter(action =>
    !action.roles || action.roles.includes(userRole)
  );

  const handleActionClick = (action: BulkAction) => {
    if (action.requiresConfirmation) {
      setConfirmationDialog({ isOpen: true, action });
    } else {
      executeAction(action);
    }
  };

  const executeAction = async (action: BulkAction) => {
    try {
      await onBulkAction(action.id, selectedItems);

      // Show success toast
      toast.success(`${action.label} completed`, {
        description: `Successfully applied "${action.label}" to ${selectedItems.length} ${itemType}.`,
      });

      // Clear selection after successful action
      onClearSelection();
    } catch (error) {
      toast.error(`Failed to ${action.label.toLowerCase()}`, {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const handleConfirmAction = () => {
    if (confirmationDialog.action) {
      executeAction(confirmationDialog.action);
      setConfirmationDialog({ isOpen: false });
    }
  };

  if (selectedItems.length === 0) {
    return null;
  }

  const selectedCount = selectedItems.length;
  const isAllSelected = selectedCount === totalItems;

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="font-medium">
                {selectedCount} selected
              </Badge>
              {isAllSelected && (
                <Badge variant="outline" className="text-xs">
                  All {totalItems} {itemType}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="h-8 px-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {filteredActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <div key={action.id} className="flex items-center">
                    {index > 0 && <Separator orientation="vertical" className="h-6 mx-1" />}
                    <Button
                      variant={action.variant ?? "outline"}
                      size="sm"
                      onClick={() => handleActionClick(action)}
                      disabled={isLoading}
                      className="h-8"
                    >
                      <Icon className="h-4 w-4 mr-1" />
                      {action.label}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmationDialog.isOpen}
        onOpenChange={(open) => setConfirmationDialog({ isOpen: open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {confirmationDialog.action?.confirmationTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationDialog.action?.confirmationDescription}
              <div className="mt-3 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">
                  Selected items: {selectedCount} {itemType}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={
                confirmationDialog.action?.variant === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              Confirm {confirmationDialog.action?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BulkActionsToolbar;