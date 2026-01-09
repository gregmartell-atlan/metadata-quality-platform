/**
 * Quality Section
 *
 * Shows quality scores across 5 dimensions
 */

import { Award, Target, CheckCircle, Clock, Scale, Users as UsersIcon } from 'lucide-react';
import type { AtlanAsset } from '../../../services/atlan/types';
import { useScoresStore } from '../../../stores/scoresStore';
import { ScoreBadge } from '../../shared/ScoreBadge';
import { getScoreClass } from '../../../utils/scoreThresholds';

interface QualitySectionProps {
  asset: AtlanAsset;
}

export function QualitySection({ asset }: QualitySectionProps) {
  const { assetsWithScores } = useScoresStore();

  // Find quality scores for this asset
  const assetWithScore = assetsWithScores.find(a => a.asset.guid === asset.guid);
  const scores = assetWithScore?.scores;

  if (!scores) {
    return (
      <div className="quality-section">
        <div className="empty-message">
          <Award size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p>Quality scores not calculated yet</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Add this asset to context and calculate scores to see quality breakdown
          </p>
        </div>
      </div>
    );
  }

  const dimensions = [
    { key: 'completeness', label: 'Completeness', icon: <Target size={16} />, description: 'Coverage of key fields' },
    { key: 'accuracy', label: 'Accuracy', icon: <CheckCircle size={16} />, description: 'Validity and conformance' },
    { key: 'timeliness', label: 'Timeliness', icon: <Clock size={16} />, description: 'Freshness and staleness' },
    { key: 'consistency', label: 'Consistency', icon: <Scale size={16} />, description: 'Policy compliance' },
    { key: 'usability', label: 'Usability', icon: <UsersIcon size={16} />, description: 'Engagement and consumption' },
  ];

  return (
    <div className="quality-section">
      {/* Overall Score */}
      <div className="inspector-section">
        <div className="section-title">
          <Award size={14} />
          Overall Quality Score
        </div>
        <div className="section-content">
          <div className="overall-score-display">
            <ScoreBadge score={scores.overall} showLabel size="large" />
            <p className="score-description">
              Composite score across all 5 quality dimensions
            </p>
          </div>
        </div>
      </div>

      {/* Dimension Breakdown */}
      <div className="inspector-section">
        <div className="section-title">Dimension Breakdown</div>
        <div className="section-content">
          <div className="dimensions-list">
            {dimensions.map(({ key, label, icon, description }) => {
              const score = scores[key as keyof typeof scores] as number;

              return (
                <div key={key} className="dimension-item">
                  <div className="dimension-header">
                    <div className="dimension-icon">{icon}</div>
                    <div className="dimension-info">
                      <div className="dimension-label">{label}</div>
                      <div className="dimension-description">{description}</div>
                    </div>
                    <div className="dimension-score">
                      <ScoreBadge score={score} />
                    </div>
                  </div>
                  <div className="dimension-bar-container">
                    <div
                      className={`dimension-bar ${getScoreClass(score)}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
