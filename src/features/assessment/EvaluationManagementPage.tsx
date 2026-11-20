import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { academicService } from '../../services/academicService';
import { assessmentService } from '../../services/assessmentService';
import { curriculumService } from '../../services/curriculumService';
import { curriculumWorkspaceService } from '../../services/curriculumWorkspaceService';
import {
  fileStorageService,
  StoredDocumentFile,
  isRealDriveFileUrl,
} from '../../services/fileStorageService';
import { printDocumentDirectly } from '../../services/printService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import {
  Subject,
  ClassRoom,
  TeachingAssignment,
  SystemSettings,
  Teacher,
  Assessment,
  DocumentLink,
} from '../../types/database.types';
import {
  KisiKisiItem,
  SoalAsesmenItem,
  EvaluationScopeKey,
  LingkupMateriConfig,
} from '../../types/curriculum.types';
import { GradesPage } from './GradesPage';
import { RemedialEnrichmentPage } from './RemedialEnrichmentPage';
import { LearningAnalysisPage } from './LearningAnalysisPage';
import { DriveDocumentUploadModal } from '../../components/curriculum/DriveDocumentUploadModal';
import { FilePreviewModal } from '../../components/curriculum/FilePreviewModal';
import {
  Award,
  Plus,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  TrendingUp,
  HelpCircle,
  Layers,
  Check,
  ArrowRight,
  ClipboardCheck,
  Edit2,
  HardDrive,
  FolderOpen,
  Eye,
  Download,
  ExternalLink,
  FolderSync,
} from 'lucide-react';

export type EvaluationTab =
  | 'kisi-kisi'
  | 'soal-asesmen'
  | 'asesmen-nilai'
  | 'remedial-pengayaan'
  | 'analisis-nilai';

interface EvaluationManagementPageProps {
  defaultTab?: EvaluationTab;
  initialScope?: EvaluationScopeKey;
  onNavigate?: (view: string) => void;
}

export const EvaluationManagementPage: React.FC<EvaluationManagementPageProps> = ({
  defaultTab = 'kisi-kisi',
  initialScope = '',
  onNavigate,
}) => {
  const { user, activeRole } = useAuth();
  const { selectedSubjectId, selectedClassLevel, setWorkspaceSelection } = useWorkspace();
  const [activeTab, setActiveTab] = useState<EvaluationTab>(defaultTab);

  // Master & Assignment States
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [allClasses, setAllClasses] = useState<ClassRoom[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeachingAssignment[]>([]);
  const [resolvedTeacher, setResolvedTeacher] = useState<Teacher | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [activeYearName, setActiveYearName] = useState<string>('2026/2027');
  const [activeSemesterType, setActiveSemesterType] = useState<'Ganjil' | 'Genap'>('Ganjil');
  const [kktpDefault, setKktpDefault] = useState<number>(75);
  const [isLoadingRefs, setIsLoadingRefs] = useState<boolean>(true);

  // Filter Mata Pelajaran & Kelas
  const [selectedSubject, setSelectedSubject] = useState<string>(selectedSubjectId || '');
  const [selectedClass, setSelectedClass] = useState<number>(selectedClassLevel || 4);

  // Filter Lingkup Materi (LM) & Asesmen Khusus (STS / SAS)
  const [selectedScope, setSelectedScope] = useState<EvaluationScopeKey>(initialScope || '');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Data States
  const [kisiList, setKisiList] = useState<KisiKisiItem[]>([]);
  const [soalList, setSoalList] = useState<SoalAsesmenItem[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [uploadedEvalDocs, setUploadedEvalDocs] = useState<DocumentLink[]>([]);
  const [storedFilesList, setStoredFilesList] = useState<StoredDocumentFile[]>([]);
  const [previewDocState, setPreviewDocState] = useState<{
    file: StoredDocumentFile;
    docId?: string;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'kisi' | 'soal'; id: string; label: string } | null>(null);
  const [pendingDeleteScope, setPendingDeleteScope] = useState<LingkupMateriConfig | null>(null);

  // Modal States
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showScopeModal, setShowScopeModal] = useState<boolean>(false);
  const [showDriveModal, setShowDriveModal] = useState<boolean>(false);
  const [editingScope, setEditingScope] = useState<LingkupMateriConfig | null>(null);
  const [scopeForm, setScopeForm] = useState({
    code: '',
    title: '',
    description: '',
    tpText: '',
    isSpecial: false,
  });
  const [notification, setNotification] = useState<string | null>(null);

  // Form States
  const [kisiForm, setKisiForm] = useState({
    type: 'Formatif Lingkup Materi' as 'Formatif Lingkup Materi' | 'Sumatif Lingkup Materi' | 'Sumatif Tengah Semester (STS)' | 'Sumatif Akhir Semester (SAS)',
    tpCode: 'TP 4.1',
    topic: '',
    indicator: '',
    cogLevel: 'L2 (Aplikasi)' as 'L1 (Pengetahuan/Pemahaman)' | 'L2 (Aplikasi)' | 'L3 (Penalaran/HOTS)',
    qType: 'Pilihan Ganda' as 'Pilihan Ganda' | 'Isian Singkat' | 'Uraian' | 'Unjuk Kerja / Praktik',
    qNum: '1, 2',
    weight: 20,
  });

  const [soalForm, setSoalForm] = useState({
    tpCode: 'TP 4.1',
    qNum: 1,
    qType: 'Pilihan Ganda' as 'Pilihan Ganda' | 'Isian Singkat' | 'Uraian' | 'Praktik',
    stimulus: '',
    questionText: '',
    optA: '',
    optB: '',
    optC: '',
    optD: '',
    correctAnswer: 'A',
    rubric: 'Jawaban benar bernilai 10 poin.',
    points: 10,
  });

  // Sinkronisasi saat props berubah
  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  useEffect(() => {
    if (initialScope) {
      setSelectedScope(initialScope);
    }
  }, [initialScope]);

  // Sinkronisasi dengan WorkspaceContext
  useEffect(() => {
    if (selectedSubjectId) {
      setSelectedSubject(selectedSubjectId);
    }
    if (selectedClassLevel) {
      setSelectedClass(selectedClassLevel);
    }
  }, [selectedSubjectId, selectedClassLevel]);

  const loadData = useCallback(async () => {
    setKisiList(curriculumWorkspaceService.getKisiList());
    setSoalList(curriculumWorkspaceService.getSoalList());

    try {
      const [sbjs, clss, asgs, sys, years, sems, teacher, asms, tchs, docs, files] = await Promise.all([
        academicService.getSubjects(),
        academicService.getClasses(),
        academicService.getTeachingAssignments(),
        academicService.getSettings(),
        academicService.getAcademicYears(),
        academicService.getSemesters(),
        academicService.resolveTeacherForUser(user),
        assessmentService.getAssessments(),
        academicService.getTeachers(),
        curriculumService.getDocuments(),
        fileStorageService.getAllFiles(),
      ]);

      setAllSubjects(sbjs);
      setAllClasses(clss);
      setSettings(sys);
      setResolvedTeacher(teacher);
      setAssessments(asms);
      setUploadedEvalDocs(
        docs.filter(
          (d) =>
            d.document_type === 'Kisi-Kisi Asesmen' ||
            d.document_type === 'Naskah Soal Asesmen'
        )
      );
      setStoredFilesList(files);
      if (sys?.kktp_default) setKktpDefault(Number(sys.kktp_default));

      const actYear = years.find((y) => y.id === sys.active_academic_year_id || y.is_active) || years[0];
      const actSem = sems.find((s) => s.id === sys.active_semester_id || s.is_active) || sems[0];
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
          const matchedCls = clss.find((c) => c.level === preferredLevel);
          const matchedAsg = relevantAsgs.find(
            (a) => a.subject_id === preferredSbj && (!matchedCls || a.class_id === matchedCls.id)
          );
          if (matchedAsg) {
            setWorkspaceSelection({
              subjectId: preferredSbj,
              classId: matchedAsg.class_id,
              classLevel: preferredLevel,
              assignmentId: matchedAsg.id,
            });
          }
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
      console.error('Gagal memuat data referensi evaluasi:', err);
    } finally {
      setIsLoadingRefs(false);
    }
  }, [activeRole, user?.id, user?.email, user?.teacherId, user?.profile?.full_name, selectedSubjectId, selectedClassLevel]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRealtimeSync(
    [
      'simpel_mi_kisi_items_v1',
      'simpel_mi_soal_items_v1',
      'simpel_mi_lingkup_materi_custom_v1',
      'simpel_mi_lingkup_materi_hidden_v1',
      'simpel_assessments',
      'simpel_grades',
      'simpel_assignments',
      'simpel_subjects',
      'simpel_classes',
      'simpel_teachers',
      'simpel_users_cache_v2',
      'simpel_curriculum_documents',
      'simpel_drive_files_v1',
    ],
    () => {
      void loadData();
    }
  );

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
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
      notify('Berkas fisik tidak ditemukan di perangkat ini. Silakan buka via tautan Google Drive.');
      return;
    }
    setPreviewDocState({ file: stored, docId: doc.id });
  };

  const handleDownloadStoredFile = async (doc: DocumentLink) => {
    if (!doc.file_id) return;
    const stored = await fileStorageService.getFileById(doc.file_id);
    if (!stored) {
      notify('Berkas fisik tidak ditemukan di perangkat ini. Silakan unduh melalui Google Drive.');
      return;
    }
    fileStorageService.downloadStoredFile(stored);
  };

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
  const currentClassObj =
    availableClasses.find((c) => c.level === selectedClass) ||
    allClasses.find((c) => c.level === selectedClass);
  const currentAssignmentObj = teacherAssignments.find(
    (a) =>
      a.subject_id === selectedSubject &&
      (!currentClassObj || a.class_id === currentClassObj.id)
  );
  const filteredAssessmentsCount = assessments.filter((a) => {
    if (currentAssignmentObj) return a.assignment_id === currentAssignmentObj.id;
    const asg = a.assignment || teacherAssignments.find((t) => t.id === a.assignment_id);
    if (!asg) return false;
    return (!selectedSubject || asg.subject_id === selectedSubject) && (!currentClassObj || asg.class_id === currentClassObj.id);
  }).length;

  // Daftar Lingkup Materi yang tersedia untuk mapel dan kelas aktif (kosong di awal sampai guru menambahkan)
  const availableScopes = curriculumWorkspaceService.getLingkupMateriList(
    selectedSubject,
    selectedClass,
    activeSemesterType
  );
  const presetTemplates = curriculumWorkspaceService.getPresetLingkupMateriTemplates(
    selectedSubject || 'sbj-ind',
    selectedClass,
    activeSemesterType
  );
  const currentScopeConfig =
    availableScopes.find((s) => s.scope_key === selectedScope) || availableScopes[0];
  const effectiveScope = currentScopeConfig?.scope_key || '';

  // Filter butir kisi-kisi per Mapel, Kelas, dan Lingkup Materi / STS / SAS
  const filteredKisi = effectiveScope
    ? kisiList.filter(
        (k) =>
          k.subject_id === selectedSubject &&
          k.class_level === selectedClass &&
          k.scope_key === effectiveScope &&
          (k.material_topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
            k.indicator.toLowerCase().includes(searchTerm.toLowerCase()) ||
            k.tp_code.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  // Filter butir soal per Mapel, Kelas, dan Lingkup Materi / STS / SAS
  const filteredSoal = effectiveScope
    ? soalList.filter(
        (s) =>
          s.subject_id === selectedSubject &&
          s.class_level === selectedClass &&
          s.scope_key === effectiveScope &&
          (s.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.stimulus.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.tp_code.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  // Ekspor CSV
  const handleExportCSV = () => {
    const scopeLabel = currentScopeConfig ? currentScopeConfig.code : selectedScope;
    if (activeTab === 'kisi-kisi') {
      const headers = ['No', 'Lingkup Materi / Asesmen', 'Jenis Asesmen', 'Kode TP', 'Topik Materi', 'Indikator Soal', 'Level Kognitif', 'Bentuk Soal', 'Nomor Soal', 'Bobot (%)'];
      const rows = filteredKisi.map((k, i) => [
        i + 1,
        `"${scopeLabel}"`,
        `"${k.assessment_type}"`,
        k.tp_code,
        `"${k.material_topic}"`,
        `"${k.indicator}"`,
        `"${k.cognitive_level}"`,
        `"${k.question_type}"`,
        `"${k.question_numbers}"`,
        k.scoring_weight,
      ]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kisi_kisi_${selectedSubject}_${selectedScope}_kelas${selectedClass}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      notify(`Berkas Kisi-kisi ${scopeLabel} berhasil diunduh.`);
    } else if (activeTab === 'soal-asesmen') {
      const headers = ['No', 'Lingkup Materi / Asesmen', 'Kode TP', 'Bentuk Soal', 'Stimulus Kontekstual', 'Pertanyaan Soal', 'Kunci Jawaban', 'Rubrik Penskoran', 'Poin'];
      const rows = filteredSoal.map((s) => [
        s.question_number,
        `"${scopeLabel}"`,
        s.tp_code,
        s.question_type,
        `"${s.stimulus}"`,
        `"${s.question_text}"`,
        `"${s.correct_answer}"`,
        `"${s.scoring_rubric}"`,
        s.score_points,
      ]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `naskah_soal_${selectedSubject}_${selectedScope}_kelas${selectedClass}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      notify(`Berkas Naskah Soal ${scopeLabel} berhasil diunduh.`);
    }
  };

  const handlePrint = () => {
    const scopeLabel = currentScopeConfig ? currentScopeConfig.label : selectedScope;
    let title = `PERANGKAT EVALUASI & ASESMEN (${scopeLabel})`;
    let contentHtml = '';

    if (activeTab === 'kisi-kisi') {
      title = `KISI-KISI ASESMEN PEMBELAJARAN (${scopeLabel})`;
      contentHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">No</th>
              <th style="width: 80px;">Bentuk</th>
              <th style="width: 80px;">Level Kognitif</th>
              <th>Materi Pokok & Indikator Soal</th>
              <th style="width: 60px;">No Soal</th>
            </tr>
          </thead>
          <tbody>
            ${filteredKisi.map((k, idx) => `
              <tr>
                <td class="center">${idx + 1}</td>
                <td class="center font-bold">${k.question_type}</td>
                <td class="center font-bold" style="color:#047857;">${k.cognitive_level}</td>
                <td><strong>Materi:</strong> ${k.material_topic}<br><strong>Indikator:</strong> ${k.indicator}</td>
                <td class="center font-bold font-mono">${k.question_numbers}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeTab === 'soal-asesmen') {
      title = `NASKAH SOAL ASESMEN SUMATIF (${scopeLabel})`;
      contentHtml = filteredSoal.map((s, idx) => `
        <div style="margin-bottom: 16px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; page-break-inside: avoid;">
          <p style="margin: 0 0 6px 0;"><strong>${s.question_number || idx + 1}.</strong> ${s.question_text}</p>
          ${s.options && s.options.length > 0 ? `
            <div style="margin-left: 18px; font-size: 10pt;">
              ${s.options.map((opt, oIdx) => `<div>${String.fromCharCode(65 + oIdx)}. ${opt}</div>`).join('')}
            </div>
          ` : ''}
          <div style="margin-top: 6px; font-size: 9pt; color: #475569;">
            <em>Kunci Jawaban: <strong>${s.correct_answer || '-'}</strong> | Bobot Skor: ${s.score_points || 1} poin</em>
          </div>
        </div>
      `).join('');
    } else {
      window.print();
      return;
    }

    printDocumentDirectly(contentHtml, {
      title,
      subtitle: `${currentSubjectName} - Kelas ${selectedClass} (${scopeLabel})`,
      metadata: [
        { label: 'Mata Pelajaran', value: currentSubjectName },
        { label: 'Tingkat Rombel', value: `Kelas ${selectedClass}` },
        { label: 'Lingkup Materi', value: scopeLabel },
        { label: 'Tahun Pelajaran', value: `${activeYearName} (Semester ${activeSemesterType})` },
      ],
      signature: {
        leftTitle: 'Guru Pengampu / Penyusun Soal,',
        leftName: user?.profile?.full_name || resolvedTeacher?.full_name || 'Guru Pengampu',
        leftNip: resolvedTeacher?.nip || '-',
        rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        rightTitle: 'Mengetahui,<br>Kepala Madrasah,',
        rightName: settings?.principal_name || 'Kepala Madrasah',
        rightNip: settings?.principal_nip || '-',
      },
    });
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) {
      notify('Pilih mata pelajaran terlebih dahulu.');
      return;
    }
    if (!effectiveScope) {
      notify('Tambahkan Lingkup Materi terlebih dahulu sebelum mengisi butir evaluasi.');
      return;
    }

    if (activeTab === 'kisi-kisi') {
      const item: KisiKisiItem = {
        id: `kisi-${Date.now()}`,
        subject_id: selectedSubject,
        subject_name: currentSubjectName,
        class_level: selectedClass,
        scope_key: effectiveScope,
        assessment_type: kisiForm.type,
        tp_code: kisiForm.tpCode,
        material_topic: kisiForm.topic,
        indicator: kisiForm.indicator,
        cognitive_level: kisiForm.cogLevel,
        question_type: kisiForm.qType,
        question_numbers: kisiForm.qNum,
        scoring_weight: Number(kisiForm.weight),
        created_at: new Date().toISOString(),
      };
      curriculumWorkspaceService.saveKisi(item);
      notify(`Kisi-kisi untuk ${currentScopeConfig?.code || effectiveScope} berhasil disimpan.`);
    } else if (activeTab === 'soal-asesmen') {
      const options =
        soalForm.qType === 'Pilihan Ganda'
          ? [soalForm.optA, soalForm.optB, soalForm.optC, soalForm.optD].filter(Boolean)
          : undefined;

      const item: SoalAsesmenItem = {
        id: `soal-${Date.now()}`,
        subject_id: selectedSubject,
        subject_name: currentSubjectName,
        class_level: selectedClass,
        scope_key: effectiveScope,
        tp_code: soalForm.tpCode,
        question_number: Number(soalForm.qNum),
        question_type: soalForm.qType,
        stimulus: soalForm.stimulus,
        question_text: soalForm.questionText,
        options,
        correct_answer: soalForm.correctAnswer,
        scoring_rubric: soalForm.rubric,
        score_points: Number(soalForm.points),
        created_at: new Date().toISOString(),
      };
      curriculumWorkspaceService.saveSoal(item);
      notify(`Soal untuk ${currentScopeConfig?.code || effectiveScope} berhasil ditambahkan.`);
    }

    setShowModal(false);
    void loadData();
  };

  const handleOpenAddScope = (presetToEdit?: LingkupMateriConfig) => {
    if (!selectedSubject) {
      notify('Pilih mata pelajaran terlebih dahulu.');
      return;
    }
    if (presetToEdit) {
      setEditingScope(presetToEdit);
      setScopeForm({
        code: presetToEdit.code,
        title: presetToEdit.title,
        description: presetToEdit.description,
        tpText: presetToEdit.associated_tps.join(', '),
        isSpecial: Boolean(presetToEdit.is_special_summative),
      });
    } else {
      setEditingScope(null);
      const nextNum = availableScopes.filter((s) => !s.is_special_summative).length + 1;
      setScopeForm({
        code: `LM ${nextNum}`,
        title: '',
        description: '',
        tpText: `TP ${selectedClass}.${nextNum}`,
        isSpecial: false,
      });
    }
    setShowScopeModal(true);
  };

  const handleSubmitScopeForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) {
      notify('Pilih mata pelajaran terlebih dahulu.');
      return;
    }
    if (!scopeForm.code.trim() || !scopeForm.title.trim()) {
      notify('Kode singkat dan judul Lingkup Materi wajib diisi.');
      return;
    }

    const parsedTps = scopeForm.tpText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const saved = curriculumWorkspaceService.saveLingkupMateri({
      id: editingScope?.id,
      scope_key: editingScope?.scope_key,
      code: scopeForm.code.trim(),
      label: scopeForm.isSpecial ? scopeForm.title.trim() : scopeForm.code.trim(),
      title: scopeForm.title.trim(),
      subject_id: selectedSubject,
      class_level: selectedClass,
      semester: activeSemesterType,
      associated_tps: parsedTps,
      description:
        scopeForm.description.trim() ||
        `Evaluasi formatif & sumatif untuk ${scopeForm.title.trim()}.`,
      is_special_summative: scopeForm.isSpecial,
      is_custom: true,
    });

    setSelectedScope(saved.scope_key);
    setShowScopeModal(false);
    setEditingScope(null);
    notify(
      editingScope
        ? `Lingkup Materi "${saved.code}" berhasil diperbarui.`
        : `Lingkup Materi baru "${saved.code}: ${saved.title}" berhasil ditambahkan.`
    );
    void loadData();
  };

  const handleLoadPresetScopes = (scopeKeys?: string[]) => {
    if (!selectedSubject) {
      notify('Pilih mata pelajaran terlebih dahulu.');
      return;
    }
    const loaded = curriculumWorkspaceService.activatePresetLingkupMateri(
      selectedSubject,
      selectedClass,
      activeSemesterType,
      scopeKeys
    );
    if (loaded.length > 0) {
      setSelectedScope(scopeKeys?.[0] || loaded[0].scope_key);
    }
    setShowScopeModal(false);
    notify(
      scopeKeys && scopeKeys.length === 1
        ? `Preset ${scopeKeys[0]} ditambahkan ke Perangkat Evaluasi.`
        : 'Preset Lingkup Materi standar (LM 1–4, STS, SAS) berhasil dimuat.'
    );
    void loadData();
  };

  const handleOpenAdd = () => {
    if (!currentScopeConfig) {
      handleOpenAddScope();
      return;
    }
    const firstTP = currentScopeConfig.associated_tps[0] || `TP ${selectedClass}.1`;
    const defaultAssessmentType =
      effectiveScope === 'STS'
        ? 'Sumatif Tengah Semester (STS)'
        : effectiveScope === 'SAS'
        ? 'Sumatif Akhir Semester (SAS)'
        : 'Formatif Lingkup Materi';

    if (activeTab === 'kisi-kisi') {
      setKisiForm({
        type: defaultAssessmentType,
        tpCode: firstTP,
        topic: currentScopeConfig.title || '',
        indicator: '',
        cogLevel: 'L2 (Aplikasi)',
        qType: 'Pilihan Ganda',
        qNum: `${filteredKisi.length + 1}`,
        weight: 20,
      });
    } else {
      setSoalForm({
        tpCode: firstTP,
        qNum: filteredSoal.length + 1,
        qType: 'Pilihan Ganda',
        stimulus: 'Cerita budi pekerti dan empati di lingkungan madrasah...',
        questionText: '',
        optA: 'A. ',
        optB: 'B. ',
        optC: 'C. ',
        optD: 'D. ',
        correctAnswer: 'A',
        rubric: 'Jawaban tepat dinilai 10 poin.',
        points: 10,
      });
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

      {/* =========================================================================
          HEADER PERANGKAT EVALUASI
          ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 uppercase tracking-wider">
              Asesmen &amp; Evaluasi Pembelajaran
            </span>
            <span className="text-xs text-slate-400">· MI Ma’arif Al Ihsan Soborejo</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Perangkat Evaluasi per Lingkup Materi &amp; STS/SAS
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola instrumen evaluasi per Lingkup Materi (LM 1 s.d. LM 4) serta modul khusus Sumatif Tengah Semester (STS) dan Sumatif Akhir Semester (SAS).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleOpenAddScope()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-300 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-700" />
            <span>Tambah Lingkup Materi</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDriveModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-900 bg-white hover:bg-emerald-50 transition-colors border border-emerald-200 cursor-pointer"
            title="Unggah naskah soal atau kisi-kisi ke Google Drive Madrasah & kirim ke Kepala Madrasah"
          >
            <HardDrive className="w-4 h-4 text-amber-600" />
            <span>Unggah Soal/Kisi ke Drive</span>
          </button>

          {(activeTab === 'kisi-kisi' || activeTab === 'soal-asesmen') && currentScopeConfig && (
            <>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Ekspor CSV</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Cetak Naskah</span>
              </button>

              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-950 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-500 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4 text-emerald-950" />
                <span>Tambah Butir di {currentScopeConfig.code}</span>
              </button>
            </>
          )}

          {onNavigate && (
            <button
              onClick={() => onNavigate(activeTab === 'analisis-nilai' || activeTab === 'remedial-pengayaan' ? 'asisten-ai-analisis' : 'asisten-ai-soal')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-300 bg-emerald-900 hover:bg-emerald-800 transition-colors shadow-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Bantu AI Asesmen</span>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          PENGATURAN MATA PELAJARAN & SUB-MENU PER LINGKUP MATERI (LM) / STS / SAS
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-xs">
        {/* Banner jika guru belum memiliki penugasan */}
        {!isLoadingRefs && activeRole === 'guru' && availableSubjects.length === 0 && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Belum ada penugasan mata pelajaran dan kelas untuk akun Anda. Hubungi Admin Madrasah untuk menetapkan jadwal mengajar di menu <strong>Penugasan Mengajar</strong>.
            </span>
          </div>
        )}

        {/* Baris 1: Pemilihan Mapel & Kelas */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Mata Pelajaran:</span>
              <select
                value={selectedSubject}
                onChange={(e) => {
                  const nextSbj = e.target.value;
                  setSelectedSubject(nextSbj);
                  setSelectedScope('');
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
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 disabled:bg-slate-100"
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
              <span className="font-semibold text-slate-600">Kelas:</span>
              <select
                value={selectedClass}
                onChange={(e) => {
                  const nextLvl = Number(e.target.value);
                  setSelectedClass(nextLvl);
                  setSelectedScope('');
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
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 disabled:bg-slate-100"
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

          <div className="text-[11px] text-slate-500">
            Semester: <strong className="text-emerald-800">{activeSemesterType} ({activeYearName})</strong> · KKTP: <strong className="text-amber-800">{kktpDefault}</strong>
          </div>
        </div>

        {/* Baris 2: SUB-MENU PER LINGKUP MATERI (LM) & KHUSUS STS / SAS */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Daftar Lingkup Materi / Unit Evaluasi ({availableScopes.length}):</span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {currentScopeConfig && (
                <span className="text-[11px] text-emerald-800 font-semibold">
                  Aktif: {currentScopeConfig.code} — {currentScopeConfig.title}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleOpenAddScope()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 text-amber-300" />
                <span>+ Lingkup Materi Baru</span>
              </button>
              {availableScopes.length === 0 && (
                <button
                  type="button"
                  onClick={() => handleLoadPresetScopes()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  <span>Muat Preset Standar (LM 1–4, STS, SAS)</span>
                </button>
              )}
            </div>
          </div>

          {availableScopes.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-800">
                  Belum ada Lingkup Materi untuk {currentSubjectName} Kelas {selectedClass}.
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tambahkan Lingkup Materi sesuai perencanaan mengajar Anda (bisa kode bebas atau muat preset standar).
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleOpenAddScope()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold cursor-pointer"
                >
                  + Tambah Lingkup Materi
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadPresetScopes()}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-50 text-amber-950 border border-amber-300 text-[11px] font-bold cursor-pointer"
                >
                  Muat Preset (LM 1–4, STS, SAS)
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {availableScopes.map((scope) => {
                const isSelected = effectiveScope === scope.scope_key;
                const isSpecial = scope.is_special_summative;
                const kisiCount = kisiList.filter(
                  (k) =>
                    k.subject_id === selectedSubject &&
                    k.class_level === selectedClass &&
                    k.scope_key === scope.scope_key
                ).length;
                const soalCount = soalList.filter(
                  (s) =>
                    s.subject_id === selectedSubject &&
                    s.class_level === selectedClass &&
                    s.scope_key === scope.scope_key
                ).length;

                return (
                  <div
                    key={scope.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedScope(scope.scope_key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedScope(scope.scope_key);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all relative cursor-pointer group ${
                      isSelected
                        ? isSpecial
                          ? 'bg-amber-500 text-slate-900 border-amber-600 shadow-sm font-bold ring-2 ring-amber-300'
                          : 'bg-emerald-700 text-white border-emerald-800 shadow-sm font-bold ring-2 ring-emerald-300'
                        : isSpecial
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950 hover:bg-amber-100/80'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          isSelected
                            ? 'bg-slate-900/20 text-white'
                            : isSpecial
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {scope.code}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAddScope(scope);
                          }}
                          className={`p-1 rounded transition-colors ${
                            isSelected
                              ? 'text-white/80 hover:bg-white/20 hover:text-white'
                              : 'text-slate-400 hover:text-emerald-700 hover:bg-white'
                          }`}
                          title="Edit Lingkup Materi"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteScope(scope);
                          }}
                          className={`p-1 rounded transition-colors ${
                            isSelected
                              ? 'text-white/80 hover:bg-white/20 hover:text-white'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-white'
                          }`}
                          title="Hapus Lingkup Materi"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-0.5" />}
                      </div>
                    </div>
                    <p className="text-[11px] font-bold mt-1.5 truncate leading-tight">
                      {scope.code === 'STS' || scope.code === 'SAS' ? scope.label : scope.title.split('(')[0]}
                    </p>
                    <p className={`text-[9px] mt-0.5 truncate ${isSelected ? 'text-white/85' : 'text-slate-500'}`}>
                      {kisiCount} Kisi · {soalCount} Soal
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ringkasan Informasi Lingkup Materi yang Aktif */}
        {currentScopeConfig && (
          <div
            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              currentScopeConfig.is_special_summative
                ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                : 'bg-emerald-50/70 border-emerald-100 text-emerald-950'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div
                className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  currentScopeConfig.is_special_summative ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                }`}
              >
                <Award className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-sm">{currentScopeConfig.title}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-current">
                    {currentScopeConfig.code}
                  </span>
                </div>
                <p className="text-xs opacity-90 mt-0.5">{currentScopeConfig.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <span className="text-[11px] font-semibold">TP Terkait:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {currentScopeConfig.associated_tps.length === 0 ? (
                  <span className="text-[11px] opacity-75 italic">Belum ada TP ditautkan</span>
                ) : (
                  currentScopeConfig.associated_tps.map((tp) => (
                    <span
                      key={tp}
                      className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200"
                    >
                      {tp}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Baris 3: Tab Jenis Perangkat Evaluasi */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('kisi-kisi')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'kisi-kisi'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>Kisi-kisi {currentScopeConfig ? `(${currentScopeConfig.code})` : ''}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'kisi-kisi' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredKisi.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('soal-asesmen')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'soal-asesmen'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4 text-sky-400" />
            <span>Naskah &amp; Bank Soal {currentScopeConfig ? `(${currentScopeConfig.code})` : ''}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'soal-asesmen' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredSoal.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('asesmen-nilai')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'asesmen-nilai'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Daftar Nilai Siswa</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'asesmen-nilai' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredAssessmentsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('remedial-pengayaan')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'remedial-pengayaan'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-rose-400" />
            <span>Remedial &amp; Pengayaan</span>
          </button>

          <button
            onClick={() => setActiveTab('analisis-nilai')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'analisis-nilai'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-amber-300" />
            <span>Analisis Ketuntasan</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: KISI-KISI ASESMEN KHUSUS SCOPE INI
          ========================================================================= */}
      {activeTab === 'kisi-kisi' && (
        availableScopes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div className="max-w-lg mx-auto space-y-1.5">
              <h3 className="text-sm font-bold text-slate-900">Perangkat Evaluasi Masih Kosong</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Anda belum menambahkan Lingkup Materi untuk <strong>{currentSubjectName} Kelas {selectedClass}</strong>. Tambahkan Lingkup Materi baru sesuai kebutuhan (atau muat template preset LM 1–4, STS, SAS). Untuk penilaian offline, Anda tetap dapat langsung mengisi Daftar Nilai Siswa.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleOpenAddScope()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4 text-amber-300" />
                <span>Tambah Lingkup Materi Baru</span>
              </button>
              <button
                type="button"
                onClick={() => handleLoadPresetScopes()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-bold cursor-pointer"
              >
                <span>Muat Preset (LM 1–4, STS, SAS)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('asesmen-nilai')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
              >
                <span>Langsung ke Daftar Nilai Siswa</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-700 text-white">
                  {currentScopeConfig?.code || effectiveScope}
                </span>
                <h3 className="font-bold text-sm text-emerald-950">
                  Matriks Kisi-kisi Asesmen: {currentScopeConfig?.title}
                </h3>
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                Distribusi indikator, tingkat kognitif L1/L2/L3 (HOTS), bentuk soal, dan bobot untuk unit evaluasi ini.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredKisi.length} Butir Indikator
            </span>
          </div>

          <div className="px-4 py-2.5 bg-amber-50/70 border-b border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Opsional untuk Asesmen Offline:</strong> Jika asesmen dilakukan secara luring tanpa menyusun kisi-kisi di sistem, Anda tetap dapat langsung mengisi nilai siswa.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('asesmen-nilai')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold transition-colors shrink-0 self-start sm:self-auto"
            >
              <span>Langsung ke Daftar Nilai Siswa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">TP</th>
                  <th className="px-4 py-3">Jenis Asesmen & Topik</th>
                  <th className="px-4 py-3">Indikator Soal</th>
                  <th className="px-4 py-3">Level Kognitif</th>
                  <th className="px-4 py-3">Bentuk & No Soal</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredKisi.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 space-y-2">
                      <p>
                        Belum ada butir kisi-kisi untuk {currentScopeConfig?.code || selectedScope}.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Klik &ldquo;Tambah Butir&rdquo; untuk menyusun kisi-kisi, atau langsung buka tab Daftar Nilai Siswa jika asesmen dilaksanakan secara offline.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredKisi.map((k) => (
                    <tr key={k.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-emerald-800">{k.tp_code}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{k.material_topic}</p>
                        <span className="text-[10px] text-slate-500 font-medium">{k.assessment_type}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-sm">{k.indicator}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            k.cognitive_level.includes('L3')
                              ? 'bg-rose-100 text-rose-800'
                              : k.cognitive_level.includes('L2')
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-blue-100 text-blue-900'
                          }`}
                        >
                          {k.cognitive_level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{k.question_type}</p>
                        <span className="text-[10px] text-slate-500">No. {k.question_numbers} (Bobot {k.scoring_weight}%)</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() =>
                            setPendingDelete({
                              kind: 'kisi',
                              id: k.id,
                              label: k.material_topic || k.tp_code,
                            })
                          }
                          className="p-1 rounded text-slate-400 hover:text-rose-600"
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

          {(() => {
            const evalDocsForTab = uploadedEvalDocs.filter((d) => {
              if (d.document_type !== 'Kisi-Kisi Asesmen') return false;
              if (activeRole === 'guru') {
                const tid = resolvedTeacher?.id || user?.teacherId || user?.id;
                if (tid && d.teacher_id !== tid && d.teacher?.id !== tid) return false;
              }
              if (selectedSubject && d.subject_id && d.subject_id !== selectedSubject) return false;
              if (currentClassObj?.id && d.class_id && d.class_id !== currentClassObj.id) return false;
              return true;
            });

            return (
              <div className="border-t border-emerald-200 bg-slate-50/70 p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FolderSync className="w-4 h-4 text-emerald-700" />
                    <span>Daftar Berkas Kisi-Kisi Terunggah ({evalDocsForTab.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowDriveModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-[11px] cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                    <span>Unggah Berkas Kisi-Kisi</span>
                  </button>
                </div>

                {evalDocsForTab.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">
                    Belum ada berkas Kisi-Kisi Asesmen yang diunggah untuk mata pelajaran &amp; kelas ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-200">
                    {evalDocsForTab.map((doc) => {
                      const stored = doc.file_id
                        ? storedFilesList.find((f) => f.id === doc.file_id)
                        : undefined;
                      const driveUrl =
                        (isRealDriveFileUrl(stored?.googleDriveUrl) && stored?.googleDriveUrl) ||
                        (isRealDriveFileUrl(doc.google_drive_url) && doc.google_drive_url) ||
                        '';
                      return (
                        <div
                          key={doc.id}
                          className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-xs font-bold text-slate-900 truncate">{doc.title}</p>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold border ${
                                  driveUrl
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {driveUrl ? 'Terkirim ke Google Drive' : 'Arsip Lokal (Belum di Drive)'}
                              </span>
                              <span>Status: <strong>{doc.status}</strong></span>
                              {stored?.size ? <span>({Math.max(1, Math.round(stored.size / 1024))} KB)</span> : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            {(doc.file_id || driveUrl) && (
                              <button
                                type="button"
                                onClick={() => void handlePreviewStoredFile(doc)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-[11px] cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview Dokumen</span>
                              </button>
                            )}
                            {doc.file_id && (
                              <button
                                type="button"
                                onClick={() => void handleDownloadStoredFile(doc)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer"
                              >
                                <Download className="w-3 h-3" />
                                <span>Unduh</span>
                              </button>
                            )}
                            {driveUrl && (
                              <a
                                href={driveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-[11px]"
                              >
                                <span>Buka Drive</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        )
      )}

      {/* =========================================================================
          TAB 2: NASKAH & BANK SOAL KHUSUS SCOPE INI
          ========================================================================= */}
      {activeTab === 'soal-asesmen' && (
        availableScopes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div className="max-w-lg mx-auto space-y-1.5">
              <h3 className="text-sm font-bold text-slate-900">Naskah &amp; Bank Soal Masih Kosong</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tambahkan Lingkup Materi terlebih dahulu sebelum membuat naskah soal, atau langsung unggah file naskah soal Anda ke Google Drive Madrasah / isi nilai siswa secara offline.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleOpenAddScope()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4 text-amber-300" />
                <span>Tambah Lingkup Materi Baru</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDriveModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold cursor-pointer"
              >
                <HardDrive className="w-4 h-4 text-emerald-700" />
                <span>Unggah Naskah Soal ke Drive</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('asesmen-nilai')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
              >
                <span>Langsung ke Daftar Nilai Siswa</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-700 text-white">
                  {currentScopeConfig?.code || effectiveScope}
                </span>
                <h3 className="font-bold text-sm text-emerald-950">
                  Naskah Soal Evaluasi: {currentScopeConfig?.title}
                </h3>
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                Butir soal asesmen autentik HOTS dan berbasis Kurikulum Berbasis Cinta siap cetak atau dibagikan ke siswa.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredSoal.length} Butir Soal
            </span>
          </div>

          <div className="px-4 py-2.5 bg-amber-50/70 border-b border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Asesmen Offline (Tanpa Naskah Soal Sistem):</strong> Anda tidak wajib menginput soal di sini untuk mengelola dan mengisi daftar nilai siswa.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('asesmen-nilai')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold transition-colors shrink-0 self-start sm:self-auto"
            >
              <span>Kelola Daftar Nilai Siswa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {filteredSoal.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-6 space-y-2">
                <p>
                  Belum ada butir soal untuk {currentScopeConfig?.code || selectedScope}.
                </p>
                <p className="text-[11px] text-slate-400">
                  Klik &ldquo;Tambah Butir&rdquo; untuk menyusun soal, atau langsung input nilai hasil tes offline di tab Daftar Nilai Siswa.
                </p>
              </div>
            ) : (
              filteredSoal.map((soal) => (
                <div key={soal.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-emerald-500 transition-all space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-bold text-[10px]">
                        Soal #{soal.question_number}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold text-[10px]">
                        {soal.tp_code}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">({soal.question_type})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {soal.score_points} Poin
                      </span>
                      <button
                        onClick={() =>
                          setPendingDelete({
                            kind: 'soal',
                            id: soal.id,
                            label: `Soal #${soal.question_number}`,
                          })
                        }
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {soal.stimulus && (
                    <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 text-xs text-slate-700 italic">
                      <strong>Stimulus:</strong> "{soal.stimulus}"
                    </div>
                  )}

                  <p className="text-xs font-semibold text-slate-900">{soal.question_text}</p>

                  {soal.options && soal.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2 text-xs">
                      {soal.options.map((opt, i) => (
                        <div
                          key={i}
                          className={`p-2 rounded-lg border text-xs font-medium ${
                            opt.startsWith(soal.correct_answer)
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-1.5 flex flex-wrap items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
                    <p>
                      <strong className="text-emerald-900">Kunci Jawaban:</strong> {soal.correct_answer}
                    </p>
                    <p className="italic">{soal.scoring_rubric}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {(() => {
            const soalDocsForTab = uploadedEvalDocs.filter((d) => {
              if (d.document_type !== 'Naskah Soal Asesmen') return false;
              if (activeRole === 'guru') {
                const tid = resolvedTeacher?.id || user?.teacherId || user?.id;
                if (tid && d.teacher_id !== tid && d.teacher?.id !== tid) return false;
              }
              if (selectedSubject && d.subject_id && d.subject_id !== selectedSubject) return false;
              if (currentClassObj?.id && d.class_id && d.class_id !== currentClassObj.id) return false;
              return true;
            });

            return (
              <div className="border-t border-emerald-200 bg-slate-50/70 p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <FolderSync className="w-4 h-4 text-emerald-700" />
                    <span>Daftar Berkas Naskah Soal Terunggah ({soalDocsForTab.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowDriveModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-[11px] cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                    <span>Unggah Naskah Soal</span>
                  </button>
                </div>

                {soalDocsForTab.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">
                    Belum ada berkas Naskah Soal Asesmen yang diunggah untuk mata pelajaran &amp; kelas ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-200">
                    {soalDocsForTab.map((doc) => {
                      const stored = doc.file_id
                        ? storedFilesList.find((f) => f.id === doc.file_id)
                        : undefined;
                      const driveUrl =
                        (isRealDriveFileUrl(stored?.googleDriveUrl) && stored?.googleDriveUrl) ||
                        (isRealDriveFileUrl(doc.google_drive_url) && doc.google_drive_url) ||
                        '';
                      return (
                        <div
                          key={doc.id}
                          className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-xs font-bold text-slate-900 truncate">{doc.title}</p>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold border ${
                                  driveUrl
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {driveUrl ? 'Terkirim ke Google Drive' : 'Arsip Lokal (Belum di Drive)'}
                              </span>
                              <span>Status: <strong>{doc.status}</strong></span>
                              {stored?.size ? <span>({Math.max(1, Math.round(stored.size / 1024))} KB)</span> : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            {(doc.file_id || driveUrl) && (
                              <button
                                type="button"
                                onClick={() => void handlePreviewStoredFile(doc)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-[11px] cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview Dokumen</span>
                              </button>
                            )}
                            {doc.file_id && (
                              <button
                                type="button"
                                onClick={() => void handleDownloadStoredFile(doc)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer"
                              >
                                <Download className="w-3 h-3" />
                                <span>Unduh</span>
                              </button>
                            )}
                            {driveUrl && (
                              <a
                                href={driveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-[11px]"
                              >
                                <span>Buka Drive</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        )
      )}

      {/* =========================================================================
          TAB 3: DAFTAR NILAI SISWA
          ========================================================================= */}
      {activeTab === 'asesmen-nilai' && (
        <div className="space-y-4">
          <GradesPage
            onNavigate={onNavigate}
            onScopeChange={(scopeKey) => setSelectedScope(scopeKey)}
            scopeContext={{
              subjectId: selectedSubject,
              subjectName: currentSubjectName,
              classLevel: selectedClass,
              classId: currentClassObj?.id || '',
              className: currentClassObj?.name || `Kelas ${selectedClass}`,
              assignmentId: currentAssignmentObj?.id || '',
              scopeKey: effectiveScope,
              scopeCode: currentScopeConfig?.code || effectiveScope,
              scopeTitle: currentScopeConfig?.title || effectiveScope,
            }}
          />
        </div>
      )}

      {/* =========================================================================
          TAB 4: REMEDIAL & PENGAYAAN
          ========================================================================= */}
      {activeTab === 'remedial-pengayaan' && (
        <div className="space-y-4">
          <RemedialEnrichmentPage
            scopeContext={{
              subjectId: selectedSubject,
              subjectName: currentSubjectName,
              classLevel: selectedClass,
              classId: currentClassObj?.id || '',
              className: currentClassObj?.name || `Kelas ${selectedClass}`,
              assignmentId: currentAssignmentObj?.id || '',
              scopeKey: effectiveScope,
              scopeCode: currentScopeConfig?.code || effectiveScope,
              scopeTitle: currentScopeConfig?.title || effectiveScope,
            }}
          />
        </div>
      )}

      {/* =========================================================================
          TAB 5: ANALISIS HASIL BELAJAR
          ========================================================================= */}
      {activeTab === 'analisis-nilai' && (
        <div className="space-y-4">
          <LearningAnalysisPage />
        </div>
      )}

      {/* =========================================================================
          MODAL FORMULIR TAMBAH BUTIR KISI-KISI / SOAL
          ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Tambah {activeTab === 'kisi-kisi' ? 'Kisi-kisi Asesmen' : 'Soal Asesmen'}
                </h3>
                <p className="text-[11px] text-emerald-800 font-semibold">
                  Unit: {currentScopeConfig?.title} ({currentScopeConfig?.code})
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3 text-xs">
              {activeTab === 'kisi-kisi' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Jenis Asesmen</label>
                      <select
                        value={kisiForm.type}
                        onChange={(e) => setKisiForm({ ...kisiForm, type: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        <option value="Formatif Lingkup Materi">Formatif Lingkup Materi</option>
                        <option value="Sumatif Lingkup Materi">Sumatif Lingkup Materi</option>
                        <option value="Sumatif Tengah Semester (STS)">Sumatif Tengah Semester (STS)</option>
                        <option value="Sumatif Akhir Semester (SAS)">Sumatif Akhir Semester (SAS)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Target Kode TP</label>
                      <input
                        type="text"
                        value={kisiForm.tpCode}
                        onChange={(e) => setKisiForm({ ...kisiForm, tpCode: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Lingkup Materi / Topik</label>
                    <input
                      type="text"
                      required
                      value={kisiForm.topic}
                      onChange={(e) => setKisiForm({ ...kisiForm, topic: e.target.value })}
                      placeholder="Contoh: Kalimat Transitif dan Intransitif"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Indikator Soal</label>
                    <textarea
                      rows={2}
                      required
                      value={kisiForm.indicator}
                      onChange={(e) => setKisiForm({ ...kisiForm, indicator: e.target.value })}
                      placeholder="Disajikan kalimat, siswa dapat..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Level Kognitif</label>
                      <select
                        value={kisiForm.cogLevel}
                        onChange={(e) => setKisiForm({ ...kisiForm, cogLevel: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        <option value="L1 (Pengetahuan/Pemahaman)">L1 (Pengetahuan/Pemahaman)</option>
                        <option value="L2 (Aplikasi)">L2 (Aplikasi)</option>
                        <option value="L3 (Penalaran/HOTS)">L3 (Penalaran/HOTS)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Bentuk Soal</label>
                      <select
                        value={kisiForm.qType}
                        onChange={(e) => setKisiForm({ ...kisiForm, qType: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        <option value="Pilihan Ganda">Pilihan Ganda</option>
                        <option value="Isian Singkat">Isian Singkat</option>
                        <option value="Uraian">Uraian</option>
                        <option value="Unjuk Kerja / Praktik">Unjuk Kerja / Praktik</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Nomor Soal</label>
                      <input
                        type="number"
                        min={1}
                        value={soalForm.qNum}
                        onChange={(e) => setSoalForm({ ...soalForm, qNum: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Target TP</label>
                      <input
                        type="text"
                        value={soalForm.tpCode}
                        onChange={(e) => setSoalForm({ ...soalForm, tpCode: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Stimulus Kontekstual (Kisah Kasih Sayang / Kasus)</label>
                    <textarea
                      rows={2}
                      value={soalForm.stimulus}
                      onChange={(e) => setSoalForm({ ...soalForm, stimulus: e.target.value })}
                      placeholder="Teks pengantar atau kutipan cerita madrasah..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Pertanyaan Soal</label>
                    <textarea
                      rows={2}
                      required
                      value={soalForm.questionText}
                      onChange={(e) => setSoalForm({ ...soalForm, questionText: e.target.value })}
                      placeholder="Tuliskan pertanyaan soal..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
                    />
                  </div>

                  {soalForm.qType === 'Pilihan Ganda' && (
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-slate-700">Pilihan Jawaban</label>
                      <input
                        type="text"
                        value={soalForm.optA}
                        onChange={(e) => setSoalForm({ ...soalForm, optA: e.target.value })}
                        placeholder="A. Pilihan pertama"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                      />
                      <input
                        type="text"
                        value={soalForm.optB}
                        onChange={(e) => setSoalForm({ ...soalForm, optB: e.target.value })}
                        placeholder="B. Pilihan kedua"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                      />
                      <input
                        type="text"
                        value={soalForm.optC}
                        onChange={(e) => setSoalForm({ ...soalForm, optC: e.target.value })}
                        placeholder="C. Pilihan ketiga"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                      />
                      <input
                        type="text"
                        value={soalForm.optD}
                        onChange={(e) => setSoalForm({ ...soalForm, optD: e.target.value })}
                        placeholder="D. Pilihan keempat"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Kunci Jawaban</label>
                      <input
                        type="text"
                        required
                        value={soalForm.correctAnswer}
                        onChange={(e) => setSoalForm({ ...soalForm, correctAnswer: e.target.value })}
                        placeholder="Contoh: A atau Uraian lengkap"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Bobot Nilai (Poin)</label>
                      <input
                        type="number"
                        min={1}
                        value={soalForm.points}
                        onChange={(e) => setSoalForm({ ...soalForm, points: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs"
                >
                  Simpan ke {currentScopeConfig?.code || effectiveScope}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Lingkup Materi */}
      {showScopeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {editingScope ? 'Edit Lingkup Materi' : 'Tambah Lingkup Materi Baru'}
                </h3>
                <p className="text-[11px] text-emerald-800 font-semibold">
                  {currentSubjectName} · Kelas {selectedClass}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowScopeModal(false);
                  setEditingScope(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!editingScope && presetTemplates.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-amber-950">
                    Preset Cepat (Opsional):
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLoadPresetScopes()}
                    className="text-[10px] font-bold px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-500 text-slate-950 cursor-pointer"
                  >
                    Muat Semua Preset (LM 1–4, STS, SAS)
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {presetTemplates.map((tpl) => {
                    const alreadyAdded = availableScopes.some((s) => s.scope_key === tpl.scope_key);
                    return (
                      <button
                        key={tpl.scope_key}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => handleLoadPresetScopes([tpl.scope_key])}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                          alreadyAdded
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-white hover:bg-emerald-50 text-emerald-900 border-amber-300 cursor-pointer'
                        }`}
                      >
                        {alreadyAdded ? `✓ ${tpl.code}` : `+ ${tpl.code}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitScopeForm} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Singkat *</label>
                  <input
                    type="text"
                    required
                    placeholder="LM 5 / UH 1"
                    value={scopeForm.code}
                    onChange={(e) => setScopeForm({ ...scopeForm, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Judul / Nama Lingkup Materi *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Bab 5: Ekosistem & Rantai Makanan"
                    value={scopeForm.title}
                    onChange={(e) => setScopeForm({ ...scopeForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kode TP Terkait (pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  placeholder={`Contoh: TP ${selectedClass}.1, TP ${selectedClass}.2`}
                  value={scopeForm.tpText}
                  onChange={(e) => setScopeForm({ ...scopeForm, tpText: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi Materi / Cakupan</label>
                <textarea
                  rows={2}
                  placeholder="Ringkasan topik dan indikator pencapaian lingkup materi ini..."
                  value={scopeForm.description}
                  onChange={(e) => setScopeForm({ ...scopeForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scopeForm.isSpecial}
                  onChange={(e) => setScopeForm({ ...scopeForm, isSpecial: e.target.checked })}
                  className="w-4 h-4 text-emerald-700 rounded border-slate-300"
                />
                <span className="text-xs font-medium text-slate-700">
                  Tandai sebagai Asesmen Khusus Semester (STS / SAS / Ujian Madrasah)
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowScopeModal(false);
                    setEditingScope(null);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs"
                >
                  {editingScope ? 'Simpan Perubahan' : 'Tambahkan Lingkup Materi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Kisi-kisi / Soal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Hapus {pendingDelete.kind === 'kisi' ? 'Butir Kisi-kisi' : 'Butir Soal'}?
            </h3>
            <p className="text-xs text-slate-600">
              Butir <strong>{pendingDelete.label}</strong> akan dihapus dari unit {currentScopeConfig?.code || effectiveScope}.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingDelete.kind === 'kisi') {
                    curriculumWorkspaceService.deleteKisi(pendingDelete.id);
                    notify('Kisi-kisi dihapus.');
                  } else {
                    curriculumWorkspaceService.deleteSoal(pendingDelete.id);
                    notify('Soal dihapus.');
                  }
                  setPendingDelete(null);
                  void loadData();
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Lingkup Materi */}
      {pendingDeleteScope && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Hapus Lingkup Materi?</h3>
            <p className="text-xs text-slate-600">
              Lingkup Materi <strong>{pendingDeleteScope.code}: {pendingDeleteScope.title}</strong> akan dihapus dari daftar unit evaluasi mapel ini.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPendingDeleteScope(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  curriculumWorkspaceService.deleteLingkupMateri(
                    selectedSubject,
                    selectedClass,
                    pendingDeleteScope.scope_key
                  );
                  if (selectedScope === pendingDeleteScope.scope_key) {
                    setSelectedScope('');
                  }
                  setPendingDeleteScope(null);
                  notify(`Lingkup Materi ${pendingDeleteScope.code} berhasil dihapus.`);
                  void loadData();
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Unggah Soal / Kisi-kisi ke Google Drive Madrasah */}
      <DriveDocumentUploadModal
        isOpen={showDriveModal}
        onClose={() => setShowDriveModal(false)}
        defaultDocType={activeTab === 'kisi-kisi' ? 'Kisi-Kisi Asesmen' : 'Naskah Soal Asesmen'}
        defaultSubjectId={selectedSubject || undefined}
        defaultClassId={currentClassObj?.id || undefined}
        defaultClassLevel={selectedClass}
        defaultTitle={
          currentScopeConfig
            ? `${activeTab === 'kisi-kisi' ? 'Kisi-Kisi' : 'Naskah Soal'} ${currentScopeConfig.code} - ${currentSubjectName} Kelas ${selectedClass}`
            : ''
        }
        onSuccess={(doc, uploadedToDrive) => {
          notify(
            doc.status === 'Diajukan'
              ? `"${doc.title}" diarsipkan${uploadedToDrive ? ' ke Google Drive' : ''} & dikirim ke Dashboard Kepala Madrasah.`
              : `"${doc.title}" disimpan sebagai draf arsip.`
          );
          void loadData();
        }}
      />

      <FilePreviewModal
        isOpen={Boolean(previewDocState)}
        file={previewDocState?.file || null}
        title={previewDocState ? `Preview Dokumen: ${previewDocState.file.name}` : undefined}
        driveUploadError={previewDocState?.file?.driveUploadError}
        onClose={() => setPreviewDocState(null)}
        onFileUpdated={(updated) => {
          setPreviewDocState((prev) => (prev ? { ...prev, file: updated } : null));
          if (updated.googleDriveUrl && previewDocState?.docId) {
            void curriculumService
              .updateDocument(previewDocState.docId, {
                google_drive_url: updated.googleDriveUrl,
              })
              .then(() => {
                void loadData();
              })
              .catch(() => {});
          }
        }}
      />
    </div>
  );
};
