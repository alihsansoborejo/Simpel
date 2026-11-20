import { useEffect, useRef } from 'react';

interface EditGuardState {
  initialized: boolean;
  hasUnsavedDomEdit: boolean;
  lastEditAt: number;
  lastSearchInputAt: number;
  listeners: Set<() => void>;
}

const EDIT_IDLE_GRACE_MS = 60_000;
const SEARCH_FOCUS_GRACE_MS = 400;

function getGuardState(): EditGuardState {
  const win = window as unknown as { __simpelEditGuard?: EditGuardState };
  if (!win.__simpelEditGuard) {
    win.__simpelEditGuard = {
      initialized: false,
      hasUnsavedDomEdit: false,
      lastEditAt: 0,
      lastSearchInputAt: 0,
      listeners: new Set(),
    };
  }
  return win.__simpelEditGuard;
}

function isSearchOrFilterControl(el: Element): boolean {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'search') return true;
    if (el.dataset.syncSearch === 'true') return true;
    const ph = (el.placeholder || '').toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    if (ph.includes('cari') || ph.includes('search') || aria.includes('cari') || aria.includes('filter')) {
      return true;
    }
  }
  return false;
}

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLSelectElement) return !el.disabled;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  if (el instanceof HTMLInputElement) {
    if (el.disabled || el.readOnly) return false;
    const nonTextTypes = new Set(['button', 'submit', 'reset', 'file', 'hidden', 'image']);
    return !nonTextTypes.has((el.type || 'text').toLowerCase());
  }
  return false;
}

function isModalOpenInDom(): boolean {
  return Boolean(
    document.querySelector('[role="dialog"], .fixed.inset-0.z-50, .fixed.inset-0.z-40')
  );
}

export function isUserCurrentlyEditing(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const state = getGuardState();
  const active = document.activeElement;

  if (isEditableElement(active)) {
    return true;
  }

  if (Date.now() - state.lastSearchInputAt < SEARCH_FOCUS_GRACE_MS) {
    return true;
  }

  if (state.hasUnsavedDomEdit) {
    if (isModalOpenInDom()) {
      return true;
    }
    if (Date.now() - state.lastEditAt < EDIT_IDLE_GRACE_MS) {
      return true;
    }
    state.hasUnsavedDomEdit = false;
  }

  return false;
}

export function notifyDomFormSaved(): void {
  if (typeof window === 'undefined') return;
  const state = getGuardState();
  state.hasUnsavedDomEdit = false;
  state.lastEditAt = 0;
  state.listeners.forEach((cb) => cb());
}

function ensureGlobalEditListeners(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const state = getGuardState();
  if (state.initialized) return;
  state.initialized = true;

  const notifyAll = () => {
    state.listeners.forEach((cb) => cb());
  };

  const handleInputOrChange = (event: Event) => {
    const target = event.target as Element | null;
    if (!isEditableElement(target)) return;
    if (target instanceof HTMLInputElement && target.dataset.syncAllow === 'true') return;

    if (target && isSearchOrFilterControl(target)) {
      state.lastSearchInputAt = Date.now();
      return;
    }

    state.hasUnsavedDomEdit = true;
    state.lastEditAt = Date.now();
  };

  const handleSubmit = () => {
    state.hasUnsavedDomEdit = false;
    state.lastEditAt = 0;
    window.setTimeout(notifyAll, 350);
  };

  const handleClick = (event: Event) => {
    const target = event.target as Element | null;
    const btn = target?.closest?.('button, [role="button"]');
    if (!btn) return;

    const btnType = (btn.getAttribute('type') || '').toLowerCase();
    const label = (btn.textContent || '').trim().toLowerCase();
    const isSaveOrCloseAction =
      btnType === 'submit' ||
      /\b(simpan|save|kirim|perbarui|tambahkan|update|submit|terapkan|batal|tutup|close|cancel)\b/i.test(
        label
      );

    if (isSaveOrCloseAction) {
      state.hasUnsavedDomEdit = false;
      state.lastEditAt = 0;
      window.setTimeout(notifyAll, 450);
    }
  };

  const handleFocusOut = () => {
    window.setTimeout(notifyAll, 400);
  };

  document.addEventListener('input', handleInputOrChange, true);
  document.addEventListener('change', handleInputOrChange, true);
  document.addEventListener('submit', handleSubmit, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('focusout', handleFocusOut, true);
}

/**
 * Hook React untuk otomatis memuat ulang data komponen ketika terjadi pembaruan
 * real-time dari perangkat lain (via WebSocket/SSE) maupun tab lain.
 *
 * Perlindungan aktif: apabila pengguna sedang mengetik atau memiliki isian formulir
 * yang belum disimpan, pemuatan ulang otomatis akan DITUNDA (deferred) sampai proses
 * pengetikan/penyimpanan selesai agar teks yang diketik tidak pernah hilang.
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
    ensureGlobalEditListeners();
    const guardState = getGuardState();

    let debounceTimer: number | null = null;
    let retryTimer: number | null = null;
    let pendingReload = false;

    const flushOrDefer = () => {
      if (isUserCurrentlyEditing()) {
        pendingReload = true;
        if (retryTimer === null) {
          retryTimer = window.setInterval(() => {
            if (!pendingReload) {
              if (retryTimer !== null) {
                window.clearInterval(retryTimer);
                retryTimer = null;
              }
              return;
            }
            if (!isUserCurrentlyEditing()) {
              pendingReload = false;
              if (retryTimer !== null) {
                window.clearInterval(retryTimer);
                retryTimer = null;
              }
              callbackRef.current();
            }
          }, 1200);
        }
        return;
      }

      pendingReload = false;
      if (retryTimer !== null) {
        window.clearInterval(retryTimer);
        retryTimer = null;
      }
      callbackRef.current();
    };

    const handleEditSettled = () => {
      if (!pendingReload) return;
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        if (pendingReload) {
          flushOrDefer();
        }
      }, 120);
    };

    guardState.listeners.add(handleEditSettled);

    const triggerReload = () => {
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        flushOrDefer();
      }, 80);
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
      guardState.listeners.delete(handleEditSettled);
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      if (retryTimer !== null) window.clearInterval(retryTimer);
      window.removeEventListener('simpel:remote-sync', handleRemoteSync);
      if (includeFileSync) {
        window.removeEventListener('simpel:remote-file-sync', handleFileSync);
      }
    };
  }, [keysSignature, includeFileSync]);
}
