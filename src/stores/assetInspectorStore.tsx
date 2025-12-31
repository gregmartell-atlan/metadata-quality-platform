/**
 * Asset Inspector Store
 *
 * Manages state for the asset detail inspector modal.
 * Global access allows opening inspector from any component.
 */

import { create } from 'zustand';
import type { AtlanAsset } from '../services/atlan/types';

export type InspectorTab = 'overview' | 'governance' | 'activity' | 'quality' | 'lineage' | 'documentation' | 'metadata';

interface AssetInspectorState {
  isOpen: boolean;
  currentAsset: AtlanAsset | null;
  currentTab: InspectorTab;

  openInspector: (asset: AtlanAsset, tab?: InspectorTab) => void;
  closeInspector: () => void;
  setTab: (tab: InspectorTab) => void;
}

export const useAssetInspectorStore = create<AssetInspectorState>((set) => ({
  isOpen: false,
  currentAsset: null,
  currentTab: 'overview',

  openInspector: (asset, tab = 'overview') =>
    set({
      isOpen: true,
      currentAsset: asset,
      currentTab: tab,
    }),

  closeInspector: () =>
    set({
      isOpen: false,
      currentAsset: null,
      currentTab: 'overview',
    }),

  setTab: (tab) =>
    set({
      currentTab: tab,
    }),
}));
