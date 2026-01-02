/**
 * Widget Registry System
 * Central registry for all dashboard widgets with metadata
 */

import type { ComponentType } from 'react';

/**
 * Common props all widgets receive
 */
export interface WidgetProps {
  widgetId: string;
  widgetType?: string;
  isEditMode?: boolean;
  config?: Record<string, any>;
}

/**
 * Widget metadata definition
 */
export interface WidgetMetadata {
  id: string;
  type: string;
  title: string;
  description: string;
  category: 'core' | 'analytics' | 'activity' | 'management';

  // react-grid-layout sizing (12-column grid)
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };

  // Component reference
  component: ComponentType<WidgetProps>;

  // UI
  icon?: string;
  isNew?: boolean;
  isExperimental?: boolean;
}

/**
 * Widget registry map
 */
export const widgetRegistry = new Map<string, WidgetMetadata>();

/**
 * Register a widget
 */
export function registerWidget(metadata: WidgetMetadata): void {
  console.log('[WidgetRegistry] Registering widget:', metadata.type);
  widgetRegistry.set(metadata.type, metadata);
}

/**
 * Get widget metadata by type
 */
export function getWidgetMetadata(type: string): WidgetMetadata | undefined {
  const widget = widgetRegistry.get(type);
  console.log('[WidgetRegistry] Lookup:', type, '→', widget ? 'FOUND' : 'NOT FOUND', '(registry size:', widgetRegistry.size, ')');
  return widget;
}

/**
 * Get all widgets, optionally filtered by category
 */
export function getWidgetsByCategory(category?: string): WidgetMetadata[] {
  const allWidgets = Array.from(widgetRegistry.values());

  if (!category) {
    return allWidgets;
  }

  return allWidgets.filter(w => w.category === category);
}

/**
 * Get all registered widget types
 */
export function getAllWidgetTypes(): string[] {
  return Array.from(widgetRegistry.keys());
}

/**
 * Check if widget type exists
 */
export function widgetExists(type: string): boolean {
  return widgetRegistry.has(type);
}
