/**
 * Asset Browser Panel - Expandable panel for header integration
 *
 * Renders the AssetBrowser in a dropdown panel that expands from the header.
 */

import { X, FolderOpen } from 'lucide-react';
import { AssetBrowser } from '../AssetBrowser';
import './AssetBrowserPanel.css';

interface AssetBrowserPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssetBrowserPanel({ isOpen, onClose }: AssetBrowserPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="asset-panel-backdrop" onClick={onClose} />

      {/* Panel */}
      <div className="asset-panel">
        <div className="asset-panel-header">
          <div className="asset-panel-title">
            <FolderOpen size={18} />
            <span>Asset Browser</span>
          </div>
          <p className="asset-panel-hint">
            Drag assets to the context bar above, or browse the hierarchy
          </p>
          <button className="asset-panel-close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
        <div className="asset-panel-content">
          <AssetBrowser />
        </div>
      </div>
    </>
  );
}
