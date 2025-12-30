import './ScoreBadge.css';

interface ScoreBadgeProps {
  score: number;
  showLabel?: boolean;
}

export function ScoreBadge({ score, showLabel = false }: ScoreBadgeProps) {
  const getScoreClass = (score: number): string => {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    if (score >= 20) return 'poor';
    return 'critical';
  };

  const getLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Poor';
    return 'Critical';
  };

  return (
    <span className={`score-badge ${getScoreClass(score)}`}>
      {score}
      {showLabel && ` (${getLabel(score)})`}
    </span>
  );
}

