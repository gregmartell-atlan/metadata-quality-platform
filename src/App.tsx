import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary, GlobalSearch, useGlobalSearch } from './components/shared';
import { Sidebar } from './components/layout/Sidebar';
import { RightInspectorSidebar } from './components/layout/RightInspectorSidebar';
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

function App() {
  const { theme, density } = useUIPreferences();
  const { selectedAsset, isOpen: isPreviewOpen, isLoading: isPreviewLoading, closePreview } = useAssetPreviewStore();
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
          <main className="main-content">
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/dashboard" element={<ExecutiveDashboard />} />
                  <Route path="/pivot" element={<PivotBuilder />} />
                  <Route path="/lineage" element={<LineageViewPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/trends" element={<div className="page-placeholder">Quality Trends</div>} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>

          {/* Global Modals */}
          <AssetInspectorModal />

          {/* Unified Right Sidebar */}
          <RightInspectorSidebar />

          {/* Global Search (Cmd/Ctrl + K) */}
          <GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
