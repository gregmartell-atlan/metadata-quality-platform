/**
 * Asset Context Component Verifier
 * 
 * Runtime verification utility to ensure all components are properly
 * subscribed to asset context and update correctly.
 */

import { useEffect, useRef } from 'react';
import { useAssetContextStore } from '../stores/assetContextStore';
import { subscriptionTracker } from './assetContextSubscriptionTracker';
import { performanceMonitor } from './assetContextPerformanceMonitor';
import { logger } from './logger';

export interface ComponentVerificationResult {
  componentName: string;
  isSubscribed: boolean;
  lastUpdateTime: number;
  updateCount: number;
  subscribedFields: string[];
  issues: string[];
}

class AssetContextComponentVerifier {
  private componentSubscriptions = new Map<string, ComponentVerificationResult>();
  private verificationCallbacks: Array<(results: ComponentVerificationResult[]) => void> = [];

  /**
   * Register a component for verification
   */
  registerComponent(
    componentName: string,
    subscribedFields: string[]
  ): string {
    const subscriptionId = subscriptionTracker.registerSubscription(
      componentName,
      subscribedFields
    );

    const result: ComponentVerificationResult = {
      componentName,
      isSubscribed: true,
      lastUpdateTime: performance.now(),
      updateCount: 0,
      subscribedFields,
      issues: [],
    };

    this.componentSubscriptions.set(componentName, result);

    logger.info('[ComponentVerifier] Component registered', {
      componentName,
      subscribedFields,
      subscriptionId,
    });

    return subscriptionId;
  }

  /**
   * Record component update
   */
  recordUpdate(componentName: string, fieldsChanged?: string[]): void {
    const result = this.componentSubscriptions.get(componentName);
    if (result) {
      result.lastUpdateTime = performance.now();
      result.updateCount++;
      result.isSubscribed = true;

      // Check for issues
      if (fieldsChanged && fieldsChanged.length > 0) {
        const unexpectedFields = fieldsChanged.filter(
          (field) => !result.subscribedFields.includes(field)
        );
        if (unexpectedFields.length > 0) {
          result.issues.push(
            `Unexpected field changes: ${unexpectedFields.join(', ')}`
          );
        }
      }
    }
  }

  /**
   * Verify all registered components
   */
  verifyAll(): {
    allVerified: boolean;
    results: ComponentVerificationResult[];
    issues: string[];
    recommendations: string[];
  } {
    const results = Array.from(this.componentSubscriptions.values());
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for components that haven't updated
    results.forEach((result) => {
      const timeSinceLastUpdate = performance.now() - result.lastUpdateTime;
      
      if (result.updateCount === 0 && timeSinceLastUpdate > 5000) {
        issues.push(
          `Component "${result.componentName}" has not received any updates`
        );
        recommendations.push(
          `Check if "${result.componentName}" is properly subscribing to contextAssets`
        );
      }

      if (result.issues.length > 0) {
        issues.push(...result.issues.map((issue) => `${result.componentName}: ${issue}`));
      }
    });

    // Check subscription statistics
    const stats = subscriptionTracker.getStatistics();
    if (stats.totalSubscriptions === 0) {
      issues.push('No components are subscribed to asset context');
      recommendations.push('Ensure components use useAssetContextStore hook');
    }

    // Notify callbacks
    this.verificationCallbacks.forEach((callback) => callback(results));

    return {
      allVerified: issues.length === 0,
      results,
      issues,
      recommendations,
    };
  }

  /**
   * Get verification report
   */
  getReport(): {
    components: ComponentVerificationResult[];
    subscriptionStats: ReturnType<typeof subscriptionTracker.getStatistics>;
    performanceStats: ReturnType<typeof performanceMonitor.getAllReports>;
    issues: string[];
    recommendations: string[];
  } {
    const verification = this.verifyAll();

    return {
      components: verification.results,
      subscriptionStats: subscriptionTracker.getStatistics(),
      performanceStats: performanceMonitor.getAllReports(),
      issues: verification.issues,
      recommendations: verification.recommendations,
    };
  }

  /**
   * Log verification report
   */
  logReport(): void {
    const report = this.getReport();

    logger.info('=== Asset Context Component Verification Report ===');
    logger.info('Components:', report.components);
    logger.info('Subscription Stats:', report.subscriptionStats);
    logger.info('Performance Stats:', report.performanceStats);
    
    if (report.issues.length > 0) {
      logger.warn('Issues Found:', report.issues);
    }
    
    if (report.recommendations.length > 0) {
      logger.info('Recommendations:', report.recommendations);
    }
  }

  /**
   * Register callback for verification results
   */
  onVerify(callback: (results: ComponentVerificationResult[]) => void): () => void {
    this.verificationCallbacks.push(callback);
    return () => {
      const index = this.verificationCallbacks.indexOf(callback);
      if (index > -1) {
        this.verificationCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.componentSubscriptions.clear();
    this.verificationCallbacks = [];
  }
}

// Singleton instance
export const componentVerifier = new AssetContextComponentVerifier();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).__assetContextComponentVerifier = componentVerifier;
}

/**
 * Hook to verify component subscription
 */
export function useAssetContextVerification(componentName: string, subscribedFields: string[]) {
  const subscriptionIdRef = useRef<string | null>(null);
  const { contextAssets, context } = useAssetContextStore();

  useEffect(() => {
    // Register component
    const id = componentVerifier.registerComponent(componentName, subscribedFields);
    subscriptionIdRef.current = id;

    return () => {
      if (subscriptionIdRef.current) {
        subscriptionTracker.unregisterSubscription(subscriptionIdRef.current);
      }
    };
  }, [componentName, subscribedFields]);

  useEffect(() => {
    if (subscriptionIdRef.current) {
      const fieldsChanged: string[] = [];
      if (contextAssets) fieldsChanged.push('contextAssets');
      if (context) fieldsChanged.push('context');

      componentVerifier.recordUpdate(componentName, fieldsChanged);
      subscriptionTracker.recordUpdate(subscriptionIdRef.current, fieldsChanged);
      performanceMonitor.recordRender(componentName);
    }
  }, [contextAssets, context, componentName]);

  return { contextAssets, context };
}





