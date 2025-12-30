/**
 * Centralized logging utility
 * Logs are only output in development mode
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    return data ? `${prefix} ${message}` : `${prefix} ${message}`;
  }

  private addLog(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    // Keep only last N logs in memory
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Only log to console in development
    if (this.isDevelopment) {
      const formatted = this.formatMessage(level, message, data);
      switch (level) {
        case 'debug':
          console.debug(formatted, data || '');
          break;
        case 'info':
          console.info(formatted, data || '');
          break;
        case 'warn':
          console.warn(formatted, data || '');
          break;
        case 'error':
          console.error(formatted, data || '');
          break;
      }
    }

    // In production, send errors to monitoring service
    if (!this.isDevelopment && level === 'error') {
      // TODO: Send to error tracking service (Sentry, etc.)
      // Example: Sentry.captureException(new Error(message), { extra: data });
    }
  }

  debug(message: string, data?: unknown): void {
    this.addLog('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.addLog('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.addLog('warn', message, data);
  }

  error(message: string, error?: Error | unknown, data?: unknown): void {
    if (error instanceof Error) {
      this.addLog('error', message, { error: error.message, stack: error.stack, ...data });
    } else {
      this.addLog('error', message, { error, ...data });
    }
  }

  /**
   * Get recent logs (useful for debugging)
   */
  getLogs(level?: LogLevel, limit = 50): LogEntry[] {
    let filtered = this.logs;
    if (level) {
      filtered = filtered.filter((log) => log.level === level);
    }
    return filtered.slice(-limit);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
  }
}

export const logger = new Logger();

