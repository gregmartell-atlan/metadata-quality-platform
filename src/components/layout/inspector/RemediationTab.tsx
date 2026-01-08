import { RemediationPrioritizer } from '../../analytics/RemediationPrioritizer';
import { useScoresStore } from '../../../stores/scoresStore';
import { useAssetPreviewStore } from '../../../stores/assetPreviewStore';
import { useRightSidebarStore } from '../../../stores/rightSidebarStore';
import { AlertCircle } from 'lucide-react';
import './RemediationTab.css';

export function RemediationTab() {
    const { assetsWithScores } = useScoresStore();
    const { openPreview } = useAssetPreviewStore();
    const { setActiveTab } = useRightSidebarStore();

    const handleAssetClick = (asset: any) => {
        // Open preview for the asset
        openPreview(asset.asset);
        // Switch to asset tab in sidebar
        setActiveTab('asset');
    };

    if (assetsWithScores.length === 0) {
        return (
            <div className="remediation-tab-empty">
                <AlertCircle size={48} />
                <h3>No Assets Scored</h3>
                <p>
                    Add assets to your selection or browse Atlan to generate a remediation plan.
                </p>
            </div>
        );
    }

    return (
        <div className="remediation-tab-content">
            <div className="tab-context-header">
                <p>Priority actions to improve metadata quality across your selected scope.</p>
            </div>
            <RemediationPrioritizer
                assets={assetsWithScores}
                onAssetClick={handleAssetClick}
            />
        </div>
    );
}
