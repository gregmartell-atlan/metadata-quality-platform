/**
 * Cross-tab state synchronization
 * Uses BroadcastChannel API to sync state across browser tabs
 */

type SyncEvent<T> = {
  type: string;
  payload: T;
  timestamp: number;
  tabId: string;
};

class CrossTabSync<T> {
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<(data: T) => void>();
  private tabId: string;

  constructor(channelName: string) {
    this.tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(channelName);
        this.channel.onmessage = (event: MessageEvent<SyncEvent<T>>) => {
          // Ignore messages from same tab
          if (event.data.tabId !== this.tabId) {
            this.listeners.forEach(listener => listener(event.data.payload));
          }
        };
      } catch (error) {
        console.warn('BroadcastChannel not supported, cross-tab sync disabled', error);
      }
    }
  }

  broadcast(data: T, type: string = 'update'): void {
    if (this.channel) {
      this.channel.postMessage({
        type,
        payload: data,
        timestamp: Date.now(),
        tabId: this.tabId,
      } as SyncEvent<T>);
    }
  }

  subscribe(listener: (data: T) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  close(): void {
    if (this.channel) {
      this.channel.close();
    }
    this.listeners.clear();
  }
}

// Create sync channels for different stores
export const assetContextSync = new CrossTabSync('asset-context-sync');
export const pivotStoreSync = new CrossTabSync('pivot-store-sync');


