/**
 * Test data fixtures for E2E tests
 * Centralized test data to ensure consistency across tests
 */

export const testData = {
  dashboard: {
    expectedScorecard: {
      overall: 67,
      completeness: 72,
      accuracy: 58,
      timeliness: 74,
      consistency: 61,
      usability: 69,
    },
    expectedCampaigns: [
      {
        name: 'Q4 Description Blitz',
        type: 'Resolution',
        status: 'active',
        progress: 68,
      },
      {
        name: 'Owner Assignment Sprint',
        type: 'Resolution',
        status: 'at-risk',
        progress: 34,
      },
      {
        name: 'PII Classification Review',
        type: 'Certification',
        status: 'active',
        progress: 82,
      },
    ],
    expectedTasks: [
      {
        title: 'Add description to customer_transactions',
        priority: 'critical',
        assignee: 'JD',
        overdue: true,
      },
    ],
  },
  pivotBuilder: {
    expectedPivots: [
      'Completeness by Connection & Asset Type',
      'Quality Scorecard: Domain × Dimension',
      'Owner Accountability: Certification Coverage',
      'Lineage Coverage: Source Systems',
    ],
    expectedTabs: ['All Pivots', 'Accountability', 'Domain Health', 'Lineage Coverage', 'Campaigns'],
  },
  navigation: {
    routes: [
      { path: '/', name: 'Executive Overview' },
      { path: '/pivot', name: 'Pivot Builder' },
      { path: '/stewardship', name: 'Stewardship Ops' },
      { path: '/campaigns', name: 'Campaign Tracking' },
      { path: '/trends', name: 'Quality Trends' },
      { path: '/accountability', name: 'Accountability' },
    ],
  },
};

export const scoreThresholds = {
  excellent: { min: 80, color: 'var(--score-excellent)' },
  good: { min: 60, max: 79, color: 'var(--score-good)' },
  fair: { min: 40, max: 59, color: 'var(--score-fair)' },
  poor: { min: 20, max: 39, color: 'var(--score-poor)' },
  critical: { max: 19, color: 'var(--score-critical)' },
};







