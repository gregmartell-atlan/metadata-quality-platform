/**
 * View Configuration Flyout
 *
 * Context-aware right-edge flyout that shows different configuration
 * based on which page you're on (Dashboard, Pivot, Lineage, etc.)
 */

import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Settings, ChevronRight, ChevronLeft, Sliders } from 'lucide-react';
import { PivotConfigurator } from '../pivot/PivotConfigurator';
import { useUIPreferences } from '../../stores/uiPreferencesStore';
import type { RowDimension, Measure } from '../../types/pivot';
import './ViewConfigFlyout.css';

interface ViewConfigFlyoutProps {
  isOpen: boolean;
  onToggle: () => void; // Changed from onClose to onToggle
  // Pivot-specific props (passed from Pivot Builder page)
  pivotRowDimensions?: RowDimension[];
  pivotMeasures?: Measure[];
  onPivotRowDimensionsChange?: (dimensions: RowDimension[]) => void;
  onPivotMeasuresChange?: (measures: Measure[]) => void;
}

export function ViewConfigFlyout({
  isOpen,
  onToggle,
  pivotRowDimensions = [],
  pivotMeasures = [],
  onPivotRowDimensionsChange,
  onPivotMeasuresChange,
}: ViewConfigFlyoutProps) {
  const location = useLocation();
  const {
    dashboardHeatmapDimension,
    dashboardOwnerPivotDimension,
    dashboardOwnerPivotColumn,
    setDashboardHeatmapDimension,
    setDashboardOwnerPivotDimension,
    setDashboardOwnerPivotColumn,
  } = useUIPreferences();

  // Determine which page we're on
  const currentPage = useMemo(() => {
    if (location.pathname.includes('/pivot')) return 'pivot';
    if (location.pathname.includes('/lineage')) return 'lineage';
    if (location.pathname === '/') return 'dashboard';
    return 'other';
  }, [location.pathname]);

  const getTitle = () => {
    switch (currentPage) {
      case 'pivot': return 'Configure Pivot';
      case 'dashboard': return 'Configure Dashboard';
      case 'lineage': return 'Configure Lineage';
      default: return 'Configure View';
    }
  };

  return (
    <div className={`view-config-flyout ${isOpen ? 'open' : 'collapsed'}`}>
      {/* Collapsed Tab */}
      {!isOpen && (
        <button
          className="flyout-collapsed-tab"
          onClick={onToggle}
          title={getTitle()}
        >
          <ChevronLeft size={14} />
          <Sliders size={16} />
          <span className="collapsed-label">Configure</span>
        </button>
      )}

      {/* Flyout Panel */}
      {isOpen && (
        <div className="flyout-panel">
          <div className="flyout-header">
            <button
              className="flyout-close-btn"
              onClick={onToggle}
              title="Close configuration"
            >
              <ChevronRight size={16} />
            </button>
            <div className="flyout-title">
              <Sliders size={16} />
              <span>{getTitle()}</span>
            </div>
          </div>

          <div className="flyout-body">
            {/* Pivot Configuration */}
            {currentPage === 'pivot' && onPivotRowDimensionsChange && onPivotMeasuresChange && (
              <PivotConfigurator
                rowDimensions={pivotRowDimensions}
                measures={pivotMeasures}
                onRowDimensionsChange={onPivotRowDimensionsChange}
                onMeasuresChange={onPivotMeasuresChange}
                alwaysExpanded={true}
              />
            )}

            {/* Dashboard Configuration */}
            {currentPage === 'dashboard' && (
              <div className="dashboard-config">
                <div className="config-section">
                  <label className="config-label">Heatmap Pivot Dimension</label>
                  <select
                    className="config-select"
                    value={dashboardHeatmapDimension}
                    onChange={(e) => setDashboardHeatmapDimension(e.target.value)}
                  >
                    <option value="domain">Domain</option>
                    <option value="owner">Owner</option>
                    <option value="schema">Schema</option>
                    <option value="connection">Connection</option>
                    <option value="tag">Tag</option>
                    <option value="certification">Certification Status</option>
                    <option value="classification">Classification</option>
                    <option value="assetType">Asset Type</option>
                  </select>
                </div>

                <div className="config-section">
                  <label className="config-label">Owner Pivot Dimension</label>
                  <select
                    className="config-select"
                    value={dashboardOwnerPivotDimension}
                    onChange={(e) => setDashboardOwnerPivotDimension(e.target.value)}
                  >
                    <option value="ownerGroup">Owner Group</option>
                    <option value="tag">Tag</option>
                    <option value="certification">Certification Status</option>
                    <option value="classification">Classification</option>
                    <option value="assetType">Asset Type</option>
                    <option value="schema">Schema</option>
                    <option value="connection">Connection</option>
                  </select>
                </div>

                <div className="config-section">
                  <label className="config-label">Owner Pivot Quality Column</label>
                  <select
                    className="config-select"
                    value={dashboardOwnerPivotColumn}
                    onChange={(e) => setDashboardOwnerPivotColumn(e.target.value)}
                  >
                    <option value="completeness">Completeness</option>
                    <option value="accuracy">Accuracy</option>
                    <option value="timeliness">Timeliness</option>
                    <option value="consistency">Consistency</option>
                    <option value="usability">Usability</option>
                  </select>
                </div>

                <p className="config-hint">
                  Changes apply immediately and persist across sessions
                </p>
              </div>
            )}

            {/* Lineage Configuration */}
            {currentPage === 'lineage' && (
              <div className="lineage-config">
                <p className="config-hint">
                  Lineage configuration is available in the left panel on the Lineage page.
                  Use this flyout for quick access to common settings.
                </p>
                <div className="config-section">
                  <label className="config-label">Coming Soon</label>
                  <p className="config-text">
                    Quick lineage configuration will be added here
                  </p>
                </div>
              </div>
            )}

            {/* Other Pages */}
            {currentPage === 'other' && (
              <div className="generic-config">
                <p className="config-hint">
                  No view-specific configuration available for this page.
                  Use Global Settings (⚙️) for app-wide preferences.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
