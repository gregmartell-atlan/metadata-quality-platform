/**
 * Global Settings Drawer
 *
 * Right-edge flyout providing cross-cutting configuration options
 * that apply across multiple views (Dashboard, Pivots, Lineage).
 */

import { useState } from 'react';
import { Settings, ChevronRight, ChevronLeft, ChevronDown, X } from 'lucide-react';
import { useUIPreferences, type CertificationStatus } from '../../stores/uiPreferencesStore';
import './GlobalSettingsDrawer.css';

interface GlobalSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSettingsDrawer({ isOpen, onClose }: GlobalSettingsDrawerProps) {
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
    globalDomainFilter,
    globalTimeRange,
    globalCertificationFilter,
    setGlobalDomainFilter,
    setGlobalTimeRange,
    setGlobalCertificationFilter,

    // Dashboard
    dashboardHeatmapDimension,
    dashboardOwnerPivotDimension,
    dashboardOwnerPivotColumn,
    setDashboardHeatmapDimension,
    setDashboardOwnerPivotDimension,
    setDashboardOwnerPivotColumn,

    // Reset
    resetToDefaults,
  } = useUIPreferences();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['display', 'global-filters', 'dashboard'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const toggleCertificationStatus = (status: CertificationStatus) => {
    if (globalCertificationFilter.includes(status)) {
      setGlobalCertificationFilter(globalCertificationFilter.filter((s) => s !== status));
    } else {
      setGlobalCertificationFilter([...globalCertificationFilter, status]);
    }
  };

  return (
    <div className={`global-settings-drawer ${isOpen ? 'open' : 'collapsed'}`}>
      {/* Collapsed Tab */}
      <button
        className="drawer-collapsed-tab"
        onClick={onClose}
        title="Show global settings"
        style={{ display: isOpen ? 'none' : 'flex' }}
      >
        <ChevronLeft size={14} />
        <Settings size={16} />
        <span className="collapsed-label">Settings</span>
      </button>

      {/* Drawer Panel */}
      {isOpen && (
        <div className="drawer-panel">
          <div className="drawer-header">
            <button
              className="drawer-close-btn"
              onClick={onClose}
              title="Close settings"
            >
              <ChevronRight size={16} />
            </button>
            <div className="drawer-title">
              <Settings size={16} />
              <span>Global Settings</span>
            </div>
            <button
              className="drawer-reset-btn"
              onClick={resetToDefaults}
              title="Reset to defaults"
            >
              <X size={14} />
              Reset
            </button>
          </div>

          <div className="drawer-body">
            {/* Display Settings Section */}
            <div className="settings-section">
              <button
                className="section-header"
                onClick={() => toggleSection('display')}
              >
                <span className="section-icon">
                  {expandedSections.has('display') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <span>Display Settings</span>
              </button>
              {expandedSections.has('display') && (
                <div className="section-content">
                  <div className="setting-group">
                    <label className="setting-label">UI Density</label>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input
                          type="radio"
                          checked={density === 'compact'}
                          onChange={() => setDensity('compact')}
                        />
                        <span>Compact</span>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          checked={density === 'comfortable'}
                          onChange={() => setDensity('comfortable')}
                        />
                        <span>Comfortable</span>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          checked={density === 'spacious'}
                          onChange={() => setDensity('spacious')}
                        />
                        <span>Spacious</span>
                      </label>
                    </div>
                  </div>

                  <div className="setting-group">
                    <label className="setting-label">Theme</label>
                    <div className="radio-group">
                      <label className="radio-option">
                        <input
                          type="radio"
                          checked={theme === 'dark'}
                          onChange={() => setTheme('dark')}
                        />
                        <span>Dark</span>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          checked={theme === 'light'}
                          onChange={() => setTheme('light')}
                        />
                        <span>Light</span>
                      </label>
                      <label className="radio-option">
                        <input
                          type="radio"
                          checked={theme === 'auto'}
                          onChange={() => setTheme('auto')}
                        />
                        <span>Auto</span>
                      </label>
                    </div>
                  </div>

                  <div className="setting-group">
                    <label className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={showPopularityBadges}
                        onChange={(e) => setShowPopularityBadges(e.target.checked)}
                      />
                      <span>Show popularity badges</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Global Filters Section */}
            <div className="settings-section">
              <button
                className="section-header"
                onClick={() => toggleSection('global-filters')}
              >
                <span className="section-icon">
                  {expandedSections.has('global-filters') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <span>Global Filters</span>
              </button>
              {expandedSections.has('global-filters') && (
                <div className="section-content">
                  <p className="section-hint">
                    These filters apply across Dashboard, Pivots, and Lineage views
                  </p>

                  <div className="setting-group">
                    <label className="setting-label">Time Range</label>
                    <select
                      className="setting-select"
                      value={globalTimeRange}
                      onChange={(e) => setGlobalTimeRange(e.target.value as UIPreferences['globalTimeRange'])}
                    >
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                      <option value="90d">Last 90 Days</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>

                  <div className="setting-group">
                    <label className="setting-label">Certification Status</label>
                    <div className="checkbox-group">
                      <label className="checkbox-option">
                        <input
                          type="checkbox"
                          checked={globalCertificationFilter.includes('VERIFIED')}
                          onChange={() => toggleCertificationStatus('VERIFIED')}
                        />
                        <span>Verified</span>
                      </label>
                      <label className="checkbox-option">
                        <input
                          type="checkbox"
                          checked={globalCertificationFilter.includes('DRAFT')}
                          onChange={() => toggleCertificationStatus('DRAFT')}
                        />
                        <span>Draft</span>
                      </label>
                      <label className="checkbox-option">
                        <input
                          type="checkbox"
                          checked={globalCertificationFilter.includes('DEPRECATED')}
                          onChange={() => toggleCertificationStatus('DEPRECATED')}
                        />
                        <span>Deprecated</span>
                      </label>
                    </div>
                    <p className="setting-hint">
                      {globalCertificationFilter.length === 0
                        ? 'No filter (all statuses shown)'
                        : `Showing only: ${globalCertificationFilter.join(', ')}`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Dashboard Defaults Section */}
            <div className="settings-section">
              <button
                className="section-header"
                onClick={() => toggleSection('dashboard')}
              >
                <span className="section-icon">
                  {expandedSections.has('dashboard') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <span>Dashboard Defaults</span>
              </button>
              {expandedSections.has('dashboard') && (
                <div className="section-content">
                  <div className="setting-group">
                    <label className="setting-label">Default Heatmap Pivot</label>
                    <select
                      className="setting-select"
                      value={dashboardHeatmapDimension}
                      onChange={(e) => setDashboardHeatmapDimension(e.target.value)}
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

                  <div className="setting-group">
                    <label className="setting-label">Default Owner Pivot</label>
                    <select
                      className="setting-select"
                      value={dashboardOwnerPivotDimension}
                      onChange={(e) => setDashboardOwnerPivotDimension(e.target.value)}
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

                  <div className="setting-group">
                    <label className="setting-label">Owner Pivot Quality Column</label>
                    <select
                      className="setting-select"
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
