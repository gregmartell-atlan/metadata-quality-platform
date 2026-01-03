/**
 * Pinned Widgets Store
 * Manages widgets that users want to see on the Home page
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Pinned widget definition
 */
export interface PinnedWidget {
  widgetType: string;
  pinnedAt: number;
  config?: Record<string, any>;
}

/**
 * Pinned widgets state
 */
interface PinnedWidgetsState {
  pinnedWidgets: PinnedWidget[];
  maxPinned: number;

  // Actions
  pinWidget: (widgetType: string, config?: Record<string, any>) => void;
  unpinWidget: (widgetType: string) => void;
  isPinned: (widgetType: string) => boolean;
  reorderPinned: (fromIndex: number, toIndex: number) => void;
  clearAllPinned: () => void;
}

/**
 * Pinned widgets store with localStorage persistence
 */
export const usePinnedWidgetsStore = create<PinnedWidgetsState>()(
  persist(
    (set, get) => ({
      pinnedWidgets: [],
      maxPinned: 6, // Limit to prevent cluttering home page

      pinWidget: (widgetType, config) => {
        const { pinnedWidgets, maxPinned } = get();

        // Don't pin if already pinned
        if (pinnedWidgets.some(w => w.widgetType === widgetType)) {
          return;
        }

        // Don't exceed max
        if (pinnedWidgets.length >= maxPinned) {
          console.warn(`Cannot pin more than ${maxPinned} widgets`);
          return;
        }

        set({
          pinnedWidgets: [
            ...pinnedWidgets,
            {
              widgetType,
              pinnedAt: Date.now(),
              config
            }
          ]
        });
      },

      unpinWidget: (widgetType) => {
        set((state) => ({
          pinnedWidgets: state.pinnedWidgets.filter(w => w.widgetType !== widgetType)
        }));
      },

      isPinned: (widgetType) => {
        return get().pinnedWidgets.some(w => w.widgetType === widgetType);
      },

      reorderPinned: (fromIndex, toIndex) => {
        set((state) => {
          const widgets = [...state.pinnedWidgets];
          const [removed] = widgets.splice(fromIndex, 1);
          widgets.splice(toIndex, 0, removed);
          return { pinnedWidgets: widgets };
        });
      },

      clearAllPinned: () => {
        set({ pinnedWidgets: [] });
      }
    }),
    {
      name: 'pinned-widgets-storage',
      version: 1
    }
  )
);
