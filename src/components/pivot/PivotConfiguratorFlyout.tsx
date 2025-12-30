import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { PivotConfigurator } from './PivotConfigurator';
import type { RowDimension, Measure } from '../../types/pivot';
import './PivotConfiguratorFlyout.css';

interface PivotConfiguratorFlyoutProps {
  rowDimensions: RowDimension[];
  measures: Measure[];
  onRowDimensionsChange: (dimensions: RowDimension[]) => void;
  onMeasuresChange: (measures: Measure[]) => void;
}

export function PivotConfiguratorFlyout({
  rowDimensions,
  measures,
  onRowDimensionsChange,
  onMeasuresChange,
}: PivotConfiguratorFlyoutProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Toggle Button */}
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
          <PivotConfigurator
            rowDimensions={rowDimensions}
            measures={measures}
            onRowDimensionsChange={onRowDimensionsChange}
            onMeasuresChange={onMeasuresChange}
            alwaysExpanded={true}
          />
        </div>
      </div>
    </>
  );
}

