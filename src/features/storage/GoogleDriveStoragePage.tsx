import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { curriculumService } from '../../services/curriculumService';
import { academicService } from '../../services/academicService';
import {
  fileStorageService,
  StoredDocumentFile,
  DriveIntegrationConfig,
  isRealDriveFileUrl,
} from '../../services/fileStorageService';
import { useGoogleDrive } from '../../context/GoogleDriveContext';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { CURRICULUM_DOC_TYPES } from '../../components/curriculum/DriveDocumentUploadModal';
import { FilePreviewModal } from '../../components/curriculum/FilePreviewModal';
import { ClassRoom, Subject, TeachingAssignment, Teacher } from '../../types/database.types';
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
  Send,
} from 'lucide-react';

export const GoogleDriveStoragePage: React.FC = () => {
  const { user, activeRole } = useAuth();
  const {
    isConnected: isFirebaseDriveConnected,
    isConnecting: isFirebaseConnecting,
    connect: connectFirebase,
    disconnect: disconnectFirebase,
    uploadFile: uploadToGoogleDrive,
    googleUser,
  } = useGoogleDrive();

  // Tab utama: 'upload', 'files', 'settings'
  const [activeTab, setActiveTab] = useState<'upload' | 'files' | 'settings'>('upload');

  // Referensi Akademik Real
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [resolvedTeacher, setResolvedTeacher] = useState<Teacher | null>(null);
  const [activeYearId, setActiveYearId] = useState<string>('ay-2026');
  const [activeSemesterId, setActiveSemesterId] = useState<string>('sem-ganjil-2026');
  const [activeYearName, setActiveYearName] = useState<string>('2026/2027');
  const [activeSemesterType, setActiveSemesterType] = useState<string>('Ganjil');

  // Daftar berkas lokal IndexedDB
  const [storedFiles, setStoredFiles] = useState<StoredDocumentFile[]>([]);
  const [isLoadingStoredFiles, setIsLoadingStoredFiles] = useState<boolean>(true);
  const [pendingDeleteFile, setPendingDeleteFile] = useState<{ id: string; name: string } | null>(null);

  // Form State Upload Langsung
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customFileName, setCustomFileName] = useState<string>('');
  const [docCategory, setDocCategory] = useState<string>('Modul Ajar');
  const [docClassId, setDocClassId] = useState<string>('');
  const [docSubjectId, setDocSubjectId] = useState<string>('');
  const [manualDriveUrl, setManualDriveUrl] = useState<string>('');
  const [fileDescription, setFileDescription] = useState<string>('');
  const [autoRegisterCurriculum, setAutoRegisterCurriculum] = useState<boolean>(true);
  const [submitToPrincipal, setSubmitToPrincipal] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewModalState, setPreviewModalState] = useState<{
    file: StoredDocumentFile;
    title?: string;
    driveUploadError?: string;
    curriculumDocId?: string;
  } | null>(null);

  // Pengaturan Integrasi
  const [driveConfig, setDriveConfig] = useState<DriveIntegrationConfig>(() =>
    fileStorageService.getConfig()
  );
  const [savedConfigNotice, setSavedConfigNotice] = useState<boolean>(false);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [isTestingScript, setIsTestingScript] = useState<boolean>(false);
  const [scriptTestResult, setScriptTestResult] = useState<{
    success: boolean;
    message: string;
    folderUrl?: string;
  } | null>(null);

  const isAdmin = activeRole === 'admin';
  const driveStatus = fileStorageService.getDriveStatusInfo(driveConfig);
  const isAppsScriptActive = driveStatus.isHealthy;
  const isAppsScriptError = driveStatus.isError;

  const loadRefs = useCallback(async () => {
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

      if (activeRole === 'guru' && relevantAsgs.length > 0) {
        setDocClassId((prev) => prev || relevantAsgs[0].class_id);
        setDocSubjectId((prev) => prev || relevantAsgs[0].subject_id);
      } else {
        setDocClassId((prev) => prev || clss[0]?.id || '');
        setDocSubjectId((prev) => prev || sbjs[0]?.id || '');
      }
    } catch (err) {
      console.warn('Gagal memuat referensi kelas/mapel:', err);
    }
  }, [user, activeRole]);

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
    void loadStoredFiles();
    void loadRefs();
    void fileStorageService.hydrateConfigFromServer().then((cfg) => {
      setDriveConfig(cfg);
    });
  }, [loadRefs]);

  useRealtimeSync(
    ['simpel_drive_storage_config_v1', 'simpel_curriculum_documents', 'simpel_classes', 'simpel_subjects', 'simpel_assignments', 'simpel_teachers', 'simpel_users_cache_v2'],
    () => {
      setDriveConfig(fileStorageService.getConfig());
      void loadStoredFiles();
      void loadRefs();
    },
    true
  );

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

  const selectedClsPreview = classes.find((c) => c.id === docClassId);
  const selectedSbjPreview = subjects.find((s) => s.id === docSubjectId);
  const docTypeCfgPreview = CURRICULUM_DOC_TYPES.find((t) => t.value === docCategory);
  const structuredDrivePreview = fileStorageService.buildStructuredDrivePath({
    academicYearName: activeYearName,
    semesterType: activeSemesterType,
    className: selectedClsPreview?.name || 'Administrasi Umum',
    subjectName: selectedSbjPreview?.name || 'Umum Madrasah',
    category: docCategory,
    categoryFolder: docTypeCfgPreview?.folder,
  });
  const fullDriveFolderPreview = `${driveConfig.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo'} / ${structuredDrivePreview.displayPath}`;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!customFileName) {
        setCustomFileName(file.name);
      }
    }
  };

  // Simpan berkas langsung + Upload otomatis ke Google Drive Madrasah jika terhubung
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
      const latestConfig = await fileStorageService.hydrateConfigFromServer();
      setDriveConfig(latestConfig);
      const appsScriptReady = fileStorageService.isAppsScriptActive(latestConfig);

      const uploaderName = user?.profile.full_name || resolvedTeacher?.full_name || 'Guru Madrasah';
      const selectedCls = classes.find((c) => c.id === docClassId);
      const selectedSbj = subjects.find((s) => s.id === docSubjectId);
      const docTypeCfg = CURRICULUM_DOC_TYPES.find((t) => t.value === docCategory);

      const structuredPath = fileStorageService.buildStructuredDrivePath({
        academicYearName: activeYearName,
        semesterType: activeSemesterType,
        className: selectedCls?.name || 'Administrasi Umum',
        subjectName: selectedSbj?.name || 'Umum Madrasah',
        category: docCategory,
        categoryFolder: docTypeCfg?.folder,
      });

      const rawBaseName = customFileName.trim() || selectedFile.name;
      const finalFileName = fileStorageService.formatDriveFileName(
        rawBaseName,
        uploaderName,
        selectedFile.name
      );

      let realDriveUrl = manualDriveUrl.trim();
      let realDriveFileId = '';
      let uploadedViaOAuth = false;

      // Prioritaskan Google Apps Script (alihsansoborejo@gmail.com tanpa login) jika sudah aktif
      if (!appsScriptReady && isFirebaseDriveConnected && !realDriveUrl) {
        try {
          const uploadedDriveFile = await uploadToGoogleDrive(
            selectedFile,
            finalFileName,
            `${docCategory} · ${selectedSbj?.name || 'Mapel'} · ${selectedCls?.name || 'Kelas'}${fileDescription ? ` · ${fileDescription}` : ''}`,
            selectedFile.type || 'application/octet-stream',
            structuredPath.categoryFolder,
            latestConfig.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo'
          );
          realDriveUrl =
            uploadedDriveFile.webViewLink || `https://drive.google.com/file/d/${uploadedDriveFile.id}/view`;
          realDriveFileId = uploadedDriveFile.id;
          uploadedViaOAuth = true;
        } catch (driveErr) {
          console.warn('Upload ke Google Drive API gagal, menggunakan penyimpanan lokal:', driveErr);
        }
      }

      // 1. Simpan berkas ke penyimpanan madrasah (IndexedDB + sinkronisasi antarperangkat + Apps Script terstruktur)
      const saved = await fileStorageService.saveDocumentFile({
        file: selectedFile,
        name: finalFileName,
        category: docCategory,
        categoryFolder: structuredPath.categoryFolder,
        folderPath: structuredPath.folderSegments,
        description:
          fileDescription ||
          `${selectedSbj?.name || 'Mata Pelajaran'} (${selectedCls?.name || 'Rombel'})`,
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

      // 2. Daftarkan otomatis ke Dokumen Kurikulum / Antrean Telaah Kepala Madrasah
      let createdDocId = '';
      if (autoRegisterCurriculum) {
        const driveLink =
          (isRealDriveFileUrl(saved.googleDriveUrl) ? saved.googleDriveUrl : '') ||
          (isRealDriveFileUrl(realDriveUrl) ? realDriveUrl : '') ||
          '';
        const createdDoc = await curriculumService.createDocument({
          teacher_id: resolvedTeacher?.id || user?.teacherId || user?.id || '',
          academic_year_id: activeYearId,
          semester_id: activeSemesterId,
          class_id: docClassId || classes[0]?.id || '',
          subject_id: docSubjectId || subjects[0]?.id || '',
          document_type: docCategory,
          title: rawBaseName.replace(/\.[^/.]+$/, ''),
          google_drive_url: driveLink,
          file_id: saved.id,
          status: submitToPrincipal ? 'Diajukan' : 'Draft',
          submission_date: submitToPrincipal ? new Date().toISOString() : null,
        });
        createdDocId = createdDoc.id;
      }

      if (saved.driveUploadError && !uploadedViaOAuth) {
        setErrorMessage(
          `Berkas tersimpan di arsip aplikasi, namun sinkronisasi ke Google Apps Script gagal: ${saved.driveUploadError}`
        );
      }

      setStatusMessage(
        `Berkas "${finalFileName}" berhasil diarsipkan${
          uploadedViaAppsScript
            ? ` ke Google Drive ${latestConfig.ownerEmail || 'alihsansoborejo@gmail.com'} (Folder: ${saved.folderPath || structuredPath.displayPath})`
            : uploadedToGoogleDrive
            ? ' ke Google Drive Madrasah'
            : ''
        }${
          autoRegisterCurriculum && submitToPrincipal
            ? ' dan langsung dikirim ke Dashboard Kepala Madrasah untuk ditelaah!'
            : '!'
        }`
      );

      // Reset form & reload data, lalu tampilkan pratinjau berkas
      setSelectedFile(null);
      setCustomFileName('');
      setFileDescription('');
      setManualDriveUrl('');
      await loadStoredFiles();
      setActiveTab('files');
      setPreviewModalState({
        file: saved,
        title: `Pratinjau Unggahan: ${finalFileName}`,
        driveUploadError: saved.driveUploadError,
        curriculumDocId: createdDocId || undefined,
      });
    } catch (err: any) {
      console.error('Error saat menyimpan berkas:', err);
      setErrorMessage(err?.message || 'Gagal menyimpan berkas.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const trimmedWebhook = (driveConfig.appsScriptWebhookUrl || '').trim();
    const hasScriptUrl = trimmedWebhook.startsWith('https://script.google.com');
    const draftConfig: DriveIntegrationConfig = {
      ...driveConfig,
      appsScriptWebhookUrl: trimmedWebhook,
      sharedFolderUrl: (driveConfig.sharedFolderUrl || '').trim(),
      ownerEmail: (driveConfig.ownerEmail || 'alihsansoborejo@gmail.com').trim(),
      autoUploadToDrive: hasScriptUrl ? driveConfig.autoUploadToDrive : false,
      activatedBy:
        hasScriptUrl && driveConfig.autoUploadToDrive
          ? user?.profile?.full_name || 'Admin Madrasah'
          : driveConfig.activatedBy,
      activatedAt:
        hasScriptUrl && driveConfig.autoUploadToDrive ? new Date().toISOString() : driveConfig.activatedAt,
    };
    const nextConfig = fileStorageService.saveConfig(draftConfig);
    setDriveConfig(nextConfig);
    setSavedConfigNotice(true);
    setTimeout(() => setSavedConfigNotice(false), 3500);

    // Otomatis uji koneksi saat URL Apps Script disimpan agar status langsung akurat
    if (hasScriptUrl && draftConfig.autoUploadToDrive !== false) {
      await runTestAppsScript(nextConfig);
    }
  };

  const runTestAppsScript = async (configToTest: DriveIntegrationConfig) => {
    setIsTestingScript(true);
    setScriptTestResult(null);
    try {
      const result = await fileStorageService.testAppsScriptConnection(configToTest);
      setScriptTestResult(result);
      const updated = fileStorageService.saveConfig({
        ...configToTest,
        ownerEmail: result.ownerEmail || configToTest.ownerEmail || 'alihsansoborejo@gmail.com',
        autoUploadToDrive: result.success ? true : configToTest.autoUploadToDrive,
        sharedFolderUrl:
          result.success &&
          (!configToTest.sharedFolderUrl || configToTest.sharedFolderUrl === 'https://drive.google.com') &&
          result.folderUrl
            ? result.folderUrl
            : configToTest.sharedFolderUrl,
        activatedBy: result.success ? user?.profile?.full_name || 'Admin Madrasah' : configToTest.activatedBy,
        activatedAt: result.success ? new Date().toISOString() : configToTest.activatedAt,
        lastTestAt: new Date().toISOString(),
        lastTestStatus: result.success ? 'connected' : 'error',
        lastTestMessage: result.message,
      });
      setDriveConfig(updated);

      if (result.success) {
        const pendingSync = await fileStorageService.syncPendingFilesToDrive();
        if (pendingSync.synced > 0) {
          setStatusMessage(
            `Koneksi berhasil! ${pendingSync.synced} berkas arsip yang tertunda telah otomatis dikirim ke Google Drive.`
          );
          await loadStoredFiles();
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Gagal menghubungi Google Apps Script.';
      setScriptTestResult({
        success: false,
        message: errMsg,
      });
      const updated = fileStorageService.saveConfig({
        ...configToTest,
        lastTestAt: new Date().toISOString(),
        lastTestStatus: 'error',
        lastTestMessage: errMsg,
      });
      setDriveConfig(updated);
    } finally {
      setIsTestingScript(false);
    }
  };

  const handleTestAppsScript = async () => {
    if (!isAdmin) return;
    await runTestAppsScript(driveConfig);
  };

  const handleConfirmDeleteFile = async () => {
    if (!pendingDeleteFile) return;
    await fileStorageService.deleteFile(pendingDeleteFile.id);
    setStatusMessage(`Berkas "${pendingDeleteFile.name}" berhasil dihapus dari penyimpanan.`);
    setPendingDeleteFile(null);
    await loadStoredFiles();
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
            <HardDrive className="w-5 h-5 text-emerald-700" />
            <span>Pusat Penyimpanan &amp; Arsip Google Drive Madrasah</span>
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Semua berkas yang diunggah dari perangkat mana pun otomatis tersimpan ke Google Drive{' '}
            <strong className="text-emerald-800">{driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'}</strong> tanpa perlu login Google.
          </p>
        </div>

        {/* Status Koneksi Google Drive + Tautan Cepat */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAppsScriptActive ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold">
                Drive Aktif ({driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'} · Tanpa Login)
              </span>
            </div>
          ) : isAppsScriptError ? (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg text-xs text-rose-900 font-semibold cursor-pointer"
              title={driveStatus.errorMessage || 'Periksa konfigurasi Apps Script'}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Koneksi Apps Script Bermasalah (Klik Perbaiki)</span>
            </button>
          ) : isFirebaseDriveConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold truncate max-w-[160px]">{googleUser?.email || 'Drive Terhubung'}</span>
              <button
                type="button"
                onClick={disconnectFirebase}
                className="text-[10px] font-bold text-rose-700 hover:underline ml-1 cursor-pointer"
              >
                Putuskan
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => (isAdmin ? setActiveTab('settings') : void connectFirebase())}
              disabled={isFirebaseConnecting}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 border border-amber-500 text-emerald-950 font-bold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-950" />
              <span>
                {isAdmin
                  ? 'Atur Apps Script (Tanpa Login)'
                  : isFirebaseConnecting
                  ? 'Menghubungkan...'
                  : 'Sambungkan Akun Google (Opsional)'}
              </span>
            </button>
          )}

          {driveConfig.sharedFolderUrl && (
            <a
              href={driveConfig.sharedFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-amber-50 text-emerald-900 border border-emerald-300 hover:border-amber-400 font-semibold text-xs rounded-lg shadow-2xs transition-colors"
            >
              <FolderSync className="w-4 h-4 text-amber-600" />
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
      <div className="flex border-b border-emerald-200 bg-white rounded-t-xl px-4 pt-2 gap-2 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('upload')}
          className={`py-2.5 px-4 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'upload'
              ? 'border-amber-500 text-emerald-950 font-bold'
              : 'border-transparent text-slate-500 hover:text-emerald-900'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>Unggah Berkas Baru</span>
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`py-2.5 px-4 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'files'
              ? 'border-amber-500 text-emerald-950 font-bold'
              : 'border-transparent text-slate-500 hover:text-emerald-900'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Daftar Berkas Tersimpan ({storedFiles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`py-2.5 px-4 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'settings'
              ? 'border-amber-500 text-emerald-950 font-bold'
              : 'border-transparent text-slate-500 hover:text-emerald-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Konfigurasi Google Apps Script</span>
        </button>
      </div>

      {/* Konten Tab 1: Unggah Berkas Baru */}
      {activeTab === 'upload' && (
        <div className="bg-white border border-emerald-200/80 rounded-b-xl p-6 shadow-xs space-y-6">
          <div
            className={`border rounded-xl p-4 flex items-start gap-3 ${
              isAppsScriptError
                ? 'bg-rose-50/80 border-rose-300'
                : isAppsScriptActive || isFirebaseDriveConnected
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-amber-50/80 border-amber-300'
            }`}
          >
            <ShieldCheck
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                isAppsScriptError
                  ? 'text-rose-700'
                  : isAppsScriptActive || isFirebaseDriveConnected
                  ? 'text-emerald-800'
                  : 'text-amber-700'
              }`}
            />
            <div className="text-xs leading-relaxed">
              <p className="font-bold text-slate-900">
                {isAppsScriptError
                  ? 'Koneksi Google Apps Script Gagal / Ditolak (Perlu Perbaikan Admin)'
                  : isAppsScriptActive
                  ? `Google Drive Madrasah Aktif (${driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'} · Tanpa Login)`
                  : isFirebaseDriveConnected
                  ? 'Google Drive Terhubung via Akun Google'
                  : 'Google Apps Script Drive Belum Diaktifkan Admin Madrasah'}
              </p>
              <p className="mt-0.5 text-slate-700">
                {isAppsScriptError
                  ? driveStatus.errorMessage ||
                    'Google Apps Script mengembalikan HTTP 403 / halaman login. Pastikan skrip di-deploy memakai akun @gmail.com biasa (bukan @belajar.id) dengan Who has access = Anyone.'
                  : isAppsScriptActive
                  ? `Seluruh guru dapat mengunggah berkas dari HP atau laptop mana pun tanpa login Google. Berkas langsung terkirim ke Google Drive ${driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'}.`
                  : 'Berkas tersimpan sementara di arsip aplikasi. Agar setiap berkas otomatis terkirim ke Google Drive alihsansoborejo@gmail.com dari perangkat mana pun tanpa login, Admin Madrasah dapat menempelkan URL Web App pada tab Konfigurasi Google Apps Script.'}
              </p>
              <p className="mt-1.5 font-mono text-[10px] bg-white/80 px-2.5 py-1 rounded-md border border-emerald-200 text-emerald-900">
                Susunan Folder Tujuan: {fullDriveFolderPreview}
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
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  required
                  className="w-full text-xs text-slate-600 border border-slate-300 rounded-lg p-2.5 bg-emerald-50/30 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-amber-400 file:text-emerald-950 hover:file:bg-amber-500 cursor-pointer"
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
                  {CURRICULUM_DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                  <option value="Kriteria Ketercapaian (KKTP)">KKTP / Interval Nilai</option>
                  <option value="Lainnya">Dokumen Administrasi Lainnya</option>
                </select>
              </div>

              {/* Kelas / Rombel */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Kelas / Rombel</label>
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
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  {modalClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mata Pelajaran */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Mata Pelajaran</label>
                <select
                  value={docSubjectId}
                  onChange={(e) => setDocSubjectId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  {modalSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
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
                  <span className="text-[10px] text-slate-400 font-normal">Otomatis terisi jika Drive terhubung</span>
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
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoRegCurriculum"
                  checked={autoRegisterCurriculum}
                  onChange={(e) => setAutoRegisterCurriculum(e.target.checked)}
                  className="w-4 h-4 text-emerald-800 rounded-sm border-slate-300 focus:ring-emerald-700 cursor-pointer"
                />
                <label htmlFor="autoRegCurriculum" className="text-xs text-slate-700 cursor-pointer">
                  Daftarkan ke <strong>Arsip Kurikulum Madrasah</strong> agar terhubung ke mata pelajaran &amp; rombel.
                </label>
              </div>

              {autoRegisterCurriculum && (
                <div className="flex items-center gap-2 pl-6">
                  <input
                    type="checkbox"
                    id="submitToPrincipalCheck"
                    checked={submitToPrincipal}
                    onChange={(e) => setSubmitToPrincipal(e.target.checked)}
                    className="w-4 h-4 text-emerald-800 rounded-sm border-slate-300 focus:ring-emerald-700 cursor-pointer"
                  />
                  <label htmlFor="submitToPrincipalCheck" className="text-xs text-slate-700 cursor-pointer">
                    Langsung kirim ke <strong>Dashboard Kepala Madrasah (Diajukan)</strong> untuk ditelaah &amp; disetujui.
                  </label>
                </div>
              )}
            </div>

            {/* Tombol Simpan */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 text-emerald-950 font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {autoRegisterCurriculum && submitToPrincipal ? (
                  <Send className="w-4 h-4" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                <span>
                  {isUploading
                    ? 'Mengarsipkan...'
                    : autoRegisterCurriculum && submitToPrincipal
                    ? 'Arsipkan ke Drive & Kirim ke Kamad'
                    : 'Unggah & Simpan Berkas Sekarang'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Konten Tab 2: Daftar Berkas Tersimpan */}
      {activeTab === 'files' && (
        <div className="bg-white border border-emerald-200/80 rounded-b-xl overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-emerald-100 flex items-center justify-between bg-emerald-50/40">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-700" />
                <span>Daftar Berkas Dokumen Tersimpan</span>
              </h2>
              <p className="text-[11px] text-slate-500">Berkas fisik yang tersimpan dan siap diunduh atau dipratinjau.</p>
            </div>

            <button
              onClick={loadStoredFiles}
              disabled={isLoadingStoredFiles}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStoredFiles ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>

          {isLoadingStoredFiles ? (
            <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
              <span>Memuat berkas tersimpan...</span>
            </div>
          ) : storedFiles.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs space-y-3">
              <FileText className="w-10 h-10 text-emerald-300 mx-auto" />
              <p className="font-semibold text-slate-700">Belum ada berkas dokumen yang diunggah.</p>
              <p className="text-[11px] text-slate-400">
                Gunakan tab &quot;Unggah Berkas Baru&quot; untuk menyimpan modul ajar atau dokumen pertama Anda.
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-emerald-950 rounded-lg text-xs font-bold cursor-pointer hover:from-amber-500 hover:to-yellow-500"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Unggah Berkas Sekarang</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-emerald-50/70 text-emerald-950 border-b border-emerald-200 uppercase text-[10px] tracking-wider">
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
                    <tr key={file.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="truncate max-w-[260px]" title={file.name}>
                                {file.name}
                              </span>
                              {isRealDriveFileUrl(file.googleDriveUrl) ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-800">
                                  Terkirim ke Google Drive
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[9px] font-bold text-amber-800">
                                  Arsip Perangkat (Belum di Drive)
                                </span>
                              )}
                            </div>
                            {file.folderPath && (
                              <p className="text-[10px] text-slate-500 font-mono truncate max-w-[320px]" title={file.folderPath}>
                                {file.folderPath}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded font-semibold text-[10px]">
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
                          {/* Pratinjau Full Window */}
                          <button
                            onClick={() =>
                              setPreviewModalState({
                                file,
                                title: `Pratinjau: ${file.name}`,
                                driveUploadError: file.driveUploadError,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-[11px] transition-colors cursor-pointer"
                            title="Preview Dokumen (Tampilan Layar Penuh)"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview Dokumen</span>
                          </button>

                          {/* Unduh Berkas Fisik */}
                          <button
                            onClick={() => fileStorageService.downloadStoredFile(file)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-amber-50 text-emerald-900 border border-emerald-200 hover:border-amber-300 rounded font-medium text-[11px] transition-colors cursor-pointer"
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
                              className="p-1 text-emerald-700 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                              title="Buka Tautan Google Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Hapus */}
                          <button
                            onClick={() => setPendingDeleteFile({ id: file.id, name: file.name })}
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
        <div className="bg-white border border-emerald-200/80 rounded-b-xl p-6 shadow-xs space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 mb-1">
                    Pengaturan &amp; Aktivasi Google Drive ({driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'})
                  </h2>
                  <p className="text-xs text-slate-600">
                    Konfigurasi Web App Google Apps Script agar berkas yang diunggah dari laptop atau HP mana pun langsung tersimpan ke Google Drive{' '}
                    <strong>{driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'}</strong> tanpa login.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 border ${
                    isAppsScriptActive
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : isAppsScriptError
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {isAppsScriptActive
                    ? 'Apps Script Aktif'
                    : isAppsScriptError
                    ? 'Apps Script Error (Cek Uji Koneksi)'
                    : 'Belum Diaktifkan'}
                </span>
              </div>

              {!isAdmin ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Pengaktifan Khusus Admin Madrasah</span>
                  </p>
                  <p className="leading-relaxed">
                    Pengaturan URL Web App Google Apps Script dilakukan oleh <strong>Admin Madrasah</strong>. Setelah diaktifkan oleh Admin, seluruh guru dapat langsung mengunggah berkas ke Google Drive{' '}
                    <strong>{driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'}</strong> dari perangkat mana pun tanpa login.
                  </p>
                  <div className="pt-2 border-t border-amber-200/70 text-[11px] space-y-1">
                    <p>
                      <strong>Status Integrasi:</strong>{' '}
                      {isAppsScriptActive
                        ? 'Aktif (Unggah otomatis via Google Apps Script)'
                        : 'Belum diaktifkan oleh Admin Madrasah'}
                    </p>
                    <p>
                      <strong>Akun Drive Tujuan:</strong> {driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'}
                    </p>
                    <p>
                      <strong>Folder Tujuan:</strong> {driveConfig.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo'}
                    </p>
                    {driveConfig.activatedBy && (
                      <p>
                        <strong>Diaktifkan oleh:</strong> {driveConfig.activatedBy}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveConfig} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Akun Google Drive Tujuan
                      </label>
                      <input
                        type="email"
                        value={driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'}
                        onChange={(e) => setDriveConfig({ ...driveConfig, ownerEmail: e.target.value })}
                        className="w-full text-xs border border-emerald-200 bg-emerald-50/40 rounded-lg px-3 py-2 font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Folder Madrasah di Google Drive
                      </label>
                      <input
                        type="text"
                        value={driveConfig.driveFolderName}
                        onChange={(e) => setDriveConfig({ ...driveConfig, driveFolderName: e.target.value })}
                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tautan Folder Google Drive Utama (Opsional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoP..."
                      value={driveConfig.sharedFolderUrl}
                      onChange={(e) => setDriveConfig({ ...driveConfig, sharedFolderUrl: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Jika dikosongkan, Apps Script akan otomatis membuat folder "{driveConfig.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo'}" di Drive {driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'}.
                    </p>
                  </div>

                  {/* Opsi Web App Google Apps Script (Upload Otomatis ke Drive tanpa Login) */}
                  <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <Code2 className="w-4 h-4 text-amber-600" />
                        <span>Web App Google Apps Script (Tanpa Login Perangkat Mana Pun)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowScriptModal(true)}
                        className="text-[11px] font-bold text-emerald-800 hover:text-amber-700 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Lihat &amp; Salin Skrip Penuh</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        URL Web App Google Apps Script (/exec) *
                      </label>
                      <input
                        type="url"
                        placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                        value={driveConfig.appsScriptWebhookUrl}
                        onChange={(e) => {
                          const nextUrl = e.target.value;
                          setDriveConfig({
                            ...driveConfig,
                            appsScriptWebhookUrl: nextUrl,
                            autoUploadToDrive: nextUrl.trim().startsWith('https://script.google.com')
                              ? true
                              : driveConfig.autoUploadToDrive,
                          });
                        }}
                        className="w-full text-xs border border-emerald-300 rounded-lg px-3 py-2 font-mono bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    <label className="flex items-center gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(driveConfig.autoUploadToDrive)}
                        onChange={(e) =>
                          setDriveConfig({ ...driveConfig, autoUploadToDrive: e.target.checked })
                        }
                        className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-600 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        Aktifkan Upload Otomatis ke Drive {driveConfig.ownerEmail || 'alihsansoborejo@gmail.com'} untuk Seluruh Perangkat (Tanpa Login)
                      </span>
                    </label>

                    {scriptTestResult && (
                      <div
                        className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                          scriptTestResult.success
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-rose-50 border-rose-200 text-rose-900'
                        }`}
                      >
                        {scriptTestResult.success ? (
                          <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <p className="font-semibold">{scriptTestResult.message}</p>
                          {scriptTestResult.folderUrl && (
                            <a
                              href={scriptTestResult.folderUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 underline font-bold text-emerald-800"
                            >
                              <span>Buka Folder Terhubung</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {!scriptTestResult && driveConfig.lastTestMessage && (
                      <p className="text-[11px] text-slate-500">
                        Uji terakhir ({driveConfig.lastTestAt ? new Date(driveConfig.lastTestAt).toLocaleString('id-ID') : '-'}):{' '}
                        <span className={driveConfig.lastTestStatus === 'connected' ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                          {driveConfig.lastTestMessage}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2 flex-wrap">
                    <button
                      type="submit"
                      className="px-5 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 text-emerald-950 font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer"
                    >
                      Simpan &amp; Sinkronkan ke Semua Perangkat
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleTestAppsScript()}
                      disabled={isTestingScript || !driveConfig.appsScriptWebhookUrl.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 font-semibold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingScript ? 'animate-spin' : ''}`} />
                      <span>{isTestingScript ? 'Menguji Koneksi...' : 'Uji Koneksi Apps Script'}</span>
                    </button>

                    {savedConfigNotice && (
                      <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Pengaturan tersimpan &amp; disinkronkan ke seluruh perangkat!</span>
                      </span>
                    )}
                  </div>
                </form>
              )}
            </div>

            {/* Panel Panduan Langkah Konfigurasi Google Apps Script */}
            <div className="lg:col-span-5 bg-emerald-950 text-emerald-50 rounded-xl p-5 border border-amber-400/30 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-amber-400" />
                  <span>Langkah Konfigurasi Apps Script</span>
                </h3>
                <button
                  type="button"
                  onClick={() => handleCopy(fileStorageService.getAppsScriptTemplateCode(), 'inline-script')}
                  className="px-2.5 py-1 rounded-md bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedId === 'inline-script' ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      <span>Skrip Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Salin Kode Skrip</span>
                    </>
                  )}
                </button>
              </div>

              <ol className="list-decimal pl-4 space-y-2 text-[11px] text-emerald-100/90 leading-relaxed">
                <li>
                  Masuk browser dengan akun <strong className="text-amber-300">@gmail.com biasa</strong> (contoh:{' '}
                  <strong className="text-amber-300">alihsansoborejo@gmail.com</strong> — <em>jangan memakai akun @belajar.id</em> karena Google Workspace pendidikan memblokir akses tanpa login), lalu buka{' '}
                  <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-amber-300 underline font-semibold">
                    script.google.com
                  </a>{' '}
                  dan klik <strong>New project</strong>.
                </li>
                <li>
                  Hapus kode default <code>myFunction()</code>, lalu tempel kode skrip dari tombol <strong>Salin Kode Skrip</strong> di atas dan klik <strong>Save</strong>.
                </li>
                <li>
                  Klik <strong>Deploy &gt; New deployment</strong> &gt; ikon roda gigi &gt; pilih <strong>Web app</strong>.
                </li>
                <li>
                  Atur <strong className="text-amber-300">Execute as</strong>: <code>Me (alihsansoborejo@gmail.com)</code> dan{' '}
                  <strong className="text-amber-300">Who has access</strong>: <code>Anyone</code> (Siapa saja).
                </li>
                <li>
                  Klik <strong>Deploy &gt; Authorize access</strong>, pilih akun <code>alihsansoborejo@gmail.com</code> (jika muncul peringatan <em>Google hasn&apos;t verified this app</em>, klik <strong>Advanced &gt; Go to ... (unsafe) &gt; Allow</strong>).
                </li>
                <li>
                  Salin <strong>Web app URL</strong> (akhiran <code>/exec</code>), tempel di form sebelah kiri, lalu klik <strong>Uji Koneksi Apps Script</strong>.
                </li>
              </ol>

              <div className="p-2.5 rounded-lg bg-emerald-900/70 border border-amber-400/25 text-[10px] text-emerald-100 space-y-1">
                <p className="font-bold text-amber-300">Susunan Folder Otomatis di Google Drive (Skrip v2):</p>
                <p className="font-mono leading-relaxed">
                  {driveConfig.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo'} &gt; TA &amp; Semester &gt; Kelas &gt; Mata Pelajaran &gt; 01..08 Kategori Perangkat
                </p>
                <p className="text-emerald-200/80">
                  Sudah pernah deploy skrip lama? Salin ulang skrip terbaru lalu pilih <strong>Deploy &gt; Manage deployments &gt; Edit &gt; Version: New version &gt; Deploy</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowScriptModal(true)}
                className="w-full py-2 rounded-lg bg-emerald-900 hover:bg-emerald-800 border border-amber-400/40 text-amber-300 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Lihat Kode Lengkap Google Apps Script
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Panduan Skrip Google Apps Script */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-emerald-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-700" />
                <span>Skrip Google Apps Script (Target: alihsansoborejo@gmail.com)</span>
              </h3>
              <button
                onClick={() => setShowScriptModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              Skrip ini memungkinkan aplikasi mengirim seluruh berkas yang diunggah dari perangkat mana pun langsung ke Google Drive{' '}
              <strong className="text-slate-900">alihsansoborejo@gmail.com</strong> tanpa perlu login akun Google pada perangkat pengunggah.
            </p>

            <div className="bg-emerald-950 text-emerald-50 p-3.5 rounded-lg text-[11px] font-mono overflow-x-auto relative mb-4 border border-amber-400/30">
              <pre>{fileStorageService.getAppsScriptTemplateCode()}</pre>
              <button
                onClick={() => handleCopy(fileStorageService.getAppsScriptTemplateCode(), 'script-code')}
                className="absolute top-2 right-2 px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-emerald-950 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
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

            <div className="space-y-1.5 text-xs text-slate-700 bg-emerald-50/60 p-3.5 rounded-lg border border-emerald-200">
              <p className="font-bold text-emerald-950">Langkah Konfigurasi Google Apps Script:</p>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-700">
                <li>Login browser menggunakan akun Google <strong>alihsansoborejo@gmail.com</strong>, lalu buka <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-emerald-800 font-bold underline">script.google.com</a> dan klik <strong>New project</strong>.</li>
                <li>Hapus kode bawaan dan tempel kode skrip di atas, lalu klik <strong>Save</strong>.</li>
                <li>Klik <strong>Deploy &gt; New deployment</strong> &gt; pilih tipe <strong>Web app</strong>.</li>
                <li>Pastikan <strong>Execute as</strong>: <code>Me (alihsansoborejo@gmail.com)</code> dan <strong>Who has access</strong>: <code>Anyone</code>.</li>
                <li>Klik <strong>Deploy &gt; Authorize access</strong> dan izinkan akses Google Drive akun <code>alihsansoborejo@gmail.com</code>.</li>
                <li>Salin <strong>Web App URL</strong> (<code>/exec</code>), tempel di form Pengaturan, lalu klik <strong>Uji Koneksi Apps Script</strong> &amp; <strong>Simpan</strong>.</li>
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

      {/* Modal Konfirmasi Hapus Berkas */}
      {pendingDeleteFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Hapus Berkas dari Penyimpanan?</h3>
            <p className="text-xs text-slate-600">
              Berkas <strong>{pendingDeleteFile.name}</strong> akan dihapus dari penyimpanan lokal perangkat ini.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPendingDeleteFile(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteFile()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Pratinjau Berkas */}
      <FilePreviewModal
        isOpen={Boolean(previewModalState)}
        file={previewModalState?.file || null}
        title={previewModalState?.title}
        driveUploadError={previewModalState?.driveUploadError}
        onClose={() => setPreviewModalState(null)}
        onFileUpdated={(updated) => {
          setPreviewModalState((prev) =>
            prev ? { ...prev, file: updated, driveUploadError: undefined } : null
          );
          if (updated.googleDriveUrl && previewModalState?.curriculumDocId) {
            void curriculumService
              .updateDocument(previewModalState.curriculumDocId, {
                google_drive_url: updated.googleDriveUrl,
              })
              .catch(() => {});
          }
          setErrorMessage(null);
          void loadStoredFiles();
        }}
      />
    </div>
  );
};
