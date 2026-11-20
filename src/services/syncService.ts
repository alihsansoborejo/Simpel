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

import {
  isSupabaseConfigured,
  isSupabaseAvailable,
  reportSupabaseOutcome,
  resetSupabaseCircuitBreaker,
  subscribeSupabaseHealth,
  getSupabaseHealth,
  SupabaseHealthStatus,
  supabase,
} from '../lib/supabaseClient';

export type SyncConnectionStatus = 'connected' | 'syncing' | 'reconnecting' | 'offline';

export interface SyncStatusSnapshot {
  status: SyncConnectionStatus;
  revision: number;
  activeDevices: number;
  lastSyncedAt: string | null;
  pendingCount: number;
  supabaseStatus: SupabaseHealthStatus;
  supabaseError: string | null;
  localServerAvailable: boolean;
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
  private keyUpdatedAt = new Map<string, string>();
  private flushTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private wsConsecutiveFailures = 0;
  private readonly maxWsFailures = 3;
  private httpConnected = false;
  private heartbeatTimer: number | null = null;
  private deltaPollTimer: number | null = null;
  private lastKnownValues = new Map<string, string | null>();
  private cloudPullInFlight = false;
  private deferredKeysInFlight = new Set<string>();
  private cloudConnected = false;
  private localBackendUnsupported = false;

  private supabaseStatus: SupabaseHealthStatus = getSupabaseHealth().status;
  private supabaseError: string | null = getSupabaseHealth().message;
  private statusListeners = new Set<(snap: SyncStatusSnapshot) => void>();

  constructor() {
    this.setupBroadcastChannel();
    subscribeSupabaseHealth((snap) => {
      const changed =
        this.supabaseStatus !== snap.status || this.supabaseError !== snap.message;
      this.supabaseStatus = snap.status;
      this.supabaseError = snap.message;
      if (changed) {
        this.emitStatus();
      }
    });
  }

  private isMaskedPassword(pw: unknown): boolean {
    if (typeof pw !== 'string') return true;
    const trimmed = pw.trim();
    return !trimmed || trimmed === '__CLOUD_VERIFIED__' || trimmed === '••••••••';
  }

  private sanitizeUsersJsonForCloud(rawJson: string): string {
    try {
      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) return rawJson;
      const sanitized = parsed.map((u: any) => {
        if (!u || typeof u !== 'object') return u;
        return {
          ...u,
          password: '__CLOUD_VERIFIED__',
        };
      });
      return JSON.stringify(sanitized);
    } catch {
      return rawJson;
    }
  }

  private mergeCloudUsersJsonWithLocal(cloudJson: string): string {
    try {
      const remoteUsers = JSON.parse(cloudJson);
      if (!Array.isArray(remoteUsers)) return cloudJson;

      const localRaw =
        nativeGetItem.call(window.localStorage, 'simpel_users_cache_v2') ??
        this.inMemoryFallback.get('simpel_users_cache_v2');
      const localMapByEmail = new Map<string, any>();
      const localMapById = new Map<string, any>();
      if (localRaw) {
        try {
          const parsedLocal = JSON.parse(localRaw);
          if (Array.isArray(parsedLocal)) {
            for (const lu of parsedLocal) {
              if (!lu || typeof lu !== 'object') continue;
              if (lu.id) localMapById.set(String(lu.id), lu);
              if (lu.email) localMapByEmail.set(String(lu.email).trim().toLowerCase(), lu);
            }
          }
        } catch {
          // ignore
        }
      }

      const merged = remoteUsers.map((ru: any) => {
        if (!ru || typeof ru !== 'object') return ru;
        const email = String(ru.email || '').trim().toLowerCase();
        const existingLocal =
          (ru.id ? localMapById.get(String(ru.id)) : undefined) ||
          (email ? localMapByEmail.get(email) : undefined);
        const hasRealLocalPassword = existingLocal && !this.isMaskedPassword(existingLocal.password);
        const isPlaceholderRemote = this.isMaskedPassword(ru.password);

        if (isPlaceholderRemote && hasRealLocalPassword) {
          return { ...ru, password: existingLocal.password };
        }
        return ru;
      });

      return JSON.stringify(merged);
    } catch {
      return cloudJson;
    }
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
      const shouldKeepMemoryOnly =
        this === window.localStorage && isSyncedKey(key) && strVal.length > 500_000;

      if (shouldKeepMemoryOnly) {
        self.inMemoryFallback.set(key, strVal);
        try {
          nativeRemoveItem.call(window.localStorage, key);
        } catch {
          // ignore
        }
      } else {
        try {
          nativeSetItem.call(this, key, strVal);
          wroteToStorage = true;
          if (this === window.localStorage) {
            self.inMemoryFallback.delete(key);
          }
        } catch (err) {
          // Jika auth token / non-synced key gagal karena quota penuh oleh cache simpel_*, bebaskan ruang lalu coba ulang
          if (this === window.localStorage && !isSyncedKey(key)) {
            let freed = false;
            for (let i = window.localStorage.length - 1; i >= 0; i--) {
              const existingKey = window.localStorage.key(i);
              if (existingKey && isSyncedKey(existingKey)) {
                const existingVal = nativeGetItem.call(window.localStorage, existingKey);
                if (existingVal && existingVal.length > 50_000) {
                  self.inMemoryFallback.set(existingKey, existingVal);
                  nativeRemoveItem.call(window.localStorage, existingKey);
                  freed = true;
                }
              }
            }
            if (freed) {
              try {
                nativeSetItem.call(this, key, strVal);
                wroteToStorage = true;
                self.inMemoryFallback.delete(key);
              } catch {
                self.inMemoryFallback.set(key, strVal);
              }
            } else {
              self.inMemoryFallback.set(key, strVal);
            }
          } else if (this === window.localStorage) {
            self.inMemoryFallback.set(key, strVal);
          }
          if (!wroteToStorage) {
            console.warn(`[Sync] localStorage quota warning for ${key}, menggunakan fallback memori:`, err);
          }
        }
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
    this.keyUpdatedAt.set(key, updatedAt);
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
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
          this.localBackendUnsupported = true;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      this.localBackendUnsupported = false;
      if (typeof json.revision === 'number') {
        this.lastRevision = Math.max(this.lastRevision, json.revision);
      }
      this.httpConnected = true;
      this.lastSyncedAt = new Date().toISOString();
      this.updateConnectionStatus();
    } catch (err) {
      this.httpConnected = false;
      // Re-queue failed batch for retry
      batch.forEach((m) => {
        if (!this.pendingMutations.has(m.key)) {
          this.pendingMutations.set(m.key, { value: m.value, updatedAt: m.updatedAt });
        }
      });
      this.updateConnectionStatus();
      console.warn('[Sync] Batch deferred for retry:', err);
    }
  }

  private async pushMutationsToSupabaseCloud(
    batch: Array<{ key: string; value: string | null; updatedAt: string }>
  ): Promise<void> {
    if (!isSupabaseAvailable() || batch.length === 0) return;

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        reportSupabaseOutcome(sessionErr);
      }
      const hasAuthUser = Boolean(sessionData?.session?.user);

      // 1. Jika simpel_users_cache_v2 ikut berubah saat sesi Auth aktif, sinkronkan hash kredensial login via RPC admin
      const usersMut = batch.find((m) => m.key === 'simpel_users_cache_v2' && m.value);
      if (hasAuthUser && usersMut?.value) {
        try {
          const parsedUsers = JSON.parse(usersMut.value);
          if (Array.isArray(parsedUsers)) {
            const { error: rpcErr } = await supabase.rpc('sync_app_user_credentials', {
              p_users: parsedUsers,
              p_prune: true,
            });
            if (rpcErr) reportSupabaseOutcome(rpcErr);
          }
        } catch {
          // RPC mungkin belum dibuat di Supabase SQL Editor; abaikan dengan aman
        }
      }

      // 2. Siapkan payload app_sync_state. Key sensitif hanya ditulis oleh sesi Admin terautentikasi;
      //    key operasional guru/wali kelas (nilai, asesmen, leger, perangkat kelas, jurnal, absensi) tetap disinkronkan.
      const smallRows: Array<{ key: string; value: string | null; revision: number; updated_at: string }> = [];
      const largeRows: Array<{ key: string; value: string | null; revision: number; updated_at: string }> = [];

      for (const mut of batch) {
        if (!hasAuthUser && (mut.key === 'simpel_users_cache_v2' || mut.key === 'simpel_settings')) {
          continue;
        }
        let safeValue = mut.value;
        if (mut.key === 'simpel_users_cache_v2' && safeValue) {
          safeValue = this.sanitizeUsersJsonForCloud(safeValue);
        }
        const row = {
          key: mut.key,
          value: safeValue,
          revision: Math.max(1, this.lastRevision),
          updated_at: mut.updatedAt || new Date().toISOString(),
        };
        if (safeValue && safeValue.length > 250_000) {
          largeRows.push(row);
        } else {
          smallRows.push(row);
        }
      }

      if (smallRows.length > 0) {
        const { error: smallErr } = await supabase.from('app_sync_state').upsert(smallRows, { onConflict: 'key' });
        reportSupabaseOutcome(smallErr);
        if (!smallErr) {
          this.cloudConnected = true;
          this.lastSyncedAt = new Date().toISOString();
          this.updateConnectionStatus();
        } else if (smallRows.length > 1 && isSupabaseAvailable()) {
          // Jika satu key ditolak RLS, coba upsert per baris agar key nilai/perangkat kelas tidak ikut terblokir
          for (const row of smallRows) {
            if (!isSupabaseAvailable()) break;
            const { error: singleErr } = await supabase.from('app_sync_state').upsert(row, { onConflict: 'key' });
            reportSupabaseOutcome(singleErr);
            if (!singleErr) {
              this.cloudConnected = true;
              this.lastSyncedAt = new Date().toISOString();
              this.updateConnectionStatus();
            }
          }
        }
        if (smallErr && !isSupabaseAvailable()) return;
      }
      for (const lr of largeRows) {
        const { error: lrErr } = await supabase.from('app_sync_state').upsert(lr, { onConflict: 'key' });
        reportSupabaseOutcome(lrErr);
        if (!lrErr) {
          this.cloudConnected = true;
          this.lastSyncedAt = new Date().toISOString();
          this.updateConnectionStatus();
        }
        if (lrErr && !isSupabaseAvailable()) return;
      }
    } catch (err) {
      reportSupabaseOutcome(err);
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

    // Jalankan backup cloud non-blocking agar tidak menghambat real-time lokal
    void this.pushMutationsToSupabaseCloud(batch);

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

        if (entry?.updatedAt) {
          this.keyUpdatedAt.set(key, entry.updatedAt);
        }

        let remoteValue = entry?.value ?? null;
        if (key === 'simpel_users_cache_v2' && remoteValue) {
          remoteValue = this.mergeCloudUsersJsonWithLocal(remoteValue);
        }

        const currentLocal = nativeGetItem.call(window.localStorage, key) ?? this.inMemoryFallback.get(key) ?? null;

        if (remoteValue === null) {
          if (currentLocal !== null) {
            nativeRemoveItem.call(window.localStorage, key);
            this.inMemoryFallback.delete(key);
            this.lastKnownValues.set(key, null);
            changedKeys.push(key);
          }
        } else if (currentLocal !== remoteValue) {
          if (remoteValue.length > 500_000) {
            this.inMemoryFallback.set(key, remoteValue);
            try {
              nativeRemoveItem.call(window.localStorage, key);
            } catch {
              // ignore
            }
          } else {
            try {
              nativeSetItem.call(window.localStorage, key, remoteValue);
              this.inMemoryFallback.delete(key);
            } catch {
              // Fallback ke memory jika kuota browser penuh oleh aset lama
              this.inMemoryFallback.set(key, remoteValue);
            }
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

  public runWithoutMutationTracking(fn: () => void): void {
    const prev = this.isApplyingRemote;
    this.isApplyingRemote = true;
    try {
      fn();
      this.snapshotLocalValues();
    } finally {
      this.isApplyingRemote = prev;
    }
  }

  public setLocalCacheSilently(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    const prev = this.isApplyingRemote;
    this.isApplyingRemote = true;
    try {
      const strVal = String(value);
      if (isSyncedKey(key) && strVal.length > 500_000) {
        this.inMemoryFallback.set(key, strVal);
        try {
          nativeRemoveItem.call(window.localStorage, key);
        } catch {
          // ignore
        }
      } else {
        try {
          nativeSetItem.call(window.localStorage, key, strVal);
          this.inMemoryFallback.delete(key);
        } catch {
          this.inMemoryFallback.set(key, strVal);
        }
      }
      if (isSyncedKey(key)) {
        this.lastKnownValues.set(key, strVal);
      }
    } finally {
      this.isApplyingRemote = prev;
    }
  }

  private async pullDeferredKeys(keys: string[]): Promise<void> {
    if (!Array.isArray(keys) || keys.length === 0) return;

    for (const key of keys) {
      if (!isSyncedKey(key) || this.deferredKeysInFlight.has(key)) continue;
      this.deferredKeysInFlight.add(key);
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 30000);
        const res = await fetch(`/api/sync/key/${encodeURIComponent(key)}?_t=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        window.clearTimeout(timeout);
        if (!res.ok) continue;
        const json = await res.json();
        if (json?.entry) {
          this.applyRemoteEntries({ [key]: json.entry }, json.revision);
        }
      } catch (err) {
        console.warn(`[Sync] Deferred key ${key} fetch retried later:`, err);
      } finally {
        this.deferredKeysInFlight.delete(key);
      }
    }
  }

  public async pullFromSupabaseCloud(options?: { fastOnly?: boolean; hydrateLocalServer?: boolean; force?: boolean }): Promise<boolean> {
    if (options?.force) {
      resetSupabaseCircuitBreaker();
    }
    if (!isSupabaseAvailable() || this.cloudPullInFlight) return false;
    this.cloudPullInFlight = true;

    try {
      // Tahap 1: Cek metadata ringan saja (key, revision, updated_at) agar hemat kuota egres Supabase
      const { data: metaRows, error: metaErr } = await supabase
        .from('app_sync_state')
        .select('key, revision, updated_at');

      reportSupabaseOutcome(metaErr);
      if (metaErr) {
        this.cloudConnected = false;
        this.updateConnectionStatus();
        return false;
      }
      this.cloudConnected = true;
      this.lastSyncedAt = this.lastSyncedAt || new Date().toISOString();
      this.updateConnectionStatus();
      if (!Array.isArray(metaRows) || metaRows.length === 0) {
        return false;
      }

      const keysToFetch: string[] = [];
      let shouldFetchSettingsInBg = false;

      for (const meta of metaRows as Array<{ key: string; revision: number; updated_at: string }>) {
        if (!isSyncedKey(meta.key)) continue;
        const localCurrent =
          nativeGetItem.call(window.localStorage, meta.key) ?? this.inMemoryFallback.get(meta.key) ?? null;
        const localUpdatedAt = this.keyUpdatedAt.get(meta.key);
        const hasLocalOrServerCopy = localCurrent !== null || this.keyUpdatedAt.has(meta.key);
        const isCloudNewer = Boolean(
          meta.updated_at && (!localUpdatedAt || Date.parse(meta.updated_at) > Date.parse(localUpdatedAt))
        );

        if (!hasLocalOrServerCopy || isCloudNewer) {
          if (options?.fastOnly && meta.key === 'simpel_settings') {
            shouldFetchSettingsInBg = true;
          } else {
            keysToFetch.push(meta.key);
          }
        }
      }

      let keysCount = 0;

      // Tahap 2: Hanya unduh kolom value untuk key yang benar-benar baru / berubah
      if (keysToFetch.length > 0) {
        const { data, error } = await supabase
          .from('app_sync_state')
          .select('key, value, revision, updated_at')
          .in('key', keysToFetch);

        reportSupabaseOutcome(error);
        if (!error && Array.isArray(data) && data.length > 0) {
          const entriesToApply: Record<string, { value: string | null; updatedAt?: string; revision?: number }> = {};
          const mutationsForLocalServer: Array<{ key: string; value: string | null; updatedAt: string }> = [];

          for (const row of data as Array<{ key: string; value: string | null; revision: number; updated_at: string }>) {
            if (!isSyncedKey(row.key)) continue;
            const localCurrent =
              nativeGetItem.call(window.localStorage, row.key) ?? this.inMemoryFallback.get(row.key) ?? null;
            const localUpdatedAt = this.keyUpdatedAt.get(row.key);
            const isLocalEmptyPlaceholder = localCurrent === null || localCurrent === '[]' || localCurrent === '{}';
            const isRemoteNonEmpty = Boolean(row.value && row.value !== '[]' && row.value !== '{}');

            let shouldApply = false;
            if (localCurrent === null) {
              shouldApply = true;
            } else if (isLocalEmptyPlaceholder && isRemoteNonEmpty && !localUpdatedAt) {
              shouldApply = true;
            } else if (row.key === 'simpel_users_cache_v2') {
              try {
                const localUsers = JSON.parse(localCurrent);
                const cloudUsers = row.value ? JSON.parse(row.value) : [];
                if (Array.isArray(cloudUsers) && cloudUsers.length > (Array.isArray(localUsers) ? localUsers.length : 0)) {
                  shouldApply = true;
                }
              } catch {
                // ignore
              }
            }

            if (!shouldApply && row.updated_at && (!localUpdatedAt || Date.parse(row.updated_at) > Date.parse(localUpdatedAt))) {
              shouldApply = true;
            }

            if (shouldApply) {
              entriesToApply[row.key] = {
                value: row.value,
                updatedAt: row.updated_at,
                revision: row.revision,
              };
              if (options?.hydrateLocalServer && row.value !== null) {
                const hydratedValue =
                  row.key === 'simpel_users_cache_v2' ? this.mergeCloudUsersJsonWithLocal(row.value) : row.value;
                // Jangan timpa cache server lokal jika hasil merge identik dengan lokal
                if (!(row.key === 'simpel_users_cache_v2' && localCurrent && hydratedValue === localCurrent)) {
                  mutationsForLocalServer.push({
                    key: row.key,
                    value: hydratedValue,
                    updatedAt: row.updated_at || new Date().toISOString(),
                  });
                }
              }
            }
          }

          keysCount = Object.keys(entriesToApply).length;
          if (keysCount > 0) {
            this.applyRemoteEntries(entriesToApply);
            if (mutationsForLocalServer.length > 0) {
              void this.sendBatchViaHttp(mutationsForLocalServer);
            }
          }
        }
      }

      if (options?.fastOnly && shouldFetchSettingsInBg && isSupabaseAvailable()) {
        // Tarik simpel_settings (logo besar) secara latar belakang hanya bila benar-benar belum ada/lebih baru
        void supabase
          .from('app_sync_state')
          .select('key, value, revision, updated_at')
          .eq('key', 'simpel_settings')
          .maybeSingle()
          .then(({ data: settingsRow, error: settingsErr }) => {
            reportSupabaseOutcome(settingsErr);
            if (!settingsErr && settingsRow && (settingsRow as any).value) {
              const sr = settingsRow as { key: string; value: string; revision: number; updated_at: string };
              const localTs = this.keyUpdatedAt.get('simpel_settings');
              const hasLocal =
                nativeGetItem.call(window.localStorage, 'simpel_settings') ??
                this.inMemoryFallback.get('simpel_settings');
              if (!hasLocal || !localTs || Date.parse(sr.updated_at) > Date.parse(localTs)) {
                this.applyRemoteEntries({
                  simpel_settings: {
                    value: sr.value,
                    updatedAt: sr.updated_at,
                    revision: sr.revision,
                  },
                });
                if (options?.hydrateLocalServer) {
                  void this.sendBatchViaHttp([
                    {
                      key: 'simpel_settings',
                      value: sr.value,
                      updatedAt: sr.updated_at || new Date().toISOString(),
                    },
                  ]);
                }
              }
            }
          });
      }

      return keysCount > 0;
    } catch (err) {
      reportSupabaseOutcome(err);
      return false;
    } finally {
      this.cloudPullInFlight = false;
    }
  }

  public async syncAllLocalToCloud(): Promise<void> {
    if (!isSupabaseAvailable() || typeof window === 'undefined') return;
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        reportSupabaseOutcome(sessionErr);
      }
      const hasAuthUser = Boolean(sessionData?.session?.user);

      const collected = new Map<string, string>();
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && isSyncedKey(key)) {
          const val = nativeGetItem.call(window.localStorage, key);
          if (val !== null) collected.set(key, val);
        }
      }
      this.inMemoryFallback.forEach((val, key) => {
        if (isSyncedKey(key) && val !== null) {
          collected.set(key, val);
        }
      });

      const batch: Array<{ key: string; value: string | null; updatedAt: string }> = [];
      const now = new Date().toISOString();
      collected.forEach((val, key) => {
        // Jangan pernah menimpa cloud dengan array/objek kosong hasil inisialisasi perangkat baru
        if (val === '[]' || val === '{}') return;
        if (!hasAuthUser && (key === 'simpel_users_cache_v2' || key === 'simpel_settings')) return;
        batch.push({
          key,
          value: val,
          updatedAt: this.keyUpdatedAt.get(key) || now,
        });
      });

      if (batch.length > 0) {
        await this.pushMutationsToSupabaseCloud(batch);
      }
    } catch (err) {
      reportSupabaseOutcome(err);
    }
  }

  public async pullFromServer(sinceRevision = 0, options?: { priorityFast?: boolean }): Promise<void> {
    if (this.isPulling) return;
    this.isPulling = true;

    const useFast = options?.priorityFast ?? (sinceRevision === 0);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), useFast ? 6000 : 12000);
      const params = new URLSearchParams();
      if (sinceRevision > 0) params.set('since', String(sinceRevision));
      if (useFast) params.set('priority', 'fast');
      params.set('_t', String(Date.now()));

      const res = await fetch(`/api/sync/state?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      window.clearTimeout(timeout);

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        if (res.status === 404 || res.status === 405 || !contentType.includes('application/json')) {
          this.localBackendUnsupported = true;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      this.localBackendUnsupported = false;
      const data = await res.json();

      if (typeof data.activeClients === 'number') {
        this.activeDevices = data.activeClients;
      }

      const serverEntries = data.entries || {};
      const deferredKeys: string[] = Array.isArray(data.deferredKeys) ? data.deferredKeys : [];
      const deferredMeta: Record<string, { updatedAt: string; revision: number }> =
        data.deferredMeta && typeof data.deferredMeta === 'object' ? data.deferredMeta : {};
      const serverRevision = typeof data.revision === 'number' ? data.revision : 0;

      // Catat timestamp key besar yang ditunda agar cek metadata cloud tidak menarik ulang data yang sama
      for (const dKey of deferredKeys) {
        const meta = deferredMeta[dKey];
        if (meta?.updatedAt && !this.keyUpdatedAt.has(dKey)) {
          this.keyUpdatedAt.set(dKey, meta.updatedAt);
        }
      }

      if (serverRevision > 0 || Object.keys(serverEntries).length > 0 || deferredKeys.length > 0) {
        if (Object.keys(serverEntries).length > 0) {
          this.applyRemoteEntries(serverEntries, serverRevision);
        } else if (serverRevision > this.lastRevision) {
          this.lastRevision = serverRevision;
        }

        if (deferredKeys.length > 0) {
          void this.pullDeferredKeys(deferredKeys);
        }

        // Pada startup awal, cek metadata cloud (ringan) bila Supabase tersedia
        if (sinceRevision === 0 && isSupabaseAvailable()) {
          void this.pullFromSupabaseCloud({ fastOnly: true, hydrateLocalServer: true });
        }
      } else if (sinceRevision === 0) {
        // Server baru kosong (revision === 0): prioritaskan tarik dari Supabase cloud dulu sebelum seed lokal
        const restoredFromCloud = isSupabaseAvailable()
          ? await this.pullFromSupabaseCloud({ fastOnly: true, hydrateLocalServer: true })
          : false;

        if (!restoredFromCloud) {
          await this.seedServerWithInitialLocalState();
        }
      }

      this.httpConnected = true;
      this.lastSyncedAt = new Date().toISOString();
      this.updateConnectionStatus();
    } catch (err) {
      this.httpConnected = false;
      // Fallback ke Supabase cloud jika endpoint Express sedang lambat / restart
      if (sinceRevision === 0 && isSupabaseAvailable()) {
        await this.pullFromSupabaseCloud({ fastOnly: true });
      }
      this.updateConnectionStatus();
      console.warn('[Sync] Pull skipped/retried:', err);
    } finally {
      this.isPulling = false;
    }
  }

  private hasMeaningfulLocalDataForSeeding(): boolean {
    try {
      const usersRaw = nativeGetItem.call(window.localStorage, 'simpel_users_cache_v2');
      if (usersRaw) {
        const users = JSON.parse(usersRaw);
        if (Array.isArray(users) && users.length > 1) return true;
      }
      const teachersRaw = nativeGetItem.call(window.localStorage, 'simpel_teachers');
      if (teachersRaw) {
        const teachers = JSON.parse(teachersRaw);
        if (Array.isArray(teachers) && teachers.length > 0) return true;
      }
      const studentsRaw = nativeGetItem.call(window.localStorage, 'simpel_students');
      if (studentsRaw) {
        const students = JSON.parse(studentsRaw);
        if (Array.isArray(students) && students.length > 0) return true;
      }
      const settingsRaw =
        nativeGetItem.call(window.localStorage, 'simpel_settings') ??
        this.inMemoryFallback.get('simpel_settings');
      if (settingsRaw && settingsRaw.includes('data:image/')) return true;
    } catch {
      return false;
    }
    return false;
  }

  private async seedServerWithInitialLocalState(): Promise<void> {
    if (!this.hasMeaningfulLocalDataForSeeding()) {
      return;
    }
    const mutations: Array<{ key: string; value: string; updatedAt: string }> = [];
    const now = new Date().toISOString();
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && isSyncedKey(key)) {
          const val = nativeGetItem.call(window.localStorage, key);
          if (val !== null && val !== '[]' && val !== '{}') {
            mutations.push({ key, value: val, updatedAt: now });
          }
        }
      }
      this.inMemoryFallback.forEach((val, key) => {
        if (isSyncedKey(key) && val !== null && val !== '[]' && val !== '{}') {
          mutations.push({ key, value: val, updatedAt: now });
        }
      });
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
        this.wsConsecutiveFailures = 0;
        this.httpConnected = true;
        this.updateConnectionStatus();

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
            if (Array.isArray(msg.deferredKeys) && msg.deferredKeys.length > 0) {
              void this.pullDeferredKeys(msg.deferredKeys);
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
        this.wsConsecutiveFailures++;
        this.updateConnectionStatus();
        if (this.wsConsecutiveFailures < this.maxWsFailures) {
          this.scheduleReconnect();
        }
      };

      ws.onerror = () => {
        // Handled cleanly in onclose
      };
    } catch {
      this.wsConsecutiveFailures++;
      if (this.wsConsecutiveFailures < this.maxWsFailures) {
        this.scheduleReconnect();
      }
    }
  }

  private updateConnectionStatus(): void {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.status = 'offline';
    } else if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.httpConnected ||
      (isSupabaseAvailable() && this.cloudConnected) ||
      (this.localBackendUnsupported && !isSupabaseAvailable())
    ) {
      this.status = 'connected';
    } else {
      this.status = 'reconnecting';
    }
    this.emitStatus();
  }

  private setupSSEFallback(): void {
    if (typeof EventSource === 'undefined' || this.sse || this.localBackendUnsupported) return;
    try {
      const sse = new EventSource(`/api/sync/stream?clientId=${encodeURIComponent(this.clientId)}`);
      this.sse = sse;
      sse.onopen = () => {
        this.localBackendUnsupported = false;
        this.httpConnected = true;
        this.updateConnectionStatus();
      };
      sse.onerror = () => {
        if (this.localBackendUnsupported) {
          sse.close();
          this.sse = null;
        }
      };
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
        if (!this.localBackendUnsupported) {
          await this.pullFromServer(this.lastRevision, { priorityFast: false });
        } else if (isSupabaseAvailable()) {
          await this.pullFromSupabaseCloud({ fastOnly: false, hydrateLocalServer: false });
        }
      }
      const hasLiveStream =
        this.ws?.readyState === WebSocket.OPEN ||
        (typeof EventSource !== 'undefined' && this.sse?.readyState === EventSource.OPEN);
      const nextInterval = hasLiveStream ? 30000 : 10000;
      this.deltaPollTimer = window.setTimeout(() => {
        void tick();
      }, nextInterval);
    };

    this.deltaPollTimer = window.setTimeout(() => {
      void tick();
    }, 5000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null || this.localBackendUnsupported) return;
    const delay = Math.min(5000, 350 * Math.pow(1.6, this.reconnectAttempts));
    this.reconnectAttempts++;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, delay);
  }

  private initSupabaseRealtimeBridge(): void {
    if (!isSupabaseAvailable()) return;
    try {
      supabase
        .channel('simpel-global-db-sync')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          if (!isSupabaseAvailable()) return;
          if (payload.table === 'app_sync_state') {
            void this.pullFromSupabaseCloud({ fastOnly: true, hydrateLocalServer: !this.localBackendUnsupported });
          }
          window.dispatchEvent(
            new CustomEvent('simpel:remote-sync', {
              detail: { keys: ['*'], table: payload.table },
            })
          );
        })
        .subscribe((subStatus) => {
          if (subStatus === 'SUBSCRIBED') {
            this.cloudConnected = true;
            this.updateConnectionStatus();
          }
        });

      supabase.auth.onAuthStateChange((event) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && isSupabaseAvailable()) {
          void this.syncAllLocalToCloud();
          void this.pullFromSupabaseCloud({
            fastOnly: false,
            hydrateLocalServer: !this.localBackendUnsupported,
            force: true,
          });
        }
      });
    } catch (err) {
      console.warn('[Sync] Supabase Realtime bridge skipped:', err);
    }
  }

  public bootstrap(): Promise<void> {
    if (this.bootstrapPromise) return this.bootstrapPromise;

    this.bootstrapPromise = (async () => {
      if (typeof window === 'undefined') return;

      // 1. Snapshot & interceptor lokal lebih dulu agar tidak ada mutasi terlewat
      this.snapshotLocalValues();
      this.installStorageInterceptor();

      // 2. Tarik data cepat (~22KB: akun, guru, siswa, kelas, dll) tanpa terblokir oleh logo/settings besar
      await this.pullFromServer(0, { priorityFast: true });

      // 3. Jika Supabase aktif, pastikan koneksi cloud diverifikasi & sinkronkan state lokal jika sesi auth aktif
      if (isSupabaseAvailable()) {
        if (!this.cloudConnected) {
          void this.pullFromSupabaseCloud({ fastOnly: true, hydrateLocalServer: !this.localBackendUnsupported });
        }
        void this.syncAllLocalToCloud();
      }

      // 4. Establish WebSocket + SSE fallback + adaptive delta check + lifecycle hooks
      if (!this.localBackendUnsupported) {
        this.connectWebSocket();
        this.setupSSEFallback();
      }
      this.startAdaptiveDeltaCheck();
      this.initSupabaseRealtimeBridge();
      this.updateConnectionStatus();

      window.addEventListener('online', () => {
        this.wsConsecutiveFailures = 0;
        this.reconnectAttempts = 0;
        this.updateConnectionStatus();
        void this.flushMutations();
        if (!this.localBackendUnsupported) {
          this.connectWebSocket();
          void this.pullFromServer(this.lastRevision, { priorityFast: false });
        } else if (isSupabaseAvailable()) {
          void this.pullFromSupabaseCloud({ fastOnly: false, force: true });
        }
      });

      window.addEventListener('offline', () => {
        this.status = 'offline';
        this.emitStatus();
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (!this.localBackendUnsupported) {
            if ((!this.ws || this.ws.readyState !== WebSocket.OPEN) && this.wsConsecutiveFailures < this.maxWsFailures) {
              this.connectWebSocket();
            }
            void this.pullFromServer(this.lastRevision, { priorityFast: false });
          } else if (isSupabaseAvailable()) {
            void this.pullFromSupabaseCloud({ fastOnly: true });
          }
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
    this.wsConsecutiveFailures = 0;
    this.reconnectAttempts = 0;
    this.localBackendUnsupported = false;
    if (isSupabaseConfigured) {
      resetSupabaseCircuitBreaker();
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWebSocket();
    }
    await this.flushMutations();
    await this.pullFromServer(0, { priorityFast: false });
    if (isSupabaseAvailable()) {
      await this.syncAllLocalToCloud();
      await this.pullFromSupabaseCloud({
        fastOnly: false,
        hydrateLocalServer: !this.localBackendUnsupported,
        force: true,
      });
    }
    window.dispatchEvent(new CustomEvent('simpel:remote-sync', { detail: { keys: ['*'], manual: true } }));
    window.dispatchEvent(new CustomEvent('simpel:remote-file-sync', { detail: { manual: true } }));
    this.updateConnectionStatus();
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
      supabaseStatus: this.supabaseStatus,
      supabaseError: this.supabaseError,
      localServerAvailable: !this.localBackendUnsupported,
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
