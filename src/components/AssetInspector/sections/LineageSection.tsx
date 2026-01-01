/**
 * Lineage Section
 *
 * Shows lineage status and link to full lineage view
 */

import { GitBranch, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AtlanAsset } from '../../../services/atlan/types';
import { Button } from '../../shared/Button';

interface LineageSectionProps {
  asset: AtlanAsset;
}

export function LineageSection({ asset }: LineageSectionProps) {
  const navigate = useNavigate();

  const hasLineage = asset.__hasLineage === true;

  return (
    <div className="lineage-section">
      <div className="inspector-section">
        <div className="section-title">
          <GitBranch size={14} />
          Lineage Status
        </div>
        <div className="section-content">
          {hasLineage ? (
            <>
              <div className="lineage-status">
                <div className="lineage-indicator active">
                  <GitBranch size={24} />
                  <span>Lineage Available</span>
                </div>
                <p className="lineage-description">
                  This asset has upstream and/or downstream lineage connections.
                  View the full lineage graph to explore data flow.
                </p>
              </div>

              <Button
                variant="primary"
                onClick={() => navigate(`/lineage?guid=${asset.guid}`)}
                className="view-lineage-btn"
              >
                <ExternalLink size={14} />
                View Full Lineage Graph
              </Button>
            </>
          ) : (
            <div className="lineage-status">
              <div className="lineage-indicator inactive">
                <GitBranch size={24} />
                <span>No Lineage Data</span>
              </div>
              <p className="lineage-description">
                Lineage has not been captured for this asset yet.
                Check your connection settings or run lineage crawlers.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
