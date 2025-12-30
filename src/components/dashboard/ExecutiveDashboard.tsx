import {
  Scorecard,
  StatsRow,
  Heatmap,
  Campaigns,
  TrendChart,
  Tasks,
  Accountability,
  OwnerPivot,
} from './index';
import { AssetBrowser } from '../AssetBrowser';
import { AtlanHeader } from '../AtlanHeader';
import { Button } from '../shared';
import { getAtlanClient } from '../../services/atlan/api';
import { useState, useEffect } from 'react';
import { useScoresStore } from '../../stores/scoresStore';
import './ExecutiveDashboard.css';

export function ExecutiveDashboard() {
  const [atlanConnected, setAtlanConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { assetsWithScores } = useScoresStore();

  useEffect(() => {
    // Check Atlan connection status
    const config = getAtlanClient();
    setAtlanConnected(!!config);
  }, []);

  useEffect(() => {
    // Update last updated time when scores are calculated
    if (assetsWithScores.length > 0) {
      setLastUpdated(new Date());
    }
  }, [assetsWithScores]);

  const handleRefresh = () => {
    setLastUpdated(new Date());
    // Trigger a refresh of the data
    window.dispatchEvent(new CustomEvent('dashboard-refresh'));
  };

  const handleAtlanConfigure = () => {
    setAtlanConnected(true);
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  return (
    <div className="executive-dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Executive Overview</h1>
          <p>Metadata quality health across your data estate • Last updated {getTimeAgo(lastUpdated)}</p>
        </div>
        <div className="header-right">
          <div className="filter-group">
            <Button variant="secondary" className="filter-btn active">
              All Domains
            </Button>
            <Button variant="secondary" className="filter-btn">
              Last 30 Days
            </Button>
          </div>
          <div className="atlan-status-group">
            <AtlanHeader onConfigure={handleAtlanConfigure} />
            <Button variant="primary" onClick={handleRefresh} className="refresh-btn">
              ↻ Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="dashboard-grid">
        <AssetBrowser />
        <Scorecard />
        <StatsRow />
        <Heatmap />
        <Campaigns />
        <OwnerPivot />
        <TrendChart />
        <Tasks />
        <Accountability />
      </div>
    </div>
  );
}

