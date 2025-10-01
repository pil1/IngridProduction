/**
 * usePermissionTemplates Hook
 * Hook for managing permission templates (quick user setup)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/components/SessionContextProvider';
import { useToast } from '@/hooks/use-toast';
import type { PermissionTemplate, UserRole } from '@/types/permissions-v2';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface TemplatesResponse {
  success: boolean;
  data: {
    templates: Array<PermissionTemplate & {
      permission_details: Array<{
        permission_key: string;
        permission_name: string;
        permission_group: string;
      }>;
      module_details: Array<{
        module_id: string;
        module_name: string;
        module_tier: string;
      }>;
    }>;
    total_count: number;
    system_templates: number;
    custom_templates: number;
  };
}

interface TemplateResponse {
  success: boolean;
  data: {
    template: PermissionTemplate & {
      permission_details: any[];
      module_details: any[];
    };
  };
}

interface ApplyTemplateRequest {
  template_id: string;
  user_id: string;
  company_id: string;
}

interface CreateTemplateRequest {
  template_name: string;
  display_name: string;
  description?: string;
  target_role: UserRole;
  data_permissions: string[];
  modules?: string[];
}

/**
 * Get authorization headers with JWT token
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  if (!token) throw new Error('No access token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

/**
 * Hook for managing permission templates
 */
export const usePermissionTemplates = () => {
  const { profile } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all templates
  const {
    data: allTemplates,
    isLoading: loadingTemplates,
    error: templatesError,
  } = useQuery({
    queryKey: ['permission-templates'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/permission-templates`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data: TemplatesResponse = await response.json();
      return data.data;
    },
  });

  // Fetch templates by role
  const getTemplatesByRole = (targetRole: UserRole) => {
    return useQuery({
      queryKey: ['permission-templates', 'role', targetRole],
      queryFn: async () => {
        const response = await fetch(`${API_URL}/permission-templates?target_role=${targetRole}`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch templates');
        const data: TemplatesResponse = await response.json();
        return data.data;
      },
      enabled: !!targetRole,
    });
  };

  // Fetch single template
  const getTemplate = (templateId: string) => {
    return useQuery({
      queryKey: ['permission-templates', templateId],
      queryFn: async () => {
        const response = await fetch(`${API_URL}/permission-templates/${templateId}`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch template');
        const data: TemplateResponse = await response.json();
        return data.data.template;
      },
      enabled: !!templateId,
    });
  };

  // Create custom template
  const createTemplate = useMutation({
    mutationFn: async (request: CreateTemplateRequest) => {
      const response = await fetch(`${API_URL}/permission-templates`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create template');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['permission-templates'] });
      toast({
        title: 'Template Created',
        description: `Template "${data.data.template.display_name}" created successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Creation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update custom template
  const updateTemplate = useMutation({
    mutationFn: async ({
      template_id,
      ...request
    }: CreateTemplateRequest & { template_id: string }) => {
      const response = await fetch(`${API_URL}/permission-templates/${template_id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update template');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['permission-templates'] });
      queryClient.invalidateQueries({ queryKey: ['permission-templates', variables.template_id] });
      toast({
        title: 'Template Updated',
        description: 'Template updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete custom template
  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(`${API_URL}/permission-templates/${templateId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-templates'] });
      toast({
        title: 'Template Deleted',
        description: 'Template deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Deletion Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Apply template to user
  const applyTemplate = useMutation({
    mutationFn: async (request: ApplyTemplateRequest) => {
      const response = await fetch(`${API_URL}/permission-templates/${request.template_id}/apply`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          user_id: request.user_id,
          company_id: request.company_id,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to apply template');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['data-permissions', 'user', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['module-permissions', 'user', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['data-permissions', 'user', variables.user_id, 'complete'] });
      toast({
        title: 'Template Applied',
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Application Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    // Query results
    allTemplates,
    loadingTemplates,
    templatesError,

    // Query functions
    getTemplatesByRole,
    getTemplate,

    // Mutations
    createTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
  };
};

export default usePermissionTemplates;
