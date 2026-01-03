/**
 * DaaPRadarChart - Data as a Product Radar Chart
 *
 * Visualizes compliance across the 7 DaaP dimensions:
 * Discoverable, Addressable, Trustworthy, Self-describing,
 * Interoperable, Secure, Reusable
 */

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { InfoTooltip } from '../shared';
import { getDimensionInfo, getScoreBandInfo } from '../../constants/metadataDescriptions';
import type { RequirementsMatrix } from '../../types/requirements';
import './DaaPRadarChart.css';

interface DaaPRadarChartProps {
  matrix: RequirementsMatrix;
}

// Type for tracking score breakdown
interface ScoreBreakdown {
  score: number;
  maxScore: number;
  factors: { name: string; present: boolean; weight: number }[];
}

export function DaaPRadarChart({ matrix }: DaaPRadarChartProps) {
  // Calculate scores for each dimension with breakdown
  const calculateScoreWithBreakdown = (dimension: string): ScoreBreakdown => {
    const totalAssets = matrix.assetTypeRequirements.length || 1;
    let score = 0;
    const factors: { name: string; present: boolean; weight: number }[] = [];

    matrix.assetTypeRequirements.forEach(req => {
      const fields = req.requirements.map(r => r.field);

      switch (dimension) {
        case 'Discoverable':
          factors.push({ name: 'Description', present: fields.includes('description'), weight: 0.25 });
          factors.push({ name: 'Owners', present: fields.includes('ownerUsers') || fields.includes('ownerGroups'), weight: 0.25 });
          factors.push({ name: 'Tags', present: fields.includes('tags'), weight: 0.25 });
          factors.push({ name: 'Terms', present: fields.includes('assignedTerms'), weight: 0.25 });
          if (fields.includes('description')) score += 0.25;
          if (fields.includes('ownerUsers') || fields.includes('ownerGroups')) score += 0.25;
          if (fields.includes('tags')) score += 0.25;
          if (fields.includes('assignedTerms')) score += 0.25;
          break;
        case 'Addressable':
          factors.push({ name: 'Qualified Name', present: true, weight: 0.5 });
          factors.push({ name: 'Connection Info', present: true, weight: 0.5 });
          score += 1;
          break;
        case 'Trustworthy':
          factors.push({ name: 'Lineage', present: fields.includes('lineage'), weight: 0.5 });
          factors.push({ name: 'Certification', present: fields.includes('certificateStatus'), weight: 0.5 });
          if (fields.includes('lineage')) score += 0.5;
          if (fields.includes('certificateStatus')) score += 0.5;
          break;
        case 'Self-describing':
          factors.push({ name: 'README', present: fields.includes('readme'), weight: 0.5 });
          factors.push({ name: 'Column Metadata', present: fields.includes('columns'), weight: 0.5 });
          if (fields.includes('readme')) score += 0.5;
          if (fields.includes('columns')) score += 0.5;
          break;
        case 'Interoperable':
          factors.push({ name: 'Standard Formats', present: true, weight: 0.6 });
          factors.push({ name: 'API Access', present: false, weight: 0.4 });
          score += 0.6;
          break;
        case 'Secure':
          factors.push({ name: 'Classifications', present: fields.includes('classifications'), weight: 1.0 });
          if (fields.includes('classifications')) score += 1;
          break;
        case 'Reusable':
          factors.push({ name: 'Usage Stats', present: true, weight: 0.5 });
          factors.push({ name: 'Popularity', present: false, weight: 0.5 });
          score += 0.5;
          break;
      }
    });

    const finalScore = Math.min(100, Math.round((score / totalAssets) * 100));
    // Deduplicate factors (they get added for each asset type)
    const uniqueFactors = factors.filter((f, i, arr) =>
      arr.findIndex(x => x.name === f.name) === i
    );

    return { score: finalScore, maxScore: 100, factors: uniqueFactors };
  };

  // Create data with breakdowns
  const dimensionBreakdowns: Record<string, ScoreBreakdown> = {
    'Discoverable': calculateScoreWithBreakdown('Discoverable'),
    'Addressable': calculateScoreWithBreakdown('Addressable'),
    'Trustworthy': calculateScoreWithBreakdown('Trustworthy'),
    'Self-describing': calculateScoreWithBreakdown('Self-describing'),
    'Interoperable': calculateScoreWithBreakdown('Interoperable'),
    'Secure': calculateScoreWithBreakdown('Secure'),
    'Reusable': calculateScoreWithBreakdown('Reusable'),
  };

  const data = [
    { subject: 'Discoverable', score: dimensionBreakdowns['Discoverable'].score, fullMark: 100 },
    { subject: 'Addressable', score: dimensionBreakdowns['Addressable'].score, fullMark: 100 },
    { subject: 'Trustworthy', score: dimensionBreakdowns['Trustworthy'].score, fullMark: 100 },
    { subject: 'Self-describing', score: dimensionBreakdowns['Self-describing'].score, fullMark: 100 },
    { subject: 'Interoperable', score: dimensionBreakdowns['Interoperable'].score, fullMark: 100 },
    { subject: 'Secure', score: dimensionBreakdowns['Secure'].score, fullMark: 100 },
    { subject: 'Reusable', score: dimensionBreakdowns['Reusable'].score, fullMark: 100 },
  ];

  // Custom tooltip content with dimension descriptions and breakdown
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { subject: string; score: number } }> }) => {
    if (active && payload && payload.length) {
      const { subject, score } = payload[0].payload;
      const dimensionInfo = getDimensionInfo(subject);
      const bandInfo = getScoreBandInfo(score);
      const breakdown = dimensionBreakdowns[subject];

      return (
        <div className="daap-tooltip">
          <div className="daap-tooltip-header">
            <span className="daap-tooltip-dimension">{subject}</span>
            <span className={`daap-tooltip-band daap-band-${bandInfo.name.toLowerCase()}`}>
              {bandInfo.name}
            </span>
          </div>
          <div className="daap-tooltip-score">
            <span className="daap-tooltip-value">{score}%</span>
            <span className="daap-tooltip-max">/ 100</span>
          </div>
          {dimensionInfo && (
            <p className="daap-tooltip-desc">{dimensionInfo.description}</p>
          )}
          {breakdown && breakdown.factors.length > 0 && (
            <div className="daap-tooltip-breakdown">
              <span className="daap-tooltip-breakdown-label">Calculation breakdown:</span>
              <ul className="daap-tooltip-factors">
                {breakdown.factors.map((factor, i) => (
                  <li key={i} className={factor.present ? 'factor-present' : 'factor-missing'}>
                    <span className="factor-icon">{factor.present ? '✓' : '✗'}</span>
                    <span className="factor-name">{factor.name}</span>
                    <span className="factor-weight">{Math.round(factor.weight * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="daap-tooltip-action">{bandInfo.action}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="daap-radar-chart">
      <div className="daap-radar-header">
        <h3 className="daap-radar-title">Data as a Product Score</h3>
        <InfoTooltip
          content={
            <div className="daap-info-tooltip">
              <strong>Data as a Product (DaaP)</strong>
              <p>
                This radar chart shows compliance across the 7 dimensions of treating data as a product.
                Higher scores indicate better alignment with DaaP principles.
              </p>
              <div className="daap-info-dimensions">
                <span>The 7 dimensions are:</span>
                <ul>
                  <li><strong>Discoverable</strong> - Easy to find and search</li>
                  <li><strong>Addressable</strong> - Uniquely identifiable</li>
                  <li><strong>Trustworthy</strong> - Reliable with lineage</li>
                  <li><strong>Self-describing</strong> - Well documented</li>
                  <li><strong>Interoperable</strong> - Standards-compliant</li>
                  <li><strong>Secure</strong> - Properly classified</li>
                  <li><strong>Reusable</strong> - Ready for multiple consumers</li>
                </ul>
              </div>
            </div>
          }
          position="bottom"
        />
      </div>
      <div className="daap-radar-container">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="var(--border-subtle)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            />
            <Radar
              name="Current Plan"
              dataKey="score"
              stroke="var(--color-blue-500)"
              fill="var(--color-blue-500)"
              fillOpacity={0.3}
            />
            <RechartsTooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
