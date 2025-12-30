/**
 * Monitoring and error tracking utilities
 * Ready for integration with Sentry or other error tracking services
 */

import { logger } from './logger';

// Error tracking service interface
interface ErrorTrackingService {
  captureException: (error: Error, context?: Record<string, unknown>) => void;
  captureMessage: (message: string, level?: 'info' | 'warning' | 'error', context?: Record<string, unknown>) => void;
  setUser: (user: { id?: string; email?: string; username?: string }) => void;
  setContext: (context: Record<string, unknown>) => void;
}

// Placeholder implementation - replace with actual Sentry integration
class PlaceholderErrorTracking implements ErrorTrackingService {
  captureException(error: Error, context?: Record<string, unknown>): void {
    logger.error('Error tracked (would send to Sentry)', error, context);
    // TODO: Integrate Sentry
    // Sentry.captureException(error, { extra: context });
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, unknown>): void {
    logger[level](`Message tracked (would send to Sentry): ${message}`, context);
    // TODO: Integrate Sentry
    // Sentry.captureMessage(message, { level, extra: context });
  }

  setUser(user: { id?: string; email?: string; username?: string }): void {
    logger.debug('User set (would send to Sentry)', user);
    // TODO: Integrate Sentry
    // Sentry.setUser(user);
  }

  setContext(context: Record<string, unknown>): void {
    logger.debug('Context set (would send to Sentry)', context);
    // TODO: Integrate Sentry
    // Sentry.setContext('app', context);
  }
}

// Web Vitals monitoring
interface WebVitals {
  name: string;
  value: number;
  delta: number;
  id: string;
}

function reportWebVital(metric: WebVitals): void {
  logger.info('Web Vital', {
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    id: metric.id,
  });
  
  // TODO: Send to analytics service
  // Example: analytics.track('web_vital', { name: metric.name, value: metric.value });
}

// Initialize Web Vitals monitoring
export function initWebVitals(): void {
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    try {
      // LCP - Largest Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
        const value = lastEntry.renderTime || lastEntry.loadTime || 0;
        reportWebVital({
          name: 'LCP',
          value,
          delta: value,
          id: lastEntry.name,
        });
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // FID - First Input Delay
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fidEntry = entry as PerformanceEventTiming;
          reportWebVital({
            name: 'FID',
            value: fidEntry.processingStart - fidEntry.startTime,
            delta: fidEntry.processingStart - fidEntry.startTime,
            id: entry.name,
          });
        });
      }).observe({ entryTypes: ['first-input'] });

      // CLS - Cumulative Layout Shift
      let clsValue = 0;
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        reportWebVital({
          name: 'CLS',
          value: clsValue,
          delta: clsValue,
          id: 'cls',
        });
      }).observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      logger.warn('Failed to initialize Web Vitals monitoring', error);
    }
  }
}

// Export error tracking service
export const errorTracking: ErrorTrackingService = new PlaceholderErrorTracking();

// Initialize monitoring on module load
if (typeof window !== 'undefined') {
  initWebVitals();
}


