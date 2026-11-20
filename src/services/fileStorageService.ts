/**
 * Layanan Penyimpanan Dokumen Mandiri & Sinkronisasi Google Drive Tanpa Firebase Auth
 * 
 * Menggunakan IndexedDB untuk menyimpan berkas fisik (PDF, Word, Excel, Gambar)
 * secara instan di browser/perangkat madrasah, dilengkapi integrasi Google Apps Script
 * untuk upload otomatis langsung ke Google Drive madrasah tanpa memerlukan popup login atau Firebase.
 */

import { syncService } from './syncService';

export interface StoredDocumentFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  category: string;
  description?: string;
  uploadedBy: string;
  uploadedAt: string;
  dataUrl?: string; // Data base64 untuk unduh / pratinjau instan
  googleDriveUrl?: string; // Tautan Google Drive jika disinkronkan
  driveFileId?: string;
  folderPath?: string; // Jejak susunan folder di Google Drive
  folderUrl?: string; // Tautan folder tujuan di Google Drive
  driveUploadError?: string;
  uploadedViaAppsScript?: boolean;
}

export interface DriveIntegrationConfig {
  sharedFolderUrl: string; // Tautan Folder Utama Google Drive Madrasah
  appsScriptWebhookUrl: string; // URL Web App Google Apps Script
  driveFolderName: string;
  ownerEmail?: string; // Akun Google Drive tujuan (alihsansoborejo@gmail.com)
  autoUploadToDrive: boolean;
  activatedBy?: string;
  activatedAt?: string;
  lastTestAt?: string;
  lastTestStatus?: 'connected' | 'error';
  lastTestMessage?: string;
}

const DB_NAME = 'simpel_madrasah_storage_db';
const DB_VERSION = 1;
const STORE_NAME = 'uploaded_documents';
const CONFIG_KEY = 'simpel_drive_storage_config_v1';
export const DEFAULT_DRIVE_OWNER_EMAIL = 'alihsansoborejo@gmail.com';

const DEFAULT_CONFIG: DriveIntegrationConfig = {
  sharedFolderUrl: 'https://drive.google.com',
  appsScriptWebhookUrl: '',
  driveFolderName: 'SIMPEL MI Al Ihsan Soborejo',
  ownerEmail: DEFAULT_DRIVE_OWNER_EMAIL,
  autoUploadToDrive: false,
};

export function extractFolderIdFromUrl(url: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return idMatch?.[1] || undefined;
}

export function extractDriveFileIdFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) return fileMatch[1];
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch?.[1] && !url.includes('/folders/')) return openMatch[1];
  return undefined;
}

export function isRealDriveFileUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'https://drive.google.com' || trimmed === 'https://drive.google.com/') {
    return false;
  }
  return (
    /\/file\/d\/[a-zA-Z0-9_-]+/i.test(trimmed) ||
    /\/document\/d\/[a-zA-Z0-9_-]+/i.test(trimmed) ||
    /\/spreadsheets\/d\/[a-zA-Z0-9_-]+/i.test(trimmed) ||
    /\/presentation\/d\/[a-zA-Z0-9_-]+/i.test(trimmed) ||
    (/drive\.google\.com\/open\?id=/i.test(trimmed) && !trimmed.includes('/folders/'))
  );
}

export function normalizeDriveSegment(value?: string, fallback = 'Umum'): string {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

export function resolveOrderedCategoryFolder(docTypeOrCategory: string, fallbackFolder?: string): string {
  const lower = String(docTypeOrCategory || '').toLowerCase();
  if (lower.includes('capaian') || lower.includes('tujuan pembelajaran') || lower === 'cp' || lower === 'tp' || lower.includes('cp & tp')) {
    return '01. CP & TP';
  }
  if (lower.includes('alur tujuan') || lower === 'atp') {
    return '02. ATP';
  }
  if (lower.includes('prota') || lower.includes('promes') || lower.includes('prosem') || lower.includes('program tahunan') || lower.includes('program semester')) {
    return '03. Prota & Prosem';
  }
  if (lower.includes('modul ajar')) {
    return '04. Modul Ajar';
  }
  if (lower.includes('lkpd') || lower.includes('lembar kerja')) {
    return '05. LKPD';
  }
  if (lower.includes('soal') || lower.includes('kisi') || lower.includes('asesmen') || lower.includes('evaluasi')) {
    return '06. Naskah Soal & Kisi-Kisi';
  }
  if (lower.includes('kktp') || lower.includes('kriteria ketercapaian')) {
    return '07. KKTP & Penilaian';
  }
  if (lower.includes('ko kurikuler') || lower.includes('kokurikuler')) {
    if (lower.includes('perencanaan') || lower.includes('modul')) {
      return '09. Ko Kurikuler - Perencanaan dan Modul';
    }
    if (lower.includes('bahan ajar') || lower.includes('aktivitas')) {
      return '10. Ko Kurikuler - Bahan Ajar dan Aktivitas Murid';
    }
    if (lower.includes('asesmen') || lower.includes('refleksi')) {
      return '11. Ko Kurikuler - Asesmen dan Refleksi';
    }
    if (lower.includes('administrasi') || lower.includes('pelaporan')) {
      return '12. Ko Kurikuler - Administrasi dan Pelaporan';
    }
    return '09. Ko Kurikuler';
  }
  if (fallbackFolder) {
    return normalizeDriveSegment(fallbackFolder, '08. Dokumen Lainnya');
  }
  return '08. Dokumen Lainnya';
}

export function buildStructuredDrivePath(params: {
  academicYearName?: string;
  semesterType?: string;
  className?: string;
  subjectName?: string;
  category: string;
  categoryFolder?: string;
}): { folderSegments: string[]; categoryFolder: string; displayPath: string } {
  const rawYear = normalizeDriveSegment(params.academicYearName || '2026-2027', '2026-2027');
  const yearLabel = rawYear.toUpperCase().startsWith('TA ') ? rawYear : `TA ${rawYear}`;
  const semLabel = params.semesterType ? ` - ${normalizeDriveSegment(params.semesterType)}` : '';
  const termSegment = `${yearLabel}${semLabel}`;

  const classSegment = normalizeDriveSegment(params.className || 'Administrasi Umum', 'Administrasi Umum');
  const subjectSegment = normalizeDriveSegment(params.subjectName || 'Umum Madrasah', 'Umum Madrasah');
  const categorySegment = resolveOrderedCategoryFolder(params.category, params.categoryFolder);

  const folderSegments = [termSegment, classSegment, subjectSegment, categorySegment];
  return {
    folderSegments,
    categoryFolder: categorySegment,
    displayPath: folderSegments.join(' / '),
  };
}

export function formatDriveFileName(rawTitleOrName: string, uploaderName?: string, originalFileName?: string): string {
  const fallbackExt = originalFileName && originalFileName.includes('.')
    ? originalFileName.split('.').pop() || 'pdf'
    : 'pdf';

  const trimmed = String(rawTitleOrName || originalFileName || 'Dokumen_SIMPEL').trim();
  const extMatch = trimmed.match(/\.([a-zA-Z0-9]{2,6})$/);
  const ext = extMatch ? extMatch[1] : fallbackExt;
  const baseName = extMatch ? trimmed.slice(0, -(ext.length + 1)) : trimmed;
  const cleanBase = normalizeDriveSegment(baseName, 'Dokumen_SIMPEL');

  const cleanUploader = normalizeDriveSegment(uploaderName || '', '');
  const isGenericUploader =
    !cleanUploader ||
    cleanUploader.toLowerCase() === 'guru madrasah' ||
    cleanUploader.toLowerCase() === 'pengguna';

  const finalBase =
    !isGenericUploader && !cleanBase.toLowerCase().includes(cleanUploader.toLowerCase())
      ? `${cleanBase} - ${cleanUploader}`
      : cleanBase;

  return `${finalBase}.${ext}`;
}

function getConfigTimestamp(cfg?: Partial<DriveIntegrationConfig>): number {
  if (!cfg) return 0;
  const t1 = cfg.activatedAt ? Date.parse(cfg.activatedAt) : 0;
  const t2 = cfg.lastTestAt ? Date.parse(cfg.lastTestAt) : 0;
  return Math.max(Number.isFinite(t1) ? t1 : 0, Number.isFinite(t2) ? t2 : 0);
}

// Inisialisasi IndexedDB
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('Browser Anda tidak mendukung IndexedDB.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
      }
    };
  });
}

// Konversi File ke Data URL (Base64)
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

const MAX_PROXY_FILE_BYTES = 20 * 1024 * 1024;
const MAX_APPS_SCRIPT_FILE_BYTES = 35 * 1024 * 1024;

async function readJsonResponseSafely<T = any>(
  res: Response
): Promise<{ data: T | null; rawText: string; isEmptyOrNonJson: boolean }> {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    return { data: null, rawText: '', isEmptyOrNonJson: true };
  }
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { data: null, rawText: '', isEmptyOrNonJson: true };
  }
  try {
    return { data: JSON.parse(trimmed) as T, rawText: trimmed, isEmptyOrNonJson: false };
  } catch {
    return { data: null, rawText: trimmed, isEmptyOrNonJson: true };
  }
}

function buildHttpFallbackMessage(status: number, rawText: string, defaultMsg: string): string {
  if (status === 413) {
    return 'Ukuran berkas terlalu besar untuk dikirim melalui proxy server (HTTP 413).';
  }
  if (status === 502 || status === 503 || status === 504) {
    return `Server atau proxy sedang sibuk / batas waktu habis (HTTP ${status}). Silakan coba lagi beberapa saat lagi.`;
  }
  if (!rawText) {
    return `${defaultMsg} (server mengembalikan respons kosong, HTTP ${status || '0'}).`;
  }
  return `${defaultMsg} (HTTP ${status || '0'}).`;
}

async function postDirectlyToAppsScript(
  webhookUrl: string,
  payload: Record<string, any>,
  timeoutMs = 55000
): Promise<any> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controller?.signal,
    });
    const { data, rawText, isEmptyOrNonJson } = await readJsonResponseSafely(res);
    if (isEmptyOrNonJson) {
      if (
        res.status === 401 ||
        res.status === 403 ||
        rawText.startsWith('<') ||
        rawText.toLowerCase().includes('<!doctype html') ||
        rawText.toLowerCase().includes('accounts.google.com') ||
        rawText.toLowerCase().includes('access denied')
      ) {
        const isForbidden =
          res.status === 401 ||
          res.status === 403 ||
          rawText.toLowerCase().includes('access denied') ||
          rawText.toLowerCase().includes('you need access');
        throw new Error(
          isForbidden
            ? 'Google Apps Script menolak akses tanpa login (HTTP 403 / Access Denied). Akun Google Workspace pendidikan (*.belajar.id) biasanya memblokir akses publik ("Anyone"). Solusi: Deploy ulang skrip memakai akun @gmail.com biasa (mis. alihsansoborejo@gmail.com) dengan Execute as = "Me" dan Who has access = "Anyone" (Siapa saja).'
            : 'Web App Google Apps Script mengembalikan halaman HTML/login Google. Pastikan saat Deploy > New deployment di script.google.com memakai akun @gmail.com biasa, Execute as disetel ke "Me" dan Who has access disetel ke "Anyone" (Siapa saja).'
        );
      }
      throw new Error(
        buildHttpFallbackMessage(res.status, rawText, 'Google Apps Script mengembalikan respons tidak valid')
      );
    }
    if (!res.ok || data?.status === 'error') {
      throw new Error(data?.message || `Google Apps Script gagal (HTTP ${res.status}).`);
    }
    return data;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Unggahan langsung ke Google Apps Script melebihi batas waktu.');
    }
    throw err;
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  }
}

export const fileStorageService = {
  buildStructuredDrivePath,
  formatDriveFileName,
  resolveOrderedCategoryFolder,

  // Ambil Konfigurasi Integrasi Google Drive
  getConfig(): DriveIntegrationConfig {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          ownerEmail: parsed?.ownerEmail || DEFAULT_DRIVE_OWNER_EMAIL,
        };
      }
    } catch (err) {
      console.warn('Gagal membaca config Google Drive:', err);
    }
    return DEFAULT_CONFIG;
  },

  // Tarik Konfigurasi Drive dari server agar semua perangkat langsung aktif & selalu mutakhir tanpa login
  async hydrateConfigFromServer(): Promise<DriveIntegrationConfig> {
    const localCfg = this.getConfig();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? window.setTimeout(() => controller.abort(), 8000) : null;

    try {
      const res = await fetch('/api/drive/config', {
        cache: 'no-store',
        signal: controller?.signal,
      });
      if (!res.ok) return localCfg;
      const { data: json } = await readJsonResponseSafely(res);
      const serverCfg = json?.config as Partial<DriveIntegrationConfig> | undefined;
      if (!serverCfg) return localCfg;

      const serverUrl = (serverCfg.appsScriptWebhookUrl || '').trim();
      const localUrl = (localCfg.appsScriptWebhookUrl || '').trim();
      const serverValid = serverUrl.startsWith('https://script.google.com');
      const localValid = localUrl.startsWith('https://script.google.com');

      // Jika server belum punya URL Apps Script tapi perangkat ini punya (mis. dari sync cloud), pulihkan ke server
      if (!serverValid && localValid) {
        void fetch('/api/drive/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: localCfg }),
        }).catch(() => {});
        return localCfg;
      }

      // Jika server punya URL Apps Script yang valid, utamakan konfigurasi server (kecuali lokal jelas lebih baru)
      const serverTs = getConfigTimestamp(serverCfg);
      const localTs = getConfigTimestamp(localCfg);
      const preferServer = serverValid && (!localValid || serverTs >= localTs || localUrl !== serverUrl);

      const merged: DriveIntegrationConfig = preferServer
        ? {
            ...DEFAULT_CONFIG,
            ...localCfg,
            ...serverCfg,
            appsScriptWebhookUrl: serverUrl,
            sharedFolderUrl: serverCfg.sharedFolderUrl || localCfg.sharedFolderUrl || 'https://drive.google.com',
            driveFolderName: serverCfg.driveFolderName || localCfg.driveFolderName || DEFAULT_CONFIG.driveFolderName,
            ownerEmail: serverCfg.ownerEmail || localCfg.ownerEmail || DEFAULT_DRIVE_OWNER_EMAIL,
            autoUploadToDrive: serverCfg.autoUploadToDrive !== false,
          }
        : {
            ...DEFAULT_CONFIG,
            ...serverCfg,
            ...localCfg,
            appsScriptWebhookUrl: localUrl || serverUrl,
            sharedFolderUrl:
              localCfg.sharedFolderUrl && localCfg.sharedFolderUrl !== 'https://drive.google.com'
                ? localCfg.sharedFolderUrl
                : serverCfg.sharedFolderUrl || localCfg.sharedFolderUrl || 'https://drive.google.com',
            driveFolderName: localCfg.driveFolderName || serverCfg.driveFolderName || DEFAULT_CONFIG.driveFolderName,
            ownerEmail: serverCfg.ownerEmail || localCfg.ownerEmail || DEFAULT_DRIVE_OWNER_EMAIL,
            autoUploadToDrive: localValid
              ? localCfg.autoUploadToDrive
              : Boolean(serverValid && serverCfg.autoUploadToDrive !== false),
          };

      localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
      return merged;
    } catch {
      return localCfg;
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    }
  },

  // Simpan Konfigurasi Integrasi Google Drive & sinkronkan ke server lintas perangkat
  saveConfig(config: Partial<DriveIntegrationConfig>): DriveIntegrationConfig {
    const current = this.getConfig();
    const updated: DriveIntegrationConfig = {
      ...current,
      ...config,
      ownerEmail: config.ownerEmail || current.ownerEmail || DEFAULT_DRIVE_OWNER_EMAIL,
    };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('simpel:remote-sync', { detail: { keys: [CONFIG_KEY] } }));
    }
    void fetch('/api/drive/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: updated }),
    }).catch((err) => {
      console.warn('Sinkronisasi konfigurasi Drive ke server dilewati:', err);
    });
    return updated;
  },

  // Cek apakah Google Apps Script terkonfigurasi (tanpa login Google)
  isAppsScriptActive(configOverride?: DriveIntegrationConfig): boolean {
    const cfg = configOverride || this.getConfig();
    const url = (cfg.appsScriptWebhookUrl || '').trim();
    return Boolean(url.startsWith('https://script.google.com') && cfg.autoUploadToDrive !== false);
  },

  // Status lengkap integrasi Google Drive (membedakan sehat vs error HTTP 403 / konfigurasi bermasalah)
  getDriveStatusInfo(configOverride?: DriveIntegrationConfig): {
    hasWebhookUrl: boolean;
    autoEnabled: boolean;
    isConfigured: boolean;
    isError: boolean;
    isHealthy: boolean;
    ownerEmail: string;
    errorMessage?: string;
  } {
    const cfg = configOverride || this.getConfig();
    const url = (cfg.appsScriptWebhookUrl || '').trim();
    const hasWebhookUrl = url.startsWith('https://script.google.com');
    const autoEnabled = cfg.autoUploadToDrive !== false;
    const isConfigured = hasWebhookUrl && autoEnabled;
    const isError = isConfigured && cfg.lastTestStatus === 'error';
    const isHealthy = isConfigured && cfg.lastTestStatus !== 'error';
    return {
      hasWebhookUrl,
      autoEnabled,
      isConfigured,
      isError,
      isHealthy,
      ownerEmail: cfg.ownerEmail || DEFAULT_DRIVE_OWNER_EMAIL,
      errorMessage: isError ? cfg.lastTestMessage : undefined,
    };
  },

  // Uji Koneksi Web App Google Apps Script melalui proxy server (dengan fallback langsung dari browser bila route /api tidak tersedia seperti HTTP 405)
  async testAppsScriptConnection(
    configOverride?: Partial<DriveIntegrationConfig>
  ): Promise<{ success: boolean; message: string; folderUrl?: string; folderName?: string; ownerEmail?: string }> {
    const cfg = { ...this.getConfig(), ...configOverride };
    const webhookUrl = (cfg.appsScriptWebhookUrl || '').trim();
    if (!webhookUrl) {
      return { success: false, message: 'URL Web App Google Apps Script belum diisi.' };
    }
    const parentFolderId = extractFolderIdFromUrl(cfg.sharedFolderUrl || '');
    const folderName = cfg.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo';
    const pingPayload = {
      webhookUrl,
      folderName,
      parentFolderId: parentFolderId || '',
    };

    let proxyFailureMessage = '';
    let shouldFallbackDirect = false;

    try {
      const res = await fetch('/api/drive/apps-script-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pingPayload),
      });
      const { data: json, rawText, isEmptyOrNonJson } = await readJsonResponseSafely(res);

      if (res.ok && json?.success) {
        return {
          success: true,
          message: json.message || 'Koneksi Google Apps Script berhasil.',
          folderUrl: json.folderUrl,
          folderName: json.folderName,
          ownerEmail: json.ownerEmail || DEFAULT_DRIVE_OWNER_EMAIL,
        };
      }

      if (!isEmptyOrNonJson && json?.message && ![404, 405, 502, 503, 504].includes(res.status)) {
        return {
          success: false,
          message: json.message,
        };
      }

      shouldFallbackDirect = true;
      proxyFailureMessage =
        json?.message ||
        buildHttpFallbackMessage(res.status, rawText, 'Gagal menguji koneksi Google Apps Script');
    } catch (err: any) {
      shouldFallbackDirect = true;
      proxyFailureMessage =
        err?.message || 'Gagal menghubungi server untuk uji koneksi Google Apps Script.';
    }

    if (shouldFallbackDirect) {
      try {
        const directRes = await postDirectlyToAppsScript(webhookUrl, {
          action: 'ping',
          folderName,
          parentFolderId: parentFolderId || '',
        });
        return {
          success: true,
          message:
            directRes?.message ||
            `Koneksi Google Apps Script aktif (${directRes?.ownerEmail || DEFAULT_DRIVE_OWNER_EMAIL})! Folder "${directRes?.folderName || folderName}" siap menerima arsip dokumen tanpa login.`,
          folderUrl: directRes?.folderUrl || '',
          folderName: directRes?.folderName || folderName,
          ownerEmail: directRes?.ownerEmail || DEFAULT_DRIVE_OWNER_EMAIL,
        };
      } catch (directErr: any) {
        return {
          success: false,
          message: directErr?.message || proxyFailureMessage || 'Gagal menghubungi Google Apps Script.',
        };
      }
    }

    return {
      success: false,
      message: proxyFailureMessage || 'Gagal menghubungi Google Apps Script.',
    };
  },

  /**
   * Simpan Berkas Baru secara Mandiri ke IndexedDB
   * & Upload otomatis ke Google Drive Madrasah (alihsansoborejo@gmail.com) via Apps Script (tanpa login) jika aktif
   */
  async saveDocumentFile(options: {
    file: File;
    name?: string;
    category: string;
    categoryFolder?: string;
    folderPath?: string[];
    description?: string;
    uploadedBy: string;
    googleDriveUrl?: string;
    driveFileId?: string;
  }): Promise<StoredDocumentFile> {
    const db = await openDatabase();
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const dataUrl = await fileToDataUrl(options.file);

    let driveUrl = options.googleDriveUrl || '';
    let driveFileId = options.driveFileId || '';
    let driveFolderUrl = '';
    let driveFolderPath = options.folderPath && options.folderPath.length > 0 ? options.folderPath.join(' / ') : '';
    let driveUploadError: string | undefined;
    let uploadedViaAppsScript = false;

    // Selalu tarik konfigurasi terbaru dari server agar perangkat guru mana pun langsung memakai Apps Script terbaru
    const config = await this.hydrateConfigFromServer();

    // Prioritas utama: unggah langsung ke Google Drive pusat (alihsansoborejo@gmail.com) via Apps Script tanpa login
    if (this.isAppsScriptActive(config)) {
      try {
        const orderedCategory = resolveOrderedCategoryFolder(options.category, options.categoryFolder);
        const uploadResult = await this.uploadViaAppsScript(options.file, options.name || options.file.name, {
          categoryFolder: orderedCategory,
          folderPath: options.folderPath && options.folderPath.length > 0 ? options.folderPath : [orderedCategory],
          description: options.description,
          uploadedBy: options.uploadedBy,
          webhookUrl: config.appsScriptWebhookUrl,
          folderName: config.driveFolderName,
          sharedFolderUrl: config.sharedFolderUrl,
        });
        if (uploadResult?.url) {
          driveUrl = uploadResult.url;
          if (uploadResult.fileId) driveFileId = uploadResult.fileId;
          if (uploadResult.folderUrl) driveFolderUrl = uploadResult.folderUrl;
          if (uploadResult.folderPath) driveFolderPath = uploadResult.folderPath;
          uploadedViaAppsScript = true;
          if (config.lastTestStatus !== 'connected') {
            this.saveConfig({
              lastTestAt: new Date().toISOString(),
              lastTestStatus: 'connected',
              lastTestMessage: 'Upload otomatis ke Google Drive berhasil tanpa login.',
            });
          }
        }
      } catch (err: any) {
        driveUploadError = err?.message || 'Upload ke Google Drive via Apps Script gagal.';
        this.saveConfig({
          lastTestAt: new Date().toISOString(),
          lastTestStatus: 'error',
          lastTestMessage: driveUploadError,
        });
        console.warn('Upload via Google Apps Script gagal:', err);
      }
    }

    const docRecord: StoredDocumentFile = {
      id: fileId,
      name: options.name || options.file.name,
      size: options.file.size,
      mimeType: options.file.type || 'application/octet-stream',
      category: options.category,
      description: options.description || '',
      uploadedBy: options.uploadedBy,
      uploadedAt: new Date().toISOString(),
      dataUrl,
      googleDriveUrl: driveUrl,
      driveFileId: driveFileId || undefined,
      folderPath: driveFolderPath || undefined,
      folderUrl: driveFolderUrl || undefined,
      driveUploadError,
      uploadedViaAppsScript,
    };

    const savedRecord = await new Promise<StoredDocumentFile>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(docRecord);

      req.onsuccess = () => resolve(docRecord);
      req.onerror = () => reject(req.error);
    });

    // Sinkronkan berkas ke server agar langsung tersedia di seluruh perangkat (maks 18MB payload)
    if ((savedRecord.dataUrl?.length || 0) <= 22 * 1024 * 1024) {
      try {
        await fetch('/api/sync/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: syncService.getClientId(),
            file: savedRecord,
          }),
        });
        syncService.notifyFileSyncChanged();
      } catch (err) {
        console.warn('Gagal menyinkronkan berkas ke server:', err);
      }
    }

    return {
      ...savedRecord,
      driveUploadError,
      uploadedViaAppsScript,
    };
  },

  /**
   * Unggah ulang berkas tersimpan ke Google Drive (jika sinkronisasi awal gagal)
   */
  async retryDriveUpload(
    fileOrId: string | StoredDocumentFile
  ): Promise<{ updated: StoredDocumentFile; error?: string }> {
    const existing = typeof fileOrId === 'string' ? await this.getFileById(fileOrId) : fileOrId;
    if (!existing) {
      throw new Error('Berkas tidak ditemukan di arsip aplikasi.');
    }
    if (!existing.dataUrl) {
      throw new Error('Konten fisik berkas tidak tersedia untuk diunggah ulang.');
    }

    const config = await this.hydrateConfigFromServer();
    if (!this.isAppsScriptActive(config)) {
      throw new Error('Google Apps Script belum diaktifkan oleh Admin Madrasah.');
    }

    const resBlob = await fetch(existing.dataUrl);
    const blob = await resBlob.blob();
    const fileObj = new File([blob], existing.name, {
      type: existing.mimeType || blob.type || 'application/octet-stream',
    });

    const folderSegments = existing.folderPath
      ? existing.folderPath.split('/').map((s) => s.trim()).filter(Boolean)
      : [resolveOrderedCategoryFolder(existing.category)];

    const uploadResult = await this.uploadViaAppsScript(fileObj, existing.name, {
      categoryFolder: resolveOrderedCategoryFolder(existing.category),
      folderPath: folderSegments,
      description: existing.description,
      uploadedBy: existing.uploadedBy,
      webhookUrl: config.appsScriptWebhookUrl,
      folderName: config.driveFolderName,
      sharedFolderUrl: config.sharedFolderUrl,
    });

    const updatedRecord: StoredDocumentFile = {
      ...existing,
      googleDriveUrl: uploadResult.url || existing.googleDriveUrl,
      driveFileId: uploadResult.fileId || existing.driveFileId,
      folderPath: uploadResult.folderPath || existing.folderPath,
      folderUrl: uploadResult.folderUrl || existing.folderUrl,
      driveUploadError: undefined,
      uploadedViaAppsScript: true,
    };

    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(updatedRecord);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Gagal memperbarui IndexedDB setelah unggah ulang Drive:', err);
    }

    if ((updatedRecord.dataUrl?.length || 0) <= 22 * 1024 * 1024) {
      try {
        await fetch('/api/sync/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: syncService.getClientId(),
            file: updatedRecord,
          }),
        });
        syncService.notifyFileSyncChanged();
      } catch (err) {
        console.warn('Gagal menyinkronkan pembaruan berkas ke server:', err);
      }
    }

    return { updated: updatedRecord };
  },

  /**
   * Sinkronkan otomatis semua berkas lokal yang belum memiliki tautan Google Drive
   * (dipanggil saat Admin mengaktifkan / menguji koneksi Apps Script hingga berhasil)
   */
  async syncPendingFilesToDrive(): Promise<{ synced: number; failed: number }> {
    const config = await this.hydrateConfigFromServer();
    const status = this.getDriveStatusInfo(config);
    if (!status.isHealthy) {
      return { synced: 0, failed: 0 };
    }

    const allFiles = await this.getAllFiles();
    const pending = allFiles.filter((f) => !isRealDriveFileUrl(f.googleDriveUrl) && Boolean(f.dataUrl));
    let synced = 0;
    let failed = 0;

    for (const file of pending) {
      try {
        const res = await this.retryDriveUpload(file);
        if (isRealDriveFileUrl(res.updated.googleDriveUrl)) {
          synced += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return { synced, failed };
  },

  /**
   * Ambil Seluruh Berkas Tersimpan dari IndexedDB & gabungkan dengan server lintas perangkat
   */
  async getAllFiles(): Promise<StoredDocumentFile[]> {
    let localFiles: StoredDocumentFile[] = [];
    try {
      const db = await openDatabase();
      localFiles = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => resolve((req.result || []) as StoredDocumentFile[]);
        req.onerror = () => reject(req.error);
      });

      // Tarik berkas dari server agar file yang diunggah di perangkat lain langsung muncul
      try {
        const res = await fetch('/api/sync/files', { cache: 'no-store' });
        if (res.ok) {
          const { data: json } = await readJsonResponseSafely(res);
          if (!json) {
            localFiles.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
            return localFiles;
          }
          const serverFiles: StoredDocumentFile[] = Array.isArray(json.files) ? json.files : [];
          const deletedSet = new Set<string>(Array.isArray(json.deletedIds) ? json.deletedIds : []);
          const mergedMap = new Map<string, StoredDocumentFile>();

          // Server dianggap otoritatif untuk daftar berkas tersinkron
          for (const sf of serverFiles) {
            mergedMap.set(sf.id, sf);
          }

          // Hapus berkas lokal yang telah dihapus di perangkat lain
          const idsToDeleteLocally: string[] = [];
          const localOnly: StoredDocumentFile[] = [];
          for (const lf of localFiles) {
            if (deletedSet.has(lf.id)) {
              idsToDeleteLocally.push(lf.id);
            } else if (!mergedMap.has(lf.id)) {
              localOnly.push(lf);
              mergedMap.set(lf.id, lf);
            }
          }

          // Sinkronkan cache IndexedDB lokal (upsert file baru & hapus yang didelete)
          if (serverFiles.length > 0 || idsToDeleteLocally.length > 0) {
            const writeTx = db.transaction(STORE_NAME, 'readwrite');
            const writeStore = writeTx.objectStore(STORE_NAME);
            for (const sf of serverFiles) {
              writeStore.put(sf);
            }
            for (const delId of idsToDeleteLocally) {
              writeStore.delete(delId);
            }
          }

          // Dorong berkas lokal lama (sebelum fitur sync aktif) ke server bila ukurannya aman
          for (const lf of localOnly) {
            if ((lf.dataUrl?.length || 0) <= 22 * 1024 * 1024) {
              void fetch('/api/sync/files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: syncService.getClientId(), file: lf }),
              }).catch(() => {});
            }
          }

          const combined = Array.from(mergedMap.values());
          combined.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
          return combined;
        }
      } catch (err) {
        console.warn('Sync files dari server dilewati (mode offline):', err);
      }

      localFiles.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      return localFiles;
    } catch (err) {
      console.warn('IndexedDB getAllFiles error:', err);
      return localFiles;
    }
  },

  async getFileById(id: string): Promise<StoredDocumentFile | null> {
    if (!id) return null;
    const all = await this.getAllFiles();
    return all.find((f) => f.id === id) || null;
  },

  /**
   * Hapus Berkas dari IndexedDB & Server Lintas Perangkat
   */
  async deleteFile(id: string): Promise<void> {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    try {
      await fetch(`/api/sync/files/${encodeURIComponent(id)}?clientId=${encodeURIComponent(syncService.getClientId())}`, {
        method: 'DELETE',
      });
      syncService.notifyFileSyncChanged();
    } catch (err) {
      console.warn('Gagal menghapus berkas dari server:', err);
    }
  },

  /**
   * Unduh Berkas secara Instan ke Komputer Pengguna
   */
  downloadStoredFile(file: StoredDocumentFile): void {
    if (!file.dataUrl) {
      if (file.googleDriveUrl) {
        window.open(file.googleDriveUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    const link = document.createElement('a');
    link.href = file.dataUrl;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Pratinjau Berkas di Tab Baru (Untuk PDF atau Gambar)
   */
  previewStoredFile(file: StoredDocumentFile): void {
    if (!file.dataUrl) {
      if (file.googleDriveUrl) {
        window.open(file.googleDriveUrl, '_blank');
      }
      return;
    }

    // Buka data URL di tab baru
    const win = window.open();
    if (win) {
      if (file.mimeType.includes('pdf')) {
        win.document.write(`
          <title>${file.name}</title>
          <iframe src="${file.dataUrl}" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>
        `);
      } else if (file.mimeType.startsWith('image/')) {
        win.document.write(`
          <title>${file.name}</title>
          <body style="margin:0; background:#111; display:flex; align-items:center; justify-content:center; height:100vh;">
            <img src="${file.dataUrl}" style="max-width:90%; max-height:90%; box-shadow:0 0 20px rgba(0,0,0,0.5);" />
          </body>
        `);
      } else {
        this.downloadStoredFile(file);
      }
    }
  },

  /**
   * Kirim Berkas ke Google Apps Script Web App via proxy server (Upload Langsung ke Google Drive alihsansoborejo@gmail.com tanpa Login)
   */
  async uploadViaAppsScript(
    file: File,
    customName?: string,
    options?: {
      categoryFolder?: string;
      folderPath?: string[];
      description?: string;
      uploadedBy?: string;
      webhookUrl?: string;
      folderName?: string;
      sharedFolderUrl?: string;
    }
  ): Promise<{ url: string; fileId?: string; folderUrl?: string; folderPath?: string }> {
    let config = this.getConfig();
    if (!options?.webhookUrl && !config.appsScriptWebhookUrl) {
      config = await this.hydrateConfigFromServer();
    }
    const webhookUrl = (options?.webhookUrl || config.appsScriptWebhookUrl || '').trim();
    if (!webhookUrl || !webhookUrl.startsWith('https://script.google.com')) {
      throw new Error('URL Web App Google Apps Script belum terkonfigurasi atau tidak valid.');
    }

    if (file.size > MAX_APPS_SCRIPT_FILE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      throw new Error(
        `Ukuran berkas (${sizeMb} MB) melebihi batas unggahan otomatis Google Apps Script (maksimal 35 MB).`
      );
    }

    const base64Data = await fileToDataUrl(file);
    const pureBase64 = base64Data.split(',')[1] || '';
    const parentFolderId = extractFolderIdFromUrl(options?.sharedFolderUrl || config.sharedFolderUrl || '');
    const fullDescription = [
      options?.description || '',
      options?.uploadedBy ? `Diunggah oleh: ${options.uploadedBy}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const folderName = options?.folderName || config.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo';
    const categoryFolder = options?.categoryFolder || '';
    const folderPath = Array.isArray(options?.folderPath) ? options.folderPath : [];
    const filename = customName || file.name;
    const mimeType = file.type || 'application/octet-stream';

    const directPayload = {
      action: 'upload',
      filename,
      mimeType,
      fileBase64: pureBase64,
      folderName,
      categoryFolder,
      folderPath,
      parentFolderId: parentFolderId || '',
      description: fullDescription,
      uploadedBy: options?.uploadedBy || '',
    };

    let proxyFailureReason = '';
    let shouldTryDirectFallback = file.size > MAX_PROXY_FILE_BYTES;

    // Berkas <= 20 MB dikirim melalui proxy server terlebih dahulu agar terhindar dari kendala jaringan klien
    if (file.size <= MAX_PROXY_FILE_BYTES) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? window.setTimeout(() => controller.abort(), 65000) : null;
      try {
        const response = await fetch('/api/drive/apps-script-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl,
            ...directPayload,
          }),
          signal: controller?.signal,
        });

        const { data: result, rawText, isEmptyOrNonJson } = await readJsonResponseSafely(response);

        if (response.ok && result?.success) {
          return {
            url: result.url || result.webViewLink || '',
            fileId: result.id || undefined,
            folderUrl: result.folderUrl || undefined,
            folderPath: result.folderPath || undefined,
          };
        }

        // Jika proxy mengembalikan error JSON terstruktur selain error proxy (404/405/413/5xx/empty), lempar langsung
        if (
          !isEmptyOrNonJson &&
          result?.message &&
          ![404, 405, 413, 502, 503, 504].includes(response.status)
        ) {
          throw new Error(result.message);
        }

        shouldTryDirectFallback = true;
        proxyFailureReason =
          result?.message ||
          buildHttpFallbackMessage(response.status, rawText, 'Gagal mengunggah berkas ke Google Apps Script');
      } catch (err: any) {
        if (err?.name !== 'AbortError' && !String(err?.message || '').includes('Failed to fetch') && !shouldTryDirectFallback) {
          throw err;
        }
        shouldTryDirectFallback = true;
        proxyFailureReason =
          err?.name === 'AbortError'
            ? 'Koneksi melalui proxy server melebihi batas waktu.'
            : err?.message || 'Koneksi proxy server terputus.';
      } finally {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
      }
    }

    // Fallback langsung ke Web App Google Apps Script (mengatasi batas payload 32MB/timeout proxy Cloud Run)
    if (shouldTryDirectFallback) {
      try {
        const directResult = await postDirectlyToAppsScript(webhookUrl, directPayload);
        return {
          url: directResult?.url || directResult?.webViewLink || directResult?.link || '',
          fileId: directResult?.id || directResult?.fileId || undefined,
          folderUrl: directResult?.folderUrl || undefined,
          folderPath: directResult?.folderPath || (folderPath.length > 0 ? folderPath.join(' / ') : undefined),
        };
      } catch (directErr: any) {
        throw new Error(directErr?.message || proxyFailureReason || 'Google Apps Script gagal menyimpan berkas.');
      }
    }

    throw new Error(proxyFailureReason || 'Google Apps Script gagal menyimpan berkas.');
  },

  /**
   * Kode Google Apps Script v2 siap pakai untuk akun Google Drive alihsansoborejo@gmail.com
   * Mendukung susunan folder bertingkat (TA/Semester > Kelas > Mapel > Kategori) & LockService anti-duplikat folder
   */
  getAppsScriptTemplateCode(): string {
    return `// ==============================================================
// SKRIP GOOGLE APPS SCRIPT v2 — SIMPEL MI MA'ARIF AL IHSAN SOBOREJO
// Login di browser dengan akun: alihsansoborejo@gmail.com
// Buka https://script.google.com > New project > Tempel skrip ini
// Deploy > New deployment > Web app:
//   - Execute as: Me (alihsansoborejo@gmail.com)
//   - Who has access: Anyone (Siapa saja)
// Susunan Folder Otomatis:
//   Root > Tahun Ajaran & Semester > Kelas > Mata Pelajaran > Kategori Perangkat
// ==============================================================

var DEFAULT_ROOT_FOLDER = 'SIMPEL MI Al Ihsan Soborejo';

function cleanSegment_(text, fallback) {
  var cleaned = String(text || '')
    .replace(/[\\\\/:*?"<>|]+/g, '-')
    .replace(/\\s+/g, ' ')
    .trim();
  return cleaned || (fallback || 'Umum');
}

function getOrCreateFolder_(parentFolder, folderName) {
  var name = cleanSegment_(folderName, DEFAULT_ROOT_FOLDER);
  var iter = parentFolder ? parentFolder.getFoldersByName(name) : DriveApp.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parentFolder ? parentFolder.createFolder(name) : DriveApp.createFolder(name);
}

function resolveTargetFolder_(data) {
  var rootFolder = null;
  if (data.parentFolderId) {
    try {
      rootFolder = DriveApp.getFolderById(String(data.parentFolderId).trim());
    } catch (err) {
      rootFolder = null;
    }
  }
  if (!rootFolder) {
    rootFolder = getOrCreateFolder_(null, data.folderName || DEFAULT_ROOT_FOLDER);
  }

  var pathTrail = [rootFolder.getName()];
  var current = rootFolder;
  var segments = [];

  if (data.folderPath && Object.prototype.toString.call(data.folderPath) === '[object Array]' && data.folderPath.length > 0) {
    for (var i = 0; i < data.folderPath.length; i++) {
      var seg = cleanSegment_(data.folderPath[i], '');
      if (seg) segments.push(seg);
    }
  } else if (data.categoryFolder) {
    var parts = String(data.categoryFolder).split(/[\\/>]+/);
    for (var j = 0; j < parts.length; j++) {
      var p = cleanSegment_(parts[j], '');
      if (p) segments.push(p);
    }
  }

  for (var k = 0; k < segments.length; k++) {
    current = getOrCreateFolder_(current, segments[k]);
    pathTrail.push(current.getName());
  }

  return {
    folder: current,
    folderPath: pathTrail.join(' / ')
  };
}

function getEffectiveOwnerEmail_() {
  try {
    return Session.getEffectiveUser().getEmail() || 'alihsansoborejo@gmail.com';
  } catch (e) {
    return 'alihsansoborejo@gmail.com';
  }
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonResponse_({
    status: 'ok',
    version: '2.0',
    message: 'SIMPEL MI Al Ihsan Drive Webhook v2 Aktif',
    ownerEmail: getEffectiveOwnerEmail_()
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var data = JSON.parse(rawBody);
    var resolved = resolveTargetFolder_(data);
    var targetFolder = resolved.folder;
    var ownerEmail = getEffectiveOwnerEmail_();

    // Uji koneksi dari panel Admin Madrasah
    if (data.action === 'ping') {
      return jsonResponse_({
        status: 'success',
        version: '2.0',
        message: 'Koneksi Google Apps Script v2 aktif (' + ownerEmail + ') & folder terstruktur siap.',
        folderName: targetFolder.getName(),
        folderUrl: targetFolder.getUrl(),
        folderPath: resolved.folderPath,
        ownerEmail: ownerEmail
      });
    }

    if (!data.fileBase64) {
      throw new Error('Konten berkas base64 kosong.');
    }

    var filename = String(data.filename || ('Dokumen_SIMPEL_' + new Date().getTime())).replace(/[\\\\/:*?"<>|]+/g, '-');
    var mimeType = String(data.mimeType || 'application/octet-stream');
    var decoded = Utilities.base64Decode(data.fileBase64);
    var blob = Utilities.newBlob(decoded, mimeType, filename);

    var file = targetFolder.createFile(blob);
    var descParts = [];
    if (data.description) descParts.push(String(data.description));
    if (data.uploadedBy) descParts.push('Pengunggah: ' + String(data.uploadedBy));
    descParts.push('Folder SIMPEL: ' + resolved.folderPath);
    if (descParts.length > 0) {
      file.setDescription(descParts.join(' | '));
    }

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      // Tetap lanjutkan walau kebijakan sharing folder/akun membatasi perubahan izin otomatis
    }

    return jsonResponse_({
      status: 'success',
      id: file.getId(),
      url: file.getUrl(),
      webViewLink: file.getUrl(),
      name: file.getName(),
      folderUrl: targetFolder.getUrl(),
      folderPath: resolved.folderPath,
      ownerEmail: ownerEmail
    });
  } catch (err) {
    return jsonResponse_({
      status: 'error',
      message: err.toString()
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (ignore) {}
  }
}`;
  },
};
