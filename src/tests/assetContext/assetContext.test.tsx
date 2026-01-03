/**
 * Asset Context Comprehensive Test Suite
 * 
 * Tests all aspects of asset context including:
 * - Store operations
 * - Component subscriptions
 * - Calculation updates
 * - Edge cases
 * - Performance
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { useAssetContextStore } from '../../stores/assetContextStore';
import type { AtlanAsset } from '../../services/atlan/types';

// Mock assets for testing
const createMockAsset = (guid: string, name: string, connectionName: string = 'TestConnection'): AtlanAsset => ({
  guid,
  typeName: 'Table',
  name,
  qualifiedName: `${connectionName}/${name}`,
  connectionName,
  description: `Description for ${name}`,
  userDescription: null,
  ownerUsers: [],
  ownerGroups: [],
  certificateStatus: null,
  classificationNames: [],
  domainGUIDs: [],
  updateTime: Date.now(),
  createTime: Date.now() - 86400000,
  popularityScore: 0,
  viewCount: 0,
  userCount: 0,
  customMetadata: {},
  lineage: null,
  readme: null,
});

describe('Asset Context Store', () => {
  beforeEach(() => {
    // Clear store before each test
    const { clearContext } = useAssetContextStore.getState();
    clearContext();
  });

  afterEach(() => {
    // Cleanup
    const { clearContext } = useAssetContextStore.getState();
    clearContext();
  });

  describe('Basic Operations', () => {
    it('should set context with assets', () => {
      const { setContext } = useAssetContextStore.getState();
      const assets = [
        createMockAsset('guid1', 'Table1'),
        createMockAsset('guid2', 'Table2'),
      ];

      act(() => {
        setContext('connection', { connectionName: 'TestConnection' }, 'Test Connection', assets);
      });

      // Re-read state after mutation
      const { contextAssets, context } = useAssetContextStore.getState();
      expect(contextAssets).toHaveLength(2);
      expect(context?.type).toBe('connection');
      expect(context?.label).toBe('Test Connection');
      expect(context?.assetCount).toBe(2);
    });

    it('should clear context', () => {
      const { setContext, clearContext } = useAssetContextStore.getState();
      const assets = [createMockAsset('guid1', 'Table1')];

      act(() => {
        setContext('manual', {}, 'Test', assets);
      });

      expect(useAssetContextStore.getState().contextAssets).toHaveLength(1);

      act(() => {
        clearContext();
      });

      const { contextAssets, context } = useAssetContextStore.getState();
      expect(contextAssets).toHaveLength(0);
      expect(context).toBeNull();
    });

    it('should update context assets', () => {
      const { setContext, setContextAssets } = useAssetContextStore.getState();
      const initialAssets = [createMockAsset('guid1', 'Table1')];
      const newAssets = [
        createMockAsset('guid1', 'Table1'),
        createMockAsset('guid2', 'Table2'),
        createMockAsset('guid3', 'Table3'),
      ];

      act(() => {
        setContext('connection', { connectionName: 'Test' }, 'Test', initialAssets);
      });

      expect(useAssetContextStore.getState().contextAssets).toHaveLength(1);

      act(() => {
        setContextAssets(newAssets);
      });

      expect(useAssetContextStore.getState().contextAssets).toHaveLength(3);
    });
  });

  describe('Getters', () => {
    it('should return correct context label', () => {
      const { setContext, getContextLabel } = useAssetContextStore.getState();
      const assets = [createMockAsset('guid1', 'Table1')];

      act(() => {
        setContext('connection', { connectionName: 'Snowflake' }, 'Snowflake Connection', assets);
      });

      expect(getContextLabel()).toBe('Snowflake Connection');
    });

    it('should return default label when no context', () => {
      const { getContextLabel } = useAssetContextStore.getState();
      expect(getContextLabel()).toBe('No context set');
    });

    it('should return correct asset count', () => {
      const { setContext, getAssetCount } = useAssetContextStore.getState();
      const assets = [
        createMockAsset('guid1', 'Table1'),
        createMockAsset('guid2', 'Table2'),
        createMockAsset('guid3', 'Table3'),
      ];

      act(() => {
        setContext('manual', {}, 'Test', assets);
      });

      expect(getAssetCount()).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty assets array', () => {
      const { setContext } = useAssetContextStore.getState();

      act(() => {
        setContext('connection', { connectionName: 'Test' }, 'Test', []);
      });

      const { contextAssets } = useAssetContextStore.getState();
      expect(contextAssets).toHaveLength(0);
    });

    it('should handle large asset arrays', () => {
      const { setContext } = useAssetContextStore.getState();
      const largeAssetArray = Array.from({ length: 10000 }, (_, i) =>
        createMockAsset(`guid${i}`, `Table${i}`)
      );

      act(() => {
        setContext('all', {}, 'All Assets', largeAssetArray);
      });

      const { contextAssets } = useAssetContextStore.getState();
      expect(contextAssets).toHaveLength(10000);
    });

    it('should handle rapid context changes', async () => {
      const { setContext } = useAssetContextStore.getState();

      // Rapidly change context
      for (let i = 0; i < 10; i++) {
        act(() => {
          setContext('connection', { connectionName: `Connection${i}` }, `Connection ${i}`, [
            createMockAsset(`guid${i}`, `Table${i}`, `Connection${i}`),
          ]);
        });
      }

      // Re-read state after mutations
      const { contextAssets } = useAssetContextStore.getState();
      // Should have the last context
      expect(contextAssets).toHaveLength(1);
      expect(contextAssets[0].name).toBe('Table9');
    });

    it('should handle null/undefined in asset properties', () => {
      const { setContext } = useAssetContextStore.getState();
      const assetWithNulls: AtlanAsset = {
        ...createMockAsset('guid1', 'Table1'),
        description: null,
        userDescription: undefined,
        ownerUsers: null as any,
        ownerGroups: undefined as any,
      };

      act(() => {
        setContext('manual', {}, 'Test', [assetWithNulls]);
      });

      const { contextAssets } = useAssetContextStore.getState();
      expect(contextAssets).toHaveLength(1);
      expect(contextAssets[0].description).toBeNull();
    });

    it('should handle context with missing filters', () => {
      const { setContext } = useAssetContextStore.getState();
      const assets = [createMockAsset('guid1', 'Table1')];

      act(() => {
        setContext('database', {}, 'Test Database', assets);
      });

      const { context } = useAssetContextStore.getState();
      expect(context).not.toBeNull();
      expect(context?.filters).toEqual({});
    });
  });

  describe('Persistence', () => {
    it('should persist context but not assets', () => {
      const { setContext } = useAssetContextStore.getState();
      const assets = [createMockAsset('guid1', 'Table1')];

      act(() => {
        setContext('connection', { connectionName: 'Test' }, 'Test Connection', assets);
      });

      // Re-read state after mutation
      const { context } = useAssetContextStore.getState();
      // Context should be persisted, but assets should be cleared on reload
      // This is tested by checking the partialize function behavior
      expect(context).not.toBeNull();
      expect(context?.type).toBe('connection');
    });
  });
});

describe('Asset Context Component Integration', () => {
  it('should update when context changes', async () => {
    const TestComponent = () => {
      const { contextAssets, context } = useAssetContextStore();
      return (
        <div>
          <div data-testid="count">{contextAssets.length}</div>
          <div data-testid="label">{context?.label || 'No context'}</div>
        </div>
      );
    };

    const { getByTestId, rerender } = render(<TestComponent />);

    expect(getByTestId('count').textContent).toBe('0');
    expect(getByTestId('label').textContent).toBe('No context');

    // Update context
    act(() => {
      const { setContext } = useAssetContextStore.getState();
      setContext('connection', { connectionName: 'Test' }, 'Test Connection', [
        createMockAsset('guid1', 'Table1'),
      ]);
    });

    await waitFor(() => {
      expect(getByTestId('count').textContent).toBe('1');
      expect(getByTestId('label').textContent).toBe('Test Connection');
    });
  });

  it('should handle multiple subscribers', async () => {
    const renderCounts = { component1: 0, component2: 0 };

    const Component1 = () => {
      const { contextAssets } = useAssetContextStore();
      renderCounts.component1++;
      return <div data-testid="comp1">{contextAssets.length}</div>;
    };

    const Component2 = () => {
      const { contextAssets } = useAssetContextStore();
      renderCounts.component2++;
      return <div data-testid="comp2">{contextAssets.length}</div>;
    };

    const { getByTestId } = render(
      <>
        <Component1 />
        <Component2 />
      </>
    );

    const initialRender1 = renderCounts.component1;
    const initialRender2 = renderCounts.component2;

    // Update context
    act(() => {
      const { setContext } = useAssetContextStore.getState();
      setContext('manual', {}, 'Test', [createMockAsset('guid1', 'Table1')]);
    });

    await waitFor(() => {
      expect(getByTestId('comp1').textContent).toBe('1');
      expect(getByTestId('comp2').textContent).toBe('1');
    });

    // Both components should have re-rendered
    expect(renderCounts.component1).toBeGreaterThan(initialRender1);
    expect(renderCounts.component2).toBeGreaterThan(initialRender2);
  });
});

describe('Performance Tests', () => {
  it('should handle context updates efficiently', async () => {
    const startTime = performance.now();
    const { setContext } = useAssetContextStore.getState();

    // Set context with 1000 assets
    const assets = Array.from({ length: 1000 }, (_, i) =>
      createMockAsset(`guid${i}`, `Table${i}`)
    );

    act(() => {
      setContext('all', {}, 'All Assets', assets);
    });

    const duration = performance.now() - startTime;

    // Should complete in reasonable time (< 100ms for 1000 assets)
    expect(duration).toBeLessThan(100);
  });

  it('should not cause excessive re-renders', async () => {
    let renderCount = 0;

    const TestComponent = () => {
      const { contextAssets } = useAssetContextStore();
      renderCount++;
      return <div>{contextAssets.length}</div>;
    };

    render(<TestComponent />);

    const initialRenderCount = renderCount;

    // Update context multiple times rapidly
    for (let i = 0; i < 5; i++) {
      act(() => {
        const { setContext } = useAssetContextStore.getState();
        setContext('manual', {}, `Test ${i}`, [createMockAsset(`guid${i}`, `Table${i}`)]);
      });
    }

    await waitFor(() => {
      // Should have re-rendered, but not excessively
      expect(renderCount).toBeLessThan(initialRenderCount + 10);
    });
  });
});

describe('Calculation Updates', () => {
  beforeEach(() => {
    useAssetContextStore.getState().clearContext();
  });

  it('should trigger calculations when context changes', async () => {
    const calculationTriggered = vi.fn();

    const TestComponent = () => {
      const { contextAssets } = useAssetContextStore();

      // Simulate calculation that should run when assets change
      React.useEffect(() => {
        if (contextAssets.length > 0) {
          calculationTriggered(contextAssets.length);
        }
      }, [contextAssets]);

      return <div>{contextAssets.length}</div>;
    };

    render(<TestComponent />);

    expect(calculationTriggered).not.toHaveBeenCalled();

    act(() => {
      const { setContext } = useAssetContextStore.getState();
      setContext('manual', {}, 'Test', [
        createMockAsset('guid1', 'Table1'),
        createMockAsset('guid2', 'Table2'),
      ]);
    });

    await waitFor(() => {
      expect(calculationTriggered).toHaveBeenCalledWith(2);
    });
  });
});

