import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGoogleDrive } from '../../context/GoogleDriveContext';
import { academicService } from '../../services/academicService';
import { curriculumService } from '../../services/curriculumService';
import { fileStorageService, StoredDocumentFile, isRealDriveFileUrl } from '../../services/fileStorageService';
import { FilePreviewContent } from './FilePreviewModal';
import { ClassRoom, Subject, TeachingAssignment, Teacher, DocumentLink } from '../../types/database.types';
import {
  HardDrive,
  UploadCloud,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Send,
  X,
  FolderSync,
} from 'lucide-react';

export const CURRICULUM_DOC_TYPES = [
  { value: 'Modul Ajar', label: 'Modul Ajar (RPP Kurikulum Merdeka)', folder: 'Modul Ajar' },
  { value: 'Capaian Pembelajaran (CP)', label: 'Capaian Pembelajaran (CP)', folder: 'CP & TP' },
  { value: 'Tujuan Pembelajaran (TP)', label: 'Tujuan Pembelajaran (TP)', folder: 'CP & TP' },
  { value: 'Alur Tujuan Pembelajaran (ATP)', label: 'Alur Tujuan Pembelajaran (ATP)', folder: 'ATP' },
  { value: 'Lembar Kerja Peserta Didik (LKPD)', label: 'Lembar Kerja Peserta Didik (LKPD)', folder: 'LKPD' },
  { value: 'Naskah Soal Asesmen', label: 'Naskah Soal Asesmen (Formatif / Sumatif)', folder: 'Naskah Soal & Kisi-Kisi' },
  { value: 'Kisi-Kisi Asesmen', label: 'Kisi-Kisi Asesmen', folder: 'Naskah Soal & Kisi-Kisi' },
  { value: 'Program Tahunan (Prota)', label: 'Program Tahunan (Prota)', folder: 'Prota & Prosem' },
  { value: 'Program Semester (Prosem)', label: 'Program Semester (Prosem)', folder: 'Prota & Prosem' },
] as const;

interface DriveDocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (doc: DocumentLink, uploadedToGoogleDrive: boolean) => void;
  defaultDocType?: string;
  defaultClassId?: string;
  defaultClassLevel?: number;
  defaultSubjectId?: string;
  defaultTitle?: string;
}

const DRIVE_REGEX =
  /^(https?:\/\/)?(drive|docs)\.google\.com\/(file\/d\/|document\/d\/|spreadsheets\/d\/|presentation\/d\/|drive\/folders\/|open\?id=|[a-zA-Z0-9_-]+).*/i;

export const DriveDocumentUploadModal: React.FC<DriveDocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultDocType = 'Modul Ajar',
  defaultClassId,
  defaultClassLevel,
  defaultSubjectId,
  defaultTitle = '',
}) => {
  const { user, activeRole } = useAuth();
  const {
    isConnected: isDriveConnected,
    isConnecting: isDriveConnecting,
    googleUser,
    connect: connectGoogleDrive,
    uploadFile: uploadToGoogleDrive,
  } = useGoogleDrive();

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [resolvedTeacher, setResolvedTeacher] = useState<Teacher | null>(null);
  const [activeYearId, setActiveYearId] = useState<string>('ay-2026');
  const [activeSemesterId, setActiveSemesterId] = useState<string>('sem-ganjil-2026');
  const [activeYearName, setActiveYearName] = useState<string>('2026/2027');
  const [activeSemesterType, setActiveSemesterType] = useState<string>('Ganjil');

  const [modalTab, setModalTab] = useState<'upload' | 'url'>('upload');
  const [docType, setDocType] = useState<string>(defaultDocType);
  const [docClassId, setDocClassId] = useState<string>(defaultClassId || '');
  const [docSubjectId, setDocSubjectId] = useState<string>(defaultSubjectId || '');
  const [title, setTitle] = useState<string>(defaultTitle);
  const [driveUrl, setDriveUrl] = useState<string>('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [submitToPrincipal, setSubmitToPrincipal] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadedResult, setUploadedResult] = useState<{
    file: StoredDocumentFile;
    doc: DocumentLink;
    uploadedToGoogleDrive: boolean;
  } | null>(null);

  const [driveConfigSnapshot, setDriveConfigSnapshot] = useState(() => fileStorageService.getConfig());

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setUploadedResult(null);
    setDocType(defaultDocType || 'Modul Ajar');
    setTitle(defaultTitle || '');
    setFileToUpload(null);
    setDriveUrl('');
    setSubmitToPrincipal(true);
    setDriveConfigSnapshot(fileStorageService.getConfig());
    void fileStorageService.hydrateConfigFromServer().then((cfg) => {
      setDriveConfigSnapshot(cfg);
    });

    const loadRefs = async () => {
      try {
        const [clss, sbjs, asgs, sys, years, sems, teacher, tchs] = await Promise.all([
          academicService.getClasses(),
          academicService.getSubjects(),
          academicService.getTeachingAssignments(),
          academicService.getSettings(),
          academicService.getAcademicYears(),
          academicService.getSemesters(),
          academicService.resolveTeacherForUser(user),
          academicService.getTeachers(),
        ]);

        setClasses(clss);
        setSubjects(sbjs);
        setResolvedTeacher(teacher);

        const actYear = years.find((y) => y.id === sys.active_academic_year_id || y.is_active) || years[0];
        const actSem = sems.find((s) => s.id === sys.active_semester_id || s.is_active) || sems[0];
        if (actYear?.id) setActiveYearId(actYear.id);
        if (actSem?.id) setActiveSemesterId(actSem.id);
        if (actYear?.name) setActiveYearName(actYear.name);
        if (actSem?.semester_type) setActiveSemesterType(actSem.semester_type);

        const relevantAsgs =
          activeRole === 'guru'
            ? academicService.filterAssignmentsForUser(asgs, user, teacher, tchs)
            : asgs;
        setAssignments(relevantAsgs);

        let initialCls = defaultClassId || '';
        if (!initialCls && defaultClassLevel) {
          initialCls = clss.find((c) => c.level === defaultClassLevel)?.id || '';
        }

        if (activeRole === 'guru' && relevantAsgs.length > 0) {
          const matchedAsg =
            relevantAsgs.find(
              (a) =>
                (!defaultSubjectId || a.subject_id === defaultSubjectId) &&
                (!initialCls || a.class_id === initialCls)
            ) || relevantAsgs[0];
          setDocClassId(initialCls || matchedAsg.class_id);
          setDocSubjectId(defaultSubjectId || matchedAsg.subject_id);
        } else {
          setDocClassId(initialCls || clss[0]?.id || '');
          setDocSubjectId(defaultSubjectId || sbjs[0]?.id || '');
        }
      } catch (err) {
        console.error('Gagal memuat referensi unggah dokumen:', err);
      }
    };

    void loadRefs();
  }, [isOpen, defaultDocType, defaultClassId, defaultClassLevel, defaultSubjectId, defaultTitle, activeRole, user]);

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

  if (!isOpen) return null;

  const modalClasses =
    activeRole === 'guru' && assignments.length > 0
      ? classes.filter((c) => assignments.some((a) => a.class_id === c.id))
      : classes;

  const modalSubjects =
    activeRole === 'guru' && assignments.length > 0
      ? subjects.filter((s) =>
          assignments.some((a) => a.subject_id === s.id && (!docClassId || a.class_id === docClassId))
        )
      : subjects;

  const currentDriveConfig = driveConfigSnapshot;
  const driveStatus = fileStorageService.getDriveStatusInfo(currentDriveConfig);
  const isAppsScriptActive = driveStatus.isHealthy;
  const isAppsScriptError = driveStatus.isError;
  const selectedClsPreview = classes.find((c) => c.id === docClassId);
  const selectedSbjPreview = subjects.find((s) => s.id === docSubjectId);
  const docTypeCfgPreview = CURRICULUM_DOC_TYPES.find((t) => t.value === docType);
  const structuredDrivePreview = fileStorageService.buildStructuredDrivePath({
    academicYearName: activeYearName,
    semesterType: activeSemesterType,
    className: selectedClsPreview?.name || 'Kelas',
    subjectName: selectedSbjPreview?.name || 'Mata Pelajaran',
    category: docType,
    categoryFolder: docTypeCfgPreview?.folder,
  });
  const fullDriveFolderPreview = `${currentDriveConfig.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo'} / ${structuredDrivePreview.displayPath}`;

  const handleConnectDrive = async () => {
    setErrorMsg(null);
    try {
      await connectGoogleDrive();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menyambungkan akun Google Drive. Pastikan pop-up diizinkan browser.');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fileToUpload) {
      setErrorMsg('Pilih berkas dokumen (PDF, Word, Excel, atau Gambar) terlebih dahulu.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Judul dokumen wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanTitle = title.trim();
      const uploaderName = user?.profile.full_name || resolvedTeacher?.full_name || 'Guru Madrasah';
      const selectedCls = classes.find((c) => c.id === docClassId);
      const selectedSbj = subjects.find((s) => s.id === docSubjectId);
      const docTypeCfg = CURRICULUM_DOC_TYPES.find((t) => t.value === docType);
      const driveConfig = await fileStorageService.hydrateConfigFromServer();
      setDriveConfigSnapshot(driveConfig);
      const appsScriptReady = fileStorageService.isAppsScriptActive(driveConfig);

      const structuredPath = fileStorageService.buildStructuredDrivePath({
        academicYearName: activeYearName,
        semesterType: activeSemesterType,
        className: selectedCls?.name || 'Administrasi Umum',
        subjectName: selectedSbj?.name || 'Umum Madrasah',
        category: docType,
        categoryFolder: docTypeCfg?.folder,
      });
      const fileNameToUse = fileStorageService.formatDriveFileName(
        cleanTitle,
        uploaderName,
        fileToUpload.name
      );

      let realDriveUrl = '';
      let realDriveFileId = '';
      let uploadedViaOAuth = false;

      // 1. Jika Apps Script belum aktif & OAuth terhubung, fallback unggah ke Google Drive via OAuth
      // (Bila Apps Script aktif, unggahan selalu dipusatkan ke Google Drive alihsansoborejo@gmail.com tanpa login)
      if (!appsScriptReady && isDriveConnected) {
        try {
          const driveDescription = `${docType} · ${selectedSbj?.name || 'Mapel'} · ${selectedCls?.name || 'Kelas'} · Pengunggah: ${uploaderName}`;
          const uploadedDriveFile = await uploadToGoogleDrive(
            fileToUpload,
            fileNameToUse,
            driveDescription,
            fileToUpload.type || 'application/octet-stream',
            structuredPath.categoryFolder,
            driveConfig.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo'
          );
          realDriveUrl = uploadedDriveFile.webViewLink || `https://drive.google.com/file/d/${uploadedDriveFile.id}/view`;
          realDriveFileId = uploadedDriveFile.id;
          uploadedViaOAuth = true;
        } catch (driveErr: any) {
          console.warn('Upload ke Google Drive API gagal, menggunakan arsip cadangan:', driveErr);
        }
      }

      // 2. Simpan berkas fisik di repositori dokumen madrasah (IndexedDB + sinkronisasi antarperangkat + Apps Script terstruktur)
      const saved = await fileStorageService.saveDocumentFile({
        file: fileToUpload,
        name: fileNameToUse,
        category: docType,
        categoryFolder: structuredPath.categoryFolder,
        folderPath: structuredPath.folderSegments,
        description: `${selectedSbj?.name || ''} (${selectedCls?.name || ''})`,
        uploadedBy: uploaderName,
        googleDriveUrl: realDriveUrl || undefined,
        driveFileId: realDriveFileId || undefined,
      });

      const uploadedViaAppsScript = Boolean(saved.uploadedViaAppsScript);
      const uploadedToGoogleDrive =
        uploadedViaOAuth ||
        uploadedViaAppsScript ||
        isRealDriveFileUrl(saved.googleDriveUrl) ||
        isRealDriveFileUrl(realDriveUrl);

      const finalDriveUrl =
        (isRealDriveFileUrl(saved.googleDriveUrl) ? saved.googleDriveUrl : '') ||
        (isRealDriveFileUrl(realDriveUrl) ? realDriveUrl : '') ||
        '';

      const createdDoc = await curriculumService.createDocument({
        teacher_id: resolvedTeacher?.id || user?.teacherId || user?.id || '',
        academic_year_id: activeYearId,
        semester_id: activeSemesterId,
        class_id: docClassId || classes[0]?.id || '',
        subject_id: docSubjectId || subjects[0]?.id || '',
        document_type: docType,
        title: cleanTitle,
        google_drive_url: finalDriveUrl,
        file_id: saved.id,
        status: submitToPrincipal ? 'Diajukan' : 'Draft',
        submission_date: submitToPrincipal ? new Date().toISOString() : null,
      });

      onSuccess?.(createdDoc, uploadedToGoogleDrive);
      setUploadedResult({
        file: saved,
        doc: createdDoc,
        uploadedToGoogleDrive,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengunggah dan mengarsipkan dokumen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!DRIVE_REGEX.test(driveUrl.trim())) {
      setErrorMsg('Format tautan tidak valid! Gunakan tautan resmi Google Drive / Docs / Sheets / Slides.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Judul dokumen wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const createdDoc = await curriculumService.createDocument({
        teacher_id: resolvedTeacher?.id || user?.teacherId || user?.id || '',
        academic_year_id: activeYearId,
        semester_id: activeSemesterId,
        class_id: docClassId || classes[0]?.id || '',
        subject_id: docSubjectId || subjects[0]?.id || '',
        document_type: docType,
        title: title.trim(),
        google_drive_url: driveUrl.trim(),
        file_id: null,
        status: submitToPrincipal ? 'Diajukan' : 'Draft',
        submission_date: submitToPrincipal ? new Date().toISOString() : null,
      });

      onSuccess?.(createdDoc, true);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menyimpan tautan dokumen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (uploadedResult) {
    return (
      <div className="fixed inset-0 z-50 w-screen h-screen bg-white flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-amber-300 shrink-0">
              <HardDrive className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">
                Pratinjau &amp; Status Dokumen Terunggah
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                Berkas &ldquo;{uploadedResult.doc.title}&rdquo; telah dicatat
                {uploadedResult.doc.status === 'Diajukan'
                  ? ' & dikirim ke Kepala Madrasah.'
                  : ' sebagai draf arsip.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-3 sm:p-5 flex flex-col overflow-hidden bg-slate-50/50">
          <FilePreviewContent
            file={uploadedResult.file}
            driveUploadError={uploadedResult.file.driveUploadError}
            fullWindow
            onFileUpdated={(updated) => {
              setUploadedResult((prev) =>
                prev
                  ? {
                      ...prev,
                      file: updated,
                      uploadedToGoogleDrive: true,
                    }
                  : null
              );
              if (updated.googleDriveUrl) {
                void curriculumService
                  .updateDocument(uploadedResult.doc.id, {
                    google_drive_url: updated.googleDriveUrl,
                  })
                  .then((updatedDoc) => {
                    onSuccess?.(updatedDoc, true);
                  })
                  .catch(() => {});
              }
            }}
          />
        </div>

        <div className="shrink-0 flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-t border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => {
              setUploadedResult(null);
              setFileToUpload(null);
              setTitle('');
              setErrorMsg(null);
            }}
            className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer"
          >
            Unggah Dokumen Lain
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs cursor-pointer"
          >
            Selesai &amp; Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-2xl border border-emerald-200 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-amber-300">
              <HardDrive className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Unggah &amp; Arsipkan ke Google Drive Madrasah
              </h3>
              <p className="text-[11px] text-slate-500">
                CP, TP, Modul Ajar, LKPD, &amp; Naskah Soal langsung dikirim ke Drive ({currentDriveConfig.ownerEmail || 'alihsansoborejo@gmail.com'}) dan Kepala Madrasah.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <>

        {/* Status Koneksi Google Drive */}
        <div
          className={`mb-4 rounded-xl p-3 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isAppsScriptError
              ? 'bg-rose-50/80 border-rose-200'
              : isAppsScriptActive || isDriveConnected
              ? 'bg-emerald-50/80 border-emerald-200'
              : 'bg-amber-50/70 border-amber-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <FolderSync
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                isAppsScriptError
                  ? 'text-rose-700'
                  : isAppsScriptActive || isDriveConnected
                  ? 'text-emerald-700'
                  : 'text-amber-700'
              }`}
            />
            <div className="text-[11px]">
              {isAppsScriptError ? (
                <>
                  <p className="font-bold text-rose-950">
                    Koneksi Google Apps Script Perlu Perbaikan (Upload Drive Tertunda)
                  </p>
                  <p className="text-rose-800 mt-0.5">
                    {driveStatus.errorMessage ||
                      'Web App Apps Script gagal dihubungi. Berkas tetap tersimpan di daftar arsip aplikasi & akan otomatis dikirim setelah Admin memperbaiki URL Apps Script.'}
                  </p>
                </>
              ) : isAppsScriptActive ? (
                <>
                  <p className="font-bold text-emerald-950">
                    Google Drive Aktif (Apps Script Tanpa Login · {currentDriveConfig.ownerEmail || 'alihsansoborejo@gmail.com'})
                  </p>
                  <p className="text-emerald-800">
                    Berkas langsung terkirim ke Google Drive {currentDriveConfig.ownerEmail || 'alihsansoborejo@gmail.com'} dari perangkat mana pun tanpa login.
                  </p>
                  <p className="mt-1 font-mono text-[10px] bg-white/80 px-2 py-1 rounded border border-emerald-200 text-emerald-900">
                    Folder tujuan: {fullDriveFolderPreview}
                  </p>
                </>
              ) : isDriveConnected ? (
                <>
                  <p className="font-bold text-emerald-950">
                    Google Drive Terhubung ({googleUser?.email || 'Akun Google'})
                  </p>
                  <p className="text-emerald-800">
                    Berkas otomatis diarsipkan ke folder <strong>{currentDriveConfig.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo'}</strong> &amp; tautannya dikirim ke Kepala Madrasah.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold text-amber-950">
                    Google Apps Script Drive Belum Diaktifkan Admin Madrasah
                  </p>
                  <p className="text-amber-800">
                    Berkas tetap tersimpan ke arsip aplikasi SIMPEL. Setelah Admin memasang URL Apps Script, unggahan langsung masuk ke Drive {currentDriveConfig.ownerEmail || 'alihsansoborejo@gmail.com'} tanpa login.
                  </p>
                </>
              )}
            </div>
          </div>

          {!isAppsScriptActive && !isDriveConnected && (
            <button
              type="button"
              onClick={handleConnectDrive}
              disabled={isDriveConnecting}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-semibold text-slate-800 shadow-2xs shrink-0 cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isDriveConnecting ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-emerald-200 mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setModalTab('upload')}
            className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              modalTab === 'upload'
                ? 'border-amber-500 text-emerald-950 font-bold'
                : 'border-transparent text-slate-500 hover:text-emerald-900'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Unggah Berkas Fisik</span>
          </button>
          <button
            type="button"
            onClick={() => setModalTab('url')}
            className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              modalTab === 'url'
                ? 'border-amber-500 text-emerald-950 font-bold'
                : 'border-transparent text-slate-500 hover:text-emerald-900'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Tautan URL Google Drive</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={modalTab === 'upload' ? handleUploadSubmit : handleLinkSubmit} className="space-y-3.5">
          {modalTab === 'upload' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pilih Berkas Dokumen (PDF / Word / Excel / Gambar) *
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const f = e.target.files[0];
                    setFileToUpload(f);
                    if (!title.trim()) setTitle(f.name.replace(/\.[^/.]+$/, ''));
                  }
                }}
                required
                className="w-full text-xs text-slate-600 border border-emerald-200 rounded-lg p-2 bg-emerald-50/30 file:mr-2.5 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-[11px] file:font-bold file:bg-amber-400 file:text-emerald-950 hover:file:bg-amber-500 cursor-pointer"
              />
            </div>
          )}

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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Dokumen *</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
              required
            >
              {CURRICULUM_DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Dokumen *</label>
            <input
              type="text"
              placeholder="Contoh: Modul Ajar Bab 2 / Naskah Soal STS Bahasa Indonesia"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
              required
            />
          </div>

          {modalTab === 'url' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tautan URL Google Drive *</label>
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
          )}

          {/* Opsi kirim langsung ke Kepala Madrasah */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={submitToPrincipal}
              onChange={(e) => setSubmitToPrincipal(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-emerald-800 rounded border-slate-300 focus:ring-emerald-700 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-bold text-slate-900 block">
                Langsung kirim ke Dashboard Kepala Madrasah untuk ditelaah
              </span>
              <span className="text-[11px] text-slate-500">
                Jika dicentang, dokumen langsung berstatus <strong>Diajukan</strong> dan muncul di antrean telaah Kepala Madrasah. Jika tidak dicentang, disimpan sebagai <strong>Draf</strong>.
              </span>
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (modalTab === 'upload' && !fileToUpload)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 text-emerald-950 font-bold rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitToPrincipal ? <Send className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>
                {isSubmitting
                  ? 'Mengunggah & Menyimpan...'
                  : submitToPrincipal
                  ? 'Arsipkan ke Drive & Kirim ke Kamad'
                  : 'Arsipkan sebagai Draf'}
              </span>
            </button>
          </div>
        </form>
        </>
      </div>
    </div>
  );
};
