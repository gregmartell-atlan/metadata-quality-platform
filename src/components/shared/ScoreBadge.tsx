import { memo } from 'react';
import { getScoreBand, getScoreLabel } from '../../utils/scoreThresholds';
import './ScoreBadge.css';

interface ScoreBadgeProps {
  score: number;
  showLabel?: boolean;
}

export const ScoreBadge = memo(function ScoreBadge({ score, showLabel = false }: ScoreBadgeProps) {
  return (
    <span className={`score-badge ${getScoreBand(score)}`}>
      {score}
      {showLabel && ` (${getScoreLabel(score)})`}
    </span>
  );
});

