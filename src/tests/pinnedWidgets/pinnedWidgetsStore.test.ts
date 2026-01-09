/**
 * Tests for Pinned Widgets Store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { usePinnedWidgetsStore } from '../../stores/pinnedWidgetsStore';

describe('PinnedWidgetsStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    usePinnedWidgetsStore.setState({
      pinnedWidgets: [],
      maxPinned: 6
    });
  });

  describe('pinWidget', () => {
    it('should pin a widget', () => {
      const { pinWidget, pinnedWidgets } = usePinnedWidgetsStore.getState();

      pinWidget('scorecard');

      const state = usePinnedWidgetsStore.getState();
      expect(state.pinnedWidgets).toHaveLength(1);
      expect(state.pinnedWidgets[0].widgetType).toBe('scorecard');
      expect(state.pinnedWidgets[0].pinnedAt).toBeGreaterThan(0);
    });

    it('should not pin the same widget twice', () => {
      const { pinWidget } = usePinnedWidgetsStore.getState();

      pinWidget('scorecard');
      pinWidget('scorecard');

      const state = usePinnedWidgetsStore.getState();
      expect(state.pinnedWidgets).toHaveLength(1);
    });

    it('should not exceed max pinned limit', () => {
      const { pinWidget } = usePinnedWidgetsStore.getState();

      // Pin 7 widgets (max is 6)
      pinWidget('widget1');
      pinWidget('widget2');
      pinWidget('widget3');
      pinWidget('widget4');
      pinWidget('widget5');
      pinWidget('widget6');
      pinWidget('widget7');

      const state = usePinnedWidgetsStore.getState();
      expect(state.pinnedWidgets).toHaveLength(6);
    });

    it('should store config with pinned widget', () => {
      const { pinWidget } = usePinnedWidgetsStore.getState();
      const config = { someOption: 'value' };

      pinWidget('scorecard', config);

      const state = usePinnedWidgetsStore.getState();
      expect(state.pinnedWidgets[0].config).toEqual(config);
    });
  });

  describe('unpinWidget', () => {
    it('should unpin a widget', () => {
      const { pinWidget, unpinWidget } = usePinnedWidgetsStore.getState();

      pinWidget('scorecard');
      pinWidget('heatmap');

      unpinWidget('scorecard');

      const state = usePinnedWidgetsStore.getState();
      expect(state.pinnedWidgets).toHaveLength(1);
      expect(state.pinnedWidgets[0].widgetType).toBe('heatmap');
    });

    it('should handle unpinning non-existent widget', () => {
      const { unpinWidget } = usePinnedWidgetsStore.getState();

      // Should not throw
      unpinWidget('nonexistent');

      const state = usePinnedWidgetsStore.getState();
      expect(state.pinnedWidgets).toHaveLength(0);
    });
  });

  describe('isPinned', () => {
    it('should return true for pinned widget', () => {
      const { pinWidget, isPinned } = usePinnedWidgetsStore.getState();

      pinWidget('scorecard');

      expect(usePinnedWidgetsStore.getState().isPinned('scorecard')).toBe(true);
    });

    it('should return false for unpinned widget', () => {
      const { isPinned } = usePinnedWidgetsStore.getState();

      expect(isPinned('scorecard')).toBe(false);
    });
  });

  describe('reorderPinned', () => {
    it('should reorder pinned widgets', () => {
      const { pinWidget, reorderPinned } = usePinnedWidgetsStore.getState();

      pinWidget('widget1');
      pinWidget('widget2');
      pinWidget('widget3');

      reorderPinned(0, 2);

      const state = usePinnedWidgetsStore.getState();
      expect(state.pinnedWidgets[0].widgetType).toBe('widget2');
      expect(state.pinnedWidgets[1].widgetType).toBe('widget3');
      expect(state.pinnedWidgets[2].widgetType).toBe('widget1');
    });
  });

  describe('clearAllPinned', () => {
    it('should clear all pinned widgets', () => {
      const { pinWidget, clearAllPinned } = usePinnedWidgetsStore.getState();

      pinWidget('widget1');
      pinWidget('widget2');
      pinWidget('widget3');

      clearAllPinned();

      const state = usePinnedWidgetsStore.getState();
      expect(state.pinnedWidgets).toHaveLength(0);
    });
  });
});
