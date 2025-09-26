// Simple error logger to help Claude see runtime issues

interface ErrorLog {
  timestamp: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  url?: string;
  component?: string;
}

class ErrorLogger {
  private logs: ErrorLog[] = [];
  private maxLogs = 100;

  log(type: ErrorLog['type'], message: string, extra?: Partial<ErrorLog>) {
    const entry: ErrorLog = {
      timestamp: new Date().toISOString(),
      type,
      message,
      url: window.location.pathname,
      ...extra
    };

    this.logs.unshift(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Log to console as well
    console[type](`[${type.toUpperCase()}] ${message}`, extra);

    // Store in localStorage for persistence
    this.saveLogs();
  }

  error(message: string, error?: Error) {
    this.log('error', message, {
      stack: error?.stack,
      component: this.getCurrentComponent()
    });
  }

  warning(message: string, extra?: any) {
    this.log('warning', message, extra);
  }

  info(message: string, extra?: any) {
    this.log('info', message, extra);
  }

  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  getLogsAsText(): string {
    return this.logs.map(log =>
      `[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message} (${log.url})`
    ).join('\n');
  }

  private getCurrentComponent(): string {
    const stack = new Error().stack || '';
    const match = stack.match(/at (\w+)\s+/);
    return match?.[1] || 'Unknown';
  }

  private saveLogs() {
    try {
      localStorage.setItem('claude-debug-logs', JSON.stringify(this.logs));
    } catch (e) {
      // Ignore storage errors
    }
  }

  private loadLogs() {
    try {
      const saved = localStorage.getItem('claude-debug-logs');
      if (saved) {
        this.logs = JSON.parse(saved);
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  clearLogs() {
    this.logs = [];
    localStorage.removeItem('claude-debug-logs');
  }

  constructor() {
    this.loadLogs();

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.error(`Unhandled Error: ${event.message}`, event.error);
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error(`Unhandled Promise Rejection: ${event.reason}`);
    });
  }
}

export const logger = new ErrorLogger();

// Global access for debugging
declare global {
  interface Window {
    claudeLogger: ErrorLogger;
  }
}

window.claudeLogger = logger;