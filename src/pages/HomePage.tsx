/**
 * HomePage - Landing page with quick status and navigation modules
 *
 * Shows key metrics at a glance with quick access to all features
 */

import { Link } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader';
import { Card } from '../components/shared';
import { PinnedWidgets } from '../components/home/PinnedWidgets';
import { ConnectionCards } from '../components/home/ConnectionCards';
import { SmartQuestions } from '../components/home/SmartQuestions';
import {
  LayoutDashboard,
  Table2,
  GitBranch,
  Radar,
  TrendingUp,
  Target,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Zap,
  Database,
  Activity,
} from 'lucide-react';
import { useScoresStore } from '../stores/scoresStore';
import { useQualitySnapshotStore } from '../stores/qualitySnapshotStore';
import './HomePage.css';

// Quick action module types
interface QuickAction {
  icon: React.ReactNode;
  label: string;
  description: string;
  to: string;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    icon: <LayoutDashboard size={24} />,
    label: 'Executive Dashboard',
    description: 'Overview of metadata health',
    to: '/dashboard',
    color: 'blue',
  },
  {
    icon: <Table2 size={24} />,
    label: 'Pivot Builder',
    description: 'Analyze quality by dimension',
    to: '/pivot',
    color: 'purple',
  },
  {
    icon: <GitBranch size={24} />,
    label: 'Lineage Explorer',
    description: 'Trace data relationships',
    to: '/lineage',
    color: 'green',
  },
  {
    icon: <Radar size={24} />,
    label: 'DaaP Analytics',
    description: 'Data as a Product compliance',
    to: '/analytics',
    color: 'orange',
  },
];

export function HomePage() {
  const { assetsWithScores, stats } = useScoresStore();
  const { snapshots } = useQualitySnapshotStore();

  // Calculate quick stats
  const totalAssets = assetsWithScores.length;
  const healthScore = stats.averageScore || 0;
  const criticalAssets = assetsWithScores.filter(a => a.scores.overall < 40).length;
  const recentSnapshots = snapshots.slice(0, 3);

  // Get health status
  const getHealthStatus = (score: number) => {
    if (score >= 80) return { label: 'Healthy', color: 'green', icon: <CheckCircle2 size={20} /> };
    if (score >= 60) return { label: 'Fair', color: 'yellow', icon: <Activity size={20} /> };
    if (score >= 40) return { label: 'Needs Work', color: 'orange', icon: <AlertCircle size={20} /> };
    return { label: 'Critical', color: 'red', icon: <AlertCircle size={20} /> };
  };

  const healthStatus = getHealthStatus(healthScore);

  return (
    <div className="home-page">
      <AppHeader
        title="Metadata Quality Platform"
        subtitle="Your data health at a glance"
      />

      <div className="home-content">
        {/* Hero Stats Row */}
        <div className="hero-stats">
          <div className={`hero-stat hero-stat-${healthStatus.color}`}>
            <div className="hero-stat-icon">{healthStatus.icon}</div>
            <div className="hero-stat-content">
              <div className="hero-stat-value">{Math.round(healthScore)}%</div>
              <div className="hero-stat-label">Health Score</div>
              <div className="hero-stat-status">{healthStatus.label}</div>
            </div>
          </div>

          <div className="hero-stat">
            <div className="hero-stat-icon"><Database size={20} /></div>
            <div className="hero-stat-content">
              <div className="hero-stat-value">{totalAssets.toLocaleString()}</div>
              <div className="hero-stat-label">Assets Tracked</div>
              <div className="hero-stat-status">In current scope</div>
            </div>
          </div>

          <div className={`hero-stat ${criticalAssets > 0 ? 'hero-stat-red' : 'hero-stat-green'}`}>
            <div className="hero-stat-icon"><AlertCircle size={20} /></div>
            <div className="hero-stat-content">
              <div className="hero-stat-value">{criticalAssets}</div>
              <div className="hero-stat-label">Critical Assets</div>
              <div className="hero-stat-status">Below 40% quality</div>
            </div>
          </div>

          <div className="hero-stat">
            <div className="hero-stat-icon"><Clock size={20} /></div>
            <div className="hero-stat-content">
              <div className="hero-stat-value">{snapshots.length}</div>
              <div className="hero-stat-label">Snapshots</div>
              <div className="hero-stat-status">Quality history</div>
            </div>
          </div>
        </div>

        {/* Smart Questions - Natural language prompts */}
        <SmartQuestions />

        {/* Connection Cards - Quick access to explore connections */}
        <ConnectionCards />

        {/* Pinned Widgets Section */}
        <PinnedWidgets />

        {/* Quick Actions Grid */}
        <section className="home-section">
          <h2 className="section-title">Quick Actions</h2>
          <div className="quick-actions-grid">
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className={`quick-action-card quick-action-${action.color}`}
              >
                <div className="quick-action-icon">{action.icon}</div>
                <div className="quick-action-content">
                  <h3>{action.label}</h3>
                  <p>{action.description}</p>
                </div>
                <ArrowRight size={16} className="quick-action-arrow" />
              </Link>
            ))}
          </div>
        </section>

        {/* Two Column Layout */}
        <div className="home-columns">
          {/* Left: Recent Activity */}
          <section className="home-section">
            <h2 className="section-title">Recent Snapshots</h2>
            <Card>
              {recentSnapshots.length > 0 ? (
                <div className="recent-list">
                  {recentSnapshots.map((snapshot) => (
                    <div key={snapshot.id} className="recent-item">
                      <div className="recent-item-icon">
                        <TrendingUp size={16} />
                      </div>
                      <div className="recent-item-content">
                        <div className="recent-item-title">{snapshot.label}</div>
                        <div className="recent-item-meta">
                          {snapshot.assetCount} assets • {Math.round(snapshot.stats?.averageScore || 0)}% avg
                        </div>
                      </div>
                      <div className="recent-item-time">
                        {new Date(snapshot.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                  <Link to="/dashboard" className="recent-view-all">
                    View all snapshots <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="empty-state">
                  <Clock size={32} />
                  <p>No snapshots yet</p>
                  <span>Capture your first snapshot from the dashboard</span>
                </div>
              )}
            </Card>
          </section>

          {/* Right: Feature Highlights */}
          <section className="home-section">
            <h2 className="section-title">Get Started</h2>
            <Card>
              <div className="feature-list">
                <Link to="/pivot" className="feature-item">
                  <div className="feature-item-icon feature-icon-purple">
                    <Table2 size={18} />
                  </div>
                  <div className="feature-item-content">
                    <h4>Explore by Dimension</h4>
                    <p>Pivot quality scores by owner, domain, or schema</p>
                  </div>
                </Link>
                <Link to="/analytics" className="feature-item">
                  <div className="feature-item-icon feature-icon-orange">
                    <Target size={18} />
                  </div>
                  <div className="feature-item-content">
                    <h4>DaaP Compliance</h4>
                    <p>Check Data as a Product requirements coverage</p>
                  </div>
                </Link>
                <Link to="/lineage" className="feature-item">
                  <div className="feature-item-icon feature-icon-green">
                    <GitBranch size={18} />
                  </div>
                  <div className="feature-item-content">
                    <h4>Trace Lineage</h4>
                    <p>Visualize upstream and downstream dependencies</p>
                  </div>
                </Link>
                <Link to="/settings" className="feature-item">
                  <div className="feature-item-icon feature-icon-gray">
                    <Zap size={18} />
                  </div>
                  <div className="feature-item-content">
                    <h4>Configure Settings</h4>
                    <p>Customize filters, themes, and defaults</p>
                  </div>
                </Link>
              </div>
            </Card>
          </section>
        </div>

        {/* Bottom CTA */}
        {totalAssets === 0 && (
          <div className="home-cta">
            <div className="cta-content">
              <h3>No assets loaded yet</h3>
              <p>Connect to Atlan and browse assets to get started with quality scoring</p>
            </div>
            <div className="cta-actions">
              <Link to="/dashboard" className="btn btn-primary">
                <LayoutDashboard size={16} />
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
