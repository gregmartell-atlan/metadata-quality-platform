/**
 * GlobalSearch - Command palette style search component
 *
 * Features:
 * - Keyboard shortcut (Cmd/Ctrl + K)
 * - Search across assets, pages, and actions
 * - Recent searches stored in localStorage
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, X, Clock, FileText, Database, User, Tag, ArrowRight } from 'lucide-react';
import { useScoresStore } from '../../stores/scoresStore';
import { useNavigate } from 'react-router-dom';
import './GlobalSearch.css';

const STORAGE_KEY = 'mqp.search.recent';
const MAX_RECENT_SEARCHES = 5;

interface SearchResult {
  id: string;
  type: 'asset' | 'page' | 'action';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface GlobalSearchProps {
  /** Whether the search modal is open */
  isOpen: boolean;
  /** Callback to close the search modal */
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { assetsWithScores } = useScoresStore();
  const navigate = useNavigate();

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Save search to recent
  const saveRecentSearch = useCallback((search: string) => {
    if (!search.trim()) return;

    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s !== search);
      const updated = [search, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
      return updated;
    });
  }, []);

  // Navigation pages
  const pages: SearchResult[] = useMemo(() => [
    {
      id: 'page-home',
      type: 'page',
      title: 'Home',
      subtitle: 'Dashboard overview',
      icon: <FileText size={16} />,
      action: () => navigate('/'),
    },
    {
      id: 'page-dashboard',
      type: 'page',
      title: 'Executive Dashboard',
      subtitle: 'Quality metrics and KPIs',
      icon: <FileText size={16} />,
      action: () => navigate('/dashboard'),
    },
    {
      id: 'page-analytics',
      type: 'page',
      title: 'DaaP Analytics',
      subtitle: 'Data as a Product insights',
      icon: <FileText size={16} />,
      action: () => navigate('/analytics'),
    },
    {
      id: 'page-pivot',
      type: 'page',
      title: 'Pivot Builder',
      subtitle: 'Custom pivot tables',
      icon: <FileText size={16} />,
      action: () => navigate('/pivot'),
    },
    {
      id: 'page-lineage',
      type: 'page',
      title: 'Lineage Explorer',
      subtitle: 'Data lineage visualization',
      icon: <FileText size={16} />,
      action: () => navigate('/lineage'),
    },
    {
      id: 'page-settings',
      type: 'page',
      title: 'Settings',
      subtitle: 'Application preferences',
      icon: <FileText size={16} />,
      action: () => navigate('/settings'),
    },
  ], [navigate]);

  // Search results
  const results = useMemo(() => {
    const searchResults: SearchResult[] = [];
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) {
      // Show recent searches and pages when no query
      return pages.slice(0, 4);
    }

    // Search assets
    assetsWithScores.forEach((item) => {
      const name = item.asset.name.toLowerCase();
      const connection = (item.metadata.connection || '').toLowerCase();
      const owner = (item.metadata.owner || '').toLowerCase();

      if (
        name.includes(lowerQuery) ||
        connection.includes(lowerQuery) ||
        owner.includes(lowerQuery)
      ) {
        searchResults.push({
          id: `asset-${item.asset.guid}`,
          type: 'asset',
          title: item.asset.name,
          subtitle: `${item.metadata.assetType} • ${item.metadata.connection}`,
          icon: <Database size={16} />,
          action: () => {
            // Could open asset inspector or navigate
            saveRecentSearch(query);
            onClose();
          },
        });
      }
    });

    // Search pages
    pages.forEach((page) => {
      if (
        page.title.toLowerCase().includes(lowerQuery) ||
        page.subtitle?.toLowerCase().includes(lowerQuery)
      ) {
        searchResults.push({
          ...page,
          action: () => {
            saveRecentSearch(query);
            page.action();
            onClose();
          },
        });
      }
    });

    return searchResults.slice(0, 10);
  }, [query, assetsWithScores, pages, saveRecentSearch, onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            results[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedEl = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="global-search-overlay" onClick={onClose}>
      <div className="global-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="global-search-input-wrapper">
          <Search size={20} className="global-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="global-search-input"
            placeholder="Search assets, pages, or actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button className="global-search-clear" onClick={() => setQuery('')}>
              <X size={16} />
            </button>
          )}
          <kbd className="global-search-kbd">ESC</kbd>
        </div>

        {/* Recent searches */}
        {!query && recentSearches.length > 0 && (
          <div className="global-search-section">
            <div className="global-search-section-title">
              <Clock size={14} />
              Recent Searches
            </div>
            <div className="global-search-recent">
              {recentSearches.map((search) => (
                <button
                  key={search}
                  className="global-search-recent-item"
                  onClick={() => setQuery(search)}
                >
                  {search}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="global-search-results" ref={resultsRef}>
          {results.length === 0 && query && (
            <div className="global-search-empty">
              No results found for "{query}"
            </div>
          )}
          {results.map((result, index) => (
            <button
              key={result.id}
              className={`global-search-result ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => result.action()}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="global-search-result-icon">{result.icon}</span>
              <div className="global-search-result-content">
                <span className="global-search-result-title">{result.title}</span>
                {result.subtitle && (
                  <span className="global-search-result-subtitle">{result.subtitle}</span>
                )}
              </div>
              <span className="global-search-result-type">{result.type}</span>
              <ArrowRight size={14} className="global-search-result-arrow" />
            </button>
          ))}
        </div>

        <div className="global-search-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
          <span><kbd>↵</kbd> to select</span>
          <span><kbd>esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage global search state and keyboard shortcut
 */
export function useGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);

  const openSearch = useCallback(() => setIsOpen(true), []);
  const closeSearch = useCallback(() => setIsOpen(false), []);
  const toggleSearch = useCallback(() => setIsOpen((prev) => !prev), []);

  // Global keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleSearch]);

  return {
    isOpen,
    openSearch,
    closeSearch,
    toggleSearch,
  };
}
