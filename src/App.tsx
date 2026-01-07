import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary, GlobalSearch, useGlobalSearch } from './components/shared';
import { Sidebar } from './components/layout/Sidebar';
import { AppHeader } from './components/layout/AppHeader';
import { AssetPreviewDrawer } from './components/layout/AssetPreviewDrawer';
import { AssetInspectorModal } from './components/AssetInspector/AssetInspectorModal';
import { useUIPreferences } from './stores/uiPreferencesStore';
import { useAssetPreviewStore } from './stores/assetPreviewStore';
import './App.css';

// Lazy load page components for code splitting
const ExecutiveDashboard = lazy(() => import('./components/dashboard/ExecutiveDashboard').then(m => ({ default: m.ExecutiveDashboard })));
const PivotBuilder = lazy(() => import('./pages/PivotBuilder').then(m => ({ default: m.PivotBuilder })));
const LineageViewPage = lazy(() => import('./pages/LineageViewPage').then(m => ({ default: m.LineageViewPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));

// Loading fallback for lazy components
function PageLoader() {
  return (
    <div className="page-loader">
      <div className="page-loader-spinner" />
      <span>Loading...</span>
    </div>
  );
}

// Note: PersistentAssetBrowser removed - now using header-based AssetBrowserPanel

// Page titles and subtitles by route
const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Metadata Quality Platform', subtitle: 'Your data health at a glance' },
  '/dashboard': { title: 'Executive Dashboard', subtitle: 'Quality metrics overview' },
  '/pivot': { title: 'Pivot Builder', subtitle: 'Analyze by dimension' },
  '/lineage': { title: 'Lineage Explorer', subtitle: 'Trace data relationships' },
  '/analytics': { title: 'DaaP Analytics', subtitle: 'Data as a Product compliance' },
  '/settings': { title: 'Settings', subtitle: 'Configure your workspace' },
};

// Inner app component that has access to location
function AppContent() {
  const location = useLocation();
  const pageInfo = pageTitles[location.pathname] || { title: 'Metadata Quality Platform' };

  return (
    <>
      <AppHeader title={pageInfo.title} subtitle={pageInfo.subtitle} />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<ExecutiveDashboard />} />
          <Route path="/pivot" element={<PivotBuilder />} />
          <Route path="/lineage" element={<LineageViewPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/stewardship" element={<div className="page-placeholder">Stewardship Ops</div>} />
          <Route path="/campaigns" element={<div className="page-placeholder">Campaign Tracking</div>} />
          <Route path="/trends" element={<div className="page-placeholder">Quality Trends</div>} />
          <Route path="/accountability" element={<div className="page-placeholder">Accountability</div>} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  const { theme, density } = useUIPreferences();
  const { selectedAsset, isOpen: isPreviewOpen, closePreview } = useAssetPreviewStore();
  const { isOpen: isSearchOpen, closeSearch } = useGlobalSearch();

  // Apply theme and density to document
  useEffect(() => {
    const root = document.documentElement;

    // Apply theme
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }

    // Apply density
    root.setAttribute('data-density', density);
  }, [theme, density]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="app">
          <Sidebar />
          <div className="app-main">
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </div>

          {/* Global Modals */}
          <AssetInspectorModal />

          {/* Asset Preview Drawer */}
          <AssetPreviewDrawer
            asset={selectedAsset}
            isOpen={isPreviewOpen}
            onClose={closePreview}
          />

          {/* Global Search (Cmd/Ctrl + K) */}
          <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
