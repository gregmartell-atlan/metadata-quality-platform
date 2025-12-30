/**
 * Lineage View Page
 * 
 * Full-page wrapper for the lineage visualization
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { LineageView } from '../components/lineage/LineageView';
import { useAssetStore } from '../stores/assetStore';
import { useAssetContextStore } from '../stores/assetContextStore';
import type { AtlanAsset } from '../services/atlan/types';
import './LineageViewPage.css';

export function LineageViewPage() {
  const [searchParams] = useSearchParams();
  const { selectedAssets } = useAssetStore();
  const { contextAssets } = useAssetContextStore();
  const [initialAsset, setInitialAsset] = useState<AtlanAsset | null>(null);

  // Use context assets if available, fallback to selectedAssets for backward compatibility
  const sourceAssets = contextAssets.length > 0 ? contextAssets : selectedAssets;

  // Get asset GUID from URL params
  useEffect(() => {
    const guid = searchParams.get('guid');
    if (guid && sourceAssets.length > 0) {
      const asset = sourceAssets.find((a) => a.guid === guid);
      if (asset) {
        setInitialAsset(asset);
      }
    } else if (sourceAssets.length > 0 && !initialAsset) {
      // Use first asset from context or selection if no GUID in URL
      setInitialAsset(sourceAssets[0]);
    }
  }, [searchParams, sourceAssets, initialAsset]);

  return (
    <div className="lineage-view-page">
      <ReactFlowProvider>
        <LineageView />
      </ReactFlowProvider>
    </div>
  );
}








