import { supabase } from '@/integrations/supabase/client';
import { PostgrestError } from '@supabase/supabase-js';

// API Error class for better error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any,
    public hint?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Standard API response interface
export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  success: boolean;
}

// Base API service class
export abstract class BaseApiService {
  protected supabase = supabase;

  /**
   * Handle Supabase requests with consistent error handling
   */
  protected async handleRequest<T>(
    request: () => Promise<{ data: T; error: PostgrestError | null }>
  ): Promise<ApiResponse<T>> {
    try {
      const { data, error } = await request();

      if (error) {
        console.error('API Request failed:', error);
        throw new ApiError(
          error.message ?? 'Database operation failed',
          error.code,
          error.details,
          error.hint
        );
      }

      return {
        data,
        error: null,
        success: true
      };
    } catch (error) {
      console.error('API Service error:', error);

      if (error instanceof ApiError) {
        return {
          data: null,
          error,
          success: false
        };
      }

      return {
        data: null,
        error: new ApiError(
          error instanceof Error ? error.message : 'Unknown error occurred'
        ),
        success: false
      };
    }
  }

  /**
   * Handle authentication requests with auth-specific error handling
   */
  protected async handleAuthRequest<T>(
    request: () => Promise<{ data: T; error: any }>
  ): Promise<ApiResponse<T>> {
    try {
      const { data, error } = await request();

      if (error) {
        console.error('Auth Request failed:', error);
        throw new ApiError(
          error.message ?? 'Authentication operation failed',
          error.code ?? 'AUTH_ERROR',
          error
        );
      }

      return {
        data,
        error: null,
        success: true
      };
    } catch (error) {
      console.error('Auth Service error:', error);

      if (error instanceof ApiError) {
        return {
          data: null,
          error,
          success: false
        };
      }

      return {
        data: null,
        error: new ApiError(
          error instanceof Error ? error.message : 'Authentication failed'
        ),
        success: false
      };
    }
  }

  /**
   * Handle RPC (Remote Procedure Call) requests
   */
  protected async handleRpcRequest<T>(
    rpcName: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      const { data, error } = await this.supabase.rpc(rpcName, params);

      if (error) {
        console.error(`RPC ${rpcName} failed:`, error);
        throw new ApiError(
          error.message ?? `RPC ${rpcName} failed`,
          error.code,
          error.details,
          error.hint
        );
      }

      return {
        data,
        error: null,
        success: true
      };
    } catch (error) {
      console.error(`RPC Service error for ${rpcName}:`, error);

      if (error instanceof ApiError) {
        return {
          data: null,
          error,
          success: false
        };
      }

      return {
        data: null,
        error: new ApiError(
          error instanceof Error ? error.message : `RPC ${rpcName} failed`
        ),
        success: false
      };
    }
  }
}