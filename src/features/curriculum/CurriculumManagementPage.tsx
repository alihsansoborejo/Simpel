import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useGoogleDrive } from '../../context/GoogleDriveContext';
import { academicService } from '../../services/academicService';
import { curriculumService } from '../../services/curriculumService';
import { curriculumWorkspaceService } from '../../services/curriculumWorkspaceService';
import { fileStorageService, StoredDocumentFile, isRealDriveFileUrl } from '../../services/fileStorageService';
import { printDocumentDirectly } from '../../services/printService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { DriveDocumentUploadModal } from '../../components/curriculum/DriveDocumentUploadModal';
import { FilePreviewModal } from '../../components/curriculum/FilePreviewModal';
import {
  Subject,
  ClassRoom,
  TeachingAssignment,
  SystemSettings,
  Teacher,
  DocumentLink,
} from '../../types/database.types';
import {
  CapaianPembelajaranItem,
  TujuanPembelajaranItem,
  AlurTujuanPembelajaranItem,
  ProtaItem,
  PromesItem,
  ModulAjarItem,
  LKPDItem,
} from '../../types/curriculum.types';
import {
  BookOpen,
  Plus,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Search,
  ExternalLink,
  Trash2,
  FolderSync,
  CheckCircle2,
  AlertCircle,
  X,
  Heart,
  Layers,
  ArrowRight,
  HardDrive,
  Calendar,
  UploadCloud,
  Send,
  FileText,
  Eye,
  Download,
} from 'lucide-react';

export type CurriculumTab = 'cp' | 'tp' | 'atp' | 'prota' | 'promes' | 'modul-ajar' | 'lkpd';

interface CurriculumManagementPageProps {
  defaultTab?: CurriculumTab;
  onNavigate?: (view: string) => void;
}

const DOC_META_BY_TAB: Record<
  CurriculumTab,
  { docType: string; folder: string; shortLabel: string }
> = {
  cp: { docType: 'Capaian Pembelajaran (CP)', folder: 'CP & TP', shortLabel: 'CP' },
  tp: { docType: 'Tujuan Pembelajaran (TP)', folder: 'CP & TP', shortLabel: 'TP' },
  atp: { docType: 'Alur Tujuan Pembelajaran (ATP)', folder: 'ATP', shortLabel: 'ATP' },
  prota: { docType: 'Program Tahunan (Prota)', folder: 'Prota & Prosem', shortLabel: 'PROTA' },
  promes: { docType: 'Program Semester (Promes)', folder: 'Prota & Prosem', shortLabel: 'PROMES' },
  'modul-ajar': { docType: 'Modul Ajar', folder: 'Modul Ajar', shortLabel: 'MODUL AJAR' },
  lkpd: { docType: 'Lembar Kerja Peserta Didik (LKPD)', folder: 'LKPD', shortLabel: 'LKPD' },
};

export const CurriculumManagementPage: React.FC<CurriculumManagementPageProps> = ({
  defaultTab = 'cp',
  onNavigate,
}) => {
  const { user, activeRole } = useAuth();
  const { selectedSubjectId, selectedClassLevel, setWorkspaceSelection } = useWorkspace();
  const { isConnected: isOAuthDriveConnected, googleUser, uploadFile: uploadToGoogleDrive } = useGoogleDrive();
  const [activeTab, setActiveTab] = useState<CurriculumTab>(defaultTab);

  // Master & Assignment States
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [allClasses, setAllClasses] = useState<ClassRoom[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeachingAssignment[]>([]);
  const [resolvedTeacher, setResolvedTeacher] = useState<Teacher | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [activeYearId, setActiveYearId] = useState<string>('ay-2026');
  const [activeSemesterId, setActiveSemesterId] = useState<string>('sem-ganjil-2026');
  const [activeYearName, setActiveYearName] = useState<string>('2026/2027');
  const [activeSemesterType, setActiveSemesterType] = useState<'Ganjil' | 'Genap'>('Ganjil');
  const [isLoadingRefs, setIsLoadingRefs] = useState<boolean>(true);

  // Filter States
  const [selectedSubject, setSelectedSubject] = useState<string>(selectedSubjectId || '');
  const [selectedClass, setSelectedClass] = useState<number>(selectedClassLevel || 4);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Data States
  const [cpList, setCpList] = useState<CapaianPembelajaranItem[]>([]);
  const [tpList, setTpList] = useState<TujuanPembelajaranItem[]>([]);
  const [atpList, setAtpList] = useState<AlurTujuanPembelajaranItem[]>([]);
  const [protaList, setProtaList] = useState<ProtaItem[]>([]);
  const [promesList, setPromesList] = useState<PromesItem[]>([]);
  const [modulList, setModulList] = useState<ModulAjarItem[]>([]);
  const [lkpdList, setLkpdList] = useState<LKPDItem[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<DocumentLink[]>([]);
  const [storedFilesList, setStoredFilesList] = useState<StoredDocumentFile[]>([]);
  const [docScopeFilter, setDocScopeFilter] = useState<'tab' | 'all' | 'everything'>('all');
  const [driveAlert, setDriveAlert] = useState<string | null>(null);

  // Modal States
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showDriveModal, setShowDriveModal] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    tab: CurriculumTab | 'archive-doc';
    id: string;
    label: string;
    fileId?: string | null;
  } | null>(null);
  const [previewModalState, setPreviewModalState] = useState<{
    file: StoredDocumentFile;
    title?: string;
    driveUploadError?: string;
    itemTab?: CurriculumTab;
    itemId?: string;
    curriculumDocId?: string;
  } | null>(null);

  // Form States
  const [cpForm, setCpForm] = useState({ element: 'Menyimak', description: '', source: 'BSKAP No. 032/H/KR/2024', driveUrl: '' });
  const [tpForm, setTpForm] = useState({ code: 'TP 4.1', description: '', scope: '', semester: 'Ganjil' as 'Ganjil' | 'Genap', jp: 12, driveUrl: '' });
  const [atpForm, setAtpForm] = useState({ order: 1, stage: 'Tahap 1', chapter: '', tpCodes: 'TP 4.1', summary: '', jp: 18, assessment: '', driveUrl: '' });
  const [protaForm, setProtaForm] = useState({ title: '', semesterAllocation: 'Ganjil 54 JP / Genap 54 JP', summary: '', jp: 108, driveUrl: '' });
  const [promesForm, setPromesForm] = useState({ title: '', semester: 'Ganjil' as 'Ganjil' | 'Genap', monthDistribution: 'Juli - Desember (18 Minggu Efektif)', summary: '', jp: 54, driveUrl: '' });
  const [modulForm, setModulForm] = useState({ chapter: '', topic: '', tpCode: 'TP 4.1', meetings: '3 Pertemuan (6 JP)', driveUrl: '', intro: '', core: '', closing: '' });
  const [lkpdForm, setLkpdForm] = useState({ title: '', chapter: '', tpCode: 'TP 4.1', activityType: 'Kelompok Kolaboratif' as 'Individu' | 'Kelompok Kolaboratif' | 'Penyelidikan / Eksperimen', instructions: '', rubric: '', driveUrl: '' });

  // Berkas & Pengiriman ke Google Drive / Kepala Madrasah (Berlaku untuk CP, TP, ATP, Prota, Promes, Modul Ajar, LKPD)
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [submitToPrincipal, setSubmitToPrincipal] = useState<boolean>(true);
  const [isSubmittingForm, setIsSubmittingForm] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sinkronisasi tab saat defaultTab berganti dari props
  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Sinkronisasi dengan WorkspaceContext ketika user memilih mapel/kelas dari Dashboard atau Sidebar
  useEffect(() => {
    if (selectedSubjectId) {
      setSelectedSubject(selectedSubjectId);
    }
    if (selectedClassLevel) {
      setSelectedClass(selectedClassLevel);
    }
  }, [selectedSubjectId, selectedClassLevel]);

  const loadData = useCallback(async () => {
    setCpList(curriculumWorkspaceService.getCPList());
    setTpList(curriculumWorkspaceService.getTPList());
    setAtpList(curriculumWorkspaceService.getATPList());
    setProtaList(curriculumWorkspaceService.getProtaList());
    setPromesList(curriculumWorkspaceService.getPromesList());
    setModulList(curriculumWorkspaceService.getModulList());
    setLkpdList(curriculumWorkspaceService.getLKPDList());
    void fileStorageService.hydrateConfigFromServer();

    try {
      const [sbjs, clss, asgs, sys, years, sems, teacher, tchs, docs, allStoredFiles] = await Promise.all([
        academicService.getSubjects(),
        academicService.getClasses(),
        academicService.getTeachingAssignments(),
        academicService.getSettings(),
        academicService.getAcademicYears(),
        academicService.getSemesters(),
        academicService.resolveTeacherForUser(user),
        academicService.getTeachers(),
        curriculumService.getDocuments(),
        fileStorageService.getAllFiles(),
      ]);

      setAllSubjects(sbjs);
      setAllClasses(clss);
      setSettings(sys);
      setResolvedTeacher(teacher);
      setStoredFilesList(allStoredFiles);
      const { candidateTeacherIds } = academicService.getMatchingTeacherIdsForUser(user, teacher, tchs);
      setUploadedDocs(
        activeRole === 'guru'
          ? docs.filter(
              (d) =>
                candidateTeacherIds.has(d.teacher_id) ||
                (d.teacher?.id ? candidateTeacherIds.has(d.teacher.id) : false)
            )
          : docs
      );

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
      setTeacherAssignments(relevantAsgs);

      if (activeRole === 'guru') {
        if (relevantAsgs.length > 0) {
          const validSubjectIds = Array.from(new Set(relevantAsgs.map((a) => a.subject_id)));
          const preferredSbj =
            (selectedSubjectId && validSubjectIds.includes(selectedSubjectId) && selectedSubjectId) ||
            (selectedSubject && validSubjectIds.includes(selectedSubject) && selectedSubject) ||
            validSubjectIds[0];

          const slotsForSbj = relevantAsgs.filter((a) => a.subject_id === preferredSbj);
          const validLevels = slotsForSbj
            .map((a) => a.class?.level || clss.find((c) => c.id === a.class_id)?.level || 0)
            .filter((lvl) => lvl > 0);
          const preferredLevel =
            (selectedClassLevel && validLevels.includes(selectedClassLevel) && selectedClassLevel) ||
            (validLevels.includes(selectedClass) && selectedClass) ||
            validLevels[0] ||
            4;

          setSelectedSubject(preferredSbj);
          setSelectedClass(preferredLevel);
        } else {
          setSelectedSubject('');
        }
      } else {
        const preferredSbj =
          (selectedSubjectId && sbjs.some((s) => s.id === selectedSubjectId) && selectedSubjectId) ||
          (selectedSubject && sbjs.some((s) => s.id === selectedSubject) && selectedSubject) ||
          sbjs[0]?.id ||
          '';
        setSelectedSubject(preferredSbj);
        if (selectedClassLevel) {
          setSelectedClass(selectedClassLevel);
        } else if (clss.length > 0 && !clss.some((c) => c.level === selectedClass)) {
          setSelectedClass(clss[0].level);
        }
      }
    } catch (err) {
      console.error('Gagal memuat data referensi perangkat pembelajaran:', err);
    } finally {
      setIsLoadingRefs(false);
    }
  }, [activeRole, user?.id, user?.email, user?.teacherId, user?.profile?.full_name, selectedSubjectId, selectedClassLevel]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRealtimeSync(
    [
      'simpel_mi_cp_items_v1',
      'simpel_mi_tp_items_v1',
      'simpel_mi_atp_items_v1',
      'simpel_mi_prota_items_v1',
      'simpel_mi_promes_items_v1',
      'simpel_mi_modul_items_v1',
      'simpel_mi_lkpd_items_v1',
      'simpel_curriculum_documents',
      'simpel_drive_storage_config_v1',
      'simpel_assignments',
      'simpel_subjects',
      'simpel_classes',
      'simpel_teachers',
      'simpel_users_cache_v2',
    ],
    () => {
      void loadData();
    }
  );

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4500);
  };

  // Helper filter data per subject & class
  const filteredCP = cpList.filter(
    (c) =>
      c.subject_id === selectedSubject &&
      c.class_level === selectedClass &&
      (c.element.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredTP = tpList.filter(
    (t) =>
      t.subject_id === selectedSubject &&
      t.class_level === selectedClass &&
      (t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.scope_of_material.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredATP = atpList.filter(
    (a) =>
      a.subject_id === selectedSubject &&
      a.class_level === selectedClass &&
      (a.chapter_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.material_summary.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredProta = protaList.filter(
    (p) =>
      p.subject_id === selectedSubject &&
      p.class_level === selectedClass &&
      (p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.material_summary.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredPromes = promesList.filter(
    (p) =>
      p.subject_id === selectedSubject &&
      p.class_level === selectedClass &&
      (p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.material_summary.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredModul = modulList.filter(
    (m) =>
      m.subject_id === selectedSubject &&
      m.class_level === selectedClass &&
      (m.chapter_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.topic.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredLKPD = lkpdList.filter(
    (l) =>
      l.subject_id === selectedSubject &&
      l.class_level === selectedClass &&
      (l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.chapter_topic.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Ekspor CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    const filename = `perangkat_${activeTab}_kelas${selectedClass}.csv`;

    if (activeTab === 'cp') {
      headers = ['No', 'Mata Pelajaran', 'Fase', 'Elemen', 'Deskripsi Capaian Pembelajaran', 'Sumber Acuan', 'Tautan Drive'];
      rows = filteredCP.map((c, i) => [i + 1, c.subject_name, c.phase, c.element, `"${c.description}"`, `"${c.source}"`, c.google_drive_url || '-']);
    } else if (activeTab === 'tp') {
      headers = ['No', 'Kode TP', 'Mata Pelajaran', 'Kelas', 'Semester', 'Lingkup Materi / Bab', 'Tujuan Pembelajaran', 'Alokasi (JP)', 'Tautan Drive'];
      rows = filteredTP.map((t, i) => [i + 1, t.code, t.subject_name, t.class_level, t.semester, `"${t.scope_of_material}"`, `"${t.description}"`, t.allocated_hours, t.google_drive_url || '-']);
    } else if (activeTab === 'atp') {
      headers = ['Urutan', 'Tahap', 'Bab / Lingkup Materi', 'TP Terkait', 'Ringkasan Materi', 'Alokasi (JP)', 'Rencana Asesmen', 'Tautan Drive'];
      rows = filteredATP.map((a) => [a.sequence_order, a.stage_name, `"${a.chapter_title}"`, `"${a.tp_codes.join(', ')}"`, `"${a.material_summary}"`, a.allocated_hours, `"${a.assessment_plan}"`, a.google_drive_url || '-']);
    } else if (activeTab === 'prota') {
      headers = ['No', 'Judul Prota', 'Tahun Pelajaran', 'Pembagian Semester', 'Ringkasan Materi', 'Total JP', 'Status', 'Tautan Drive'];
      rows = filteredProta.map((p, i) => [i + 1, `"${p.title}"`, p.academic_year, `"${p.semester_allocation}"`, `"${p.material_summary}"`, p.allocated_hours, p.status, p.google_drive_url]);
    } else if (activeTab === 'promes') {
      headers = ['No', 'Judul Promes', 'Semester', 'Distribusi Bulan/Minggu', 'Ringkasan Materi', 'Alokasi JP', 'Status', 'Tautan Drive'];
      rows = filteredPromes.map((p, i) => [i + 1, `"${p.title}"`, p.semester, `"${p.month_distribution}"`, `"${p.material_summary}"`, p.allocated_hours, p.status, p.google_drive_url]);
    } else if (activeTab === 'modul-ajar') {
      headers = ['No', 'Bab', 'Topik Modul', 'Target TP', 'Pertemuan', 'Pendekatan Cinta / Deep Learning', 'Status', 'Tautan Drive'];
      rows = filteredModul.map((m, i) => [i + 1, `"${m.chapter_title}"`, `"${m.topic}"`, m.target_tp_code, m.allocated_meetings, `"${m.deep_learning_approach}"`, m.status, m.google_drive_url]);
    } else {
      headers = ['No', 'Judul LKPD', 'Bab / Topik', 'Target TP', 'Tipe Aktivitas', 'Petunjuk Singkat', 'Tautan Google Docs/Drive'];
      rows = filteredLKPD.map((l, i) => [i + 1, `"${l.title}"`, `"${l.chapter_topic}"`, l.target_tp_code, l.activity_type, `"${l.instructions}"`, l.google_drive_url]);
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`Berkas ${filename} berhasil diunduh.`);
  };

  // Daftar mata pelajaran & kelas tersedia berdasarkan peran & penugasan
  const availableSubjects: Subject[] =
    activeRole === 'guru'
      ? (() => {
          const fromMaster = allSubjects.filter((s) =>
            teacherAssignments.some((a) => a.subject_id === s.id)
          );
          const seenIds = new Set(fromMaster.map((s) => s.id));
          const extra = teacherAssignments
            .map((a) => a.subject)
            .filter((s): s is Subject => Boolean(s && !seenIds.has(s.id)));
          return [...fromMaster, ...extra];
        })()
      : allSubjects;

  const availableClasses: ClassRoom[] =
    activeRole === 'guru'
      ? (() => {
          const fromMaster = allClasses.filter((c) =>
            teacherAssignments.some(
              (a) => a.class_id === c.id && (!selectedSubject || a.subject_id === selectedSubject)
            )
          );
          const seenIds = new Set(fromMaster.map((c) => c.id));
          const extra = teacherAssignments
            .filter((a) => !selectedSubject || a.subject_id === selectedSubject)
            .map((a) => a.class)
            .filter((c): c is ClassRoom => Boolean(c && !seenIds.has(c.id)));
          return [...fromMaster, ...extra];
        })()
      : allClasses;

  const currentSubjectObj =
    availableSubjects.find((s) => s.id === selectedSubject) ||
    allSubjects.find((s) => s.id === selectedSubject);
  const currentSubjectName = currentSubjectObj?.name || 'Mata Pelajaran';
  const currentPhase: 'A' | 'B' | 'C' = selectedClass <= 2 ? 'A' : selectedClass <= 4 ? 'B' : 'C';

  // Cetak Dokumen
  const handlePrint = () => {
    let title = 'PERANGKAT PEMBELAJARAN MADRASAH';
    let subtitle = `${currentSubjectName} - Kelas ${selectedClass}`;
    let contentHtml = '';

    if (activeTab === 'cp') {
      title = 'DOKUMEN CAPAIAN PEMBELAJARAN (CP)';
      contentHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">No</th>
              <th style="width: 140px;">Elemen Capaian</th>
              <th>Deskripsi Capaian Pembelajaran</th>
              <th style="width: 70px;">Fase</th>
            </tr>
          </thead>
          <tbody>
            ${filteredCP.map((item, idx) => `
              <tr>
                <td class="center">${idx + 1}</td>
                <td><strong>${item.element}</strong></td>
                <td>${item.description}</td>
                <td class="center font-bold">Fase ${item.phase}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeTab === 'tp') {
      title = 'DOKUMEN TUJUAN PEMBELAJARAN (TP)';
      contentHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">No</th>
              <th style="width: 80px;">Kode TP</th>
              <th style="width: 160px;">Lingkup Materi</th>
              <th>Rumusan Tujuan Pembelajaran (TP)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTP.map((item, idx) => `
              <tr>
                <td class="center">${idx + 1}</td>
                <td class="center font-mono font-bold">${item.code}</td>
                <td><strong>${item.scope_of_material}</strong></td>
                <td>${item.description}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeTab === 'atp') {
      title = 'ALUR TUJUAN PEMBELAJARAN (ATP)';
      contentHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 55px;">Urutan</th>
              <th style="width: 90px;">Kode TP</th>
              <th>Alur Tujuan Pembelajaran & Aktivitas</th>
              <th style="width: 80px;">Alokasi JP</th>
            </tr>
          </thead>
          <tbody>
            ${filteredATP.map((item) => `
              <tr>
                <td class="center font-bold">Tahap ${item.sequence_order}</td>
                <td class="center font-mono font-bold">${item.tp_codes ? item.tp_codes.join(', ') : item.stage_name}</td>
                <td><strong>${item.chapter_title}</strong>: ${item.material_summary}</td>
                <td class="center font-bold">${item.allocated_hours} JP</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeTab === 'prota') {
      title = 'PROGRAM TAHUNAN (PROTA)';
      contentHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">No</th>
              <th>Judul Program Tahunan</th>
              <th style="width: 150px;">Pembagian Semester</th>
              <th style="width: 80px;">Total JP</th>
            </tr>
          </thead>
          <tbody>
            ${filteredProta.map((p, idx) => `
              <tr>
                <td class="center">${idx + 1}</td>
                <td><strong>${p.title}</strong><br>${p.material_summary}</td>
                <td>${p.semester_allocation}</td>
                <td class="center font-bold">${p.allocated_hours} JP</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeTab === 'promes') {
      title = 'PROGRAM SEMESTER (PROMES)';
      contentHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">No</th>
              <th>Judul Program Semester</th>
              <th style="width: 90px;">Semester</th>
              <th style="width: 150px;">Distribusi Waktu</th>
              <th style="width: 80px;">Alokasi JP</th>
            </tr>
          </thead>
          <tbody>
            ${filteredPromes.map((p, idx) => `
              <tr>
                <td class="center">${idx + 1}</td>
                <td><strong>${p.title}</strong><br>${p.material_summary}</td>
                <td class="center">${p.semester}</td>
                <td>${p.month_distribution}</td>
                <td class="center font-bold">${p.allocated_hours} JP</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeTab === 'modul-ajar') {
      title = 'MODUL AJAR PEMBELAJARAN MENDALAM';
      contentHtml = filteredModul.map((m, idx) => `
        <div style="margin-bottom: 24px; border: 1px solid #cbd5e1; padding: 12px; page-break-inside: avoid;">
          <h3 style="margin: 0 0 8px 0; color: #047857;">${idx + 1}. ${m.chapter_title} (${m.allocated_meetings})</h3>
          <p style="margin: 2px 0;"><strong>Topik:</strong> ${m.topic}</p>
          <p style="margin: 2px 0;"><strong>Pendekatan:</strong> <span style="color:#047857;font-weight:bold;">${m.deep_learning_approach}</span></p>
          <div style="margin-top: 8px;"><strong>Langkah Pembelajaran Mendalam:</strong></div>
          <div style="margin-top: 4px; padding: 6px; background: #f8fafc; border-left: 3px solid #047857; font-size: 9.5pt;">${(m.learning_activities?.core_deep_learning || m.learning_activities?.introduction || '').replace(/\n/g, '<br>')}</div>
        </div>
      `).join('');
    } else if (activeTab === 'lkpd') {
      title = 'LEMBAR KERJA PESERTA DIDIK (LKPD)';
      contentHtml = filteredLKPD.map((l, idx) => `
        <div style="margin-bottom: 24px; border: 1px solid #cbd5e1; padding: 12px; page-break-inside: avoid;">
          <h3 style="margin: 0 0 6px 0; color: #047857;">${idx + 1}. ${l.title} (${l.activity_type})</h3>
          <p style="margin: 2px 0;"><strong>Materi / Bab:</strong> ${l.chapter_topic}</p>
          <div style="margin-top: 8px;"><strong>Instruksi & Lembar Tugas:</strong></div>
          <div style="margin-top: 4px; padding: 8px; background: #f8fafc; border: 1px dashed #94a3b8; font-size: 9.5pt;">${(l.instructions || '').replace(/\n/g, '<br>')}</div>
        </div>
      `).join('');
    }

    printDocumentDirectly(contentHtml, {
      title,
      subtitle: `${currentSubjectName} - Kelas ${selectedClass} (Tahun Pelajaran ${activeYearName})`,
      metadata: [
        { label: 'Mata Pelajaran', value: currentSubjectName },
        { label: 'Tingkat Kelas', value: `Kelas ${selectedClass} (Fase ${currentPhase})` },
        { label: 'Kurikulum Acuan', value: 'Kurikulum Merdeka (KMA 450/2024) - KBC' },
        { label: 'Tanggal Dokumen', value: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) },
      ],
      signature: {
        leftTitle: 'Guru Pengampu Mata Pelajaran,',
        leftName: user?.profile?.full_name || resolvedTeacher?.full_name || 'Guru Pengampu',
        leftNip: resolvedTeacher?.nip || '-',
        rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        rightTitle: 'Mengetahui,<br>Kepala Madrasah,',
        rightName: settings?.principal_name || 'Kepala Madrasah',
        rightNip: settings?.principal_nip || '-',
      },
    });
  };

  // Helper Pratinjau & Unduh berkas yang diarsipkan
  const handlePreviewFile = async (
    fileId?: string,
    fallbackTitle?: string,
    fallbackDriveUrl?: string,
    itemTab?: CurriculumTab,
    itemId?: string
  ) => {
    let stored = fileId ? await fileStorageService.getFileById(fileId) : null;
    if (!stored && fallbackDriveUrl && isRealDriveFileUrl(fallbackDriveUrl)) {
      stored = {
        id: fileId || `drive-${Date.now()}`,
        name: fallbackTitle || 'Dokumen Google Drive',
        size: 0,
        mimeType: 'application/pdf',
        category: DOC_META_BY_TAB[itemTab || activeTab].docType,
        uploadedBy: user?.profile?.full_name || 'Guru Madrasah',
        uploadedAt: new Date().toISOString(),
        googleDriveUrl: fallbackDriveUrl,
      };
    }
    if (!stored) {
      notify('Berkas lokal tidak ditemukan di perangkat ini. Silakan buka tautan Google Drive.');
      return;
    }
    setPreviewModalState({
      file: stored,
      title: fallbackTitle ? `Pratinjau: ${fallbackTitle}` : undefined,
      itemTab,
      itemId,
    });
  };

  const handleDownloadFile = async (fileId?: string) => {
    if (!fileId) return;
    const stored = await fileStorageService.getFileById(fileId);
    if (!stored) {
      notify('Berkas lokal tidak ditemukan di perangkat ini. Silakan unduh melalui Google Drive.');
      return;
    }
    fileStorageService.downloadStoredFile(stored);
  };

  const getCurrentManualDriveUrl = (): string => {
    if (activeTab === 'cp') return cpForm.driveUrl.trim();
    if (activeTab === 'tp') return tpForm.driveUrl.trim();
    if (activeTab === 'atp') return atpForm.driveUrl.trim();
    if (activeTab === 'prota') return protaForm.driveUrl.trim();
    if (activeTab === 'promes') return promesForm.driveUrl.trim();
    if (activeTab === 'modul-ajar') return modulForm.driveUrl.trim();
    return lkpdForm.driveUrl.trim();
  };

  const getDocumentDisplayTitle = (): string => {
    if (activeTab === 'cp') return `CP ${cpForm.element} - ${currentSubjectName} Kelas ${selectedClass}`;
    if (activeTab === 'tp') return `${tpForm.code} - ${tpForm.scope || currentSubjectName}`;
    if (activeTab === 'atp') return `ATP ${atpForm.chapter || atpForm.stage} - ${currentSubjectName}`;
    if (activeTab === 'prota') return protaForm.title || `Prota ${currentSubjectName} Kelas ${selectedClass}`;
    if (activeTab === 'promes') return promesForm.title || `Promes ${promesForm.semester} ${currentSubjectName} Kelas ${selectedClass}`;
    if (activeTab === 'modul-ajar') return modulForm.topic || modulForm.chapter || `Modul Ajar ${currentSubjectName}`;
    return lkpdForm.title || `LKPD ${currentSubjectName} Kelas ${selectedClass}`;
  };

  const handleFileSelectedInModal = (file: File | null) => {
    setUploadFile(file);
    setFormError(null);
    if (!file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    if (activeTab === 'cp' && !cpForm.description.trim()) {
      setCpForm((prev) => ({ ...prev, description: `Dokumen CP terlampir: ${baseName}` }));
    } else if (activeTab === 'tp') {
      setTpForm((prev) => ({
        ...prev,
        scope: prev.scope.trim() || baseName,
        description: prev.description.trim() || `Dokumen TP terlampir: ${baseName}`,
      }));
    } else if (activeTab === 'atp') {
      setAtpForm((prev) => ({
        ...prev,
        chapter: prev.chapter.trim() || baseName,
        summary: prev.summary.trim() || `Dokumen ATP terlampir: ${baseName}`,
      }));
    } else if (activeTab === 'prota' && !protaForm.title.trim()) {
      setProtaForm((prev) => ({ ...prev, title: baseName }));
    } else if (activeTab === 'promes' && !promesForm.title.trim()) {
      setPromesForm((prev) => ({ ...prev, title: baseName }));
    } else if (activeTab === 'modul-ajar') {
      setModulForm((prev) => ({
        ...prev,
        chapter: prev.chapter.trim() || `Modul Ajar ${currentSubjectName}`,
        topic: prev.topic.trim() || baseName,
      }));
    } else if (activeTab === 'lkpd' && !lkpdForm.title.trim()) {
      setLkpdForm((prev) => ({ ...prev, title: baseName }));
    }
  };

  // Handler Submit Form (Mendukung Upload Berkas Langsung ke Google Drive via Apps Script tanpa Login)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedSubject) {
      setFormError('Pilih mata pelajaran terlebih dahulu.');
      return;
    }

    setIsSubmittingForm(true);
    try {
      const teacherIdForRecord = resolvedTeacher?.id || user?.teacherId || user?.id || '';
      const teacherNameForRecord = user?.profile?.full_name || resolvedTeacher?.full_name || 'Guru Madrasah';
      const classObj = allClasses.find((c) => c.level === selectedClass);
      const classIdForDoc = classObj?.id || allClasses[0]?.id || '';
      const docMeta = DOC_META_BY_TAB[activeTab];
      const driveConfig = await fileStorageService.hydrateConfigFromServer();
      const appsScriptReady = fileStorageService.isAppsScriptActive(driveConfig);
      const manualUrl = getCurrentManualDriveUrl();
      const docTitle = getDocumentDisplayTitle();

      let finalDriveUrl = manualUrl;
      let storedFileId = '';
      let storedFileName = '';
      let savedStoredFile: StoredDocumentFile | null = null;
      let uploadedViaOAuth = false;
      let uploadedViaAppsScript = false;
      let appsScriptWarn = '';

      // Jika guru memilih berkas fisik, unggah otomatis ke Google Drive Madrasah (prioritaskan Apps Script alihsansoborejo@gmail.com tanpa login)
      if (uploadFile) {
        const structuredPath = fileStorageService.buildStructuredDrivePath({
          academicYearName: activeYearName,
          semesterType: activeSemesterType,
          className: classObj?.name || `Kelas ${selectedClass}`,
          subjectName: currentSubjectName,
          category: docMeta.docType,
          categoryFolder: docMeta.folder,
        });
        const cleanTitle = docTitle.trim() || uploadFile.name.replace(/\.[^/.]+$/, '');
        const fileNameToUse = fileStorageService.formatDriveFileName(
          cleanTitle,
          teacherNameForRecord,
          uploadFile.name
        );

        let oauthUrl = '';
        let oauthFileId = '';
        if (!appsScriptReady && isOAuthDriveConnected && !finalDriveUrl) {
          try {
            const uploadedDriveFile = await uploadToGoogleDrive(
              uploadFile,
              fileNameToUse,
              `${docMeta.docType} · ${currentSubjectName} · Kelas ${selectedClass} · Pengunggah: ${teacherNameForRecord}`,
              uploadFile.type || 'application/octet-stream',
              structuredPath.categoryFolder,
              driveConfig.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo'
            );
            oauthUrl =
              uploadedDriveFile.webViewLink || `https://drive.google.com/file/d/${uploadedDriveFile.id}/view`;
            oauthFileId = uploadedDriveFile.id;
            uploadedViaOAuth = true;
          } catch (oauthErr) {
            console.warn('Upload OAuth dilewati, mencoba Apps Script / arsip lokal:', oauthErr);
          }
        }

        const saved = await fileStorageService.saveDocumentFile({
          file: uploadFile,
          name: fileNameToUse,
          category: docMeta.docType,
          categoryFolder: structuredPath.categoryFolder,
          folderPath: structuredPath.folderSegments,
          description: `${currentSubjectName} (${classObj?.name || `Kelas ${selectedClass}`})`,
          uploadedBy: teacherNameForRecord,
          googleDriveUrl: finalDriveUrl || oauthUrl || undefined,
          driveFileId: oauthFileId || undefined,
        });

        savedStoredFile = saved;
        storedFileId = saved.id;
        storedFileName = saved.name;
        uploadedViaAppsScript = Boolean(saved.uploadedViaAppsScript);
        if (saved.driveUploadError && !uploadedViaOAuth) {
          appsScriptWarn = saved.driveUploadError;
        }
        finalDriveUrl =
          (isRealDriveFileUrl(saved.googleDriveUrl) ? saved.googleDriveUrl : '') ||
          (isRealDriveFileUrl(oauthUrl) ? oauthUrl : '') ||
          manualUrl ||
          '';
      }

      const targetStatus: 'Draft' | 'Diajukan' =
        (uploadFile || manualUrl) && submitToPrincipal ? 'Diajukan' : 'Draft';

      let savedItemId = '';

      if (activeTab === 'cp') {
        const item: CapaianPembelajaranItem = {
          id: editId || `cp-${Date.now()}`,
          subject_id: selectedSubject,
          subject_name: currentSubjectName,
          phase: currentPhase,
          class_level: selectedClass,
          element: cpForm.element,
          description: cpForm.description,
          source: cpForm.source,
          google_drive_url: finalDriveUrl || undefined,
          file_id: storedFileId || undefined,
          file_name: storedFileName || undefined,
          status: targetStatus,
          created_at: new Date().toISOString(),
        };
        savedItemId = item.id;
        curriculumWorkspaceService.saveCP(item);
      } else if (activeTab === 'tp') {
        const item: TujuanPembelajaranItem = {
          id: editId || `tp-${Date.now()}`,
          subject_id: selectedSubject,
          subject_name: currentSubjectName,
          class_level: selectedClass,
          code: tpForm.code,
          description: tpForm.description,
          scope_of_material: tpForm.scope,
          semester: tpForm.semester,
          allocated_hours: Number(tpForm.jp),
          is_active: true,
          google_drive_url: finalDriveUrl || undefined,
          file_id: storedFileId || undefined,
          file_name: storedFileName || undefined,
          status: targetStatus,
          created_at: new Date().toISOString(),
        };
        savedItemId = item.id;
        curriculumWorkspaceService.saveTP(item);
      } else if (activeTab === 'atp') {
        const item: AlurTujuanPembelajaranItem = {
          id: editId || `atp-${Date.now()}`,
          subject_id: selectedSubject,
          subject_name: currentSubjectName,
          class_level: selectedClass,
          semester: activeSemesterType,
          sequence_order: Number(atpForm.order),
          stage_name: atpForm.stage,
          chapter_title: atpForm.chapter,
          tp_codes: atpForm.tpCodes.split(',').map((s) => s.trim()),
          material_summary: atpForm.summary,
          allocated_hours: Number(atpForm.jp),
          assessment_plan: atpForm.assessment,
          google_drive_url: finalDriveUrl || undefined,
          file_id: storedFileId || undefined,
          file_name: storedFileName || undefined,
          status: targetStatus,
          created_at: new Date().toISOString(),
        };
        savedItemId = item.id;
        curriculumWorkspaceService.saveATP(item);
      } else if (activeTab === 'prota') {
        const item: ProtaItem = {
          id: editId || `prota-${Date.now()}`,
          teacher_id: teacherIdForRecord,
          teacher_name: teacherNameForRecord,
          subject_id: selectedSubject,
          subject_name: currentSubjectName,
          class_level: selectedClass,
          academic_year: activeYearName,
          title: protaForm.title,
          semester_allocation: protaForm.semesterAllocation,
          material_summary: protaForm.summary,
          allocated_hours: Number(protaForm.jp),
          google_drive_url: finalDriveUrl || '',
          file_id: storedFileId || undefined,
          file_name: storedFileName || undefined,
          status: targetStatus,
          created_at: new Date().toISOString(),
        };
        savedItemId = item.id;
        curriculumWorkspaceService.saveProta(item);
      } else if (activeTab === 'promes') {
        const item: PromesItem = {
          id: editId || `promes-${Date.now()}`,
          teacher_id: teacherIdForRecord,
          teacher_name: teacherNameForRecord,
          subject_id: selectedSubject,
          subject_name: currentSubjectName,
          class_level: selectedClass,
          semester: promesForm.semester,
          title: promesForm.title,
          month_distribution: promesForm.monthDistribution,
          material_summary: promesForm.summary,
          allocated_hours: Number(promesForm.jp),
          google_drive_url: finalDriveUrl || '',
          file_id: storedFileId || undefined,
          file_name: storedFileName || undefined,
          status: targetStatus,
          created_at: new Date().toISOString(),
        };
        savedItemId = item.id;
        curriculumWorkspaceService.savePromes(item);
      } else if (activeTab === 'modul-ajar') {
        const item: ModulAjarItem = {
          id: editId || `modul-${Date.now()}`,
          teacher_id: teacherIdForRecord,
          teacher_name: teacherNameForRecord,
          subject_id: selectedSubject,
          subject_name: currentSubjectName,
          class_level: selectedClass,
          semester: activeSemesterType,
          chapter_title: modulForm.chapter,
          topic: modulForm.topic,
          target_tp_code: modulForm.tpCode,
          allocated_meetings: modulForm.meetings,
          deep_learning_approach: 'Kurikulum Berbasis Cinta & Pembelajaran Mendalam (Mindful, Meaningful, Joyful)',
          learning_activities: {
            introduction: modulForm.intro,
            core_deep_learning: modulForm.core,
            closing_reflection: modulForm.closing,
          },
          google_drive_url: finalDriveUrl || '',
          file_id: storedFileId || undefined,
          file_name: storedFileName || undefined,
          status: targetStatus,
          created_at: new Date().toISOString(),
        };
        savedItemId = item.id;
        curriculumWorkspaceService.saveModul(item);
      } else {
        const item: LKPDItem = {
          id: editId || `lkpd-${Date.now()}`,
          teacher_id: teacherIdForRecord,
          teacher_name: teacherNameForRecord,
          subject_id: selectedSubject,
          subject_name: currentSubjectName,
          class_level: selectedClass,
          title: lkpdForm.title,
          chapter_topic: lkpdForm.chapter,
          target_tp_code: lkpdForm.tpCode,
          activity_type: lkpdForm.activityType,
          instructions: lkpdForm.instructions,
          rubric_summary: lkpdForm.rubric,
          google_drive_url: finalDriveUrl || '',
          file_id: storedFileId || undefined,
          file_name: storedFileName || undefined,
          status: targetStatus,
          created_at: new Date().toISOString(),
        };
        savedItemId = item.id;
        curriculumWorkspaceService.saveLKPD(item);
      }

      // Daftarkan ke Arsip Dokumen Kurikulum agar muncul di Dashboard Kepala Madrasah saat ada berkas/tautan Drive
      let createdCurriculumDocId = '';
      if (uploadFile || manualUrl) {
        const createdCurriculumDoc = await curriculumService.createDocument({
          teacher_id: teacherIdForRecord,
          academic_year_id: activeYearId,
          semester_id: activeSemesterId,
          class_id: classIdForDoc,
          subject_id: selectedSubject,
          document_type: docMeta.docType,
          title: docTitle,
          google_drive_url: finalDriveUrl || '',
          file_id: storedFileId || null,
          status: submitToPrincipal ? 'Diajukan' : 'Draft',
          submission_date: submitToPrincipal ? new Date().toISOString() : null,
        });
        createdCurriculumDocId = createdCurriculumDoc.id;
      }

      const driveUploadStatus = uploadedViaAppsScript
        ? ' & langsung terkirim ke Google Drive Madrasah (tanpa login)'
        : uploadedViaOAuth
        ? ' & tersimpan ke Google Drive Madrasah'
        : uploadFile
        ? ' ke arsip dokumen aplikasi'
        : '';
      const kamadSuffix =
        (uploadFile || manualUrl) && submitToPrincipal
          ? ' dan dikirim ke Dashboard Kepala Madrasah untuk ditelaah'
          : '';
      if (appsScriptWarn) {
        setDriveAlert(
          `Berkas "${docTitle}" berhasil disimpan ke arsip aplikasi, namun sinkronisasi otomatis ke Google Drive gagal: ${appsScriptWarn}`
        );
      } else if (uploadedViaAppsScript || uploadedViaOAuth) {
        setDriveAlert(null);
      }

      notify(`${docMeta.shortLabel} "${docTitle}" berhasil disimpan${driveUploadStatus}${kamadSuffix}.`);
      const uploadedTab = activeTab;
      setShowModal(false);
      setEditId(null);
      setUploadFile(null);
      void loadData();

      if (savedStoredFile) {
        setPreviewModalState({
          file: savedStoredFile,
          title: `Pratinjau ${docMeta.shortLabel}: ${docTitle}`,
          driveUploadError: savedStoredFile.driveUploadError,
          itemTab: uploadedTab,
          itemId: savedItemId,
          curriculumDocId: createdCurriculumDocId || undefined,
        });
      }
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan perangkat pembelajaran.');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Konfirmasi Hapus tanpa window.confirm
  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    if (pendingDelete.tab === 'archive-doc') {
      if (pendingDelete.fileId) {
        await fileStorageService.deleteFile(pendingDelete.fileId).catch(() => {});
      }
      await curriculumService.deleteDocument(pendingDelete.id);
    } else if (pendingDelete.tab === 'cp') curriculumWorkspaceService.deleteCP(pendingDelete.id);
    else if (pendingDelete.tab === 'tp') curriculumWorkspaceService.deleteTP(pendingDelete.id);
    else if (pendingDelete.tab === 'atp') curriculumWorkspaceService.deleteATP(pendingDelete.id);
    else if (pendingDelete.tab === 'prota') curriculumWorkspaceService.deleteProta(pendingDelete.id);
    else if (pendingDelete.tab === 'promes') curriculumWorkspaceService.deletePromes(pendingDelete.id);
    else if (pendingDelete.tab === 'modul-ajar') curriculumWorkspaceService.deleteModul(pendingDelete.id);
    else curriculumWorkspaceService.deleteLKPD(pendingDelete.id);

    notify(`"${pendingDelete.label}" berhasil dihapus.`);
    setPendingDelete(null);
    void loadData();
  };

  // Buka Modal Tambah
  const handleOpenAdd = () => {
    if (!selectedSubject) {
      notify('Belum ada mata pelajaran yang ditugaskan untuk Anda.');
      return;
    }
    setEditId(null);
    setUploadFile(null);
    setFormError(null);
    setSubmitToPrincipal(true);
    const defaultTp = `TP ${selectedClass}.1`;
    if (activeTab === 'cp') {
      setCpForm({ element: 'Pemahaman Materi', description: '', source: 'BSKAP No. 032/H/KR/2024', driveUrl: '' });
    } else if (activeTab === 'tp') {
      const nextNum = filteredTP.length + 1;
      setTpForm({ code: `TP ${selectedClass}.${nextNum}`, description: '', scope: '', semester: activeSemesterType, jp: 12, driveUrl: '' });
    } else if (activeTab === 'atp') {
      const nextSeq = filteredATP.length + 1;
      setAtpForm({ order: nextSeq, stage: `Tahap ${nextSeq}`, chapter: '', tpCodes: defaultTp, summary: '', jp: 18, assessment: '', driveUrl: '' });
    } else if (activeTab === 'prota') {
      setProtaForm({
        title: `Program Tahunan (Prota) ${currentSubjectName} Kelas ${selectedClass}`,
        semesterAllocation: 'Ganjil 54 JP / Genap 54 JP',
        summary: '',
        jp: 108,
        driveUrl: '',
      });
    } else if (activeTab === 'promes') {
      setPromesForm({
        title: `Program Semester ${activeSemesterType} ${currentSubjectName} Kelas ${selectedClass}`,
        semester: activeSemesterType,
        monthDistribution: activeSemesterType === 'Ganjil' ? 'Juli - Desember (18 Minggu Efektif)' : 'Januari - Juni (18 Minggu Efektif)',
        summary: '',
        jp: 54,
        driveUrl: '',
      });
    } else if (activeTab === 'modul-ajar') {
      setModulForm({ chapter: '', topic: '', tpCode: defaultTp, meetings: '3 Pertemuan (6 JP)', driveUrl: '', intro: 'Tadarus pagi, sapaan kasih sayang guru, apersepsi.', core: 'Eksplorasi konsep bermakna, diskusi kolaboratif santun.', closing: 'Refleksi berkesadaran dan doa penutup.' });
    } else {
      setLkpdForm({ title: '', chapter: '', tpCode: defaultTp, activityType: 'Kelompok Kolaboratif', instructions: '', rubric: '', driveUrl: '' });
    }
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Notifikasi Pop-up */}
      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-900 text-amber-300 text-xs font-semibold flex items-center justify-between shadow-lg border border-emerald-700 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-white hover:text-amber-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Peringatan Koneksi Google Drive jika Apps Script bermasalah */}
      {driveAlert && (
        <div className="p-3.5 rounded-xl bg-rose-50 text-rose-900 text-xs flex items-start justify-between gap-3 border border-rose-300 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Perlu Perhatian: Pengiriman Otomatis ke Google Drive Terhambat</p>
              <p className="mt-0.5 text-rose-800">{driveAlert}</p>
            </div>
          </div>
          <button onClick={() => setDriveAlert(null)} className="text-rose-500 hover:text-rose-800 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
              Kurikulum Merdeka & Kurikulum Berbasis Cinta
            </span>
            <span className="text-xs text-slate-400">· MI Ma’arif Al Ihsan Soborejo</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Pengelolaan Perangkat Pembelajaran
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola CP, TP, ATP, Prota, Promes, Modul Ajar, dan LKPD secara aktif serta unggah langsung ke Google Drive Madrasah &amp; Buku Nilai.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onNavigate && (
            <button
              onClick={() => onNavigate(activeTab === 'lkpd' ? 'asisten-ai-lkpd' : 'asisten-ai-modul')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-xs cursor-pointer"
              title="Buat Rancangan Otomatis dengan AI Gemini"
            >
              <Sparkles className="w-4 h-4 text-emerald-950" />
              <span>Buat dengan AI</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
            title="Ekspor ke CSV / Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
            title="Cetak Dokumen Resmi"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Cetak / PDF</span>
          </button>

          <button
            onClick={() => setShowDriveModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-300 cursor-pointer"
            title="Unggah file CP, TP, ATP, Prota, Promes, Modul Ajar, atau LKPD ke Google Drive Madrasah & kirim ke Kepala Madrasah"
          >
            <HardDrive className="w-4 h-4 text-emerald-700" />
            <span>Arsipkan ke Drive &amp; Kirim Kamad</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-300" />
            <span>Tambah {DOC_META_BY_TAB[activeTab].shortLabel} Baru</span>
          </button>
        </div>
      </div>

      {/* Filter Bar: Mapel & Kelas + Tab Sub Menu Aktif */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-xs">
        {/* Sub-Menu Tabs (CP, TP, ATP, Prota, Promes, Modul Ajar, LKPD) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
          <button
            onClick={() => setActiveTab('cp')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'cp'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>CP</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'cp' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredCP.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tp')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'tp'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>TP</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'tp' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredTP.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('atp')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'atp'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>ATP</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'atp' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredATP.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('prota')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'prota'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Prota</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'prota' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredProta.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('promes')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'promes'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Promes</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'promes' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredPromes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('modul-ajar')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'modul-ajar'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Heart className="w-4 h-4 text-rose-400" />
            <span>Modul Ajar</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'modul-ajar' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredModul.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('lkpd')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'lkpd'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FolderSync className="w-4 h-4" />
            <span>LKPD</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'lkpd' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredLKPD.length}
            </span>
          </button>
        </div>

        {/* Banner jika guru belum memiliki penugasan */}
        {!isLoadingRefs && activeRole === 'guru' && availableSubjects.length === 0 && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Belum ada penugasan mata pelajaran dan kelas untuk akun Anda. Hubungi Admin Madrasah untuk menetapkan jadwal mengajar di menu <strong>Penugasan Mengajar</strong>.
            </span>
          </div>
        )}

        {/* Filter Baris: Pemilihan Mapel & Kelas & Kotak Pencarian */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Mata Pelajaran:</span>
              <select
                value={selectedSubject}
                onChange={(e) => {
                  const nextSbj = e.target.value;
                  setSelectedSubject(nextSbj);
                  const slots = teacherAssignments.filter((a) => a.subject_id === nextSbj);
                  const firstSlot = slots[0];
                  const nextClassObj = firstSlot
                    ? allClasses.find((c) => c.id === firstSlot.class_id)
                    : allClasses.find((c) => c.level === selectedClass);
                  const nextLvl = nextClassObj?.level || selectedClass;
                  setSelectedClass(nextLvl);
                  setWorkspaceSelection({
                    subjectId: nextSbj,
                    classId: nextClassObj?.id || null,
                    classLevel: nextLvl,
                    assignmentId: firstSlot?.id || null,
                  });
                }}
                disabled={availableSubjects.length === 0}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100"
              >
                {availableSubjects.length === 0 ? (
                  <option value="">{isLoadingRefs ? 'Memuat penugasan...' : 'Belum ada penugasan mapel'}</option>
                ) : (
                  availableSubjects.map((sbj) => (
                    <option key={sbj.id} value={sbj.id}>
                      {sbj.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Tingkat Kelas:</span>
              <select
                value={selectedClass}
                onChange={(e) => {
                  const nextLvl = Number(e.target.value);
                  setSelectedClass(nextLvl);
                  const matchedCls = allClasses.find((c) => c.level === nextLvl);
                  const matchedAsg = teacherAssignments.find(
                    (a) => a.subject_id === selectedSubject && a.class_id === matchedCls?.id
                  );
                  setWorkspaceSelection({
                    subjectId: selectedSubject || null,
                    classId: matchedCls?.id || null,
                    classLevel: nextLvl,
                    assignmentId: matchedAsg?.id || null,
                  });
                }}
                disabled={availableClasses.length === 0}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100"
              >
                {availableClasses.length === 0 ? (
                  <option value={selectedClass}>Belum ada rombel</option>
                ) : (
                  availableClasses.map((cls) => (
                    <option key={cls.id} value={cls.level}>
                      {cls.name} (Fase {cls.phase})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={`Cari dalam ${activeTab.toUpperCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: CAPAIAN PEMBELAJARAN (CP) — TABEL
          ========================================================================= */}
      {activeTab === 'cp' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                Daftar Capaian Pembelajaran (CP) {currentSubjectName} · Fase {currentPhase} (Kelas {selectedClass})
              </h3>
              <p className="text-xs text-emerald-700">
                Elemen kompetensi dasar yang harus dicapai peserta didik pada akhir fase.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredCP.length} Elemen
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 w-10 text-center">No</th>
                  <th className="px-4 py-3 w-44">Elemen &amp; Fase</th>
                  <th className="px-4 py-3">Deskripsi Capaian Pembelajaran</th>
                  <th className="px-4 py-3 w-48">Sumber Acuan</th>
                  <th className="px-4 py-3 w-52">Berkas &amp; Drive</th>
                  <th className="px-4 py-3 text-right w-40">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCP.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada data Capaian Pembelajaran yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredCP.map((cp, idx) => (
                    <tr key={cp.id} className="hover:bg-slate-50/80 transition-colors align-top">
                      <td className="px-4 py-3 text-center font-mono text-slate-400 font-semibold">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-emerald-100 text-emerald-800">
                          {cp.element}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">Fase {cp.phase}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-800 leading-relaxed font-medium">
                        {cp.description}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500 italic">
                        {cp.source}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(cp.file_id || isRealDriveFileUrl(cp.google_drive_url)) && (
                            <button
                              type="button"
                              onClick={() =>
                                void handlePreviewFile(cp.file_id, cp.file_name || `CP ${cp.element}`, cp.google_drive_url, 'cp', cp.id)
                              }
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Preview Dokumen</span>
                            </button>
                          )}
                          {cp.file_id && (
                            <button
                              type="button"
                              onClick={() => void handleDownloadFile(cp.file_id)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              title="Unduh Berkas"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          )}
                          {isRealDriveFileUrl(cp.google_drive_url) ? (
                            <a
                              href={cp.google_drive_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold inline-flex items-center gap-1"
                            >
                              <FolderSync className="w-3 h-3" />
                              <span>Drive</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : !cp.file_id ? (
                            <span className="text-[11px] text-slate-400">-</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setActiveTab('tp');
                              notify(`Beralih ke Tujuan Pembelajaran untuk elemen ${cp.element}`);
                            }}
                            className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>TP</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setPendingDelete({ tab: 'cp', id: cp.id, label: `CP ${cp.element}` })}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
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
      )}

      {/* =========================================================================
          TAB 2: TUJUAN PEMBELAJARAN (TP) — TABEL
          ========================================================================= */}
      {activeTab === 'tp' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                Tujuan Pembelajaran (TP) Terpetakan Semester Ganjil & Genap
              </h3>
              <p className="text-xs text-emerald-700">
                TP ini terintegrasi langsung sebagai kolom penilaian di Buku Nilai Siswa (Formatif & Sumatif).
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredTP.length} TP
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Lingkup Materi / Bab</th>
                  <th className="px-4 py-3">Tujuan Pembelajaran (TP)</th>
                  <th className="px-4 py-3">Semester</th>
                  <th className="px-4 py-3">Alokasi JP</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTP.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada data Tujuan Pembelajaran.
                    </td>
                  </tr>
                ) : (
                  filteredTP.map((tp) => (
                    <tr key={tp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                          {tp.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{tp.scope_of_material}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-md font-medium">{tp.description}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tp.semester === 'Ganjil' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'}`}>
                          {tp.semester}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 font-bold">{tp.allocated_hours} JP</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(tp.file_id || isRealDriveFileUrl(tp.google_drive_url)) && (
                            <button
                              type="button"
                              onClick={() =>
                                void handlePreviewFile(tp.file_id, tp.file_name || tp.code, tp.google_drive_url, 'tp', tp.id)
                              }
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              title="Pratinjau Berkas"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Preview Dokumen</span>
                            </button>
                          )}
                          {tp.file_id && (
                            <button
                              type="button"
                              onClick={() => void handleDownloadFile(tp.file_id)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              title="Unduh Berkas"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          )}
                          {isRealDriveFileUrl(tp.google_drive_url) && (
                            <a
                              href={tp.google_drive_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1"
                              title="Buka di Google Drive"
                            >
                              <FolderSync className="w-3 h-3" />
                              <span>Drive</span>
                            </a>
                          )}
                          {onNavigate && (
                            <button
                              onClick={() => onNavigate('asesmen-nilai')}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px]"
                              title="Lihat di Buku Nilai"
                            >
                              Nilai
                            </button>
                          )}
                          <button
                            onClick={() => setPendingDelete({ tab: 'tp', id: tp.id, label: tp.code })}
                            className="p-1 rounded text-slate-400 hover:text-rose-600"
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
      )}

      {/* =========================================================================
          TAB 3: ALUR TUJUAN PEMBELAJARAN (ATP) — TABEL
          ========================================================================= */}
      {activeTab === 'atp' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                Alur Tujuan Pembelajaran (ATP) Sekuensial Semester {activeSemesterType}
              </h3>
              <p className="text-xs text-emerald-700">
                Urutan bab, TP terintegrasi, dan rencana evaluasi per unit materi.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredATP.length} Tahapan
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 w-24">Tahap</th>
                  <th className="px-4 py-3 w-48">Bab / Unit Materi</th>
                  <th className="px-4 py-3">Ringkasan Materi &amp; TP Terkait</th>
                  <th className="px-4 py-3 w-20 text-center">JP</th>
                  <th className="px-4 py-3 w-52">Berkas &amp; Drive</th>
                  <th className="px-4 py-3 text-right w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredATP.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada data Alur Pembelajaran.
                    </td>
                  </tr>
                ) : (
                  filteredATP.map((atp) => (
                    <tr key={atp.id} className="hover:bg-slate-50/80 transition-colors align-top">
                      <td className="px-4 py-3">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-700 text-white font-bold text-[10px]">
                          {atp.stage_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{atp.chapter_title}</td>
                      <td className="px-4 py-3 space-y-1.5">
                        <p className="text-slate-700 font-medium">{atp.material_summary}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          {atp.tp_codes.map((code) => (
                            <span key={code} className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">
                              {code}
                            </span>
                          ))}
                          {atp.assessment_plan && (
                            <span className="text-slate-500 italic">· Asesmen: {atp.assessment_plan}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {atp.allocated_hours} JP
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(atp.file_id || isRealDriveFileUrl(atp.google_drive_url)) && (
                            <button
                              type="button"
                              onClick={() =>
                                void handlePreviewFile(atp.file_id, atp.file_name || atp.chapter_title, atp.google_drive_url, 'atp', atp.id)
                              }
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Preview Dokumen</span>
                            </button>
                          )}
                          {atp.file_id && (
                            <button
                              type="button"
                              onClick={() => void handleDownloadFile(atp.file_id)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              title="Unduh Berkas"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          )}
                          {isRealDriveFileUrl(atp.google_drive_url) ? (
                            <a
                              href={atp.google_drive_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1"
                            >
                              <FolderSync className="w-3 h-3" />
                              <span>Drive</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : !atp.file_id ? (
                            <span className="text-[11px] text-slate-400">-</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setPendingDelete({ tab: 'atp', id: atp.id, label: atp.chapter_title })}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3B: PROGRAM TAHUNAN (PROTA) — TABEL
          ========================================================================= */}
      {activeTab === 'prota' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                Program Tahunan (Prota) {currentSubjectName} · Kelas {selectedClass}
              </h3>
              <p className="text-xs text-emerald-700">
                Distribusi alokasi waktu jam pelajaran selama satu tahun ajaran tersimpan ke Google Drive Madrasah.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredProta.length} Prota
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 w-10 text-center">No</th>
                  <th className="px-4 py-3">Judul Program Tahunan (Prota)</th>
                  <th className="px-4 py-3">Pembagian Semester &amp; Ringkasan</th>
                  <th className="px-4 py-3 w-24 text-center">Total JP</th>
                  <th className="px-4 py-3 w-56">Berkas &amp; Google Drive</th>
                  <th className="px-4 py-3 w-24 text-center">Status</th>
                  <th className="px-4 py-3 w-14 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProta.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Belum ada Program Tahunan (Prota). Klik &ldquo;Tambah PROTA Baru&rdquo; untuk mengunggah berkas Prota ke Google Drive Madrasah.
                    </td>
                  </tr>
                ) : (
                  filteredProta.map((prota, idx) => (
                    <tr key={prota.id} className="hover:bg-slate-50/80 transition-colors align-top">
                      <td className="px-4 py-3 text-center font-mono text-slate-400 font-semibold">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{prota.title}</div>
                        <div className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                          TA {prota.academic_year}
                        </div>
                      </td>
                      <td className="px-4 py-3 space-y-1">
                        <div className="font-medium text-slate-700">{prota.semester_allocation}</div>
                        {prota.material_summary && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">{prota.material_summary}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                        {prota.allocated_hours} JP
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(prota.file_id || isRealDriveFileUrl(prota.google_drive_url)) && (
                            <button
                              type="button"
                              onClick={() =>
                                void handlePreviewFile(prota.file_id, prota.file_name || prota.title, prota.google_drive_url, 'prota', prota.id)
                              }
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Preview Dokumen</span>
                            </button>
                          )}
                          {prota.file_id && (
                            <button
                              type="button"
                              onClick={() => void handleDownloadFile(prota.file_id)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              title="Unduh"
                            >
                              <Download className="w-3 h-3" />
                              <span>Unduh</span>
                            </button>
                          )}
                          {isRealDriveFileUrl(prota.google_drive_url) ? (
                            <a
                              href={prota.google_drive_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1"
                            >
                              <FolderSync className="w-3 h-3" />
                              <span>Drive</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : !prota.file_id ? (
                            <span className="text-[11px] text-slate-400">-</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            prota.status === 'Disetujui'
                              ? 'bg-emerald-100 text-emerald-800'
                              : prota.status === 'Diajukan'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {prota.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setPendingDelete({ tab: 'prota', id: prota.id, label: prota.title })}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3C: PROGRAM SEMESTER (PROMES) — TABEL
          ========================================================================= */}
      {activeTab === 'promes' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                Program Semester (Promes) {currentSubjectName} · Kelas {selectedClass}
              </h3>
              <p className="text-xs text-emerald-700">
                Penjadwalan mingguan dan pekan efektif semester Ganjil/Genap tersimpan ke Google Drive Madrasah.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredPromes.length} Promes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 w-10 text-center">No</th>
                  <th className="px-4 py-3">Judul Program Semester (Promes)</th>
                  <th className="px-4 py-3 w-24">Semester</th>
                  <th className="px-4 py-3">Distribusi &amp; Ringkasan Materi</th>
                  <th className="px-4 py-3 w-20 text-center">JP</th>
                  <th className="px-4 py-3 w-56">Berkas &amp; Google Drive</th>
                  <th className="px-4 py-3 w-24 text-center">Status</th>
                  <th className="px-4 py-3 w-14 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPromes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Belum ada Program Semester (Promes). Klik &ldquo;Tambah PROMES Baru&rdquo; untuk mengunggah berkas Promes ke Google Drive Madrasah.
                    </td>
                  </tr>
                ) : (
                  filteredPromes.map((promes, idx) => (
                    <tr key={promes.id} className="hover:bg-slate-50/80 transition-colors align-top">
                      <td className="px-4 py-3 text-center font-mono text-slate-400 font-semibold">{idx + 1}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{promes.title}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                          {promes.semester}
                        </span>
                      </td>
                      <td className="px-4 py-3 space-y-1">
                        <div className="font-medium text-slate-700">{promes.month_distribution}</div>
                        {promes.material_summary && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">{promes.material_summary}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                        {promes.allocated_hours} JP
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(promes.file_id || isRealDriveFileUrl(promes.google_drive_url)) && (
                            <button
                              type="button"
                              onClick={() =>
                                void handlePreviewFile(promes.file_id, promes.file_name || promes.title, promes.google_drive_url, 'promes', promes.id)
                              }
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Preview Dokumen</span>
                            </button>
                          )}
                          {promes.file_id && (
                            <button
                              type="button"
                              onClick={() => void handleDownloadFile(promes.file_id)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              title="Unduh"
                            >
                              <Download className="w-3 h-3" />
                              <span>Unduh</span>
                            </button>
                          )}
                          {isRealDriveFileUrl(promes.google_drive_url) ? (
                            <a
                              href={promes.google_drive_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1"
                            >
                              <FolderSync className="w-3 h-3" />
                              <span>Drive</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : !promes.file_id ? (
                            <span className="text-[11px] text-slate-400">-</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            promes.status === 'Disetujui'
                              ? 'bg-emerald-100 text-emerald-800'
                              : promes.status === 'Diajukan'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {promes.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setPendingDelete({ tab: 'promes', id: promes.id, label: promes.title })}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: MODUL AJAR (DEEP LEARNING & KURIKULUM BERBASIS CINTA) — TABEL
          ========================================================================= */}
      {activeTab === 'modul-ajar' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                Modul Ajar Deep Learning & Kurikulum Berbasis Cinta
              </h3>
              <p className="text-xs text-emerald-700">
                Penyusunan RPP/Modul Ajar Pembelajaran Mendalam (Mindful, Meaningful, Joyful) tersimpan di Google Drive madrasah.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredModul.length} Modul
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 w-10 text-center">No</th>
                  <th className="px-4 py-3 w-40">Bab / Materi</th>
                  <th className="px-4 py-3">Topik &amp; Pendekatan Inti</th>
                  <th className="px-4 py-3 w-28">Target TP</th>
                  <th className="px-4 py-3 w-56">Berkas &amp; Google Drive</th>
                  <th className="px-4 py-3 w-24 text-center">Status</th>
                  <th className="px-4 py-3 w-14 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredModul.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada data Modul Ajar.
                    </td>
                  </tr>
                ) : (
                  filteredModul.map((modul, idx) => (
                    <tr key={modul.id} className="hover:bg-slate-50/80 transition-colors align-top">
                      <td className="px-4 py-3 text-center font-mono text-slate-400 font-semibold">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          {modul.chapter_title}
                        </span>
                        {modul.allocated_meetings && (
                          <div className="text-[11px] text-slate-500 mt-1">{modul.allocated_meetings}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 space-y-1">
                        <div className="font-bold text-slate-900">{modul.topic}</div>
                        <div className="text-[11px] text-slate-600 line-clamp-2">
                          <strong className="text-emerald-900">Inti:</strong> {modul.learning_activities.core_deep_learning || modul.deep_learning_approach}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-600 text-[11px]">
                        {modul.target_tp_code || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(modul.file_id || isRealDriveFileUrl(modul.google_drive_url)) && (
                            <button
                              type="button"
                              onClick={() =>
                                void handlePreviewFile(modul.file_id, modul.file_name || modul.topic, modul.google_drive_url, 'modul-ajar', modul.id)
                              }
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Preview Dokumen</span>
                            </button>
                          )}
                          {modul.file_id && (
                            <button
                              type="button"
                              onClick={() => void handleDownloadFile(modul.file_id)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              title="Unduh"
                            >
                              <Download className="w-3 h-3" />
                              <span>Unduh</span>
                            </button>
                          )}
                          {isRealDriveFileUrl(modul.google_drive_url) ? (
                            <a
                              href={modul.google_drive_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1"
                            >
                              <FolderSync className="w-3 h-3" />
                              <span>Drive</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : !modul.file_id ? (
                            <span className="text-[11px] text-slate-400">-</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            modul.status === 'Disetujui'
                              ? 'bg-emerald-100 text-emerald-800'
                              : modul.status === 'Diajukan'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {modul.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setPendingDelete({ tab: 'modul-ajar', id: modul.id, label: modul.topic })}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: LKPD (LEMBAR KERJA PESERTA DIDIK) — TABEL
          ========================================================================= */}
      {activeTab === 'lkpd' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                Lembar Kerja Peserta Didik (LKPD) Interaktif & Kontekstual
              </h3>
              <p className="text-xs text-emerald-700">
                Lembar aktivitas individu dan kolaboratif menumbuhkan empati dan daya nalar siswa.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredLKPD.length} LKPD
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 w-10 text-center">No</th>
                  <th className="px-4 py-3">Judul LKPD &amp; Tipe Aktivitas</th>
                  <th className="px-4 py-3 w-32">Bab / Target TP</th>
                  <th className="px-4 py-3">Petunjuk &amp; Rubrik</th>
                  <th className="px-4 py-3 w-56">Berkas &amp; Google Drive</th>
                  <th className="px-4 py-3 w-24 text-center">Status</th>
                  <th className="px-4 py-3 w-14 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLKPD.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada data LKPD.
                    </td>
                  </tr>
                ) : (
                  filteredLKPD.map((lkpd, idx) => (
                    <tr key={lkpd.id} className="hover:bg-slate-50/80 transition-colors align-top">
                      <td className="px-4 py-3 text-center font-mono text-slate-400 font-semibold">{idx + 1}</td>
                      <td className="px-4 py-3 space-y-1">
                        <div className="font-bold text-slate-900">{lkpd.title}</div>
                        <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                          {lkpd.activity_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 space-y-0.5">
                        <div className="font-medium text-slate-700">{lkpd.chapter_topic || '-'}</div>
                        <div className="font-mono text-[11px] font-bold text-emerald-800">{lkpd.target_tp_code}</div>
                      </td>
                      <td className="px-4 py-3 space-y-1">
                        <p className="text-slate-600 line-clamp-2 whitespace-pre-line">{lkpd.instructions}</p>
                        {lkpd.rubric_summary && (
                          <p className="text-[11px] text-slate-500">
                            <strong>Rubrik:</strong> {lkpd.rubric_summary}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(lkpd.file_id || isRealDriveFileUrl(lkpd.google_drive_url)) && (
                            <button
                              type="button"
                              onClick={() =>
                                void handlePreviewFile(lkpd.file_id, lkpd.file_name || lkpd.title, lkpd.google_drive_url, 'lkpd', lkpd.id)
                              }
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Preview Dokumen</span>
                            </button>
                          )}
                          {lkpd.file_id && (
                            <button
                              type="button"
                              onClick={() => void handleDownloadFile(lkpd.file_id)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              title="Unduh"
                            >
                              <Download className="w-3 h-3" />
                              <span>Unduh</span>
                            </button>
                          )}
                          {isRealDriveFileUrl(lkpd.google_drive_url) ? (
                            <a
                              href={lkpd.google_drive_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1"
                            >
                              <FolderSync className="w-3 h-3" />
                              <span>Drive</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : !lkpd.file_id ? (
                            <span className="text-[11px] text-slate-400">-</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            lkpd.status === 'Disetujui'
                              ? 'bg-emerald-100 text-emerald-800'
                              : lkpd.status === 'Diajukan'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {lkpd.status || 'Draft'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setPendingDelete({ tab: 'lkpd', id: lkpd.id, label: lkpd.title })}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          DAFTAR BERKAS TERUNGGAH (ARSIP GOOGLE DRIVE PERANGKAT PEMBELAJARAN) — TABEL
          ========================================================================= */}
      {(() => {
        const currentClassObj = allClasses.find((c) => c.level === selectedClass);
        const storedById = new Map<string, StoredDocumentFile>(storedFilesList.map((f) => [f.id, f]));
        const linkedFileIds = new Set(uploadedDocs.map((d) => d.file_id).filter(Boolean) as string[]);

        // Gabungkan dokumen kurikulum + berkas fisik yang belum tertaut ke document_link saat filter "everything"
        const orphanStoredRows: DocumentLink[] = storedFilesList
          .filter((f) => !linkedFileIds.has(f.id))
          .map((f) => ({
            id: `stored-${f.id}`,
            teacher_id: user?.teacherId || user?.id || '',
            academic_year_id: activeYearId,
            semester_id: activeSemesterId,
            class_id: currentClassObj?.id || '',
            subject_id: selectedSubject || '',
            document_type: f.category || 'Dokumen Perangkat',
            title: f.name,
            google_drive_url: f.googleDriveUrl || '',
            file_id: f.id,
            status: 'Draft',
            submission_date: null,
            created_at: f.uploadedAt,
            updated_at: f.uploadedAt,
          }));

        const baseDocs =
          docScopeFilter === 'everything' ? [...uploadedDocs, ...orphanStoredRows] : uploadedDocs;

        const matchingUploadedDocs = baseDocs.filter((d) => {
          const isEverything = docScopeFilter === 'everything';
          const subjectMatch = isEverything || !selectedSubject || d.subject_id === selectedSubject;
          const docClassLevel =
            d.class?.level || allClasses.find((c) => c.id === d.class_id)?.level;
          const classMatch =
            isEverything || !docClassLevel || docClassLevel === selectedClass || d.class_id === currentClassObj?.id;
          const typeMatch =
            docScopeFilter !== 'tab' || d.document_type === DOC_META_BY_TAB[activeTab].docType;
          const q = searchTerm.trim().toLowerCase();
          const searchMatch =
            !q ||
            (d.title || '').toLowerCase().includes(q) ||
            (d.document_type || '').toLowerCase().includes(q);
          return subjectMatch && classMatch && typeMatch && searchMatch;
        });

        return (
          <div className="bg-white rounded-2xl border border-emerald-200/80 overflow-hidden shadow-xs">
            <div className="p-4 bg-emerald-50/60 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-700" />
                  <span>Daftar Berkas Terunggah (Daftar Perangkat &amp; Google Drive)</span>
                </h3>
                <p className="text-xs text-emerald-800/80 mt-0.5">
                  {docScopeFilter === 'everything'
                    ? 'Menampilkan seluruh berkas perangkat pembelajaran yang pernah diunggah.'
                    : `Seluruh berkas perangkat pembelajaran terunggah untuk ${currentSubjectName} · Kelas ${selectedClass}.`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-emerald-200 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDocScopeFilter('all')}
                    className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                      docScopeFilter === 'all'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 hover:bg-emerald-50'
                    }`}
                  >
                    Mapel &amp; Kelas Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocScopeFilter('tab')}
                    className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                      docScopeFilter === 'tab'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 hover:bg-emerald-50'
                    }`}
                  >
                    Khusus {DOC_META_BY_TAB[activeTab].shortLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocScopeFilter('everything')}
                    className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                      docScopeFilter === 'everything'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 hover:bg-emerald-50'
                    }`}
                  >
                    Semua Berkas
                  </button>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
                  {matchingUploadedDocs.length} Berkas
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 w-10 text-center">No</th>
                    <th className="px-4 py-3">Judul / Nama Berkas</th>
                    <th className="px-4 py-3 w-48">Jenis &amp; Sinkronisasi Drive</th>
                    <th className="px-4 py-3 w-36">Tanggal Unggah</th>
                    <th className="px-4 py-3 w-28 text-center">Status Telaah</th>
                    <th className="px-4 py-3 text-right w-64">Aksi Berkas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matchingUploadedDocs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-7 text-center text-slate-400">
                        Belum ada berkas yang diunggah untuk filter ini. Gunakan tombol &ldquo;Arsipkan ke Drive &amp; Kirim Kamad&rdquo; atau &ldquo;Tambah {DOC_META_BY_TAB[activeTab].shortLabel} Baru&rdquo;.
                      </td>
                    </tr>
                  ) : (
                    matchingUploadedDocs.map((doc, idx) => {
                      const storedMeta = doc.file_id ? storedById.get(doc.file_id) : undefined;
                      const effectiveDriveUrl =
                        (isRealDriveFileUrl(doc.google_drive_url) ? doc.google_drive_url : '') ||
                        (isRealDriveFileUrl(storedMeta?.googleDriveUrl) ? storedMeta?.googleDriveUrl : '') ||
                        '';
                      const isSyncedDrive = isRealDriveFileUrl(effectiveDriveUrl);
                      const isOrphanRow = doc.id.startsWith('stored-');

                      return (
                        <tr key={doc.id} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="px-4 py-3 text-center font-mono text-slate-400 font-semibold">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 truncate max-w-xs" title={doc.title}>
                                  {doc.title}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {doc.class?.name || allClasses.find((c) => c.id === doc.class_id)?.name || `Kelas ${selectedClass}`} ·{' '}
                                  {doc.subject?.name || allSubjects.find((s) => s.id === doc.subject_id)?.name || currentSubjectName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 space-y-1">
                            <div>
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 font-semibold text-[11px]">
                                {doc.document_type}
                              </span>
                            </div>
                            <div>
                              {isSyncedDrive ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Terkirim ke Google Drive</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Arsip Lokal (Belum di Drive)</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                            {doc.created_at
                              ? new Date(doc.created_at).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                doc.status === 'Disetujui'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : doc.status === 'Diajukan'
                                  ? 'bg-amber-100 text-amber-900'
                                  : doc.status === 'Perlu Revisi'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {doc.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                              {(doc.file_id || isSyncedDrive) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handlePreviewFile(
                                      doc.file_id || undefined,
                                      doc.title,
                                      effectiveDriveUrl || undefined,
                                      activeTab,
                                      undefined
                                    )
                                  }
                                  className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Preview Dokumen (Tampilan Layar Penuh)"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Preview Dokumen</span>
                                </button>
                              )}
                              {doc.file_id && (
                                <button
                                  type="button"
                                  onClick={() => void handleDownloadFile(doc.file_id || undefined)}
                                  className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                  title="Unduh Berkas"
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                              )}
                              {isSyncedDrive && (
                                <a
                                  href={effectiveDriveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] inline-flex items-center gap-1"
                                >
                                  <FolderSync className="w-3 h-3" />
                                  <span>Drive</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                              {!isOrphanRow &&
                                (activeRole === 'admin' || doc.status === 'Draft' || doc.status === 'Perlu Revisi') && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPendingDelete({
                                        tab: 'archive-doc',
                                        id: doc.id,
                                        label: doc.title,
                                        fileId: doc.file_id,
                                      })
                                    }
                                    className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                                    title="Hapus Berkas"
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
        );
      })()}

      {/* =========================================================================
          MODAL FORMULIR TAMBAH + UPLOAD GOOGLE DRIVE (SEMUA JENIS PERANGKAT)
          ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Tambah {DOC_META_BY_TAB[activeTab].shortLabel} Baru ({currentSubjectName} - Kelas {selectedClass})
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Google Drive Madrasah (Tanpa Login via Apps Script) */}
            {(() => {
              const driveCfg = fileStorageService.getConfig();
              const driveStatus = fileStorageService.getDriveStatusInfo(driveCfg);
              const isAppsScriptReady = driveStatus.isHealthy;
              const isAppsScriptError = driveStatus.isError;
              const classObjPreview = allClasses.find((c) => c.level === selectedClass);
              const folderPreview = fileStorageService.buildStructuredDrivePath({
                academicYearName: activeYearName,
                semesterType: activeSemesterType,
                className: classObjPreview?.name || `Kelas ${selectedClass}`,
                subjectName: currentSubjectName,
                category: DOC_META_BY_TAB[activeTab].docType,
                categoryFolder: DOC_META_BY_TAB[activeTab].folder,
              });
              const fullFolderPreview = `${driveCfg.driveFolderName || 'SIMPEL MI Al Ihsan Soborejo'} / ${folderPreview.displayPath}`;
              return (
                <div
                  className={`p-3 rounded-xl border text-[11px] flex items-start gap-2.5 ${
                    isAppsScriptError
                      ? 'bg-rose-50 border-rose-200 text-rose-950'
                      : isAppsScriptReady || isOAuthDriveConnected
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50 border-amber-200 text-amber-950'
                  }`}
                >
                  <HardDrive
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      isAppsScriptError
                        ? 'text-rose-700'
                        : isAppsScriptReady || isOAuthDriveConnected
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  />
                  <div>
                    <p className="font-bold">
                      {isAppsScriptError
                        ? 'Koneksi Google Apps Script Perlu Perbaikan'
                        : isAppsScriptReady
                        ? `Google Drive Aktif (Apps Script Tanpa Login · ${driveCfg.ownerEmail || 'alihsansoborejo@gmail.com'})`
                        : isOAuthDriveConnected
                        ? `Google Drive Terhubung (${googleUser?.email || 'Akun Google'})`
                        : 'Google Apps Script Drive Belum Diaktifkan Admin Madrasah'}
                    </p>
                    <p className="mt-0.5 opacity-90">
                      {isAppsScriptError
                        ? driveStatus.errorMessage ||
                          'Web App Google Apps Script gagal diakses. Berkas tetap tersimpan di daftar arsip aplikasi hingga Admin memperbaiki URL Apps Script.'
                        : isAppsScriptReady
                        ? `Berkas langsung dikirim ke Google Drive ${driveCfg.ownerEmail || 'alihsansoborejo@gmail.com'} dari perangkat mana pun tanpa perlu login.`
                        : `Berkas tetap tersimpan ke arsip aplikasi & dapat dikirim ke Kepala Madrasah. Admin dapat mengaktifkan Google Apps Script di menu Penyimpanan Google Drive agar langsung terkirim ke ${driveCfg.ownerEmail || 'alihsansoborejo@gmail.com'}.`}
                    </p>
                    <p className="mt-1 font-mono text-[10px] bg-white/75 px-2 py-1 rounded border border-emerald-200/80 text-emerald-900">
                      Folder tujuan: {fullFolderPreview}
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

            <form onSubmit={handleSubmitForm} className="space-y-3.5 text-xs">
              {/* Form CP */}
              {activeTab === 'cp' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Elemen CP</label>
                    <select
                      value={cpForm.element}
                      onChange={(e) => setCpForm({ ...cpForm, element: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    >
                      <option value="Menyimak">Menyimak</option>
                      <option value="Membaca dan Memirsa">Membaca dan Memirsa</option>
                      <option value="Berbicara dan Mempresentasikan">Berbicara dan Mempresentasikan</option>
                      <option value="Menulis">Menulis</option>
                      <option value="Pemahaman Materi">Pemahaman Materi</option>
                      <option value="Pemahaman IPAS">Pemahaman IPAS</option>
                      <option value="Keterampilan Proses">Keterampilan Proses</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Deskripsi Capaian Pembelajaran</label>
                    <textarea
                      rows={3}
                      required
                      value={cpForm.description}
                      onChange={(e) => setCpForm({ ...cpForm, description: e.target.value })}
                      placeholder="Tuliskan rumusan kompetensi CP..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sumber Acuan Regulasi</label>
                    <input
                      type="text"
                      value={cpForm.source}
                      onChange={(e) => setCpForm({ ...cpForm, source: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </>
              )}

              {/* Form TP */}
              {activeTab === 'tp' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Kode TP</label>
                      <input
                        type="text"
                        required
                        value={tpForm.code}
                        onChange={(e) => setTpForm({ ...tpForm, code: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Semester</label>
                      <select
                        value={tpForm.semester}
                        onChange={(e) => setTpForm({ ...tpForm, semester: e.target.value as 'Ganjil' | 'Genap' })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        <option value="Ganjil">Semester Ganjil</option>
                        <option value="Genap">Semester Genap</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Lingkup Materi / Bab</label>
                    <input
                      type="text"
                      required
                      value={tpForm.scope}
                      onChange={(e) => setTpForm({ ...tpForm, scope: e.target.value })}
                      placeholder="Contoh: Bab 1: Sudah Besar"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bunyi Tujuan Pembelajaran (TP)</label>
                    <textarea
                      rows={2}
                      required
                      value={tpForm.description}
                      onChange={(e) => setTpForm({ ...tpForm, description: e.target.value })}
                      placeholder="Contoh: Mengidentifikasi ide pokok teks dengan cermat..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Perkiraan Alokasi Waktu (JP)</label>
                    <input
                      type="number"
                      min={2}
                      max={36}
                      value={tpForm.jp}
                      onChange={(e) => setTpForm({ ...tpForm, jp: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </>
              )}

              {/* Form ATP */}
              {activeTab === 'atp' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Urutan Alur</label>
                      <input
                        type="number"
                        min={1}
                        value={atpForm.order}
                        onChange={(e) => setAtpForm({ ...atpForm, order: Number(e.target.value), stage: `Tahap ${e.target.value}` })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Alokasi Total JP</label>
                      <input
                        type="number"
                        value={atpForm.jp}
                        onChange={(e) => setAtpForm({ ...atpForm, jp: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bab / Unit Pembelajaran</label>
                    <input
                      type="text"
                      required
                      value={atpForm.chapter}
                      onChange={(e) => setAtpForm({ ...atpForm, chapter: e.target.value })}
                      placeholder="Contoh: Bab 1: Sudah Besar"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Daftar Kode TP (Pisahkan Koma)</label>
                    <input
                      type="text"
                      value={atpForm.tpCodes}
                      onChange={(e) => setAtpForm({ ...atpForm, tpCodes: e.target.value })}
                      placeholder="Contoh: TP 4.1, TP 4.2"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Ringkasan Materi Pokok</label>
                    <textarea
                      rows={2}
                      value={atpForm.summary}
                      onChange={(e) => setAtpForm({ ...atpForm, summary: e.target.value })}
                      placeholder="Fokus materi yang diajarkan..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </>
              )}

              {/* Form PROTA */}
              {activeTab === 'prota' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Judul Program Tahunan (Prota)</label>
                    <input
                      type="text"
                      required
                      value={protaForm.title}
                      onChange={(e) => setProtaForm({ ...protaForm, title: e.target.value })}
                      placeholder={`Prota ${currentSubjectName} Kelas ${selectedClass}`}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Pembagian Semester</label>
                      <input
                        type="text"
                        value={protaForm.semesterAllocation}
                        onChange={(e) => setProtaForm({ ...protaForm, semesterAllocation: e.target.value })}
                        placeholder="Ganjil 54 JP / Genap 54 JP"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Total Alokasi JP</label>
                      <input
                        type="number"
                        min={2}
                        value={protaForm.jp}
                        onChange={(e) => setProtaForm({ ...protaForm, jp: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Ringkasan Materi Tahunan</label>
                    <textarea
                      rows={2}
                      value={protaForm.summary}
                      onChange={(e) => setProtaForm({ ...protaForm, summary: e.target.value })}
                      placeholder="Rekap lingkup materi semester ganjil & genap..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </>
              )}

              {/* Form PROMES */}
              {activeTab === 'promes' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Judul Program Semester (Promes)</label>
                    <input
                      type="text"
                      required
                      value={promesForm.title}
                      onChange={(e) => setPromesForm({ ...promesForm, title: e.target.value })}
                      placeholder={`Promes ${currentSubjectName} Kelas ${selectedClass}`}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Semester</label>
                      <select
                        value={promesForm.semester}
                        onChange={(e) => setPromesForm({ ...promesForm, semester: e.target.value as 'Ganjil' | 'Genap' })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        <option value="Ganjil">Semester Ganjil</option>
                        <option value="Genap">Semester Genap</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Alokasi JP</label>
                      <input
                        type="number"
                        min={2}
                        value={promesForm.jp}
                        onChange={(e) => setPromesForm({ ...promesForm, jp: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Distribusi Bulan &amp; Minggu Efektif</label>
                    <input
                      type="text"
                      value={promesForm.monthDistribution}
                      onChange={(e) => setPromesForm({ ...promesForm, monthDistribution: e.target.value })}
                      placeholder="Juli - Desember (18 Minggu Efektif)"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Ringkasan Jadwal Materi</label>
                    <textarea
                      rows={2}
                      value={promesForm.summary}
                      onChange={(e) => setPromesForm({ ...promesForm, summary: e.target.value })}
                      placeholder="Rencana pekan pelaksanaan lingkup materi & asesmen..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </>
              )}

              {/* Form Modul Ajar */}
              {activeTab === 'modul-ajar' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bab / Lingkup Materi</label>
                    <input
                      type="text"
                      required
                      value={modulForm.chapter}
                      onChange={(e) => setModulForm({ ...modulForm, chapter: e.target.value })}
                      placeholder="Bab 1: Sudah Besar"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Topik Modul Ajar</label>
                    <input
                      type="text"
                      required
                      value={modulForm.topic}
                      onChange={(e) => setModulForm({ ...modulForm, topic: e.target.value })}
                      placeholder="Kalimat Transitif & Berkasih Sayang"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kegiatan Inti (Pembelajaran Mendalam / Cinta)</label>
                    <textarea
                      rows={2}
                      value={modulForm.core}
                      onChange={(e) => setModulForm({ ...modulForm, core: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </>
              )}

              {/* Form LKPD */}
              {activeTab === 'lkpd' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Judul LKPD</label>
                    <input
                      type="text"
                      required
                      value={lkpdForm.title}
                      onChange={(e) => setLkpdForm({ ...lkpdForm, title: e.target.value })}
                      placeholder="LKPD 01: Berburu Kalimat Transitif"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Bab / Topik</label>
                      <input
                        type="text"
                        value={lkpdForm.chapter}
                        onChange={(e) => setLkpdForm({ ...lkpdForm, chapter: e.target.value })}
                        placeholder="Bab 1"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Tipe Aktivitas</label>
                      <select
                        value={lkpdForm.activityType}
                        onChange={(e) => setLkpdForm({ ...lkpdForm, activityType: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        <option value="Kelompok Kolaboratif">Kelompok Kolaboratif</option>
                        <option value="Individu">Individu</option>
                        <option value="Penyelidikan / Eksperimen">Penyelidikan / Eksperimen</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Petunjuk Kerja Peserta Didik</label>
                    <textarea
                      rows={2}
                      value={lkpdForm.instructions}
                      onChange={(e) => setLkpdForm({ ...lkpdForm, instructions: e.target.value })}
                      placeholder="1. Bacalah wacana dengan seksama..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </>
              )}

              {/* Bagian Unggah Berkas Fisik ke Google Drive Madrasah (Berlaku untuk CP, TP, ATP, Prota, Promes, Modul Ajar, LKPD) */}
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
                  onChange={(e) => handleFileSelectedInModal(e.target.files?.[0] || null)}
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
                    Tautan Berkas Google Drive (Opsional / Otomatis terisi saat unggah berkas)
                  </label>
                  <input
                    type="url"
                    value={getCurrentManualDriveUrl()}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (activeTab === 'cp') setCpForm({ ...cpForm, driveUrl: val });
                      else if (activeTab === 'tp') setTpForm({ ...tpForm, driveUrl: val });
                      else if (activeTab === 'atp') setAtpForm({ ...atpForm, driveUrl: val });
                      else if (activeTab === 'prota') setProtaForm({ ...protaForm, driveUrl: val });
                      else if (activeTab === 'promes') setPromesForm({ ...promesForm, driveUrl: val });
                      else if (activeTab === 'modul-ajar') setModulForm({ ...modulForm, driveUrl: val });
                      else setLkpdForm({ ...lkpdForm, driveUrl: val });
                    }}
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
                    Langsung kirim ke <strong>Dashboard Kepala Madrasah (Diajukan)</strong> untuk ditelaah &amp; disetujui (jika melampirkan berkas atau tautan Drive).
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
                  disabled={isSubmittingForm}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {uploadFile && submitToPrincipal ? (
                    <Send className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isSubmittingForm
                      ? 'Mengunggah ke Drive...'
                      : uploadFile
                      ? 'Simpan & Unggah ke Drive'
                      : 'Simpan Perangkat'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus (Pengganti confirm browser) */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Hapus Perangkat Pembelajaran?</h3>
            <p className="text-xs text-slate-600">
              Data <strong>{pendingDelete.label}</strong> akan dihapus dari daftar perangkat pembelajaran.
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
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-700 hover:bg-rose-800"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Unggah & Arsipkan ke Google Drive Madrasah */}
      <DriveDocumentUploadModal
        isOpen={showDriveModal}
        onClose={() => setShowDriveModal(false)}
        defaultDocType={DOC_META_BY_TAB[activeTab].docType}
        defaultSubjectId={selectedSubject || undefined}
        defaultClassLevel={selectedClass}
        onSuccess={(doc, uploadedToDrive) => {
          notify(
            doc.status === 'Diajukan'
              ? `"${doc.title}" diarsipkan${uploadedToDrive ? ' ke Google Drive' : ''} & dikirim ke Dashboard Kepala Madrasah.`
              : `"${doc.title}" disimpan sebagai draf arsip.`
          );
          void loadData();
        }}
      />

      {/* Modal Pratinjau Berkas Setelah Upload & dari Kartu Perangkat */}
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
          if (updated.googleDriveUrl && previewModalState?.itemTab && previewModalState?.itemId) {
            const driveUrl = updated.googleDriveUrl;
            const t = previewModalState.itemTab;
            const id = previewModalState.itemId;
            if (t === 'cp') {
              const found = curriculumWorkspaceService.getCPList().find((x) => x.id === id);
              if (found) curriculumWorkspaceService.saveCP({ ...found, google_drive_url: driveUrl });
            } else if (t === 'tp') {
              const found = curriculumWorkspaceService.getTPList().find((x) => x.id === id);
              if (found) curriculumWorkspaceService.saveTP({ ...found, google_drive_url: driveUrl });
            } else if (t === 'atp') {
              const found = curriculumWorkspaceService.getATPList().find((x) => x.id === id);
              if (found) curriculumWorkspaceService.saveATP({ ...found, google_drive_url: driveUrl });
            } else if (t === 'prota') {
              const found = curriculumWorkspaceService.getProtaList().find((x) => x.id === id);
              if (found) curriculumWorkspaceService.saveProta({ ...found, google_drive_url: driveUrl });
            } else if (t === 'promes') {
              const found = curriculumWorkspaceService.getPromesList().find((x) => x.id === id);
              if (found) curriculumWorkspaceService.savePromes({ ...found, google_drive_url: driveUrl });
            } else if (t === 'modul-ajar') {
              const found = curriculumWorkspaceService.getModulList().find((x) => x.id === id);
              if (found) curriculumWorkspaceService.saveModul({ ...found, google_drive_url: driveUrl });
            } else if (t === 'lkpd') {
              const found = curriculumWorkspaceService.getLKPDList().find((x) => x.id === id);
              if (found) curriculumWorkspaceService.saveLKPD({ ...found, google_drive_url: driveUrl });
            }
            if (previewModalState.curriculumDocId) {
              void curriculumService
                .updateDocument(previewModalState.curriculumDocId, { google_drive_url: driveUrl })
                .catch(() => {});
            }
            void loadData();
          }
        }}
      />
    </div>
  );
};
