/**
 * Asset Context Subscription Tracker
 * 
 * Tracks all component subscriptions to the asset context store to ensure
 * proper wiring and detect subscription issues.
 */

import { logger } from './logger';

export interface SubscriptionInfo {
  componentName: string;
  subscribedAt: number;
  lastUpdateAt: number;
  updateCount: number;
  subscribedFields: string[];
  renderCount: number;
}

class AssetContextSubscriptionTracker {
  private subscriptions = new Map<string, SubscriptionInfo>();
  private updateHistory: Array<{
    timestamp: number;
    action: string;
    componentName?: string;
    details: any;
  }> = [];
  private maxHistorySize = 1000;

  /**
   * Register a component subscription
   */
  registerSubscription(
    componentName: string,
    subscribedFields: string[]
  ): string {
    const subscriptionId = `${componentName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const info: SubscriptionInfo = {
      componentName,
      subscribedAt: performance.now(),
      lastUpdateAt: performance.now(),
      updateCount: 0,
      subscribedFields,
      renderCount: 0,
    };

    this.subscriptions.set(subscriptionId, info);
    
    logger.info('[SubscriptionTracker] Component subscribed', {
      subscriptionId,
      componentName,
      subscribedFields,
      totalSubscriptions: this.subscriptions.size,
    });

    this.addToHistory('subscription', componentName, {
      subscriptionId,
      subscribedFields,
    });

    return subscriptionId;
  }

  /**
   * Record a component update/render
   */
  recordUpdate(subscriptionId: string, fieldsChanged?: string[]): void {
    const info = this.subscriptions.get(subscriptionId);
    if (!info) {
      logger.warn('[SubscriptionTracker] Update recorded for unknown subscription', {
        subscriptionId,
      });
      return;
    }

    info.lastUpdateAt = performance.now();
    info.updateCount++;
    info.renderCount++;

    logger.debug('[SubscriptionTracker] Component updated', {
      subscriptionId,
      componentName: info.componentName,
      updateCount: info.updateCount,
      fieldsChanged,
      timeSinceLastUpdate: info.lastUpdateAt - (info.lastUpdateAt - performance.now()),
    });

    this.addToHistory('update', info.componentName, {
      subscriptionId,
      fieldsChanged,
      updateCount: info.updateCount,
    });
  }

  /**
   * Record a component render (without state change)
   */
  recordRender(subscriptionId: string): void {
    const info = this.subscriptions.get(subscriptionId);
    if (info) {
      info.renderCount++;
    }
  }

  /**
   * Unregister a subscription
   */
  unregisterSubscription(subscriptionId: string): void {
    const info = this.subscriptions.get(subscriptionId);
    if (info) {
      logger.info('[SubscriptionTracker] Component unsubscribed', {
        subscriptionId,
        componentName: info.componentName,
        totalUpdates: info.updateCount,
        totalRenders: info.renderCount,
        lifetime: performance.now() - info.subscribedAt,
      });

      this.addToHistory('unsubscription', info.componentName, {
        subscriptionId,
        lifetime: performance.now() - info.subscribedAt,
        totalUpdates: info.updateCount,
      });

      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): SubscriptionInfo[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get subscription statistics
   */
  getStatistics(): {
    totalSubscriptions: number;
    components: Record<string, {
      count: number;
      totalUpdates: number;
      totalRenders: number;
      avgUpdateInterval: number;
    }>;
    mostActiveComponent: string | null;
    leastActiveComponent: string | null;
  } {
    const components: Record<string, {
      count: number;
      totalUpdates: number;
      totalRenders: number;
      updateIntervals: number[];
    }> = {};

    let mostActive: { name: string; updates: number } | null = null;
    let leastActive: { name: string; updates: number } | null = null;

    this.subscriptions.forEach((info) => {
      if (!components[info.componentName]) {
        components[info.componentName] = {
          count: 0,
          totalUpdates: 0,
          totalRenders: 0,
          updateIntervals: [],
        };
      }

      const comp = components[info.componentName];
      comp.count++;
      comp.totalUpdates += info.updateCount;
      comp.totalRenders += info.renderCount;

      if (info.updateCount > 0) {
        const interval = (info.lastUpdateAt - info.subscribedAt) / info.updateCount;
        comp.updateIntervals.push(interval);
      }

      if (!mostActive || info.updateCount > mostActive.updates) {
        mostActive = { name: info.componentName, updates: info.updateCount };
      }

      if (!leastActive || info.updateCount < leastActive.updates) {
        leastActive = { name: info.componentName, updates: info.updateCount };
      }
    });

    const stats = {
      totalSubscriptions: this.subscriptions.size,
      components: Object.fromEntries(
        Object.entries(components).map(([name, data]) => [
          name,
          {
            count: data.count,
            totalUpdates: data.totalUpdates,
            totalRenders: data.totalRenders,
            avgUpdateInterval: data.updateIntervals.length > 0
              ? data.updateIntervals.reduce((a, b) => a + b, 0) / data.updateIntervals.length
              : 0,
          },
        ])
      ),
      mostActiveComponent: (mostActive as { name: string; updates: number } | null)?.name ?? null,
      leastActiveComponent: (leastActive as { name: string; updates: number } | null)?.name ?? null,
    };

    return stats;
  }

  /**
   * Get update history
   */
  getHistory(limit?: number): typeof this.updateHistory {
    const history = [...this.updateHistory];
    if (limit) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * Check for potential issues
   */
  diagnose(): {
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

    const stats = this.getStatistics();

    // Check for components with no updates
    Object.entries(stats.components).forEach(([name, data]) => {
      if (data.totalUpdates === 0 && data.count > 0) {
        issues.push({
          severity: 'warning',
          message: `Component "${name}" subscribed but never received updates`,
          details: { componentName: name, subscriptionCount: data.count },
        });
        recommendations.push(
          `Check if "${name}" is properly subscribing to contextAssets or other reactive fields`
        );
      }
    });

    // Check for components with excessive updates
    Object.entries(stats.components).forEach(([name, data]) => {
      if (data.avgUpdateInterval < 10 && data.totalUpdates > 100) {
        issues.push({
          severity: 'warning',
          message: `Component "${name}" has very frequent updates (potential performance issue)`,
          details: {
            componentName: name,
            totalUpdates: data.totalUpdates,
            avgInterval: data.avgUpdateInterval,
          },
        });
        recommendations.push(
          `Consider memoizing "${name}" or reducing subscription scope`
        );
      }
    });

    // Check for orphaned subscriptions
    const now = performance.now();
    this.subscriptions.forEach((info, id) => {
      const timeSinceLastUpdate = now - info.lastUpdateAt;
      if (timeSinceLastUpdate > 60000 && info.updateCount === 0) {
        issues.push({
          severity: 'info',
          message: `Subscription "${info.componentName}" has been inactive for ${Math.round(timeSinceLastUpdate / 1000)}s`,
          details: {
            subscriptionId: id,
            componentName: info.componentName,
            inactiveTime: timeSinceLastUpdate,
          },
        });
      }
    });

    return { issues, recommendations };
  }

  /**
   * Clear all subscriptions (for testing)
   */
  clear(): void {
    this.subscriptions.clear();
    this.updateHistory = [];
  }

  private addToHistory(
    action: string,
    componentName?: string,
    details?: any
  ): void {
    this.updateHistory.push({
      timestamp: performance.now(),
      action,
      componentName,
      details: details || {},
    });

    if (this.updateHistory.length > this.maxHistorySize) {
      this.updateHistory.shift();
    }
  }
}

// Singleton instance
export const subscriptionTracker = new AssetContextSubscriptionTracker();

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).__assetContextSubscriptionTracker = subscriptionTracker;
}






