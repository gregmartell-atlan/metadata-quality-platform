/**
 * Built-in Dashboard Templates
 * Pre-configured layouts for different use cases
 */

import type { DashboardTemplate } from '../../stores/dashboardLayoutStore';

export const builtInTemplates: DashboardTemplate[] = [
  {
    id: 'executive',
    name: 'Executive Overview',
    description: 'Comprehensive view for C-level and VPs',
    isBuiltIn: true,
    layouts: {
      lg: [
        { i: 'scorecard-1', x: 0, y: 0, w: 3, h: 2, minW: 3, minH: 2, widgetType: 'scorecard', widgetId: 'scorecard-1' },
        { i: 'stats-row-1', x: 3, y: 0, w: 9, h: 1, minW: 6, minH: 1, widgetType: 'stats-row', widgetId: 'stats-row-1' },
        { i: 'heatmap-1', x: 3, y: 1, w: 9, h: 2, minW: 6, minH: 2, widgetType: 'heatmap', widgetId: 'heatmap-1' },
        { i: 'trend-chart-1', x: 0, y: 3, w: 4, h: 2, minW: 4, minH: 2, widgetType: 'trend-chart', widgetId: 'trend-chart-1' },
        { i: 'campaigns-1', x: 4, y: 3, w: 4, h: 2, minW: 3, minH: 2, widgetType: 'campaigns', widgetId: 'campaigns-1' },
        { i: 'tasks-1', x: 8, y: 3, w: 4, h: 2, minW: 3, minH: 2, widgetType: 'tasks', widgetId: 'tasks-1' },
        { i: 'owner-pivot-1', x: 0, y: 5, w: 12, h: 2, minW: 8, minH: 2, widgetType: 'owner-pivot', widgetId: 'owner-pivot-1' },
        { i: 'accountability-1', x: 0, y: 7, w: 6, h: 2, minW: 4, minH: 2, widgetType: 'accountability', widgetId: 'accountability-1' }
      ],
      md: [
        { i: 'scorecard-1', x: 0, y: 0, w: 6, h: 2, widgetType: 'scorecard', widgetId: 'scorecard-1' },
        { i: 'stats-row-1', x: 6, y: 0, w: 6, h: 1, widgetType: 'stats-row', widgetId: 'stats-row-1' },
        { i: 'heatmap-1', x: 0, y: 2, w: 12, h: 2, widgetType: 'heatmap', widgetId: 'heatmap-1' },
        { i: 'trend-chart-1', x: 0, y: 4, w: 6, h: 2, widgetType: 'trend-chart', widgetId: 'trend-chart-1' },
        { i: 'campaigns-1', x: 6, y: 4, w: 6, h: 2, widgetType: 'campaigns', widgetId: 'campaigns-1' },
        { i: 'owner-pivot-1', x: 0, y: 6, w: 12, h: 2, widgetType: 'owner-pivot', widgetId: 'owner-pivot-1' }
      ],
      sm: [
        { i: 'scorecard-1', x: 0, y: 0, w: 12, h: 2, widgetType: 'scorecard', widgetId: 'scorecard-1' },
        { i: 'stats-row-1', x: 0, y: 2, w: 12, h: 1, widgetType: 'stats-row', widgetId: 'stats-row-1' },
        { i: 'heatmap-1', x: 0, y: 3, w: 12, h: 2, widgetType: 'heatmap', widgetId: 'heatmap-1' },
        { i: 'owner-pivot-1', x: 0, y: 5, w: 12, h: 2, widgetType: 'owner-pivot', widgetId: 'owner-pivot-1' }
      ]
    }
  },

  {
    id: 'quality-focus',
    name: 'Quality Focus',
    description: 'Deep-dive into quality dimensions and trends',
    isBuiltIn: true,
    layouts: {
      lg: [
        { i: 'scorecard-1', x: 0, y: 0, w: 4, h: 2, minW: 3, minH: 2, widgetType: 'scorecard', widgetId: 'scorecard-1' },
        { i: 'data-quality-trends-1', x: 4, y: 0, w: 8, h: 2, minW: 6, minH: 2, widgetType: 'data-quality-trends', widgetId: 'data-quality-trends-1', isNew: true },
        { i: 'heatmap-1', x: 0, y: 2, w: 12, h: 2, minW: 6, minH: 2, widgetType: 'heatmap', widgetId: 'heatmap-1' },
        { i: 'asset-type-distribution-1', x: 0, y: 4, w: 4, h: 2, minW: 4, minH: 2, widgetType: 'asset-type-distribution', widgetId: 'asset-type-distribution-1', isNew: true },
        { i: 'owner-pivot-1', x: 4, y: 4, w: 8, h: 2, minW: 8, minH: 2, widgetType: 'owner-pivot', widgetId: 'owner-pivot-1' }
      ],
      md: [
        { i: 'scorecard-1', x: 0, y: 0, w: 6, h: 2, widgetType: 'scorecard', widgetId: 'scorecard-1' },
        { i: 'data-quality-trends-1', x: 6, y: 0, w: 6, h: 2, widgetType: 'data-quality-trends', widgetId: 'data-quality-trends-1' },
        { i: 'heatmap-1', x: 0, y: 2, w: 12, h: 2, widgetType: 'heatmap', widgetId: 'heatmap-1' }
      ],
      sm: [
        { i: 'scorecard-1', x: 0, y: 0, w: 12, h: 2, widgetType: 'scorecard', widgetId: 'scorecard-1' },
        { i: 'heatmap-1', x: 0, y: 2, w: 12, h: 2, widgetType: 'heatmap', widgetId: 'heatmap-1' }
      ]
    }
  },

  {
    id: 'stewardship',
    name: 'Stewardship Dashboard',
    description: 'Focus on ownership, tasks, and accountability',
    isBuiltIn: true,
    layouts: {
      lg: [
        { i: 'top-stewards-leaderboard-1', x: 0, y: 0, w: 4, h: 3, minW: 4, minH: 3, widgetType: 'top-stewards-leaderboard', widgetId: 'top-stewards-leaderboard-1', isNew: true },
        { i: 'tasks-1', x: 4, y: 0, w: 4, h: 3, minW: 3, minH: 2, widgetType: 'tasks', widgetId: 'tasks-1' },
        { i: 'campaigns-1', x: 8, y: 0, w: 4, h: 3, minW: 3, minH: 2, widgetType: 'campaigns', widgetId: 'campaigns-1' },
        { i: 'accountability-1', x: 0, y: 3, w: 6, h: 2, minW: 4, minH: 2, widgetType: 'accountability', widgetId: 'accountability-1' },
        { i: 'recent-activity-1', x: 6, y: 3, w: 6, h: 2, minW: 4, minH: 2, widgetType: 'recent-activity', widgetId: 'recent-activity-1', isNew: true },
        { i: 'owner-pivot-1', x: 0, y: 5, w: 12, h: 2, minW: 8, minH: 2, widgetType: 'owner-pivot', widgetId: 'owner-pivot-1' }
      ],
      md: [
        { i: 'top-stewards-leaderboard-1', x: 0, y: 0, w: 6, h: 3, widgetType: 'top-stewards-leaderboard', widgetId: 'top-stewards-leaderboard-1' },
        { i: 'tasks-1', x: 6, y: 0, w: 6, h: 3, widgetType: 'tasks', widgetId: 'tasks-1' },
        { i: 'owner-pivot-1', x: 0, y: 3, w: 12, h: 2, widgetType: 'owner-pivot', widgetId: 'owner-pivot-1' }
      ],
      sm: [
        { i: 'tasks-1', x: 0, y: 0, w: 12, h: 2, widgetType: 'tasks', widgetId: 'tasks-1' },
        { i: 'owner-pivot-1', x: 0, y: 2, w: 12, h: 2, widgetType: 'owner-pivot', widgetId: 'owner-pivot-1' }
      ]
    }
  },

  {
    id: 'custom',
    name: 'Blank Canvas',
    description: 'Start from scratch and add your own widgets',
    isBuiltIn: true,
    layouts: {
      lg: [
        { i: 'scorecard-1', x: 0, y: 0, w: 3, h: 2, minW: 3, minH: 2, widgetType: 'scorecard', widgetId: 'scorecard-1' }
      ],
      md: [
        { i: 'scorecard-1', x: 0, y: 0, w: 6, h: 2, widgetType: 'scorecard', widgetId: 'scorecard-1' }
      ],
      sm: [
        { i: 'scorecard-1', x: 0, y: 0, w: 12, h: 2, widgetType: 'scorecard', widgetId: 'scorecard-1' }
      ]
    }
  }
];

/**
 * Get template by ID
 */
export function getTemplateById(templateId: string): DashboardTemplate | undefined {
  return builtInTemplates.find(t => t.id === templateId);
}

/**
 * Get all templates
 */
export function getAllTemplates(): DashboardTemplate[] {
  return builtInTemplates;
}
