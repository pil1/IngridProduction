import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseApiService, ApiError } from '../base';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn()
  }
}));

class TestApiService extends BaseApiService {
  public async testHandleRequest<T>(
    request: () => Promise<{ data: T; error: any }>
  ) {
    return this.handleRequest(request);
  }

  public async testHandleAuthRequest<T>(
    request: () => Promise<{ data: T; error: any }>
  ) {
    return this.handleAuthRequest(request);
  }

  public async testHandleRpcRequest<T>(
    rpcName: string,
    params?: Record<string, any>
  ) {
    return this.handleRpcRequest<T>(rpcName, params);
  }

  // Simulate typical CRUD operations using handleRequest
  public async createRecord(data: any) {
    return this.handleRequest(() =>
      this.supabase.from('test_table').insert(data).select('*').single()
    );
  }

  public async getRecord(id: string) {
    return this.handleRequest(() =>
      this.supabase.from('test_table').select('*').eq('id', id).maybeSingle()
    );
  }
}

describe('BaseApiService', () => {
  let service: TestApiService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestApiService();
  });

  describe('handleRequest', () => {
    it('should handle successful requests', async () => {
      const mockData = { id: '123', name: 'Test Item' };
      const mockRequest = vi.fn().mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await service.testHandleRequest(mockRequest);

      expect(mockRequest).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
    });

    it('should handle database errors', async () => {
      const dbError = {
        message: 'Database connection failed',
        code: 'CONNECTION_ERROR',
        details: 'Connection timeout',
        hint: 'Check network'
      };
      const mockRequest = vi.fn().mockResolvedValue({
        data: null,
        error: dbError
      });

      const result = await service.testHandleRequest(mockRequest);

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe('Database connection failed');
      expect(result.error?.code).toBe('CONNECTION_ERROR');
    });

    it('should handle network errors', async () => {
      const mockRequest = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await service.testHandleRequest(mockRequest);

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe('Network timeout');
    });

    it('should handle unknown errors', async () => {
      const mockRequest = vi.fn().mockRejectedValue('Unknown error');

      const result = await service.testHandleRequest(mockRequest);

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe('Unknown error occurred');
    });
  });

  describe('handleAuthRequest', () => {
    it('should handle successful auth requests', async () => {
      const mockAuthData = { user: { id: 'user-123' }, session: { access_token: 'token' } };
      const mockRequest = vi.fn().mockResolvedValue({
        data: mockAuthData,
        error: null
      });

      const result = await service.testHandleAuthRequest(mockRequest);

      expect(mockRequest).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAuthData);
      expect(result.error).toBeNull();
    });

    it('should handle auth errors', async () => {
      const authError = {
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      };
      const mockRequest = vi.fn().mockResolvedValue({
        data: null,
        error: authError
      });

      const result = await service.testHandleAuthRequest(mockRequest);

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe('Invalid credentials');
      expect(result.error?.code).toBe('INVALID_CREDENTIALS');
    });

    it('should handle auth request exceptions', async () => {
      const mockRequest = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.testHandleAuthRequest(mockRequest);

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe('Network error');
    });

    it('should handle unknown auth errors', async () => {
      const mockRequest = vi.fn().mockRejectedValue('Auth failed');

      const result = await service.testHandleAuthRequest(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Authentication failed');
    });
  });

  describe('handleRpcRequest', () => {
    it('should handle successful RPC calls', async () => {
      const mockRpcData = { result: 'success', value: 42 };
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: mockRpcData,
        error: null
      });

      const result = await service.testHandleRpcRequest('test_function', { param: 'value' });

      expect(supabase.rpc).toHaveBeenCalledWith('test_function', { param: 'value' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRpcData);
      expect(result.error).toBeNull();
    });

    it('should handle RPC errors', async () => {
      const rpcError = {
        message: 'Function not found',
        code: 'FUNCTION_NOT_FOUND',
        details: 'RPC function does not exist',
        hint: 'Check function name'
      };
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: rpcError
      });

      const result = await service.testHandleRpcRequest('nonexistent_function');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe('Function not found');
      expect(result.error?.code).toBe('FUNCTION_NOT_FOUND');
    });

    it('should handle RPC exceptions', async () => {
      vi.mocked(supabase.rpc).mockRejectedValue(new Error('RPC connection failed'));

      const result = await service.testHandleRpcRequest('test_function');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error?.message).toBe('RPC connection failed');
    });

    it('should handle unknown RPC errors', async () => {
      vi.mocked(supabase.rpc).mockRejectedValue('Unknown RPC error');

      const result = await service.testHandleRpcRequest('test_function');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('RPC test_function failed');
    });
  });

  describe('CRUD operations using handleRequest', () => {
    let mockFrom: any;

    beforeEach(() => {
      mockFrom = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
        maybeSingle: vi.fn()
      };

      vi.mocked(supabase.from).mockReturnValue(mockFrom);
    });

    it('should create records using handleRequest', async () => {
      const testData = { name: 'Test Item', value: 123 };
      const createdRecord = { id: '123', ...testData, created_at: '2025-01-01T00:00:00Z' };

      mockFrom.single.mockResolvedValue({
        data: createdRecord,
        error: null
      });

      const result = await service.createRecord(testData);

      expect(supabase.from).toHaveBeenCalledWith('test_table');
      expect(mockFrom.insert).toHaveBeenCalledWith(testData);
      expect(mockFrom.select).toHaveBeenCalledWith('*');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(createdRecord);
    });

    it('should get records using handleRequest', async () => {
      const recordId = '123';
      const record = { id: recordId, name: 'Test Item', value: 123 };

      mockFrom.maybeSingle.mockResolvedValue({
        data: record,
        error: null
      });

      const result = await service.getRecord(recordId);

      expect(supabase.from).toHaveBeenCalledWith('test_table');
      expect(mockFrom.select).toHaveBeenCalledWith('*');
      expect(mockFrom.eq).toHaveBeenCalledWith('id', recordId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(record);
    });

    it('should handle CRUD errors through handleRequest', async () => {
      const testData = { name: 'Test Item' };
      const error = {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: 'Name is required',
        hint: 'Provide a valid name'
      };

      mockFrom.single.mockResolvedValue({
        data: null,
        error
      });

      const result = await service.createRecord(testData);

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(ApiError);
      expect(result.error?.message).toBe('Validation failed');
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('ApiError', () => {
    it('should create ApiError with all properties', () => {
      const error = new ApiError(
        'Test error message',
        'TEST_CODE',
        { field: 'name' },
        'Check the field value'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ApiError');
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ field: 'name' });
      expect(error.hint).toBe('Check the field value');
    });

    it('should create ApiError with minimal properties', () => {
      const error = new ApiError('Simple error');

      expect(error.message).toBe('Simple error');
      expect(error.code).toBeUndefined();
      expect(error.details).toBeUndefined();
      expect(error.hint).toBeUndefined();
    });
  });

  describe('error handling edge cases', () => {
    it('should handle null/undefined errors gracefully', async () => {
      const mockRequest = vi.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const result = await service.testHandleRequest(mockRequest);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should handle malformed error responses', async () => {
      const mockRequest = vi.fn().mockResolvedValue({
        data: null,
        error: { message: '' } // Empty message
      });

      const result = await service.testHandleRequest(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Database operation failed');
    });
  });
});