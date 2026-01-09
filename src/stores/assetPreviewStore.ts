/**
 * Asset Preview Store
 *
 * Manages the state for the asset preview drawer.
 * Allows any component to trigger the preview drawer with an asset.
 * Fetches full asset metadata when drawer opens.
 */

import { create } from 'zustand';
import type { AtlanAsset } from '../services/atlan/types';
import { getAsset } from '../services/atlan/api';
import { logger } from '../utils/logger';

interface AssetPreviewState {
  // State
  selectedAsset: AtlanAsset | null;
  selectedAssets: AtlanAsset[]; // For multi-asset group preview
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  openPreview: (asset: AtlanAsset) => void;
  openMultiPreview: (assets: AtlanAsset[]) => void;
  closePreview: () => void;
  togglePreview: () => void;
}

// Comprehensive attributes to fetch for full asset preview
// Organized by category for maintainability
const PREVIEW_ATTRIBUTES = [
  // === CORE IDENTITY ===
  'name',
  'displayName',
  'description',
  'userDescription',
  'qualifiedName',
  'guid',

  // === GOVERNANCE & CERTIFICATION ===
  'certificateStatus',
  'certificateStatusMessage',
  'certificateUpdatedBy',
  'certificateUpdatedAt',
  'announcementTitle',
  'announcementMessage',
  'announcementType',
  'announcementUpdatedAt',
  'announcementUpdatedBy',

  // === OWNERSHIP & STEWARDSHIP ===
  'ownerUsers',
  'ownerGroups',
  'adminUsers',
  'adminGroups',
  'adminRoles',
  'viewerUsers',
  'viewerGroups',

  // === CLASSIFICATIONS & TAGS ===
  'classifications',
  'classificationNames',
  'atlanTags',
  'tags',
  'meanings', // Glossary term links
  'assignedTerms',

  // === CUSTOM METADATA ===
  'businessAttributes', // Custom metadata fields

  // === DOCUMENTATION ===
  'readme',
  'links',
  'resources',

  // === DATA PRODUCTS & DOMAINS ===
  'dataProducts',
  'dataProductGuids',
  'dataDomain',
  'dataDomainGuid',
  'outputPortDataProducts',
  'inputPortDataProducts',

  // === QUALITY & HEALTH METRICS ===
  'dataQualityScore',
  'dataQualitySummary',
  'assetDbtJobLastRun',
  'assetDbtJobLastRunStatus',
  'assetDbtJobLastRunGeneratedAt',
  'assetMcIncidentCount',
  'assetMcMonitorCount',
  'assetSodaCheckCount',
  'assetSodaLastSyncRunAt',
  'assetSodaLastScanAt',
  'anomaloCheck',

  // === USAGE & POPULARITY METRICS ===
  'popularityScore',
  'viewScore',
  'starredCount',
  'starredBy',
  'sourceReadCount',
  'sourceReadUserCount',
  'sourceReadQueryCost',
  'sourceReadCostUnit',
  'sourceReadRecentUserList',
  'sourceReadTopUserList',
  'sourceLastReadAt',
  'sourceTotalCost',

  // === TIMESTAMPS & AUDIT ===
  'createTime',
  'updateTime',
  'createdBy',
  'updatedBy',
  'sourceCreatedAt',
  'sourceUpdatedAt',
  'sourceCreatedBy',
  'sourceUpdatedBy',
  'lastSyncRun',
  'lastSyncRunAt',
  'lastSyncWorkflowName',

  // === CONNECTION & LOCATION ===
  'connectionName',
  'connectionQualifiedName',
  'connectorName',
  'connectorType',
  'databaseName',
  'schemaName',
  'tableName',
  'viewName',

  // === TECHNICAL METADATA ===
  '__hasLineage',
  'hasLineage',
  'rowCount',
  'columnCount',
  'sizeBytes',
  'tableType',
  'viewDefinition',
  'isProfiled',
  'lastProfiledAt',
  'queryCount',
  'queryUserCount',

  // === SCHEMA & STRUCTURE ===
  'columns', // For tables - list of columns
  'dataType', // For columns
  'order', // Column order
  'isPrimary',
  'isForeign',
  'isNullable',
  'isPartition',
  'maxLength',
  'precision',
  'scale',
  'defaultValue',
  'subDataType',
  'rawDataTypeDefinition',
];

export const useAssetPreviewStore = create<AssetPreviewState>((set, get) => ({
  selectedAsset: null,
  selectedAssets: [],
  isOpen: false,
  isLoading: false,
  error: null,

  openMultiPreview: (assets: AtlanAsset[]) => {
    if (assets.length === 0) return;

    if (assets.length === 1) {
      // Single asset - use the full preview with metadata fetch
      get().openPreview(assets[0]);
    } else {
      // Multiple assets - show group summary (no API call needed)
      logger.info('AssetPreviewStore: Opening multi-asset preview', { count: assets.length });
      set({
        selectedAsset: null,
        selectedAssets: assets,
        isOpen: true,
        isLoading: false,
        error: null,
      });
    }
  },

  openPreview: async (asset: AtlanAsset) => {
    // Immediately show the drawer with initial asset data (clear multi-select)
    set({ selectedAsset: asset, selectedAssets: [], isOpen: true, isLoading: true, error: null });

    // Fetch full asset metadata in background
    if (asset.guid) {
      try {
        logger.info('AssetPreviewStore: Fetching full asset metadata', { guid: asset.guid });
        const fullAsset = await getAsset(asset.guid, PREVIEW_ATTRIBUTES);

        if (fullAsset) {
          // Merge the full asset data with the initial asset (preserve any fields not in API response)
          const mergedAsset: AtlanAsset = {
            ...asset,
            ...fullAsset,
            // Ensure attributes are merged properly
            attributes: {
              ...asset.attributes,
              ...fullAsset.attributes,
            },
          };

          logger.info('AssetPreviewStore: Full asset loaded', {
            guid: asset.guid,
            name: mergedAsset.name || mergedAsset.attributes?.name
          });

          set({ selectedAsset: mergedAsset, isLoading: false });
        } else {
          // Keep initial asset if fetch fails
          logger.warn('AssetPreviewStore: Could not fetch full asset, using initial data');
          set({ isLoading: false });
        }
      } catch (err) {
        logger.error('AssetPreviewStore: Error fetching asset metadata', err);
        set({ isLoading: false, error: 'Failed to load asset details' });
      }
    } else {
      set({ isLoading: false });
    }
  },

  closePreview: () => {
    set({ isOpen: false, error: null });
    // Delay clearing assets to allow animation to complete
    setTimeout(() => {
      set({ selectedAsset: null, selectedAssets: [], isLoading: false });
    }, 300);
  },

  togglePreview: () => {
    const { isOpen } = get();
    if (isOpen) {
      get().closePreview();
    }
  },
}));
