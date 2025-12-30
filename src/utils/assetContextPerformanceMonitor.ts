/**
 * Asset Context Performance Monitor
 * 
 * Monitors performance of asset context operations including:
 * - Store updates
 * - Component re-renders
 * - Calculation times
 * - Memory usage
 */

import { logger } from './logger';

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  operation: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p50: number;
  p95: number;
  p99: number;
}

class AssetContextPerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 10000;
  private operationStartTimes = new Map<string, number>();
  private renderCounts = new Map<string, number>();
  private calculationTimes: number[] = [];

  /**
   * Start timing an operation
   */
  startOperation(operation: string, metadata?: Record<string, any>): string {
    const operationId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    
    this.operationStartTimes.set(operationId, startTime);
    
    logger.debug('[PerformanceMonitor] Operation started', {
      operationId,
      operation,
      metadata,
    });

    return operationId;
  }

  /**
   * End timing an operation
   */
  endOperation(operationId: string, metadata?: Record<string, any>): number {
    const startTime = this.operationStartTimes.get(operationId);
    if (!startTime) {
      logger.warn('[PerformanceMonitor] End called for unknown operation', { operationId });
      return 0;
    }

    const duration = performance.now() - startTime;
    this.operationStartTimes.delete(operationId);

    const operation = operationId.split('-')[0];
    this.recordMetric(operation, duration, metadata);

    logger.debug('[PerformanceMonitor] Operation completed', {
      operationId,
      operation,
      duration: `${duration.toFixed(2)}ms`,
      metadata,
    });

    return duration;
  }

  /**
   * Record a metric
   */
  recordMetric(operation: string, duration: number, metadata?: Record<string, any>): void {
    this.metrics.push({
      operation,
      duration,
      timestamp: performance.now(),
      metadata,
    });

    // Keep metrics within limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Track calculation times separately
    if (operation.includes('calculation') || operation.includes('score')) {
      this.calculationTimes.push(duration);
      if (this.calculationTimes.length > 1000) {
        this.calculationTimes.shift();
      }
    }
  }

  /**
   * Record a component render
   */
  recordRender(componentName: string): void {
    const count = this.renderCounts.get(componentName) || 0;
    this.renderCounts.set(componentName, count + 1);
  }

  /**
   * Get performance report for an operation
   */
  getReport(operation: string): PerformanceReport | null {
    const operationMetrics = this.metrics.filter((m) => m.operation === operation);
    
    if (operationMetrics.length === 0) {
      return null;
    }

    const durations = operationMetrics.map((m) => m.duration).sort((a, b) => a - b);
    const totalDuration = durations.reduce((a, b) => a + b, 0);
    const avgDuration = totalDuration / durations.length;
    const minDuration = durations[0];
    const maxDuration = durations[durations.length - 1];
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];

    return {
      operation,
      count: operationMetrics.length,
      totalDuration,
      avgDuration,
      minDuration,
      maxDuration,
      p50,
      p95,
      p99,
    };
  }

  /**
   * Get all performance reports
   */
  getAllReports(): PerformanceReport[] {
    const operations = new Set(this.metrics.map((m) => m.operation));
    const reports: PerformanceReport[] = [];

    operations.forEach((operation) => {
      const report = this.getReport(operation);
      if (report) {
        reports.push(report);
      }
    });

    return reports.sort((a, b) => b.avgDuration - a.avgDuration);
  }

  /**
   * Get render statistics
   */
  getRenderStatistics(): Record<string, number> {
    return Object.fromEntries(this.renderCounts);
  }

  /**
   * Get calculation performance summary
   */
  getCalculationSummary(): {
    totalCalculations: number;
    avgTime: number;
    totalTime: number;
    slowestCalculations: PerformanceMetric[];
  } {
    const calcMetrics = this.metrics.filter(
      (m) => m.operation.includes('calculation') || m.operation.includes('score')
    );

    if (calcMetrics.length === 0) {
      return {
        totalCalculations: 0,
        avgTime: 0,
        totalTime: 0,
        slowestCalculations: [],
      };
    }

    const durations = calcMetrics.map((m) => m.duration);
    const totalTime = durations.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / durations.length;

    const slowest = [...calcMetrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      totalCalculations: calcMetrics.length,
      avgTime,
      totalTime,
      slowestCalculations: slowest,
    };
  }

  /**
   * Check for performance issues
   */
  diagnosePerformance(): {
    issues: Array<{
      severity: 'error' | 'warning' | 'info';
      message: string;
      details: any;
    }>;
    recommendations: string[];
  } {
    const issues: Array<{
      severity: 'error' | 'warning' | 'info';
      message: string;
      details: any;
    }> = [];
    const recommendations: string[] = [];

    const reports = this.getAllReports();

    // Check for slow operations
    reports.forEach((report) => {
      if (report.avgDuration > 1000) {
        issues.push({
          severity: 'error',
          message: `Operation "${report.operation}" is very slow`,
          details: {
            avgDuration: `${report.avgDuration.toFixed(2)}ms`,
            p95: `${report.p95.toFixed(2)}ms`,
            count: report.count,
          },
        });
        recommendations.push(
          `Optimize "${report.operation}" - consider memoization or lazy loading`
        );
      } else if (report.avgDuration > 100 && report.count > 10) {
        issues.push({
          severity: 'warning',
          message: `Operation "${report.operation}" may be slow`,
          details: {
            avgDuration: `${report.avgDuration.toFixed(2)}ms`,
            count: report.count,
          },
        });
      }
    });

    // Check for excessive renders
    const renderStats = this.getRenderStatistics();
    Object.entries(renderStats).forEach(([component, count]) => {
      if (count > 100) {
        issues.push({
          severity: 'warning',
          message: `Component "${component}" has rendered ${count} times`,
          details: { component, renderCount: count },
        });
        recommendations.push(
          `Review "${component}" for unnecessary re-renders - check dependencies`
        );
      }
    });

    // Check calculation performance
    const calcSummary = this.getCalculationSummary();
    if (calcSummary.avgTime > 500) {
      issues.push({
        severity: 'warning',
        message: 'Calculations are taking longer than expected',
        details: {
          avgTime: `${calcSummary.avgTime.toFixed(2)}ms`,
          totalCalculations: calcSummary.totalCalculations,
        },
      });
      recommendations.push('Consider batching calculations or using web workers');
    }

    return { issues, recommendations };
  }

  /**
   * Clear all metrics (for testing)
   */
  clear(): void {
    this.metrics = [];
    this.operationStartTimes.clear();
    this.renderCounts.clear();
    this.calculationTimes = [];
  }

  /**
   * Get memory usage estimate
   */
  getMemoryEstimate(): {
    metricsSize: number;
    estimatedTotal: number;
  } {
    // Rough estimate: each metric ~200 bytes
    const metricsSize = this.metrics.length * 200;
    return {
      metricsSize,
      estimatedTotal: metricsSize,
    };
  }
}

// Singleton instance
export const performanceMonitor = new AssetContextPerformanceMonitor();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).__assetContextPerformanceMonitor = performanceMonitor;
}
