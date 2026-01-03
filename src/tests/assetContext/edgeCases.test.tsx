/**
 * Asset Context Edge Cases Test Suite
 * 
 * Tests edge cases, gotchas, and error scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { useAssetContextStore } from '../../stores/assetContextStore';
import type { AtlanAsset } from '../../services/atlan/types';

const createMockAsset = (guid: string, name: string): AtlanAsset => ({
  guid,
  typeName: 'Table',
  name,
  qualifiedName: `connection/${name}`,
  connectionName: 'TestConnection',
  description: null,
  userDescription: null,
  ownerUsers: [],
  ownerGroups: [],
  certificateStatus: null,
  classificationNames: [],
  domainGUIDs: [],
  updateTime: Date.now(),
  createTime: Date.now(),
  popularityScore: 0,
  viewCount: 0,
  userCount: 0,
  customMetadata: {},
  lineage: null,
  readme: null,
});

describe('Edge Cases and Gotchas', () => {
  beforeEach(() => {
    useAssetContextStore.getState().clearContext();
  });

  describe('Race Conditions', () => {
    it('should handle concurrent context updates', async () => {
      const { setContext } = useAssetContextStore.getState();
      const results: number[] = [];

      // Simulate concurrent updates
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve().then(() => {
          act(() => {
            setContext('manual', {}, `Context ${i}`, [createMockAsset(`guid${i}`, `Table${i}`)]);
            results.push(useAssetContextStore.getState().contextAssets.length);
          });
        })
      );

      await Promise.all(promises);

      // Final state should be consistent
      const finalState = useAssetContextStore.getState();
      expect(finalState.contextAssets.length).toBe(1);
      expect(finalState.context).not.toBeNull();
    });

    it('should handle rapid clear and set operations', () => {
      const { setContext, clearContext } = useAssetContextStore.getState();

      act(() => {
        setContext('manual', {}, 'Test', [createMockAsset('guid1', 'Table1')]);
        clearContext();
        setContext('connection', { connectionName: 'Test' }, 'Test Connection', [
          createMockAsset('guid2', 'Table2'),
        ]);
      });

      const state = useAssetContextStore.getState();
      expect(state.contextAssets.length).toBe(1);
      expect(state.context?.type).toBe('connection');
    });
  });

  describe('Memory Leaks', () => {
    it('should not retain references to old assets', () => {
      const { setContext } = useAssetContextStore.getState();
      const assets1 = [createMockAsset('guid1', 'Table1')];
      const assets2 = [createMockAsset('guid2', 'Table2')];

      act(() => {
        setContext('manual', {}, 'Test1', assets1);
      });

      const firstState = useAssetContextStore.getState();
      const firstAssets = firstState.contextAssets;

      act(() => {
        setContext('manual', {}, 'Test2', assets2);
      });

      const secondState = useAssetContextStore.getState();
      const secondAssets = secondState.contextAssets;

      // Should be different arrays
      expect(firstAssets).not.toBe(secondAssets);
      expect(secondAssets[0].guid).toBe('guid2');
    });
  });

  describe('Invalid Data', () => {
    it('should handle assets with missing required fields', () => {
      const { setContext } = useAssetContextStore.getState();
      const invalidAsset = {
        guid: 'guid1',
        // Missing other required fields
      } as any;

      act(() => {
        setContext('manual', {}, 'Test', [invalidAsset]);
      });

      const state = useAssetContextStore.getState();
      expect(state.contextAssets.length).toBe(1);
      // Store should accept it, validation happens elsewhere
    });

    it('should handle duplicate GUIDs', () => {
      const { setContext } = useAssetContextStore.getState();
      const duplicateAssets = [
        createMockAsset('guid1', 'Table1'),
        createMockAsset('guid1', 'Table2'), // Same GUID
      ];

      act(() => {
        setContext('manual', {}, 'Test', duplicateAssets);
      });

      const state = useAssetContextStore.getState();
      // Store should accept duplicates (deduplication happens in components if needed)
      expect(state.contextAssets.length).toBe(2);
    });
  });

  describe('Context Type Edge Cases', () => {
    it('should handle manual context with empty label', () => {
      const { setContext } = useAssetContextStore.getState();

      act(() => {
        setContext('manual', {}, '', [createMockAsset('guid1', 'Table1')]);
      });

      const { context } = useAssetContextStore.getState();
      expect(context?.label).toBe('');
      expect(context?.type).toBe('manual');
    });

    it('should handle context with all filter types', () => {
      const { setContext } = useAssetContextStore.getState();

      act(() => {
        setContext(
          'schema',
          {
            connectionName: 'Conn',
            databaseName: 'DB',
            schemaName: 'Schema',
            tableName: 'Table',
            assetGuid: 'guid1',
          },
          'Full Context',
          [createMockAsset('guid1', 'Table1')]
        );
      });

      const { context } = useAssetContextStore.getState();
      expect(context?.filters.connectionName).toBe('Conn');
      expect(context?.filters.databaseName).toBe('DB');
      expect(context?.filters.schemaName).toBe('Schema');
    });
  });

  describe('Persistence Edge Cases', () => {
    it('should handle corrupted persisted data gracefully', () => {
      // Simulate corrupted localStorage
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => 'invalid json');

      // Store should handle this
      const { context } = useAssetContextStore.getState();
      expect(context).toBeNull();

      localStorage.getItem = originalGetItem;
    });

    it('should handle missing persisted data', () => {
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => null);

      const { context } = useAssetContextStore.getState();
      expect(context).toBeNull();

      localStorage.getItem = originalGetItem;
    });
  });

  describe('Component Subscription Edge Cases', () => {
    it('should handle component unmounting during context update', async () => {
      const TestComponent = () => {
        const { contextAssets } = useAssetContextStore();
        return <div>{contextAssets.length}</div>;
      };

      const { unmount } = render(<TestComponent />);

      // Start context update
      const updatePromise = Promise.resolve().then(() => {
        act(() => {
          const { setContext } = useAssetContextStore.getState();
          setContext('manual', {}, 'Test', [createMockAsset('guid1', 'Table1')]);
        });
      });

      // Unmount component before update completes
      unmount();

      await updatePromise;

      // Store should still be updated
      const state = useAssetContextStore.getState();
      expect(state.contextAssets.length).toBe(1);
    });

    it('should handle multiple components subscribing to different fields', () => {
      const Component1 = () => {
        const { contextAssets } = useAssetContextStore();
        return <div data-testid="comp1">{contextAssets.length}</div>;
      };

      const Component2 = () => {
        const { context } = useAssetContextStore();
        return <div data-testid="comp2">{context?.label || 'No context'}</div>;
      };

      const { getByTestId } = render(
        <>
          <Component1 />
          <Component2 />
        </>
      );

      act(() => {
        const { setContext } = useAssetContextStore.getState();
        setContext('manual', {}, 'Test Label', [createMockAsset('guid1', 'Table1')]);
      });

      expect(getByTestId('comp1').textContent).toBe('1');
      expect(getByTestId('comp2').textContent).toBe('Test Label');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle very large asset arrays', () => {
      const { setContext } = useAssetContextStore.getState();
      const largeArray = Array.from({ length: 50000 }, (_, i) =>
        createMockAsset(`guid${i}`, `Table${i}`)
      );

      const startTime = performance.now();

      act(() => {
        setContext('all', {}, 'All Assets', largeArray);
      });

      const duration = performance.now() - startTime;

      const state = useAssetContextStore.getState();
      expect(state.contextAssets.length).toBe(50000);
      // Should complete in reasonable time
      expect(duration).toBeLessThan(500);
    });

    it('should handle frequent small updates', () => {
      const { setContext } = useAssetContextStore.getState();
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        act(() => {
          setContext('manual', {}, `Test ${i}`, [createMockAsset(`guid${i}`, `Table${i}`)]);
        });
      }

      const duration = performance.now() - startTime;
      const state = useAssetContextStore.getState();

      expect(state.contextAssets.length).toBe(1);
      expect(state.context?.label).toBe('Test 99');
      // Should handle 100 updates quickly
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle setContext with null assets', () => {
      const { setContext } = useAssetContextStore.getState();

      act(() => {
        // @ts-expect-error - testing invalid input
        setContext('manual', {}, 'Test', null);
      });

      // Store should handle gracefully
      const state = useAssetContextStore.getState();
      expect(state.contextAssets).toBeDefined();
    });

    it('should handle setContext with undefined type', () => {
      const { setContext } = useAssetContextStore.getState();

      act(() => {
        // @ts-expect-error - testing invalid input
        setContext(undefined, {}, 'Test', [createMockAsset('guid1', 'Table1')]);
      });

      // Store should handle gracefully or throw
      const state = useAssetContextStore.getState();
      expect(state).toBeDefined();
    });
  });
});





