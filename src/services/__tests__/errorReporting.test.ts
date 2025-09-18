import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { errorReportingService } from '../errorReporting';

// Mock fetch globally
global.fetch = vi.fn();

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'mock-uuid'),
  },
});

describe('ErrorReportingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    // Mock window location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000/test',
      },
      writable: true,
    });

    // Mock navigator
    Object.defineProperty(window, 'navigator', {
      value: {
        userAgent: 'Mock User Agent',
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs error to console in development mode', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

    const testError = new Error('Test error');
    const errorInfo = { componentStack: 'Component stack trace' };

    await errorReportingService.reportError(testError, errorInfo);

    expect(consoleGroupSpy).toHaveBeenCalledWith('🚨 Error Report');
    expect(consoleSpy).toHaveBeenCalledWith('Error:', testError);
    expect(consoleSpy).toHaveBeenCalledWith('Error Info:', errorInfo);
    expect(consoleGroupEndSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    consoleGroupSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
  });

  it('generates session ID and stores it', async () => {
    const testError = new Error('Test error');

    await errorReportingService.reportError(testError);

    // Session ID should be generated and stored
    expect(sessionStorage.getItem('error-session-id')).toBe('mock-uuid');
  });

  it('reuses existing session ID', async () => {
    // Set existing session ID
    sessionStorage.setItem('error-session-id', 'existing-session-id');

    const testError = new Error('Test error');
    await errorReportingService.reportError(testError);

    // Should not generate new UUID
    expect(crypto.randomUUID).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('error-session-id')).toBe('existing-session-id');
  });

  it('creates error report with correct structure', () => {
    const testError = new Error('Test error message');
    testError.stack = 'Error stack trace';

    const errorInfo = {
      componentStack: 'Component stack trace'
    };

    // We can't directly test the private method, but we can verify the structure
    // by checking what gets logged in development mode
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorReportingService.reportError(testError, errorInfo, 'test-user-id');

    // Verify the error report structure was logged
    const loggedReport = consoleSpy.mock.calls.find(call =>
      call[0] === 'Report:' && typeof call[1] === 'object'
    );

    expect(loggedReport).toBeTruthy();
    if (loggedReport) {
      const report = loggedReport[1];
      expect(report).toMatchObject({
        message: 'Test error message',
        stack: 'Error stack trace',
        componentStack: 'Component stack trace',
        url: 'http://localhost:3000/test',
        userAgent: 'Mock User Agent',
        userId: 'test-user-id',
        sessionId: 'mock-uuid',
        timestamp: expect.any(String),
      });
    }

    consoleSpy.mockRestore();
  });
});