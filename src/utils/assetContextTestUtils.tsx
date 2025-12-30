/**
 * Asset Context Test Utilities
 * 
 * Utilities for testing asset context functionality
 */

import React, { useEffect, useRef } from 'react';
import { useAssetContextStore } from '../stores/assetContextStore';
import { subscriptionTracker } from './assetContextSubscriptionTracker';
import { performanceMonitor } from './assetContextPerformanceMonitor';
import { logger } from './logger';

/**
 * Component that tracks its subscription to asset context
 */
export function SubscriptionTrackerComponent({ componentName }: { componentName: string }) {
  const subscriptionIdRef = useRef<string | null>(null);
  const { contextAssets, context } = useAssetContextStore();

  useEffect(() => {
    // Register subscription
    const id = subscriptionTracker.registerSubscription(componentName, [
      'contextAssets',
      'context',
    ]);
    subscriptionIdRef.current = id;

    return () => {
      if (subscriptionIdRef.current) {
        subscriptionTracker.unregisterSubscription(subscriptionIdRef.current);
      }
    };
  }, [componentName]);

  useEffect(() => {
    if (subscriptionIdRef.current) {
      subscriptionTracker.recordUpdate(subscriptionIdRef.current, ['contextAssets', 'context']);
      performanceMonitor.recordRender(componentName);
    }
  }, [contextAssets, context, componentName]);

  return null;
}

/**
 * Hook to track component subscription
 */
export function useAssetContextSubscription(componentName: string) {
  const subscriptionIdRef = useRef<string | null>(null);
  const { contextAssets, context } = useAssetContextStore();

  useEffect(() => {
    const id = subscriptionTracker.registerSubscription(componentName, [
      'contextAssets',
      'context',
    ]);
    subscriptionIdRef.current = id;

    return () => {
      if (subscriptionIdRef.current) {
        subscriptionTracker.unregisterSubscription(subscriptionIdRef.current);
      }
    };
  }, [componentName]);

  useEffect(() => {
    if (subscriptionIdRef.current) {
      subscriptionTracker.recordUpdate(subscriptionIdRef.current, ['contextAssets', 'context']);
      performanceMonitor.recordRender(componentName);
    }
  }, [contextAssets, context, componentName]);

  return { contextAssets, context };
}

/**
 * Test component that verifies calculations update
 */
export function CalculationVerifier({ onCalculate }: { onCalculate: (count: number) => void }) {
  const { contextAssets } = useAssetContextStore();
  const prevCountRef = useRef(0);

  useEffect(() => {
    const currentCount = contextAssets.length;
    if (currentCount !== prevCountRef.current) {
      const operationId = performanceMonitor.startOperation('calculation', {
        component: 'CalculationVerifier',
        assetCount: currentCount,
      });

      // Simulate calculation
      const result = contextAssets.reduce((sum) => sum + 1, 0);
      onCalculate(result);

      performanceMonitor.endOperation(operationId, { result });

      prevCountRef.current = currentCount;
    }
  }, [contextAssets, onCalculate]);

  return null;
}

/**
 * Get comprehensive test report
 */
export function getAssetContextTestReport(): {
  subscriptions: ReturnType<typeof subscriptionTracker.getStatistics>;
  performance: ReturnType<typeof performanceMonitor.getAllReports>;
  renderStats: ReturnType<typeof performanceMonitor.getRenderStatistics>;
  calculationSummary: ReturnType<typeof performanceMonitor.getCalculationSummary>;
  subscriptionDiagnosis: ReturnType<typeof subscriptionTracker.diagnose>;
  performanceDiagnosis: ReturnType<typeof performanceMonitor.diagnosePerformance>;
} {
  return {
    subscriptions: subscriptionTracker.getStatistics(),
    performance: performanceMonitor.getAllReports(),
    renderStats: performanceMonitor.getRenderStatistics(),
    calculationSummary: performanceMonitor.getCalculationSummary(),
    subscriptionDiagnosis: subscriptionTracker.diagnose(),
    performanceDiagnosis: performanceMonitor.diagnosePerformance(),
  };
}

/**
 * Log comprehensive test report
 */
export function logAssetContextTestReport(): void {
  const report = getAssetContextTestReport();

  logger.info('=== Asset Context Test Report ===');
  logger.info('Subscriptions:', report.subscriptions);
  logger.info('Performance Reports:', report.performance);
  logger.info('Render Statistics:', report.renderStats);
  logger.info('Calculation Summary:', report.calculationSummary);
  logger.info('Subscription Issues:', report.subscriptionDiagnosis.issues);
  logger.info('Performance Issues:', report.performanceDiagnosis.issues);
  logger.info('Recommendations:', [
    ...report.subscriptionDiagnosis.recommendations,
    ...report.performanceDiagnosis.recommendations,
  ]);
}





