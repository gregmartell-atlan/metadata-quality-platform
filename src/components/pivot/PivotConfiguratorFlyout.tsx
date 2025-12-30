import { useState } from 'react';
import { Settings, X, Hash, Percent, BarChart3, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { PivotConfigurator } from './PivotConfigurator';
import { getMeasureLabel } from '../../utils/pivotMeasures';
import type { RowDimension, Measure, MeasureDisplayMode } from '../../types/pivot';
import './PivotConfiguratorFlyout.css';

interface PivotConfiguratorFlyoutProps {
  rowDimensions: RowDimension[];
  measures: Measure[];
  onRowDimensionsChange: (dimensions: RowDimension[]) => void;
  onMeasuresChange: (measures: Measure[]) => void;
  measureDisplayModes?: Map<Measure, MeasureDisplayMode>;
  onMeasureDisplayModesChange?: (modes: Map<Measure, MeasureDisplayMode>) => void;
}

const MODE_OPTIONS: { mode: MeasureDisplayMode; icon: React.ReactNode; label: string }[] = [
  { mode: 'auto', icon: <Zap size={12} />, label: 'Auto' },
  { mode: 'numeric', icon: <Hash size={12} />, label: '#' },
  { mode: 'percentage', icon: <Percent size={12} />, label: '%' },
  { mode: 'visual', icon: <BarChart3 size={12} />, label: 'Bar' },
];

export function PivotConfiguratorFlyout({
  rowDimensions,
  measures,
  onRowDimensionsChange,
  onMeasuresChange,
  measureDisplayModes,
  onMeasureDisplayModesChange,
}: PivotConfiguratorFlyoutProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDisplayOptions, setShowDisplayOptions] = useState(false);

  const handleModeChange = (measure: Measure, mode: MeasureDisplayMode) => {
    if (!onMeasureDisplayModesChange) return;
    const newModes = new Map(measureDisplayModes);
    newModes.set(measure, mode);
    onMeasureDisplayModesChange(newModes);
  };

  return (
    <>
      {/* Toggle Button - Positioned in top right */}
      <button
        className="configurator-flyout-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close configuration' : 'Open configuration'}
        title="Configure Pivot"
      >
        <Settings size={16} className="toggle-icon" />
        <span className="toggle-label">Configure</span>
        {rowDimensions.length > 0 && (
          <span className="toggle-badge">{rowDimensions.length}D</span>
        )}
        {measures.length > 0 && (
          <span className="toggle-badge">{measures.length}M</span>
        )}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="configurator-flyout-overlay"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Flyout Panel */}
      <div className={`configurator-flyout ${isOpen ? 'open' : ''}`}>
        <div className="flyout-header">
          <div className="flyout-title">
            <Settings size={20} className="flyout-icon" />
            <span>Configure Pivot</span>
          </div>
          <button
            className="flyout-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flyout-content">
          {/* Pivot Configurator (Dimensions & Measures) */}
          <PivotConfigurator
            rowDimensions={rowDimensions}
            measures={measures}
            onRowDimensionsChange={onRowDimensionsChange}
            onMeasuresChange={onMeasuresChange}
            alwaysExpanded={true}
          />

          {/* Measure Display Options */}
          {measures.length > 0 && measureDisplayModes && onMeasureDisplayModesChange && (
            <div className="flyout-section">
              <button
                className="flyout-section-header"
                onClick={() => setShowDisplayOptions(!showDisplayOptions)}
              >
                <span className="section-title">
                  {showDisplayOptions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
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
                            onClick={() => handleModeChange(measure, mode)}
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
        </div>
      </div>
    </>
  );
}
