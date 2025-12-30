/**
 * Lineage Metrics Panel
 * 
 * Displays coverage and quality metrics for the lineage graph
 */

import { memo } from 'react';
import { TrendingUp, AlertCircle } from 'lucide-react';
import type { LineageMetrics } from '../../types/lineage';
import './LineageMetricsPanel.css';

interface LineageMetricsPanelProps {
  metrics: LineageMetrics;
}

function LineageMetricsPanelComponent({ metrics }: LineageMetricsPanelProps) {
  const { coverage, quality, freshness } = metrics;

  return (
    <div className="lineage-metrics-panel">
      <div className="lineage-metrics-header">
        <TrendingUp size={16} />
        <span>Metrics</span>
      </div>

      <div className="lineage-metrics-content">
        {/* Coverage Metrics */}
        <div className="metrics-section">
          <h4>Coverage</h4>
          <div className="metric-row">
            <span className="metric-label">Total Assets:</span>
            <span className="metric-value">{coverage.totalAssets}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Total Processes:</span>
            <span className="metric-value">{coverage.totalProcesses}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">With Upstream:</span>
            <span className="metric-value">{coverage.withUpstream}</span>
            <span className="metric-percentage">
              ({Math.round((coverage.withUpstream / coverage.totalAssets) * 100)}%)
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">With Downstream:</span>
            <span className="metric-value">{coverage.withDownstream}</span>
            <span className="metric-percentage">
              ({Math.round((coverage.withDownstream / coverage.totalAssets) * 100)}%)
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Full Lineage:</span>
            <span className="metric-value">{coverage.withFullLineage}</span>
            <span className="metric-percentage">
              ({Math.round((coverage.withFullLineage / coverage.totalAssets) * 100)}%)
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Orphaned:</span>
            <span className={`metric-value ${coverage.orphaned > 0 ? 'metric-warning' : ''}`}>
              {coverage.orphaned}
            </span>
            {coverage.orphaned > 0 && <AlertCircle size={14} className="metric-icon-warning" />}
          </div>
          <div className="metric-row">
            <span className="metric-label">Coverage:</span>
            <span className={`metric-value metric-score-${coverage.coveragePercentage >= 80 ? 'high' : coverage.coveragePercentage >= 50 ? 'medium' : 'low'}`}>
              {coverage.coveragePercentage}%
            </span>
          </div>
        </div>

        {/* Quality Metrics */}
        {quality.avgOverall > 0 && (
          <div className="metrics-section">
            <h4>Quality Scores</h4>
            <div className="metric-row">
              <span className="metric-label">Overall:</span>
              <span className={`metric-value metric-score-${quality.avgOverall >= 80 ? 'high' : quality.avgOverall >= 50 ? 'medium' : 'low'}`}>
                {quality.avgOverall}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Completeness:</span>
              <span className="metric-value">{quality.avgCompleteness}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Accuracy:</span>
              <span className="metric-value">{quality.avgAccuracy}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Timeliness:</span>
              <span className="metric-value">{quality.avgTimeliness}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Consistency:</span>
              <span className="metric-value">{quality.avgConsistency}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Usability:</span>
              <span className="metric-value">{quality.avgUsability}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Assets with Issues:</span>
              <span className={`metric-value ${quality.assetsWithIssues > 0 ? 'metric-warning' : ''}`}>
                {quality.assetsWithIssues}
              </span>
              <span className="metric-percentage">
                ({quality.assetsWithIssuesPercentage}%)
              </span>
              {quality.assetsWithIssues > 0 && <AlertCircle size={14} className="metric-icon-warning" />}
            </div>
          </div>
        )}

        {/* Freshness Metrics */}
        {freshness && (
          <div className="metrics-section">
            <h4>Freshness</h4>
            <div className="metric-row">
              <span className="metric-label">Stale Assets:</span>
              <span className={`metric-value ${freshness.staleAssets > 0 ? 'metric-warning' : ''}`}>
                {freshness.staleAssets}
              </span>
              <span className="metric-percentage">
                ({freshness.stalePercentage}%)
              </span>
              {freshness.staleAssets > 0 && <AlertCircle size={14} className="metric-icon-warning" />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const LineageMetricsPanel = memo(LineageMetricsPanelComponent);

