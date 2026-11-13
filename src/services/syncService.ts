/**
 * Real-Time Cross-Device Synchronization Service (SIMPEL MI AL IHSAN)
 *
 * Arsitektur Sinkronisasi:
 * 1. Server-Authoritative State via WebSocket (/ws/sync) + HTTP Batch (/api/sync/batch)
 *    + Server-Sent Events (/api/sync/stream) fallback.
 * 2. Multi-tab sync instan via BroadcastChannel('simpel_sync_channel').
 * 3. Transparent localStorage interception untuk seluruh key `simpel_*` (kecuali session & flag lokal perangkat).
 * 4. Offline & reconnect mutation queue + pull delta pada focus/online/reconnect.
 * 5. Supabase Realtime listener tambahan jika VITE_SUPABASE_* terkonfigurasi.
 */

import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

export type SyncConnectionStatus = 'connected' | 'syncing' | 'reconnecting' | 'offline';

export interface SyncStatusSnapshot {
  status: SyncConnectionStatus;
  revision: number;
  activeDevices: number;
  lastSyncedAt: string | null;
  pendingCount: number;
}

const LOCAL_ONLY_KEYS = new Set<string>([
  'simpel_mi_session_user',
  'simpel_data_purged_sole_admin_v4',
]);

export function isSyncedKey(key: string): boolean {
  return typeof key === 'string' && key.startsWith('simpel_') && !LOCAL_ONLY_KEYS.has(key);
}

const CLIENT_ID_STORAGE_KEY = 'simpel_tab_client_id';
function getOrCreateClientId(): string {
  try {
    const existing = sessionStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = `cli-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return `cli-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  }
}

const INTERCEPTOR_FLAG = '__simpelSyncIntercepted';
const nativeSetItem = Storage.prototype.setItem;
const nativeRemoveItem = Storage.prototype.removeItem;

class RealtimeSyncService {
  private clientId = getOrCreateClientId();
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private isApplyingRemote = false;
  private isBootstrapped = false;
  private bootstrapPromise: Promise<void> | null = null;

  private lastRevision = 0;
  private activeDevices = 1;
  private lastSyncedAt: string | null = null;
  private status: SyncConnectionStatus = 'reconnecting';

  private pendingMutations = new Map<string, { value: string | null; updatedAt: string }>();
  private flushTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private heartbeatTimer: number | null = null;
  private lastKnownValues = new Map<string, string | null>();

  private statusListeners = new Set<(snap: SyncStatusSnapshot) => void>();

  constructor() {
    this.setupBroadcastChannel();
  }

  private snapshotLocalValues(): void {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && isSyncedKey(key)) {
          this.lastKnownValues.set(key, window.localStorage.getItem(key));
        }
      }
    } catch {
      // ignore
    }
  }

  private setupBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.broadcastChannel = new BroadcastChannel('simpel_sync_channel');
      this.broadcastChannel.onmessage = (event) => {
        const msg = event.data;
        if (!msg || msg.sourceClientId === this.clientId) return;

        if (msg.type === 'tab:delta' && msg.entries) {
          this.applyRemoteEntries(msg.entries, msg.revision);
        } else if (msg.type === 'tab:file-sync') {
          window.dispatchEvent(new CustomEvent('simpel:remote-file-sync', { detail: msg }));
        }
      };
    } catch {
      // ignore
    }
  }

  public installStorageInterceptor(): void {
    if (typeof window === 'undefined') return;
    if ((Storage.prototype as any)[INTERCEPTOR_FLAG]) return;

    const self = this;

    Storage.prototype.setItem = function (key: string, value: string) {
      nativeSetItem.call(this, key, value);
      if (this === window.localStorage && !self.isApplyingRemote && isSyncedKey(key)) {
        const strVal = String(value);
        const prevVal = self.lastKnownValues.get(key);
        if (prevVal === strVal) return;
        self.lastKnownValues.set(key, strVal);
        self.enqueueMutation(key, strVal);
      }
    };

    Storage.prototype.removeItem = function (key: string) {
      nativeRemoveItem.call(this, key);
      if (this === window.localStorage && !self.isApplyingRemote && isSyncedKey(key)) {
        const prevVal = self.lastKnownValues.get(key);
        if (prevVal === null || prevVal === undefined) return;
        self.lastKnownValues.set(key, null);
        self.enqueueMutation(key, null);
      }
    };

    (Storage.prototype as any)[INTERCEPTOR_FLAG] = true;
  }

  private enqueueMutation(key: string, value: string | null): void {
    const updatedAt = new Date().toISOString();
    this.pendingMutations.set(key, { value, updatedAt });
    this.emitStatus();

    // Instant same-browser multi-tab sync
    try {
      this.broadcastChannel?.postMessage({
        type: 'tab:delta',
        sourceClientId: this.clientId,
        revision: this.lastRevision,
        entries: {
          [key]: { value, updatedAt, revision: this.lastRevision },
        },
      });
    } catch {
      // ignore
    }

    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
    }
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.flushMutations();
    }, 15);
  }

  public async flushMutations(): Promise<void> {
    if (this.pendingMutations.size === 0) return;

    const batch: Array<{ key: string; value: string | null; updatedAt: string }> = [];
    this.pendingMutations.forEach((entry, key) => {
      batch.push({ key, value: entry.value, updatedAt: entry.updatedAt });
    });
    this.pendingMutations.clear();
    this.status = 'syncing';
    this.emitStatus();

    // Try WebSocket first for lowest latency (<20ms)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'sync:patch',
            clientId: this.clientId,
            mutations: batch,
          })
        );
        this.lastSyncedAt = new Date().toISOString();
        this.status = 'connected';
        this.emitStatus();
        return;
      } catch (err) {
        console.warn('[Sync] WebSocket send failed, falling back to HTTP batch:', err);
      }
    }

    // Fallback to HTTP POST /api/sync/batch
    try {
      const res = await fetch('/api/sync/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: this.clientId,
          mutations: batch,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (typeof json.revision === 'number') {
        this.lastRevision = Math.max(this.lastRevision, json.revision);
      }
      this.lastSyncedAt = new Date().toISOString();
      this.status = this.ws?.readyState === WebSocket.OPEN ? 'connected' : 'reconnecting';
      this.emitStatus();
    } catch (err) {
      // Re-queue failed batch if offline, preserving newer mutations already queued
      batch.forEach((m) => {
        if (!this.pendingMutations.has(m.key)) {
          this.pendingMutations.set(m.key, { value: m.value, updatedAt: m.updatedAt });
        }
      });
      this.status = navigator.onLine ? 'reconnecting' : 'offline';
      this.emitStatus();
      console.warn('[Sync] Batch deferred for retry:', err);
    }
  }

  private flushBeaconOnUnload(): void {
    if (this.pendingMutations.size === 0) return;
    const batch: Array<{ key: string; value: string | null; updatedAt: string }> = [];
    this.pendingMutations.forEach((entry, key) => {
      batch.push({ key, value: entry.value, updatedAt: entry.updatedAt });
    });
    const payload = JSON.stringify({ clientId: this.clientId, mutations: batch });
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/sync/batch', blob);
      } else {
        void fetch('/api/sync/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        });
      }
      this.pendingMutations.clear();
    } catch {
      // ignore
    }
  }

  private applyRemoteEntries(
    entries: Record<string, { value: string | null; updatedAt?: string; revision?: number }>,
    revision?: number
  ): string[] {
    if (!entries || typeof entries !== 'object') return [];

    const changedKeys: string[] = [];
    this.isApplyingRemote = true;
    try {
      for (const [key, entry] of Object.entries(entries)) {
        if (!isSyncedKey(key)) continue;
        // Skip overwriting key if user has an un-flushed newer local mutation for this exact key
        if (this.pendingMutations.has(key)) continue;

        const remoteValue = entry?.value ?? null;
        const currentLocal = window.localStorage.getItem(key);

        if (remoteValue === null) {
          if (currentLocal !== null) {
            nativeRemoveItem.call(window.localStorage, key);
            this.lastKnownValues.set(key, null);
            changedKeys.push(key);
          }
        } else if (currentLocal !== remoteValue) {
          nativeSetItem.call(window.localStorage, key, remoteValue);
          this.lastKnownValues.set(key, remoteValue);
          changedKeys.push(key);
        }
      }
    } finally {
      this.isApplyingRemote = false;
    }

    if (typeof revision === 'number' && revision > this.lastRevision) {
      this.lastRevision = revision;
    }
    this.lastSyncedAt = new Date().toISOString();

    if (changedKeys.length > 0) {
      window.dispatchEvent(
        new CustomEvent('simpel:remote-sync', {
          detail: { keys: changedKeys, revision: this.lastRevision },
        })
      );
    }

    this.emitStatus();
    return changedKeys;
  }

  public async pullFromServer(sinceRevision = 0): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 2500);
      const url = sinceRevision > 0 ? `/api/sync/state?since=${sinceRevision}` : '/api/sync/state';
      const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
      window.clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (typeof data.activeClients === 'number') {
        this.activeDevices = data.activeClients;
      }

      const serverEntries = data.entries || {};
      const serverRevision = typeof data.revision === 'number' ? data.revision : 0;

      if (serverRevision > 0 || Object.keys(serverEntries).length > 0) {
        this.applyRemoteEntries(serverEntries, serverRevision);
      } else if (sinceRevision === 0) {
        // Server belum terinisialisasi sama sekali -> kirim state lokal awal ke server sebagai baseline
        await this.seedServerWithInitialLocalState();
      }

      this.lastSyncedAt = new Date().toISOString();
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.status = 'connected';
      }
      this.emitStatus();
    } catch (err) {
      console.warn('[Sync] Pull failed:', err);
    }
  }

  private async seedServerWithInitialLocalState(): Promise<void> {
    const mutations: Array<{ key: string; value: string; updatedAt: string }> = [];
    const now = new Date().toISOString();
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && isSyncedKey(key)) {
          const val = window.localStorage.getItem(key);
          if (val !== null) {
            mutations.push({ key, value: val, updatedAt: now });
          }
        }
      }
      if (mutations.length > 0) {
        const res = await fetch('/api/sync/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: this.clientId, mutations }),
        });
        if (res.ok) {
          const json = await res.json();
          if (typeof json.revision === 'number') {
            this.lastRevision = Math.max(this.lastRevision, json.revision);
          }
        }
      }
    } catch (err) {
      console.warn('[Sync] Initial seed failed:', err);
    }
  }

  private connectWebSocket(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/sync?clientId=${encodeURIComponent(this.clientId)}`;

    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.status = 'connected';
        this.emitStatus();

        // Flush queued mutations immediately upon connect/reconnect
        if (this.pendingMutations.size > 0) {
          void this.flushMutations();
        } else if (this.lastRevision > 0) {
          // Pull missed deltas while disconnected
          ws.send(JSON.stringify({ type: 'sync:pull', since: this.lastRevision }));
        }

        // Start heartbeat every 25s to keep proxy/mobile connections alive
        if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (!msg || !msg.type) return;

          if (msg.type === 'sync:init' || msg.type === 'sync:state') {
            if (typeof msg.activeClients === 'number') this.activeDevices = msg.activeClients;
            const entries = msg.entries || {};
            if (msg.revision > 0 || Object.keys(entries).length > 0) {
              this.applyRemoteEntries(entries, msg.revision);
            }
            this.status = 'connected';
            this.emitStatus();
          } else if (msg.type === 'sync:delta') {
            if (msg.sourceClientId === this.clientId) return;
            this.applyRemoteEntries(msg.entries || {}, msg.revision);
          } else if (msg.type === 'sync:ack') {
            if (typeof msg.revision === 'number') {
              this.lastRevision = Math.max(this.lastRevision, msg.revision);
            }
            this.lastSyncedAt = new Date().toISOString();
            this.status = 'connected';
            this.emitStatus();
          } else if (msg.type === 'presence:count') {
            if (typeof msg.count === 'number') {
              this.activeDevices = msg.count;
              this.emitStatus();
            }
          } else if (msg.type === 'sync:file:upsert' || msg.type === 'sync:file:delete') {
            if (msg.sourceClientId === this.clientId) return;
            window.dispatchEvent(new CustomEvent('simpel:remote-file-sync', { detail: msg }));
          }
        } catch (err) {
          console.warn('[Sync] Failed parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        if (this.heartbeatTimer !== null) {
          window.clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }
        this.ws = null;
        this.status = navigator.onLine ? 'reconnecting' : 'offline';
        this.emitStatus();
        this.scheduleReconnect();
      };

      ws.onerror = () => {
        // Closed handler handles reconnect cleanly
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private setupSSEFallback(): void {
    if (typeof EventSource === 'undefined' || this.sse) return;
    try {
      const sse = new EventSource(`/api/sync/stream?clientId=${encodeURIComponent(this.clientId)}`);
      this.sse = sse;
      sse.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // Only process SSE if WebSocket is not actively open to prevent double work
          if (this.ws?.readyState === WebSocket.OPEN) return;
          if (msg.type === 'sync:delta' && msg.sourceClientId !== this.clientId) {
            this.applyRemoteEntries(msg.entries || {}, msg.revision);
          } else if ((msg.type === 'sync:file:upsert' || msg.type === 'sync:file:delete') && msg.sourceClientId !== this.clientId) {
            window.dispatchEvent(new CustomEvent('simpel:remote-file-sync', { detail: msg }));
          }
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delay = Math.min(5000, 350 * Math.pow(1.6, this.reconnectAttempts));
    this.reconnectAttempts++;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, delay);
  }

  private initSupabaseRealtimeBridge(): void {
    if (!isSupabaseConfigured) return;
    try {
      supabase
        .channel('simpel-global-db-sync')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          window.dispatchEvent(
            new CustomEvent('simpel:remote-sync', {
              detail: { keys: ['*'], table: payload.table },
            })
          );
        })
        .subscribe();
    } catch (err) {
      console.warn('[Sync] Supabase Realtime bridge skipped:', err);
    }
  }

  public bootstrap(): Promise<void> {
    if (this.bootstrapPromise) return this.bootstrapPromise;

    this.bootstrapPromise = (async () => {
      if (typeof window === 'undefined') return;

      // 1. Pull authoritative server state first (bounded timeout 2.5s so offline never hangs UI)
      await this.pullFromServer(0);

      // 2. Snapshot synced baseline & install transparent localStorage interceptor
      this.snapshotLocalValues();
      this.installStorageInterceptor();

      // 3. Establish WebSocket + SSE fallback + browser lifecycle hooks
      this.connectWebSocket();
      this.setupSSEFallback();
      this.initSupabaseRealtimeBridge();

      window.addEventListener('online', () => {
        this.status = 'reconnecting';
        this.emitStatus();
        void this.flushMutations();
        this.connectWebSocket();
        void this.pullFromServer(this.lastRevision);
      });

      window.addEventListener('offline', () => {
        this.status = 'offline';
        this.emitStatus();
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.connectWebSocket();
          }
          void this.pullFromServer(this.lastRevision);
        }
      });

      window.addEventListener('pagehide', () => this.flushBeaconOnUnload());
      window.addEventListener('beforeunload', () => this.flushBeaconOnUnload());

      this.isBootstrapped = true;
    })();

    return this.bootstrapPromise;
  }

  public async syncNow(): Promise<void> {
    this.status = 'syncing';
    this.emitStatus();
    await this.flushMutations();
    await this.pullFromServer(0);
    window.dispatchEvent(new CustomEvent('simpel:remote-sync', { detail: { keys: ['*'], manual: true } }));
    window.dispatchEvent(new CustomEvent('simpel:remote-file-sync', { detail: { manual: true } }));
    this.status = this.ws?.readyState === WebSocket.OPEN ? 'connected' : 'reconnecting';
    this.emitStatus();
  }

  public notifyFileSyncChanged(): void {
    try {
      this.broadcastChannel?.postMessage({
        type: 'tab:file-sync',
        sourceClientId: this.clientId,
      });
    } catch {
      // ignore
    }
  }

  public getClientId(): string {
    return this.clientId;
  }

  public getStatusSnapshot(): SyncStatusSnapshot {
    return {
      status: this.status,
      revision: this.lastRevision,
      activeDevices: this.activeDevices,
      lastSyncedAt: this.lastSyncedAt,
      pendingCount: this.pendingMutations.size,
    };
  }

  private emitStatus(): void {
    const snap = this.getStatusSnapshot();
    this.statusListeners.forEach((cb) => {
      try {
        cb(snap);
      } catch {
        // ignore
      }
    });
  }

  public subscribeStatus(cb: (snap: SyncStatusSnapshot) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.getStatusSnapshot());
    return () => {
      this.statusListeners.delete(cb);
    };
  }
}

export const syncService = new RealtimeSyncService();
