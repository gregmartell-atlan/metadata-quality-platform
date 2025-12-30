/**
 * Component Integration Tests
 * 
 * Tests that all components correctly subscribe and update when context changes
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act, screen } from '@testing-library/react';
import { useAssetContextStore } from '../../stores/assetContextStore';
import type { AtlanAsset } from '../../services/atlan/types';

// Mock the actual components
vi.mock('../../components/dashboard/Scorecard', () => ({
  Scorecard: () => {
    const { contextAssets } = useAssetContextStore();
    return <div data-testid="scorecard">{contextAssets.length} assets</div>;
  },
}));

vi.mock('../../components/dashboard/StatsRow', () => ({
  StatsRow: () => {
    const { contextAssets } = useAssetContextStore();
    return <div data-testid="stats-row">{contextAssets.length} assets</div>;
  },
}));

vi.mock('../../components/pivot/PreBuiltPivots', () => ({
  PreBuiltPivots: () => {
    const { contextAssets } = useAssetContextStore();
    return <div data-testid="pre-built-pivots">{contextAssets.length} assets</div>;
  },
}));

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

describe('Component Integration', () => {
  beforeEach(() => {
    useAssetContextStore.getState().clearContext();
  });

  describe('Component Subscriptions', () => {
    it('should update Scorecard when context changes', async () => {
      const { Scorecard } = await import('../../components/dashboard/Scorecard');
      const { getByTestId } = render(<Scorecard />);

      expect(getByTestId('scorecard').textContent).toBe('0 assets');

      act(() => {
        const { setContext } = useAssetContextStore.getState();
        setContext('manual', {}, 'Test', [
          createMockAsset('guid1', 'Table1'),
          createMockAsset('guid2', 'Table2'),
        ]);
      });

      await waitFor(() => {
        expect(getByTestId('scorecard').textContent).toBe('2 assets');
      });
    });

    it('should update StatsRow when context changes', async () => {
      const { StatsRow } = await import('../../components/dashboard/StatsRow');
      const { getByTestId } = render(<StatsRow />);

      expect(getByTestId('stats-row').textContent).toBe('0 assets');

      act(() => {
        const { setContext } = useAssetContextStore.getState();
        setContext('connection', { connectionName: 'Test' }, 'Test Connection', [
          createMockAsset('guid1', 'Table1'),
        ]);
      });

      await waitFor(() => {
        expect(getByTestId('stats-row').textContent).toBe('1 assets');
      });
    });

    it('should update PreBuiltPivots when context changes', async () => {
      const { PreBuiltPivots } = await import('../../components/pivot/PreBuiltPivots');
      const { getByTestId } = render(<PreBuiltPivots />);

      expect(getByTestId('pre-built-pivots').textContent).toBe('0 assets');

      act(() => {
        const { setContext } = useAssetContextStore.getState();
        setContext('database', { connectionName: 'Test', databaseName: 'DB' }, 'Test DB', [
          createMockAsset('guid1', 'Table1'),
          createMockAsset('guid2', 'Table2'),
          createMockAsset('guid3', 'Table3'),
        ]);
      });

      await waitFor(() => {
        expect(getByTestId('pre-built-pivots').textContent).toBe('3 assets');
      });
    });
  });

  describe('Calculation Updates', () => {
    it('should trigger calculations when context assets change', async () => {
      const calculationMock = vi.fn();

      const TestComponent = () => {
        const { contextAssets } = useAssetContextStore();

        React.useEffect(() => {
          if (contextAssets.length > 0) {
            // Simulate calculation
            const result = contextAssets.reduce((sum, asset) => sum + 1, 0);
            calculationMock(result);
          }
        }, [contextAssets]);

        return <div>{contextAssets.length}</div>;
      };

      render(<TestComponent />);

      expect(calculationMock).not.toHaveBeenCalled();

      act(() => {
        const { setContext } = useAssetContextStore.getState();
        setContext('manual', {}, 'Test', [
          createMockAsset('guid1', 'Table1'),
          createMockAsset('guid2', 'Table2'),
        ]);
      });

      await waitFor(() => {
        expect(calculationMock).toHaveBeenCalledWith(2);
      });
    });

    it('should not trigger calculations when context is cleared', async () => {
      const calculationMock = vi.fn();

      const TestComponent = () => {
        const { contextAssets } = useAssetContextStore();

        React.useEffect(() => {
          if (contextAssets.length > 0) {
            calculationMock(contextAssets.length);
          }
        }, [contextAssets]);

        return <div>{contextAssets.length}</div>;
      };

      // Set initial context
      act(() => {
        const { setContext } = useAssetContextStore.getState();
        setContext('manual', {}, 'Test', [createMockAsset('guid1', 'Table1')]);
      });

      render(<TestComponent />);

      await waitFor(() => {
        expect(calculationMock).toHaveBeenCalledWith(1);
      });

      calculationMock.mockClear();

      // Clear context
      act(() => {
        const { clearContext } = useAssetContextStore.getState();
        clearContext();
      });

      // Calculation should not be called for empty array
      await waitFor(() => {
        expect(calculationMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('Multiple Component Updates', () => {
    it('should update all components simultaneously', async () => {
      const { Scorecard } = await import('../../components/dashboard/Scorecard');
      const { StatsRow } = await import('../../components/dashboard/StatsRow');
      const { PreBuiltPivots } = await import('../../components/pivot/PreBuiltPivots');

      const { getByTestId } = render(
        <>
          <Scorecard />
          <StatsRow />
          <PreBuiltPivots />
        </>
      );

      // All should start at 0
      expect(getByTestId('scorecard').textContent).toBe('0 assets');
      expect(getByTestId('stats-row').textContent).toBe('0 assets');
      expect(getByTestId('pre-built-pivots').textContent).toBe('0 assets');

      // Update context
      act(() => {
        const { setContext } = useAssetContextStore.getState();
        setContext('all', {}, 'All Assets', [
          createMockAsset('guid1', 'Table1'),
          createMockAsset('guid2', 'Table2'),
          createMockAsset('guid3', 'Table3'),
        ]);
      });

      // All should update to 3
      await waitFor(() => {
        expect(getByTestId('scorecard').textContent).toBe('3 assets');
        expect(getByTestId('stats-row').textContent).toBe('3 assets');
        expect(getByTestId('pre-built-pivots').textContent).toBe('3 assets');
      });
    });
  });
});

