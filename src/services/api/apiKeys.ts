import { BaseService, ApiResponse } from './baseService';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyApiKey {
  id: string;
  company_id: string;
  company?: {
    id: string;
    name: string;
  };
  provider: string;
  api_key_last_four: string;
  api_key_encrypted?: string;
  is_active: boolean;
  monthly_usage_limit: number | null;
  usage_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  provisioned_by: string | null;
  provisioned_at: string;
  last_used_at: string | null;
}

export interface ApiKeyUsageStats {
  total_keys: number;
  active_keys: number;
  inactive_keys: number;
  providers: {
    provider: string;
    count: number;
    active_count: number;
  }[];
  monthly_usage: {
    provider: string;
    usage: number;
    limit: number | null;
    percentage: number;
  }[];
}

export interface CreateApiKeyRequest {
  company_id: string;
  provider: string;
  api_key: string;
  is_active?: boolean;
  monthly_usage_limit?: number | null;
  notes?: string | null;
}

export interface UpdateApiKeyRequest {
  api_key?: string;
  is_active?: boolean;
  monthly_usage_limit?: number | null;
  notes?: string | null;
}

class ApiKeyService extends BaseService<CompanyApiKey> {
  protected tableName = 'company_api_keys';

  async getAllWithCompanies(): Promise<ApiResponse<CompanyApiKey[]>> {
    try {
      const response = await supabase
        .from(this.tableName)
        .select(`
          *,
          company:companies(id, name)
        `)
        .order('created_at', { ascending: false });

      // Handle case where table doesn't exist yet
      if (response.error?.code === 'PGRST116' || response.error?.message?.includes('does not exist')) {
        console.warn('API Keys table does not exist yet. Please run the database migration.');
        return {
          data: [],
          error: null,
          success: true,
        };
      }

      return this.handleResponse(response);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      return {
        data: [],
        error: error as any,
        success: false,
      };
    }
  }

  async getByCompany(companyId: string): Promise<ApiResponse<CompanyApiKey[]>> {
    try {
      const response = await supabase
        .from(this.tableName)
        .select(`
          *,
          company:companies(id, name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      return this.handleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }

  async getByProvider(provider: string): Promise<ApiResponse<CompanyApiKey[]>> {
    try {
      const response = await supabase
        .from(this.tableName)
        .select(`
          *,
          company:companies(id, name)
        `)
        .eq('provider', provider)
        .order('created_at', { ascending: false });

      return this.handleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }

  async createApiKey(data: CreateApiKeyRequest): Promise<ApiResponse<CompanyApiKey | null>> {
    try {
      const { api_key, ...payload } = data;

      // Encrypt the API key (simplified for demo - in production use proper encryption)
      const encryptedPayload = {
        ...payload,
        api_key_encrypted: `encrypted_${api_key}`,
        api_key_last_four: api_key.slice(-4),
        usage_count: 0,
      };

      const response = await supabase
        .from(this.tableName)
        .insert(encryptedPayload)
        .select(`
          *,
          company:companies(id, name)
        `);

      return this.handleSingleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }

  async updateApiKey(id: string, data: UpdateApiKeyRequest): Promise<ApiResponse<CompanyApiKey | null>> {
    try {
      let payload: any = { ...data };

      // If updating the API key, encrypt it
      if (data.api_key) {
        payload.api_key_encrypted = `encrypted_${data.api_key}`;
        payload.api_key_last_four = data.api_key.slice(-4);
        delete payload.api_key;
      }

      const response = await supabase
        .from(this.tableName)
        .update(payload)
        .eq('id', id)
        .select(`
          *,
          company:companies(id, name)
        `);

      return this.handleSingleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }

  async toggleActive(id: string, isActive: boolean): Promise<ApiResponse<CompanyApiKey | null>> {
    return this.updateApiKey(id, { is_active: isActive });
  }

  async getUsageStats(): Promise<ApiResponse<ApiKeyUsageStats>> {
    try {
      // Get basic counts
      const [totalResponse, activeResponse, inactiveResponse] = await Promise.all([
        supabase.from(this.tableName).select('*', { count: 'exact', head: true }),
        supabase.from(this.tableName).select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from(this.tableName).select('*', { count: 'exact', head: true }).eq('is_active', false),
      ]);

      // Handle case where table doesn't exist yet
      if (totalResponse.error?.code === 'PGRST116' || totalResponse.error?.message?.includes('does not exist')) {
        console.warn('API Keys table does not exist yet. Returning empty stats.');
        return {
          data: {
            total_keys: 0,
            active_keys: 0,
            inactive_keys: 0,
            providers: [],
            monthly_usage: [],
          },
          error: null,
          success: true,
        };
      }

      // Get provider stats
      const providersResponse = await supabase
        .from(this.tableName)
        .select('provider, is_active');

      // Get usage stats
      const usageResponse = await supabase
        .from(this.tableName)
        .select('provider, usage_count, monthly_usage_limit, is_active')
        .eq('is_active', true);

      if (totalResponse.error || activeResponse.error || inactiveResponse.error ||
          providersResponse.error || usageResponse.error) {
        throw totalResponse.error || activeResponse.error || inactiveResponse.error ||
              providersResponse.error || usageResponse.error;
      }

      // Process provider stats
      const providerStats = new Map<string, { count: number; active_count: number }>();
      providersResponse.data?.forEach(key => {
        const existing = providerStats.get(key.provider) || { count: 0, active_count: 0 };
        existing.count++;
        if (key.is_active) existing.active_count++;
        providerStats.set(key.provider, existing);
      });

      // Process usage stats
      const usageStats = new Map<string, { usage: number; limit: number | null; count: number }>();
      usageResponse.data?.forEach(key => {
        const existing = usageStats.get(key.provider) || { usage: 0, limit: null, count: 0 };
        existing.usage += key.usage_count || 0;
        if (key.monthly_usage_limit) {
          existing.limit = (existing.limit || 0) + key.monthly_usage_limit;
        }
        existing.count++;
        usageStats.set(key.provider, existing);
      });

      const stats: ApiKeyUsageStats = {
        total_keys: totalResponse.count || 0,
        active_keys: activeResponse.count || 0,
        inactive_keys: inactiveResponse.count || 0,
        providers: Array.from(providerStats.entries()).map(([provider, stats]) => ({
          provider,
          count: stats.count,
          active_count: stats.active_count,
        })),
        monthly_usage: Array.from(usageStats.entries()).map(([provider, stats]) => ({
          provider,
          usage: stats.usage,
          limit: stats.limit,
          percentage: stats.limit ? (stats.usage / stats.limit) * 100 : 0,
        })),
      };

      return {
        data: stats,
        error: null,
        success: true,
      };
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }

  async incrementUsage(id: string, amount: number = 1): Promise<ApiResponse<CompanyApiKey | null>> {
    try {
      const response = await supabase.rpc('increment_api_key_usage', {
        api_key_id: id,
        usage_amount: amount,
      });

      if (response.error) {
        throw response.error;
      }

      // Fetch the updated record
      return this.getById(id);
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }

  async resetMonthlyUsage(): Promise<ApiResponse<null>> {
    try {
      const response = await supabase
        .from(this.tableName)
        .update({ usage_count: 0 });

      return {
        data: null,
        error: response.error,
        success: !response.error,
      };
    } catch (error) {
      return {
        data: null,
        error: error as any,
        success: false,
      };
    }
  }
}

export const apiKeyService = new ApiKeyService();