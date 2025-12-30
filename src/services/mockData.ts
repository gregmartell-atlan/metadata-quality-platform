// Mock data service for development

export interface QualityScore {
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  usability: number;
  overall: number;
}

export interface DomainQuality {
  domain: string;
  scores: QualityScore;
  trend: number;
}

export interface Campaign {
  id: string;
  name: string;
  type: 'Resolution' | 'Certification';
  status: 'active' | 'at-risk';
  progress: number;
  totalTasks: number;
  completedTasks: number;
  dueDate: string;
  stewardCount: number;
}

export interface Task {
  id: string;
  title: string;
  asset: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignee: string;
  dueDate: string;
  overdue: boolean;
}

export interface Steward {
  id: string;
  name: string;
  initials: string;
  assetCount: number;
  avgScore: number;
  tasksDone: number;
  tasksTotal: number;
  trend: number;
}

export interface OwnerGroup {
  name: string;
  critical: number;
  poor: number;
  fair: number;
  good: number;
  total: number;
  avgScore: number;
}

export const mockQualityScore: QualityScore = {
  completeness: 72,
  accuracy: 58,
  timeliness: 74,
  consistency: 61,
  usability: 69,
  overall: 67,
};

export const mockDomainQuality: DomainQuality[] = [
  {
    domain: 'Customer Data',
    scores: { completeness: 92, accuracy: 78, timeliness: 85, consistency: 71, usability: 88, overall: 83 },
    trend: 4,
  },
  {
    domain: 'Financial',
    scores: { completeness: 88, accuracy: 91, timeliness: 76, consistency: 84, usability: 79, overall: 84 },
    trend: 2,
  },
  {
    domain: 'Product',
    scores: { completeness: 74, accuracy: 62, timeliness: 68, consistency: 55, usability: 71, overall: 66 },
    trend: 8,
  },
  {
    domain: 'Marketing',
    scores: { completeness: 58, accuracy: 52, timeliness: 41, consistency: 38, usability: 49, overall: 48 },
    trend: -3,
  },
  {
    domain: 'Operations',
    scores: { completeness: 65, accuracy: 58, timeliness: 72, consistency: 61, usability: 54, overall: 62 },
    trend: 0,
  },
  {
    domain: 'HR',
    scores: { completeness: 42, accuracy: 28, timeliness: 35, consistency: 22, usability: 31, overall: 32 },
    trend: -5,
  },
];

export const mockCampaigns: Campaign[] = [
  {
    id: '1',
    name: 'Q4 Description Blitz',
    type: 'Resolution',
    status: 'active',
    progress: 68,
    totalTasks: 503,
    completedTasks: 342,
    dueDate: '2024-12-31',
    stewardCount: 3,
  },
  {
    id: '2',
    name: 'Owner Assignment Sprint',
    type: 'Resolution',
    status: 'at-risk',
    progress: 34,
    totalTasks: 264,
    completedTasks: 89,
    dueDate: '2025-01-15',
    stewardCount: 5,
  },
  {
    id: '3',
    name: 'PII Classification Review',
    type: 'Certification',
    status: 'active',
    progress: 82,
    totalTasks: 190,
    completedTasks: 156,
    dueDate: '2025-01-05',
    stewardCount: 2,
  },
];

export const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Add description to customer_transactions',
    asset: 'snowflake/prod/customer_transactions',
    priority: 'critical',
    assignee: 'JD',
    dueDate: '2024-12-20',
    overdue: true,
  },
  {
    id: '2',
    title: 'Assign owner to marketing_campaigns',
    asset: 'bigquery/analytics/marketing_campaigns',
    priority: 'high',
    assignee: 'AS',
    dueDate: new Date().toISOString().split('T')[0],
    overdue: false,
  },
  {
    id: '3',
    title: 'Review PII classification for user_profiles',
    asset: 'redshift/warehouse/user_profiles',
    priority: 'medium',
    assignee: 'MK',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    overdue: false,
  },
  {
    id: '4',
    title: 'Certify dim_products after review',
    asset: 'snowflake/analytics/dim_products',
    priority: 'medium',
    assignee: 'RJ',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    overdue: false,
  },
  {
    id: '5',
    title: 'Update stale metadata on legacy_orders',
    asset: 'postgres/legacy/orders',
    priority: 'low',
    assignee: 'TL',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    overdue: false,
  },
];

export const mockStewards: Steward[] = [
  {
    id: '1',
    name: 'Jane Doe',
    initials: 'JD',
    assetCount: 342,
    avgScore: 76,
    tasksDone: 48,
    tasksTotal: 52,
    trend: 8,
  },
  {
    id: '2',
    name: 'Alex Smith',
    initials: 'AS',
    assetCount: 289,
    avgScore: 71,
    tasksDone: 35,
    tasksTotal: 41,
    trend: 5,
  },
  {
    id: '3',
    name: 'Maria Kim',
    initials: 'MK',
    assetCount: 198,
    avgScore: 62,
    tasksDone: 22,
    tasksTotal: 38,
    trend: 0,
  },
  {
    id: '4',
    name: 'Raj Patel',
    initials: 'RJ',
    assetCount: 156,
    avgScore: 58,
    tasksDone: 18,
    tasksTotal: 29,
    trend: -3,
  },
];

export const mockOwnerGroups: OwnerGroup[] = [
  { name: 'Data Engineering', critical: 12, poor: 45, fair: 189, good: 342, total: 588, avgScore: 72 },
  { name: 'Analytics', critical: 8, poor: 67, fair: 234, good: 156, total: 465, avgScore: 64 },
  { name: 'Finance', critical: 2, poor: 18, fair: 89, good: 203, total: 312, avgScore: 78 },
  { name: 'Marketing', critical: 34, poor: 89, fair: 112, good: 43, total: 278, avgScore: 48 },
  { name: 'Product', critical: 15, poor: 52, fair: 98, good: 67, total: 232, avgScore: 58 },
  { name: 'Operations', critical: 28, poor: 76, fair: 84, good: 31, total: 219, avgScore: 45 },
  { name: 'Unowned', critical: 156, poor: 89, fair: 42, good: 12, total: 299, avgScore: 24 },
];

export const mockStats = {
  assetsWithDescriptions: { value: 2847, trend: 12 },
  assetsWithOwners: { value: 78, trend: 8 },
  staleAssets: { value: 342, trend: -3 },
  certifiedAssets: { value: 1234, trend: 15 },
};

export const mockTrendData = [
  { date: '2024-10-01', score: 50 },
  { date: '2024-10-15', score: 52 },
  { date: '2024-11-01', score: 55 },
  { date: '2024-11-15', score: 58 },
  { date: '2024-12-01', score: 62 },
  { date: '2024-12-15', score: 65 },
  { date: new Date().toISOString().split('T')[0], score: 67 },
];

