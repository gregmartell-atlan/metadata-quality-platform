import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AssetStoreProvider } from './stores/assetStore'
import { ScoresStoreProvider } from './stores/scoresStore'
import { ScoringSettingsProvider } from './stores/scoringSettingsStore'
import { QualityRulesProvider } from './stores/qualityRulesStore'
import { ErrorBoundary } from './components/shared'
import { ToastContainer, useToasts, removeToast } from './components/shared/Toast'
import { AutoSnapshotProvider } from './components/providers/AutoSnapshotProvider'
import { validateEnvironment } from './utils/envValidation'
import { logger } from './utils/logger'

// Validate environment variables on startup
try {
  validateEnvironment();
} catch (error) {
  logger.error('Environment validation failed', error);
  // App will still load but may have issues
}

// Toast container component
function AppWithToasts() {
  const toasts = useToasts();
  return (
    <>
      <App />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QualityRulesProvider>
        <ScoringSettingsProvider>
          <AssetStoreProvider>
            <ScoresStoreProvider>
              <AutoSnapshotProvider>
                <AppWithToasts />
              </AutoSnapshotProvider>
            </ScoresStoreProvider>
          </AssetStoreProvider>
        </ScoringSettingsProvider>
      </QualityRulesProvider>
    </ErrorBoundary>
  </StrictMode>,
)
