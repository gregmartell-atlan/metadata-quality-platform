/**
 * Lineage Configuration Panel
 * 
 * Allows users to configure lineage view settings
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Settings, Search } from 'lucide-react';
import type { LineageViewConfig } from '../../types/lineage';
import type { AtlanAsset } from '../../services/atlan/types';
import './LineageConfigPanel.css';

interface LineageConfigPanelProps {
  config: LineageViewConfig;
  centerAsset: AtlanAsset;
  availableAssets: AtlanAsset[];
  onConfigChange: (config: Partial<LineageViewConfig>) => void;
  onCenterAssetChange: (asset: AtlanAsset) => void;
  onRefresh: () => void;
  loading: boolean;
}

export function LineageConfigPanel({
  config,
  centerAsset,
  availableAssets,
  onConfigChange,
  onCenterAssetChange,
  onRefresh,
  loading,
}: LineageConfigPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [assetSearch, setAssetSearch] = useState('');

  const assetTypes = Array.from(
    new Set(availableAssets.map((a) => a.typeName).filter(Boolean))
  ).sort();

  // Connection filter available but not used in current UI - kept for future use
  // const connections = Array.from(
  //   new Set(availableAssets.map((a) => a.connectionName || a.connectionQualifiedName).filter(Boolean))
  // ).sort();

  const filteredAssets = availableAssets.filter((asset) => {
    if (!assetSearch) return true;
    const searchLower = assetSearch.toLowerCase();
    return (
      asset.name?.toLowerCase().includes(searchLower) ||
      asset.qualifiedName?.toLowerCase().includes(searchLower) ||
      asset.guid.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="lineage-config-panel">
      <div className="lineage-config-header" onClick={() => setExpanded(!expanded)}>
        <div className="lineage-config-title">
          <Settings size={16} />
          <span>Configuration</span>
        </div>
        <div className="lineage-config-actions">
          <button
            className="icon-button"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            disabled={loading}
            title="Refresh lineage"
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {expanded && (
        <div className="lineage-config-content">
          {/* Center Asset Selection */}
          <div className="config-section">
            <label>Center Asset</label>
            <div className="asset-search-wrapper">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search assets..."
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className="asset-search-input"
              />
            </div>
            <select
              value={centerAsset.guid}
              onChange={(e) => {
                const asset = filteredAssets.find((a) => a.guid === e.target.value);
                if (asset) onCenterAssetChange(asset);
              }}
              className="asset-select"
            >
              {filteredAssets.map((asset) => (
                <option key={asset.guid} value={asset.guid}>
                  {asset.name || asset.qualifiedName || asset.guid}
                </option>
              ))}
            </select>
          </div>

          {/* Depth */}
          <div className="config-section">
            <label>
              Depth: {config.depth}
              <input
                type="range"
                min="1"
                max="5"
                value={config.depth}
                onChange={(e) => onConfigChange({ depth: parseInt(e.target.value) })}
              />
            </label>
          </div>

          {/* Direction */}
          <div className="config-section">
            <label>Direction</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="both"
                  checked={config.direction === 'both'}
                  onChange={(e) => onConfigChange({ direction: e.target.value as any })}
                />
                Both
              </label>
              <label>
                <input
                  type="radio"
                  value="upstream"
                  checked={config.direction === 'upstream'}
                  onChange={(e) => onConfigChange({ direction: e.target.value as any })}
                />
                Upstream
              </label>
              <label>
                <input
                  type="radio"
                  value="downstream"
                  checked={config.direction === 'downstream'}
                  onChange={(e) => onConfigChange({ direction: e.target.value as any })}
                />
                Downstream
              </label>
            </div>
          </div>

          {/* Layout */}
          <div className="config-section">
            <label>Layout</label>
            <select
              value={config.layout}
              onChange={(e) => onConfigChange({ layout: e.target.value as any })}
            >
              <option value="hierarchical">Hierarchical</option>
              <option value="radial">Radial</option>
            </select>
          </div>

          {/* View Mode */}
          <div className="config-section">
            <label>View Mode</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="table"
                  checked={config.viewMode === 'table'}
                  onChange={(e) => onConfigChange({ viewMode: e.target.value as any })}
                />
                Table
              </label>
              <label>
                <input
                  type="radio"
                  value="column"
                  checked={config.viewMode === 'column'}
                  onChange={(e) => onConfigChange({ viewMode: e.target.value as any })}
                />
                Column
              </label>
            </div>
          </div>

          {/* Type Filter */}
          <div className="config-section">
            <label>Filter by Type</label>
            <div className="checkbox-group">
              {assetTypes.map((type) => (
                <label key={type}>
                  <input
                    type="checkbox"
                    checked={config.filterByType.includes(type)}
                    onChange={(e) => {
                      const newTypes = e.target.checked
                        ? [...config.filterByType, type]
                        : config.filterByType.filter((t) => t !== type);
                      onConfigChange({ filterByType: newTypes });
                    }}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>

          {/* Quality Filter */}
          <div className="config-section">
            <label>
              <input
                type="checkbox"
                checked={config.filterByQuality.enabled}
                onChange={(e) =>
                  onConfigChange({
                    filterByQuality: { ...config.filterByQuality, enabled: e.target.checked },
                  })
                }
              />
              Filter by Quality
            </label>
            {config.filterByQuality.enabled && (
              <label className="sub-label">
                Threshold: &lt; {config.filterByQuality.threshold}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={config.filterByQuality.threshold}
                  onChange={(e) =>
                    onConfigChange({
                      filterByQuality: {
                        ...config.filterByQuality,
                        threshold: parseInt(e.target.value),
                      },
                    })
                  }
                />
              </label>
            )}
          </div>

          {/* Analysis Modes */}
          <div className="config-section">
            <label>Analysis Modes</label>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={config.impactAnalysisMode}
                  onChange={(e) => onConfigChange({ impactAnalysisMode: e.target.checked })}
                />
                Impact Analysis
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.rootCauseMode}
                  onChange={(e) => onConfigChange({ rootCauseMode: e.target.checked })}
                />
                Root Cause Analysis
              </label>
            </div>
          </div>

          {/* Display Options */}
          <div className="config-section">
            <label>Display Options</label>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={config.showCoverage}
                  onChange={(e) => onConfigChange({ showCoverage: e.target.checked })}
                />
                Show Coverage Indicators
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.showQualityScores}
                  onChange={(e) => onConfigChange({ showQualityScores: e.target.checked })}
                />
                Show Quality Scores
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.showFreshness}
                  onChange={(e) => onConfigChange({ showFreshness: e.target.checked })}
                />
                Show Freshness Indicators
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.showGovernance}
                  onChange={(e) => onConfigChange({ showGovernance: e.target.checked })}
                />
                Show Governance Badges
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.showMetrics}
                  onChange={(e) => onConfigChange({ showMetrics: e.target.checked })}
                />
                Show Metrics Panel
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

