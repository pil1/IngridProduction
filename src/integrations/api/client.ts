/**
 * API Client for INFOtrac Backend
 * Replaces Supabase client with native REST API calls
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    status?: number;
    code?: string;
  };
  message?: string;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    // Initialize with stored token
    this.initializeToken();
  }

  private initializeToken() {
    try {
      // Use the primary token storage key used throughout the application
      const token = localStorage.getItem('accessToken') ||
                   localStorage.getItem('infotrac_token') ||
                   localStorage.getItem('supabase.auth.token');

      if (token) {
        console.log('Initializing API client with stored token:', token.substring(0, 20) + '...');
        this.token = token;
      } else {
        console.log('No stored token found for API client');
      }
    } catch (error) {
      console.warn('Error initializing token:', error);
    }
  }

  setAuthToken(token: string | null) {
    this.token = token;
  }

  // Refresh token from localStorage
  refreshTokenFromStorage() {
    this.initializeToken();
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Always check for the latest token from localStorage if we don't have one
    const token = this.token || localStorage.getItem('accessToken');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          name: 'ApiError',
          message: data.error?.message || `HTTP ${response.status}`,
          status: response.status,
          code: data.error?.code,
        } as ApiError;
      }

      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          success: false,
          error: {
            message: 'Network error - please check your connection',
            status: 0,
          }
        };
      }

      if (error && typeof error === 'object' && 'status' in error) {
        return {
          success: false,
          error: {
            message: (error as ApiError).message,
            status: (error as ApiError).status,
            code: (error as ApiError).code,
          }
        };
      }

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        }
      };
    }
  }

  // Authentication methods
  auth = {
    signInWithPassword: async (credentials: { email: string; password: string }) => {
      return this.request<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
    },

    signOut: async () => {
      const result = await this.request<void>('/auth/logout', {
        method: 'POST',
      });
      this.token = null;
      return result;
    },

    getSession: async () => {
      // In our new system, we'll get user info from the /me endpoint
      return this.request<any>('/auth/me');
    },

    getUser: async () => {
      return this.request<any>('/auth/me');
    },

    refreshSession: async () => {
      // JWT tokens are stateless, no refresh needed in this implementation
      // But we'll keep the interface for compatibility
      return { data: { session: null }, error: null };
    },

    resetPasswordForEmail: async (email: string, options?: any) => {
      return this.request<void>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, ...options }),
      });
    },

    updateUser: async (updates: any) => {
      return this.request<any>('/auth/update-profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },

    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      // Import and use auth service
      const authService = import('@/services/authService').then(module => module.authService);
      return authService.then(service => service.onAuthStateChange(callback));
    }
  };

  // Table operations
  from(table: string) {
    return new QueryBuilder(this, table);
  }

  // RPC functions
  rpc<T>(functionName: string, params?: Record<string, any>): Promise<{ data: T; error: any }> {
    return this.request<T>(`/rpc/${functionName}`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    }).then(response => ({
      data: response.data as T,
      error: response.error || null,
    }));
  }

  // HTTP methods
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Function invocation (for compatibility)
  functions = {
    invoke: async (functionName: string, options: { body?: any } = {}) => {
      return this.request<any>(`/functions/${functionName}`, {
        method: 'POST',
        body: JSON.stringify(options.body || {}),
      });
    }
  };
}

class QueryBuilder {
  private client: ApiClient;
  private tableName: string;
  private selectFields: string = '*';
  private whereConditions: Array<{ field: string; operator: string; value: any }> = [];
  private orderByFields: Array<{ field: string; ascending: boolean }> = [];
  private limitCount?: number;

  constructor(client: ApiClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }

  select(fields: string = '*') {
    this.selectFields = fields;
    return this;
  }

  eq(field: string, value: any) {
    this.whereConditions.push({ field, operator: 'eq', value });
    return this;
  }

  neq(field: string, value: any) {
    this.whereConditions.push({ field, operator: 'neq', value });
    return this;
  }

  gt(field: string, value: any) {
    this.whereConditions.push({ field, operator: 'gt', value });
    return this;
  }

  gte(field: string, value: any) {
    this.whereConditions.push({ field, operator: 'gte', value });
    return this;
  }

  lt(field: string, value: any) {
    this.whereConditions.push({ field, operator: 'lt', value });
    return this;
  }

  lte(field: string, value: any) {
    this.whereConditions.push({ field, operator: 'lte', value });
    return this;
  }

  like(field: string, value: string) {
    this.whereConditions.push({ field, operator: 'like', value });
    return this;
  }

  in(field: string, values: any[]) {
    this.whereConditions.push({ field, operator: 'in', value: values });
    return this;
  }

  or(condition: string) {
    // Parse Supabase-style OR condition like "name.eq.CompanyName,slug.eq.company-name"
    // For now, we'll handle this by creating separate API calls and combining results
    // This is a compatibility layer - ideally backend should handle OR queries
    this.whereConditions.push({ field: '_or', operator: 'or', value: condition });
    return this;
  }

  order(field: string, options: { ascending?: boolean } = {}) {
    this.orderByFields.push({ field, ascending: options.ascending !== false });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  // Execute queries
  async single() {
    const result = await this.execute();
    if (result.error) return result;

    if (!result.data || (Array.isArray(result.data) && result.data.length === 0)) {
      return { data: null, error: { message: 'No rows found', code: 'PGRST116' } };
    }

    const data = Array.isArray(result.data) ? result.data[0] : result.data;
    return { data, error: null };
  }

  async maybeSingle() {
    const result = await this.execute();
    if (result.error) return result;

    const data = Array.isArray(result.data)
      ? (result.data.length > 0 ? result.data[0] : null)
      : result.data;
    return { data, error: null };
  }

  async execute() {
    // Check for OR conditions - handle them specially
    const orConditions = this.whereConditions.filter(c => c.operator === 'or');
    const regularConditions = this.whereConditions.filter(c => c.operator !== 'or');

    if (orConditions.length > 0) {
      // For OR conditions, we'll need to make multiple requests and combine results
      // This is a simplified implementation for basic OR queries
      const orCondition = orConditions[0]; // Take the first OR condition

      // Parse the OR condition string like "name.eq.CompanyName,slug.eq.company-name"
      const conditions = orCondition.value.split(',');
      const results = [];

      for (const condition of conditions) {
        const [fieldOp, value] = condition.split('.eq.');
        if (fieldOp && value) {
          const params = new URLSearchParams();

          if (this.selectFields !== '*') {
            params.append('select', this.selectFields);
          }

          // Add the specific condition
          params.append(`${fieldOp}[eq]`, value);

          // Add regular conditions
          regularConditions.forEach(({ field, operator, value }) => {
            params.append(`${field}[${operator}]`, Array.isArray(value) ? value.join(',') : value);
          });

          this.orderByFields.forEach(({ field, ascending }) => {
            params.append('order', `${field}.${ascending ? 'asc' : 'desc'}`);
          });

          if (this.limitCount) {
            params.append('limit', this.limitCount.toString());
          }

          const queryString = params.toString();
          const endpoint = `/${this.tableName}${queryString ? `?${queryString}` : ''}`;

          try {
            const response = await this.client['request'](endpoint);
            if (response.data) {
              results.push(...(Array.isArray(response.data) ? response.data : [response.data]));
            }
          } catch (error) {
            // Continue with other conditions
          }
        }
      }

      // Remove duplicates based on 'id' field if present
      const uniqueResults = results.reduce((acc, current) => {
        const exists = acc.find(item => item.id && item.id === current.id);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, []);

      return {
        data: uniqueResults,
        error: null,
      };
    }

    // Regular query without OR conditions
    const params = new URLSearchParams();

    if (this.selectFields !== '*') {
      params.append('select', this.selectFields);
    }

    regularConditions.forEach(({ field, operator, value }) => {
      params.append(`${field}[${operator}]`, Array.isArray(value) ? value.join(',') : value);
    });

    this.orderByFields.forEach(({ field, ascending }) => {
      params.append('order', `${field}.${ascending ? 'asc' : 'desc'}`);
    });

    if (this.limitCount) {
      params.append('limit', this.limitCount.toString());
    }

    const queryString = params.toString();
    const endpoint = `/${this.tableName}${queryString ? `?${queryString}` : ''}`;

    const response = await this.client['request'](endpoint);
    return {
      data: response.data,
      error: response.error || null,
    };
  }

  // Insert
  async insert(data: any) {
    const response = await this.client['request'](`/${this.tableName}`, {
      method: 'POST',
      body: JSON.stringify(Array.isArray(data) ? data : [data]),
    });

    return {
      data: response.data,
      error: response.error || null,
    };
  }

  // Update
  async update(data: any) {
    // For updates, we need to build the endpoint with conditions
    if (this.whereConditions.length === 0) {
      return {
        data: null,
        error: { message: 'Update requires WHERE conditions', code: 'UPDATE_NO_WHERE' }
      };
    }

    // Assuming we have an ID condition for updates
    const idCondition = this.whereConditions.find(c => c.field === 'id' && c.operator === 'eq');
    if (!idCondition) {
      return {
        data: null,
        error: { message: 'Update requires ID condition', code: 'UPDATE_NO_ID' }
      };
    }

    const response = await this.client['request'](`/${this.tableName}/${idCondition.value}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    return {
      data: response.data,
      error: response.error || null,
    };
  }

  // Delete
  async delete() {
    // Similar to update, we need ID conditions
    const idCondition = this.whereConditions.find(c => c.field === 'id' && c.operator === 'eq');
    if (!idCondition) {
      return {
        data: null,
        error: { message: 'Delete requires ID condition', code: 'DELETE_NO_ID' }
      };
    }

    const response = await this.client['request'](`/${this.tableName}/${idCondition.value}`, {
      method: 'DELETE',
    });

    return {
      data: response.data,
      error: response.error || null,
    };
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// For compatibility with existing Supabase code
export const supabase = apiClient;

// Export the client as default
export default apiClient;