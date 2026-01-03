import { memo } from 'react';
import { useQualityRules } from '../../stores/qualityRulesStore';
import './ScoreBadge.css';

interface ScoreBadgeProps {
  score: number;
  showLabel?: boolean;
}

export const ScoreBadge = memo(function ScoreBadge({ score, showLabel = false }: ScoreBadgeProps) {
  const { getScoreBand, getScoreLabel } = useQualityRules();

  return (
    <span className={`score-badge ${getScoreBand(score)}`}>
      {score}
      {showLabel && ` (${getScoreLabel(score)})`}
    </span>
  );
});

