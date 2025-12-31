/**
 * Asset Command Center
 *
 * Redesigned asset browser focused on speed and efficiency.
 * Search-first with smart grouping for data quality analysts.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Flame, Clock, Pin, ChevronDown, ChevronRight, Database, Folder, Table2, Star, TrendingUp } from 'lucide-react';
import type { AtlanAsset } from '../../services/atlan/types';
import {
  calculatePopularityScore,
  isHotAsset,
  formatQueryCount,
  getPopularityDisplay
} from '../../utils/popularityScore';
import './AssetCommandCenter.css';

interface AssetCommandCenterProps {
  // All loaded table assets from the tree
  allAssets: AtlanAsset[];
  onAssetSelect: (asset: AtlanAsset) => void;
  onAssetDragStart: (e: React.DragEvent, asset: AtlanAsset) => void;
  isSelected: (guid: string) => boolean;
}

export function AssetCommandCenter({
  allAssets,
  onAssetSelect,
  onAssetDragStart,
  isSelected,
}: AssetCommandCenterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedAssets, setPinnedAssets] = useState<Set<string>>(
    new Set(JSON.parse(localStorage.getItem('pinnedAssets') || '[]'))
  );
  const [recentAssets, setRecentAssets] = useState<string[]>(
    JSON.parse(localStorage.getItem('recentAssets') || '[]')
  );
  const [showHierarchy, setShowHierarchy] = useState(false);

  // Hot assets (score > 7)
  const hotAssets = useMemo(() =>
    allAssets
      .filter(a => calculatePopularityScore(a) > 7)
      .sort((a, b) => calculatePopularityScore(b) - calculatePopularityScore(a))
      .slice(0, 6),
    [allAssets]
  );

  // Recent assets (from localStorage)
  const recentAssetsData = useMemo(() =>
    recentAssets
      .map(guid => allAssets.find(a => a.guid === guid))
      .filter(Boolean) as AtlanAsset[],
    [recentAssets, allAssets]
  );

  // Pinned assets
  const pinnedAssetsData = useMemo(() =>
    Array.from(pinnedAssets)
      .map(guid => allAssets.find(a => a.guid === guid))
      .filter(Boolean) as AtlanAsset[],
    [pinnedAssets, allAssets]
  );

  // Search results (fuzzy match on name, schema, database)
  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    return allAssets
      .filter(asset =>
        asset.name.toLowerCase().includes(query) ||
        asset.qualifiedName.toLowerCase().includes(query) ||
        asset.databaseName?.toLowerCase().includes(query) ||
        asset.schemaName?.toLowerCase().includes(query)
      )
      .sort((a, b) => {
        // Prioritize exact name matches
        const aExact = a.name.toLowerCase() === query ? 1 : 0;
        const bExact = b.name.toLowerCase() === query ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        // Then by popularity
        return calculatePopularityScore(b) - calculatePopularityScore(a);
      })
      .slice(0, 50);
  }, [searchQuery, allAssets]);

  // Group assets by schema for hierarchy view
  const hierarchyGroups = useMemo(() => {
    const groups = new Map<string, AtlanAsset[]>();
    allAssets.forEach(asset => {
      const key = `${asset.databaseName}/${asset.schemaName}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(asset);
    });
    return Array.from(groups.entries())
      .map(([path, assets]) => ({
        path,
        database: path.split('/')[0],
        schema: path.split('/')[1],
        assets: assets.sort((a, b) => a.name.localeCompare(b.name)),
        hotCount: assets.filter(isHotAsset).length,
      }))
      .sort((a, b) => b.hotCount - a.hotCount);
  }, [allAssets]);

  const togglePin = useCallback((guid: string) => {
    setPinnedAssets(prev => {
      const next = new Set(prev);
      if (next.has(guid)) {
        next.delete(guid);
      } else {
        next.add(guid);
      }
      localStorage.setItem('pinnedAssets', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const handleAssetClick = useCallback((asset: AtlanAsset) => {
    // Track recent
    setRecentAssets(prev => {
      const next = [asset.guid, ...prev.filter(g => g !== asset.guid)].slice(0, 10);
      localStorage.setItem('recentAssets', JSON.stringify(next));
      return next;
    });
    onAssetSelect(asset);
  }, [onAssetSelect]);

  const AssetCard = ({ asset, variant = 'default' }: { asset: AtlanAsset; variant?: 'hot' | 'default' }) => {
    const score = getPopularityDisplay(asset);
    const isPinned = pinnedAssets.has(asset.guid);
    const selected = isSelected(asset.guid);

    return (
      <div
        className={`asset-card ${variant} ${selected ? 'selected' : ''} ${isPinned ? 'pinned' : ''}`}
        onClick={() => handleAssetClick(asset)}
        draggable
        onDragStart={(e) => onAssetDragStart(e, asset)}
      >
        <div className="asset-card-header">
          <div className="asset-icon">
            <Table2 size={16} />
          </div>
          <div className="asset-meta">
            <div className="asset-name">{asset.name}</div>
            <div className="asset-path">
              {asset.databaseName} / {asset.schemaName}
            </div>
          </div>
          <button
            className="pin-btn"
            onClick={(e) => {
              e.stopPropagation();
              togglePin(asset.guid);
            }}
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={12} className={isPinned ? 'pinned' : ''} />
          </button>
        </div>
        {variant === 'hot' && (
          <div className="asset-stats">
            <div className="stat">
              <TrendingUp size={12} />
              <span>{score}/10</span>
            </div>
            <div className="stat">
              <Star size={12} />
              <span>{formatQueryCount(asset.sourceReadCount)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="asset-command-center">
      {/* Search Command Bar */}
      <div className="command-bar">
        <Search size={20} className="search-icon" />
        <input
          type="text"
          className="command-input"
          placeholder="Search assets... (try: orders, customer, invoice)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
        {searchQuery && (
          <div className="search-results-count">
            {searchResults.length} results
          </div>
        )}
      </div>

      <div className="command-content">
        {/* Search Results (when searching) */}
        {searchQuery ? (
          <div className="search-results-zone">
            <div className="zone-header">
              <span className="zone-title">Results</span>
              <span className="zone-count">{searchResults.length}</span>
            </div>
            <div className="results-list">
              {searchResults.length === 0 ? (
                <div className="empty-state">
                  <Search size={32} />
                  <p>No assets match "{searchQuery}"</p>
                </div>
              ) : (
                searchResults.map(asset => (
                  <div
                    key={asset.guid}
                    className={`result-item ${isSelected(asset.guid) ? 'selected' : ''}`}
                    onClick={() => handleAssetClick(asset)}
                    draggable
                    onDragStart={(e) => onAssetDragStart(e, asset)}
                  >
                    <Table2 size={14} className="result-icon" />
                    <div className="result-info">
                      <div className="result-name">{asset.name}</div>
                      <div className="result-path">
                        {asset.databaseName} › {asset.schemaName}
                      </div>
                    </div>
                    {isHotAsset(asset) && (
                      <div className="result-badge hot">
                        <Flame size={12} />
                        {getPopularityDisplay(asset)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Smart Zones (when not searching) */
          <>
            {/* Hot Assets */}
            {hotAssets.length > 0 && (
              <div className="quick-access-zone">
                <div className="zone-header">
                  <Flame size={16} className="zone-icon hot" />
                  <span className="zone-title">Hot Assets</span>
                  <span className="zone-subtitle">High query volume</span>
                </div>
                <div className="asset-grid">
                  {hotAssets.map(asset => (
                    <AssetCard key={asset.guid} asset={asset} variant="hot" />
                  ))}
                </div>
              </div>
            )}

            {/* Pinned Assets */}
            {pinnedAssetsData.length > 0 && (
              <div className="quick-access-zone">
                <div className="zone-header">
                  <Pin size={16} className="zone-icon" />
                  <span className="zone-title">Pinned</span>
                  <span className="zone-subtitle">Your shortcuts</span>
                </div>
                <div className="asset-list">
                  {pinnedAssetsData.map(asset => (
                    <AssetCard key={asset.guid} asset={asset} />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Assets */}
            {recentAssetsData.length > 0 && (
              <div className="quick-access-zone">
                <div className="zone-header">
                  <Clock size={16} className="zone-icon" />
                  <span className="zone-title">Recent</span>
                  <span className="zone-subtitle">Last accessed</span>
                </div>
                <div className="asset-list">
                  {recentAssetsData.slice(0, 5).map(asset => (
                    <AssetCard key={asset.guid} asset={asset} />
                  ))}
                </div>
              </div>
            )}

            {/* Browse Hierarchy (Collapsible) */}
            <div className="hierarchy-zone">
              <button
                className="zone-header clickable"
                onClick={() => setShowHierarchy(!showHierarchy)}
              >
                <span className="zone-icon">
                  {showHierarchy ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <Database size={16} className="zone-icon" />
                <span className="zone-title">Browse All</span>
                <span className="zone-subtitle">{hierarchyGroups.length} schemas</span>
              </button>

              {showHierarchy && (
                <div className="hierarchy-content">
                  {hierarchyGroups.slice(0, 20).map(group => (
                    <details key={group.path} className="schema-group">
                      <summary className="schema-header">
                        <Folder size={14} />
                        <span className="schema-name">{group.database} / {group.schema}</span>
                        <span className="schema-count">{group.assets.length}</span>
                        {group.hotCount > 0 && (
                          <span className="schema-badge">
                            <Flame size={10} />
                            {group.hotCount}
                          </span>
                        )}
                      </summary>
                      <div className="schema-assets">
                        {group.assets.map(asset => (
                          <div
                            key={asset.guid}
                            className={`schema-asset ${isSelected(asset.guid) ? 'selected' : ''}`}
                            onClick={() => handleAssetClick(asset)}
                            draggable
                            onDragStart={(e) => onAssetDragStart(e, asset)}
                          >
                            <Table2 size={12} />
                            <span>{asset.name}</span>
                            {isHotAsset(asset) && (
                              <Flame size={10} className="asset-hot-icon" />
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Quick Stats Footer */}
      <div className="command-footer">
        <div className="footer-stat">
          <span className="stat-value">{allAssets.length}</span>
          <span className="stat-label">total assets</span>
        </div>
        <div className="footer-stat">
          <span className="stat-value">{hotAssets.length}</span>
          <span className="stat-label">hot assets</span>
        </div>
        <div className="footer-hint">
          Drag assets to context bar • Pin favorites • Search to filter
        </div>
      </div>
    </div>
  );
}
