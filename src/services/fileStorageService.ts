/**
 * Layanan Penyimpanan Dokumen Mandiri & Sinkronisasi Google Drive Tanpa Firebase Auth
 * 
 * Menggunakan IndexedDB untuk menyimpan berkas fisik (PDF, Word, Excel, Gambar)
 * secara instan di browser/perangkat madrasah, dilengkapi integrasi Google Apps Script
 * untuk upload otomatis langsung ke Google Drive madrasah tanpa memerlukan popup login atau Firebase.
 */

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
}

export interface DriveIntegrationConfig {
  sharedFolderUrl: string; // Tautan Folder Utama Google Drive Madrasah
  appsScriptWebhookUrl: string; // URL Web App Google Apps Script (Opsional)
  driveFolderName: string;
  autoUploadToDrive: boolean;
}

const DB_NAME = 'simpel_madrasah_storage_db';
const DB_VERSION = 1;
const STORE_NAME = 'uploaded_documents';
const CONFIG_KEY = 'simpel_drive_storage_config_v1';

const DEFAULT_CONFIG: DriveIntegrationConfig = {
  sharedFolderUrl: 'https://drive.google.com',
  appsScriptWebhookUrl: '',
  driveFolderName: 'SIMPEL MI Al Ihsan Soborejo',
  autoUploadToDrive: false,
};

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

export const fileStorageService = {
  // Ambil Konfigurasi Integrasi Google Drive
  getConfig(): DriveIntegrationConfig {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch (err) {
      console.warn('Gagal membaca config Google Drive:', err);
    }
    return DEFAULT_CONFIG;
  },

  // Simpan Konfigurasi Integrasi Google Drive
  saveConfig(config: Partial<DriveIntegrationConfig>): DriveIntegrationConfig {
    const current = this.getConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
    return updated;
  },

  /**
   * Simpan Berkas Baru secara Mandiri ke IndexedDB
   * (Langsung tersimpan, bisa dibuka/diunduh kapan saja tanpa perlu Firebase)
   */
  async saveDocumentFile(options: {
    file: File;
    name?: string;
    category: string;
    description?: string;
    uploadedBy: string;
    googleDriveUrl?: string;
  }): Promise<StoredDocumentFile> {
    const db = await openDatabase();
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const dataUrl = await fileToDataUrl(options.file);

    let driveUrl = options.googleDriveUrl || '';

    // Jika pengguna mengonfigurasi Web App Google Apps Script, coba kirim ke Drive otomatis
    const config = this.getConfig();
    if (config.appsScriptWebhookUrl && !driveUrl) {
      try {
        const uploadResult = await this.uploadViaAppsScript(options.file, options.name || options.file.name);
        if (uploadResult?.url) {
          driveUrl = uploadResult.url;
        }
      } catch (err) {
        console.warn('Upload via Google Apps Script dilewati atau gagal:', err);
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
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(docRecord);

      req.onsuccess = () => resolve(docRecord);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Ambil Seluruh Berkas Tersimpan dari IndexedDB
   */
  async getAllFiles(): Promise<StoredDocumentFile[]> {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const results = (req.result || []) as StoredDocumentFile[];
          // Urutkan dari yang terbaru
          results.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
          resolve(results);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB getAllFiles error:', err);
      return [];
    }
  },

  /**
   * Hapus Berkas dari IndexedDB
   */
  async deleteFile(id: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Unduh Berkas secara Instan ke Komputer Pengguna
   */
  downloadStoredFile(file: StoredDocumentFile): void {
    if (!file.dataUrl) {
      if (file.googleDriveUrl) {
        window.open(file.googleDriveUrl, '_blank');
      } else {
        alert('Data berkas tidak tersedia.');
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
   * Kirim Berkas ke Google Apps Script Web App (Upload Langsung ke Google Drive tanpa Login/Firebase)
   */
  async uploadViaAppsScript(file: File, customName?: string): Promise<{ url: string; fileId?: string }> {
    const config = this.getConfig();
    if (!config.appsScriptWebhookUrl) {
      throw new Error('URL Google Apps Script belum dikonfigurasi di Pengaturan.');
    }

    const base64Data = await fileToDataUrl(file);
    const pureBase64 = base64Data.split(',')[1] || '';

    const payload = {
      filename: customName || file.name,
      mimeType: file.type || 'application/octet-stream',
      fileBase64: pureBase64,
      folderName: config.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo',
    };

    const response = await fetch(config.appsScriptWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Apps Script gagal merespons: ${err}`);
    }

    const result = await response.json();
    return {
      url: result.url || result.webViewLink || result.link,
      fileId: result.id || result.fileId,
    };
  },

  /**
   * Kode Google Apps Script siap pakai yang dapat disalin oleh Pengguna
   */
  getAppsScriptTemplateCode(): string {
    return `// ==============================================================
// SKRIP GOOGLE APPS SCRIPT UNTUK SIMPEL MI MA'ARIF AL IHSAN
// Paste skrip ini di https://script.google.com, lalu klik Deploy > New Deployment > Web App
// Setel "Who has access" ke: "Anyone"
// ==============================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var filename = data.filename || 'Dokumen_SIMPEL_' + new Date().getTime();
    var mimeType = data.mimeType || 'application/octet-stream';
    var decoded = Utilities.base64Decode(data.fileBase64);
    var blob = Utilities.newBlob(decoded, mimeType, filename);
    
    // Cari atau buat folder di Google Drive
    var folderName = data.folderName || 'SIMPEL MI Al Ihsan Soborejo';
    var folders = DriveApp.getFoldersByName(folderName);
    var targetFolder;
    if (folders.hasNext()) {
      targetFolder = folders.next();
    } else {
      targetFolder = DriveApp.createFolder(folderName);
    }
    
    // Simpan berkas ke Google Drive
    var file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var output = {
      status: 'success',
      id: file.getId(),
      url: file.getUrl(),
      name: file.getName()
    };
    
    return ContentService.createTextOutput(JSON.stringify(output))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
  },
};
