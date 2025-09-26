import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Search, Eye, EyeOff, AlertTriangle, Activity, BarChart3, Key } from 'lucide-react';
import { useApiKeys, useApiKeyStats, useCreateApiKey, useUpdateApiKey, useDeleteApiKey, useToggleApiKeyActive } from '@/hooks/api/useApiKeys';
import { CreateApiKeyRequest, UpdateApiKeyRequest } from '@/services/api/apiKeys';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const API_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', description: 'GPT models, embeddings, and chat' },
  { value: 'google-document-ai', label: 'Google Document AI', description: 'Document processing and OCR' },
  { value: 'anthropic', label: 'Anthropic', description: 'Claude AI models' },
  { value: 'azure-openai', label: 'Azure OpenAI', description: 'Microsoft Azure OpenAI services' },
];

export default function SuperAdminApiKeys() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<any>(null);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  const { data: apiKeys = [], isLoading, error } = useApiKeys();
  const { data: stats, isLoading: statsLoading } = useApiKeyStats();
  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  const createMutation = useCreateApiKey();
  const updateMutation = useUpdateApiKey();
  const deleteMutation = useDeleteApiKey();
  const toggleActiveMutation = useToggleApiKeyActive();

  const filteredKeys = apiKeys.filter(key => {
    const matchesSearch = key.company?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         key.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         key.api_key_last_four.includes(searchTerm);
    const matchesProvider = selectedProvider === 'all' || key.provider === selectedProvider;
    const matchesStatus = selectedStatus === 'all' ||
                         (selectedStatus === 'active' && key.is_active) ||
                         (selectedStatus === 'inactive' && !key.is_active);

    return matchesSearch && matchesProvider && matchesStatus;
  });

  const handleCreateKey = (data: CreateApiKeyRequest) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        setIsCreateDialogOpen(false);
      }
    });
  };

  const handleUpdateKey = (data: UpdateApiKeyRequest) => {
    if (editingKey) {
      updateMutation.mutate({ id: editingKey.id, data }, {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setEditingKey(null);
        }
      });
    }
  };

  const handleDeleteKey = (id: string) => {
    if (confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    toggleActiveMutation.mutate({ id, isActive: !isActive });
  };

  const toggleShowKey = (id: string) => {
    setShowKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Key Manager</h1>
          <p className="text-muted-foreground">Manage AI service API keys for all companies</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <p>Database not ready. Please run the migration scripts to set up the API keys table.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Key Manager</h1>
          <p className="text-muted-foreground">Manage AI service API keys for all companies</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <CreateApiKeyForm
              companies={companies}
              onSubmit={handleCreateKey}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      {!statsLoading && stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Keys</CardTitle>
              <Key className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_keys}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active_keys}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive Keys</CardTitle>
              <Activity className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.inactive_keys}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Providers</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.providers.length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search keys..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="All providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All providers</SelectItem>
                  {API_PROVIDERS.map(provider => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys ({filteredKeys.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredKeys.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No API keys found matching your criteria.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredKeys.map((key) => (
                <ApiKeyCard
                  key={key.id}
                  apiKey={key}
                  showKey={showKey[key.id] || false}
                  onToggleShow={() => toggleShowKey(key.id)}
                  onToggleActive={() => handleToggleActive(key.id, key.is_active)}
                  onEdit={() => {
                    setEditingKey(key);
                    setIsEditDialogOpen(true);
                  }}
                  onDelete={() => handleDeleteKey(key.id)}
                  isToggling={toggleActiveMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {editingKey && (
            <EditApiKeyForm
              apiKey={editingKey}
              companies={companies}
              onSubmit={handleUpdateKey}
              isLoading={updateMutation.isPending}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setEditingKey(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Create API Key Form Component
function CreateApiKeyForm({
  companies,
  onSubmit,
  isLoading
}: {
  companies: any[],
  onSubmit: (data: CreateApiKeyRequest) => void,
  isLoading: boolean
}) {
  const [formData, setFormData] = useState<CreateApiKeyRequest>({
    company_id: '',
    provider: '',
    api_key: '',
    is_active: true,
    monthly_usage_limit: null,
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Add New API Key</DialogTitle>
        <DialogDescription>
          Add a new API key for a company and AI provider.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Select value={formData.company_id} onValueChange={(value) =>
            setFormData(prev => ({ ...prev, company_id: value }))
          }>
            <SelectTrigger>
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map(company => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <Select value={formData.provider} onValueChange={(value) =>
            setFormData(prev => ({ ...prev, provider: value }))
          }>
            <SelectTrigger>
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {API_PROVIDERS.map(provider => (
                <SelectItem key={provider.value} value={provider.value}>
                  <div>
                    <div className="font-medium">{provider.label}</div>
                    <div className="text-sm text-muted-foreground">{provider.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            type="password"
            value={formData.api_key}
            onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
            placeholder="Enter API key"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="monthlyLimit">Monthly Usage Limit (optional)</Label>
          <Input
            id="monthlyLimit"
            type="number"
            value={formData.monthly_usage_limit || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              monthly_usage_limit: e.target.value ? parseInt(e.target.value) : null
            }))}
            placeholder="Enter limit"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={formData.notes || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Enter notes"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          type="submit"
          disabled={isLoading || !formData.company_id || !formData.provider || !formData.api_key}
        >
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create API Key
        </Button>
      </DialogFooter>
    </form>
  );
}

// Edit API Key Form Component
function EditApiKeyForm({
  apiKey,
  companies,
  onSubmit,
  isLoading,
  onCancel
}: {
  apiKey: any,
  companies: any[],
  onSubmit: (data: UpdateApiKeyRequest) => void,
  isLoading: boolean,
  onCancel: () => void
}) {
  const [formData, setFormData] = useState<UpdateApiKeyRequest>({
    api_key: '',
    is_active: apiKey.is_active,
    monthly_usage_limit: apiKey.monthly_usage_limit,
    notes: apiKey.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = { ...formData };
    if (!dataToSubmit.api_key) {
      delete dataToSubmit.api_key;
    }
    onSubmit(dataToSubmit);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Edit API Key</DialogTitle>
        <DialogDescription>
          Update API key details for {apiKey.company?.name} - {apiKey.provider}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key (leave empty to keep current)</Label>
          <Input
            id="apiKey"
            type="password"
            value={formData.api_key || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
            placeholder="Enter new API key"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="monthlyLimit">Monthly Usage Limit</Label>
          <Input
            id="monthlyLimit"
            type="number"
            value={formData.monthly_usage_limit || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              monthly_usage_limit: e.target.value ? parseInt(e.target.value) : null
            }))}
            placeholder="Enter limit"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Enter notes"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Update API Key
        </Button>
      </DialogFooter>
    </form>
  );
}

// API Key Card Component
function ApiKeyCard({
  apiKey,
  showKey,
  onToggleShow,
  onToggleActive,
  onEdit,
  onDelete,
  isToggling
}: {
  apiKey: any,
  showKey: boolean,
  onToggleShow: () => void,
  onToggleActive: () => void,
  onEdit: () => void,
  onDelete: () => void,
  isToggling: boolean
}) {
  const usagePercentage = apiKey.monthly_usage_limit ?
    (apiKey.current_month_usage / apiKey.monthly_usage_limit) * 100 : 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{apiKey.company?.name}</h3>
                <Badge variant={apiKey.is_active ? "default" : "secondary"}>
                  {apiKey.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {apiKey.provider} • ****{apiKey.api_key_last_four}
              </div>
              {apiKey.monthly_usage_limit && (
                <div className="text-sm text-muted-foreground">
                  Usage: {apiKey.current_month_usage} / {apiKey.monthly_usage_limit}
                  ({usagePercentage.toFixed(1)}%)
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleShow}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleActive}
              disabled={isToggling}
            >
              {isToggling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {apiKey.is_active ? 'Deactivate' : 'Activate'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
            >
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        </div>
        {showKey && (
          <div className="mt-4 p-3 bg-muted rounded">
            <div className="text-sm font-mono break-all">
              {apiKey.api_key_encrypted || 'Encrypted key not visible'}
            </div>
          </div>
        )}
        {apiKey.notes && (
          <div className="mt-2 text-sm text-muted-foreground">
            {apiKey.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}