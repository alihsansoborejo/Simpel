import React, { useState, useEffect, useCallback } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { academicService } from '../../services/academicService';
import {
  DocumentLink,
  DocumentStatus,
  DocumentReview,
  ClassRoom,
  Subject,
  Teacher,
} from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useGoogleDrive } from '../../context/GoogleDriveContext';
import { fileStorageService, StoredDocumentFile, isRealDriveFileUrl } from '../../services/fileStorageService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import {
  DriveDocumentUploadModal,
  CURRICULUM_DOC_TYPES,
} from '../../components/curriculum/DriveDocumentUploadModal';
import { FilePreviewModal } from '../../components/curriculum/FilePreviewModal';
import {
  FolderSync,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  MessageSquare,
  Search,
  UploadCloud,
  HardDrive,
  Eye,
  Download,
  Trash2,
} from 'lucide-react';

export const CurriculumDocsPage: React.FC = () => {
  const { user, activeRole } = useAuth();
  const { selectedSubjectId, selectedClassId } = useWorkspace();
  const [documents, setDocuments] = useState<DocumentLink[]>([]);
  const [reviews, setReviews] = useState<DocumentReview[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [resolvedTeacher, setResolvedTeacher] = useState<Teacher | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentLink | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'Disetujui' | 'Perlu Revisi'>('Disetujui');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<DocumentLink | null>(null);
  const [previewDocState, setPreviewDocState] = useState<{
    file: StoredDocumentFile;
    docId?: string;
  } | null>(null);

  // Google Drive Context
  const { isConnected, isConnecting, connect, googleUser } = useGoogleDrive();

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const loadDocs = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, revs, clss, sbjs, teacher] = await Promise.all([
        curriculumService.getDocuments(),
        curriculumService.getAllReviews(),
        academicService.getClasses(),
        academicService.getSubjects(),
        academicService.resolveTeacherForUser(user),
      ]);
      setDocuments(data);
      setReviews(revs);
      setClasses(clss);
      setSubjects(sbjs);
      setResolvedTeacher(teacher);
    } catch (err) {
      console.error('Gagal memuat dokumen kurikulum:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadDocs();
    void fileStorageService.hydrateConfigFromServer();
  }, [loadDocs]);

  useRealtimeSync(
    [
      'simpel_curriculum_documents',
      'simpel_curriculum_reviews',
      'simpel_assignments',
      'simpel_classes',
      'simpel_subjects',
      'simpel_drive_storage_config_v1',
    ],
    () => {
      void loadDocs();
    },
    true
  );

  const handleSubmitForReview = async (id: string, docTitle: string) => {
    try {
      await curriculumService.submitDocument(id);
      notify(`Dokumen "${docTitle}" telah diajukan ke Kepala Madrasah untuk ditelaah.`);
      void loadDocs();
    } catch (err) {
      console.error('Gagal mengajukan dokumen:', err);
      notify('Gagal mengajukan dokumen ke Kepala Madrasah.', 'error');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    try {
      await curriculumService.reviewDocument(
        selectedDoc.id,
        reviewDecision,
        reviewNotes,
        user?.id || 'usr-kamad'
      );
      setShowReviewModal(false);
      notify(`Telaah dokumen selesai: Status diperbarui menjadi "${reviewDecision}".`);
      void loadDocs();
    } catch (err) {
      console.error('Gagal mereview dokumen:', err);
      notify('Gagal menyimpan hasil telaah dokumen.', 'error');
    }
  };

  const handlePreviewStoredFile = async (doc: DocumentLink) => {
    let stored = doc.file_id ? await fileStorageService.getFileById(doc.file_id) : null;
    if (!stored && doc.google_drive_url && isRealDriveFileUrl(doc.google_drive_url)) {
      stored = {
        id: doc.file_id || doc.id,
        name: doc.title,
        size: 0,
        mimeType: 'application/pdf',
        category: doc.document_type,
        uploadedBy: doc.teacher?.full_name || 'Guru Madrasah',
        uploadedAt: doc.created_at || new Date().toISOString(),
        googleDriveUrl: doc.google_drive_url,
      };
    }
    if (!stored) {
      notify('Berkas fisik tidak ditemukan di penyimpanan lokal perangkat ini. Silakan buka via tautan Google Drive.', 'error');
      return;
    }
    setPreviewDocState({ file: stored, docId: doc.id });
  };

  const handleDownloadStoredFile = async (doc: DocumentLink) => {
    if (!doc.file_id) return;
    const stored = await fileStorageService.getFileById(doc.file_id);
    if (!stored) {
      notify('Berkas fisik tidak ditemukan di penyimpanan lokal perangkat ini. Silakan unduh melalui Google Drive.', 'error');
      return;
    }
    fileStorageService.downloadStoredFile(stored);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteDoc) return;
    try {
      if (pendingDeleteDoc.file_id) {
        await fileStorageService.deleteFile(pendingDeleteDoc.file_id);
      }
      await curriculumService.deleteDocument(pendingDeleteDoc.id);
      notify(`Dokumen "${pendingDeleteDoc.title}" berhasil dihapus dari daftar arsip.`);
      setPendingDeleteDoc(null);
      void loadDocs();
    } catch (err) {
      console.error('Gagal menghapus dokumen:', err);
      notify('Gagal menghapus dokumen.', 'error');
    }
  };

  const filteredDocs = documents.filter((d) => {
    if (activeRole === 'guru') {
      const teacherId = resolvedTeacher?.id || user?.teacherId || user?.id;
      if (!teacherId) return false;
      if (d.teacher_id !== teacherId && d.teacher?.id !== teacherId) return false;
    }
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (typeFilter !== 'all' && d.document_type !== typeFilter) return false;
    if (searchTerm && !d.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case 'Disetujui':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            <span>Disetujui</span>
          </span>
        );
      case 'Diajukan':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Diajukan</span>
          </span>
        );
      case 'Perlu Revisi':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>Perlu Revisi</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            <span>Draf</span>
          </span>
        );
    }
  };

  const driveConfig = fileStorageService.getConfig();
  const driveStatus = fileStorageService.getDriveStatusInfo(driveConfig);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Arsip Dokumen Kurikulum (Google Drive)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Unggah &amp; arsipkan Modul Ajar, CP, TP, ATP, Prota, Promes, LKPD, dan Naskah Soal ke Google Drive ({driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'}) tanpa login.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {driveStatus.isHealthy ? (
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold">
                Drive Aktif ({driveStatus.ownerEmail} · Tanpa Login)
              </span>
            </div>
          ) : driveStatus.isError ? (
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900"
              title={driveStatus.errorMessage}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="font-semibold">Drive Perlu Perbaikan (Apps Script)</span>
            </div>
          ) : isConnected ? (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium truncate max-w-[150px]">{googleUser?.email}</span>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-300 hover:bg-emerald-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5 text-amber-600" />
              <span>{isConnecting ? 'Menghubungkan...' : 'Sambungkan Google Drive'}</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 text-emerald-950 text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Unggah Dokumen ke Drive</span>
          </button>
        </div>
      </div>

      {/* Panduan Google Drive Institusi */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-900 text-amber-300 rounded-lg shrink-0 mt-0.5">
            <FolderSync className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-emerald-950">
              Penyimpanan Langsung: Folder &ldquo;{driveConfig.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo'}&rdquo; ({driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'})
            </h4>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              Setiap dokumen (Modul Ajar, CP, TP, LKPD, Naskah Soal, Kisi-Kisi) yang diunggah dari perangkat mana pun otomatis masuk ke Google Drive {driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'} tanpa login dan dikirim ke Dashboard Kepala Madrasah.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={driveConfig.sharedFolderUrl || 'https://drive.google.com'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 hover:border-amber-400 text-emerald-900 rounded-lg text-xs font-semibold hover:bg-amber-50 transition-colors shadow-2xs"
          >
            <span>Buka Folder Drive Madrasah</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`flex items-center gap-2 p-3 text-xs font-medium rounded-lg border ${
            statusMessage.type === 'error'
              ? 'text-rose-800 bg-rose-50 border-rose-200'
              : 'text-emerald-800 bg-emerald-50 border-emerald-200'
          }`}
        >
          {statusMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          ) : (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari judul dokumen kurikulum..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-emerald-200 rounded-lg focus:outline-emerald-600"
          />
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-emerald-200 rounded-lg focus:outline-emerald-600"
          >
            <option value="all">Semua Jenis Dokumen</option>
            {CURRICULUM_DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-emerald-200 rounded-lg focus:outline-emerald-600"
          >
            <option value="all">Semua Status Telaah</option>
            <option value="Draft">Draf</option>
            <option value="Diajukan">Diajukan</option>
            <option value="Disetujui">Disetujui</option>
            <option value="Perlu Revisi">Perlu Revisi</option>
          </select>
        </div>
      </div>

      {/* Tabel Dokumen */}
      <div className="bg-white rounded-xl border border-emerald-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-emerald-200 bg-emerald-50/70 text-emerald-950 text-xs font-semibold">
                <th className="py-3 px-4">Jenis &amp; Judul Dokumen</th>
                <th className="py-3 px-4">Penyusun / Guru</th>
                <th className="py-3 px-4">Arsip &amp; Tautan Drive</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Memuat arsip kurikulum...
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Belum ada dokumen yang sesuai dengan filter. Klik tombol &ldquo;Unggah / Kirim Dokumen ke Drive&rdquo; untuk memulai.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => {
                  const latestReview = reviews.find((r) => r.document_link_id === doc.id);
                  const canSubmit = doc.status === 'Draft' || doc.status === 'Perlu Revisi';
                  const canDelete =
                    activeRole === 'admin' ||
                    doc.status === 'Draft' ||
                    doc.status === 'Perlu Revisi';

                  return (
                    <tr key={doc.id} className="hover:bg-emerald-50/35 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{doc.title}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                          <span className="font-semibold text-emerald-800">{doc.document_type}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {doc.class?.name || classes.find((c) => c.id === doc.class_id)?.name || 'Kelas'} ·{' '}
                            {doc.subject?.name || subjects.find((s) => s.id === doc.subject_id)?.name || 'Mata Pelajaran'}
                          </span>
                        </div>
                        {latestReview && latestReview.review_notes && (
                          <div
                            className={`mt-1.5 inline-flex items-start gap-1.5 px-2 py-1 rounded text-[11px] border ${
                              latestReview.status_decision === 'Disetujui'
                                ? 'bg-emerald-50/70 text-emerald-900 border-emerald-200'
                                : 'bg-rose-50/70 text-rose-900 border-rose-200'
                            }`}
                          >
                            <MessageSquare className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>
                              <strong>Catatan Kamad:</strong> {latestReview.review_notes}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {doc.teacher
                          ? `${doc.teacher.title_prefix || ''} ${doc.teacher.full_name} ${doc.teacher.title_suffix || ''}`.trim()
                          : 'Guru Madrasah'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              isRealDriveFileUrl(doc.google_drive_url)
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {isRealDriveFileUrl(doc.google_drive_url)
                              ? 'Terkirim ke Google Drive'
                              : 'Arsip Lokal (Belum di Drive)'}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {(doc.file_id || isRealDriveFileUrl(doc.google_drive_url)) && (
                              <button
                                type="button"
                                onClick={() => void handlePreviewStoredFile(doc)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-[11px] transition-colors cursor-pointer"
                                title="Preview dokumen layar penuh"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Preview Dokumen</span>
                              </button>
                            )}
                            {doc.file_id && (
                              <button
                                type="button"
                                onClick={() => void handleDownloadStoredFile(doc)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 hover:bg-amber-50 text-emerald-900 border border-emerald-200 hover:border-amber-300 font-semibold text-[11px] transition-colors cursor-pointer"
                                title="Unduh berkas fisik"
                              >
                                <Download className="w-3 h-3" />
                                <span>Unduh</span>
                              </button>
                            )}
                            {isRealDriveFileUrl(doc.google_drive_url) && (
                              <a
                                href={doc.google_drive_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-emerald-800 hover:text-amber-700 font-semibold underline text-[11px]"
                              >
                                <span>Buka Drive</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">{getStatusBadge(doc.status)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canSubmit && (
                            <button
                              type="button"
                              onClick={() => void handleSubmitForReview(doc.id, doc.title)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-emerald-950 font-bold text-[11px] rounded shadow-xs transition-colors cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              <span>{doc.status === 'Perlu Revisi' ? 'Ajukan Ulang' : 'Ajukan'}</span>
                            </button>
                          )}
                          {(activeRole === 'kepala_madrasah' || activeRole === 'admin') && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDoc(doc);
                                setReviewDecision(doc.status === 'Perlu Revisi' ? 'Perlu Revisi' : 'Disetujui');
                                setReviewNotes(latestReview?.review_notes || '');
                                setShowReviewModal(true);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-900 hover:bg-emerald-800 text-amber-300 font-bold text-[11px] rounded shadow-xs transition-colors cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>Telaah</span>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setPendingDeleteDoc(doc)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Hapus dokumen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Unggah & Arsipkan Dokumen ke Google Drive Madrasah */}
      <DriveDocumentUploadModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        defaultClassId={selectedClassId || undefined}
        defaultSubjectId={selectedSubjectId || undefined}
        onSuccess={(createdDoc, uploadedToGoogleDrive) => {
          notify(
            createdDoc.status === 'Diajukan'
              ? `"${createdDoc.title}" berhasil diarsipkan${uploadedToGoogleDrive ? ' ke Google Drive' : ''} dan dikirim ke Dashboard Kepala Madrasah.`
              : `"${createdDoc.title}" berhasil disimpan sebagai draf arsip.`
          );
          void loadDocs();
        }}
      />

      {/* Modal Telaah Dokumen Kepala Madrasah */}
      {showReviewModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-emerald-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Telaah Dokumen Kurikulum</h3>
            <p className="text-xs text-slate-500 mb-4">
              Periksa kelayakan perangkat pembelajaran dan berikan catatan bimbingan profesional.
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200 text-xs">
                <p className="font-bold text-slate-900">{selectedDoc.title}</p>
                <p className="text-slate-500 mt-0.5">{selectedDoc.document_type}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Keputusan Telaah</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewDecision('Disetujui')}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      reviewDecision === 'Disetujui'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'border-slate-200 text-slate-700 hover:bg-emerald-50'
                    }`}
                  >
                    Disetujui
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewDecision('Perlu Revisi')}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                      reviewDecision === 'Perlu Revisi'
                        ? 'bg-rose-700 text-white border-rose-700'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Perlu Revisi
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Rekomendasi / Arahan Perbaikan
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Berikan masukan konstruktif untuk penyempurnaan modul..."
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 text-emerald-950 font-bold rounded-lg shadow-xs"
                >
                  Kirim Hasil Telaah
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Dokumen */}
      {pendingDeleteDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-emerald-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Hapus Arsip Dokumen?</h3>
            <p className="text-xs text-slate-600">
              Dokumen <strong>{pendingDeleteDoc.title}</strong> akan dihapus dari daftar arsip aplikasi.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPendingDeleteDoc(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
      <FilePreviewModal
        isOpen={Boolean(previewDocState)}
        file={previewDocState?.file || null}
        title={previewDocState ? `Pratinjau: ${previewDocState.file.name}` : undefined}
        onClose={() => setPreviewDocState(null)}
        onFileUpdated={(updated) => {
          setPreviewDocState((prev) => (prev ? { ...prev, file: updated } : null));
          if (updated.googleDriveUrl && previewDocState?.docId) {
            void curriculumService
              .updateDocument(previewDocState.docId, {
                google_drive_url: updated.googleDriveUrl,
              })
              .then(() => {
                void loadDocs();
              })
              .catch(() => {});
          }
        }}
      />
    </div>
  );
};

