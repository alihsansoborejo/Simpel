import React, { useState } from 'react';
import { useGoogleDrive } from '../../context/GoogleDriveContext';
import { curriculumService } from '../../services/curriculumService';
import { useAuth } from '../../context/AuthContext';
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
  Plus,
} from 'lucide-react';

export const GoogleDriveStoragePage: React.FC = () => {
  const { user } = useAuth();
  const {
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
  } = useGoogleDrive();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customFileName, setCustomFileName] = useState<string>('');
  const [docCategory, setDocCategory] = useState<string>('Modul Ajar');
  const [fileDescription, setFileDescription] = useState<string>('');
  const [autoRegisterCurriculum, setAutoRegisterCurriculum] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!customFileName) {
        setCustomFileName(file.name);
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Pilih berkas yang ingin diunggah terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);

    try {
      const fileNameToUse = customFileName.trim() || selectedFile.name;
      const uploaded = await uploadFile(
        selectedFile,
        fileNameToUse,
        fileDescription || `Dokumen kategori ${docCategory} diunggah oleh ${user?.profile.full_name || 'Pengguna'}`,
        selectedFile.type
      );

      // Jika opsi daftarkan ke Dokumen Kurikulum diaktifkan
      if (autoRegisterCurriculum && uploaded.webViewLink) {
        await curriculumService.createDocument({
          teacher_id: user?.teacherId || 'tch-1',
          academic_year_id: 'ay-2026',
          semester_id: 'sem-ganjil-2026',
          class_id: 'cls-4',
          subject_id: 'sbj-ind',
          document_type: docCategory,
          title: fileNameToUse.replace(/\.[^/.]+$/, ''), // Hilangkan ekstensi
          google_drive_url: uploaded.webViewLink,
          file_id: uploaded.id,
          status: 'Draft',
          submission_date: null,
        });
      }

      setStatusMessage(
        `Berkas "${fileNameToUse}" berhasil diunggah ke folder Google Drive "SIMPEL MI Al Ihsan Soborejo"${
          autoRegisterCurriculum ? ' dan didaftarkan ke Dokumen Kurikulum' : ''
        }!`
      );

      // Reset form
      setSelectedFile(null);
      setCustomFileName('');
      setFileDescription('');
    } catch (err: any) {
      console.error('Gagal upload ke Drive:', err);
      setStatusMessage(`Gagal mengunggah berkas: ${err?.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyLink = (link?: string, id?: string) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedId(id || null);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return '-';
    const num = parseInt(bytes, 10);
    if (isNaN(num)) return '-';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-800" />
            <span>Penyimpanan Dokumen Google Drive</span>
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Integrasi cloud storage resmi untuk menyimpan dan mengunggah berkas administrasi, perangkat ajar, dan laporan madrasah secara langsung.
          </p>
        </div>

        {isConnected ? (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
            {googleUser?.photoURL ? (
              <img
                src={googleUser.photoURL}
                alt={googleUser.displayName || 'Google User'}
                className="w-7 h-7 rounded-full border border-emerald-400"
              />
            ) : (
              <ShieldCheck className="w-6 h-6 text-emerald-700" />
            )}
            <div className="text-left">
              <p className="text-xs font-semibold text-emerald-950 truncate max-w-[180px]">
                {googleUser?.displayName || 'Google Drive Terhubung'}
              </p>
              <p className="text-[10px] text-emerald-700 truncate max-w-[180px]">{googleUser?.email}</p>
            </div>
            <button
              onClick={disconnect}
              className="ml-2 text-xs text-rose-700 hover:text-rose-900 font-medium hover:underline cursor-pointer"
              title="Putuskan sambungan Google Drive"
            >
              Putuskan
            </button>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={isConnecting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg border border-slate-300 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 48 48">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            <span>{isConnecting ? 'Menghubungkan...' : 'Sambungkan Google Drive'}</span>
          </button>
        )}
      </div>

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

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 text-xs px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Informasi Folder Cloud */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl">
            <FolderSync className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-900">
              Folder Otomatis: <span className="text-emerald-800 font-bold">"SIMPEL MI Al Ihsan Soborejo"</span>
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Semua berkas yang diunggah melalui tombol simpan di aplikasi ini akan secara otomatis tersimpan di dalam folder khusus di Google Drive akun Anda. Hal ini menjamin file Anda tetap teratur, aman, dan dapat diakses kapan saja dari perangkat apa pun.
            </p>
          </div>
        </div>
      </div>

      {/* Card Upload Berkas Langsung */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-emerald-800" />
          <span>Unggah Berkas Baru ke Google Drive</span>
        </h2>

        {!isConnected ? (
          <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg p-6 bg-slate-50">
            <HardDrive className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Google Drive Belum Terhubung</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              Silakan hubungkan akun Google Drive Anda terlebih dahulu untuk mulai mengunggah perangkat pembelajaran, LKPD, dan dokumen madrasah langsung dari aplikasi.
            </p>
            <button
              onClick={connect}
              disabled={isConnecting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 48 48">
                <path d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isConnecting ? 'Menghubungkan...' : 'Hubungkan Akun Google Sekarang'}</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Berkas Komputer (PDF / Word / Excel / Gambar / dsb) *
                </label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  required
                  className="w-full text-xs text-slate-600 border border-slate-300 rounded-lg p-2 bg-slate-50 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-800 file:text-white hover:file:bg-emerald-900 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori Perangkat Pembelajaran
                </label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Berkas di Google Drive (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Modul Ajar IPAS Kelas 4 Bab 1.pdf"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi / Catatan Singkat
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Perangkat ajar semester ganjil tahun ajaran 2026/2027"
                  value={fileDescription}
                  onChange={(e) => setFileDescription(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="autoRegister"
                checked={autoRegisterCurriculum}
                onChange={(e) => setAutoRegisterCurriculum(e.target.checked)}
                className="w-4 h-4 text-emerald-800 rounded-sm border-slate-300 focus:ring-emerald-700 cursor-pointer"
              />
              <label htmlFor="autoRegister" className="text-xs text-slate-700 cursor-pointer">
                Otomatis daftarkan berkas ini ke <strong>Dokumen Kurikulum Madrasah</strong> agar siap ditelaah oleh Kepala Madrasah.
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{isUploading ? 'Sedang Mengunggah ke Google Drive...' : 'Unggah ke Google Drive Sekarang'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Tabel Berkas Tersimpan di Google Drive */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-800" />
              <span>Daftar Berkas di Google Drive Madrasah</span>
            </h2>
            <p className="text-[11px] text-slate-500">Berkas yang diunggah dan terhubung dengan aplikasi SIMPEL.</p>
          </div>

          {isConnected && (
            <button
              onClick={refreshFiles}
              disabled={isLoadingFiles}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-emerald-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          )}
        </div>

        {!isConnected ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Sambungkan Google Drive untuk melihat daftar berkas yang telah disimpan.
          </div>
        ) : isLoadingFiles ? (
          <div className="p-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-800" />
            <span>Memuat berkas dari Google Drive...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Belum ada berkas yang diunggah ke folder "SIMPEL MI Al Ihsan Soborejo". Gunakan form di atas untuk mengunggah berkas pertama Anda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Nama Berkas</th>
                  <th className="py-2.5 px-4 font-semibold">Tipe</th>
                  <th className="py-2.5 px-4 font-semibold">Ukuran</th>
                  <th className="py-2.5 px-4 font-semibold">Terakhir Diubah</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-800 shrink-0" />
                      <span className="truncate max-w-[260px]">{file.name}</span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px]">
                        {file.mimeType.split('/').pop()}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">{formatFileSize(file.size)}</td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {file.webViewLink && (
                          <>
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-medium text-[11px] transition-colors"
                            >
                              <span>Buka</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              onClick={() => handleCopyLink(file.webViewLink, file.id)}
                              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Salin Tautan Google Drive"
                            >
                              {copiedId === file.id ? (
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => deleteFile(file.id, file.name)}
                          className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Hapus dari Google Drive"
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
    </div>
  );
};
