import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { ErrorBoundary } from './components/shared';
import { Sidebar } from './components/layout/Sidebar';
import { ExecutiveDashboard } from './components/dashboard/ExecutiveDashboard';
import { PivotBuilder } from './pages/PivotBuilder';
import { LineageViewPage } from './pages/LineageViewPage';
import { AssetInspectorModal } from './components/AssetInspector/AssetInspectorModal';
import { useUIPreferences } from './stores/uiPreferencesStore';
import './App.css';

// Note: PersistentAssetBrowser removed - now using header-based AssetBrowserPanel

function App() {
  const { theme, density } = useUIPreferences();

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
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<ExecutiveDashboard />} />
              <Route path="/pivot" element={<PivotBuilder />} />
              <Route path="/lineage" element={<LineageViewPage />} />
              <Route path="/stewardship" element={<div className="page-placeholder">Stewardship Ops</div>} />
              <Route path="/campaigns" element={<div className="page-placeholder">Campaign Tracking</div>} />
              <Route path="/trends" element={<div className="page-placeholder">Quality Trends</div>} />
              <Route path="/accountability" element={<div className="page-placeholder">Accountability</div>} />
            </Routes>
          </ErrorBoundary>

          {/* Global Modals */}
          <AssetInspectorModal />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
