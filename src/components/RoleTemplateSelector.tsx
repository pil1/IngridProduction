"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { FileText, Users, Sparkles, CheckCircle, Loader2 } from "lucide-react";
import CustomRoleService from "@/services/customRoleService";
import { RoleTemplate, PermissionKey } from "@/types/permissions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

interface RoleTemplateSelectorProps {
  companyId: string;
  onRoleCreated?: () => void;
}

interface CreateFromTemplateData {
  templateId: string;
  role_display_name?: string;
  description?: string;
  additional_permissions?: PermissionKey[];
  removed_permissions?: PermissionKey[];
}

const RoleTemplateSelector = ({ companyId, onRoleCreated }: RoleTemplateSelectorProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<RoleTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customizationData, setCustomizationData] = useState<CreateFromTemplateData>({
    templateId: "",
    role_display_name: "",
    description: "",
    additional_permissions: [],
    removed_permissions: [],
  });

  // Fetch role templates
  const { data: roleTemplates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["roleTemplates"],
    queryFn: () => CustomRoleService.getRoleTemplates(),
  });

  // Create role from template mutation
  const createFromTemplateMutation = useMutation({
    mutationFn: async (data: CreateFromTemplateData) => {
      const customizations = {
        role_display_name: data.role_display_name,
        description: data.description,
        additional_permissions: data.additional_permissions,
        removed_permissions: data.removed_permissions,
      };
      return CustomRoleService.createRoleFromTemplate(data.templateId, companyId, customizations);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customRoles", companyId] });
      toast({ title: "Success", description: "Role created from template successfully" });
      setDialogOpen(false);
      setSelectedTemplate(null);
      setCustomizationData({
        templateId: "",
        role_display_name: "",
        description: "",
        additional_permissions: [],
        removed_permissions: [],
      });
      onRoleCreated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create role from template",
        variant: "destructive"
      });
    },
  });

  const handleSelectTemplate = (template: RoleTemplate) => {
    setSelectedTemplate(template);
    setCustomizationData({
      templateId: template.id,
      role_display_name: template.display_name,
      description: template.description || "",
      additional_permissions: [],
      removed_permissions: [],
    });
    setDialogOpen(true);
  };

  const handleCreateFromTemplate = () => {
    if (!selectedTemplate) return;
    createFromTemplateMutation.mutate(customizationData);
  };

  // Get template category badge
  const getTemplateBadge = (templateName: string) => {
    switch (templateName) {
      case 'expense_only':
        return { variant: 'secondary' as const, label: 'Basic' };
      case 'view_only':
        return { variant: 'outline' as const, label: 'Read-Only' };
      case 'controller':
        return { variant: 'default' as const, label: 'Financial' };
      case 'accounting':
        return { variant: 'default' as const, label: 'Accounting' };
      case 'manager':
        return { variant: 'destructive' as const, label: 'Management' };
      default:
        return { variant: 'outline' as const, label: 'Custom' };
    }
  };

  if (isLoadingTemplates) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading role templates...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Role Templates
          </CardTitle>
          <CardDescription>
            Start with pre-configured role templates designed for common use cases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roleTemplates?.map((template) => {
              const badge = getTemplateBadge(template.template_name);
              return (
                <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{template.display_name}</CardTitle>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <CardDescription className="text-sm">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">USE CASES</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {template.target_use_cases.slice(0, 2).map((useCase, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {useCase}
                            </Badge>
                          ))}
                          {template.target_use_cases.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{template.target_use_cases.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">PERMISSIONS</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(template.base_permissions as PermissionKey[]).length} permissions included
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleSelectTemplate(template)}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Customization Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Customize Role Template
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate ? `Creating role based on "${selectedTemplate.display_name}" template` : "Customize your role"}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-6">
              {/* Role Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="role_name">Role Name</Label>
                  <Input
                    id="role_name"
                    value={customizationData.role_display_name}
                    onChange={(e) => setCustomizationData(prev => ({ ...prev, role_display_name: e.target.value }))}
                    placeholder="Enter role name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={customizationData.description}
                    onChange={(e) => setCustomizationData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe this role..."
                    className="resize-none"
                    rows={3}
                  />
                </div>
              </div>

              <Separator />

              {/* Template Overview */}
              <div className="space-y-4">
                <h4 className="font-medium">Template Overview</h4>
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Use Cases</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTemplate.target_use_cases.map((useCase, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {useCase}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Included Permissions</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      This template includes {(selectedTemplate.base_permissions as PermissionKey[]).length} permissions
                    </p>
                    <div className="grid grid-cols-2 gap-1 mt-2 max-h-32 overflow-y-auto">
                      {(selectedTemplate.base_permissions as PermissionKey[]).map((permission, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span className="text-muted-foreground">{permission}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Required Modules</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(selectedTemplate.required_modules as string[]).map((module, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {module}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateFromTemplate}
                  disabled={!customizationData.role_display_name || createFromTemplateMutation.isPending}
                >
                  {createFromTemplateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4 mr-2" />
                  )}
                  Create Role
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoleTemplateSelector;