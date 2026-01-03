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

export function DaaPRadarChart({ matrix }: DaaPRadarChartProps) {
  // Calculate scores for each dimension based on the matrix requirements
  const calculateScore = (dimension: string) => {
    const totalAssets = matrix.assetTypeRequirements.length || 1;
    let score = 0;

    matrix.assetTypeRequirements.forEach(req => {
      const fields = req.requirements.map(r => r.field);

      switch (dimension) {
        case 'Discoverable':
          // Description, Owners, Tags, Terms
          if (fields.includes('description')) score += 0.25;
          if (fields.includes('ownerUsers') || fields.includes('ownerGroups')) score += 0.25;
          if (fields.includes('tags')) score += 0.25;
          if (fields.includes('assignedTerms')) score += 0.25;
          break;
        case 'Addressable':
          // Qualified Name (always there), Connection, Database, Schema
          score += 1; // Basic addressability is usually inherent
          break;
        case 'Trustworthy':
          // Lineage, Quality
          if (fields.includes('lineage')) score += 0.5;
          if (fields.includes('certificateStatus')) score += 0.5;
          break;
        case 'Self-describing':
          // Columns, Data Types (usually inherent), Readme
          if (fields.includes('readme')) score += 0.5;
          if (fields.includes('columns')) score += 0.5;
          break;
        case 'Interoperable':
          // Standards, Formats (placeholder logic)
          score += 0.6;
          break;
        case 'Secure':
          // Classifications
          if (fields.includes('classifications')) score += 1;
          break;
        case 'Reusable':
          // Usage stats, popularity
          score += 0.5;
          break;
      }
    });

    // Normalize to 0-100
    return Math.min(100, Math.round((score / totalAssets) * 100));
  };

  const data = [
    { subject: 'Discoverable', score: calculateScore('Discoverable'), fullMark: 100 },
    { subject: 'Addressable', score: calculateScore('Addressable'), fullMark: 100 },
    { subject: 'Trustworthy', score: calculateScore('Trustworthy'), fullMark: 100 },
    { subject: 'Self-describing', score: calculateScore('Self-describing'), fullMark: 100 },
    { subject: 'Interoperable', score: calculateScore('Interoperable'), fullMark: 100 },
    { subject: 'Secure', score: calculateScore('Secure'), fullMark: 100 },
    { subject: 'Reusable', score: calculateScore('Reusable'), fullMark: 100 },
  ];

  // Custom tooltip content with dimension descriptions
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { subject: string; score: number } }> }) => {
    if (active && payload && payload.length) {
      const { subject, score } = payload[0].payload;
      const dimensionInfo = getDimensionInfo(subject);
      const bandInfo = getScoreBandInfo(score);

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
          </div>
          {dimensionInfo && (
            <p className="daap-tooltip-desc">{dimensionInfo.description}</p>
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
