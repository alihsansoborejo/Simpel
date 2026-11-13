import React, { useState, useEffect, useCallback } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { academicService } from '../../services/academicService';
import {
  DocumentLink,
  DocumentStatus,
  ClassRoom,
  Subject,
  TeachingAssignment,
  Teacher,
} from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useGoogleDrive } from '../../context/GoogleDriveContext';
import { fileStorageService } from '../../services/fileStorageService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
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
} from 'lucide-react';

export const CurriculumDocsPage: React.FC = () => {
  const { user, activeRole } = useAuth();
  const { selectedSubjectId, selectedClassId } = useWorkspace();
  const [documents, setDocuments] = useState<DocumentLink[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [resolvedTeacher, setResolvedTeacher] = useState<Teacher | null>(null);
  const [activeYearId, setActiveYearId] = useState<string>('ay-2026');
  const [activeSemesterId, setActiveSemesterId] = useState<string>('sem-ganjil-2026');
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

  // Google Drive Context
  const { isConnected, isConnecting, connect, googleUser } = useGoogleDrive();
  const [modalTab, setModalTab] = useState<'upload' | 'url'>('upload');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState<boolean>(false);

  // Form State
  const [docType, setDocType] = useState<string>('Modul Ajar');
  const [docClassId, setDocClassId] = useState<string>(selectedClassId || '');
  const [docSubjectId, setDocSubjectId] = useState<string>(selectedSubjectId || '');
  const [title, setTitle] = useState<string>('');
  const [driveUrl, setDriveUrl] = useState<string>('');

  const loadDocs = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, clss, sbjs, asgs, sys, years, sems, teacher] = await Promise.all([
        curriculumService.getDocuments(),
        academicService.getClasses(),
        academicService.getSubjects(),
        academicService.getTeachingAssignments(),
        academicService.getSettings(),
        academicService.getAcademicYears(),
        academicService.getSemesters(),
        academicService.resolveTeacherForUser(user),
      ]);
      setDocuments(data);
      setClasses(clss);
      setSubjects(sbjs);
      setResolvedTeacher(teacher);

      const actYear = years.find((y) => y.id === sys.active_academic_year_id || y.is_active) || years[0];
      const actSem = sems.find((s) => s.id === sys.active_semester_id || s.is_active) || sems[0];
      if (actYear?.id) setActiveYearId(actYear.id);
      if (actSem?.id) setActiveSemesterId(actSem.id);

      const relevantAsgs =
        activeRole === 'guru'
          ? teacher
            ? asgs.filter((a) => a.teacher_id === teacher.id)
            : []
          : asgs;
      setAssignments(relevantAsgs);

      if (activeRole === 'guru' && relevantAsgs.length > 0) {
        const matchedAsg =
          relevantAsgs.find(
            (a) =>
              (!selectedSubjectId || a.subject_id === selectedSubjectId) &&
              (!selectedClassId || a.class_id === selectedClassId)
          ) || relevantAsgs[0];
        setDocClassId((prev) => prev || matchedAsg.class_id);
        setDocSubjectId((prev) => prev || matchedAsg.subject_id);
      } else {
        setDocClassId((prev) => prev || selectedClassId || clss[0]?.id || '');
        setDocSubjectId((prev) => prev || selectedSubjectId || sbjs[0]?.id || '');
      }
    } catch (err) {
      console.error('Gagal memuat dokumen kurikulum:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeRole, user?.id, user?.teacherId, selectedClassId, selectedSubjectId]);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    if (selectedClassId) setDocClassId(selectedClassId);
    if (selectedSubjectId) setDocSubjectId(selectedSubjectId);
  }, [selectedClassId, selectedSubjectId]);

  useRealtimeSync(
    ['simpel_curriculum_documents', 'simpel_curriculum_reviews', 'simpel_assignments', 'simpel_classes', 'simpel_subjects'],
    () => {
      void loadDocs();
    },
    true
  );

  const DRIVE_REGEX = /^(https?:\/\/)?(drive|docs)\.google\.com\/(file\/d\/|document\/d\/|spreadsheets\/d\/|presentation\/d\/|drive\/folders\/|open\?id=|[a-zA-Z0-9_-]+).*/i;

  const modalClasses =
    activeRole === 'guru'
      ? classes.filter((c) => assignments.some((a) => a.class_id === c.id))
      : classes;

  const modalSubjects =
    activeRole === 'guru'
      ? subjects.filter((s) =>
          assignments.some((a) => a.subject_id === s.id && (!docClassId || a.class_id === docClassId))
        )
      : subjects;

  const handleDirectUploadToDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload) {
      alert('Pilih berkas dari perangkat Anda terlebih dahulu.');
      return;
    }

    setIsUploadingToDrive(true);
    try {
      const fileExt = fileToUpload.name.split('.').pop() || 'pdf';
      const cleanTitle = title.trim() || fileToUpload.name.replace(/\.[^/.]+$/, '');
      const fileNameToUse = title.trim() ? `${cleanTitle}.${fileExt}` : fileToUpload.name;

      // Simpan langsung ke penyimpanan berkas aplikasi (IndexedDB)
      const config = fileStorageService.getConfig();
      const saved = await fileStorageService.saveDocumentFile({
        file: fileToUpload,
        name: fileNameToUse,
        category: docType,
        uploadedBy: user?.profile.full_name || resolvedTeacher?.full_name || 'Guru Madrasah',
      });

      const finalDriveUrl = saved.googleDriveUrl || config.sharedFolderUrl || 'https://drive.google.com';

      await curriculumService.createDocument({
        teacher_id: resolvedTeacher?.id || user?.teacherId || user?.id || '',
        academic_year_id: activeYearId,
        semester_id: activeSemesterId,
        class_id: docClassId || classes[0]?.id || '',
        subject_id: docSubjectId || subjects[0]?.id || '',
        document_type: docType,
        title: cleanTitle,
        google_drive_url: finalDriveUrl,
        file_id: saved.id,
        status: 'Draft',
        submission_date: null,
      });

      setShowAddModal(false);
      setTitle('');
      setDriveUrl('');
      setFileToUpload(null);
      setStatusMessage(`Berkas "${fileNameToUse}" berhasil diunggah dan disimpan di sistem!`);
      void loadDocs();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      alert(`Gagal menyimpan berkas: ${err?.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!DRIVE_REGEX.test(driveUrl.trim())) {
      setStatusMessage('Format tautan tidak valid! Gunakan format tautan Google Drive / Docs / Spreadsheets resmi.');
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }

    try {
      await curriculumService.createDocument({
        teacher_id: resolvedTeacher?.id || user?.teacherId || user?.id || '',
        academic_year_id: activeYearId,
        semester_id: activeSemesterId,
        class_id: docClassId || classes[0]?.id || '',
        subject_id: docSubjectId || subjects[0]?.id || '',
        document_type: docType,
        title,
        google_drive_url: driveUrl.trim(),
        file_id: null,
        status: 'Draft',
        submission_date: null,
      });
      setShowAddModal(false);
      setTitle('');
      setDriveUrl('');
      setStatusMessage('Tautan berkas Google Drive berhasil disimpan sebagai draf.');
      void loadDocs();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menyimpan dokumen:', err);
    }
  };

  const handleSubmitForReview = async (id: string, docTitle: string) => {
    try {
      await curriculumService.submitDocument(id);
      setStatusMessage(`Dokumen "${docTitle}" telah diajukan ke Kepala Madrasah untuk ditelaah.`);
      void loadDocs();
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
      void loadDocs();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal mereview dokumen:', err);
    }
  };

  const filteredDocs = documents.filter((d) => {
    if (activeRole === 'guru') {
      const teacherId = resolvedTeacher?.id || user?.teacherId;
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

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Arsip Dokumen Kurikulum (Google Drive)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan berkas pembelajaran (CP, TP, ATP, Prota, Prosem, Modul Ajar, LKPD) langsung terhubung ke Google Drive madrasah.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isConnected ? (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium truncate max-w-[150px]">{googleUser?.email}</span>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-800" />
              <span>{isConnecting ? 'Menghubungkan...' : 'Sambungkan Google Drive'}</span>
            </button>
          )}

          <button
            onClick={() => {
              setModalTab('upload');
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Unggah / Tautkan Dokumen</span>
          </button>
        </div>
      </div>

      {/* Panduan Google Drive Institusi */}
      <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-800 text-white rounded-lg shrink-0 mt-0.5">
            <FolderSync className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-emerald-950">
              Penyimpanan Langsung: Folder "SIMPEL MI Al Ihsan Soborejo"
            </h4>
            <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
              Semua berkas pembelajaran yang Anda unggah secara otomatis disimpan di dalam folder khusus di Google Drive akun Anda. Tautan resmi akan otomatis digenerate dan dikirim ke sistem untuk ditelaah oleh Kepala Madrasah.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://drive.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-900 rounded-lg text-xs font-semibold hover:bg-emerald-100/50 transition-colors shadow-2xs"
          >
            <span>Buka Google Drive</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
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
                        <span>
                          {doc.class?.name || classes.find((c) => c.id === doc.class_id)?.name || 'Kelas'} ·{' '}
                          {doc.subject?.name || subjects.find((s) => s.id === doc.subject_id)?.name || 'Mata Pelajaran'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {doc.teacher
                        ? `${doc.teacher.title_prefix || ''} ${doc.teacher.full_name} ${doc.teacher.title_suffix || ''}`.trim()
                        : 'Guru Madrasah'}
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

      {/* Modal Tautkan / Unggah Dokumen Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-emerald-800" />
                <span>Dokumen Google Drive Madrasah</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-slate-200 mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setModalTab('upload')}
                className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalTab === 'upload'
                    ? 'border-emerald-800 text-emerald-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Unggah Berkas Langsung</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('url')}
                className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalTab === 'url'
                    ? 'border-emerald-800 text-emerald-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Input Tautan Manual</span>
              </button>
            </div>

            {modalTab === 'upload' ? (
              <form onSubmit={handleDirectUploadToDrive} className="space-y-3.5">
                <div className="bg-emerald-50/80 border border-emerald-200 p-2.5 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-950 font-medium">
                      Penyimpanan Berkas Mandiri &amp; Google Drive Aktif
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                    Siap Pakai
                  </span>
                </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Pilih Berkas Perangkat Ajar (PDF / Word / Excel / Gambar) *
                      </label>
                      <input
                        type="file"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const f = e.target.files[0];
                            setFileToUpload(f);
                            if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
                          }
                        }}
                        required
                        className="w-full text-xs text-slate-600 border border-slate-200 rounded-lg p-2 bg-slate-50 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-800 file:text-white hover:file:bg-emerald-900 cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Kelas / Rombel</label>
                        <select
                          value={docClassId}
                          onChange={(e) => {
                            const nextCls = e.target.value;
                            setDocClassId(nextCls);
                            if (activeRole === 'guru') {
                              const firstSbj = assignments.find((a) => a.class_id === nextCls)?.subject_id;
                              if (firstSbj) setDocSubjectId(firstSbj);
                            }
                          }}
                          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                          required
                        >
                          {modalClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran</label>
                        <select
                          value={docSubjectId}
                          onChange={(e) => setDocSubjectId(e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                          required
                        >
                          {modalSubjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

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
                        placeholder="Contoh: Modul Ajar Bab 2"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                        required
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowAddModal(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isUploadingToDrive || !fileToUpload}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>{isUploadingToDrive ? 'Mengunggah ke Drive...' : 'Unggah & Simpan Dokumen'}</span>
                      </button>
                    </div>
                  </form>
            ) : (
              <form onSubmit={handleCreateDocument} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Kelas / Rombel</label>
                    <select
                      value={docClassId}
                      onChange={(e) => {
                        const nextCls = e.target.value;
                        setDocClassId(nextCls);
                        if (activeRole === 'guru') {
                          const firstSbj = assignments.find((a) => a.class_id === nextCls)?.subject_id;
                          if (firstSbj) setDocSubjectId(firstSbj);
                        }
                      }}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                      required
                    >
                      {modalClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran</label>
                    <select
                      value={docSubjectId}
                      onChange={(e) => setDocSubjectId(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                      required
                    >
                      {modalSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

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
                    placeholder="Contoh: Modul Ajar Bab 2"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tautan URL Google Drive</label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Pastikan akses berbagi disetel ke "Siapa saja dengan tautan dapat melihat".
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
            )}
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
