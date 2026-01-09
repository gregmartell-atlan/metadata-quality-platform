/**
 * BreadcrumbNav Component
 * Shows current context as clickable breadcrumb navigation
 * Allows quick navigation up the hierarchy
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Home, Database, Server, Layers, Table2 } from 'lucide-react';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { loadAssetsForContext, generateContextLabel } from '../../utils/assetContextLoader';
import './BreadcrumbNav.css';

interface BreadcrumbItem {
  id: string;
  label: string;
  type: 'home' | 'connection' | 'database' | 'schema' | 'table';
  contextType?: 'connection' | 'database' | 'schema';
  contextParams?: Record<string, string>;
}

export function BreadcrumbNav() {
  const navigate = useNavigate();
  const { contextType, contextParams, setContext, setLoading, clearContext } = useAssetContextStore();

  // Build breadcrumb items from current context
  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { id: 'home', label: 'Home', type: 'home' }
    ];

    if (!contextType || !contextParams) return items;

    // Add connection level
    if (contextParams.connectionName) {
      items.push({
        id: 'connection',
        label: contextParams.connectionName,
        type: 'connection',
        contextType: 'connection',
        contextParams: { connectionName: contextParams.connectionName }
      });
    }

    // Add database level
    if (contextParams.databaseName) {
      items.push({
        id: 'database',
        label: contextParams.databaseName,
        type: 'database',
        contextType: 'database',
        contextParams: {
          connectionName: contextParams.connectionName,
          databaseName: contextParams.databaseName
        }
      });
    }

    // Add schema level
    if (contextParams.schemaName) {
      items.push({
        id: 'schema',
        label: contextParams.schemaName,
        type: 'schema',
        contextType: 'schema',
        contextParams: {
          connectionName: contextParams.connectionName,
          databaseName: contextParams.databaseName,
          schemaName: contextParams.schemaName
        }
      });
    }

    return items;
  }, [contextType, contextParams]);

  const getIcon = (type: BreadcrumbItem['type']) => {
    switch (type) {
      case 'home': return <Home size={14} />;
      case 'connection': return <Server size={14} />;
      case 'database': return <Database size={14} />;
      case 'schema': return <Layers size={14} />;
      case 'table': return <Table2 size={14} />;
      default: return null;
    }
  };

  const handleClick = async (item: BreadcrumbItem) => {
    if (item.type === 'home') {
      clearContext();
      navigate('/');
      return;
    }

    if (item.contextType && item.contextParams) {
      setLoading(true);
      try {
        const label = generateContextLabel(item.contextType, item.contextParams);
        const assets = await loadAssetsForContext(item.contextType, item.contextParams);
        setContext(item.contextType, item.contextParams, label, assets);
      } catch (err) {
        console.error('Failed to navigate breadcrumb:', err);
      }
      setLoading(false);
    }
  };

  // Only show if we have more than just home
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="breadcrumb-nav" aria-label="Context breadcrumb">
      <ol className="breadcrumb-list">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <li key={item.id} className="breadcrumb-item">
              {index > 0 && (
                <ChevronRight size={12} className="breadcrumb-separator" />
              )}
              {isLast ? (
                <span className="breadcrumb-current">
                  {getIcon(item.type)}
                  <span>{item.label}</span>
                </span>
              ) : (
                <button
                  className="breadcrumb-link"
                  onClick={() => handleClick(item)}
                  title={`Navigate to ${item.label}`}
                >
                  {getIcon(item.type)}
                  <span>{item.label}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
