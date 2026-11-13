import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { curriculumService } from '../../services/curriculumService';
import {
  fileStorageService,
  StoredDocumentFile,
  DriveIntegrationConfig,
} from '../../services/fileStorageService';
import { useGoogleDrive } from '../../context/GoogleDriveContext';
import {
  HardDrive,
  UploadCloud,
  FileText,
  ExternalLink,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  FolderSync,
  FileCheck,
  ShieldCheck,
  Copy,
  Download,
  Eye,
  Settings,
  HelpCircle,
  Code2,
  Share2,
} from 'lucide-react';

export const GoogleDriveStoragePage: React.FC = () => {
  const { user } = useAuth();
  const {
    isConnected: isFirebaseDriveConnected,
    isConnecting: isFirebaseConnecting,
    connect: connectFirebase,
    disconnect: disconnectFirebase,
    googleUser,
  } = useGoogleDrive();

  // Tab utama: 'upload', 'files', 'settings', 'script-guide'
  const [activeTab, setActiveTab] = useState<'upload' | 'files' | 'settings'>('upload');

  // Daftar berkas lokal IndexedDB
  const [storedFiles, setStoredFiles] = useState<StoredDocumentFile[]>([]);
  const [isLoadingStoredFiles, setIsLoadingStoredFiles] = useState<boolean>(true);

  // Form State Upload Langsung
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customFileName, setCustomFileName] = useState<string>('');
  const [docCategory, setDocCategory] = useState<string>('Modul Ajar');
  const [manualDriveUrl, setManualDriveUrl] = useState<string>('');
  const [fileDescription, setFileDescription] = useState<string>('');
  const [autoRegisterCurriculum, setAutoRegisterCurriculum] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pengaturan Integrasi
  const [driveConfig, setDriveConfig] = useState<DriveIntegrationConfig>(() =>
    fileStorageService.getConfig()
  );
  const [savedConfigNotice, setSavedConfigNotice] = useState<boolean>(false);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);

  // Muat berkas dari IndexedDB
  const loadStoredFiles = async () => {
    setIsLoadingStoredFiles(true);
    try {
      const files = await fileStorageService.getAllFiles();
      setStoredFiles(files);
    } catch (err) {
      console.warn('Gagal memuat berkas lokal:', err);
    } finally {
      setIsLoadingStoredFiles(false);
    }
  };

  useEffect(() => {
    loadStoredFiles();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!customFileName) {
        setCustomFileName(file.name);
      }
    }
  };

  // Simpan berkas langsung (Tanpa butuh Firebase Auth)
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Pilih berkas dari komputer atau HP Anda terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const finalFileName = customFileName.trim() || selectedFile.name;

      // 1. Simpan berkas ke penyimpanan mandiri (IndexedDB)
      const saved = await fileStorageService.saveDocumentFile({
        file: selectedFile,
        name: finalFileName,
        category: docCategory,
        description: fileDescription,
        uploadedBy: user?.profile.full_name || 'Ustadz/Ustadzah',
        googleDriveUrl: manualDriveUrl.trim() || undefined,
      });

      // 2. Jika opsi kurikulum dicentang, daftarkan otomatis ke Dokumen Kurikulum / Telaah
      if (autoRegisterCurriculum) {
        const driveLink = saved.googleDriveUrl || driveConfig.sharedFolderUrl || 'https://drive.google.com';
        await curriculumService.createDocument({
          teacher_id: user?.teacherId || 'tch-1',
          academic_year_id: 'ay-2026',
          semester_id: 'sem-ganjil-2026',
          class_id: 'cls-4',
          subject_id: 'sbj-ind',
          document_type: docCategory,
          title: finalFileName.replace(/\.[^/.]+$/, ''),
          google_drive_url: driveLink,
          file_id: saved.id,
          status: 'Draft',
          submission_date: null,
        });
      }

      setStatusMessage(
        `Berkas "${finalFileName}" berhasil disimpan dan langsung dapat diunduh, dilihat, atau ditelaah!`
      );

      // Reset form & reload data
      setSelectedFile(null);
      setCustomFileName('');
      setFileDescription('');
      setManualDriveUrl('');
      await loadStoredFiles();
      setActiveTab('files');
    } catch (err: any) {
      console.error('Error saat menyimpan berkas:', err);
      setErrorMessage(err?.message || 'Gagal menyimpan berkas.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    fileStorageService.saveConfig(driveConfig);
    setSavedConfigNotice(true);
    setTimeout(() => setSavedConfigNotice(false), 3000);
  };

  const handleDeleteFile = async (id: string, name: string) => {
    if (confirm(`Hapus berkas "${name}" dari penyimpanan aplikasi?`)) {
      await fileStorageService.deleteFile(id);
      await loadStoredFiles();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-800" />
            <span>Pusat Penyimpanan & Dokumen Madrasah</span>
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Unggah dan simpan berkas modul ajar, LKPD, dan perangkat pembelajaran secara langsung tanpa hambatan login.
          </p>
        </div>

        {/* Tautan Cepat Folder Google Drive Madrasah */}
        <div className="flex items-center gap-2">
          {driveConfig.sharedFolderUrl && (
            <a
              href={driveConfig.sharedFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold text-xs rounded-lg shadow-2xs transition-colors"
            >
              <FolderSync className="w-4 h-4 text-emerald-700" />
              <span>Buka Folder Drive Madrasah</span>
              <ExternalLink className="w-3 h-3 text-emerald-700" />
            </a>
          )}
        </div>
      </div>

      {/* Notifikasi Status */}
      {statusMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-700 hover:text-emerald-950 font-bold">
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 text-xs px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-950 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Tab Navigasi */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 gap-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('upload')}
          className={`py-2.5 px-4 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'upload'
              ? 'border-emerald-800 text-emerald-950 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>Unggah Berkas Baru</span>
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`py-2.5 px-4 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'files'
              ? 'border-emerald-800 text-emerald-950 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Daftar Berkas Tersimpan ({storedFiles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`py-2.5 px-4 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'settings'
              ? 'border-emerald-800 text-emerald-950 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Pengaturan Google Drive & Cloud</span>
        </button>
      </div>

      {/* Konten Tab 1: Unggah Berkas Baru */}
      {activeTab === 'upload' && (
        <div className="bg-white border border-slate-200 rounded-b-xl p-6 shadow-xs space-y-6">
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950 leading-relaxed">
              <p className="font-bold">Penyimpanan Berkas Mandiri & Siap Pakai Langsung</p>
              <p className="mt-0.5 text-emerald-800">
                Anda dapat memilih berkas dari perangkat (PDF, Word, Excel, Gambar) dan langsung mengunggahnya. Berkas akan langsung tersimpan di sistem, dapat dilihat, diunduh, dan otomatis tercatat untuk ditelaah oleh Kepala Madrasah tanpa memerlukan login popup Google/Firebase yang rumit.
              </p>
            </div>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pemilih Berkas */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Pilih Berkas Komputer/HP (PDF / Word / Excel / Gambar) *
                </label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  required
                  className="w-full text-xs text-slate-600 border border-slate-300 rounded-lg p-2.5 bg-slate-50 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-800 file:text-white hover:file:bg-emerald-900 cursor-pointer"
                />
                {selectedFile && (
                  <p className="text-[11px] text-slate-500">
                    Ukuran: {formatFileSize(selectedFile.size)} | Format: {selectedFile.type || 'Berkas dokumen'}
                  </p>
                )}
              </div>

              {/* Kategori Perangkat */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Kategori Perangkat Pembelajaran
                </label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  <option value="Modul Ajar">Modul Ajar / RPP Kurikulum Merdeka</option>
                  <option value="Capaian & Alur Tujuan">Capaian Pembelajaran (CP) / ATP</option>
                  <option value="LKPD & Bahan Ajar">Lembar Kerja Peserta Didik (LKPD)</option>
                  <option value="Kisi & Soal Asesmen">Kisi-kisi & Naskah Soal Asesmen</option>
                  <option value="Program Tahunan & Semester">Program Tahunan (Prota) & Promes</option>
                  <option value="Kriteria Ketercapaian">KKTP / Interval Nilai</option>
                  <option value="Lainnya">Dokumen Administrasi Lainnya</option>
                </select>
              </div>

              {/* Nama Berkas Kustom */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Nama Tampilan Dokumen
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Modul Ajar IPAS Kelas 4 Semester 1.pdf"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              {/* Tautan Google Drive Opsional */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Tautan Google Drive Tambahan (Opsional)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Boleh dikosongkan</span>
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                  value={manualDriveUrl}
                  onChange={(e) => setManualDriveUrl(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            </div>

            {/* Deskripsi */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Deskripsi / Catatan Singkat
              </label>
              <textarea
                rows={2}
                placeholder="Catatan perangkat ajar, materi pokok, atau instruksi pengerjaan..."
                value={fileDescription}
                onChange={(e) => setFileDescription(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            {/* Checkbox Otomatis daftarkan ke Telaah Kurikulum */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="autoRegCurriculum"
                checked={autoRegisterCurriculum}
                onChange={(e) => setAutoRegisterCurriculum(e.target.checked)}
                className="w-4 h-4 text-emerald-800 rounded-sm border-slate-300 focus:ring-emerald-700 cursor-pointer"
              />
              <label htmlFor="autoRegCurriculum" className="text-xs text-slate-700 cursor-pointer">
                Otomatis daftarkan berkas ini ke <strong>Dokumen Kurikulum Madrasah</strong> agar langsung siap ditelaah Kepala Madrasah.
              </label>
            </div>

            {/* Tombol Simpan */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{isUploading ? 'Menyimpan Berkas...' : 'Unggah & Simpan Berkas Sekarang'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Konten Tab 2: Daftar Berkas Tersimpan */}
      {activeTab === 'files' && (
        <div className="bg-white border border-slate-200 rounded-b-xl overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-800" />
                <span>Daftar Berkas Dokumen Tersimpan</span>
              </h2>
              <p className="text-[11px] text-slate-500">Berkas fisik yang tersimpan dan siap diunduh atau dipratinjau.</p>
            </div>

            <button
              onClick={loadStoredFiles}
              disabled={isLoadingStoredFiles}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-emerald-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStoredFiles ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>

          {isLoadingStoredFiles ? (
            <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-800" />
              <span>Memuat berkas tersimpan...</span>
            </div>
          ) : storedFiles.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs space-y-3">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">Belum ada berkas dokumen yang diunggah.</p>
              <p className="text-[11px] text-slate-400">
                Gunakan tab "Unggah Berkas Baru" untuk menyimpan modul ajar atau dokumen pertama Anda.
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-800 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-emerald-900"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Unggah Berkas Sekarang</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Nama Berkas</th>
                    <th className="py-2.5 px-4 font-semibold">Kategori</th>
                    <th className="py-2.5 px-4 font-semibold">Ukuran</th>
                    <th className="py-2.5 px-4 font-semibold">Pengunggah</th>
                    <th className="py-2.5 px-4 font-semibold">Waktu Unggah</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Aksi Dokumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {storedFiles.map((file) => (
                    <tr key={file.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-slate-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-800 shrink-0" />
                        <span className="truncate max-w-[260px]" title={file.name}>
                          {file.name}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-semibold text-[10px]">
                          {file.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">{formatFileSize(file.size)}</td>
                      <td className="py-2.5 px-4 text-slate-600">{file.uploadedBy}</td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(file.uploadedAt).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Pratinjau */}
                          <button
                            onClick={() => fileStorageService.previewStoredFile(file)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-[11px] transition-colors cursor-pointer"
                            title="Pratinjau Berkas"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Lihat</span>
                          </button>

                          {/* Unduh Berkas Fisik */}
                          <button
                            onClick={() => fileStorageService.downloadStoredFile(file)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-medium text-[11px] transition-colors cursor-pointer"
                            title="Unduh Berkas ke Laptop/HP"
                          >
                            <Download className="w-3 h-3" />
                            <span>Unduh</span>
                          </button>

                          {/* Buka Tautan Drive Jika Ada */}
                          {file.googleDriveUrl && (
                            <a
                              href={file.googleDriveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded transition-colors"
                              title="Buka Tautan Google Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Hapus */}
                          <button
                            onClick={() => handleDeleteFile(file.id, file.name)}
                            className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Hapus Berkas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Konten Tab 3: Pengaturan Integrasi Google Drive & Cloud */}
      {activeTab === 'settings' && (
        <div className="bg-white border border-slate-200 rounded-b-xl p-6 shadow-xs space-y-6">
          <div className="max-w-2xl">
            <h2 className="text-sm font-bold text-slate-900 mb-1">Pengaturan Folder & Integrasi Google Drive Madrasah</h2>
            <p className="text-xs text-slate-600 mb-4">
              Konfigurasikan folder Google Drive resmi madrasah agar seluruh guru dapat mengakses folder arsip bersama dengan mudah.
            </p>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tautan Folder Google Drive Utama Madrasah
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoP..."
                  value={driveConfig.sharedFolderUrl}
                  onChange={(e) => setDriveConfig({ ...driveConfig, sharedFolderUrl: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Masukkan tautan Folder Google Drive madrasah Anda. Tombol "Buka Folder Drive Madrasah" di bagian atas aplikasi akan langsung mengarahkan guru ke folder ini.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Folder Madrasah di Google Drive
                </label>
                <input
                  type="text"
                  value={driveConfig.driveFolderName}
                  onChange={(e) => setDriveConfig({ ...driveConfig, driveFolderName: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              {/* Opsi Web App Google Apps Script (Upload Otomatis ke Drive tanpa Firebase) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-emerald-800" />
                    <span>Upload Otomatis via Google Apps Script (Tanpa Login Popup)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowScriptModal(true)}
                    className="text-[11px] font-semibold text-emerald-800 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Lihat Skrip Siap Pakai</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Jika Anda ingin setiap file yang diunggah otomatis masuk ke Google Drive madrasah tanpa login popup atau Firebase, Anda cukup membuat 1 skrip Web App Google Apps Script di Google Drive Anda.
                </p>

                <div>
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    value={driveConfig.appsScriptWebhookUrl}
                    onChange={(e) => setDriveConfig({ ...driveConfig, appsScriptWebhookUrl: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Biarkan kosong jika hanya ingin menggunakan penyimpanan langsung aplikasi.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Simpan Pengaturan
                </button>

                {savedConfigNotice && (
                  <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Pengaturan berhasil disimpan!</span>
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Panduan Skrip Google Apps Script */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-800" />
                <span>Skrip Google Apps Script Siap Pakai</span>
              </h3>
              <button
                onClick={() => setShowScriptModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              Skrip ini memungkinkan aplikasi mengirim berkas langsung ke Google Drive madrasah tanpa login popup atau Firebase.
            </p>

            <div className="bg-slate-900 text-slate-200 p-3 rounded-lg text-[11px] font-mono overflow-x-auto relative mb-4">
              <pre>{fileStorageService.getAppsScriptTemplateCode()}</pre>
              <button
                onClick={() => handleCopy(fileStorageService.getAppsScriptTemplateCode(), 'script-code')}
                className="absolute top-2 right-2 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                {copiedId === 'script-code' ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Salin Skrip</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <p className="font-bold text-slate-900">Cara Pasang (Hanya 1 Menit):</p>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600">
                <li>Buka <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-emerald-800 font-bold underline">script.google.com</a> dan buat <strong>New Project</strong>.</li>
                <li>Hapus kode bawaan dan tempel kode skrip di atas.</li>
                <li>Klik tombol <strong>Deploy &gt; New deployment</strong>.</li>
                <li>Pilih tipe <strong>Web app</strong>. Pada bagian <em>Who has access</em>, pilih <strong>Anyone</strong>.</li>
                <li>Salin <strong>Web App URL</strong> yang dihasilkan dan tempel di formulir Pengaturan di atas.</li>
              </ol>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setShowScriptModal(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
