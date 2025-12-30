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
import { AppHeader } from '../layout/AppHeader';
import { Button } from '../shared';
import { useState, useEffect } from 'react';
import { useScoresStore } from '../../stores/scoresStore';
import './ExecutiveDashboard.css';

export function ExecutiveDashboard() {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { assetsWithScores } = useScoresStore();

  useEffect(() => {
    // Update last updated time when scores are calculated
    if (assetsWithScores.length > 0) {
      setLastUpdated(new Date());
    }
  }, [assetsWithScores]);

  const handleRefresh = () => {
    setLastUpdated(new Date());
    window.dispatchEvent(new CustomEvent('dashboard-refresh'));
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="executive-dashboard">
      <AppHeader
        title="Executive Overview"
        subtitle={`Last updated ${getTimeAgo(lastUpdated)}`}
      >
        <Button variant="secondary" className="filter-btn active">
          All Domains
        </Button>
        <Button variant="secondary" className="filter-btn">
          Last 30 Days
        </Button>
        <Button variant="primary" onClick={handleRefresh} className="refresh-btn">
          Refresh
        </Button>
      </AppHeader>

      <div className="dashboard-grid">
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
