import React, { useState, useEffect } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { DocumentLink, DocumentStatus } from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import {
  FolderSync,
  ExternalLink,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Send,
  MessageSquare,
  Search,
} from 'lucide-react';

export const CurriculumDocsPage: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [documents, setDocuments] = useState<DocumentLink[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentLink | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'Disetujui' | 'Perlu Revisi'>('Disetujui');
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Form State
  const [docType, setDocType] = useState<string>('Modul Ajar');
  const [title, setTitle] = useState<string>('');
  const [driveUrl, setDriveUrl] = useState<string>('');

  const loadDocs = async () => {
    setIsLoading(true);
    try {
      const data = await curriculumService.getDocuments();
      setDocuments(data);
    } catch (err) {
      console.error('Gagal memuat dokumen kurikulum:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveUrl.includes('drive.google.com') && !driveUrl.includes('docs.google.com')) {
      alert('Tautan dokumen wajib mengarah ke Google Drive atau Google Docs resmi.');
      return;
    }

    try {
      await curriculumService.createDocument({
        teacher_id: user?.teacherId || 'tch-1',
        academic_year_id: 'ay-2026',
        semester_id: 'sem-ganjil-2026',
        class_id: 'cls-4',
        subject_id: 'sbj-ind',
        document_type: docType,
        title,
        google_drive_url: driveUrl,
        file_id: null,
        status: 'Draft',
        submission_date: null,
      });
      setShowAddModal(false);
      setTitle('');
      setDriveUrl('');
      setStatusMessage('Tautan berkas Google Drive berhasil disimpan sebagai draf.');
      loadDocs();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menyimpan dokumen:', err);
    }
  };

  const handleSubmitForReview = async (id: string, docTitle: string) => {
    try {
      await curriculumService.submitDocument(id);
      setStatusMessage(`Dokumen "${docTitle}" telah diajukan ke Kepala Madrasah untuk ditelaah.`);
      loadDocs();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal mengajukan dokumen:', err);
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
      setStatusMessage(`Telaah dokumen selesai: Status diperbarui menjadi "${reviewDecision}".`);
      loadDocs();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal mereview dokumen:', err);
    }
  };

  const filteredDocs = documents.filter((d) => {
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

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Arsip Dokumen Kurikulum (Google Drive)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan berkas pembelajaran (CP, TP, ATP, Prota, Prosem, Modul Ajar, LKPD) melalui tautan resmi Google Drive.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tautkan Dokumen Baru</span>
        </button>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
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
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600"
          />
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600"
          >
            <option value="all">Semua Jenis Dokumen</option>
            <option value="Capaian Pembelajaran (CP)">Capaian Pembelajaran (CP)</option>
            <option value="Tujuan Pembelajaran (TP)">Tujuan Pembelajaran (TP)</option>
            <option value="Alur Tujuan Pembelajaran (ATP)">Alur Tujuan Pembelajaran (ATP)</option>
            <option value="Program Tahunan (Prota)">Program Tahunan (Prota)</option>
            <option value="Program Semester (Prosem)">Program Semester (Prosem)</option>
            <option value="Modul Ajar">Modul Ajar</option>
            <option value="Lembar Kerja Peserta Didik (LKPD)">Lembar Kerja Peserta Didik (LKPD)</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600"
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
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                <th className="py-3 px-4">Jenis & Judul Dokumen</th>
                <th className="py-3 px-4">Penyusun / Guru</th>
                <th className="py-3 px-4">Tautan Google Drive</th>
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
                    Belum ada dokumen yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{doc.title}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-semibold text-emerald-800">{doc.document_type}</span>
                        <span aria-hidden="true">·</span>
                        <span>Kelas 4 · Bahasa Indonesia</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {doc.teacher
                        ? `${doc.teacher.title_prefix || ''} ${doc.teacher.full_name} ${doc.teacher.title_suffix || ''}`
                        : 'Ust. Ahmad Fauzi, S.Pd.I'}
                    </td>
                    <td className="py-3 px-4">
                      <a
                        href={doc.google_drive_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-800 hover:text-emerald-900 font-semibold underline"
                      >
                        <span>Buka di Google Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(doc.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {doc.status === 'Draft' && (
                          <button
                            onClick={() => handleSubmitForReview(doc.id, doc.title)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[11px] rounded shadow-xs transition-colors"
                          >
                            <Send className="w-3 h-3" />
                            <span>Ajukan</span>
                          </button>
                        )}
                        {(activeRole === 'kepala_madrasah' || activeRole === 'admin') && (
                          <button
                            onClick={() => {
                              setSelectedDoc(doc);
                              setReviewDecision('Disetujui');
                              setReviewNotes('');
                              setShowReviewModal(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-[11px] rounded shadow-xs transition-colors"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Telaah</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tautkan Dokumen Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Tautkan Dokumen Google Drive</h3>
            <p className="text-xs text-slate-500 mb-4">
              Masukkan tautan berkas resmi Google Drive untuk perangkat ajar madrasah.
            </p>

            <form onSubmit={handleCreateDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Perangkat Kurikulum</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  required
                >
                  <option value="Modul Ajar">Modul Ajar (RPP Merdeka)</option>
                  <option value="Alur Tujuan Pembelajaran (ATP)">Alur Tujuan Pembelajaran (ATP)</option>
                  <option value="Capaian Pembelajaran (CP)">Capaian Pembelajaran (CP)</option>
                  <option value="Program Tahunan (Prota)">Program Tahunan (Prota)</option>
                  <option value="Program Semester (Prosem)">Program Semester (Prosem)</option>
                  <option value="Lembar Kerja Peserta Didik (LKPD)">Lembar Kerja Peserta Didik (LKPD)</option>
                  <option value="Kisi-Kisi Asesmen">Kisi-Kisi Asesmen</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Dokumen</label>
                <input
                  type="text"
                  placeholder="Contoh: Modul Ajar IPAS Bab 2 Siklus Makhluk Hidup"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tautan Tautan Google Drive</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Pastikan akses berbagi tautan minimal disetel ke "Siapa saja dengan tautan dapat melihat".
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Tautan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Telaah Dokumen Kepala Madrasah */}
      {showReviewModal && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Telaah Dokumen Kurikulum</h3>
            <p className="text-xs text-slate-500 mb-4">
              Periksa kelayakan perangkat pembelajaran dan berikan catatan bimbingan profesional.
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
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
                        ? 'bg-emerald-800 text-white border-emerald-800'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
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
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  Kirim Hasil Telaah
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
