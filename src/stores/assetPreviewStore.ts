/**
 * Asset Preview Store
 *
 * Manages the state for the asset preview drawer.
 * Allows any component to trigger the preview drawer with an asset.
 */

import { create } from 'zustand';
import type { AtlanAsset } from '../services/atlan/types';

interface AssetPreviewState {
  // State
  selectedAsset: AtlanAsset | null;
  isOpen: boolean;

  // Actions
  openPreview: (asset: AtlanAsset) => void;
  closePreview: () => void;
  togglePreview: () => void;
}

export const useAssetPreviewStore = create<AssetPreviewState>((set, get) => ({
  selectedAsset: null,
  isOpen: false,

  openPreview: (asset: AtlanAsset) => {
    set({ selectedAsset: asset, isOpen: true });
  },

  closePreview: () => {
    set({ isOpen: false });
    // Delay clearing asset to allow animation to complete
    setTimeout(() => {
      set({ selectedAsset: null });
    }, 300);
  },

  togglePreview: () => {
    const { isOpen } = get();
    if (isOpen) {
      get().closePreview();
    }
  },
}));
