import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AssetStoreProvider } from './stores/assetStore'
import { ScoresStoreProvider } from './stores/scoresStore'
import { ScoringSettingsProvider } from './stores/scoringSettingsStore'
import { ErrorBoundary } from './components/shared'
import { ToastContainer, useToasts } from './components/shared/Toast'
import { validateEnvironment } from './utils/envValidation'

// Validate environment variables on startup
try {
  validateEnvironment();
} catch (error) {
  console.error('Environment validation failed:', error);
  // App will still load but may have issues
}

import { removeToast } from './components/shared/Toast'

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
      <ScoringSettingsProvider>
        <AssetStoreProvider>
          <ScoresStoreProvider>
            <AppWithToasts />
          </ScoresStoreProvider>
        </AssetStoreProvider>
      </ScoringSettingsProvider>
    </ErrorBoundary>
  </StrictMode>,
)
