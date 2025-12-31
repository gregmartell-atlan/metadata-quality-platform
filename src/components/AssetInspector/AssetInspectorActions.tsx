/**
 * Asset Inspector Actions
 *
 * Footer action buttons for the inspector modal
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, GitBranch, Copy, Check, X } from 'lucide-react';
import type { AtlanAsset } from '../../services/atlan/types';
import { useAssetInspectorStore } from '../../stores/assetInspectorStore';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { Button } from '../shared/Button';

interface AssetInspectorActionsProps {
  asset: AtlanAsset | null;
}

export function AssetInspectorActions({ asset }: AssetInspectorActionsProps) {
  const navigate = useNavigate();
  const { closeInspector } = useAssetInspectorStore();
  const { setContext } = useAssetContextStore();
  const [copied, setCopied] = useState(false);

  if (!asset) return null;

  const isTable = ['Table', 'View', 'MaterializedView'].includes(asset.typeName);
  const hasLineage = asset.__hasLineage === true;

  const handleAddToPivot = () => {
    // Set asset as context for pivot analysis
    setContext(
      'table',
      { assetGuid: asset.guid },
      asset.name,
      [asset]
    );

    // Navigate to pivot builder
    navigate('/pivot');

    // Close inspector
    closeInspector();

    // Success notification (would need toast integration)
    console.log(`Added ${asset.name} to pivot analysis`);
  };

  const handleViewLineage = () => {
    navigate(`/lineage?guid=${asset.guid}`);
    closeInspector();
  };

  const handleCopyQualifiedName = async () => {
    await navigator.clipboard.writeText(asset.qualifiedName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="asset-inspector-actions">
      {/* Primary Actions */}
      <div className="actions-left">
        {isTable && (
          <Button variant="primary" onClick={handleAddToPivot}>
            <BarChart3 size={14} />
            Add to Pivot
          </Button>
        )}

        {hasLineage && (
          <Button variant="secondary" onClick={handleViewLineage}>
            <GitBranch size={14} />
            View Lineage
          </Button>
        )}
      </div>

      {/* Utility Actions */}
      <div className="actions-right">
        <Button variant="secondary" onClick={handleCopyQualifiedName}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Name'}
        </Button>

        <Button variant="secondary" onClick={closeInspector}>
          <X size={14} />
          Close
        </Button>
      </div>
    </div>
  );
}
