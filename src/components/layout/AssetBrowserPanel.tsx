/**
 * Asset Browser Panel - Expandable panel for header integration
 *
 * Renders the AssetBrowser in a dropdown panel that expands from the header.
 */

import { useState, useMemo } from 'react';
import { X, FolderOpen, Search, List, Zap } from 'lucide-react';
import { AssetBrowser } from '../AssetBrowser';
import { AssetCommandCenter } from '../AssetBrowser/AssetCommandCenter';
import { useAssetStore } from '../../stores/assetStore';
import './AssetBrowserPanel.css';

interface AssetBrowserPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssetBrowserPanel({ isOpen, onClose }: AssetBrowserPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'command'>('tree'); // Start with tree to load assets
  const [loadedAssets, setLoadedAssets] = useState<any[]>([]);
  const { toggleAsset, isSelected } = useAssetStore();

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
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'command' ? 'active' : ''}`}
              onClick={() => setViewMode('command')}
              title="Command Center (Quick Access)"
            >
              <Zap size={14} />
              <span>Quick</span>
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'tree' ? 'active' : ''}`}
              onClick={() => setViewMode('tree')}
              title="Tree View (Full Hierarchy)"
            >
              <List size={14} />
              <span>Tree</span>
            </button>
          </div>
          <button className="asset-panel-close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="asset-panel-content">
          {/* Always render AssetBrowser to load assets, but hide when in command mode */}
          <div style={{ display: viewMode === 'tree' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
            <div className="asset-panel-search">
              <Search size={16} color="#666" />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus={viewMode === 'tree'}
              />
            </div>
            <AssetBrowser
              searchFilter={searchTerm}
              onAssetsLoaded={setLoadedAssets}
            />
          </div>

          {/* Command Center View */}
          {viewMode === 'command' && (
            <AssetCommandCenter
              allAssets={loadedAssets}
              onAssetSelect={toggleAsset}
              onAssetDragStart={(e, asset) => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('application/json', JSON.stringify({
                  type: 'atlan-assets',
                  assets: [asset],
                  nodeType: 'table',
                  nodeName: asset.name
                }));
              }}
              isSelected={isSelected}
            />
          )}
        </div>
      </div>
    </>
  );
}
