import { useEffect, useRef } from 'react';

/**
 * Hook React untuk otomatis memuat ulang data komponen ketika terjadi pembaruan
 * real-time dari perangkat lain (via WebSocket/SSE) maupun tab lain.
 */
export function useRealtimeSync(
  watchedKeys: string[] | '*',
  onRemoteUpdate: () => void,
  includeFileSync = false
): void {
  const callbackRef = useRef(onRemoteUpdate);
  callbackRef.current = onRemoteUpdate;

  const keysSignature = watchedKeys === '*' ? '*' : watchedKeys.join('|');

  useEffect(() => {
    let debounceTimer: number | null = null;

    const triggerReload = () => {
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        callbackRef.current();
      }, 60);
    };

    const handleRemoteSync = (event: Event) => {
      const custom = event as CustomEvent<{ keys?: string[] }>;
      const changedKeys = custom.detail?.keys || [];
      if (watchedKeys === '*' || changedKeys.includes('*')) {
        triggerReload();
        return;
      }
      const hasMatch = changedKeys.some((k) => watchedKeys.includes(k));
      if (hasMatch) {
        triggerReload();
      }
    };

    const handleFileSync = () => {
      if (includeFileSync) {
        triggerReload();
      }
    };

    window.addEventListener('simpel:remote-sync', handleRemoteSync);
    if (includeFileSync) {
      window.addEventListener('simpel:remote-file-sync', handleFileSync);
    }

    return () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      window.removeEventListener('simpel:remote-sync', handleRemoteSync);
      if (includeFileSync) {
        window.removeEventListener('simpel:remote-file-sync', handleFileSync);
      }
    };
  }, [keysSignature, includeFileSync]);
}
