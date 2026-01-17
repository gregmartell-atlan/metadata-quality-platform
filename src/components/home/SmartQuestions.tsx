/**
 * SmartQuestions Component
 * Natural language question prompts for quick context selection
 *
 * Provides suggested questions like "How does my Snowflake look today?"
 * that translate into context selections.
 *
 * Uses unified loader for MDLH-aware data fetching.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Sparkles, ArrowRight, Loader2, Snowflake } from 'lucide-react';
import { useAssetContextStore } from '../../stores/assetContextStore';
import { useScoresStore } from '../../stores/scoresStore';
import { useBackendModeStore } from '../../stores/backendModeStore';
import { loadConnectors, MdlhConnectionRequiredError } from '../../utils/unifiedAssetLoader';
import { loadAssetsForContext, generateContextLabel } from '../../utils/assetContextLoader';
import type { ConnectorInfo } from '../../services/atlan/api';
import './SmartQuestions.css';

interface SmartQuestion {
  id: string;
  question: string;
  contextType: 'connection' | 'all';
  connectionName?: string;
  description: string;
}

export function SmartQuestions() {
  const navigate = useNavigate();
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [needsConnection, setNeedsConnection] = useState(false);

  const { setContext, setLoading } = useAssetContextStore();
  const { stats } = useScoresStore();
  const { dataBackend, snowflakeStatus } = useBackendModeStore();

  // Load connectors on mount using unified loader
  useEffect(() => {
    const fetchConnectors = async () => {
      try {
        setNeedsConnection(false);
        const result = await loadConnectors();
        setConnectors(result.data);
      } catch (err) {
        if (err instanceof MdlhConnectionRequiredError) {
          setNeedsConnection(true);
          console.info('MDLH connection required for SmartQuestions');
        } else {
          console.error('Failed to load connectors:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchConnectors();
  }, [dataBackend, snowflakeStatus.connected]);

  // Generate smart questions based on available connections
  const questions = useMemo((): SmartQuestion[] => {
    const questionList: SmartQuestion[] = [];

    // Add connection-specific questions
    connectors.slice(0, 3).forEach(conn => {
      const connName = conn.name.toLowerCase();

      if (connName.includes('snowflake')) {
        questionList.push({
          id: `q-${conn.id}`,
          question: `How does my Snowflake look today?`,
          contextType: 'connection',
          connectionName: conn.name,
          description: `Analyze ${conn.assetCount.toLocaleString()} assets in ${conn.name}`
        });
      } else if (connName.includes('bigquery')) {
        questionList.push({
          id: `q-${conn.id}`,
          question: `What's the health of my BigQuery?`,
          contextType: 'connection',
          connectionName: conn.name,
          description: `Check quality across ${conn.assetCount.toLocaleString()} assets`
        });
      } else if (connName.includes('redshift')) {
        questionList.push({
          id: `q-${conn.id}`,
          question: `How's my Redshift warehouse doing?`,
          contextType: 'connection',
          connectionName: conn.name,
          description: `Review ${conn.assetCount.toLocaleString()} assets`
        });
      } else if (connName.includes('databricks')) {
        questionList.push({
          id: `q-${conn.id}`,
          question: `Show me Databricks quality metrics`,
          contextType: 'connection',
          connectionName: conn.name,
          description: `Explore ${conn.assetCount.toLocaleString()} assets`
        });
      } else {
        questionList.push({
          id: `q-${conn.id}`,
          question: `How's ${conn.name} performing?`,
          contextType: 'connection',
          connectionName: conn.name,
          description: `Analyze ${conn.assetCount.toLocaleString()} assets`
        });
      }
    });

    // Add a general question if we have stats
    if (stats.totalAssets > 0) {
      questionList.push({
        id: 'q-all',
        question: `What needs attention across my data?`,
        contextType: 'all',
        description: `Review critical assets and quality issues`
      });
    }

    // Add insight-based questions
    if (stats.criticalCount > 0) {
      questionList.push({
        id: 'q-critical',
        question: `Which assets need urgent improvement?`,
        contextType: 'all',
        description: `${stats.criticalCount} assets below quality threshold`
      });
    }

    return questionList.slice(0, 4);
  }, [connectors, stats]);

  const handleQuestionClick = async (question: SmartQuestion) => {
    setActiveQuestion(question.id);
    setLoading(true);

    try {
      if (question.contextType === 'connection' && question.connectionName) {
        const label = generateContextLabel('connection', { connectionName: question.connectionName });
        const assets = await loadAssetsForContext('connection', { connectionName: question.connectionName });
        setContext('connection', { connectionName: question.connectionName }, label, assets);
      }
      // For 'all' questions, just navigate without changing context
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to process question:', err);
    }

    setLoading(false);
    setActiveQuestion(null);
  };

  if (isLoading) {
    return null;
  }

  // Show connection prompt when MDLH is selected but not connected
  if (needsConnection) {
    return (
      <section className="home-section smart-questions-section">
        <h2 className="section-title">
          <Sparkles size={16} />
          Quick Questions
        </h2>
        <div className="smart-questions-connection-required">
          <Snowflake size={24} />
          <span>Connect to MDLH to see personalized questions</span>
          <button
            className="smart-questions-connect-btn"
            onClick={() => navigate('/settings')}
          >
            Connect
          </button>
        </div>
      </section>
    );
  }

  if (questions.length === 0) {
    return null;
  }

  return (
    <section className="home-section smart-questions-section">
      <h2 className="section-title">
        <Sparkles size={16} />
        Quick Questions
      </h2>
      <p className="section-subtitle">
        Click a question to explore your data
      </p>

      <div className="smart-questions-grid">
        {questions.map(question => (
          <button
            key={question.id}
            className={`smart-question-card ${activeQuestion === question.id ? 'loading' : ''}`}
            onClick={() => handleQuestionClick(question)}
            disabled={activeQuestion !== null}
          >
            <div className="smart-question-icon">
              <MessageCircle size={20} />
            </div>
            <div className="smart-question-content">
              <span className="smart-question-text">{question.question}</span>
              <span className="smart-question-description">{question.description}</span>
            </div>
            <div className="smart-question-action">
              {activeQuestion === question.id ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <ArrowRight size={16} />
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
