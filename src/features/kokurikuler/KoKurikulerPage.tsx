import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGoogleDrive } from '../../context/GoogleDriveContext';
import { academicService } from '../../services/academicService';
import { curriculumService } from '../../services/curriculumService';
import { kokurikulerService } from '../../services/kokurikulerService';
import {
  fileStorageService,
  StoredDocumentFile,
  isRealDriveFileUrl,
} from '../../services/fileStorageService';
import { printDocumentDirectly } from '../../services/printService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { FilePreviewModal } from '../../components/curriculum/FilePreviewModal';
import {
  ClassRoom,
  Subject,
  SystemSettings,
  Teacher,
  TeachingAssignment,
} from '../../types/database.types';
import {
  KoKurikulerItem,
  KoKurikulerSubMenu,
  KOKURIKULER_SUBMENUS,
} from '../../types/kokurikuler.types';
import {
  Compass,
  BookOpen,
  ClipboardCheck,
  FileArchive,
  Plus,
  Search,
  FileSpreadsheet,
  Printer,
  UploadCloud,
  HardDrive,
  FileText,
  Eye,
  Download,
  ExternalLink,
  FolderSync,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Send,
  X,
} from 'lucide-react';

interface KoKurikulerPageProps {
  defaultSubMenu?: KoKurikulerSubMenu;
  onNavigate?: (view: string) => void;
}

const SUBMENU_ICONS: Record<KoKurikulerSubMenu, React.ComponentType<{ className?: string }>> = {
  perencanaan: Compass,
  'bahan-ajar': BookOpen,
  asesmen: ClipboardCheck,
  administrasi: FileArchive,
};

export const KoKurikulerPage: React.FC<KoKurikulerPageProps> = ({
  defaultSubMenu = 'perencanaan',
  onNavigate,
}) => {
  const { user, activeRole } = useAuth();
  const {
    isConnected: isOAuthDriveConnected,
    googleUser,
    uploadFile: uploadToGoogleDrive,
  } = useGoogleDrive();

  const [activeSubMenu, setActiveSubMenu] = useState<KoKurikulerSubMenu>(defaultSubMenu);
  const [items, setItems] = useState<KoKurikulerItem[]>([]);
  const [allClasses, setAllClasses] = useState<ClassRoom[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeachingAssignment[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [resolvedTeacher, setResolvedTeacher] = useState<Teacher | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [activeYearId, setActiveYearId] = useState<string>('ay-2026');
  const [activeSemesterId, setActiveSemesterId] = useState<string>('sem-ganjil-2026');
  const [activeYearName, setActiveYearName] = useState<string>('2026/2027');
  const [activeSemesterType, setActiveSemesterType] = useState<'Ganjil' | 'Genap'>('Ganjil');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter states
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>('all');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal & Notification states
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<KoKurikulerItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<KoKurikulerItem | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Preview state
  const [previewModalState, setPreviewModalState] = useState<{
    file: StoredDocumentFile;
    title?: string;
    driveUploadError?: string;
    itemId?: string;
  } | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState<string>('');
  const [formTheme, setFormTheme] = useState<string>('');
  const [formClassLevel, setFormClassLevel] = useState<number>(0); // 0 = Lintas Kelas
  const [formSemester, setFormSemester] = useState<'Ganjil' | 'Genap'>('Ganjil');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formParticipants, setFormParticipants] = useState<string>('Seluruh Peserta Didik Rombel');
  const [formHours, setFormHours] = useState<number>(4);
  const [formActivityDate, setFormActivityDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [formDriveUrl, setFormDriveUrl] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [submitToPrincipal, setSubmitToPrincipal] = useState<boolean>(true);

  useEffect(() => {
    if (defaultSubMenu) {
      setActiveSubMenu(defaultSubMenu);
    }
  }, [defaultSubMenu]);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4500);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    void fileStorageService.hydrateConfigFromServer();
    try {
      const [clss, sbjs, asgs, sys, years, sems, teacher, tchs, allKoItems] = await Promise.all([
        academicService.getClasses(),
        academicService.getSubjects(),
        academicService.getTeachingAssignments(),
        academicService.getSettings(),
        academicService.getAcademicYears(),
        academicService.getSemesters(),
        academicService.resolveTeacherForUser(user),
        academicService.getTeachers(),
        kokurikulerService.fetchAll(),
      ]);

      setAllClasses(clss);
      setAllSubjects(sbjs);
      setAllTeachers(tchs);
      setSettings(sys);
      setResolvedTeacher(teacher);

      const actYear = years.find((y) => y.id === sys.active_academic_year_id || y.is_active) || years[0];
      const actSem = sems.find((s) => s.id === sys.active_semester_id || s.is_active) || sems[0];
      if (actYear?.id) setActiveYearId(actYear.id);
      if (actSem?.id) setActiveSemesterId(actSem.id);
      if (actYear?.name) setActiveYearName(actYear.name);
      if (actSem?.semester_type) {
        setActiveSemesterType(actSem.semester_type);
      }

      const isScopedRole = activeRole === 'guru' || activeRole === 'wali_kelas';
      const relevantAsgs = isScopedRole
        ? academicService.filterAssignmentsForUser(asgs, user, teacher, tchs)
        : asgs;
      setTeacherAssignments(relevantAsgs);

      const homeroomCls =
        activeRole === 'wali_kelas'
          ? await academicService.resolveHomeroomClassForUser(user, teacher)
          : null;

      const { candidateTeacherIds, candidateUserIds } = academicService.getMatchingTeacherIdsForUser(
        user,
        teacher,
        tchs
      );
      const loadedItems = isScopedRole
        ? kokurikulerService.filterByScope(allKoItems, {
            teacherIds: Array.from(candidateTeacherIds),
            userIds: Array.from(candidateUserIds),
            email: user?.email,
            fullName: user?.profile?.full_name,
            homeroomClassLevel: homeroomCls?.level ?? null,
          })
        : allKoItems;
      setItems(loadedItems);
    } catch (err) {
      console.error('Gagal memuat data Ko Kurikuler:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeRole, user?.id, user?.email, user?.teacherId, user?.homeroomClassId, user?.profile?.full_name]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRealtimeSync(
    [
      'simpel_mi_kokurikuler_items_v1',
      'simpel_drive_storage_config_v1',
      'simpel_classes',
      'simpel_teachers',
      'simpel_assignments',
      'simpel_homeroom_assignments',
      'simpel_curriculum_documents',
      'simpel_academic_years',
      'simpel_semesters',
      'simpel_settings',
      'simpel_users_cache_v2',
    ],
    () => {
      void loadData();
    }
  );

  const currentMeta = useMemo(
    () => KOKURIKULER_SUBMENUS.find((s) => s.key === activeSubMenu) || KOKURIKULER_SUBMENUS[0],
    [activeSubMenu]
  );

  const countsBySubMenu = useMemo(() => {
    const counts: Record<KoKurikulerSubMenu, number> = {
      perencanaan: 0,
      'bahan-ajar': 0,
      asesmen: 0,
      administrasi: 0,
    };
    for (const item of items) {
      if (item.sub_menu in counts) {
        counts[item.sub_menu] += 1;
      }
    }
    return counts;
  }, [items]);

  const availableClasses = useMemo(() => {
    if (activeRole !== 'guru' || teacherAssignments.length === 0) return allClasses;
    const assignedClassIds = new Set(teacherAssignments.map((a) => a.class_id));
    const filtered = allClasses.filter((c) => assignedClassIds.has(c.id));
    return filtered.length > 0 ? filtered : allClasses;
  }, [activeRole, teacherAssignments, allClasses]);

  const teacherFilterOptions = useMemo(() => {
    const names = new Set<string>();
    for (const t of allTeachers) {
      if (t.full_name) names.add(t.full_name);
    }
    for (const it of items) {
      if (it.teacher_name) names.add(it.teacher_name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'id'));
  }, [allTeachers, items]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      if (item.sub_menu !== activeSubMenu) return false;
      if (selectedClassFilter !== 'all' && String(item.class_level) !== selectedClassFilter) {
        return false;
      }
      if (selectedSemesterFilter !== 'all' && item.semester !== selectedSemesterFilter) {
        return false;
      }
      if (
        (activeRole === 'kepala_madrasah' || activeRole === 'admin') &&
        selectedTeacherFilter !== 'all' &&
        (item.teacher_name || '') !== selectedTeacherFilter
      ) {
        return false;
      }
      if (
        q &&
        !(item.title || '').toLowerCase().includes(q) &&
        !(item.theme_or_dimension || '').toLowerCase().includes(q) &&
        !(item.description || '').toLowerCase().includes(q) &&
        !(item.file_name || '').toLowerCase().includes(q) &&
        !(item.teacher_name || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [items, activeSubMenu, selectedClassFilter, selectedSemesterFilter, selectedTeacherFilter, activeRole, searchTerm]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormError(null);
    setUploadFile(null);
    setFormTitle('');
    setFormTheme(currentMeta.defaultTheme);
    setFormClassLevel(availableClasses[0]?.level || 0);
    setFormSemester(activeSemesterType);
    setFormDescription('');
    setFormParticipants('Seluruh Peserta Didik Rombel');
    setFormHours(4);
    setFormActivityDate(new Date().toISOString().split('T')[0]);
    setFormDriveUrl('');
    setSubmitToPrincipal(true);
    setShowModal(true);
  };

  const handleOpenEdit = (item: KoKurikulerItem) => {
    setEditingItem(item);
    setFormError(null);
    setUploadFile(null);
    setFormTitle(item.title);
    setFormTheme(item.theme_or_dimension);
    setFormClassLevel(item.class_level);
    setFormSemester(item.semester);
    setFormDescription(item.description);
    setFormParticipants(item.target_participants || 'Seluruh Peserta Didik Rombel');
    setFormHours(item.allocated_hours ?? 4);
    setFormActivityDate(item.activity_date || new Date().toISOString().split('T')[0]);
    setFormDriveUrl(item.google_drive_url || '');
    setSubmitToPrincipal(item.status === 'Diajukan' || item.status === 'Disetujui');
    setShowModal(true);
  };

  const handleFileSelected = (file: File | null) => {
    setUploadFile(file);
    if (!file) return;
    if (!formTitle.trim()) {
      const base = file.name.replace(/\.[^/.]+$/, '');
      setFormTitle(base);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formTitle.trim()) {
      setFormError('Judul dokumen/kegiatan Ko Kurikuler wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const teacherIdForRecord = resolvedTeacher?.id || user?.teacherId || user?.id || 'usr-guru';
      const teacherNameForRecord =
        user?.profile?.full_name || resolvedTeacher?.full_name || 'Guru Madrasah';
      const matchedClass = allClasses.find((c) => c.level === formClassLevel);
      const classLabel =
        formClassLevel === 0
          ? 'Lintas Kelas (Semua Rombel)'
          : matchedClass?.name || `Kelas ${formClassLevel}`;

      const driveConfig = await fileStorageService.hydrateConfigFromServer();
      const appsScriptReady = fileStorageService.isAppsScriptActive(driveConfig);

      let finalDriveUrl = formDriveUrl.trim() || editingItem?.google_drive_url || '';
      let storedFileId = editingItem?.file_id || '';
      let storedFileName = editingItem?.file_name || '';
      let folderPath = editingItem?.folder_path || '';
      let savedStoredFile: StoredDocumentFile | null = null;
      let uploadedViaAppsScript = false;
      let uploadedViaOAuth = false;
      let appsScriptWarn = '';

      if (uploadFile) {
        const structuredPath = fileStorageService.buildStructuredDrivePath({
          academicYearName: activeYearName,
          semesterType: formSemester,
          className: classLabel,
          subjectName: 'Ko Kurikuler',
          category: currentMeta.driveCategory,
          categoryFolder: currentMeta.driveFolder,
        });
        folderPath = structuredPath.displayPath;

        const fileNameToUse = fileStorageService.formatDriveFileName(
          formTitle.trim(),
          teacherNameForRecord,
          uploadFile.name
        );

        let oauthUrl = '';
        let oauthFileId = '';
        if (!appsScriptReady && isOAuthDriveConnected && !formDriveUrl.trim()) {
          try {
            const uploadedDriveFile = await uploadToGoogleDrive(
              uploadFile,
              fileNameToUse,
              `${currentMeta.driveCategory} · ${classLabel} · Pengunggah: ${teacherNameForRecord}`,
              uploadFile.type || 'application/octet-stream',
              driveConfig.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo'
            );
            oauthUrl =
              uploadedDriveFile.webViewLink ||
              `https://drive.google.com/file/d/${uploadedDriveFile.id}/view`;
            oauthFileId = uploadedDriveFile.id;
            uploadedViaOAuth = true;
          } catch (oauthErr) {
            console.warn('Upload OAuth Ko Kurikuler gagal:', oauthErr);
          }
        }

        const saved = await fileStorageService.saveDocumentFile({
          file: uploadFile,
          name: fileNameToUse,
          category: currentMeta.driveCategory,
          categoryFolder: currentMeta.driveFolder,
          description: `${currentMeta.label} (${formTheme || currentMeta.defaultTheme}) - ${classLabel}`,
          uploadedBy: teacherNameForRecord,
          googleDriveUrl: formDriveUrl.trim() || oauthUrl || undefined,
          driveFileId: oauthFileId || undefined,
          folderPath: structuredPath.folderSegments,
        });

        savedStoredFile = saved;
        storedFileId = saved.id;
        storedFileName = saved.name;
        if (saved.googleDriveUrl) {
          finalDriveUrl = saved.googleDriveUrl;
        }
        uploadedViaAppsScript = Boolean(saved.uploadedViaAppsScript);
        if (saved.driveUploadError) {
          appsScriptWarn = saved.driveUploadError;
        }
      }

      const targetStatus: KoKurikulerItem['status'] =
        editingItem?.status === 'Disetujui'
          ? 'Disetujui'
          : (uploadFile || finalDriveUrl) && submitToPrincipal
          ? 'Diajukan'
          : editingItem?.status || 'Draft';

      let curriculumDocId = editingItem?.curriculum_doc_id || '';
      if ((uploadFile || formDriveUrl.trim()) && submitToPrincipal) {
        const classIdForDoc =
          matchedClass?.id ||
          teacherAssignments[0]?.class_id ||
          allClasses[0]?.id ||
          'cls-4';
        const subjectIdForDoc =
          teacherAssignments[0]?.subject_id || allSubjects[0]?.id || 'sbj-pp';

        const createdDoc = await curriculumService.createDocument({
          teacher_id: teacherIdForRecord,
          academic_year_id: activeYearId,
          semester_id: activeSemesterId,
          class_id: classIdForDoc,
          subject_id: subjectIdForDoc,
          document_type: currentMeta.driveCategory,
          title: `[Ko Kurikuler] ${formTitle.trim()}`,
          google_drive_url: finalDriveUrl,
          file_id: storedFileId || null,
          status: 'Diajukan',
          submission_date: new Date().toISOString(),
        });
        curriculumDocId = createdDoc.id;
      }

      const savedItem = await kokurikulerService.saveItem({
        id: editingItem?.id,
        sub_menu: activeSubMenu,
        teacher_id: editingItem?.teacher_id || teacherIdForRecord,
        teacher_user_id: editingItem?.teacher_user_id || user?.id,
        recorder_email: editingItem?.recorder_email || user?.email,
        teacher_name: editingItem?.teacher_name || teacherNameForRecord,
        class_level: formClassLevel,
        class_name: classLabel,
        semester: formSemester,
        academic_year: activeYearName,
        theme_or_dimension: formTheme.trim() || currentMeta.defaultTheme,
        title: formTitle.trim(),
        description: formDescription.trim(),
        target_participants: formParticipants.trim() || undefined,
        allocated_hours: Number(formHours) || 0,
        activity_date: formActivityDate || undefined,
        file_id: storedFileId || undefined,
        file_name: storedFileName || undefined,
        google_drive_url: finalDriveUrl || undefined,
        folder_path: folderPath || undefined,
        curriculum_doc_id: curriculumDocId || undefined,
        status: targetStatus,
      });

      const driveSuffix = uploadedViaAppsScript
        ? ' & tersimpan ke Google Drive Madrasah'
        : uploadedViaOAuth
        ? ' & tersimpan ke Google Drive'
        : '';
      const warnSuffix = appsScriptWarn ? ` (Catatan Drive: ${appsScriptWarn})` : '';

      notify(
        `${currentMeta.label}: "${savedItem.title}" berhasil disimpan${driveSuffix}.${warnSuffix}`
      );
      setShowModal(false);
      setEditingItem(null);
      setUploadFile(null);
      await loadData();

      if (savedStoredFile) {
        setPreviewModalState({
          file: savedStoredFile,
          title: `Pratinjau: ${savedItem.title}`,
          driveUploadError: savedStoredFile.driveUploadError,
          itemId: savedItem.id,
        });
      }
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan data Ko Kurikuler.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreviewItem = async (item: KoKurikulerItem) => {
    let stored = item.file_id ? await fileStorageService.getFileById(item.file_id) : null;
    if (!stored && item.google_drive_url && isRealDriveFileUrl(item.google_drive_url)) {
      stored = {
        id: item.file_id || `drive-${item.id}`,
        name: item.file_name || item.title,
        size: 0,
        mimeType: 'application/pdf',
        category: currentMeta.driveCategory,
        uploadedBy: item.teacher_name || 'Guru Madrasah',
        uploadedAt: item.updated_at || item.created_at,
        googleDriveUrl: item.google_drive_url,
      };
    }
    if (!stored) {
      notify('Berkas lokal tidak ditemukan di perangkat ini. Silakan buka tautan Google Drive.');
      return;
    }
    setPreviewModalState({
      file: stored,
      title: `Pratinjau: ${item.title}`,
      itemId: item.id,
    });
  };

  const handleDownloadItem = async (fileId?: string) => {
    if (!fileId) return;
    const stored = await fileStorageService.getFileById(fileId);
    if (!stored) {
      notify('Berkas lokal tidak ditemukan di perangkat ini. Silakan unduh melalui Google Drive.');
      return;
    }
    fileStorageService.downloadStoredFile(stored);
  };

  const handleReviewStatus = async (
    item: KoKurikulerItem,
    nextStatus: 'Disetujui' | 'Perlu Revisi'
  ) => {
    try {
      const reviewedAt = new Date().toISOString();
      await kokurikulerService.saveItem({
        ...item,
        status: nextStatus,
        reviewed_at: reviewedAt,
      });
      if (item.curriculum_doc_id) {
        await curriculumService
          .reviewDocument(
            item.curriculum_doc_id,
            nextStatus,
            nextStatus === 'Disetujui'
              ? 'Program Ko Kurikuler disetujui Kepala Madrasah.'
              : 'Mohon tinjau ulang dan lengkapi dokumen Ko Kurikuler.',
            user?.id || 'usr-kamad'
          )
          .catch(() => {});
      }
      notify(`Status "${item.title}" diperbarui menjadi ${nextStatus}.`);
      await loadData();
    } catch (err) {
      console.error('Gagal memperbarui status Ko Kurikuler:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    if (pendingDelete.file_id) {
      await fileStorageService.deleteFile(pendingDelete.file_id).catch(() => {});
    }
    if (pendingDelete.curriculum_doc_id) {
      await curriculumService.deleteDocument(pendingDelete.curriculum_doc_id).catch(() => {});
    }
    await kokurikulerService.deleteItem(pendingDelete.id);
    notify(`"${pendingDelete.title}" berhasil dihapus.`);
    setPendingDelete(null);
    await loadData();
  };

  const handleExportCSV = () => {
    const headers = [
      'No',
      'Sub Menu',
      'Judul Kegiatan / Dokumen',
      'Tema / Dimensi',
      'Kelas Sasaran',
      'Semester',
      'Tanggal',
      'Alokasi JP',
      'Deskripsi / Catatan',
      'Status',
      'Tautan Drive',
    ];
    const rows = filteredItems.map((it, idx) => [
      idx + 1,
      `"${currentMeta.label}"`,
      `"${(it.title || '').replace(/"/g, '""')}"`,
      `"${(it.theme_or_dimension || '').replace(/"/g, '""')}"`,
      `"${it.class_name}"`,
      it.semester,
      it.activity_date || '-',
      it.allocated_hours ?? 0,
      `"${(it.description || '').replace(/"/g, '""')}"`,
      it.status,
      it.google_drive_url || '-',
    ]);
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kokurikuler_${activeSubMenu}_${activeYearName.replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`Rekap CSV ${currentMeta.label} berhasil diunduh.`);
  };

  const handlePrint = () => {
    const tableRows = filteredItems
      .map(
        (it, idx) => `
      <tr>
        <td class="center">${idx + 1}</td>
        <td><strong>${it.title}</strong><br><small>${it.theme_or_dimension}</small></td>
        <td>${it.class_name}<br><small>Sem. ${it.semester}${it.activity_date ? ` · ${it.activity_date}` : ''}</small></td>
        <td>${it.description || '-'}</td>
        <td class="center">${it.status}</td>
      </tr>
    `
      )
      .join('');

    const html = `
      <table>
        <thead>
          <tr>
            <th style="width: 32px;">No</th>
            <th>Judul &amp; Tema Ko Kurikuler</th>
            <th style="width: 150px;">Sasaran &amp; Waktu</th>
            <th>Uraian / Keterangan</th>
            <th style="width: 90px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            tableRows ||
            '<tr><td colspan="5" class="center">Belum ada data pada sub menu ini.</td></tr>'
          }
        </tbody>
      </table>
    `;

    printDocumentDirectly(html, {
      title: `DOKUMEN KO KURIKULER: ${currentMeta.label.toUpperCase()}`,
      subtitle: `${settings?.school_name || 'MI Ma’arif Al Ihsan Soborejo'} · Tahun Pelajaran ${activeYearName}`,
      metadata: [
        { label: 'Kategori', value: `Ko Kurikuler - ${currentMeta.label}` },
        { label: 'Total Dokumen', value: `${filteredItems.length} Entri` },
        {
          label: 'Guru Penyusun',
          value: user?.profile?.full_name || resolvedTeacher?.full_name || 'Guru Madrasah',
        },
        {
          label: 'Tanggal Cetak',
          value: new Date().toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
        },
      ],
      signature: {
        leftTitle: 'Guru Pembina Ko Kurikuler,',
        leftName: user?.profile?.full_name || resolvedTeacher?.full_name || 'Guru Pembina',
        leftNip: resolvedTeacher?.nip || '-',
        rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`,
        rightTitle: 'Mengetahui,<br>Kepala Madrasah,',
        rightName: settings?.principal_name || 'Kepala Madrasah',
        rightNip: settings?.principal_nip || '-',
      },
    });
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-900 text-amber-300 text-xs font-semibold flex items-center justify-between shadow-lg border border-emerald-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{notification}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-white hover:text-amber-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
              Program Ko Kurikuler Madrasah
            </span>
            <span className="text-xs text-slate-400">
              · {settings?.school_name || 'MI Ma’arif Al Ihsan Soborejo'}
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Pengelolaan Kegiatan Ko Kurikuler
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola perencanaan &amp; modul, bahan ajar &amp; aktivitas murid, asesmen &amp; refleksi, serta administrasi &amp; pelaporan ke Google Drive Madrasah.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('asisten-ai-modul')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-xs cursor-pointer"
            >
              <Compass className="w-4 h-4 text-emerald-950" />
              <span>Rancang dengan AI</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Ekspor CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Cetak / PDF</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-300" />
            <span>Tambah / Unggah Berkas</span>
          </button>
        </div>
      </div>

      {/* Sub-Menu Tabs Ko Kurikuler + Filter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
          {KOKURIKULER_SUBMENUS.map((sub) => {
            const Icon = SUBMENU_ICONS[sub.key];
            const isActive = activeSubMenu === sub.key;
            return (
              <button
                key={sub.key}
                type="button"
                onClick={() => setActiveSubMenu(sub.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-emerald-700'}`} />
                <span>{sub.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive
                      ? 'bg-emerald-900 text-amber-300'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {countsBySubMenu[sub.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Kelas Sasaran:</span>
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="all">Semua Kelas / Lintas Rombel</option>
                <option value="0">Lintas Kelas (Semua Rombel)</option>
                {availableClasses.map((cls) => (
                  <option key={cls.id} value={String(cls.level)}>
                    {cls.name} (Fase {cls.phase})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Semester:</span>
              <select
                value={selectedSemesterFilter}
                onChange={(e) => setSelectedSemesterFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="all">Semua Semester</option>
                <option value="Ganjil">Semester Ganjil</option>
                <option value="Genap">Semester Genap</option>
              </select>
            </div>

            {(activeRole === 'kepala_madrasah' || activeRole === 'admin') && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-600">Guru:</span>
                <select
                  value={selectedTeacherFilter}
                  onChange={(e) => setSelectedTeacherFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="all">Semua Guru / Pembina</option>
                  {teacherFilterOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={`Cari dalam ${currentMeta.shortLabel}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>
      </div>

      {/* Tabel Data Sub Menu Aktif */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-emerald-950">{currentMeta.label}</h3>
            <p className="text-xs text-emerald-700">{currentMeta.description}</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200 shrink-0">
            Total: {filteredItems.length} Dokumen
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3 w-10 text-center">No</th>
                <th className="px-4 py-3">Judul &amp; Tema / Dimensi</th>
                <th className="px-4 py-3 w-44">Kelas &amp; Jadwal</th>
                <th className="px-4 py-3">Uraian / Ringkasan</th>
                <th className="px-4 py-3 w-56">Berkas &amp; Google Drive</th>
                <th className="px-4 py-3 w-24 text-center">Status</th>
                <th className="px-4 py-3 w-20 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Memuat data {currentMeta.label}...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Belum ada dokumen pada sub menu <strong>{currentMeta.label}</strong>. Klik tombol &ldquo;Tambah / Unggah Berkas&rdquo; untuk menambahkan.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors align-top">
                    <td className="px-4 py-3 text-center font-mono text-slate-400 font-semibold">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 space-y-1">
                      <div className="font-bold text-slate-900">{item.title}</div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-semibold text-[10px]">
                          {item.theme_or_dimension}
                        </span>
                        {item.teacher_name && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            Pembina: {item.teacher_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 space-y-0.5">
                      <div className="font-semibold text-slate-800">{item.class_name}</div>
                      <div className="text-[11px] text-slate-500">
                        Sem. {item.semester}
                        {item.allocated_hours ? ` · ${item.allocated_hours} JP` : ''}
                      </div>
                      {item.activity_date && (
                        <div className="text-[10px] font-mono text-slate-400">{item.activity_date}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 space-y-1">
                      <p className="text-slate-600 line-clamp-2 whitespace-pre-line">
                        {item.description || '-'}
                      </p>
                      {item.target_participants && (
                        <div className="text-[10px] text-slate-500">
                          <strong>Sasaran:</strong> {item.target_participants}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(item.file_id || isRealDriveFileUrl(item.google_drive_url)) && (
                          <button
                            type="button"
                            onClick={() => void handlePreviewItem(item)}
                            className="px-2.5 py-1 rounded bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview Dokumen</span>
                          </button>
                        )}
                        {item.file_id && (
                          <button
                            type="button"
                            onClick={() => void handleDownloadItem(item.file_id)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            title="Unduh Berkas"
                          >
                            <Download className="w-3 h-3" />
                            <span>Unduh</span>
                          </button>
                        )}
                        {isRealDriveFileUrl(item.google_drive_url) ? (
                          <a
                            href={item.google_drive_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1"
                          >
                            <FolderSync className="w-3 h-3" />
                            <span>Drive</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : !item.file_id ? (
                          <span className="text-[11px] text-slate-400">-</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center space-y-1">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'Disetujui'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'Diajukan'
                            ? 'bg-amber-100 text-amber-900'
                            : item.status === 'Perlu Revisi'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.status}
                      </span>
                      {(activeRole === 'kepala_madrasah' || activeRole === 'admin') &&
                        item.status !== 'Disetujui' && (
                          <div className="flex items-center justify-center gap-1 pt-0.5">
                            <button
                              type="button"
                              onClick={() => void handleReviewStatus(item, 'Disetujui')}
                              className="px-1.5 py-0.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-semibold cursor-pointer"
                              title="Setujui Program"
                            >
                              Setujui
                            </button>
                            {item.status !== 'Perlu Revisi' && (
                              <button
                                type="button"
                                onClick={() => void handleReviewStatus(item, 'Perlu Revisi')}
                                className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-semibold cursor-pointer"
                                title="Minta Revisi"
                              >
                                Revisi
                              </button>
                            )}
                          </div>
                        )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-1 text-slate-400 hover:text-emerald-700 cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(item)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah / Edit & Unggah Berkas ke Google Drive */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {editingItem ? 'Edit' : 'Tambah'} {currentMeta.label}
                </h3>
                <p className="text-[11px] text-slate-500">Ko Kurikuler MI Ma&rsquo;arif Al Ihsan Soborejo</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const driveCfg = fileStorageService.getConfig();
              const driveStatus = fileStorageService.getDriveStatusInfo(driveCfg);
              const classLabel =
                formClassLevel === 0
                  ? 'Lintas Kelas (Semua Rombel)'
                  : allClasses.find((c) => c.level === formClassLevel)?.name || `Kelas ${formClassLevel}`;
              const folderPreview = fileStorageService.buildStructuredDrivePath({
                academicYearName: activeYearName,
                semesterType: formSemester,
                className: classLabel,
                subjectName: 'Ko Kurikuler',
                category: currentMeta.driveCategory,
                categoryFolder: currentMeta.driveFolder,
              });
              return (
                <div
                  className={`p-3 rounded-xl border text-[11px] flex items-start gap-2.5 ${
                    driveStatus.isError
                      ? 'bg-rose-50 border-rose-200 text-rose-950'
                      : driveStatus.isHealthy || isOAuthDriveConnected
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50 border-amber-200 text-amber-950'
                  }`}
                >
                  <HardDrive
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      driveStatus.isError
                        ? 'text-rose-700'
                        : driveStatus.isHealthy || isOAuthDriveConnected
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  />
                  <div>
                    <p className="font-bold">
                      {driveStatus.isError
                        ? `Google Drive Apps Script Bermasalah (${driveStatus.ownerEmail})`
                        : driveStatus.isHealthy
                        ? `Google Drive Aktif (Apps Script Tanpa Login · ${driveStatus.ownerEmail})`
                        : isOAuthDriveConnected
                        ? `Google Drive Terhubung (${googleUser?.email || 'Akun Google'})`
                        : 'Simpan ke Arsip Aplikasi & Tautan Drive'}
                    </p>
                    {driveStatus.isError && driveStatus.errorMessage && (
                      <p className="text-[10px] text-rose-800 mt-0.5 leading-relaxed">
                        {driveStatus.errorMessage}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-[10px] bg-white/75 px-2 py-1 rounded border border-emerald-200/80 text-emerald-900">
                      Folder tujuan: {driveCfg.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo'} / {folderPreview.displayPath}
                    </p>
                  </div>
                </div>
              );
            })()}

            {formError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Judul Dokumen / Kegiatan *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={`Contoh: ${currentMeta.shortLabel} Kegiatan Pembiasaan & Proyek`}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tema / Dimensi Karakter
                </label>
                <input
                  type="text"
                  value={formTheme}
                  onChange={(e) => setFormTheme(e.target.value)}
                  placeholder={currentMeta.defaultTheme}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kelas Sasaran</label>
                  <select
                    value={formClassLevel}
                    onChange={(e) => setFormClassLevel(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value={0}>Lintas Kelas (Semua Rombel)</option>
                    {allClasses.map((cls) => (
                      <option key={cls.id} value={cls.level}>
                        {cls.name} (Fase {cls.phase})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Semester</label>
                  <select
                    value={formSemester}
                    onChange={(e) => setFormSemester(e.target.value as 'Ganjil' | 'Genap')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Ganjil">Semester Ganjil</option>
                    <option value="Genap">Semester Genap</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal / Periode</label>
                  <input
                    type="date"
                    value={formActivityDate}
                    onChange={(e) => setFormActivityDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alokasi JP</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formHours}
                    onChange={(e) => setFormHours(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sasaran Peserta</label>
                <input
                  type="text"
                  value={formParticipants}
                  onChange={(e) => setFormParticipants(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ringkasan / Catatan Pelaksanaan
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Tuliskan deskripsi singkat modul, aktivitas murid, instrumen asesmen, atau laporan..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              {/* Unggah Berkas ke Google Drive */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-emerald-700" />
                    <span>Pilih Berkas (Simpan ke Google Drive Madrasah)</span>
                  </label>
                  <span className="text-[10px] text-slate-500">PDF / Word / Excel / PPT / Gambar</span>
                </div>

                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 border border-slate-300 rounded-lg p-2 bg-white file:mr-2.5 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-800 file:text-white hover:file:bg-emerald-900 cursor-pointer"
                />

                {uploadFile && (
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
                    <span className="flex items-center gap-1.5 truncate font-semibold">
                      <FileText className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="truncate">{uploadFile.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setUploadFile(null)}
                      className="text-rose-700 hover:underline font-bold ml-2 shrink-0"
                    >
                      Hapus
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tautan Berkas Google Drive (Opsional)
                  </label>
                  <input
                    type="url"
                    value={formDriveUrl}
                    onChange={(e) => setFormDriveUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-[11px]"
                  />
                </div>

                <label className="flex items-start gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={submitToPrincipal}
                    onChange={(e) => setSubmitToPrincipal(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-emerald-800 rounded border-slate-300 focus:ring-emerald-700 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-700 leading-snug">
                    Langsung kirim ke <strong>Dashboard Kepala Madrasah (Diajukan)</strong> jika melampirkan berkas atau tautan Drive.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {uploadFile && submitToPrincipal ? (
                    <Send className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isSubmitting
                      ? 'Menyimpan...'
                      : uploadFile
                      ? 'Simpan & Unggah ke Drive'
                      : 'Simpan Data'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Hapus Dokumen Ko Kurikuler?</h3>
            <p className="text-xs text-slate-600">
              Data <strong>{pendingDelete.title}</strong> akan dihapus dari daftar {currentMeta.label}.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-700 hover:bg-rose-800"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pratinjau Full Window */}
      <FilePreviewModal
        isOpen={Boolean(previewModalState)}
        file={previewModalState?.file || null}
        title={previewModalState?.title}
        driveUploadError={previewModalState?.driveUploadError}
        onClose={() => setPreviewModalState(null)}
        onFileUpdated={async (updated) => {
          setPreviewModalState((prev) =>
            prev ? { ...prev, file: updated, driveUploadError: undefined } : null
          );
          if (updated.googleDriveUrl && previewModalState?.itemId) {
            const existing =
              items.find((x) => x.id === previewModalState.itemId) ||
              (await kokurikulerService.fetchAll()).find((x) => x.id === previewModalState.itemId);
            if (existing) {
              await kokurikulerService.saveItem({
                ...existing,
                google_drive_url: updated.googleDriveUrl,
              });
              void loadData();
            }
          }
        }}
      />
    </div>
  );
};
