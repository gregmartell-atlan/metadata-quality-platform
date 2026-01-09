/**
 * Recent Snapshots Panel
 *
 * Displays a list of recently captured quality snapshots with options to
 * view details, compare, or restore from a snapshot.
 */

import { useState } from 'react';
import {
  Clock,
  Camera,
  Trash2,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  X,
  BarChart3,
} from 'lucide-react';
import {
  useQualitySnapshotStore,
  formatTimeAgo,
  type QualitySnapshot,
  type SnapshotComparison,
} from '../../stores/qualitySnapshotStore';
import { useScoresStore } from '../../stores/scoresStore';
import { Button } from '../shared';
import './RecentSnapshotsPanel.css';

interface RecentSnapshotsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureSnapshot: () => void;
}

export function RecentSnapshotsPanel({
  isOpen,
  onClose,
  onCaptureSnapshot,
}: RecentSnapshotsPanelProps) {
  const { snapshots, deleteSnapshot, compareSnapshots } = useQualitySnapshotStore();
  const { assetsWithScores } = useScoresStore();
  const [selectedSnapshot, setSelectedSnapshot] = useState<QualitySnapshot | null>(null);
  const [comparison, setComparison] = useState<SnapshotComparison | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareTarget, setCompareTarget] = useState<string | null>(null);

  const handleSelectSnapshot = (snapshot: QualitySnapshot) => {
    if (compareMode && compareTarget) {
      const result = compareSnapshots(compareTarget, snapshot.id);
      setComparison(result);
      setCompareMode(false);
      setCompareTarget(null);
    } else {
      setSelectedSnapshot(snapshot);
      setComparison(null);
    }
  };

  const handleStartCompare = (snapshotId: string) => {
    setCompareMode(true);
    setCompareTarget(snapshotId);
    setSelectedSnapshot(null);
    setComparison(null);
  };

  const handleCancelCompare = () => {
    setCompareMode(false);
    setCompareTarget(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this snapshot?')) {
      deleteSnapshot(id);
      if (selectedSnapshot?.id === id) {
        setSelectedSnapshot(null);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="recent-snapshots-panel">
      <div className="snapshots-header">
        <div className="snapshots-title">
          <Clock size={16} />
          <span>Recent Snapshots</span>
        </div>
        <button className="close-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="snapshots-actions">
        <Button
          variant="primary"
          onClick={onCaptureSnapshot}
          disabled={assetsWithScores.length === 0}
          className="capture-btn"
        >
          <Camera size={14} />
          Capture Now
        </Button>
        {assetsWithScores.length === 0 && (
          <span className="capture-hint">Load assets first</span>
        )}
      </div>

      {compareMode && (
        <div className="compare-mode-banner">
          <span>Select a snapshot to compare with</span>
          <button onClick={handleCancelCompare}>Cancel</button>
        </div>
      )}

      <div className="snapshots-content">
        {snapshots.length === 0 ? (
          <div className="no-snapshots">
            <AlertCircle size={24} />
            <p>No snapshots yet</p>
            <p className="hint">
              Capture a snapshot to save the current quality metrics for later comparison.
            </p>
          </div>
        ) : (
          <div className="snapshots-list">
            {snapshots.map((snapshot) => (
              <div
                key={snapshot.id}
                className={`snapshot-item ${selectedSnapshot?.id === snapshot.id ? 'selected' : ''} ${
                  compareTarget === snapshot.id ? 'compare-source' : ''
                }`}
                onClick={() => handleSelectSnapshot(snapshot)}
              >
                <div className="snapshot-main">
                  <div className="snapshot-label">{snapshot.label}</div>
                  <div className="snapshot-meta">
                    <span className="snapshot-time">{formatTimeAgo(snapshot.timestamp)}</span>
                    <span className="snapshot-count">{snapshot.totalAssets} assets</span>
                  </div>
                </div>
                <div className="snapshot-score">
                  <span className="score-value">{snapshot.overallScores.overall}%</span>
                </div>
                <div className="snapshot-actions">
                  <button
                    className="compare-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartCompare(snapshot.id);
                    }}
                    title="Compare with another snapshot"
                  >
                    <BarChart3 size={14} />
                  </button>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDelete(snapshot.id, e)}
                    title="Delete snapshot"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={14} className="chevron" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Snapshot Detail View */}
        {selectedSnapshot && !comparison && (
          <div className="snapshot-detail">
            <h4>{selectedSnapshot.label}</h4>
            <p className="detail-time">
              {new Date(selectedSnapshot.timestamp).toLocaleString()}
            </p>

            <div className="detail-section">
              <h5>Overall Scores</h5>
              <div className="scores-grid">
                <ScoreRow label="Overall" value={selectedSnapshot.overallScores.overall} />
                <ScoreRow
                  label="Completeness"
                  value={selectedSnapshot.overallScores.completeness}
                />
                <ScoreRow label="Accuracy" value={selectedSnapshot.overallScores.accuracy} />
                <ScoreRow label="Timeliness" value={selectedSnapshot.overallScores.timeliness} />
                <ScoreRow
                  label="Consistency"
                  value={selectedSnapshot.overallScores.consistency}
                />
                <ScoreRow label="Usability" value={selectedSnapshot.overallScores.usability} />
              </div>
            </div>

            <div className="detail-section">
              <h5>Stats</h5>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">With Descriptions</span>
                  <span className="stat-value">
                    {selectedSnapshot.stats.assetsWithDescriptions}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">With Owners</span>
                  <span className="stat-value">{selectedSnapshot.stats.assetsWithOwners}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Stale Assets</span>
                  <span className="stat-value">{selectedSnapshot.stats.staleAssets}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Certified</span>
                  <span className="stat-value">{selectedSnapshot.stats.certifiedAssets}</span>
                </div>
              </div>
            </div>

            {selectedSnapshot.queryParams && Object.keys(selectedSnapshot.queryParams).length > 0 && (
              <div className="detail-section">
                <h5>Query Context</h5>
                <div className="query-params">
                  {selectedSnapshot.queryParams.connectionFilter && (
                    <span className="param-tag">
                      Connection: {selectedSnapshot.queryParams.connectionFilter}
                    </span>
                  )}
                  {selectedSnapshot.queryParams.domainFilter && (
                    <span className="param-tag">
                      Domain: {selectedSnapshot.queryParams.domainFilter}
                    </span>
                  )}
                  {selectedSnapshot.queryParams.searchQuery && (
                    <span className="param-tag">
                      Search: {selectedSnapshot.queryParams.searchQuery}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comparison View */}
        {comparison && (
          <div className="snapshot-comparison">
            <h4>Comparison</h4>
            <div className="comparison-header">
              <div className="compare-snapshot">
                <span className="compare-label">From</span>
                <span className="compare-name">{comparison.snapshot1.label}</span>
                <span className="compare-time">
                  {formatTimeAgo(comparison.snapshot1.timestamp)}
                </span>
              </div>
              <div className="compare-arrow">→</div>
              <div className="compare-snapshot">
                <span className="compare-label">To</span>
                <span className="compare-name">{comparison.snapshot2.label}</span>
                <span className="compare-time">
                  {formatTimeAgo(comparison.snapshot2.timestamp)}
                </span>
              </div>
            </div>

            <div className="comparison-deltas">
              <h5>Score Changes</h5>
              <div className="delta-grid">
                <DeltaRow label="Overall" delta={comparison.scoreDelta.overall} />
                <DeltaRow label="Completeness" delta={comparison.scoreDelta.completeness} />
                <DeltaRow label="Accuracy" delta={comparison.scoreDelta.accuracy} />
                <DeltaRow label="Timeliness" delta={comparison.scoreDelta.timeliness} />
                <DeltaRow label="Consistency" delta={comparison.scoreDelta.consistency} />
                <DeltaRow label="Usability" delta={comparison.scoreDelta.usability} />
              </div>

              <h5>Stats Changes</h5>
              <div className="delta-grid">
                <DeltaRow
                  label="Asset Count"
                  delta={comparison.assetCountDelta}
                  isCount
                />
                <DeltaRow
                  label="With Descriptions"
                  delta={comparison.statsDelta.assetsWithDescriptions}
                  isCount
                />
                <DeltaRow
                  label="With Owners"
                  delta={comparison.statsDelta.assetsWithOwners}
                  isCount
                />
                <DeltaRow
                  label="Stale Assets"
                  delta={comparison.statsDelta.staleAssets}
                  isCount
                  invertColors
                />
                <DeltaRow
                  label="Certified"
                  delta={comparison.statsDelta.certifiedAssets}
                  isCount
                />
              </div>
            </div>

            <button
              className="close-comparison"
              onClick={() => setComparison(null)}
            >
              Close Comparison
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--color-success)';
    if (score >= 60) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  return (
    <div className="score-row">
      <span className="score-label">{label}</span>
      <div className="score-bar-container">
        <div
          className="score-bar"
          style={{ width: `${value}%`, backgroundColor: getScoreColor(value) }}
        />
      </div>
      <span className="score-value">{value}%</span>
    </div>
  );
}

function DeltaRow({
  label,
  delta,
  isCount = false,
  invertColors = false,
}: {
  label: string;
  delta: number;
  isCount?: boolean;
  invertColors?: boolean;
}) {
  const isPositive = invertColors ? delta < 0 : delta > 0;
  const isNegative = invertColors ? delta > 0 : delta < 0;

  return (
    <div className="delta-row">
      <span className="delta-label">{label}</span>
      <span
        className={`delta-value ${isPositive ? 'positive' : ''} ${isNegative ? 'negative' : ''}`}
      >
        {delta === 0 ? (
          <>
            <Minus size={12} />
            <span>No change</span>
          </>
        ) : (
          <>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>
              {delta > 0 ? '+' : ''}
              {delta}
              {!isCount && '%'}
            </span>
          </>
        )}
      </span>
    </div>
  );
}
