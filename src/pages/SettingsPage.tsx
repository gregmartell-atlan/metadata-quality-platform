/**
 * SettingsPage - Full settings page with organized sections
 *
 * Replaces the drawer-based settings with a dedicated page
 */

import { AppHeader } from '../components/layout/AppHeader';
import { Card } from '../components/shared';
import {
  Monitor,
  Palette,
  Filter,
  LayoutDashboard,
  Table2,
  RotateCcw,
  Eye,
  Clock,
  ShieldCheck,
  Rows3,
  BarChart3,
} from 'lucide-react';
import { useUIPreferences, type CertificationStatus } from '../stores/uiPreferencesStore';
import './SettingsPage.css';

export function SettingsPage() {
  const {
    // Display
    density,
    theme,
    setDensity,
    setTheme,

    // Asset Browser
    showPopularityBadges,
    setShowPopularityBadges,

    // Global Filters
    globalTimeRange,
    globalCertificationFilter,
    setGlobalTimeRange,
    setGlobalCertificationFilter,

    // Dashboard
    dashboardHeatmapDimension,
    dashboardOwnerPivotDimension,
    dashboardOwnerPivotColumn,
    setDashboardHeatmapDimension,
    setDashboardOwnerPivotDimension,
    setDashboardOwnerPivotColumn,

    // Pivot
    pivotDefaultRowDimensions,
    pivotDefaultMeasures,
    setPivotDefaultRowDimensions,
    setPivotDefaultMeasures,

    // Reset
    resetToDefaults,
  } = useUIPreferences();

  const toggleCertificationStatus = (status: CertificationStatus) => {
    if (globalCertificationFilter.includes(status)) {
      setGlobalCertificationFilter(globalCertificationFilter.filter((s) => s !== status));
    } else {
      setGlobalCertificationFilter([...globalCertificationFilter, status]);
    }
  };

  return (
    <div className="settings-page">
      <AppHeader title="Settings" subtitle="Configure your workspace preferences" />

      <div className="settings-content">
        {/* Appearance Section */}
        <Card className="settings-card">
          <div className="settings-card-header">
            <Palette size={20} />
            <div>
              <h3>Appearance</h3>
              <p>Customize the look and feel</p>
            </div>
          </div>
          <div className="settings-card-body">
            <div className="setting-row">
              <div className="setting-info">
                <Monitor size={16} />
                <div>
                  <label>UI Density</label>
                  <span>Adjust spacing and sizing</span>
                </div>
              </div>
              <div className="setting-control">
                <div className="segment-control">
                  <button
                    className={density === 'compact' ? 'active' : ''}
                    onClick={() => setDensity('compact')}
                  >
                    Compact
                  </button>
                  <button
                    className={density === 'comfortable' ? 'active' : ''}
                    onClick={() => setDensity('comfortable')}
                  >
                    Comfortable
                  </button>
                  <button
                    className={density === 'spacious' ? 'active' : ''}
                    onClick={() => setDensity('spacious')}
                  >
                    Spacious
                  </button>
                </div>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <Palette size={16} />
                <div>
                  <label>Theme</label>
                  <span>Choose color scheme</span>
                </div>
              </div>
              <div className="setting-control">
                <div className="segment-control">
                  <button
                    className={theme === 'light' ? 'active' : ''}
                    onClick={() => setTheme('light')}
                  >
                    Light
                  </button>
                  <button
                    className={theme === 'dark' ? 'active' : ''}
                    onClick={() => setTheme('dark')}
                  >
                    Dark
                  </button>
                  <button
                    className={theme === 'auto' ? 'active' : ''}
                    onClick={() => setTheme('auto')}
                  >
                    Auto
                  </button>
                </div>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <Eye size={16} />
                <div>
                  <label>Popularity Badges</label>
                  <span>Show usage indicators on assets</span>
                </div>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={showPopularityBadges}
                    onChange={(e) => setShowPopularityBadges(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </div>
        </Card>

        {/* Global Filters Section */}
        <Card className="settings-card">
          <div className="settings-card-header">
            <Filter size={20} />
            <div>
              <h3>Global Filters</h3>
              <p>Apply across Dashboard, Pivots, and Lineage views</p>
            </div>
          </div>
          <div className="settings-card-body">
            <div className="setting-row">
              <div className="setting-info">
                <Clock size={16} />
                <div>
                  <label>Time Range</label>
                  <span>Default time period for data</span>
                </div>
              </div>
              <div className="setting-control">
                <select
                  value={globalTimeRange}
                  onChange={(e) => setGlobalTimeRange(e.target.value as typeof globalTimeRange)}
                  className="setting-select"
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="all">All Time</option>
                </select>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <ShieldCheck size={16} />
                <div>
                  <label>Certification Filter</label>
                  <span>
                    {globalCertificationFilter.length === 0
                      ? 'Showing all statuses'
                      : `Showing: ${globalCertificationFilter.join(', ')}`}
                  </span>
                </div>
              </div>
              <div className="setting-control">
                <div className="checkbox-group-horizontal">
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={globalCertificationFilter.includes('VERIFIED')}
                      onChange={() => toggleCertificationStatus('VERIFIED')}
                    />
                    <span>Verified</span>
                  </label>
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={globalCertificationFilter.includes('DRAFT')}
                      onChange={() => toggleCertificationStatus('DRAFT')}
                    />
                    <span>Draft</span>
                  </label>
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={globalCertificationFilter.includes('DEPRECATED')}
                      onChange={() => toggleCertificationStatus('DEPRECATED')}
                    />
                    <span>Deprecated</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Dashboard Defaults Section */}
        <Card className="settings-card">
          <div className="settings-card-header">
            <LayoutDashboard size={20} />
            <div>
              <h3>Dashboard Defaults</h3>
              <p>Default settings for the Executive Dashboard</p>
            </div>
          </div>
          <div className="settings-card-body">
            <div className="setting-row">
              <div className="setting-info">
                <Rows3 size={16} />
                <div>
                  <label>Heatmap Pivot</label>
                  <span>Default row dimension for quality heatmap</span>
                </div>
              </div>
              <div className="setting-control">
                <select
                  value={dashboardHeatmapDimension}
                  onChange={(e) => setDashboardHeatmapDimension(e.target.value)}
                  className="setting-select"
                >
                  <option value="domain">Domain</option>
                  <option value="owner">Owner</option>
                  <option value="schema">Schema</option>
                  <option value="connection">Connection</option>
                  <option value="tag">Tag</option>
                  <option value="certificationStatus">Certification Status</option>
                  <option value="classification">Classification</option>
                  <option value="assetType">Asset Type</option>
                </select>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <Table2 size={16} />
                <div>
                  <label>Owner Pivot Dimension</label>
                  <span>Default grouping for owner analysis</span>
                </div>
              </div>
              <div className="setting-control">
                <select
                  value={dashboardOwnerPivotDimension}
                  onChange={(e) => setDashboardOwnerPivotDimension(e.target.value)}
                  className="setting-select"
                >
                  <option value="ownerGroup">Owner Group</option>
                  <option value="tag">Tag</option>
                  <option value="certificationStatus">Certification Status</option>
                  <option value="classification">Classification</option>
                  <option value="assetType">Asset Type</option>
                  <option value="schema">Schema</option>
                  <option value="connection">Connection</option>
                </select>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <BarChart3 size={16} />
                <div>
                  <label>Owner Pivot Measure</label>
                  <span>Quality dimension to display</span>
                </div>
              </div>
              <div className="setting-control">
                <select
                  value={dashboardOwnerPivotColumn}
                  onChange={(e) => setDashboardOwnerPivotColumn(e.target.value)}
                  className="setting-select"
                >
                  <option value="completeness">Completeness</option>
                  <option value="accuracy">Accuracy</option>
                  <option value="timeliness">Timeliness</option>
                  <option value="consistency">Consistency</option>
                  <option value="usability">Usability</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Pivot Builder Defaults Section */}
        <Card className="settings-card">
          <div className="settings-card-header">
            <Table2 size={20} />
            <div>
              <h3>Pivot Builder Defaults</h3>
              <p>Default dimensions and measures for new pivots</p>
            </div>
          </div>
          <div className="settings-card-body">
            <div className="setting-row vertical">
              <div className="setting-info">
                <Rows3 size={16} />
                <div>
                  <label>Default Row Dimensions</label>
                  <span>Dimensions added to new pivot analyses</span>
                </div>
              </div>
              <div className="setting-control full-width">
                <div className="pill-list">
                  {pivotDefaultRowDimensions.map((dim) => (
                    <span key={dim} className="pill">
                      {dim}
                      <button
                        onClick={() => setPivotDefaultRowDimensions(
                          pivotDefaultRowDimensions.filter(d => d !== dim)
                        )}
                        className="pill-remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <select
                    className="pill-add-select"
                    onChange={(e) => {
                      if (e.target.value && !pivotDefaultRowDimensions.includes(e.target.value)) {
                        setPivotDefaultRowDimensions([...pivotDefaultRowDimensions, e.target.value]);
                      }
                      e.target.value = '';
                    }}
                  >
                    <option value="">+ Add</option>
                    <option value="connection">Connection</option>
                    <option value="database">Database</option>
                    <option value="schema">Schema</option>
                    <option value="assetType">Asset Type</option>
                    <option value="owner">Owner</option>
                    <option value="domain">Domain</option>
                    <option value="certification">Certification</option>
                    <option value="classification">Classification</option>
                    <option value="tag">Tag</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="setting-row vertical">
              <div className="setting-info">
                <BarChart3 size={16} />
                <div>
                  <label>Default Measures</label>
                  <span>Measures added to new pivot analyses</span>
                </div>
              </div>
              <div className="setting-control full-width">
                <div className="pill-list">
                  {pivotDefaultMeasures.map((measure) => (
                    <span key={measure} className="pill">
                      {measure}
                      <button
                        onClick={() => setPivotDefaultMeasures(
                          pivotDefaultMeasures.filter(m => m !== measure)
                        )}
                        className="pill-remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <select
                    className="pill-add-select"
                    onChange={(e) => {
                      if (e.target.value && !pivotDefaultMeasures.includes(e.target.value)) {
                        setPivotDefaultMeasures([...pivotDefaultMeasures, e.target.value]);
                      }
                      e.target.value = '';
                    }}
                  >
                    <option value="">+ Add</option>
                    <option value="assetCount">Asset Count</option>
                    <option value="overallScore">Overall Score</option>
                    <option value="completenessScore">Completeness</option>
                    <option value="accuracyScore">Accuracy</option>
                    <option value="timelinessScore">Timeliness</option>
                    <option value="consistencyScore">Consistency</option>
                    <option value="usabilityScore">Usability</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Reset Section */}
        <Card className="settings-card settings-card-danger">
          <div className="settings-card-header">
            <RotateCcw size={20} />
            <div>
              <h3>Reset Settings</h3>
              <p>Restore all settings to their defaults</p>
            </div>
          </div>
          <div className="settings-card-body">
            <button
              className="reset-button"
              onClick={() => {
                if (confirm('Reset all settings to defaults? This cannot be undone.')) {
                  resetToDefaults();
                }
              }}
            >
              <RotateCcw size={16} />
              Reset All Settings
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
