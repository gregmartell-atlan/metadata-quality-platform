/**
 * Lineage View Page
 *
 * Full-page wrapper for the lineage visualization
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { LineageView } from '../components/lineage/LineageView';
import { AppHeader } from '../components/layout/AppHeader';
import { BreadcrumbNav } from '../components/layout/BreadcrumbNav';
import { useAssetStore } from '../stores/assetStore';
import type { AtlanAsset } from '../services/atlan/types';
import './LineageViewPage.css';

export function LineageViewPage() {
  const [searchParams] = useSearchParams();
  const { selectedAssets } = useAssetStore();
  const [initialAsset, setInitialAsset] = useState<AtlanAsset | null>(null);

  useEffect(() => {
    const guid = searchParams.get('guid');
    if (guid && selectedAssets.length > 0) {
      const asset = selectedAssets.find((a) => a.guid === guid);
      if (asset) {
        setInitialAsset(asset);
      }
    } else if (selectedAssets.length > 0 && !initialAsset) {
      setInitialAsset(selectedAssets[0]);
    }
  }, [searchParams, selectedAssets, initialAsset]);

  return (
    <div className="lineage-view-page">
      <AppHeader title="Lineage Explorer" />
      <BreadcrumbNav />
      <div className="lineage-view-container">
        <ReactFlowProvider>
          <LineageView />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
