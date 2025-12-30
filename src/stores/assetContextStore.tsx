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
import { assetContextSync } from '../utils/crossTabSync';

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
        const newContext = {
          type,
          filters,
          label,
          assetCount: assets.length,
          lastUpdated: new Date().toISOString(),
        };
        
        set({
          context: newContext,
          contextAssets: assets,
          error: null,
        });
        
        // Broadcast to other tabs
        assetContextSync.broadcast({ context: newContext, assets }, 'context-updated');
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
          const updatedContext = {
            ...context,
            assetCount: assets.length,
            lastUpdated: new Date().toISOString(),
          };
          set({
            context: updatedContext,
            contextAssets: assets,
          });
          
          // Broadcast to other tabs
          assetContextSync.broadcast({ context: updatedContext, assets }, 'assets-updated');
        } else {
          set({ contextAssets: assets });
          assetContextSync.broadcast({ assets }, 'assets-updated');
        }
      },

      clearContext: () => {
        set({
          context: null,
          contextAssets: [],
          error: null,
        });
        
        // Broadcast to other tabs
        assetContextSync.broadcast({ context: null, assets: [] }, 'context-cleared');
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setError: (error) => {
        set({ error });
      },

      getContextAssets: () => {
        const assets = get().contextAssets;
        // Removed console.log to prevent performance issues
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
      version: 1, // Add version for future migrations
    }
  )
);

// Subscribe to cross-tab sync after store is created
if (typeof window !== 'undefined') {
  useAssetContextStore.subscribe(
    (state) => state.context,
    (context) => {
      // This will be called when context changes, but we don't want to broadcast here
      // to avoid infinite loops. Broadcasting happens in the actions.
    }
  );
  
  // Listen for cross-tab updates
  assetContextSync.subscribe((data: { context?: AssetContext | null; assets?: AtlanAsset[] }) => {
    const currentState = useAssetContextStore.getState();
    if (data.context !== undefined && data.context !== currentState.context) {
      useAssetContextStore.setState({ context: data.context });
    }
    if (data.assets !== undefined && data.assets !== currentState.contextAssets) {
      useAssetContextStore.setState({ contextAssets: data.assets });
    }
  });
}

