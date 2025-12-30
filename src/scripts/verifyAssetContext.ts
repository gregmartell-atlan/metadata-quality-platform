/**
 * Asset Context Verification Script
 * 
 * Run this script to verify all components are properly subscribed
 * to asset context. Can be run in browser console or as a test.
 */

import { componentVerifier } from '../utils/assetContextComponentVerifier';
import { subscriptionTracker } from '../utils/assetContextSubscriptionTracker';
import { performanceMonitor } from '../utils/assetContextPerformanceMonitor';
import { useAssetContextStore } from '../stores/assetContextStore';
import { logger } from '../utils/logger';

/**
 * Run comprehensive verification
 */
export function verifyAssetContext(): {
  verified: boolean;
  report: ReturnType<typeof componentVerifier.getReport>;
} {
  logger.info('Starting Asset Context Verification...');

  // Run verification
  const report = componentVerifier.getReport();
  const verified = report.issues.length === 0;

  // Log results
  componentVerifier.logReport();

  // Log subscription diagnosis
  const subscriptionDiagnosis = subscriptionTracker.diagnose();
  if (subscriptionDiagnosis.issues.length > 0) {
    logger.warn('Subscription Issues:', subscriptionDiagnosis.issues);
    logger.info('Recommendations:', subscriptionDiagnosis.recommendations);
  }

  // Log performance diagnosis
  const performanceDiagnosis = performanceMonitor.diagnosePerformance();
  if (performanceDiagnosis.issues.length > 0) {
    logger.warn('Performance Issues:', performanceDiagnosis.issues);
    logger.info('Recommendations:', performanceDiagnosis.recommendations);
  }

  if (verified) {
    logger.info('✅ Asset Context Verification PASSED');
  } else {
    logger.error('❌ Asset Context Verification FAILED');
    logger.error('Issues:', report.issues);
  }

  return { verified, report };
}

/**
 * Run performance benchmark
 */
export function benchmarkAssetContext(iterations: number = 100): {
  avgSetContext: number;
  avgSetContextAssets: number;
  avgClearContext: number;
} {
  logger.info(`Running Asset Context Performance Benchmark (${iterations} iterations)...`);

  const { setContext, setContextAssets, clearContext } = useAssetContextStore.getState();

  // Benchmark setContext
  const setContextTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    setContext('manual', {}, `Test ${i}`, [
      { guid: `guid${i}`, name: `Table${i}` } as any,
    ]);
    setContextTimes.push(performance.now() - start);
  }

  // Benchmark setContextAssets
  const setContextAssetsTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    setContextAssets([{ guid: `guid${i}`, name: `Table${i}` } as any]);
    setContextAssetsTimes.push(performance.now() - start);
  }

  // Benchmark clearContext
  const clearContextTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    setContext('manual', {}, 'Test', [{ guid: 'guid1', name: 'Table1' } as any]);
    const start = performance.now();
    clearContext();
    clearContextTimes.push(performance.now() - start);
  }

  const avgSetContext =
    setContextTimes.reduce((a, b) => a + b, 0) / setContextTimes.length;
  const avgSetContextAssets =
    setContextAssetsTimes.reduce((a, b) => a + b, 0) / setContextAssetsTimes.length;
  const avgClearContext =
    clearContextTimes.reduce((a, b) => a + b, 0) / clearContextTimes.length;

  logger.info('Performance Benchmark Results:', {
    avgSetContext: `${avgSetContext.toFixed(2)}ms`,
    avgSetContextAssets: `${avgSetContextAssets.toFixed(2)}ms`,
    avgClearContext: `${avgClearContext.toFixed(2)}ms`,
  });

  return {
    avgSetContext,
    avgSetContextAssets,
    avgClearContext,
  };
}

// Expose to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).verifyAssetContext = verifyAssetContext;
  (window as any).benchmarkAssetContext = benchmarkAssetContext;
}

