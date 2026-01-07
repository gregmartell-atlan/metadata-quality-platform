/**
 * Connection Cards
 * Shows available connections with quality scores for quick exploration
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Snowflake, Database, Link2, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useScoresStore } from '../../stores/scoresStore';
import { getConnectors } from '../../services/atlan/api';
import { loadAssetsForContext, generateContextLabel } from '../../utils/assetContextLoader';
import type { ConnectorInfo } from '../../services/atlan/api';
import './ConnectionCards.css';

export function ConnectionCards() {
  const navigate = useNavigate();
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingConnector, setLoadingConnector] = useState<string | null>(null);

  const { setContext, setLoading } = useAssetContextStore();
  const { assetsWithScores } = useScoresStore();

  // Calculate scores by connection
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

  // Load connectors on mount
  useEffect(() => {
    getConnectors()
      .then(setConnectors)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

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
          const connScore = scoresByConnection[connector.name];
          const score = connScore?.score || 0;
          const scoreClass = getScoreColor(score);
          const hasScore = connScore && connScore.count > 0;

          return (
            <div key={connector.id} className={`connection-card ${scoreClass}`}>
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
                {hasScore ? (
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
                disabled={loadingConnector === connector.name}
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
