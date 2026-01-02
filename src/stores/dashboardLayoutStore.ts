/**
 * Dashboard Layout Store
 * Manages dashboard widget layouts with template support and persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Layout } from 'react-grid-layout';
import { getWidgetMetadata } from '../components/dashboard/widgets/registry';
import { builtInTemplates } from '../config/dashboards/templates';

/**
 * Dashboard layout item (extends react-grid-layout's Layout)
 */
export interface DashboardLayoutItem extends Layout {
  widgetType: string;
  widgetId: string;
  config?: Record<string, any>;
}

/**
 * Dashboard template definition
 */
export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  layouts: {
    lg: DashboardLayoutItem[];
    md: DashboardLayoutItem[];
    sm: DashboardLayoutItem[];
  };
  thumbnail?: string;
  isBuiltIn?: boolean;
}

/**
 * Dashboard layout state
 */
interface DashboardLayoutState {
  activeTemplateId: string | null;
  currentLayouts: {
    lg: DashboardLayoutItem[];
    md: DashboardLayoutItem[];
    sm: DashboardLayoutItem[];
  };
  isEditMode: boolean;
  customTemplates: DashboardTemplate[];

  // Actions
  setActiveTemplate: (templateId: string) => void;
  updateLayout: (breakpoint: string, items: DashboardLayoutItem[]) => void;
  addWidget: (widgetType: string, breakpoint?: string) => void;
  removeWidget: (widgetId: string) => void;
  toggleEditMode: () => void;
  resetToTemplate: (templateId: string) => void;
  saveAsCustomTemplate: (name: string, description: string) => void;
  deleteCustomTemplate: (templateId: string) => void;
}

// Default empty layout
const emptyLayout = {
  lg: [],
  md: [],
  sm: []
};

// Get initial layouts from executive template
function getInitialLayouts() {
  const exec = builtInTemplates.find((t) => t.id === 'executive');
  if (exec) return JSON.parse(JSON.stringify(exec.layouts));
  return emptyLayout;
}

/**
 * Get template by ID (from built-in or custom)
 */
function getTemplateById(templateId: string, customTemplates: DashboardTemplate[]): DashboardTemplate | null {
  // Check built-in templates
  const builtIn = builtInTemplates.find((t) => t.id === templateId);
  if (builtIn) return builtIn;

  // Check custom templates
  const custom = customTemplates.find(t => t.id === templateId);
  return custom || null;
}

/**
 * Dashboard layout store with Zustand + localStorage persistence
 */
export const useDashboardLayoutStore = create<DashboardLayoutState>()(
  persist(
    (set, get) => ({
      activeTemplateId: 'executive',
      currentLayouts: getInitialLayouts(),
      isEditMode: false,
      customTemplates: [],

      setActiveTemplate: (templateId) => {
        const template = getTemplateById(templateId, get().customTemplates);
        if (template) {
          set({
            activeTemplateId: templateId,
            currentLayouts: JSON.parse(JSON.stringify(template.layouts))
          });
        }
      },

      updateLayout: (breakpoint, items) => {
        set((state) => ({
          currentLayouts: {
            ...state.currentLayouts,
            [breakpoint]: items
          }
        }));
      },

      addWidget: (widgetType, breakpoint = 'lg') => {
        const widgetId = `${widgetType}-${Date.now()}`;
        const metadata = getWidgetMetadata(widgetType);

        if (!metadata) {
          console.warn(`Widget type ${widgetType} not found in registry`);
          return;
        }

        // Find available position (bottom of current layout)
        const layouts = get().currentLayouts;
        const currentItems = layouts[breakpoint as 'lg' | 'md' | 'sm'] || layouts.lg;
        const newY = currentItems.length > 0
          ? Math.max(...currentItems.map(item => item.y + item.h))
          : 0;

        const newItem: DashboardLayoutItem = {
          i: widgetId,
          x: 0,
          y: newY,
          w: metadata.defaultSize.w,
          h: metadata.defaultSize.h,
          minW: metadata.minSize.w,
          minH: metadata.minSize.h,
          maxW: metadata.maxSize?.w,
          maxH: metadata.maxSize?.h,
          widgetType,
          widgetId
        };

        const bp = breakpoint as 'lg' | 'md' | 'sm';
        set((state) => ({
          currentLayouts: {
            ...state.currentLayouts,
            [bp]: [...(state.currentLayouts[bp] || []), newItem]
          }
        }));
      },

      removeWidget: (widgetId) => {
        set((state) => ({
          currentLayouts: {
            lg: state.currentLayouts.lg.filter(item => item.widgetId !== widgetId),
            md: state.currentLayouts.md.filter(item => item.widgetId !== widgetId),
            sm: state.currentLayouts.sm.filter(item => item.widgetId !== widgetId)
          }
        }));
      },

      toggleEditMode: () => {
        set((state) => ({ isEditMode: !state.isEditMode }));
      },

      resetToTemplate: (templateId) => {
        get().setActiveTemplate(templateId);
      },

      saveAsCustomTemplate: (name, description) => {
        const newTemplate: DashboardTemplate = {
          id: `custom-${Date.now()}`,
          name,
          description,
          layouts: JSON.parse(JSON.stringify(get().currentLayouts)),
          isBuiltIn: false
        };

        set((state) => ({
          customTemplates: [...state.customTemplates, newTemplate]
        }));
      },

      deleteCustomTemplate: (templateId) => {
        set((state) => ({
          customTemplates: state.customTemplates.filter(t => t.id !== templateId)
        }));
      }
    }),
    {
      name: 'dashboard-layout-storage',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        // Reset to default template if upgrading from v1 or layouts are empty
        if (version < 2 || !persistedState.currentLayouts?.lg?.length) {
          return {
            ...persistedState,
            currentLayouts: getInitialLayouts()
          };
        }
        return persistedState;
      },
      partialize: (state) => ({
        activeTemplateId: state.activeTemplateId,
        currentLayouts: state.currentLayouts,
        customTemplates: state.customTemplates
      })
    }
  )
);
