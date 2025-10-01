/**
 * UnifiedUserPermissionDialog Component
 * Complete user permission management interface with two-tier system
 *
 * Features:
 * - Two-tab interface (Data Permissions / Module Permissions)
 * - Real-time permission preview
 * - Template selector for quick setup
 * - Role-based access control
 * - Beautiful MynaUI design
 * - Save/cancel with pending changes tracking
 */

import * as React from 'react';
import { EnhancedDialog, EnhancedDialogSection } from '@/components/myna';
import { Shield, PackageIcon, UserIcon, Building2Icon, SparklesIcon } from '@/lib/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataPermissionsManager } from './DataPermissionsManager';
import { ModulePermissionsManager } from './ModulePermissionsManager';
import { usePermissionTemplates } from '@/hooks/usePermissionTemplates';
import { useDataPermissions } from '@/hooks/useDataPermissions';
import type { UserRole } from '@/types/permissions-v2';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UnifiedUserPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  companyId: string | null;
  userName?: string;
  userRole?: UserRole;
  userAvatar?: string;
  companyName?: string;
}

export const UnifiedUserPermissionDialog: React.FC<UnifiedUserPermissionDialogProps> = ({
  open,
  onOpenChange,
  userId,
  companyId,
  userName = 'User',
  userRole = 'user',
  userAvatar,
  companyName = 'Company',
}) => {
  const [activeTab, setActiveTab] = React.useState<'data' | 'modules'>('data');
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('');

  const { allTemplates, loadingTemplates, applyTemplate } = usePermissionTemplates();
  const { getCompletePermissions } = useDataPermissions();

  // Always call the hook, use enabled flag to control execution
  const completePermissionsQuery = getCompletePermissions(userId || '', {
    enabled: !!userId && !!open,
  });

  const completePermissions = completePermissionsQuery.data;
  const loadingComplete = completePermissionsQuery.isLoading;

  // Handle template application
  const handleApplyTemplate = async () => {
    if (!selectedTemplateId || !userId || !companyId) return;

    await applyTemplate.mutateAsync({
      template_id: selectedTemplateId,
      user_id: userId,
      company_id: companyId,
    });

    setSelectedTemplateId('');
  };

  // Handle close
  const handleClose = () => {
    setSelectedTemplateId('');
    setActiveTab('data');
    onOpenChange(false);
  };

  // Filter templates by user role
  const availableTemplates = React.useMemo(() => {
    if (!allTemplates?.templates) return [];
    return allTemplates.templates.filter(
      (template) => template.target_role === userRole
    );
  }, [allTemplates, userRole]);

  return (
    <EnhancedDialog
      open={open}
      onOpenChange={handleClose}
      title="Manage User Permissions"
      subtitle={`Configure permissions and modules for ${userName}`}
      icon={Shield}
      size="lg"
      variant="elevated"
      secondaryAction={{
        label: 'Close',
        onClick: handleClose,
      }}
    >
      {/* User Info Section */}
      <EnhancedDialogSection title="User Information">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white">
                <UserIcon className="h-6 w-6" />
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{userName}</p>
              <p className="text-sm text-muted-foreground capitalize">{userRole}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2Icon className="h-4 w-4" />
            <span>{companyName}</span>
          </div>
        </div>

        {/* Permission Summary */}
        {completePermissions && !loadingComplete && (
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                Total Permissions
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {completePermissions.summary.total_permissions}
              </p>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3">
              <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                From Data
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {completePermissions.summary.from_data}
              </p>
            </div>
            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-3">
              <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">
                From Modules
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {completePermissions.summary.from_modules}
              </p>
            </div>
          </div>
        )}
      </EnhancedDialogSection>

      {/* Quick Setup with Templates */}
      {availableTemplates.length > 0 && (
        <EnhancedDialogSection
          title="Quick Setup"
          description="Apply a pre-configured permission template"
        >
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <SparklesIcon className="h-4 w-4" />
                        <div>
                          <p className="font-medium">{template.display_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {template.description}
                          </p>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              onClick={handleApplyTemplate}
              disabled={!selectedTemplateId || applyTemplate.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 rounded-lg hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applyTemplate.isPending ? 'Applying...' : 'Apply Template'}
            </button>
          </div>
        </EnhancedDialogSection>
      )}

      {/* Two-Tab Interface - MynaUI Style */}
      <EnhancedDialogSection>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'data' | 'modules')}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="data">
              <Shield className="h-4 w-4 mr-2" />
              Data Permissions
            </TabsTrigger>
            <TabsTrigger value="modules">
              <PackageIcon className="h-4 w-4 mr-2" />
              Module Permissions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="data" className="space-y-4">
            {userId && companyId ? (
              <DataPermissionsManager
                userId={userId}
                companyId={companyId}
                userName={userName}
                userRole={userRole}
              />
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">No User Selected</p>
                <p className="text-sm mt-1">Select a user to manage their permissions</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="modules" className="space-y-4">
            {userId && companyId ? (
              <ModulePermissionsManager
                userId={userId}
                companyId={companyId}
                userName={userName}
                userRole={userRole}
              />
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <PackageIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">No User Selected</p>
                <p className="text-sm mt-1">Select a user to manage their module access</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </EnhancedDialogSection>
    </EnhancedDialog>
  );
};

export default UnifiedUserPermissionDialog;
