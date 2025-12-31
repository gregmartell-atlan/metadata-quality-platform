/**
 * Asset Browser Controls
 *
 * Provides sorting and filtering controls for the asset browser.
 * Helps users find assets by popularity, recency, or name.
 */

import { ArrowUpDown, Filter } from 'lucide-react';
import './AssetBrowserControls.css';

export type SortOption = 'name' | 'popularity' | 'recent';

interface AssetBrowserControlsProps {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  showPopularOnly: boolean;
  onShowPopularOnlyChange: (show: boolean) => void;
}

export function AssetBrowserControls({
  sortBy,
  onSortChange,
  showPopularOnly,
  onShowPopularOnlyChange,
}: AssetBrowserControlsProps) {
  return (
    <div className="asset-browser-controls">
      <div className="control-group">
        <ArrowUpDown size={14} className="control-icon" />
        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          title="Sort assets"
        >
          <option value="name">Sort: Name (A-Z)</option>
          <option value="popularity">Sort: Popularity (High-Low)</option>
          <option value="recent">Sort: Recent Activity</option>
        </select>
      </div>

      <label className="filter-toggle" title="Show only popular assets">
        <Filter size={14} className="control-icon" />
        <input
          type="checkbox"
          checked={showPopularOnly}
          onChange={(e) => onShowPopularOnlyChange(e.target.checked)}
        />
        <span>Popular Only</span>
      </label>
    </div>
  );
}
