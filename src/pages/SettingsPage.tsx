/**
 * SettingsPage - Full settings page with organized sections
 *
 * Replaces the drawer-based settings with a dedicated page
 */

import { useRef } from 'react';
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
  Sliders,
  Download,
  Upload,
  Scale,
  CheckSquare,
} from 'lucide-react';
import { useUIPreferences, type CertificationStatus } from '../stores/uiPreferencesStore';
import {
  useQualityRules,
  DEFAULT_THRESHOLDS,
  DEFAULT_FIELD_REQUIREMENTS,
  DEFAULT_DIMENSION_WEIGHTS,
  type RequirementLevel,
  type FieldRequirements,
} from '../stores/qualityRulesStore';
import { useScoringSettingsStore, type ScoringMode } from '../stores/scoringSettingsStore';
import './SettingsPage.css';

// Field labels for display
const FIELD_LABELS: Record<keyof FieldRequirements, string> = {
  description: 'Description',
  owner: 'Owner',
  tags: 'Tags',
  terms: 'Business Terms',
  lineage: 'Lineage',
  certificate: 'Certification',
  classifications: 'Classifications',
  readme: 'README',
  domain: 'Domain',
};

const REQUIREMENT_OPTIONS: { value: RequirementLevel; label: string }[] = [
  { value: 'required', label: 'Required' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'optional', label: 'Optional' },
  { value: 'hidden', label: 'Hidden' },
];

export function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    // Display
    density,
    setDensity,

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

  const {
    rules,
    setThresholds,
    setFieldRequirements,
    setDimensionWeights,
    resetToDefaults: resetQualityRules,
    exportRules,
    importRules,
  } = useQualityRules();

  const {
    scoringMode,
    activeProfiles,
    setScoringMode,
    setActiveProfiles,
  } = useScoringSettingsStore();

  const handleExportRules = () => {
    const json = exportRules();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quality-rules.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportRules = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importRules(content);
      if (!success) {
        alert('Failed to import rules. Please check the file format.');
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  const totalWeight = Object.values(rules.dimensionWeights).reduce((a, b) => a + b, 0);

  const toggleCertificationStatus = (status: CertificationStatus) => {
    if (globalCertificationFilter.includes(status)) {
      setGlobalCertificationFilter(globalCertificationFilter.filter((s) => s !== status));
    } else {
      setGlobalCertificationFilter([...globalCertificationFilter, status]);
    }
  };

  const toggleScoringProfile = (profileId: string) => {
    if (activeProfiles.includes(profileId)) {
      setActiveProfiles(activeProfiles.filter((p) => p !== profileId));
    } else {
      setActiveProfiles([...activeProfiles, profileId]);
    }
  };

  return (
    <div className="settings-page">
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

        {/* Quality Rules Section */}
        <Card className="settings-card">
          <div className="settings-card-header">
            <Sliders size={20} />
            <div>
              <h3>Quality Scoring Rules</h3>
              <p>Configure how quality scores are calculated</p>
            </div>
            <div className="settings-card-actions">
              <button
                className="settings-icon-button"
                onClick={handleExportRules}
                title="Export Rules"
              >
                <Download size={16} />
              </button>
              <button
                className="settings-icon-button"
                onClick={() => fileInputRef.current?.click()}
                title="Import Rules"
              >
                <Upload size={16} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportRules}
                style={{ display: 'none' }}
              />
            </div>
          </div>
          <div className="settings-card-body">
            {/* Scoring Mode */}
            <div className="setting-section">
              <div className="setting-section-header">
                <Sliders size={16} />
                <span>Scoring Mode</span>
              </div>
              <p className="setting-section-description">
                Choose between legacy scoring or config-driven scoring with profiles
              </p>
              <div className="scoring-mode-options">
                <label className="radio-item">
                  <input
                    type="radio"
                    name="scoringMode"
                    value="legacy"
                    checked={scoringMode === 'legacy'}
                    onChange={() => setScoringMode('legacy')}
                  />
                  <div className="radio-content">
                    <span className="radio-label">Legacy</span>
                    <span className="radio-description">Use built-in scoring algorithms</span>
                  </div>
                </label>
                <label className="radio-item">
                  <input
                    type="radio"
                    name="scoringMode"
                    value="config-driven"
                    checked={scoringMode === 'config-driven'}
                    onChange={() => setScoringMode('config-driven')}
                  />
                  <div className="radio-content">
                    <span className="radio-label">Config-Driven</span>
                    <span className="radio-description">Use configurable scoring profiles</span>
                  </div>
                </label>
              </div>
              {scoringMode === 'config-driven' && (
                <div className="scoring-profiles">
                  <label className="scoring-profiles-label">Active Profiles</label>
                  <div className="checkbox-group-vertical">
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={activeProfiles.includes('industry5d')}
                        onChange={() => toggleScoringProfile('industry5d')}
                      />
                      <div className="checkbox-content">
                        <span className="checkbox-label">Industry 5D</span>
                        <span className="checkbox-description">Standard 5-dimension quality model</span>
                      </div>
                    </label>
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={activeProfiles.includes('standardCompleteness')}
                        onChange={() => toggleScoringProfile('standardCompleteness')}
                      />
                      <div className="checkbox-content">
                        <span className="checkbox-label">Standard Completeness</span>
                        <span className="checkbox-description">Focus on metadata completeness metrics</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Score Thresholds */}
            <div className="setting-section">
              <div className="setting-section-header">
                <Scale size={16} />
                <span>Score Thresholds</span>
              </div>
              <p className="setting-section-description">
                Define the boundaries for quality score bands (Excellent &gt; Good &gt; Fair &gt; Poor &gt; Critical)
              </p>
              <div className="threshold-grid">
                <div className="threshold-item">
                  <label>Excellent</label>
                  <div className="threshold-input-wrapper">
                    <span className="threshold-prefix">≥</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rules.thresholds.excellent}
                      onChange={(e) =>
                        setThresholds({
                          ...rules.thresholds,
                          excellent: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)),
                        })
                      }
                      className="threshold-input"
                    />
                  </div>
                  <div
                    className="threshold-preview"
                    style={{ background: 'var(--score-excellent)' }}
                  />
                </div>
                <div className="threshold-item">
                  <label>Good</label>
                  <div className="threshold-input-wrapper">
                    <span className="threshold-prefix">≥</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rules.thresholds.good}
                      onChange={(e) =>
                        setThresholds({
                          ...rules.thresholds,
                          good: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)),
                        })
                      }
                      className="threshold-input"
                    />
                  </div>
                  <div
                    className="threshold-preview"
                    style={{ background: 'var(--score-good)' }}
                  />
                </div>
                <div className="threshold-item">
                  <label>Fair</label>
                  <div className="threshold-input-wrapper">
                    <span className="threshold-prefix">≥</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rules.thresholds.fair}
                      onChange={(e) =>
                        setThresholds({
                          ...rules.thresholds,
                          fair: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)),
                        })
                      }
                      className="threshold-input"
                    />
                  </div>
                  <div
                    className="threshold-preview"
                    style={{ background: 'var(--score-fair)' }}
                  />
                </div>
                <div className="threshold-item">
                  <label>Poor</label>
                  <div className="threshold-input-wrapper">
                    <span className="threshold-prefix">≥</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rules.thresholds.poor}
                      onChange={(e) =>
                        setThresholds({
                          ...rules.thresholds,
                          poor: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)),
                        })
                      }
                      className="threshold-input"
                    />
                  </div>
                  <div
                    className="threshold-preview"
                    style={{ background: 'var(--score-poor)' }}
                  />
                </div>
                <div className="threshold-item">
                  <label>Critical</label>
                  <div className="threshold-input-wrapper">
                    <span className="threshold-prefix">&lt;</span>
                    <span className="threshold-value">{rules.thresholds.poor}</span>
                  </div>
                  <div
                    className="threshold-preview"
                    style={{ background: 'var(--score-critical)' }}
                  />
                </div>
              </div>
            </div>

            {/* Field Requirements */}
            <div className="setting-section">
              <div className="setting-section-header">
                <CheckSquare size={16} />
                <span>Field Requirements</span>
              </div>
              <p className="setting-section-description">
                Set which metadata fields are required, recommended, or optional for quality scoring
              </p>
              <div className="field-requirements-grid">
                {(Object.keys(FIELD_LABELS) as Array<keyof FieldRequirements>).map((field) => (
                  <div key={field} className="field-requirement-row">
                    <span className="field-requirement-label">{FIELD_LABELS[field]}</span>
                    <select
                      value={rules.fieldRequirements[field]}
                      onChange={(e) =>
                        setFieldRequirements({
                          ...rules.fieldRequirements,
                          [field]: e.target.value as RequirementLevel,
                        })
                      }
                      className={`field-requirement-select requirement-${rules.fieldRequirements[field]}`}
                    >
                      {REQUIREMENT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Dimension Weights */}
            <div className="setting-section">
              <div className="setting-section-header">
                <BarChart3 size={16} />
                <span>Dimension Weights</span>
                <span className={`weight-total ${totalWeight === 100 ? 'valid' : 'invalid'}`}>
                  Total: {totalWeight}%
                </span>
              </div>
              <p className="setting-section-description">
                Adjust the importance of each quality dimension in the overall score calculation
              </p>
              <div className="dimension-weights-grid">
                {(['completeness', 'accuracy', 'timeliness', 'consistency', 'usability'] as const).map(
                  (dim) => (
                    <div key={dim} className="dimension-weight-row">
                      <label className="dimension-weight-label">
                        {dim.charAt(0).toUpperCase() + dim.slice(1)}
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={rules.dimensionWeights[dim]}
                        onChange={(e) =>
                          setDimensionWeights({
                            ...rules.dimensionWeights,
                            [dim]: parseInt(e.target.value, 10),
                          })
                        }
                        className="dimension-weight-slider"
                      />
                      <span className="dimension-weight-value">{rules.dimensionWeights[dim]}%</span>
                    </div>
                  )
                )}
              </div>
              {totalWeight !== 100 && (
                <p className="weight-warning">
                  Weights should total 100% for accurate scoring. Current total: {totalWeight}%
                </p>
              )}
            </div>

            {/* Reset Quality Rules */}
            <div className="setting-row">
              <div className="setting-info">
                <RotateCcw size={16} />
                <div>
                  <label>Reset Quality Rules</label>
                  <span>Restore scoring rules to defaults</span>
                </div>
              </div>
              <div className="setting-control">
                <button
                  className="secondary-button"
                  onClick={() => {
                    if (confirm('Reset quality rules to defaults?')) {
                      resetQualityRules();
                    }
                  }}
                >
                  Reset Rules
                </button>
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

        {/* Developer Tools Section */}
        <Card className="settings-card">
          <div className="settings-card-header">
            <Palette size={20} />
            <div>
              <h3>Developer Tools</h3>
              <p>Design prototypes and experimental features</p>
            </div>
          </div>
          <div className="settings-card-body">
            <div className="setting-row">
              <div className="setting-info">
                <BarChart3 size={16} />
                <div>
                  <label>Chart Style Prototypes</label>
                  <span>Compare 4 visual styles for the Impact Matrix</span>
                </div>
              </div>
              <div className="setting-control">
                <a href="/prototypes" className="settings-link-button">
                  View Prototypes
                </a>
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
