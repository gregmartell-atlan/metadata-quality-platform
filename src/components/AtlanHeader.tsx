import React, { useState, useEffect } from 'react';
import { Button } from './shared';
import { getAtlanClient, testAtlanConnection, configureAtlanApi, getSavedAtlanBaseUrl } from '../services/atlan/api';
import './AtlanHeader.css';

interface AtlanCredentials {
  apiKey: string;
  baseUrl: string;
}

interface AtlanHeaderProps {
  onConfigure: (creds: AtlanCredentials) => void;
}

const AtlanHeaderComponent: React.FC<AtlanHeaderProps> = ({ onConfigure }) => {
  const [showModal, setShowModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.atlan.com');
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Try to auto-fill from saved base URL
    const savedBaseUrl = getSavedAtlanBaseUrl();
    if (savedBaseUrl) {
      setBaseUrl(savedBaseUrl);
    }
    
    // Check if already configured
    const config = getAtlanClient();
    if (config) {
      setBaseUrl(config.baseUrl);
      setConfigured(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await testAtlanConnection({ apiKey, baseUrl });
      // Configure the API client (this also calls onConfigure internally via testAtlanConnection)
      configureAtlanApi({ apiKey, baseUrl });
      // Call the callback if provided
      if (onConfigure) {
        onConfigure({ apiKey, baseUrl });
      }
      setConfigured(true);
      setShowModal(false);
      
      // Dispatch custom event to notify other components (like AssetBrowser)
      window.dispatchEvent(new CustomEvent('atlan-connected', { 
        detail: { baseUrl } 
      }));
    } catch (err: any) {
      let errorMessage = err.message || 'Failed to connect to Atlan.';
      // Provide helpful error message for proxy connection issues
      if (errorMessage.includes('ERR_CONNECTION_REFUSED') || errorMessage.includes('Proxy server not running')) {
        errorMessage = 'Proxy server not running. Please start it with: npm run proxy';
      }
      setError(errorMessage);
    }
  };

  return (
    <>
      <div className={`atlan-status ${configured ? 'connected' : ''}`}>
        <Button 
          variant="ghost" 
          onClick={() => setShowModal(true)}
          className="atlan-status-btn"
        >
          {configured ? (
            <>
              <span className="atlan-icon">🔗</span>
              <span>Atlan Connected</span>
            </>
          ) : (
            'Connect to Atlan'
          )}
        </Button>
      </div>
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <form onSubmit={handleSubmit} style={{ background: '#18181b', padding: 32, borderRadius: 12, minWidth: 340, boxShadow: '0 8px 32px #0008', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <h2 style={{ color: '#fff', margin: 0, fontSize: 20 }}>Connect to Atlan</h2>
            <input
              type="text"
              placeholder="Atlan API Key"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              style={{ padding: 10, borderRadius: 6, border: '1px solid #333', background: '#222', color: '#fff' }}
              autoFocus
            />
            <input
              type="text"
              placeholder="Base URL"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              style={{ padding: 10, borderRadius: 6, border: '1px solid #333', background: '#222', color: '#fff' }}
            />
            {error && <div style={{ color: 'red', fontSize: 14, marginTop: 4 }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Connect
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

AtlanHeaderComponent.displayName = 'AtlanHeader';

export const AtlanHeader = React.memo(AtlanHeaderComponent);
