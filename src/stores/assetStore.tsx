/**
 * Asset Store
 * 
 * Manages selected assets for scoring across the application
 */

import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AtlanAsset } from '../services/atlan/types';

interface AssetStoreContextType {
  selectedAssets: AtlanAsset[];
  addAsset: (asset: AtlanAsset) => void;
  removeAsset: (guid: string) => void;
  toggleAsset: (asset: AtlanAsset) => void;
  clearAssets: () => void;
  setAssets: (assets: AtlanAsset[]) => void;
  isSelected: (guid: string) => boolean;
  selectedCount: number;
}

const AssetStoreContext = createContext<AssetStoreContextType | undefined>(undefined);

export function AssetStoreProvider({ children }: { children: ReactNode }) {
  const [selectedAssets, setSelectedAssets] = useState<AtlanAsset[]>([]);

  const addAsset = useCallback((asset: AtlanAsset) => {
    setSelectedAssets((prev) => {
      if (prev.some((a) => a.guid === asset.guid)) {
        return prev;
      }
      return [...prev, asset];
    });
  }, []);

  const removeAsset = useCallback((guid: string) => {
    setSelectedAssets((prev) => prev.filter((a) => a.guid !== guid));
  }, []);

  const toggleAsset = useCallback((asset: AtlanAsset) => {
    setSelectedAssets((prev) => {
      const exists = prev.some((a) => a.guid === asset.guid);
      if (exists) {
        return prev.filter((a) => a.guid !== asset.guid);
      }
      return [...prev, asset];
    });
  }, []);

  const clearAssets = useCallback(() => {
    setSelectedAssets([]);
  }, []);

  const setAssets = useCallback((assets: AtlanAsset[]) => {
    setSelectedAssets(assets);
  }, []);

  const isSelected = useCallback(
    (guid: string) => {
      return selectedAssets.some((a) => a.guid === guid);
    },
    [selectedAssets]
  );

  const value: AssetStoreContextType = {
    selectedAssets,
    addAsset,
    removeAsset,
    toggleAsset,
    clearAssets,
    setAssets,
    isSelected,
    selectedCount: selectedAssets.length,
  };

  return <AssetStoreContext.Provider value={value}>{children}</AssetStoreContext.Provider>;
}

export function useAssetStore() {
  const context = useContext(AssetStoreContext);
  if (context === undefined) {
    throw new Error('useAssetStore must be used within an AssetStoreProvider');
  }
  return context;
}

