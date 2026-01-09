/**
 * Chart Style Prototypes
 *
 * Visual comparison of 4 different scatter chart styles for the Impact x Quality matrix.
 * User will pick their preferred style before full implementation.
 */

import { useState, useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Cell,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import './ChartPrototypes.css';

// Sample data for all charts
const generateSampleData = () => {
  const quadrants = ['critical', 'healthy', 'techDebt', 'quickWins'] as const;
  const data = [];

  // Generate clustered data for each quadrant
  for (let i = 0; i < 40; i++) {
    const quadrant = quadrants[Math.floor(Math.random() * 4)];
    let x, y;

    switch (quadrant) {
      case 'critical': // high usage, low quality
        x = 20 + Math.random() * 35;
        y = 55 + Math.random() * 40;
        break;
      case 'healthy': // high usage, high quality
        x = 65 + Math.random() * 30;
        y = 55 + Math.random() * 40;
        break;
      case 'techDebt': // low usage, low quality
        x = 15 + Math.random() * 40;
        y = 10 + Math.random() * 35;
        break;
      case 'quickWins': // low usage, high quality
        x = 65 + Math.random() * 30;
        y = 10 + Math.random() * 35;
        break;
    }

    data.push({
      id: `asset-${i}`,
      name: `Asset ${i + 1}`,
      x: Math.round(x),
      y: Math.round(y),
      z: 30 + Math.random() * 40,
      quadrant,
    });
  }

  return data;
};

// Quadrant colors for each style
const styleColors = {
  neon: {
    critical: '#ff006e',
    healthy: '#39ff14',
    techDebt: '#666666',
    quickWins: '#00f5ff',
  },
  glass: {
    critical: '#f87171',
    healthy: '#4ade80',
    techDebt: '#94a3b8',
    quickWins: '#60a5fa',
  },
  bold: {
    critical: '#dc2626',
    healthy: '#16a34a',
    techDebt: '#71717a',
    quickWins: '#2563eb',
  },
  minimal: {
    critical: '#ef4444',
    healthy: '#22c55e',
    techDebt: '#a1a1aa',
    quickWins: '#3b82f6',
  },
};

// Custom tooltip for each style
const NeonTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  return (
    <div className="tooltip-neon">
      <div className="tooltip-name">{data.name}</div>
      <div className="tooltip-stats">
        <span>Quality: {data.x}%</span>
        <span>Usage: {data.y}%</span>
      </div>
    </div>
  );
};

const GlassTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  return (
    <div className="tooltip-glass">
      <div className="tooltip-name">{data.name}</div>
      <div className="tooltip-stats">
        <span>Quality: {data.x}%</span>
        <span>Usage: {data.y}%</span>
      </div>
    </div>
  );
};

const BoldTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  return (
    <div className="tooltip-bold">
      <div className="tooltip-name">{data.name}</div>
      <div className="tooltip-stats">
        <span>Q: {data.x}%</span>
        <span>U: {data.y}%</span>
      </div>
    </div>
  );
};

const MinimalTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  return (
    <div className="tooltip-minimal">
      <span>{data.name}</span>
      <span>{data.x}% / {data.y}%</span>
    </div>
  );
};

export function ChartPrototypes() {
  const [hoveredStyle, setHoveredStyle] = useState<string | null>(null);
  const data = useMemo(() => generateSampleData(), []);

  return (
    <div className="prototypes-page">
      <header className="prototypes-header">
        <h1>Impact x Quality Matrix Styles</h1>
        <p>Compare visual approaches. Click to select your preferred style.</p>
      </header>

      <div className="prototypes-grid">
        {/* Style A: Glowing Neon on Dark */}
        <div
          className={`prototype-card neon ${hoveredStyle === 'neon' ? 'hovered' : ''}`}
          onMouseEnter={() => setHoveredStyle('neon')}
          onMouseLeave={() => setHoveredStyle(null)}
        >
          <div className="card-header">
            <h2>A. Glowing Neon</h2>
            <span className="style-tag">Futuristic</span>
          </div>
          <div className="chart-container neon-chart">
            <div className="quadrant-labels neon-labels">
              <span className="ql-critical">Critical</span>
              <span className="ql-healthy">Healthy</span>
              <span className="ql-techdebt">Tech Debt</span>
              <span className="ql-quickwins">Quick Wins</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0, 100]}
                  tick={{ fill: '#00f5ff', fontSize: 10 }}
                  axisLine={{ stroke: '#00f5ff33' }}
                  tickLine={{ stroke: '#00f5ff33' }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[0, 100]}
                  tick={{ fill: '#00f5ff', fontSize: 10 }}
                  axisLine={{ stroke: '#00f5ff33' }}
                  tickLine={{ stroke: '#00f5ff33' }}
                />
                <ZAxis type="number" dataKey="z" range={[40, 160]} />
                <ReferenceLine x={60} stroke="#ffffff22" strokeDasharray="3 3" />
                <ReferenceLine y={50} stroke="#ffffff22" strokeDasharray="3 3" />
                <Tooltip content={<NeonTooltip />} />
                <Scatter data={data} isAnimationActive={false}>
                  {data.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={styleColors.neon[entry.quadrant]}
                      style={{
                        filter: `drop-shadow(0 0 8px ${styleColors.neon[entry.quadrant]})`,
                      }}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="card-description">
            <p>Dark background with luminous, glowing data points. High contrast, cyberpunk aesthetic.</p>
            <ul>
              <li>Neon cyan, magenta, lime accents</li>
              <li>Glowing halos on points</li>
              <li>Subtle grid traces</li>
            </ul>
          </div>
        </div>

        {/* Style B: Soft Gradients & Glass */}
        <div
          className={`prototype-card glass ${hoveredStyle === 'glass' ? 'hovered' : ''}`}
          onMouseEnter={() => setHoveredStyle('glass')}
          onMouseLeave={() => setHoveredStyle(null)}
        >
          <div className="card-header">
            <h2>B. Soft Glass</h2>
            <span className="style-tag">Modern</span>
          </div>
          <div className="chart-container glass-chart">
            <div className="quadrant-labels glass-labels">
              <span className="ql-critical">Critical</span>
              <span className="ql-healthy">Healthy</span>
              <span className="ql-techdebt">Tech Debt</span>
              <span className="ql-quickwins">Quick Wins</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0, 100]}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[0, 100]}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={{ stroke: '#e2e8f0' }}
                />
                <ZAxis type="number" dataKey="z" range={[50, 180]} />
                <ReferenceLine x={60} stroke="#cbd5e1" strokeDasharray="4 4" />
                <ReferenceLine y={50} stroke="#cbd5e1" strokeDasharray="4 4" />
                <Tooltip content={<GlassTooltip />} />
                <Scatter data={data} isAnimationActive={false}>
                  {data.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={styleColors.glass[entry.quadrant]}
                      fillOpacity={0.7}
                      stroke={styleColors.glass[entry.quadrant]}
                      strokeWidth={1}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="card-description">
            <p>Light background with frosted glass effects. Soft pastels and gentle gradients.</p>
            <ul>
              <li>Mesh gradient backgrounds</li>
              <li>Frosted card overlays</li>
              <li>Apple-inspired softness</li>
            </ul>
          </div>
        </div>

        {/* Style C: Bold & Geometric */}
        <div
          className={`prototype-card bold ${hoveredStyle === 'bold' ? 'hovered' : ''}`}
          onMouseEnter={() => setHoveredStyle('bold')}
          onMouseLeave={() => setHoveredStyle(null)}
        >
          <div className="card-header">
            <h2>C. Bold Geometric</h2>
            <span className="style-tag">Decisive</span>
          </div>
          <div className="chart-container bold-chart">
            <div className="quadrant-labels bold-labels">
              <span className="ql-critical">CRITICAL</span>
              <span className="ql-healthy">HEALTHY</span>
              <span className="ql-techdebt">TECH DEBT</span>
              <span className="ql-quickwins">QUICK WINS</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0, 100]}
                  tick={{ fill: '#18181b', fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: '#18181b', strokeWidth: 2 }}
                  tickLine={{ stroke: '#18181b', strokeWidth: 2 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[0, 100]}
                  tick={{ fill: '#18181b', fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: '#18181b', strokeWidth: 2 }}
                  tickLine={{ stroke: '#18181b', strokeWidth: 2 }}
                />
                <ZAxis type="number" dataKey="z" range={[60, 200]} />
                <ReferenceLine x={60} stroke="#18181b" strokeWidth={3} />
                <ReferenceLine y={50} stroke="#18181b" strokeWidth={3} />
                <Tooltip content={<BoldTooltip />} />
                <Scatter data={data} isAnimationActive={false}>
                  {data.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={styleColors.bold[entry.quadrant]}
                      stroke="#18181b"
                      strokeWidth={2}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="card-description">
            <p>Strong primary colors, sharp lines, brutalist typography. No gradients.</p>
            <ul>
              <li>Thick divider lines</li>
              <li>Bold, uppercase labels</li>
              <li>Stripe/Linear inspired</li>
            </ul>
          </div>
        </div>

        {/* Style D: Data-Ink Focused */}
        <div
          className={`prototype-card minimal ${hoveredStyle === 'minimal' ? 'hovered' : ''}`}
          onMouseEnter={() => setHoveredStyle('minimal')}
          onMouseLeave={() => setHoveredStyle(null)}
        >
          <div className="card-header">
            <h2>D. Data-Ink Minimal</h2>
            <span className="style-tag">Tufte</span>
          </div>
          <div className="chart-container minimal-chart">
            <div className="quadrant-labels minimal-labels">
              <span className="ql-critical">Critical</span>
              <span className="ql-healthy">Healthy</span>
              <span className="ql-techdebt">Tech Debt</span>
              <span className="ql-quickwins">Quick Wins</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0, 100]}
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[0, 100]}
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <ZAxis type="number" dataKey="z" range={[30, 120]} />
                <ReferenceLine x={60} stroke="#e4e4e7" strokeWidth={1} />
                <ReferenceLine y={50} stroke="#e4e4e7" strokeWidth={1} />
                <Tooltip content={<MinimalTooltip />} />
                <Scatter data={data} isAnimationActive={false}>
                  {data.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.quadrant === 'critical' ? styleColors.minimal.critical : '#d4d4d8'}
                      fillOpacity={entry.quadrant === 'critical' ? 1 : 0.6}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="card-description">
            <p>Maximum white space, minimal decoration. Only critical points are highlighted.</p>
            <ul>
              <li>Grayscale + one accent</li>
              <li>No axis lines</li>
              <li>Focus on the data</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="prototypes-footer">
        <p>Which style best fits your data platform's aesthetic?</p>
      </div>
    </div>
  );
}
