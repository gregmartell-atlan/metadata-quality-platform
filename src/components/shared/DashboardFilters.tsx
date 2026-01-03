/**
 * DashboardFilters - Reusable filter bar for dashboards
 *
 * Features:
 * - Multi-select dropdowns for dimensions
 * - Score range filter
 * - Clear all button
 * - URL state persistence (optional)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Filter, X, ChevronDown, Check } from 'lucide-react';
import { useScoresStore } from '../../stores/scoresStore';
import { useSearchParams } from 'react-router-dom';
import './DashboardFilters.css';

export interface FilterValues {
  connections: string[];
  owners: string[];
  assetTypes: string[];
  schemas: string[];
  certifications: string[];
  minScore: number;
  maxScore: number;
}

const DEFAULT_FILTERS: FilterValues = {
  connections: [],
  owners: [],
  assetTypes: [],
  schemas: [],
  certifications: [],
  minScore: 0,
  maxScore: 100,
};

interface DashboardFiltersProps {
  /** Current filter values */
  filters: FilterValues;
  /** Callback when filters change */
  onChange: (filters: FilterValues) => void;
  /** Whether to persist filters to URL */
  persistToUrl?: boolean;
  /** Custom class name */
  className?: string;
}

export function DashboardFilters({
  filters,
  onChange,
  persistToUrl = false,
  className = '',
}: DashboardFiltersProps) {
  const { assetsWithScores, byConnection, byOwner, byAssetType, bySchema, byCertification } =
    useScoresStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract unique values from store for filter options
  const options = useMemo(() => {
    return {
      connections: Array.from(byConnection.keys()).filter((k) => k !== 'No Connection').sort(),
      owners: Array.from(byOwner.keys()).filter((k) => k !== 'Unowned').sort(),
      assetTypes: Array.from(byAssetType.keys()).sort(),
      schemas: Array.from(bySchema.keys()).filter((k) => k !== 'No Schema').sort(),
      certifications: Array.from(byCertification.keys()).sort(),
    };
  }, [byConnection, byOwner, byAssetType, bySchema, byCertification]);

  // Load filters from URL on mount if persistToUrl is enabled
  useEffect(() => {
    if (!persistToUrl) return;

    const urlFilters: Partial<FilterValues> = {};

    const connections = searchParams.get('connections');
    if (connections) urlFilters.connections = connections.split(',');

    const owners = searchParams.get('owners');
    if (owners) urlFilters.owners = owners.split(',');

    const assetTypes = searchParams.get('assetTypes');
    if (assetTypes) urlFilters.assetTypes = assetTypes.split(',');

    const schemas = searchParams.get('schemas');
    if (schemas) urlFilters.schemas = schemas.split(',');

    const certifications = searchParams.get('certifications');
    if (certifications) urlFilters.certifications = certifications.split(',');

    const minScore = searchParams.get('minScore');
    if (minScore) urlFilters.minScore = parseInt(minScore, 10);

    const maxScore = searchParams.get('maxScore');
    if (maxScore) urlFilters.maxScore = parseInt(maxScore, 10);

    if (Object.keys(urlFilters).length > 0) {
      onChange({ ...DEFAULT_FILTERS, ...urlFilters });
    }
  }, []);

  // Sync filters to URL when they change
  useEffect(() => {
    if (!persistToUrl) return;

    const params = new URLSearchParams();

    if (filters.connections.length > 0) params.set('connections', filters.connections.join(','));
    if (filters.owners.length > 0) params.set('owners', filters.owners.join(','));
    if (filters.assetTypes.length > 0) params.set('assetTypes', filters.assetTypes.join(','));
    if (filters.schemas.length > 0) params.set('schemas', filters.schemas.join(','));
    if (filters.certifications.length > 0)
      params.set('certifications', filters.certifications.join(','));
    if (filters.minScore > 0) params.set('minScore', String(filters.minScore));
    if (filters.maxScore < 100) params.set('maxScore', String(filters.maxScore));

    setSearchParams(params, { replace: true });
  }, [filters, persistToUrl, setSearchParams]);

  const handleMultiSelectChange = useCallback(
    (key: keyof FilterValues, value: string) => {
      const current = filters[key] as string[];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onChange({ ...filters, [key]: updated });
    },
    [filters, onChange]
  );

  const handleClearAll = useCallback(() => {
    onChange(DEFAULT_FILTERS);
  }, [onChange]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.connections.length > 0) count++;
    if (filters.owners.length > 0) count++;
    if (filters.assetTypes.length > 0) count++;
    if (filters.schemas.length > 0) count++;
    if (filters.certifications.length > 0) count++;
    if (filters.minScore > 0 || filters.maxScore < 100) count++;
    return count;
  }, [filters]);

  // Don't show filters if no assets loaded
  if (assetsWithScores.length === 0) {
    return null;
  }

  return (
    <div className={`dashboard-filters ${className}`}>
      <div className="dashboard-filters-header">
        <Filter size={16} />
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <span className="dashboard-filters-count">{activeFilterCount}</span>
        )}
      </div>

      <div className="dashboard-filters-content">
        {/* Connection Filter */}
        <MultiSelectDropdown
          label="Connection"
          options={options.connections}
          selected={filters.connections}
          onChange={(value) => handleMultiSelectChange('connections', value)}
        />

        {/* Asset Type Filter */}
        <MultiSelectDropdown
          label="Asset Type"
          options={options.assetTypes}
          selected={filters.assetTypes}
          onChange={(value) => handleMultiSelectChange('assetTypes', value)}
        />

        {/* Owner Filter */}
        <MultiSelectDropdown
          label="Owner"
          options={options.owners}
          selected={filters.owners}
          onChange={(value) => handleMultiSelectChange('owners', value)}
        />

        {/* Schema Filter */}
        <MultiSelectDropdown
          label="Schema"
          options={options.schemas}
          selected={filters.schemas}
          onChange={(value) => handleMultiSelectChange('schemas', value)}
        />

        {/* Certification Filter */}
        <MultiSelectDropdown
          label="Certification"
          options={options.certifications}
          selected={filters.certifications}
          onChange={(value) => handleMultiSelectChange('certifications', value)}
        />

        {/* Score Range Filter */}
        <div className="dashboard-filter-item">
          <label className="dashboard-filter-label">Score Range</label>
          <div className="dashboard-filter-range">
            <input
              type="number"
              min={0}
              max={100}
              value={filters.minScore}
              onChange={(e) =>
                onChange({ ...filters, minScore: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
              className="dashboard-filter-range-input"
            />
            <span>to</span>
            <input
              type="number"
              min={0}
              max={100}
              value={filters.maxScore}
              onChange={(e) =>
                onChange({
                  ...filters,
                  maxScore: Math.min(100, parseInt(e.target.value, 10) || 100),
                })
              }
              className="dashboard-filter-range-input"
            />
          </div>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <button className="dashboard-filters-clear" onClick={handleClearAll}>
          <X size={14} />
          Clear All
        </button>
      )}
    </div>
  );
}

/**
 * Multi-select dropdown component
 */
interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (value: string) => void;
}

function MultiSelectDropdown({ label, options, selected, onChange }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (options.length === 0) return null;

  return (
    <div className="dashboard-filter-item">
      <label className="dashboard-filter-label">{label}</label>
      <div className="dashboard-filter-dropdown">
        <button
          className={`dashboard-filter-dropdown-trigger ${selected.length > 0 ? 'has-selection' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>
            {selected.length === 0
              ? `All ${label}s`
              : selected.length === 1
                ? selected[0]
                : `${selected.length} selected`}
          </span>
          <ChevronDown size={14} className={isOpen ? 'rotated' : ''} />
        </button>

        {isOpen && (
          <>
            <div className="dashboard-filter-dropdown-backdrop" onClick={() => setIsOpen(false)} />
            <div className="dashboard-filter-dropdown-menu">
              {options.map((option) => (
                <button
                  key={option}
                  className={`dashboard-filter-dropdown-item ${selected.includes(option) ? 'selected' : ''}`}
                  onClick={() => onChange(option)}
                >
                  <span className="dashboard-filter-dropdown-check">
                    {selected.includes(option) && <Check size={14} />}
                  </span>
                  <span className="dashboard-filter-dropdown-label">{option}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to use dashboard filters with state management
 */
export function useDashboardFilters(initialFilters?: Partial<FilterValues>) {
  const [filters, setFilters] = useState<FilterValues>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });

  const { assetsWithScores } = useScoresStore();

  // Filter assets based on current filter values
  const filteredAssets = useMemo(() => {
    return assetsWithScores.filter((item) => {
      // Connection filter
      if (
        filters.connections.length > 0 &&
        !filters.connections.includes(item.metadata.connection || '')
      ) {
        return false;
      }

      // Owner filter
      if (filters.owners.length > 0) {
        const owner = item.metadata.owner || item.metadata.ownerGroup || '';
        if (!filters.owners.includes(owner)) return false;
      }

      // Asset type filter
      if (
        filters.assetTypes.length > 0 &&
        !filters.assetTypes.includes(item.metadata.assetType || '')
      ) {
        return false;
      }

      // Schema filter
      if (filters.schemas.length > 0) {
        const schema = item.metadata.customProperties?.schemaName || 'No Schema';
        if (!filters.schemas.includes(schema)) return false;
      }

      // Certification filter
      if (filters.certifications.length > 0) {
        const cert = item.metadata.certificationStatus || 'none';
        const certLabel =
          cert === 'certified'
            ? 'Certified'
            : cert === 'draft'
              ? 'Draft'
              : cert === 'deprecated'
                ? 'Deprecated'
                : 'Not Certified';
        if (!filters.certifications.includes(certLabel)) return false;
      }

      // Score filter
      const score = item.scores.overall;
      if (score < filters.minScore || score > filters.maxScore) {
        return false;
      }

      return true;
    });
  }, [assetsWithScores, filters]);

  return {
    filters,
    setFilters,
    filteredAssets,
    totalCount: assetsWithScores.length,
    filteredCount: filteredAssets.length,
  };
}

export { DEFAULT_FILTERS };
