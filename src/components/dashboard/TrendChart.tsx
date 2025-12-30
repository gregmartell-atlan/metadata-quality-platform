import { Card } from '../shared';
import { Line, Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { mockTrendData } from '../../services/mockData';
import './TrendChart.css';

export function TrendChart() {
  const data = mockTrendData.map((point) => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short' }),
    score: point.score,
  }));

  return (
    <Card className="trend-card" title="Health Score Trend (90 Days)">
      <div className="trend-chart">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis
              dataKey="date"
              stroke="var(--text-muted)"
              style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}
            />
            <YAxis
              stroke="var(--text-muted)"
              style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}
              domain={[0, 100]}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--accent-primary)"
              strokeWidth={2}
              fill="url(#trendGradient)"
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="var(--accent-primary)"
              strokeWidth={2}
              dot={{ fill: 'var(--accent-primary)', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

