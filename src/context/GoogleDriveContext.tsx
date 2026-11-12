import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  initGoogleDriveAuth,
  connectGoogleDrive,
  disconnectGoogleDrive,
  uploadFileToGoogleDrive,
  listGoogleDriveFiles,
  deleteGoogleDriveFile,
  getDriveAccessToken,
  DriveFileInfo,
} from '../services/googleDriveService';

interface GoogleDriveContextType {
  isConnected: boolean;
  isConnecting: boolean;
  googleUser: FirebaseUser | null;
  error: string | null;
  files: DriveFileInfo[];
  isLoadingFiles: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  uploadFile: (file: File | Blob, fileName: string, description?: string, mimeType?: string) => Promise<DriveFileInfo>;
  refreshFiles: () => Promise<void>;
  deleteFile: (id: string, name: string) => Promise<void>;
}

const GoogleDriveContext = createContext<GoogleDriveContextType | undefined>(undefined);

export const GoogleDriveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFileInfo[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);

  const refreshFiles = useCallback(async () => {
    const token = await getDriveAccessToken();
    if (!token) {
      setFiles([]);
      return;
    }
    setIsLoadingFiles(true);
    try {
      const driveFiles = await listGoogleDriveFiles();
      setFiles(driveFiles);
      setError(null);
    } catch (err: any) {
      console.warn('Gagal memuat berkas Google Drive:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = initGoogleDriveAuth(
      (user) => {
        setGoogleUser(user);
        setIsConnected(true);
        refreshFiles();
      },
      () => {
        setGoogleUser(null);
        setIsConnected(false);
        setFiles([]);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [refreshFiles]);

  const connect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const { user } = await connectGoogleDrive();
      setGoogleUser(user);
      setIsConnected(true);
      await refreshFiles();
    } catch (err: any) {
      const msg = err?.message || 'Gagal menyambungkan Google Drive';
      setError(msg);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await disconnectGoogleDrive();
      setGoogleUser(null);
      setIsConnected(false);
      setFiles([]);
      setError(null);
    } catch (err: any) {
      console.error('Error saat memutuskan Google Drive:', err);
    }
  };

  const uploadFile = async (
    file: File | Blob,
    fileName: string,
    description?: string,
    mimeType?: string
  ): Promise<DriveFileInfo> => {
    if (!isConnected) {
      throw new Error('Google Drive belum terhubung. Silakan sambungkan akun Google Drive terlebih dahulu.');
    }
    try {
      const uploaded = await uploadFileToGoogleDrive({
        file,
        fileName,
        description,
        mimeType,
      });
      await refreshFiles();
      return uploaded;
    } catch (err: any) {
      setError(err?.message || 'Gagal mengunggah berkas');
      throw err;
    }
  };

  const deleteFile = async (id: string, name: string) => {
    try {
      await deleteGoogleDriveFile(id, name);
      await refreshFiles();
    } catch (err: any) {
      setError(err?.message || 'Gagal menghapus berkas');
      throw err;
    }
  };

  return (
    <GoogleDriveContext.Provider
      value={{
        isConnected,
        isConnecting,
        googleUser,
        error,
        files,
        isLoadingFiles,
        connect,
        disconnect,
        uploadFile,
        refreshFiles,
        deleteFile,
      }}
    >
      {children}
    </GoogleDriveContext.Provider>
  );
};

export const useGoogleDrive = () => {
  const context = useContext(GoogleDriveContext);
  if (!context) {
    throw new Error('useGoogleDrive harus digunakan di dalam GoogleDriveProvider');
  }
  return context;
};
