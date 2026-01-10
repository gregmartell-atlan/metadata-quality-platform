/**
 * pageActionsStore - Manages page-specific actions displayed in the header
 *
 * Pages register their actions on mount, and the UnifiedHeader renders them.
 * This allows contextual actions without prop drilling or separate toolbars.
 */

import { create } from 'zustand';
import type { ReactNode } from 'react';

export interface PageAction {
  id: string;
  icon: ReactNode;
  label?: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  badge?: number | boolean;
  variant?: 'ghost' | 'primary' | 'danger';
  group?: 'view' | 'capture' | 'export' | 'settings';
}

interface PageActionsState {
  // Current page actions
  actions: PageAction[];

  // Page subtitle/breadcrumb (optional)
  pageSubtitle: string | null;

  // Last updated timestamp
  lastUpdated: Date | null;

  // Actions
  setActions: (actions: PageAction[]) => void;
  addAction: (action: PageAction) => void;
  removeAction: (id: string) => void;
  updateAction: (id: string, updates: Partial<PageAction>) => void;
  clearActions: () => void;
  setPageSubtitle: (subtitle: string | null) => void;
  setLastUpdated: (date: Date | null) => void;
}

export const usePageActionsStore = create<PageActionsState>((set) => ({
  actions: [],
  pageSubtitle: null,
  lastUpdated: null,

  setActions: (actions) => set({ actions }),

  addAction: (action) => set((state) => ({
    actions: [...state.actions.filter(a => a.id !== action.id), action]
  })),

  removeAction: (id) => set((state) => ({
    actions: state.actions.filter(a => a.id !== id)
  })),

  updateAction: (id, updates) => set((state) => ({
    actions: state.actions.map(a => a.id === id ? { ...a, ...updates } : a)
  })),

  clearActions: () => set({ actions: [], pageSubtitle: null, lastUpdated: null }),

  setPageSubtitle: (pageSubtitle) => set({ pageSubtitle }),

  setLastUpdated: (lastUpdated) => set({ lastUpdated }),
}));

/**
 * Hook for pages to register their actions
 * Automatically clears on unmount
 */
export function usePageActions(actions: PageAction[], deps: unknown[] = []) {
  const { setActions, clearActions } = usePageActionsStore();

  // This is meant to be used with useEffect in the consuming component
  return { setActions, clearActions };
}
