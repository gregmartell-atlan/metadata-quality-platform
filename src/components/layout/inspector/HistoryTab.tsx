/**
 * History Tab Content
 * 
 * Displays recent snapshots for comparison and restoration.
 */

import { Clock, Camera, AlertCircle } from 'lucide-react';
import { useQualitySnapshotStore, formatTimeAgo } from '../../../stores/qualitySnapshotStore';
import { useScoresStore } from '../../../stores/scoresStore';
import { Button } from '../../shared';
import './AssetPreviewTab.css';

export function HistoryTab() {
    const { snapshots } = useQualitySnapshotStore();
    const { assetsWithScores } = useScoresStore();

    return (
        <div className="history-tab" style={{ padding: '24px' }}>
            <div className="drawer-section">
                <Button
                    variant="primary"
                    onClick={() => { }} // Handle capture
                    disabled={assetsWithScores.length === 0}
                    style={{ width: '100%' }}
                >
                    <Camera size={14} />
                    Capture Snapshot
                </Button>
            </div>

            <div className="snapshots-list">
                {snapshots.length === 0 ? (
                    <div className="tab-placeholder">
                        <AlertCircle size={32} />
                        <p>No snapshots yet</p>
                    </div>
                ) : (
                    snapshots.map((snapshot) => (
                        <div key={snapshot.id} className="snapshot-item" style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontWeight: 600 }}>{snapshot.label}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {formatTimeAgo(snapshot.timestamp)} • {snapshot.totalAssets} assets
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--primary-blue)' }}>
                                Overall: {snapshot.overallScores.overall}%
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
