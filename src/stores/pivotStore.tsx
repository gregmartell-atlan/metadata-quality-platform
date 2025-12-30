/**
 * Pivot Store
 * 
 * Manages pivot views and hierarchy configurations for the pivot builder
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AtlanAsset } from '../services/atlan/types';

export interface PivotHierarchyNode {
  id: string;
  label: string;
  level: 'connection' | 'database' | 'schema' | 'type' | 'asset';
  type?: string; // Asset type for type level
  connectionName?: string;
  databaseName?: string;
  schemaName?: string;
  children: PivotHierarchyNode[];
  assetGuids: string[]; // GUIDs of assets in this node
  assetCount: number;
  metadata?: {
    completeness?: number;
    accuracy?: number;
    timeliness?: number;
    consistency?: number;
    usability?: number;
    overall?: number;
  };
}

export interface PivotView {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  hierarchy: PivotHierarchyNode;
  config: {
    rowDimensions: string[]; // e.g., ['connection', 'type']
    columnDimensions?: string[];
    measures: string[]; // e.g., ['assetCount', 'completeness', 'accuracy']
  };
}

interface PivotState {
  views: PivotView[];
  currentViewId: string | null;
  addView: (view: Omit<PivotView, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateView: (id: string, updates: Partial<PivotView>) => void;
  deleteView: (id: string) => void;
  setCurrentView: (id: string | null) => void;
  getCurrentView: () => PivotView | null;
}

export const usePivotStore = create<PivotState>()(
  persist(
    (set, get) => ({
      views: [],
      currentViewId: null,

      addView: (viewData) => {
        const id = `pivot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        const view: PivotView = {
          ...viewData,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          views: [...state.views, view],
          currentViewId: id,
        }));
        return id;
      },

      updateView: (id, updates) => {
        set((state) => ({
          views: state.views.map((view) =>
            view.id === id
              ? { ...view, ...updates, updatedAt: new Date().toISOString() }
              : view
          ),
        }));
      },

      deleteView: (id) => {
        set((state) => ({
          views: state.views.filter((view) => view.id !== id),
          currentViewId: state.currentViewId === id ? null : state.currentViewId,
        }));
      },

      setCurrentView: (id) => {
        set({ currentViewId: id });
      },

      getCurrentView: () => {
        const state = get();
        if (!state.currentViewId) return null;
        return state.views.find((view) => view.id === state.currentViewId) || null;
      },
    }),
    {
      name: 'pivot-store',
    }
  )
);







