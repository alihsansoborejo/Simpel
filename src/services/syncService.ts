/**
 * Real-Time Cross-Device Synchronization Service (SIMPEL MI AL IHSAN)
 *
 * Arsitektur Sinkronisasi:
 * 1. Server-Authoritative State via WebSocket (/ws/sync) dengan ACK verification,
 *    HTTP Batch (/api/sync/batch) untuk payload besar / fallback,
 *    Server-Sent Events (/api/sync/stream), dan adaptive delta check (/api/sync/state?since=...).
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
const nativeGetItem = Storage.prototype.getItem;
const nativeRemoveItem = Storage.prototype.removeItem;

// Batas aman payload WebSocket agar tidak diputus reverse proxy (128 KB)
const WS_MAX_FRAME_BYTES = 128 * 1024;

class RealtimeSyncService {
  private clientId = getOrCreateClientId();
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private isApplyingRemote = false;
  private bootstrapPromise: Promise<void> | null = null;
  private isPulling = false;

  private lastRevision = 0;
  private activeDevices = 1;
  private lastSyncedAt: string | null = null;
  private status: SyncConnectionStatus = 'reconnecting';

  private pendingMutations = new Map<string, { value: string | null; updatedAt: string }>();
  private unackedWsBatches = new Map<
    string,
    { batch: Array<{ key: string; value: string | null; updatedAt: string }>; timer: number }
  >();
  private inMemoryFallback = new Map<string, string>();
  private flushTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private heartbeatTimer: number | null = null;
  private deltaPollTimer: number | null = null;
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
          this.lastKnownValues.set(key, nativeGetItem.call(window.localStorage, key));
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

    Storage.prototype.getItem = function (key: string): string | null {
      const val = nativeGetItem.call(this, key);
      if (val === null && this === window.localStorage && self.inMemoryFallback.has(key)) {
        return self.inMemoryFallback.get(key) ?? null;
      }
      return val;
    };

    Storage.prototype.setItem = function (key: string, value: string) {
      const strVal = String(value);
      let wroteToStorage = false;
      try {
        nativeSetItem.call(this, key, strVal);
        wroteToStorage = true;
        if (this === window.localStorage) {
          self.inMemoryFallback.delete(key);
        }
      } catch (err) {
        // QuotaExceededError fallback: tetap simpan di memori & sinkronkan ke server!
        if (this === window.localStorage) {
          self.inMemoryFallback.set(key, strVal);
        }
        console.warn(`[Sync] localStorage quota warning for ${key}, tetap menyinkronkan ke server:`, err);
      }

      if (this === window.localStorage && !self.isApplyingRemote && isSyncedKey(key)) {
        const prevVal = self.lastKnownValues.get(key);
        if (wroteToStorage && prevVal === strVal) return;
        self.lastKnownValues.set(key, strVal);
        self.enqueueMutation(key, strVal);
      }
    };

    Storage.prototype.removeItem = function (key: string) {
      nativeRemoveItem.call(this, key);
      if (this === window.localStorage) {
        self.inMemoryFallback.delete(key);
      }
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

  private async sendBatchViaHttp(
    batch: Array<{ key: string; value: string | null; updatedAt: string }>
  ): Promise<void> {
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
      this.status = 'connected';
      this.emitStatus();
    } catch (err) {
      // Re-queue failed batch for retry
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

  public async flushMutations(): Promise<void> {
    if (this.pendingMutations.size === 0) return;

    const batch: Array<{ key: string; value: string | null; updatedAt: string }> = [];
    this.pendingMutations.forEach((entry, key) => {
      batch.push({ key, value: entry.value, updatedAt: entry.updatedAt });
    });
    this.pendingMutations.clear();
    this.status = 'syncing';
    this.emitStatus();

    const batchId = `b-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const wsPayload = JSON.stringify({
      type: 'sync:patch',
      batchId,
      clientId: this.clientId,
      mutations: batch,
    });

    // Untuk payload <= 128 KB gunakan WebSocket + ACK watchdog; payload besar langsung HTTP POST agar bebas limit frame proxy
    if (this.ws && this.ws.readyState === WebSocket.OPEN && wsPayload.length <= WS_MAX_FRAME_BYTES) {
      try {
        const timer = window.setTimeout(() => {
          const pending = this.unackedWsBatches.get(batchId);
          if (pending) {
            this.unackedWsBatches.delete(batchId);
            void this.sendBatchViaHttp(pending.batch);
          }
        }, 1500);

        this.unackedWsBatches.set(batchId, { batch, timer });
        this.ws.send(wsPayload);
        return;
      } catch (err) {
        const pending = this.unackedWsBatches.get(batchId);
        if (pending) {
          window.clearTimeout(pending.timer);
          this.unackedWsBatches.delete(batchId);
        }
        console.warn('[Sync] WebSocket send failed, using HTTP batch:', err);
      }
    }

    await this.sendBatchViaHttp(batch);
  }

  private flushBeaconOnUnload(): void {
    if (this.pendingMutations.size === 0) return;
    const batch: Array<{ key: string; value: string | null; updatedAt: string }> = [];
    this.pendingMutations.forEach((entry, key) => {
      batch.push({ key, value: entry.value, updatedAt: entry.updatedAt });
    });
    const payload = JSON.stringify({ clientId: this.clientId, mutations: batch });
    try {
      if (navigator.sendBeacon && payload.length < 60 * 1024) {
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
        const currentLocal = nativeGetItem.call(window.localStorage, key) ?? this.inMemoryFallback.get(key) ?? null;

        if (remoteValue === null) {
          if (currentLocal !== null) {
            nativeRemoveItem.call(window.localStorage, key);
            this.inMemoryFallback.delete(key);
            this.lastKnownValues.set(key, null);
            changedKeys.push(key);
          }
        } else if (currentLocal !== remoteValue) {
          try {
            nativeSetItem.call(window.localStorage, key, remoteValue);
            this.inMemoryFallback.delete(key);
          } catch {
            // Fallback ke memory jika kuota browser penuh oleh aset lama
            this.inMemoryFallback.set(key, remoteValue);
          }
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
    if (this.isPulling) return;
    this.isPulling = true;

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      const url = sinceRevision > 0 ? `/api/sync/state?since=${sinceRevision}&_t=${Date.now()}` : `/api/sync/state?_t=${Date.now()}`;
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
        await this.seedServerWithInitialLocalState();
      }

      this.lastSyncedAt = new Date().toISOString();
      if (this.ws?.readyState === WebSocket.OPEN || navigator.onLine) {
        this.status = 'connected';
      }
      this.emitStatus();
    } catch (err) {
      console.warn('[Sync] Pull skipped/retried:', err);
    } finally {
      this.isPulling = false;
    }
  }

  private async seedServerWithInitialLocalState(): Promise<void> {
    const mutations: Array<{ key: string; value: string; updatedAt: string }> = [];
    const now = new Date().toISOString();
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && isSyncedKey(key)) {
          const val = nativeGetItem.call(window.localStorage, key);
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

        if (this.pendingMutations.size > 0) {
          void this.flushMutations();
        } else if (this.lastRevision > 0) {
          ws.send(JSON.stringify({ type: 'sync:pull', since: this.lastRevision }));
        }

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
            if (msg.batchId && this.unackedWsBatches.has(msg.batchId)) {
              const pending = this.unackedWsBatches.get(msg.batchId)!;
              window.clearTimeout(pending.timer);
              this.unackedWsBatches.delete(msg.batchId);
            }
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
        // Handled cleanly in onclose
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
          if (this.ws?.readyState === WebSocket.OPEN) return;
          if (msg.type === 'sync:delta' && msg.sourceClientId !== this.clientId) {
            this.applyRemoteEntries(msg.entries || {}, msg.revision);
          } else if (
            (msg.type === 'sync:file:upsert' || msg.type === 'sync:file:delete') &&
            msg.sourceClientId !== this.clientId
          ) {
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

  private startAdaptiveDeltaCheck(): void {
    if (this.deltaPollTimer !== null) return;

    const tick = async () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        if (this.pendingMutations.size > 0) {
          await this.flushMutations();
        }
        await this.pullFromServer(this.lastRevision);
      }
      const nextInterval = this.ws?.readyState === WebSocket.OPEN ? 5000 : 2500;
      this.deltaPollTimer = window.setTimeout(() => {
        void tick();
      }, nextInterval);
    };

    this.deltaPollTimer = window.setTimeout(() => {
      void tick();
    }, 3000);
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

      // 1. Pull authoritative server state first (does not abort prematurely on large payloads)
      await this.pullFromServer(0);

      // 2. Snapshot synced baseline & install transparent localStorage interceptor
      this.snapshotLocalValues();
      this.installStorageInterceptor();

      // 3. Establish WebSocket + SSE fallback + adaptive delta check + lifecycle hooks
      this.connectWebSocket();
      this.setupSSEFallback();
      this.startAdaptiveDeltaCheck();
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
    this.status = this.ws?.readyState === WebSocket.OPEN || navigator.onLine ? 'connected' : 'reconnecting';
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
