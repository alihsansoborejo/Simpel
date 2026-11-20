import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { syncService, SyncStatusSnapshot } from '../services/syncService';

interface SyncContextType extends SyncStatusSnapshot {
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [snapshot, setSnapshot] = useState<SyncStatusSnapshot>(() => syncService.getStatusSnapshot());

  useEffect(() => {
    void syncService.bootstrap();
    const unsubscribe = syncService.subscribeStatus(setSnapshot);
    return unsubscribe;
  }, []);

  const syncNow = useCallback(async () => {
    await syncService.syncNow();
  }, []);

  const value = useMemo(
    () => ({
      ...snapshot,
      syncNow,
    }),
    [snapshot, syncNow]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export const useSync = (): SyncContextType => {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return ctx;
};
