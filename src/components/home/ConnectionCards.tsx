/**
 * Connection Cards
 * Shows available connections with quality scores for quick exploration
 * Auto-computes scores for all visible connections on mount
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Snowflake, Database, Link2, ArrowRight, Loader2, RefreshCw, BarChart2 } from 'lucide-react';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useScoresStore } from '../../stores/scoresStore';
import { getConnectors } from '../../services/atlan/api';
import { loadAssetsForContext, generateContextLabel } from '../../utils/assetContextLoader';
import { calculateAssetQuality } from '../../services/qualityMetrics';
import { transformAtlanAsset } from '../../services/atlan/transformer';
import type { ConnectorInfo } from '../../services/atlan/api';
import type { AtlanAsset } from '../../services/atlan/types';
import './ConnectionCards.css';

// Persisted scores cache (survives component remounts within session)
const connectionScoresCache: Record<string, { score: number; count: number; critical: number; computedAt: number }> = {};

export function ConnectionCards() {
  const navigate = useNavigate();
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingConnector, setLoadingConnector] = useState<string | null>(null);
  const [computingScores, setComputingScores] = useState<Set<string>>(new Set());
  const [cachedScores, setCachedScores] = useState<Record<string, { score: number; count: number; critical: number }>>(connectionScoresCache);
  const hasAutoComputed = useRef(false);

  const { setContext, setLoading } = useAssetContextStore();
  const { assetsWithScores, setAssetsWithScores } = useScoresStore();

  // Calculate scores by connection from store (live scores)
  const scoresByConnection = useMemo(() => {
    const scores: Record<string, { score: number; count: number; critical: number }> = {};

    assetsWithScores.forEach(({ asset, scores: assetScores }) => {
      const conn = asset.connectionName || 'Unknown';
      if (!scores[conn]) scores[conn] = { score: 0, count: 0, critical: 0 };
      scores[conn].score += assetScores.overall;
      scores[conn].count += 1;
      if (assetScores.overall < 40) scores[conn].critical += 1;
    });

    // Calculate averages
    Object.keys(scores).forEach(key => {
      if (scores[key].count > 0) {
        scores[key].score = Math.round(scores[key].score / scores[key].count);
      }
    });

    return scores;
  }, [assetsWithScores]);

  // Merge live scores with cached scores
  const mergedScores = useMemo(() => {
    return { ...cachedScores, ...scoresByConnection };
  }, [cachedScores, scoresByConnection]);

  // Auto-compute scores for a single connection
  const computeConnectionScore = useCallback(async (connector: ConnectorInfo) => {
    // Skip if already computing or has recent score
    if (computingScores.has(connector.name)) return;
    const cached = connectionScoresCache[connector.name];
    if (cached && Date.now() - cached.computedAt < 5 * 60 * 1000) return; // 5 min cache

    setComputingScores(prev => new Set(prev).add(connector.name));

    try {
      // Load sample of assets (limit to 100 for performance)
      const assets = await loadAssetsForContext('connection', { connectionName: connector.name }, { limit: 100 });

      if (assets.length > 0) {
        // Calculate scores using legacy scoring
        let totalScore = 0;
        let criticalCount = 0;
        let validCount = 0;

        assets.forEach(asset => {
          try {
            const metadata = transformAtlanAsset(asset);
            const scores = calculateAssetQuality(metadata);
            totalScore += scores.overall;
            validCount++;
            if (scores.overall < 40) criticalCount++;
          } catch {
            // Skip assets that fail to transform
          }
        });

        const avgScore = validCount > 0 ? Math.round(totalScore / validCount) : 0;

        // Cache the result
        connectionScoresCache[connector.name] = {
          score: avgScore,
          count: validCount,
          critical: criticalCount,
          computedAt: Date.now()
        };

        setCachedScores({ ...connectionScoresCache });
      }
    } catch (err) {
      console.error(`Failed to compute scores for ${connector.name}:`, err);
    } finally {
      setComputingScores(prev => {
        const next = new Set(prev);
        next.delete(connector.name);
        return next;
      });
    }
  }, [computingScores]);

  // Load connectors on mount
  useEffect(() => {
    getConnectors()
      .then(setConnectors)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // Auto-compute scores for all connections after they load
  useEffect(() => {
    if (connectors.length > 0 && !hasAutoComputed.current) {
      hasAutoComputed.current = true;

      // Compute scores for connections without cached scores (limit to first 6)
      const toCompute = connectors.slice(0, 6).filter(c => {
        const cached = connectionScoresCache[c.name];
        return !cached || Date.now() - cached.computedAt > 5 * 60 * 1000;
      });

      // Stagger requests to avoid overwhelming the API
      toCompute.forEach((connector, idx) => {
        setTimeout(() => computeConnectionScore(connector), idx * 500);
      });
    }
  }, [connectors, computeConnectionScore]);

  const getConnectionIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('snowflake')) return <Snowflake size={28} />;
    if (lower.includes('bigquery') || lower.includes('postgres') || lower.includes('databricks')) {
      return <Database size={28} />;
    }
    return <Link2 size={28} />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };

  const handleExplore = async (connector: ConnectorInfo) => {
    setLoadingConnector(connector.name);
    setLoading(true);

    try {
      const label = generateContextLabel('connection', { connectionName: connector.name });
      const assets = await loadAssetsForContext('connection', { connectionName: connector.name });
      setContext('connection', { connectionName: connector.name }, label, assets);
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to load context:', err);
    }

    setLoading(false);
    setLoadingConnector(null);
  };

  if (isLoading) {
    return (
      <section className="home-section connection-cards-section">
        <h2 className="section-title">
          <Database size={16} />
          Your Connections
        </h2>
        <div className="connection-cards-loading">
          <Loader2 size={24} className="spin" />
          <span>Loading connections...</span>
        </div>
      </section>
    );
  }

  if (connectors.length === 0) {
    return null;
  }

  return (
    <section className="home-section connection-cards-section">
      <div className="section-header">
        <h2 className="section-title">
          <Database size={16} />
          Your Connections
        </h2>
        <button
          className="refresh-btn"
          onClick={() => {
            setIsLoading(true);
            getConnectors()
              .then(setConnectors)
              .finally(() => setIsLoading(false));
          }}
          title="Refresh connections"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="connection-cards-grid">
        {connectors.slice(0, 6).map(connector => {
          const connScore = mergedScores[connector.name];
          const score = connScore?.score || 0;
          const scoreClass = getScoreColor(score);
          const hasScore = connScore && connScore.count > 0;
          const isComputing = computingScores.has(connector.name);

          return (
            <div key={connector.id} className={`connection-card ${hasScore ? scoreClass : ''}`}>
              <div className="connection-card-header">
                <div className="connection-icon">
                  {getConnectionIcon(connector.name)}
                </div>
                <div className="connection-info">
                  <h3 className="connection-name">{connector.name}</h3>
                  <span className="connection-count">
                    {connector.assetCount.toLocaleString()} assets
                  </span>
                </div>
              </div>

              <div className="connection-card-body">
                {isComputing ? (
                  <div className="computing-score">
                    <Loader2 size={16} className="spin" />
                    <span>Computing scores...</span>
                  </div>
                ) : hasScore ? (
                  <>
                    <div className="score-display">
                      <span className="score-value">{score}</span>
                      <span className="score-label">{getScoreLabel(score)}</span>
                    </div>
                    <div className="score-bar">
                      <div
                        className={`score-bar-fill ${scoreClass}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    {connScore.critical > 0 && (
                      <div className="critical-badge">
                        {connScore.critical} critical
                      </div>
                    )}
                  </>
                ) : (
                  <div className="no-score">
                    <span>No scores yet</span>
                    <span className="no-score-hint">Click explore to analyze</span>
                  </div>
                )}
              </div>

              <button
                className="explore-btn"
                onClick={() => handleExplore(connector)}
                disabled={loadingConnector === connector.name || isComputing}
              >
                {loadingConnector === connector.name ? (
                  <>
                    <Loader2 size={14} className="spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Explore
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
