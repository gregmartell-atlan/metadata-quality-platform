/**
 * Session Store
 *
 * Manages persistent session state for the application.
 * Automatically saves/restores working context across browser sessions.
 */

import { create } from 'zustand';
import { storageService } from '../services/storage';
import type { SessionState } from '../services/storage';
import { logger } from '../utils/logger';

interface SessionStoreState {
  // Session state
  isInitialized: boolean;
  isRestoring: boolean;
  hasRestorableSession: boolean;
  lastQuery: SessionState['lastQuery'] | null;
  lastAssetGUIDs: string[];
  lastActiveTimestamp: number | null;

  // Actions
  initialize: () => Promise<void>;
  saveQueryContext: (query: SessionState['lastQuery']) => Promise<void>;
  saveAssetGUIDs: (guids: string[]) => Promise<void>;
  restoreSession: () => Promise<SessionState | null>;
  clearSession: () => Promise<void>;

  // Auto-snapshot helpers
  shouldAutoSnapshot: () => Promise<boolean>;
  recordAutoSnapshot: () => Promise<void>;
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  isInitialized: false,
  isRestoring: false,
  hasRestorableSession: false,
  lastQuery: null,
  lastAssetGUIDs: [],
  lastActiveTimestamp: null,

  initialize: async () => {
    try {
      logger.info('[SessionStore] Initializing...');

      const hasRestorable = await storageService.hasRestorableSession();
      const session = await storageService.getSession();

      set({
        isInitialized: true,
        hasRestorableSession: hasRestorable,
        lastQuery: session.lastQuery || null,
        lastAssetGUIDs: session.lastAssetGUIDs || [],
        lastActiveTimestamp: session.lastActiveTimestamp,
      });

      logger.info('[SessionStore] Initialized, restorable session:', hasRestorable);
    } catch (error) {
      logger.error('[SessionStore] Initialization failed:', error);
      set({ isInitialized: true });
    }
  },

  saveQueryContext: async (query) => {
    try {
      await storageService.saveLastQuery(query);
      set({ lastQuery: query });
      logger.debug('[SessionStore] Query context saved');
    } catch (error) {
      logger.error('[SessionStore] Failed to save query context:', error);
    }
  },

  saveAssetGUIDs: async (guids) => {
    try {
      await storageService.saveLastAssetGUIDs(guids);
      set({ lastAssetGUIDs: guids });
      logger.debug('[SessionStore] Asset GUIDs saved:', guids.length);
    } catch (error) {
      logger.error('[SessionStore] Failed to save asset GUIDs:', error);
    }
  },

  restoreSession: async () => {
    try {
      set({ isRestoring: true });
      const session = await storageService.getSession();
      set({
        isRestoring: false,
        lastQuery: session.lastQuery || null,
        lastAssetGUIDs: session.lastAssetGUIDs || [],
        lastActiveTimestamp: session.lastActiveTimestamp,
      });
      logger.info('[SessionStore] Session restored');
      return session;
    } catch (error) {
      logger.error('[SessionStore] Failed to restore session:', error);
      set({ isRestoring: false });
      return null;
    }
  },

  clearSession: async () => {
    try {
      await storageService.clearAll();
      set({
        hasRestorableSession: false,
        lastQuery: null,
        lastAssetGUIDs: [],
        lastActiveTimestamp: null,
      });
      logger.info('[SessionStore] Session cleared');
    } catch (error) {
      logger.error('[SessionStore] Failed to clear session:', error);
    }
  },

  shouldAutoSnapshot: async () => {
    return storageService.shouldAutoSnapshot();
  },

  recordAutoSnapshot: async () => {
    await storageService.recordAutoSnapshot();
  },
}));
