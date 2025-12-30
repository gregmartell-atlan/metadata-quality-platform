import React from 'react';
import { Hash, Percent, BarChart3, Zap } from 'lucide-react';
import type { Measure, MeasureDisplayMode } from '../../types/pivot';
import './MeasureDisplayToggle.css';

interface MeasureDisplayToggleProps {
  measure: Measure;
  mode: MeasureDisplayMode;
  onModeChange: (measure: Measure, mode: MeasureDisplayMode) => void;
}

const MODE_ICONS: Record<MeasureDisplayMode, React.ReactNode> = {
  numeric: <Hash size={14} />,
  percentage: <Percent size={14} />,
  visual: <BarChart3 size={14} />,
  auto: <Zap size={14} />,
};

const MODE_LABELS: Record<MeasureDisplayMode, string> = {
  numeric: 'Number',
  percentage: 'Percent',
  visual: 'Visual',
  auto: 'Auto',
};

export function MeasureDisplayToggle({
  measure,
  mode,
  onModeChange,
}: MeasureDisplayToggleProps) {
  const modes: MeasureDisplayMode[] = ['numeric', 'percentage', 'visual', 'auto'];

  return (
    <div className="measure-display-toggle">
      <div className="toggle-group">
        {modes.map((m) => (
          <button
            key={m}
            className={`toggle-option ${mode === m ? 'active' : ''}`}
            onClick={() => onModeChange(measure, m)}
            title={MODE_LABELS[m]}
          >
            <span className="toggle-icon">{MODE_ICONS[m]}</span>
            <span className="toggle-label">{MODE_LABELS[m]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

