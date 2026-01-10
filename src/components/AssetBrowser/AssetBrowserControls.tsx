/**
 * Asset Browser Controls
 *
 * Provides sorting, filtering, and search controls for the asset browser.
 * Designed for large data estates (700k+ assets) with search-first approach.
 */

import { ArrowUpDown, Filter, Search, Flame, X } from 'lucide-react';
import './AssetBrowserControls.css';

export type SortOption = 'name' | 'popularity' | 'recent';

interface AssetBrowserControlsProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  showPopularOnly: boolean;
  onShowPopularOnlyChange: (show: boolean) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount?: number;  // Total assets available
  displayedCount?: number;  // Assets currently shown
}

export function AssetBrowserControls({
  sortBy,
  onSortChange,
  showPopularOnly,
  onShowPopularOnlyChange,
  searchQuery,
  onSearchChange,
  totalCount,
  displayedCount,
}: AssetBrowserControlsProps) {
  const hasMoreItems = totalCount !== undefined && displayedCount !== undefined && displayedCount < totalCount;

  return (
    <div className="asset-browser-controls">
      {/* Search box - primary way to find assets in large datasets */}
      <div className="search-box">
        <Search size={14} className="search-icon" />
        <input
          type="text"
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => onSearchChange('')}
            title="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="controls-row">
        <div className="control-group">
          <ArrowUpDown size={14} className="control-icon" />
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            title="Sort assets"
          >
            <option value="name">Sort: Name (A-Z)</option>
            <option value="popularity">Sort: Most Popular</option>
            <option value="recent">Sort: Recent Activity</option>
          </select>
        </div>

        <label className="filter-toggle" title="Show only popular assets (recommended for large datasets)">
          <Flame size={14} className={`control-icon ${showPopularOnly ? 'active' : ''}`} />
          <input
            type="checkbox"
            checked={showPopularOnly}
            onChange={(e) => onShowPopularOnlyChange(e.target.checked)}
          />
          <span>Popular Only</span>
        </label>

        {/* Show count indicator when results are truncated */}
        {hasMoreItems && (
          <span className="count-indicator" title={`Showing ${displayedCount?.toLocaleString()} of ${totalCount?.toLocaleString()} items. Use search or filters to find more.`}>
            {displayedCount?.toLocaleString()} of {totalCount?.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
