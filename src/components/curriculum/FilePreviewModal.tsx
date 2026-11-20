import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StoredDocumentFile,
  extractDriveFileIdFromUrl,
  fileStorageService,
  isRealDriveFileUrl,
} from '../../services/fileStorageService';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  FolderSync,
  Image as ImageIcon,
  RefreshCw,
  X,
} from 'lucide-react';

interface FilePreviewBodyProps {
  file: StoredDocumentFile;
  driveUploadError?: string;
  onFileUpdated?: (updated: StoredDocumentFile) => void;
  compact?: boolean;
  fullWindow?: boolean;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function decodeDataUrlToUint8Array(dataUrl: string): Uint8Array<ArrayBuffer> | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const base64 = parts[1];
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export const FilePreviewContent: React.FC<FilePreviewBodyProps> = ({
  file,
  driveUploadError,
  onFileUpdated,
  compact = false,
  fullWindow = false,
}) => {
  const [currentFile, setCurrentFile] = useState<StoredDocumentFile>(file);
  const [isAutoSyncingDrive, setIsAutoSyncingDrive] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(driveUploadError || file.driveUploadError || null);
  const [retrySuccessMsg, setRetrySuccessMsg] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const autoTriedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setCurrentFile(file);
    setRetryError(driveUploadError || file.driveUploadError || null);
    setRetrySuccessMsg(null);
  }, [file, driveUploadError]);

  const lowerName = (currentFile.name || '').toLowerCase();
  const mime = (currentFile.mimeType || '').toLowerCase();
  const isPdf = mime.includes('pdf') || lowerName.endsWith('.pdf');
  const isImage =
    mime.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lowerName);
  const isText =
    mime.startsWith('text/') ||
    mime.includes('csv') ||
    mime.includes('json') ||
    /\.(txt|csv|md|json)$/i.test(lowerName);
  const isOffice =
    /\.(docx?|xlsx?|pptx?)$/i.test(lowerName) ||
    mime.includes('wordprocessingml') ||
    mime.includes('spreadsheetml') ||
    mime.includes('presentationml') ||
    mime.includes('msword') ||
    mime.includes('ms-excel') ||
    mime.includes('ms-powerpoint');

  const driveFileId =
    currentFile.driveFileId || extractDriveFileIdFromUrl(currentFile.googleDriveUrl);
  const hasRealDriveLink = isRealDriveFileUrl(currentFile.googleDriveUrl) || Boolean(driveFileId);
  const resolvedDriveUrl =
    currentFile.googleDriveUrl && isRealDriveFileUrl(currentFile.googleDriveUrl)
      ? currentFile.googleDriveUrl
      : driveFileId
      ? `https://drive.google.com/file/d/${driveFileId}/view`
      : '';
  const drivePreviewIframeUrl = driveFileId
    ? `https://drive.google.com/file/d/${driveFileId}/preview`
    : '';

  useEffect(() => {
    if (!currentFile.dataUrl || (!isPdf && !isImage)) {
      setBlobUrl(null);
      return;
    }

    const bytes = decodeDataUrlToUint8Array(currentFile.dataUrl);
    if (!bytes) {
      setBlobUrl(currentFile.dataUrl);
      return;
    }

    const blob = new Blob([bytes], {
      type: currentFile.mimeType || (isPdf ? 'application/pdf' : 'image/png'),
    });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [currentFile.dataUrl, currentFile.mimeType, isPdf, isImage]);

  const decodedText = useMemo(() => {
    if (!isText || !currentFile.dataUrl) return null;
    const bytes = decodeDataUrlToUint8Array(currentFile.dataUrl);
    if (!bytes) return null;
    try {
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return null;
    }
  }, [isText, currentFile.dataUrl]);

  const driveConfig = fileStorageService.getConfig();
  const driveStatus = fileStorageService.getDriveStatusInfo(driveConfig);

  // Kirim otomatis ke Google Drive saat pratinjau dibuka bila berkas belum punya tautan Drive dan Apps Script sehat (tanpa tombol manual)
  useEffect(() => {
    if (
      hasRealDriveLink ||
      !currentFile.dataUrl ||
      driveUploadError ||
      currentFile.driveUploadError ||
      !driveStatus.isHealthy ||
      autoTriedIdsRef.current.has(currentFile.id)
    ) {
      return;
    }

    autoTriedIdsRef.current.add(currentFile.id);
    let cancelled = false;
    setIsAutoSyncingDrive(true);
    setRetryError(null);

    void fileStorageService
      .retryDriveUpload(currentFile)
      .then(({ updated }) => {
        if (cancelled) return;
        setCurrentFile(updated);
        setRetrySuccessMsg(
          `Otomatis terkirim ke Google Drive (${updated.folderPath || 'Folder SIMPEL'})!`
        );
        onFileUpdated?.(updated);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setRetryError(err?.message || 'Sinkronisasi otomatis ke Google Drive gagal.');
      })
      .finally(() => {
        if (!cancelled) setIsAutoSyncingDrive(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentFile, hasRealDriveLink, driveUploadError, driveStatus.isHealthy, onFileUpdated]);
  const previewFrameHeight = fullWindow
    ? 'flex-1 min-h-0 h-full'
    : compact
    ? 'h-[360px]'
    : 'h-[58vh] min-h-[360px]';

  return (
    <div className={fullWindow ? 'flex flex-col flex-1 min-h-0 h-full gap-3' : 'space-y-3.5'}>
      {/* Banner Status Penyimpanan Google Drive */}
      {hasRealDriveLink ? (
        <div
          className={`${
            fullWindow ? 'shrink-0 ' : ''
          }p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-xs min-w-0">
              <p className="font-bold text-emerald-950">
                {retrySuccessMsg ||
                  `Tersimpan di Google Drive (${driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'})`}
              </p>
              {currentFile.folderPath && (
                <p className="text-[11px] font-mono text-emerald-800 truncate mt-0.5" title={currentFile.folderPath}>
                  Folder: {currentFile.folderPath}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {currentFile.folderUrl && (
              <a
                href={currentFile.folderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-[11px] font-semibold"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Folder Drive</span>
              </a>
            )}
            {resolvedDriveUrl && (
              <a
                href={resolvedDriveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold"
              >
                <FolderSync className="w-3.5 h-3.5" />
                <span>Buka di Google Drive</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      ) : isAutoSyncingDrive ? (
        <div
          className={`${
            fullWindow ? 'shrink-0 ' : ''
          }p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5`}
        >
          <RefreshCw className="w-4 h-4 text-emerald-700 shrink-0 animate-spin" />
          <div className="text-xs">
            <p className="font-bold text-emerald-950">Mengirim otomatis ke Google Drive Madrasah...</p>
            <p className="text-[11px] text-emerald-800">
              Dokumen sedang disinkronkan langsung ke {driveStatus.ownerEmail} tanpa login.
            </p>
          </div>
        </div>
      ) : (
        <div
          className={`${
            fullWindow ? 'shrink-0 ' : ''
          }p-3 rounded-xl ${
            retryError || driveStatus.isError
              ? 'bg-rose-50 border border-rose-200'
              : 'bg-amber-50 border border-amber-300'
          } flex items-start gap-2.5`}
        >
          <AlertCircle
            className={`w-4 h-4 shrink-0 mt-0.5 ${
              retryError || driveStatus.isError ? 'text-rose-700' : 'text-amber-700'
            }`}
          />
          <div className="text-xs min-w-0">
            <p
              className={`font-bold ${
                retryError || driveStatus.isError ? 'text-rose-950' : 'text-amber-950'
              }`}
            >
              {retryError || driveStatus.isError
                ? 'Dokumen tersimpan di perangkat/arsip aplikasi, namun pengiriman otomatis ke Google Drive gagal'
                : 'Berkas tersimpan di arsip aplikasi, Google Drive Madrasah belum terhubung'}
            </p>
            <p
              className={`text-[11px] mt-0.5 ${
                retryError || driveStatus.isError ? 'text-rose-900' : 'text-amber-900'
              }`}
            >
              {retryError ||
                driveStatus.errorMessage ||
                'Admin Madrasah perlu mengaktifkan & menguji URL Web App Google Apps Script (dari akun @gmail.com, akses "Anyone") di menu Penyimpanan Google Drive agar setiap unggahan otomatis terkirim ke Drive tanpa login.'}
            </p>
          </div>
        </div>
      )}

      {/* Metadata Singkat Berkas */}
      <div
        className={`${
          fullWindow ? 'shrink-0 ' : ''
        }flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold">
            {currentFile.category || 'Dokumen'}
          </span>
          <span className="font-semibold text-slate-800">{currentFile.name}</span>
          <span>·</span>
          <span>{formatBytes(currentFile.size)}</span>
          {currentFile.uploadedBy && (
            <>
              <span>·</span>
              <span>Oleh: {currentFile.uploadedBy}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileStorageService.downloadStoredFile(currentFile)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-300 hover:border-emerald-400 text-emerald-900 font-semibold cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Unduh Berkas</span>
        </button>
      </div>

      {/* Area Pratinjau Visual Berkas */}
      <div
        className={`rounded-xl border border-slate-200 bg-slate-100/70 overflow-hidden ${
          fullWindow ? 'flex-1 min-h-0 flex flex-col' : ''
        }`}
      >
        {isImage && (blobUrl || currentFile.dataUrl) ? (
          <div
            className={`p-4 flex items-center justify-center bg-slate-900/5 overflow-auto ${
              fullWindow ? 'flex-1 min-h-0 h-full' : 'max-h-[60vh]'
            }`}
          >
            <img
              src={blobUrl || currentFile.dataUrl}
              alt={currentFile.name}
              className={`${
                fullWindow ? 'max-h-full max-w-full' : 'max-h-[54vh] max-w-full'
              } rounded-lg shadow-sm object-contain bg-white`}
            />
          </div>
        ) : isPdf && blobUrl ? (
          <iframe
            src={blobUrl}
            title={`Pratinjau ${currentFile.name}`}
            className={`w-full ${previewFrameHeight} bg-white border-0`}
          />
        ) : isText && decodedText !== null ? (
          <pre
            className={`p-4 text-xs font-mono text-slate-800 bg-white overflow-auto whitespace-pre-wrap leading-relaxed ${
              fullWindow ? 'flex-1 min-h-0 h-full' : 'max-h-[55vh]'
            }`}
          >
            {decodedText}
          </pre>
        ) : drivePreviewIframeUrl ? (
          <div className={`bg-white ${fullWindow ? 'flex-1 min-h-0 flex flex-col h-full' : ''}`}>
            <div className="px-3 py-1.5 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between text-[11px] text-emerald-900 shrink-0">
              <span className="flex items-center gap-1.5 font-semibold">
                <Eye className="w-3.5 h-3.5 text-emerald-700" />
                <span>Pratinjau Dokumen via Google Drive</span>
              </span>
              {resolvedDriveUrl && (
                <a
                  href={resolvedDriveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline hover:text-amber-700 inline-flex items-center gap-1"
                >
                  <span>Buka Tab Penuh</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <iframe
              src={drivePreviewIframeUrl}
              title={`Pratinjau Drive ${currentFile.name}`}
              className={`w-full ${previewFrameHeight} border-0 bg-white`}
              allow="autoplay"
            />
          </div>
        ) : (
          <div
            className={`p-8 text-center bg-white space-y-3 ${
              fullWindow ? 'flex-1 min-h-0 flex flex-col items-center justify-center' : ''
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
              {isOffice ? (
                <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
              ) : isImage ? (
                <ImageIcon className="w-6 h-6 text-amber-600" />
              ) : (
                <FileText className="w-6 h-6 text-emerald-700" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">{currentFile.name}</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                {isOffice
                  ? 'Pratinjau langsung dokumen Word/Excel/PowerPoint di browser memerlukan berkas tersinkron ke Google Drive. Anda tetap dapat langsung mengunduh berkas fisiknya.'
                  : 'Pratinjau langsung tidak tersedia untuk format berkas ini. Silakan unduh berkas atau buka tautan Google Drive.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileStorageService.downloadStoredFile(currentFile)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Berkas ({formatBytes(currentFile.size)})</span>
              </button>
              {resolvedDriveUrl && (
                <a
                  href={resolvedDriveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-emerald-950 text-xs font-bold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka di Drive</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface FilePreviewModalProps {
  isOpen: boolean;
  file: StoredDocumentFile | null;
  title?: string;
  driveUploadError?: string;
  onClose: () => void;
  onFileUpdated?: (updated: StoredDocumentFile) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  file,
  title,
  driveUploadError,
  onClose,
  onFileUpdated,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen bg-white flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-emerald-900 text-amber-300 shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">
              {title || `Pratinjau Berkas: ${file.name}`}
            </h3>
            <p className="text-[11px] text-slate-500 truncate">
              {file.description || file.category || 'Arsip Dokumen SIMPEL MI Al Ihsan Soborejo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
          >
            Tutup Pratinjau
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Tutup pratinjau"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-3 sm:p-5 flex flex-col overflow-hidden bg-slate-50/50">
        <FilePreviewContent
          file={file}
          driveUploadError={driveUploadError}
          onFileUpdated={onFileUpdated}
          fullWindow
        />
      </div>
    </div>
  );
};
