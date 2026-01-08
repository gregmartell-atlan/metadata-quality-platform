/**
 * UI Preferences Store
 *
 * Manages global user interface preferences and settings that apply across all views.
 * Persisted to localStorage for consistency across sessions.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CertificationStatus = 'VERIFIED' | 'DRAFT' | 'DEPRECATED';

export interface UIPreferences {
  // Display Settings
  density: 'compact' | 'comfortable' | 'spacious';

  // Asset Browser Defaults
  defaultConnection: string | null;
  assetBrowserView: 'tree' | 'list';
  showPopularityBadges: boolean;

  // Global View Filters (applies to Exec Dashboard, Pivots, Lineage)
  globalDomainFilter: string | null;
  globalTimeRange: '7d' | '30d' | '90d' | 'all';
  globalCertificationFilter: CertificationStatus[];

  // Executive Dashboard Configuration
  dashboardHeatmapDimension: string; // 'domain' | 'owner' | 'schema' | etc.
  dashboardOwnerPivotDimension: string; // 'ownerGroup' | 'tag' | 'certificationStatus' | etc.
  dashboardOwnerPivotColumn: string; // 'completeness' | 'accuracy' | etc.

  // Pivot Builder Configuration
  pivotDefaultRowDimensions: string[]; // Default dimensions for pivot rows
  pivotDefaultMeasures: string[]; // Default measures to show
}

interface UIPreferencesActions {
  // Display
  setDensity: (density: UIPreferences['density']) => void;

  // Asset Browser
  setDefaultConnection: (connection: string | null) => void;
  setAssetBrowserView: (view: UIPreferences['assetBrowserView']) => void;
  setShowPopularityBadges: (show: boolean) => void;

  // Global Filters
  setGlobalDomainFilter: (domain: string | null) => void;
  setGlobalTimeRange: (range: UIPreferences['globalTimeRange']) => void;
  setGlobalCertificationFilter: (statuses: CertificationStatus[]) => void;

  // Dashboard Configuration
  setDashboardHeatmapDimension: (dimension: string) => void;
  setDashboardOwnerPivotDimension: (dimension: string) => void;
  setDashboardOwnerPivotColumn: (column: string) => void;

  // Pivot Configuration
  setPivotDefaultRowDimensions: (dimensions: string[]) => void;
  setPivotDefaultMeasures: (measures: string[]) => void;

  // Reset
  resetToDefaults: () => void;
}

const defaultPreferences: UIPreferences = {
  // Display
  density: 'comfortable',

  // Asset Browser
  defaultConnection: null,
  assetBrowserView: 'tree',
  showPopularityBadges: true,

  // Global Filters
  globalDomainFilter: null,
  globalTimeRange: '30d',
  globalCertificationFilter: [],

  // Dashboard
  dashboardHeatmapDimension: 'domain',
  dashboardOwnerPivotDimension: 'ownerGroup',
  dashboardOwnerPivotColumn: 'completeness',

  // Pivot
  pivotDefaultRowDimensions: ['connection', 'database'],
  pivotDefaultMeasures: ['assetCount', 'overallScore'],
};

export const useUIPreferences = create<UIPreferences & UIPreferencesActions>()(
  persist(
    (set) => ({
      ...defaultPreferences,

      // Display actions
      setDensity: (density) => set({ density }),

      // Asset Browser actions
      setDefaultConnection: (defaultConnection) => set({ defaultConnection }),
      setAssetBrowserView: (assetBrowserView) => set({ assetBrowserView }),
      setShowPopularityBadges: (showPopularityBadges) => set({ showPopularityBadges }),

      // Global Filter actions
      setGlobalDomainFilter: (globalDomainFilter) => set({ globalDomainFilter }),
      setGlobalTimeRange: (globalTimeRange) => set({ globalTimeRange }),
      setGlobalCertificationFilter: (globalCertificationFilter) => set({ globalCertificationFilter }),

      // Dashboard actions
      setDashboardHeatmapDimension: (dashboardHeatmapDimension) => set({ dashboardHeatmapDimension }),
      setDashboardOwnerPivotDimension: (dashboardOwnerPivotDimension) => set({ dashboardOwnerPivotDimension }),
      setDashboardOwnerPivotColumn: (dashboardOwnerPivotColumn) => set({ dashboardOwnerPivotColumn }),

      // Pivot actions
      setPivotDefaultRowDimensions: (pivotDefaultRowDimensions) => set({ pivotDefaultRowDimensions }),
      setPivotDefaultMeasures: (pivotDefaultMeasures) => set({ pivotDefaultMeasures }),

      // Reset
      resetToDefaults: () => set(defaultPreferences),
    }),
    {
      name: 'ui-preferences-storage',
      version: 2,
    }
  )
);
