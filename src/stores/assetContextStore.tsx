/**
 * Asset Context Store
 * 
 * Global store that manages asset context across all views.
 * Context can be set via drag/drop or manual selection, and all views
 * automatically filter to show assets matching the current context.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AtlanAsset } from '../services/atlan/types';

export type AssetContextType = 'all' | 'connection' | 'database' | 'schema' | 'table' | 'manual';

export interface AssetContextFilters {
  connectionName?: string;
  databaseName?: string;
  schemaName?: string;
  tableName?: string;
  assetGuid?: string;
}

export interface AssetContext {
  type: AssetContextType;
  filters: AssetContextFilters;
  label: string; // Human-readable label (e.g., "All Assets", "Snowflake > WideWorldImporters")
  assetCount: number;
  lastUpdated: string;
}

interface AssetContextState {
  context: AssetContext | null;
  contextAssets: AtlanAsset[]; // Computed assets matching current context
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setContext: (type: AssetContextType, filters: AssetContextFilters, label: string, assets: AtlanAsset[]) => void;
  setAllAssets: (assets: AtlanAsset[]) => void;
  setContextAssets: (assets: AtlanAsset[]) => void;
  clearContext: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Computed getters
  getContextAssets: () => AtlanAsset[];
  getContextLabel: () => string;
  getAssetCount: () => number;
}

const defaultContext: AssetContext = {
  type: 'manual',
  filters: {},
  label: 'No context set',
  assetCount: 0,
  lastUpdated: new Date().toISOString(),
};

export const useAssetContextStore = create<AssetContextState>()(
  persist(
    (set, get) => ({
      context: null,
      contextAssets: [],
      isLoading: false,
      error: null,

      setContext: (type, filters, label, assets) => {
        console.log('[AssetContextStore] setContext called', {
          type,
          filters,
          label,
          assetCount: assets.length,
          firstAsset: assets[0] ? { guid: assets[0].guid, name: assets[0].name } : null
        });
        
        // Warn if setting non-manual context with empty assets (should be loaded elsewhere)
        if (type !== 'manual' && assets.length === 0) {
          console.warn('[AssetContextStore] Setting non-manual context with empty assets. Assets should be loaded via AssetContext component reload effect.', {
            type,
            filters,
            label
          });
        }
        
        set({
          context: {
            type,
            filters,
            label,
            assetCount: assets.length,
            lastUpdated: new Date().toISOString(),
          },
          contextAssets: assets,
          error: null,
        });
        console.log('[AssetContextStore] Context set, current state:', {
          contextType: get().context?.type,
          contextLabel: get().context?.label,
          contextAssetsCount: get().contextAssets.length
        });
      },

      setAllAssets: (assets) => {
        set({
          context: {
            type: 'all',
            filters: {},
            label: 'All Assets',
            assetCount: assets.length,
            lastUpdated: new Date().toISOString(),
          },
          contextAssets: assets,
          error: null,
        });
      },

      setContextAssets: (assets) => {
        const context = get().context;
        if (context) {
          set({
            context: {
              ...context,
              assetCount: assets.length,
              lastUpdated: new Date().toISOString(),
            },
            contextAssets: assets,
          });
        } else {
          set({ contextAssets: assets });
        }
      },

      clearContext: () => {
        set({
          context: null,
          contextAssets: [],
          error: null,
        });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setError: (error) => {
        set({ error });
      },

      getContextAssets: () => {
        const assets = get().contextAssets;
        console.log('[AssetContextStore] getContextAssets called', {
          assetCount: assets.length,
          contextType: get().context?.type,
          contextLabel: get().context?.label
        });
        return assets;
      },

      getContextLabel: () => {
        const context = get().context;
        return context?.label || 'No context set';
      },

      getAssetCount: () => {
        const context = get().context;
        return context?.assetCount || 0;
      },
    }),
    {
      name: 'asset-context-storage',
      partialize: (state) => ({
        context: state.context,
        // Don't persist assets - they'll be reloaded based on context
      }),
    }
  )
);

