import { supabase } from '@/integrations/supabase/client';
import { PostgrestError, PostgrestResponse } from '@supabase/supabase-js';

export interface ApiResponse<T> {
  data: T | null;
  error: PostgrestError | null;
  success: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface FilterOptions {
  [key: string]: unknown;
}

export interface SortOptions {
  column: string;
  ascending?: boolean;
}

export abstract class BaseService<T extends Record<string, unknown>> {
  protected abstract tableName: string;

  protected handleResponse<TData>(
    response: PostgrestResponse<TData>
  ): ApiResponse<TData> {
    return {
      data: response.data,
      error: response.error,
      success: !response.error,
    };
  }

  protected handleSingleResponse<TData>(
    response: PostgrestResponse<TData[]>
  ): ApiResponse<TData | null> {
    const singleData = response.data?.[0] ?? null;
    return {
      data: singleData,
      error: response.error,
      success: !response.error,
    };
  }

  async getAll(
    options: {
      pagination?: PaginationOptions;
      filters?: FilterOptions;
      sort?: SortOptions;
      select?: string;
    } = {}
  ): Promise<ApiResponse<T[]>> {
    try {
      let query = supabase
        .from(this.tableName)
        .select(options.select ?? '*');

      // Apply filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      // Apply sorting
      if (options.sort) {
        query = query.order(options.sort.column, {
          ascending: options.sort.ascending ?? true,
        });
      }

      // Apply pagination
      if (options.pagination) {
        const { page, limit, offset } = options.pagination;
        if (offset !== undefined) {
          query = query.range(offset, offset + (limit ?? 50) - 1);
        } else if (page !== undefined && limit !== undefined) {
          const start = (page - 1) * limit;
          query = query.range(start, start + limit - 1);
        }
      }

      const response = await query;
      return this.handleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error as PostgrestError,
        success: false,
      };
    }
  }

  async getById(id: string, select?: string): Promise<ApiResponse<T | null>> {
    try {
      const response = await supabase
        .from(this.tableName)
        .select(select ?? '*')
        .eq('id', id);

      return this.handleSingleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error as PostgrestError,
        success: false,
      };
    }
  }

  async create(data: Partial<T>): Promise<ApiResponse<T | null>> {
    try {
      const response = await supabase
        .from(this.tableName)
        .insert(data)
        .select();

      return this.handleSingleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error as PostgrestError,
        success: false,
      };
    }
  }

  async update(id: string, data: Partial<T>): Promise<ApiResponse<T | null>> {
    try {
      const response = await supabase
        .from(this.tableName)
        .update(data)
        .eq('id', id)
        .select();

      return this.handleSingleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error as PostgrestError,
        success: false,
      };
    }
  }

  async delete(id: string): Promise<ApiResponse<null>> {
    try {
      const response = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      return {
        data: null,
        error: response.error,
        success: !response.error,
      };
    } catch (error) {
      return {
        data: null,
        error: error as PostgrestError,
        success: false,
      };
    }
  }

  async count(filters?: FilterOptions): Promise<ApiResponse<number>> {
    try {
      let query = supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      // Apply filters
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      const response = await query;
      return {
        data: response.count ?? 0,
        error: response.error,
        success: !response.error,
      };
    } catch (error) {
      return {
        data: 0,
        error: error as PostgrestError,
        success: false,
      };
    }
  }

  protected async executeQuery<TData>(
    queryBuilder: () => Promise<PostgrestResponse<TData>>
  ): Promise<ApiResponse<TData>> {
    try {
      const response = await queryBuilder();
      return this.handleResponse(response);
    } catch (error) {
      return {
        data: null,
        error: error as PostgrestError,
        success: false,
      };
    }
  }
}