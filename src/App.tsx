import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary, GlobalSearch, useGlobalSearch } from './components/shared';
import { UnifiedHeader } from './components/layout/UnifiedHeader';
import { Sidebar } from './components/layout/Sidebar';
import { RightInspectorSidebar } from './components/layout/RightInspectorSidebar';
import { AssetInspectorModal } from './components/AssetInspector/AssetInspectorModal';
import { DebugPanel } from './components/debug/DebugPanel';
import { useUIPreferences } from './stores/uiPreferencesStore';
import { useAssetPreviewStore } from './stores/assetPreviewStore';
import { useBackendModeStore } from './stores/backendModeStore';
import { logger } from './utils/logger';
import './App.css';

// Lazy load page components for code splitting
const ExecutiveDashboard = lazy(() => import('./components/dashboard/ExecutiveDashboard').then(m => ({ default: m.ExecutiveDashboard })));
const PivotBuilder = lazy(() => import('./pages/PivotBuilder').then(m => ({ default: m.PivotBuilder })));
const LineageViewPage = lazy(() => import('./pages/LineageViewPage').then(m => ({ default: m.LineageViewPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const AssessmentPage = lazy(() => import('./pages/AssessmentPage').then(m => ({ default: m.AssessmentPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const ModelingAssistantPage = lazy(() => import('./pages/ModelingAssistantPage').then(m => ({ default: m.ModelingAssistantPage })));
const DebugPage = lazy(() => import('./pages/DebugPage').then(m => ({ default: m.DebugPage })));
const TenantConfigPage = lazy(() => import('./pages/TenantConfigPage').then(m => ({ default: m.TenantConfigPage })));

// V2 Assessment Run components
const StartScreen = lazy(() => import('./components/v2run').then(m => ({ default: m.StartScreen })));
const RunDashboard = lazy(() => import('./components/v2run').then(m => ({ default: m.RunDashboard })));
const AssessmentView = lazy(() => import('./components/v2run').then(m => ({ default: m.AssessmentView })));
const PlanView = lazy(() => import('./components/v2run').then(m => ({ default: m.PlanView })));
const ExportView = lazy(() => import('./components/v2run').then(m => ({ default: m.ExportView })));
const RunRoutesFallback = lazy(() => import('./components/v2run').then(m => ({ default: m.RunRoutesFallback })));

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
  const { density } = useUIPreferences();
  const { selectedAsset, isOpen: isPreviewOpen, isLoading: isPreviewLoading, closePreview } = useAssetPreviewStore();
  const { isOpen: isSearchOpen, closeSearch } = useGlobalSearch();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Get backend mode store actions
  const refreshStatus = useBackendModeStore((state) => state.refreshStatus);
  const fetchMdlhConfig = useBackendModeStore((state) => state.fetchMdlhConfig);
  const dataBackend = useBackendModeStore((state) => state.dataBackend);
  const snowflakeConnected = useBackendModeStore((state) => state.snowflakeStatus.connected);
  const connectionVersion = useBackendModeStore((state) => state.connectionVersion);

  // Initialize backend connection status on app startup
  useEffect(() => {
    const initBackend = async () => {
      logger.info('[App] Initializing backend mode...', { dataBackend });
      
      // Fetch MDLH config from server
      await fetchMdlhConfig();
      
      // Check current Snowflake connection status
      await refreshStatus();
      
      logger.info('[App] Backend initialization complete', { 
        dataBackend, 
        snowflakeConnected 
      });
    };
    
    initBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount
  
  // Log connection version changes for debugging
  useEffect(() => {
    if (connectionVersion > 0) {
      logger.info('[App] Connection version changed to ' + connectionVersion + 
        ' - All subscribed components should refresh data');
    }
  }, [connectionVersion]);

  // Apply theme and density to document
  useEffect(() => {
    const root = document.documentElement;

    // Apply theme - now forced to light
    root.setAttribute('data-theme', 'light');

    // Apply density
    root.setAttribute('data-density', density);
  }, [density]);

  return (
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
        <div className={`app ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          {/* Unified Header - spans full width */}
          <UnifiedHeader
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />

          {/* Sidebar - now positioned below header */}
          <Sidebar isCollapsed={isSidebarCollapsed} />

          {/* Main Content Area */}
          <main className="main-content">
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/dashboard" element={<ExecutiveDashboard />} />
                  <Route path="/pivot" element={<PivotBuilder />} />
                  <Route path="/lineage" element={<LineageViewPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/assessment" element={<AssessmentPage />} />
                  {/* V2 Assessment Run Routes */}
                  <Route path="/assessment/new" element={<StartScreen />} />
                  <Route path="/assessment/run/:id" element={<RunDashboard />}>
                    <Route index element={<RunRoutesFallback />} />
                    <Route path="assessment" element={<AssessmentView />} />
                    <Route path="plan" element={<PlanView />} />
                    <Route path="export" element={<ExportView />} />
                  </Route>
                  <Route path="/trends" element={<div className="page-placeholder">Quality Trends</div>} />
                  <Route path="/modeling-assistant" element={<ModelingAssistantPage />} />
                  <Route path="/debug" element={<DebugPage />} />
                  <Route path="/tenant-config" element={<TenantConfigPage />} />
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

          {/* Debug Panel (Ctrl+Shift+D) - Only in development */}
          {import.meta.env.DEV && <DebugPanel />}
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
