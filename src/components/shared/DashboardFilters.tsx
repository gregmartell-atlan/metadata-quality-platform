/**
 * DashboardFilters - Beautiful filter bar for dashboards
 *
 * Design: Linear/Stripe-inspired with:
 * - Elegant dropdown menus with search
 * - Smooth animations and micro-interactions
 * - Visual score range slider
 * - Refined filter pills
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Filter, X, ChevronDown, Check, Search, Sliders, RotateCcw } from 'lucide-react';
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
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
  persistToUrl?: boolean;
  className?: string;
  variant?: 'default' | 'compact' | 'inline';
}

export function DashboardFilters({
  filters,
  onChange,
  persistToUrl = false,
  className = '',
  variant = 'default',
}: DashboardFiltersProps) {
  const { assetsWithScores, byConnection, byOwner, byAssetType, bySchema, byCertification } =
    useScoresStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const options = useMemo(() => {
    return {
      connections: Array.from(byConnection.keys()).filter((k) => k !== 'No Connection').sort(),
      owners: Array.from(byOwner.keys()).filter((k) => k !== 'Unowned').sort(),
      assetTypes: Array.from(byAssetType.keys()).sort(),
      schemas: Array.from(bySchema.keys()).filter((k) => k !== 'No Schema').sort(),
      certifications: Array.from(byCertification.keys()).sort(),
    };
  }, [byConnection, byOwner, byAssetType, bySchema, byCertification]);

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

  const handleRemoveFilter = useCallback(
    (key: keyof FilterValues, value: string) => {
      const current = filters[key] as string[];
      onChange({ ...filters, [key]: current.filter((v) => v !== value) });
    },
    [filters, onChange]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    count += filters.connections.length;
    count += filters.owners.length;
    count += filters.assetTypes.length;
    count += filters.schemas.length;
    count += filters.certifications.length;
    if (filters.minScore > 0 || filters.maxScore < 100) count++;
    return count;
  }, [filters]);

  const allActiveFilters = useMemo(() => {
    const active: Array<{ key: keyof FilterValues; value: string; label: string }> = [];

    filters.connections.forEach(v => active.push({ key: 'connections', value: v, label: v }));
    filters.owners.forEach(v => active.push({ key: 'owners', value: v, label: v }));
    filters.assetTypes.forEach(v => active.push({ key: 'assetTypes', value: v, label: v }));
    filters.schemas.forEach(v => active.push({ key: 'schemas', value: v, label: v }));
    filters.certifications.forEach(v => active.push({ key: 'certifications', value: v, label: v }));

    return active;
  }, [filters]);

  if (assetsWithScores.length === 0) {
    return null;
  }

  return (
    <div className={`filters-container filters-${variant} ${className}`}>
      {/* Header */}
      <div className="filters-header">
        <div className="filters-title">
          <Sliders size={16} strokeWidth={1.5} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="filters-badge">{activeFilterCount}</span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button className="filters-reset" onClick={handleClearAll}>
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Filter Controls */}
      <div className="filters-controls">
        <FilterDropdown
          label="Connection"
          options={options.connections}
          selected={filters.connections}
          onChange={(value) => handleMultiSelectChange('connections', value)}
          placeholder="All connections"
        />

        <FilterDropdown
          label="Asset Type"
          options={options.assetTypes}
          selected={filters.assetTypes}
          onChange={(value) => handleMultiSelectChange('assetTypes', value)}
          placeholder="All types"
        />

        <FilterDropdown
          label="Owner"
          options={options.owners}
          selected={filters.owners}
          onChange={(value) => handleMultiSelectChange('owners', value)}
          placeholder="All owners"
        />

        <FilterDropdown
          label="Schema"
          options={options.schemas}
          selected={filters.schemas}
          onChange={(value) => handleMultiSelectChange('schemas', value)}
          placeholder="All schemas"
        />

        <FilterDropdown
          label="Certification"
          options={options.certifications}
          selected={filters.certifications}
          onChange={(value) => handleMultiSelectChange('certifications', value)}
          placeholder="All statuses"
        />

        {/* Score Range */}
        <div className="filter-group">
          <label className="filter-label">Score Range</label>
          <div className="filter-range">
            <input
              type="number"
              min={0}
              max={100}
              value={filters.minScore}
              onChange={(e) =>
                onChange({ ...filters, minScore: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
              className="filter-range-input"
            />
            <span className="filter-range-sep">—</span>
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
              className="filter-range-input"
            />
          </div>
        </div>
      </div>

      {/* Active Filter Pills */}
      {allActiveFilters.length > 0 && (
        <div className="filters-pills">
          {allActiveFilters.map((filter, i) => (
            <span key={`${filter.key}-${filter.value}`} className="filter-pill">
              <span className="filter-pill-label">{filter.label}</span>
              <button
                className="filter-pill-remove"
                onClick={() => handleRemoveFilter(filter.key, filter.value)}
                aria-label={`Remove ${filter.label} filter`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Beautiful Filter Dropdown with search
 */
interface FilterDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

function FilterDropdown({ label, options, selected, onChange, placeholder }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      searchRef.current?.focus();
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter(opt =>
      opt.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  if (options.length === 0) return null;

  const displayText = selected.length === 0
    ? placeholder || `All ${label}s`
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  return (
    <div className="filter-group" ref={dropdownRef}>
      <label className="filter-label">{label}</label>
      <div className="filter-dropdown">
        <button
          className={`filter-trigger ${selected.length > 0 ? 'has-selection' : ''} ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className="filter-trigger-text">{displayText}</span>
          <ChevronDown size={14} className="filter-trigger-icon" />
        </button>

        {isOpen && (
          <div className="filter-menu" role="listbox">
            {/* Search */}
            {options.length > 5 && (
              <div className="filter-search">
                <Search size={14} />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder={`Search ${label.toLowerCase()}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="filter-search-input"
                />
              </div>
            )}

            {/* Options */}
            <div className="filter-options">
              {filteredOptions.length === 0 ? (
                <div className="filter-empty">No results found</div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option}
                    className={`filter-option ${selected.includes(option) ? 'selected' : ''}`}
                    onClick={() => onChange(option)}
                    role="option"
                    aria-selected={selected.includes(option)}
                  >
                    <span className="filter-checkbox">
                      {selected.includes(option) && <Check size={12} />}
                    </span>
                    <span className="filter-option-label">{option}</span>
                  </button>
                ))
              )}
            </div>

            {/* Selected count */}
            {selected.length > 0 && (
              <div className="filter-menu-footer">
                {selected.length} selected
              </div>
            )}
          </div>
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

  const filteredAssets = useMemo(() => {
    return assetsWithScores.filter((item) => {
      if (
        filters.connections.length > 0 &&
        !filters.connections.includes(item.metadata.connection || '')
      ) {
        return false;
      }

      if (filters.owners.length > 0) {
        const owner = item.metadata.owner || item.metadata.ownerGroup || '';
        if (!filters.owners.includes(owner)) return false;
      }

      if (
        filters.assetTypes.length > 0 &&
        !filters.assetTypes.includes(item.metadata.assetType || '')
      ) {
        return false;
      }

      if (filters.schemas.length > 0) {
        const schema = item.metadata.customProperties?.schemaName || 'No Schema';
        if (!filters.schemas.includes(schema)) return false;
      }

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
