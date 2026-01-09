/**
 * ChartStylePreview - Live preview of chart styles for Settings
 */

import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Cell,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import type { ChartStyle } from '../../stores/uiPreferencesStore';
import './ChartStylePreview.css';

interface ChartStylePreviewProps {
  style: ChartStyle;
  isSelected?: boolean;
  onClick?: () => void;
}

// Style-specific colors
const STYLE_COLORS: Record<ChartStyle, Record<string, string>> = {
  neon: {
    critical: '#ff006e',
    healthy: '#39ff14',
    techDebt: '#666666',
    quickWins: '#00f5ff',
    axis: '#00f5ff',
    reference: '#ffffff33',
    bg: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)',
  },
  glass: {
    critical: '#f87171',
    healthy: '#4ade80',
    techDebt: '#94a3b8',
    quickWins: '#60a5fa',
    axis: '#64748b',
    reference: '#cbd5e1',
    bg: 'linear-gradient(135deg, rgba(249,168,212,0.15) 0%, rgba(147,197,253,0.15) 50%, rgba(134,239,172,0.15) 100%)',
  },
  bold: {
    critical: '#dc2626',
    healthy: '#16a34a',
    techDebt: '#71717a',
    quickWins: '#2563eb',
    axis: '#18181b',
    reference: '#18181b',
    bg: '#fafafa',
  },
  minimal: {
    critical: '#ef4444',
    healthy: '#d4d4d8',
    techDebt: '#d4d4d8',
    quickWins: '#d4d4d8',
    axis: '#a1a1aa',
    reference: '#e4e4e7',
    bg: '#ffffff',
  },
};

const STYLE_INFO: Record<ChartStyle, { name: string; description: string }> = {
  glass: { name: 'Glass', description: 'Soft gradients, frosted effects' },
  neon: { name: 'Neon', description: 'Dark with glowing accents' },
  bold: { name: 'Bold', description: 'Sharp lines, strong contrast' },
  minimal: { name: 'Minimal', description: 'Data-focused, clean' },
};

// Sample data for preview
const SAMPLE_DATA = [
  { x: 25, y: 75, quadrant: 'critical' },
  { x: 35, y: 65, quadrant: 'critical' },
  { x: 80, y: 85, quadrant: 'healthy' },
  { x: 75, y: 70, quadrant: 'healthy' },
  { x: 90, y: 60, quadrant: 'healthy' },
  { x: 20, y: 30, quadrant: 'techDebt' },
  { x: 40, y: 25, quadrant: 'techDebt' },
  { x: 30, y: 40, quadrant: 'techDebt' },
  { x: 70, y: 35, quadrant: 'quickWins' },
  { x: 85, y: 25, quadrant: 'quickWins' },
];

export function ChartStylePreview({ style, isSelected, onClick }: ChartStylePreviewProps) {
  const colors = STYLE_COLORS[style];
  const info = STYLE_INFO[style];

  return (
    <div
      className={`chart-style-preview style-${style} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      style={{ background: colors.bg }}
    >
      <div className="preview-chart">
        <ResponsiveContainer width="100%" height={120}>
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, 100]}
              hide
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[0, 100]}
              hide
            />
            <ReferenceLine x={60} stroke={colors.reference} strokeWidth={style === 'bold' ? 2 : 1} />
            <ReferenceLine y={50} stroke={colors.reference} strokeWidth={style === 'bold' ? 2 : 1} />
            <Scatter data={SAMPLE_DATA} isAnimationActive={false}>
              {SAMPLE_DATA.map((entry, i) => (
                <Cell
                  key={i}
                  fill={colors[entry.quadrant]}
                  fillOpacity={style === 'glass' ? 0.7 : style === 'minimal' ? 0.6 : 1}
                  stroke={style === 'bold' ? '#18181b' : 'none'}
                  strokeWidth={style === 'bold' ? 1.5 : 0}
                  style={style === 'neon' ? { filter: `drop-shadow(0 0 4px ${colors[entry.quadrant]})` } : undefined}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="preview-info">
        <span className="preview-name">{info.name}</span>
        <span className="preview-desc">{info.description}</span>
      </div>
      {isSelected && <div className="preview-check">✓</div>}
    </div>
  );
}

export function ChartStyleSelector({
  value,
  onChange
}: {
  value: ChartStyle;
  onChange: (style: ChartStyle) => void;
}) {
  const styles: ChartStyle[] = ['glass', 'neon', 'bold', 'minimal'];

  return (
    <div className="chart-style-selector">
      {styles.map(style => (
        <ChartStylePreview
          key={style}
          style={style}
          isSelected={value === style}
          onClick={() => onChange(style)}
        />
      ))}
    </div>
  );
}
