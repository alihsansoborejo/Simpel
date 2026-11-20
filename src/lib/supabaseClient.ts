import { createClient } from '@supabase/supabase-js';

declare const __SUPABASE_URL__: string | undefined;
declare const __SUPABASE_ANON_KEY__: string | undefined;

const supabaseUrl =
  (import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  (import.meta.env && import.meta.env.SUPABASE_URL) ||
  (typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '') ||
  '';

const supabaseAnonKey =
  (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  (import.meta.env && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  (import.meta.env && import.meta.env.SUPABASE_PUBLISHABLE_KEY) ||
  (import.meta.env && import.meta.env.SUPABASE_ANON_KEY) ||
  (typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '') ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseUrl.includes('mock-placeholder')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createClient('https://mock-placeholder.supabase.co', 'mock-anon-key-placeholder');

export function createEphemeralSupabaseClient() {
  if (!isSupabaseConfigured) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export const getSupabaseProjectRef = (): string | null => {
  const match = String(supabaseUrl).match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match ? match[1] : null;
};

export const getSupabaseConfigStatus = () => ({
  isConfigured: isSupabaseConfigured,
  hasUrl: Boolean(supabaseUrl && supabaseUrl.startsWith('https://') && !supabaseUrl.includes('your-project-id')),
  hasKey: Boolean(supabaseAnonKey && !supabaseAnonKey.includes('mock-anon-key')),
  url: supabaseUrl ? supabaseUrl.replace(/https:\/\/(.*)\.supabase\.co.*/, 'https://***.supabase.co') : 'Belum diatur',
  projectRef: getSupabaseProjectRef(),
});

export type SupabaseHealthStatus = 'unconfigured' | 'connected' | 'local_mode' | 'quota_exceeded' | 'error';

export interface SupabaseHealthSnapshot {
  status: SupabaseHealthStatus;
  message: string | null;
  circuitOpenUntil: number | null;
  lastCheckedAt: string | null;
}

const QUOTA_CIRCUIT_COOLDOWN_MS = 3 * 60 * 1000;
export const LOCAL_SYNC_BYPASS_KEY = 'simpel_use_local_sync_only';

function readBypassFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(LOCAL_SYNC_BYPASS_KEY);
    return raw === 'true' || raw === '"true"';
  } catch {
    return false;
  }
}

export function isSupabaseBypassed(): boolean {
  return readBypassFlag();
}

function getBaseSupabaseStatus(): SupabaseHealthStatus {
  if (!isSupabaseConfigured) return 'unconfigured';
  if (readBypassFlag()) return 'local_mode';
  return 'connected';
}

let supabaseHealth: SupabaseHealthSnapshot = {
  status: getBaseSupabaseStatus(),
  message: null,
  circuitOpenUntil: null,
  lastCheckedAt: null,
};

const healthListeners = new Set<(snap: SupabaseHealthSnapshot) => void>();

function notifyHealthListeners(): void {
  const snapshot = { ...supabaseHealth };
  healthListeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {
      // ignore listener errors
    }
  });
}

export function setSupabaseBypassed(bypass: boolean): void {
  if (typeof window !== 'undefined') {
    try {
      if (bypass) {
        window.localStorage.setItem(LOCAL_SYNC_BYPASS_KEY, 'true');
      } else {
        window.localStorage.removeItem(LOCAL_SYNC_BYPASS_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }
  supabaseHealth = {
    status: !isSupabaseConfigured ? 'unconfigured' : bypass ? 'local_mode' : 'connected',
    message: null,
    circuitOpenUntil: null,
    lastCheckedAt: new Date().toISOString(),
  };
  notifyHealthListeners();
}

function syncBypassHealthFromStorage(): void {
  if (!isSupabaseConfigured) return;
  const bypassed = readBypassFlag();
  if (bypassed && supabaseHealth.status !== 'local_mode') {
    supabaseHealth = {
      status: 'local_mode',
      message: null,
      circuitOpenUntil: null,
      lastCheckedAt: new Date().toISOString(),
    };
    notifyHealthListeners();
  } else if (!bypassed && supabaseHealth.status === 'local_mode') {
    supabaseHealth = {
      status: 'connected',
      message: null,
      circuitOpenUntil: null,
      lastCheckedAt: new Date().toISOString(),
    };
    notifyHealthListeners();
  }
}

if (typeof window !== 'undefined') {
  const win = window as unknown as { __simpelSupaBypassListenerBound?: boolean };
  if (!win.__simpelSupaBypassListenerBound) {
    win.__simpelSupaBypassListenerBound = true;
    window.addEventListener('simpel:remote-sync', (ev: Event) => {
      const keys = (ev as CustomEvent<{ keys?: string[] }>)?.detail?.keys;
      if (!keys || keys.includes('*') || keys.includes(LOCAL_SYNC_BYPASS_KEY)) {
        syncBypassHealthFromStorage();
      }
    });
    window.addEventListener('storage', (ev) => {
      if (!ev.key || ev.key === LOCAL_SYNC_BYPASS_KEY) {
        syncBypassHealthFromStorage();
      }
    });
  }
}

export function detectSupabaseQuotaError(err: any): boolean {
  if (!err) return false;
  const status = Number(err?.status || err?.statusCode || 0);
  if (status === 402) return true;
  const combined = [err?.message, err?.details, err?.hint, err?.code, typeof err === 'string' ? err : '']
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    combined.includes('exceed_egress_quota') ||
    combined.includes('egress') ||
    combined.includes('spend cap') ||
    combined.includes('project is restricted') ||
    combined.includes('quota')
  );
}

export function reportSupabaseOutcome(err?: any): void {
  if (!isSupabaseConfigured) {
    if (supabaseHealth.status !== 'unconfigured') {
      supabaseHealth = {
        status: 'unconfigured',
        message: null,
        circuitOpenUntil: null,
        lastCheckedAt: new Date().toISOString(),
      };
      notifyHealthListeners();
    }
    return;
  }

  if (readBypassFlag()) {
    if (supabaseHealth.status !== 'local_mode' || supabaseHealth.message !== null || supabaseHealth.circuitOpenUntil !== null) {
      supabaseHealth = {
        status: 'local_mode',
        message: null,
        circuitOpenUntil: null,
        lastCheckedAt: new Date().toISOString(),
      };
      notifyHealthListeners();
    }
    return;
  }

  const nowIso = new Date().toISOString();

  if (!err) {
    const changed =
      supabaseHealth.status !== 'connected' ||
      supabaseHealth.message !== null ||
      supabaseHealth.circuitOpenUntil !== null;
    supabaseHealth = {
      status: 'connected',
      message: null,
      circuitOpenUntil: null,
      lastCheckedAt: nowIso,
    };
    if (changed) notifyHealthListeners();
    return;
  }

  if (detectSupabaseQuotaError(err)) {
    const nextMsg =
      'Kuota egres database Supabase habis (exceed_egress_quota). Proyek Supabase dibatasi sementara oleh Supabase; sinkronisasi server aplikasi lokal tetap berjalan.';
    supabaseHealth = {
      status: 'quota_exceeded',
      message: nextMsg,
      circuitOpenUntil: Date.now() + QUOTA_CIRCUIT_COOLDOWN_MS,
      lastCheckedAt: nowIso,
    };
    notifyHealthListeners();
    return;
  }

  const rawMsg = String(err?.message || '').toLowerCase();
  const isNetworkOrServer =
    rawMsg.includes('failed to fetch') ||
    rawMsg.includes('networkerror') ||
    rawMsg.includes('503') ||
    rawMsg.includes('502') ||
    Number(err?.status || 0) >= 500;

  if (isNetworkOrServer) {
    supabaseHealth = {
      status: 'error',
      message: err?.message || 'Koneksi ke Supabase sedang mengalami gangguan.',
      circuitOpenUntil: Date.now() + 30 * 1000,
      lastCheckedAt: nowIso,
    };
    notifyHealthListeners();
  }
}

export function isSupabaseAvailable(): boolean {
  if (!isSupabaseConfigured) return false;
  if (readBypassFlag()) return false;
  if (supabaseHealth.circuitOpenUntil && Date.now() < supabaseHealth.circuitOpenUntil) {
    return false;
  }
  return true;
}

export function resetSupabaseCircuitBreaker(): void {
  if (!isSupabaseConfigured || readBypassFlag()) return;
  supabaseHealth = {
    ...supabaseHealth,
    circuitOpenUntil: null,
  };
  notifyHealthListeners();
}

export function getSupabaseHealth(): SupabaseHealthSnapshot {
  syncBypassHealthFromStorage();
  return { ...supabaseHealth };
}

export function subscribeSupabaseHealth(cb: (snap: SupabaseHealthSnapshot) => void): () => void {
  healthListeners.add(cb);
  syncBypassHealthFromStorage();
  cb({ ...supabaseHealth });
  return () => {
    healthListeners.delete(cb);
  };
}

