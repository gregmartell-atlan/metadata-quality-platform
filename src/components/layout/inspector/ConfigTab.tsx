/**
 * Config Tab Content
 * 
 * Context-aware configuration for the current page.
 */

import { useLocation } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Sliders, Info, Zap, Hash, Percent, BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
import { useUIPreferences } from '../../../stores/uiPreferencesStore';
import { usePivotConfigStore } from '../../../stores/pivotConfigStore';
import { PivotConfigurator } from '../../pivot/PivotConfigurator';
import { getMeasureLabel } from '../../../utils/pivotMeasures';
import type { Measure, MeasureDisplayMode } from '../../../types/pivot';
import './ConfigTab.css';

const MODE_OPTIONS: { mode: MeasureDisplayMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'auto', icon: <Zap size={12} />, label: 'Auto' },
    { mode: 'numeric', icon: <Hash size={12} />, label: '#' },
    { mode: 'percentage', icon: <Percent size={12} />, label: '%' },
    { mode: 'visual', icon: <BarChart3 size={12} />, label: 'Bar' },
];

export function ConfigTab() {
    const location = useLocation();
    const [showDisplayOptions, setShowDisplayOptions] = useState(false);
    const {
        dashboardHeatmapDimension,
        dashboardOwnerPivotDimension,
        setDashboardHeatmapDimension,
        setDashboardOwnerPivotDimension,
    } = useUIPreferences();

    const {
        rowDimensions,
        measures,
        measureDisplayModes,
        setRowDimensions,
        setMeasures,
        setMeasureDisplayMode
    } = usePivotConfigStore();

    const currentPage = useMemo(() => {
        if (location.pathname.includes('/pivot')) return 'pivot';
        if (location.pathname.includes('/lineage')) return 'lineage';
        if (location.pathname === '/' || location.pathname === '/dashboard') return 'dashboard';
        return 'other';
    }, [location.pathname]);

    return (
        <div className="config-tab">
            {currentPage === 'pivot' ? (
                <>
                    <PivotConfigurator
                        rowDimensions={rowDimensions}
                        measures={measures}
                        onRowDimensionsChange={setRowDimensions}
                        onMeasuresChange={setMeasures}
                        alwaysExpanded={true}
                    />

                    {/* Measure Display Options integration */}
                    {measures.length > 0 && (
                        <div className="config-section" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '24px' }}>
                            <button
                                className="config-section-header"
                                onClick={() => setShowDisplayOptions(!showDisplayOptions)}
                            >
                                <span className="section-title">
                                    {showDisplayOptions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    Display Format
                                </span>
                                <span className="section-hint">How measures appear</span>
                            </button>

                            {showDisplayOptions && (
                                <div className="measure-display-options">
                                    {measures.map((measure) => (
                                        <div key={measure} className="measure-display-row">
                                            <span className="measure-name">{getMeasureLabel(measure)}</span>
                                            <div className="mode-buttons">
                                                {MODE_OPTIONS.map(({ mode, icon, label }) => (
                                                    <button
                                                        key={mode}
                                                        className={`mode-btn ${(measureDisplayModes.get(measure) || 'auto') === mode ? 'active' : ''}`}
                                                        onClick={() => setMeasureDisplayMode(measure, mode)}
                                                        title={label}
                                                    >
                                                        {icon}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : currentPage === 'dashboard' ? (
                <div className="dashboard-config">
                    <div className="drawer-section">
                        <div className="drawer-section-header">
                            <Sliders size={14} />
                            <h3>Heatmap Dimension</h3>
                        </div>
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
                            <option value="certification">Certification</option>
                        </select>
                    </div>

                    <div className="drawer-section">
                        <div className="drawer-section-header">
                            <Sliders size={14} />
                            <h3>Owner Pivot Dimension</h3>
                        </div>
                        <select
                            className="config-select"
                            value={dashboardOwnerPivotDimension}
                            onChange={(e) => setDashboardOwnerPivotDimension(e.target.value)}
                        >
                            <option value="ownerGroup">Owner Group</option>
                            <option value="tag">Tag</option>
                            <option value="certification">Certification</option>
                            <option value="assetType">Asset Type</option>
                        </select>
                    </div>
                </div>
            ) : (
                <div className="tab-placeholder">
                    <Info size={32} />
                    <p>No specific configuration available for this page.</p>
                </div>
            )}
        </div>
    );
}

