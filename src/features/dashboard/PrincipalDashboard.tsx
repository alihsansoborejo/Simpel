import React, { useEffect, useState } from 'react';
import {
  fetchPrincipalDashboardData,
  PrincipalDashboardData,
  PrincipalDocumentSummary,
} from '../../services/dashboardService';
import { curriculumService } from '../../services/curriculumService';
import { fileStorageService, StoredDocumentFile } from '../../services/fileStorageService';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/ui/StatCard';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { FilePreviewModal } from '../../components/curriculum/FilePreviewModal';
import {
  FolderSync,
  ClipboardList,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Award,
  Clock,
  ArrowRight,
  AlertCircle,
  Eye,
  Download,
  MessageSquare,
  X,
} from 'lucide-react';

interface PrincipalDashboardProps {
  onNavigate: (view: string) => void;
}

export const PrincipalDashboard: React.FC<PrincipalDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [data, setData] = useState<PrincipalDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docTab, setDocTab] = useState<'Diajukan' | 'Disetujui' | 'Perlu Revisi' | 'all'>('Diajukan');
  const [reviewDoc, setReviewDoc] = useState<PrincipalDocumentSummary | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'Disetujui' | 'Perlu Revisi'>('Disetujui');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<StoredDocumentFile | null>(null);

  const loadData = async () => {
    try {
      setLoadError(null);
      const res = await fetchPrincipalDashboardData();
      setData(res);
    } catch (err: any) {
      console.error('Error loading principal dashboard:', err);
      setLoadError(err?.message || 'Gagal memuat ringkasan data Kepala Madrasah.');
      setData((prev) =>
        prev || {
          totalTeachers: 0,
          totalStudents: 0,
          totalClasses: 0,
          pendingDocumentsCount: 0,
          approvedDocumentsCount: 0,
          revisionDocumentsCount: 0,
          totalSupervisions: 0,
          totalJournalsToday: 0,
          pendingDocuments: [],
          submittedDocuments: [],
          recentJournals: [],
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useRealtimeSync('*', () => {
    void loadData();
  });

  const handleOpenFileAction = async (fileId: string | null, mode: 'preview' | 'download') => {
    if (!fileId) return;
    const stored = await fileStorageService.getFileById(fileId);
    if (!stored) {
      setToastMsg('Berkas fisik tidak ditemukan di penyimpanan lokal; silakan buka tautan Google Drive.');
      setTimeout(() => setToastMsg(null), 4000);
      return;
    }
    if (mode === 'preview') {
      setPreviewFile(stored);
    } else {
      fileStorageService.downloadStoredFile(stored);
    }
  };

  const handleOpenReviewModal = (doc: PrincipalDocumentSummary, initialDecision: 'Disetujui' | 'Perlu Revisi' = 'Disetujui') => {
    setReviewDoc(doc);
    setReviewDecision(initialDecision);
    setReviewNotes(doc.reviewNotes || '');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewDoc) return;
    setIsSubmittingReview(true);
    try {
      await curriculumService.reviewDocument(
        reviewDoc.id,
        reviewDecision,
        reviewNotes.trim() || (reviewDecision === 'Disetujui' ? 'Dokumen telah ditelaah dan disetujui Kepala Madrasah.' : 'Mohon diperiksa dan diperbaiki kembali.'),
        user?.id || 'usr-kamad'
      );
      setReviewDoc(null);
      setReviewNotes('');
      setToastMsg(`Dokumen "${reviewDoc.title}" berhasil ditelaah (${reviewDecision}).`);
      await loadData();
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err) {
      console.error('Gagal menyimpan telaah dokumen:', err);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded-lg w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const displayedDocs =
    docTab === 'all'
      ? data.submittedDocuments
      : data.submittedDocuments.filter((d) => d.status === docTab);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Dashboard Supervisi Kepala Madrasah
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Telaah dan persetujuan perangkat pembelajaran (Modul Ajar, CP, TP, LKPD, Naskah Soal) dari Google Drive Madrasah
          </p>
        </div>

        <button
          onClick={() => onNavigate('supervisi-kbm')}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-emerald-950 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-lg hover:from-amber-500 hover:to-yellow-500 transition-colors shadow-xs self-start md:self-auto"
        >
          <Award className="w-4 h-4" />
          <span>Formulir Supervisi KBM</span>
        </button>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-2 p-3 text-xs font-medium text-amber-900 bg-amber-50 rounded-xl border border-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="px-2.5 py-1 rounded-md bg-white border border-amber-300 text-amber-900 font-semibold hover:bg-amber-100"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {toastMsg && (
        <div className="flex items-center justify-between gap-2 p-3 text-xs font-medium text-emerald-900 bg-emerald-50 rounded-xl border border-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-emerald-700 hover:text-emerald-950 font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Dokumen Menunggu Telaah"
          value={data.pendingDocumentsCount}
          subtitle="Kiriman guru via Google Drive"
          icon={Clock}
          badgeText={data.pendingDocumentsCount > 0 ? 'Perlu Ditelaah' : 'Tuntas'}
          badgeType={data.pendingDocumentsCount > 0 ? 'warning' : 'success'}
          onClick={() => setDocTab('Diajukan')}
        />
        <StatCard
          title="Dokumen Disetujui"
          value={data.approvedDocumentsCount}
          subtitle="Sudah disahkan Kepala Madrasah"
          icon={CheckCircle2}
          badgeText="Terarsip"
          badgeType="success"
          onClick={() => setDocTab('Disetujui')}
        />
        <StatCard
          title="Jurnal KBM Tercatat"
          value={data.totalJournalsToday}
          subtitle="Rekap entri KBM dewan guru"
          icon={ClipboardList}
          badgeText={`${data.totalSupervisions} Supervisi`}
          badgeType="info"
          onClick={() => onNavigate('monitoring-kbm')}
        />
        <StatCard
          title="Supervisi Akademik"
          value={data.totalSupervisions}
          subtitle={`Observasi KBM untuk ${data.totalTeachers} guru`}
          icon={Award}
          badgeText={`${data.totalClasses} Rombel`}
          badgeType="success"
          onClick={() => onNavigate('supervisi-kbm')}
        />
      </div>

      {/* Grid: Dokumen Menunggu Review & Jurnal Terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Dokumen Arsip Perangkat Ajar & Soal Guru */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-emerald-200/80 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FolderSync className="w-4 h-4 text-emerald-700" />
                <span>Telaah &amp; Persetujuan Dokumen Guru (Google Drive)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Periksa Modul Ajar, CP, TP, LKPD, dan Naskah Soal sebelum disetujui.
              </p>
            </div>
            <button
              onClick={() => onNavigate('arsip-drive')}
              className="text-xs font-semibold text-emerald-800 hover:text-amber-700 self-start sm:self-auto transition-colors"
            >
              Kelola Semua Arsip →
            </button>
          </div>

          {/* Filter Tab Status Telaah */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-emerald-100 pb-3 text-xs">
            {[
              { id: 'Diajukan', label: 'Menunggu Telaah', count: data.pendingDocumentsCount },
              { id: 'Disetujui', label: 'Disetujui', count: data.approvedDocumentsCount },
              { id: 'Perlu Revisi', label: 'Perlu Revisi', count: data.revisionDocumentsCount },
              { id: 'all', label: 'Semua Kiriman', count: data.submittedDocuments.length },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDocTab(t.id as typeof docTab)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                  docTab === t.id
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 font-bold shadow-2xs'
                    : 'bg-emerald-50/70 text-emerald-900/75 hover:bg-emerald-100'
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    docTab === t.id ? 'bg-emerald-950 text-amber-300' : 'bg-white text-emerald-900'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <div className="divide-y divide-slate-100">
            {displayedDocs.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                {docTab === 'Diajukan'
                  ? 'Tidak ada dokumen baru yang menunggu telaah saat ini.'
                  : 'Belum ada dokumen pada kategori status ini.'}
              </div>
            ) : (
              displayedDocs.map((doc) => (
                <div key={doc.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-900 border border-emerald-200">
                        {doc.documentType}
                      </span>
                      {doc.status === 'Diajukan' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-900 border border-amber-300">
                          <Clock className="w-3 h-3" />
                          <span>Menunggu Telaah</span>
                        </span>
                      )}
                      {doc.status === 'Disetujui' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Disetujui</span>
                        </span>
                      )}
                      {doc.status === 'Perlu Revisi' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-800 border border-rose-200">
                          <AlertCircle className="w-3 h-3" />
                          <span>Perlu Revisi</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-bold text-slate-900 truncate">{doc.title}</p>
                    <p className="text-[11px] text-slate-500">
                      Guru: <span className="font-semibold text-slate-700">{doc.teacherName}</span> ·{' '}
                      {doc.className} · {doc.subjectName} ·{' '}
                      {(() => {
                        const parsed = doc.submissionDate ? new Date(doc.submissionDate) : null;
                        if (!parsed || Number.isNaN(parsed.getTime())) return '-';
                        return parsed.toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        });
                      })()}
                    </p>
                    {doc.reviewNotes && (
                      <p className="text-[11px] text-slate-600 italic bg-emerald-50/50 px-2.5 py-1 rounded border border-emerald-100">
                        Catatan Kamad: &ldquo;{doc.reviewNotes}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {doc.fileId && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenFileAction(doc.fileId, 'preview')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors"
                          title="Preview dokumen layar penuh"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Preview Dokumen</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenFileAction(doc.fileId, 'download')}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                          title="Unduh berkas"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    <a
                      href={doc.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <span>Buka Drive</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleOpenReviewModal(doc, 'Disetujui')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-950 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 rounded-lg transition-colors"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>{doc.status === 'Diajukan' ? 'Telaah & Setujui' : 'Ubah Telaah'}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Kolom 3: Pemantauan Jurnal KBM Hari Ini */}
        <div className="bg-white rounded-xl border border-emerald-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-600" />
                <span>Aktivitas KBM Terkini</span>
              </h3>
              <span className="text-[10px] text-slate-400">Jurnal Masuk</span>
            </div>

            <div className="space-y-3">
              {data.recentJournals.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Belum ada jurnal KBM masuk.</p>
              ) : (
                data.recentJournals.map((jrn) => (
                  <div key={jrn.id} className="p-2.5 rounded-lg bg-emerald-50/40 border border-emerald-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600 font-medium">
                      <span className="text-emerald-900 font-semibold">{jrn.className} · {jrn.subjectName}</span>
                      <span className="text-[10px] text-slate-400">{jrn.date}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 font-medium mt-1 line-clamp-2">
                      {jrn.topic}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">Guru: {jrn.teacherName}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-4 text-center">
            <button
              onClick={() => onNavigate('monitoring-kbm')}
              className="text-xs font-semibold text-emerald-800 hover:text-amber-700 flex items-center justify-center gap-1 w-full transition-colors"
            >
              <span>Pantau Seluruh KBM Madrasah</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Telaah & Persetujuan Kepala Madrasah */}
      {reviewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-emerald-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Telaah &amp; Persetujuan Dokumen</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Periksa kelayakan dokumen sebelum disetujui dan disahkan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-100 text-emerald-950 font-bold text-[10px] border border-amber-200">
                  {reviewDoc.documentType}
                </span>
                <span className="text-[11px] text-slate-500">
                  {reviewDoc.className} · {reviewDoc.subjectName}
                </span>
              </div>
              <p className="font-bold text-slate-900 text-sm">{reviewDoc.title}</p>
              <p className="text-slate-600">Penyusun: {reviewDoc.teacherName}</p>
              <div className="flex items-center gap-2 pt-1">
                {reviewDoc.fileId && (
                  <button
                    type="button"
                    onClick={() => handleOpenFileAction(reviewDoc.fileId, 'preview')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-800 text-white font-bold text-[11px] hover:bg-emerald-900"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Preview Dokumen</span>
                  </button>
                )}
                <a
                  href={reviewDoc.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-emerald-300 text-emerald-800 font-semibold text-[11px] hover:bg-emerald-50"
                >
                  <span>Buka di Google Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Keputusan Kepala Madrasah
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewDecision('Disetujui')}
                    className={`py-2.5 text-xs font-bold rounded-xl border transition-all ${
                      reviewDecision === 'Disetujui'
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ✓ Disetujui (Sah)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewDecision('Perlu Revisi')}
                    className={`py-2.5 text-xs font-bold rounded-xl border transition-all ${
                      reviewDecision === 'Perlu Revisi'
                        ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ↺ Perlu Revisi
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Telaah / Arahan Pembinaan
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Tuliskan catatan telaah atau apresiasi untuk guru..."
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-emerald-600"
                  required={reviewDecision === 'Perlu Revisi'}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewDoc(null)}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="px-4 py-2 text-xs bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 text-emerald-950 font-bold rounded-lg shadow-xs disabled:opacity-50"
                >
                  {isSubmittingReview ? 'Menyimpan...' : 'Simpan Keputusan Telaah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <FilePreviewModal
        isOpen={Boolean(previewFile)}
        file={previewFile}
        title={previewFile ? `Pratinjau Dokumen Guru: ${previewFile.name}` : undefined}
        onClose={() => setPreviewFile(null)}
        onFileUpdated={(updated) => setPreviewFile(updated)}
      />
    </div>
  );
};

