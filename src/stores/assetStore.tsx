/**
 * Asset Store
 * 
 * Manages selected assets for scoring across the application
 * Converted to Zustand for consistency with other stores
 */

import { create } from 'zustand';
import type React from 'react';
import type { AtlanAsset } from '../services/atlan/types';

interface AssetStoreState {
  selectedAssets: AtlanAsset[];
  addAsset: (asset: AtlanAsset) => void;
  removeAsset: (guid: string) => void;
  toggleAsset: (asset: AtlanAsset) => void;
  clearAssets: () => void;
  setAssets: (assets: AtlanAsset[]) => void;
  isSelected: (guid: string) => boolean;
  selectedCount: number;
}

export const useAssetStore = create<AssetStoreState>((set, get) => ({
  selectedAssets: [],

  addAsset: (asset) => {
    set((state) => {
      if (state.selectedAssets.some((a) => a.guid === asset.guid)) {
        return state; // Already selected
      }
      const newAssets = [...state.selectedAssets, asset];
      return { selectedAssets: newAssets, selectedCount: newAssets.length };
    });
  },

  removeAsset: (guid) => {
    set((state) => {
      const newAssets = state.selectedAssets.filter((a) => a.guid !== guid);
      return { selectedAssets: newAssets, selectedCount: newAssets.length };
    });
  },

  toggleAsset: (asset) => {
    set((state) => {
      const exists = state.selectedAssets.some((a) => a.guid === asset.guid);
      const newAssets = exists
        ? state.selectedAssets.filter((a) => a.guid !== asset.guid)
        : [...state.selectedAssets, asset];
      return { selectedAssets: newAssets, selectedCount: newAssets.length };
    });
  },

  clearAssets: () => {
    set({ selectedAssets: [], selectedCount: 0 });
  },

  setAssets: (assets) => {
    set({ selectedAssets: assets, selectedCount: assets.length });
  },

  isSelected: (guid) => {
    return get().selectedAssets.some((a) => a.guid === guid);
  },

  selectedCount: 0,
}));

// Legacy provider for backward compatibility (deprecated - use useAssetStore directly)
export function AssetStoreProvider({ children }: { children: React.ReactNode }) {
  // This is now a no-op wrapper - components should use useAssetStore directly
  return <>{children}</>;
}

