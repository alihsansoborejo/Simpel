import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Inisialisasi Firebase App secara aman (singleton)
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(firebaseApp);

export const GOOGLE_DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const provider = new GoogleAuthProvider();
GOOGLE_DRIVE_SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

// Cache token di memori aplikasi (tidak disimpan di localStorage sesuai aturan keamanan)
let cachedAccessToken: string | null = null;
let isSigningIn = false;
let currentGoogleUser: FirebaseUser | null = null;

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
}

export interface DriveFolderInfo {
  id: string;
  name: string;
}

// Inisialisasi listener status login Google
export const initGoogleDriveAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(firebaseAuth, async (user: FirebaseUser | null) => {
    currentGoogleUser = user;
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Hubungkan Google Drive melalui Pop-up Google Sign-In
export const connectGoogleDrive = async (): Promise<{ user: FirebaseUser; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(firebaseAuth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google. Pastikan izin akses diberikan.');
    }

    cachedAccessToken = credential.accessToken;
    currentGoogleUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Error menghubungkan Google Drive:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Ambil Access Token dari memori
export const getDriveAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// Cek apakah Google Drive sedang terhubung
export const isGoogleDriveConnected = (): boolean => {
  return !!cachedAccessToken && !!currentGoogleUser;
};

// Ambil informasi pengguna Google yang sedang aktif
export const getConnectedGoogleUser = (): FirebaseUser | null => {
  return currentGoogleUser;
};

// Putuskan koneksi Google Drive
export const disconnectGoogleDrive = async (): Promise<void> => {
  await signOut(firebaseAuth);
  cachedAccessToken = null;
  currentGoogleUser = null;
};

/**
 * Mencari atau membuat folder khusus di Google Drive pengguna
 * sehingga seluruh dokumen madrasah tersimpan rapi dalam satu folder
 */
export const getOrCreateAppFolder = async (
  folderName = 'SIMPEL MI Al Ihsan Soborejo'
): Promise<string> => {
  const token = await getDriveAccessToken();
  if (!token) throw new Error('Google Drive belum terhubung. Silakan sambungkan akun Google Drive terlebih dahulu.');

  // 1. Cari apakah folder sudah ada
  const query = encodeURIComponent(
    `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Gagal mencari folder di Google Drive: ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 2. Buat folder baru jika belum ada
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Folder resmi dokumen pembelajaran dan administrasi SIMPEL MI Ma’arif Al Ihsan Soborejo',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Gagal membuat folder di Google Drive: ${errText}`);
  }

  const createdFolder = await createRes.json();
  return createdFolder.id;
};

/**
 * Upload berkas File / Blob langsung ke Google Drive
 */
export const uploadFileToGoogleDrive = async (options: {
  file: File | Blob;
  fileName: string;
  mimeType?: string;
  description?: string;
  folderId?: string;
}): Promise<DriveFileInfo> => {
  const token = await getDriveAccessToken();
  if (!token) throw new Error('Google Drive belum terhubung. Silakan sambungkan akun Google Drive terlebih dahulu.');

  // Jika folderId tidak ditentukan, gunakan atau buat folder resmi SIMPEL
  const targetFolderId = options.folderId || (await getOrCreateAppFolder());

  const metadata = {
    name: options.fileName,
    description: options.description || 'Diunggah dari Sistem Informasi Manajemen Pembelajaran & Administrasi (SIMPEL) MI Ma’arif Al Ihsan Soborejo',
    parents: [targetFolderId],
    mimeType: options.mimeType || options.file.type || 'application/octet-stream',
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const reader = new FileReader();
  const fileDataPromise = new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(options.file);
  });

  const fileData = await fileDataPromise;

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}`;
  const mediaHeader = `${delimiter}Content-Type: ${metadata.mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`;

  // Encode ArrayBuffer ke base64
  let binary = '';
  const bytes = new Uint8Array(fileData);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data = btoa(binary);

  const multipartBody = `${metadataPart}${mediaHeader}${base64Data}${closeDelimiter}`;

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size,createdTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Gagal mengunggah berkas ke Google Drive: ${errText}`);
  }

  const uploadedFile: DriveFileInfo = await uploadRes.json();
  return uploadedFile;
};

/**
 * Ambil daftar berkas yang tersimpan di folder SIMPEL Google Drive
 */
export const listGoogleDriveFiles = async (folderId?: string): Promise<DriveFileInfo[]> => {
  const token = await getDriveAccessToken();
  if (!token) throw new Error('Google Drive belum terhubung.');

  const targetFolderId = folderId || (await getOrCreateAppFolder());
  const query = encodeURIComponent(`'${targetFolderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,webViewLink,webContentLink,size,createdTime,modifiedTime)&pageSize=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal memuat daftar berkas dari Google Drive: ${errText}`);
  }

  const data = await res.json();
  return data.files || [];
};

/**
 * Hapus berkas dari Google Drive dengan konfirmasi pengguna eksplisit (Wajib sesuai Workspace Guidelines)
 */
export const deleteGoogleDriveFile = async (fileId: string, fileName: string): Promise<void> => {
  const token = await getDriveAccessToken();
  if (!token) throw new Error('Google Drive belum terhubung.');

  const confirmed = window.confirm(
    `Apakah Anda yakin ingin menghapus berkas "${fileName}" dari Google Drive madrasah? Tindakan ini tidak dapat dibatalkan.`
  );
  if (!confirmed) return;

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 204) {
    const errText = await res.text();
    throw new Error(`Gagal menghapus berkas dari Google Drive: ${errText}`);
  }
};
