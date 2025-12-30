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
import type { AtlanAsset } from '../services/atlan/types';
import './LineageViewPage.css';

export function LineageViewPage() {
  const [searchParams] = useSearchParams();
  const { selectedAssets } = useAssetStore();
  const [initialAsset, setInitialAsset] = useState<AtlanAsset | null>(null);

  // Get asset GUID from URL params
  useEffect(() => {
    const guid = searchParams.get('guid');
    if (guid && selectedAssets.length > 0) {
      const asset = selectedAssets.find((a) => a.guid === guid);
      if (asset) {
        setInitialAsset(asset);
      }
    } else if (selectedAssets.length > 0 && !initialAsset) {
      // Use first selected asset if no GUID in URL
      setInitialAsset(selectedAssets[0]);
    }
  }, [searchParams, selectedAssets, initialAsset]);

  return (
    <div className="lineage-view-page">
      <ReactFlowProvider>
        <LineageView />
      </ReactFlowProvider>
    </div>
  );
}







