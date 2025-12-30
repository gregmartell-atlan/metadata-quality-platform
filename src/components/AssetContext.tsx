/**
 * Asset Context Component
 * 
 * Global header component for setting and displaying asset context.
 * Supports drag/drop from AssetBrowser and manual context selection.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { BarChart3, Settings, Link2, Globe, X, Download, AlertTriangle, Loader2 } from 'lucide-react';
import { useAssetContextStore } from '../stores/assetContextStore';
import { useScoresStore } from '../stores/scoresStore';
import { useScoringSettingsStore } from '../stores/scoringSettingsStore';
import { loadAssetsForContext, generateContextLabel } from '../utils/assetContextLoader';
import { transformAtlanAsset } from '../services/atlan/transformer';
import { calculateAssetQuality, type QualityScores } from '../services/qualityMetrics';
import { getAtlanConfig } from '../services/atlan/api';
import { initializeScoringService, scoreAssets } from '../services/scoringService';
import type { AssetContextType, AssetContextFilters } from '../stores/assetContextStore';
import type { AtlanAsset } from '../services/atlan/types';
import type { AtlanAsset as ScoringAtlanAsset } from '../scoring/contracts';
import { getConnectors, getDatabases, getSchemas } from '../services/atlan/api';
import { logger } from '../utils/logger';
import './AssetContext.css';

export function AssetContext() {
  const {
    context,
    contextAssets,
    isLoading,
    error,
    setContext,
    setAllAssets,
    setContextAssets,
    clearContext,
    setLoading,
    setError,
    getContextLabel,
    getAssetCount,
  } = useAssetContextStore();

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [availableConnectors, setAvailableConnectors] = useState<Array<{ name: string; id: string }>>([]);
  const { setAssetsWithScores } = useScoresStore();
  const { scoringMode, setConfigVersion } = useScoringSettingsStore();
  const [configDrivenScores, setConfigDrivenScores] = useState<QualityScores | null>(null);

  // Log when context assets change
  useEffect(() => {
    logger.info('AssetContext: Context assets changed', {
      assetCount: contextAssets.length,
      contextType: context,
      contextLabel: getContextLabel(),
      scoringMode
    });
  }, [contextAssets, context, getContextLabel, scoringMode]);

  // Reload assets when context is restored from persistence but assets are missing
  useEffect(() => {
    const reloadAssetsForContext = async () => {
      // Only reload if we have a context but no assets (e.g., after page refresh)
      // Skip reload for manual context - those assets can't be reloaded
      const hasContext = !!context;
      const hasNoAssets = contextAssets.length === 0;
      const isNotManual = context?.type !== 'manual';
      const shouldReload = hasContext && hasNoAssets && !isLoading && isNotManual;
      
      if (shouldReload) {
        logger.info('AssetContext: Reloading assets for context', {
          contextType: context.type,
          contextLabel: context.label,
          filters: context.filters,
          expectedAssetCount: context.assetCount,
          currentAssetCount: contextAssets.length
        });

        try {
          setLoading(true);
          setError(null);
          const assets = await loadAssetsForContext(context.type, context.filters);
          logger.info('AssetContext: Assets reloaded for context', {
            contextType: context.type,
            assetCount: assets.length
          });
          
          if (assets.length === 0) {
            logger.warn('AssetContext: No assets found for context', {
              contextType: context.type,
              filters: context.filters
            });
            setError('No assets found for this context. The context may have been deleted or changed.');
          } else {
            setContextAssets(assets);
          }
        } catch (err) {
          logger.error('AssetContext: Failed to reload assets for context', err, {
            contextType: context.type,
            filters: context.filters
          });
          setError(err instanceof Error ? err.message : 'Failed to reload assets');
        } finally {
          setLoading(false);
        }
      }
    };

    reloadAssetsForContext();
  }, [context, contextAssets.length, isLoading, setContextAssets, setLoading, setError]);

  // Initialize scoring service when Atlan config is available
  useEffect(() => {
    const initService = async () => {
      const startTime = performance.now();
      logger.info('AssetContext: Initializing scoring service', { scoringMode });
      const config = getAtlanConfig();
      if (config && scoringMode === "config-driven") {
        // Set callbacks for config version and scoring mode
        const { setConfigVersionCallback, setScoringModeGetter } = await import("../services/scoringService");
        setConfigVersionCallback(setConfigVersion);
        setScoringModeGetter(() => scoringMode);
        initializeScoringService(config.baseUrl, config.apiKey);
        const duration = performance.now() - startTime;
        logger.info('AssetContext: Scoring service initialized', { duration: `${duration.toFixed(2)}ms` });
      } else {
        logger.info('AssetContext: Skipping scoring service init', { hasConfig: !!config, scoringMode });
      }
    };
    initService();
  }, [scoringMode, setConfigVersion]);

  // Auto-calculate scores when context assets change
  useEffect(() => {
    if (scoringMode === "config-driven" && contextAssets.length > 0) {
      const calculateConfigScores = async () => {
        const startTime = performance.now();
        logger.info('AssetContext: Starting config-driven score calculation', { 
          assetCount: contextAssets.length,
          scoringMode 
        });
        try {
          setLoading(true);
          const transformStart = performance.now();
          // Transform legacy assets to scoring format
          const scoringAssets: ScoringAtlanAsset[] = contextAssets.map(asset => ({
            guid: asset.guid,
            typeName: asset.typeName as any,
            name: asset.name,
            qualifiedName: asset.qualifiedName,
            connectionName: asset.connectionName,
            description: asset.description,
            userDescription: asset.userDescription,
            certificateStatus: asset.certificateStatus,
            ownerUsers: asset.ownerUsers,
            ownerGroups: asset.ownerGroups,
            domainGUIDs: asset.domainGUIDs,
            classificationNames: asset.classificationNames,
            meanUserRating: asset.meanUserRating,
            popularityScore: asset.popularityScore,
            viewCount: asset.viewCount,
            userCount: asset.userCount,
            updateTime: asset.updateTime,
            createTime: asset.createTime,
            customMetadata: asset.customMetadata,
            lineage: asset.lineage,
            readme: asset.readme,
          }));
          const transformDuration = performance.now() - transformStart;
          logger.debug('AssetContext: Asset transformation complete', { 
            duration: `${transformDuration.toFixed(2)}ms`,
            transformedCount: scoringAssets.length 
          });

          // Score assets using the scoring service
          const scoreStart = performance.now();
          logger.info('AssetContext: Calling scoreAssets service', { assetCount: scoringAssets.length });
          const results = await scoreAssets(scoringAssets);
          const scoreDuration = performance.now() - scoreStart;
          logger.info('AssetContext: Score calculation complete', { 
            duration: `${scoreDuration.toFixed(2)}ms`,
            resultCount: results.size 
          });

          // Aggregate scores across all assets and profiles
          const aggStart = performance.now();
          const agg = { completeness: 0, accuracy: 0, timeliness: 0, consistency: 0, usability: 0 };
          let count = 0;
          
          results.forEach((profileResults, guid) => {
            profileResults.forEach(result => {
              if (result.dimensions) {
                result.dimensions.forEach(dim => {
                  const score100 = dim.score01 * 100;
                  if (dim.dimension === "completeness") agg.completeness += score100;
                  else if (dim.dimension === "accuracy") agg.accuracy += score100;
                  else if (dim.dimension === "timeliness") agg.timeliness += score100;
                  else if (dim.dimension === "consistency") agg.consistency += score100;
                  else if (dim.dimension === "usability") agg.usability += score100;
                });
                count++;
              }
            });
          });
          
          if (count > 0) {
            const n = count;
            const finalScores = {
              completeness: Math.round(agg.completeness / n),
              accuracy: Math.round(agg.accuracy / n),
              timeliness: Math.round(agg.timeliness / n),
              consistency: Math.round(agg.consistency / n),
              usability: Math.round(agg.usability / n),
            };
            setConfigDrivenScores(finalScores);
            const aggDuration = performance.now() - aggStart;
            const totalDuration = performance.now() - startTime;
            logger.info('AssetContext: Config-driven scores calculated and set', { 
              scores: finalScores,
              aggregationDuration: `${aggDuration.toFixed(2)}ms`,
              totalDuration: `${totalDuration.toFixed(2)}ms`,
              dimensionCount: count 
            });
          } else {
            logger.warn('AssetContext: No scores to aggregate', { resultCount: results.size });
          }
        } catch (e: any) {
          const totalDuration = performance.now() - startTime;
          logger.error('Error calculating config-driven scores in AssetContext', e, { 
            duration: `${totalDuration.toFixed(2)}ms`,
            assetCount: contextAssets.length 
          });
        } finally {
          setLoading(false);
        }
      };
      
      calculateConfigScores();
    } else {
      logger.debug('AssetContext: Skipping config-driven scoring', { 
        scoringMode, 
        assetCount: contextAssets.length 
      });
      setConfigDrivenScores(null);
    }
  }, [contextAssets, scoringMode, setLoading]);

  // Calculate legacy scores when assets change
  const legacyScores = useMemo(() => {
    if (contextAssets.length === 0 || scoringMode === "config-driven") {
      logger.debug('AssetContext: Skipping legacy scoring', { 
        assetCount: contextAssets.length, 
        scoringMode 
      });
      return null;
    }
    
    const startTime = performance.now();
    logger.info('AssetContext: Starting legacy score calculation', { assetCount: contextAssets.length });
    try {
      // Transform Atlan assets to AssetMetadata and calculate scores
      const agg = { completeness: 0, accuracy: 0, timeliness: 0, consistency: 0, usability: 0 };
      contextAssets.forEach((asset, idx) => {
        const assetStart = performance.now();
        const metadata = transformAtlanAsset(asset);
        const s = calculateAssetQuality(metadata);
        agg.completeness += s.completeness;
        agg.accuracy += s.accuracy;
        agg.timeliness += s.timeliness;
        agg.consistency += s.consistency;
        agg.usability += s.usability;
        if (idx < 3 || idx === contextAssets.length - 1) {
          const assetDuration = performance.now() - assetStart;
          logger.debug(`AssetContext: Scored asset ${idx + 1}/${contextAssets.length}`, {
            guid: asset.guid,
            name: asset.name,
            scores: s,
            duration: `${assetDuration.toFixed(2)}ms`
          });
        }
      });
      const n = contextAssets.length;
      const finalScores = {
        completeness: Math.round(agg.completeness / n),
        accuracy: Math.round(agg.accuracy / n),
        timeliness: Math.round(agg.timeliness / n),
        consistency: Math.round(agg.consistency / n),
        usability: Math.round(agg.usability / n),
      };
      const totalDuration = performance.now() - startTime;
      logger.info('AssetContext: Legacy scores calculated', { 
        scores: finalScores,
        duration: `${totalDuration.toFixed(2)}ms`,
        avgPerAsset: `${(totalDuration / n).toFixed(2)}ms`
      });
      return finalScores;
    } catch (e: any) {
      const totalDuration = performance.now() - startTime;
      logger.error('Error calculating legacy scores in AssetContext', e, { 
        duration: `${totalDuration.toFixed(2)}ms`,
        assetCount: contextAssets.length 
      });
      return null;
    }
  }, [contextAssets, scoringMode]);

  // Update scores store when context assets change
  useEffect(() => {
    if (contextAssets.length > 0) {
      logger.info('AssetContext: Updating scores store', { assetCount: contextAssets.length });
      setAssetsWithScores(contextAssets);
      logger.debug('AssetContext: Scores store updated');
    } else {
      logger.debug('AssetContext: No assets to update in scores store');
    }
  }, [contextAssets, setAssetsWithScores]);

  // Load available connectors for selector
  useEffect(() => {
    const loadConnectors = async () => {
      try {
        const connectors = await getConnectors();
        if (connectors && connectors.length > 0) {
          setAvailableConnectors(connectors.map((c) => ({ name: c.name, id: c.id })));
        }
      } catch (err) {
        logger.error('Failed to load connectors for context selector', err);
        // Don't show error to user - selector will just be empty
      }
    };
    loadConnectors();
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingOver(true);
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDraggingOver(false);
    }
  }, []);

  // Handle drop from AssetBrowser
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      const dropStartTime = performance.now();
      logger.info('AssetContext: Drop event received');
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      setLoading(true);
      setError(null);

      try {
        const data = e.dataTransfer.getData('application/json');
        if (!data) {
          logger.warn('AssetContext: No drag data found');
          return;
        }

        const parsed = JSON.parse(data);
        logger.info('AssetContext: Parsed drop data', { 
          type: parsed.type, 
          nodeType: parsed.nodeType,
          nodeName: parsed.nodeName 
        });

        // Handle different drop types
        if (parsed.type === 'atlan-assets' && parsed.assets && Array.isArray(parsed.assets)) {
          // Assets already loaded - set context directly
          const assets = parsed.assets as AtlanAsset[];
          const label = parsed.nodeName || 'Selected Assets';
          logger.info('AssetContext: Setting context from pre-loaded assets', { 
            assetCount: assets.length,
            label 
          });
          setContext('manual', {}, label, assets);
          const dropDuration = performance.now() - dropStartTime;
          logger.info('AssetContext: Context set from assets', { duration: `${dropDuration.toFixed(2)}ms` });
        } else if (parsed.type === 'atlan-node') {
          logger.info('AssetContext: Loading assets for node', { 
            nodeType: parsed.nodeType,
            nodeName: parsed.nodeName 
          });
          // Node dropped - need to load assets based on node type
          const { nodeType, nodeName, connectorName, qualifiedName } = parsed;

          let contextType: AssetContextType;
          let filters: AssetContextFilters;
          let assets: AtlanAsset[];

          if (nodeType === 'connector' || nodeType === 'connection') {
            contextType = 'connection';
            filters = { connectionName: nodeName || connectorName };
            assets = await loadAssetsForContext(contextType, filters);
          } else if (nodeType === 'database') {
            contextType = 'database';
            // Extract connection and database from qualifiedName or use provided data
            // For database, nodeName is the database name
            if (!connectorName && !parsed.connectionName) {
              throw new Error('Connection name is required for database context');
            }
            if (!nodeName) {
              throw new Error('Database name is required');
            }
            filters = {
              connectionName: connectorName || parsed.connectionName,
              databaseName: nodeName,
            };
            assets = await loadAssetsForContext(contextType, filters);
          } else if (nodeType === 'schema') {
            contextType = 'schema';
            // For schema, we need connection, database, and schema names
            if (!connectorName && !parsed.connectionName) {
              throw new Error('Connection name is required for schema context');
            }
            // Try to extract database name from qualifiedName if not provided
            let databaseName = parsed.databaseName;
            if (!databaseName && qualifiedName) {
              // Qualified name format: connection/database/schema
              const parts = qualifiedName.split('/');
              if (parts.length >= 2) {
                databaseName = parts[parts.length - 2];
              }
            }
            if (!databaseName) {
              throw new Error('Database name is required for schema context');
            }
            if (!nodeName) {
              throw new Error('Schema name is required');
            }
            filters = {
              connectionName: connectorName || parsed.connectionName,
              databaseName,
              schemaName: nodeName,
            };
            assets = await loadAssetsForContext(contextType, filters);
          } else if (nodeType === 'table') {
            // For table, we can either use the asset directly or load it
            // If assets are already in the drag data, use them
            if (parsed.assets && Array.isArray(parsed.assets) && parsed.assets.length > 0) {
              const tableAssets = parsed.assets as AtlanAsset[];
              const label = nodeName || 'Table';
              setContext('manual', {}, label, tableAssets);
              setLoading(false);
              return;
            } else {
              throw new Error('Table asset data not available. Please expand the table node first.');
            }
          } else {
            throw new Error(`Unsupported node type: ${nodeType}`);
          }

          const label = generateContextLabel(contextType, filters);
          const loadDuration = performance.now() - dropStartTime;
          logger.info('AssetContext: Assets loaded for context', { 
            contextType,
            filters,
            assetCount: assets.length,
            label,
            loadDuration: `${loadDuration.toFixed(2)}ms`
          });
          
          // Warn if no assets were loaded, but still set context (reload effect will handle retry)
          if (assets.length === 0) {
            logger.warn('AssetContext: No assets loaded for context, but setting context anyway. Reload effect will attempt to reload.', {
              contextType,
              filters,
              label
            });
          }
          
          setContext(contextType, filters, label, assets);
          const totalDuration = performance.now() - dropStartTime;
          logger.info('AssetContext: Context set from node', { duration: `${totalDuration.toFixed(2)}ms` });
        }
      } catch (err) {
        const errorDuration = performance.now() - dropStartTime;
        logger.error('Failed to handle context drop', err, { duration: `${errorDuration.toFixed(2)}ms` });
        setError(err instanceof Error ? err.message : 'Failed to set context');
      } finally {
        setLoading(false);
      }
    },
    [setContext, setLoading, setError]
  );

  // Handle manual context selection
  const handleSelectAllAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      logger.debug('Loading all assets...');
      const assets = await loadAssetsForContext('all', {});
      if (assets.length === 0) {
        setError('No assets found. Make sure you have connected to Atlan and have assets available.');
      } else {
        setAllAssets(assets);
        logger.debug('Loaded all assets', { count: assets.length });
      }
    } catch (err) {
      logger.error('Failed to load all assets', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load all assets';
      // Show user-friendly error
      if (errorMessage.includes('Not configured') || errorMessage.includes('connection')) {
        setError('Please connect to Atlan first using the connection button in the header.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [setAllAssets, setLoading, setError]);

  const handleSelectConnection = useCallback(
    async (connectionName: string) => {
      setLoading(true);
      setError(null);
      try {
        const assets = await loadAssetsForContext('connection', { connectionName });
        const label = generateContextLabel('connection', { connectionName });
        setContext('connection', { connectionName }, label, assets);
        setShowSelector(false);
      } catch (err) {
        logger.error('Failed to load connection assets', err);
        setError(err instanceof Error ? err.message : 'Failed to load connection');
      } finally {
        setLoading(false);
      }
    },
    [setContext, setLoading, setError]
  );

  const contextLabel = getContextLabel();
  const assetCount = getAssetCount();

  return (
    <div
      className={`asset-context ${isDraggingOver ? 'drag-over' : ''} ${context ? 'has-context' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="asset-context-content">
        <div className="asset-context-label">
          <BarChart3 size={16} className="context-icon" />
          <span className="context-text">
            {contextLabel}
            {assetCount > 0 && (
              <span className="context-count">({assetCount.toLocaleString()} assets)</span>
            )}
          </span>
        </div>

        <div className="asset-context-actions">
          <div className="context-selector-wrapper">
            <button
              className="context-selector-btn"
              onClick={() => setShowSelector(!showSelector)}
              title="Select context"
            >
              <Settings size={16} />
            </button>
            {showSelector && (
              <div className="context-selector-dropdown">
                <button
                  className="context-option"
                  onClick={handleSelectAllAssets}
                  disabled={isLoading}
                >
                  <Globe size={14} className="option-icon" />
                  <span>All Assets</span>
                </button>
                {availableConnectors.map((connector) => (
                  <button
                    key={connector.id}
                    className="context-option"
                    onClick={() => handleSelectConnection(connector.name)}
                    disabled={isLoading}
                  >
                    <Link2 size={14} className="option-icon" />
                    <span>{connector.name}</span>
                  </button>
                ))}
                <div className="context-selector-divider"></div>
                <button
                  className="context-option"
                  onClick={clearContext}
                  disabled={isLoading}
                >
                  <X size={14} className="option-icon" />
                  <span>Clear Context</span>
                </button>
              </div>
            )}
          </div>

          {context && (
            <button
              className="context-clear-btn"
              onClick={clearContext}
              title="Clear context"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {isDraggingOver && (
        <div className="asset-context-drop-hint">
          <Download size={20} className="drop-icon" />
          <p>Drop here to set context</p>
        </div>
      )}

      {!context && !isDraggingOver && (
        <div className="asset-context-hint">
          <Download size={20} className="hint-icon" />
          <p>Drag a connection, database, or schema here to set context</p>
        </div>
      )}

      {isLoading && (
        <div className="asset-context-loading">
          <Loader2 size={16} className="loading-spinner spinning" />
          <span>Loading assets...</span>
        </div>
      )}

      {error && (
        <div className="asset-context-error">
          <AlertTriangle size={16} className="error-icon" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

