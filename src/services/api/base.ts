import { supabase } from '@/integrations/supabase/client';
import { PostgrestError } from '@supabase/supabase-js';

/**
 * Custom error class for API operations with enhanced error information
 *
 * @example
 * ```typescript
 * throw new ApiError('Database connection failed', 'CONNECTION_ERROR', 'Connection timeout', 'Check network');
 * ```
 */
export class ApiError extends Error {
  /**
   * Create a new API error
   * @param message - Human-readable error message
   * @param code - Error code for programmatic handling
   * @param details - Additional error details
   * @param hint - Hint for resolving the error
   */
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

/**
 * Standard API response interface for consistent data handling
 *
 * @template T - Type of the response data
 *
 * @example
 * ```typescript
 * const response: ApiResponse<User[]> = await userService.getUsers();
 * if (response.success && response.data) {
 *   // Handle successful response
 *   console.log(response.data);
 * } else {
 *   // Handle error
 *   console.error(response.error?.message);
 * }
 * ```
 */
export interface ApiResponse<T> {
  /** The response data, null if error occurred */
  data: T | null;
  /** Error information, null if successful */
  error: ApiError | null;
  /** Whether the operation was successful */
  success: boolean;
}

/**
 * Base API service class providing common functionality for all API services
 *
 * Provides consistent error handling, request processing, and authentication
 * management for all database operations.
 *
 * @abstract
 * @example
 * ```typescript
 * class UserService extends BaseApiService {
 *   async getUser(id: string): Promise<ApiResponse<User>> {
 *     return this.handleRequest(async () => {
 *       return await this.supabase
 *         .from('users')
 *         .select('*')
 *         .eq('id', id)
 *         .single();
 *     });
 *   }
 * }
 * ```
 */
export abstract class BaseApiService {
  /** Protected Supabase client instance */
  protected supabase = supabase;

  /**
   * Handle Supabase requests with consistent error handling and response formatting
   *
   * This method wraps all database operations to provide:
   * - Consistent error handling and logging
   * - Standardized response format
   * - Automatic error transformation
   *
   * @template T - Type of the expected response data
   * @param request - Function that performs the Supabase operation
   * @returns Promise resolving to standardized ApiResponse
   *
   * @example
   * ```typescript
   * protected async getUserById(id: string): Promise<ApiResponse<User>> {
   *   return this.handleRequest(async () => {
   *     return await this.supabase
   *       .from('users')
   *       .select('*')
   *       .eq('id', id)
   *       .single();
   *   });
   * }
   * ```
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
   *
   * Specialized method for handling Supabase auth operations with
   * authentication-specific error processing and logging.
   *
   * @template T - Type of the expected authentication response data
   * @param request - Function that performs the authentication operation
   * @returns Promise resolving to standardized ApiResponse
   *
   * @example
   * ```typescript
   * protected async signIn(email: string, password: string): Promise<ApiResponse<AuthSession>> {
   *   return this.handleAuthRequest(async () => {
   *     return await this.supabase.auth.signInWithPassword({
   *       email,
   *       password
   *     });
   *   });
   * }
   * ```
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
   *
   * Specialized method for handling Supabase RPC function calls with
   * consistent error handling and response formatting.
   *
   * @template T - Type of the expected RPC response data
   * @param rpcName - Name of the RPC function to call
   * @param params - Optional parameters to pass to the RPC function
   * @returns Promise resolving to standardized ApiResponse
   *
   * @example
   * ```typescript
   * protected async calculateExpenseTotal(userId: string): Promise<ApiResponse<number>> {
   *   return this.handleRpcRequest('calculate_user_expense_total', {
   *     user_id: userId
   *   });
   * }
   * ```
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