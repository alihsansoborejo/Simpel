import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { assessmentService } from '../../services/assessmentService';
import { academicService } from '../../services/academicService';
import { reportService } from '../../services/reportService';
import { curriculumWorkspaceService } from '../../services/curriculumWorkspaceService';
import {
  Assessment,
  Grade,
  Student,
  AssessmentType,
  TeachingAssignment,
  ClassMember,
  Teacher,
  SystemSettings,
} from '../../types/database.types';
import { EvaluationScopeKey } from '../../types/curriculum.types';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { printDocumentDirectly } from '../../services/printService';
import { useRealtimeSync, notifyDomFormSaved } from '../../hooks/useRealtimeSync';
import {
  Award,
  Plus,
  Save,
  CheckCircle,
  AlertCircle,
  Printer,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Download,
  ClipboardCheck,
  Send,
  Filter,
} from 'lucide-react';

export interface GradeScopeContext {
  subjectId?: string;
  subjectName?: string;
  classLevel?: number;
  classId?: string;
  className?: string;
  assignmentId?: string;
  scopeKey?: EvaluationScopeKey;
  scopeCode?: string;
  scopeTitle?: string;
}

interface GradesPageProps {
  onNavigate?: (view: string) => void;
  onScopeChange?: (scopeKey: EvaluationScopeKey) => void;
  scopeContext?: GradeScopeContext;
}

const LEDGER_SLOT_LABELS: Record<'lm1' | 'lm2' | 'lm3' | 'lm4' | 'stsScore' | 'sasScore', string> = {
  lm1: 'LM 1',
  lm2: 'LM 2',
  lm3: 'LM 3',
  lm4: 'LM 4',
  stsScore: 'STS',
  sasScore: 'SAS',
};

export const GradesPage: React.FC<GradesPageProps> = ({ onNavigate, onScopeChange, scopeContext }) => {
  const { user, activeRole } = useAuth();
  const { selectedAssignmentId, selectedSubjectId, selectedClassId, setWorkspaceSelection } =
    useWorkspace();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  const [resolvedTeacher, setResolvedTeacher] = useState<Teacher | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('');
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Filter daftar asesmen & Tab Sumatif Lingkup Materi
  const [onlyActiveContext, setOnlyActiveContext] = useState<boolean>(Boolean(scopeContext?.subjectId));
  const [activeScopeTab, setActiveScopeTab] = useState<string>(scopeContext?.scopeKey || 'all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Form State: Modal Tambah / Edit Asesmen
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formType, setFormType] = useState<AssessmentType>('Formatif');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formKktp, setFormKktp] = useState<number>(75);
  const [formAssignmentId, setFormAssignmentId] = useState<string>('');
  const [formScopeKey, setFormScopeKey] = useState<string>('');
  const [scopeVersion, setScopeVersion] = useState<number>(0);

  // Konfirmasi hapus asesmen (tanpa window.confirm)
  const [confirmDeleteAsm, setConfirmDeleteAsm] = useState<Assessment | null>(null);

  // Sync ke Leger Modal / Pilihan slot
  const [showLedgerSyncModal, setShowLedgerSyncModal] = useState<boolean>(false);
  const [ledgerTargetSlot, setLedgerTargetSlot] = useState<'lm1' | 'lm2' | 'lm3' | 'lm4' | 'stsScore' | 'sasScore'>('lm1');

  // Quick fill uniform score
  const [uniformScore, setUniformScore] = useState<string>('');

  // Input Map: studentId -> { score: number, feedback: string }
  const [scoreInputs, setScoreInputs] = useState<Record<string, { score: number; feedback: string }>>({});

  const dirtyStudentIdsRef = useRef<Set<string>>(new Set());
  const selectedAssessmentIdRef = useRef<string>(selectedAssessmentId);
  selectedAssessmentIdRef.current = selectedAssessmentId;
  const showFormModalRef = useRef<boolean>(showFormModal);
  showFormModalRef.current = showFormModal;

  const effectiveSubjectId = scopeContext?.subjectId || selectedSubjectId || '';
  const effectiveClassId = scopeContext?.classId || selectedClassId || '';
  const effectiveAssignmentId = scopeContext?.assignmentId || selectedAssignmentId || '';

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4500);
  };

  useEffect(() => {
    if (scopeContext?.subjectId) {
      setOnlyActiveContext(true);
    }
  }, [scopeContext?.subjectId, scopeContext?.classId]);

  useEffect(() => {
    if (scopeContext?.scopeKey) {
      setActiveScopeTab(scopeContext.scopeKey);
    }
  }, [scopeContext?.scopeKey]);

  const getStudentsForAssessment = useCallback(
    (
      asm: Assessment | undefined,
      asgsPool: TeachingAssignment[],
      stdsPool: Student[],
      membersPool: ClassMember[]
    ): Student[] => {
      if (!asm) return [];
      const linkedAsg = asm.assignment || asgsPool.find((a) => a.id === asm.assignment_id);
      const classId = linkedAsg?.class_id;
      if (!classId) return stdsPool;
      const classMemberList = membersPool.filter((m) => m.class_id === classId);
      const orderMap = new Map<string, number>();
      classMemberList.forEach((m, i) => orderMap.set(m.student_id, m.student_number || i + 1));
      const enrolledIds = new Set(classMemberList.map((m) => m.student_id));
      return stdsPool
        .filter((s) => enrolledIds.has(s.id))
        .sort((a, b) => {
          const na = orderMap.get(a.id) ?? 9999;
          const nb = orderMap.get(b.id) ?? 9999;
          if (na !== nb) return na - nb;
          return a.full_name.localeCompare(b.full_name, 'id');
        });
    },
    []
  );

  const buildScoreInputsForAssessment = useCallback(
    (
      asm: Assessment | undefined,
      grds: Grade[],
      asgsPool: TeachingAssignment[],
      stdsPool: Student[],
      membersPool: ClassMember[],
      fallbackKktp: number
    ) => {
      const displayed = getStudentsForAssessment(asm, asgsPool, stdsPool, membersPool);
      const defaultScore = Number(asm?.kktp || fallbackKktp || 75);
      const map: Record<string, { score: number; feedback: string }> = {};
      displayed.forEach((s) => {
        const found = grds.find((g) => g.student_id === s.id);
        map[s.id] = {
          score: found ? Number(found.score) : defaultScore,
          feedback: found?.feedback || '',
        };
      });
      return map;
    },
    [getStudentsForAssessment]
  );

  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    try {
      const [asms, asgs, stds, members, teacher, sys, tchs] = await Promise.all([
        assessmentService.getAssessments(),
        academicService.getTeachingAssignments(),
        academicService.getStudents(),
        academicService.getClassMembers(),
        academicService.resolveTeacherForUser(user),
        academicService.getSettings(),
        academicService.getTeachers(),
      ]);

      setResolvedTeacher(teacher);
      setSettings(sys);
      if (sys?.kktp_default && (!silent || !showFormModalRef.current)) {
        setFormKktp(Number(sys.kktp_default));
      }

      const scopedAsgs =
        activeRole === 'guru'
          ? academicService.filterAssignmentsForUser(asgs, user, teacher, tchs)
          : asgs;
      const scopedAsgIds = new Set(scopedAsgs.map((a) => a.id));
      const scopedAsms =
        activeRole === 'guru'
          ? asms.filter((a) => scopedAsgIds.has(a.assignment_id))
          : asms;

      setAssignments(scopedAsgs);
      setAssessments(scopedAsms);
      setStudents(stds);
      setClassMembers(members);

      const defaultAsg =
        (effectiveAssignmentId && scopedAsgs.find((a) => a.id === effectiveAssignmentId)) ||
        scopedAsgs.find(
          (a) =>
            (!effectiveSubjectId || a.subject_id === effectiveSubjectId) &&
            (!effectiveClassId || a.class_id === effectiveClassId)
        ) ||
        scopedAsgs[0];
      if (defaultAsg && (!silent || !showFormModalRef.current)) {
        setFormAssignmentId(defaultAsg.id);
      }

      const matchingContextAsms = scopedAsms.filter((a) => {
        const linked = a.assignment || scopedAsgs.find((asg) => asg.id === a.assignment_id);
        if (!linked) return false;
        const matchSubj = !effectiveSubjectId || linked.subject_id === effectiveSubjectId;
        const matchClass = !effectiveClassId || linked.class_id === effectiveClassId;
        const matchAsg = !effectiveAssignmentId || linked.id === effectiveAssignmentId;
        return effectiveAssignmentId ? matchAsg : matchSubj && matchClass;
      });

      const candidatePool = onlyActiveContext && effectiveSubjectId ? matchingContextAsms : scopedAsms;
      const currentSelectedId = selectedAssessmentIdRef.current;

      if (candidatePool.length > 0) {
        const targetAsm =
          candidatePool.find((a) => a.id === currentSelectedId) ||
          (scopeContext?.scopeKey
            ? candidatePool.find((a) => a.scope_key === scopeContext.scopeKey)
            : undefined) ||
          candidatePool[0];
        if (targetAsm.id !== currentSelectedId) {
          dirtyStudentIdsRef.current.clear();
          setSelectedAssessmentId(targetAsm.id);
        }

        const grds = await assessmentService.getGrades(targetAsm.id);
        setGrades(grds);
        const freshMap = buildScoreInputsForAssessment(
          targetAsm,
          grds,
          scopedAsgs,
          stds,
          members,
          Number(sys?.kktp_default || 75)
        );
        setScoreInputs((prev) => {
          if (!silent || dirtyStudentIdsRef.current.size === 0 || targetAsm.id !== currentSelectedId) {
            return freshMap;
          }
          const merged = { ...freshMap };
          dirtyStudentIdsRef.current.forEach((studentId) => {
            if (prev[studentId]) {
              merged[studentId] = prev[studentId];
            }
          });
          return merged;
        });
      } else {
        dirtyStudentIdsRef.current.clear();
        setSelectedAssessmentId('');
        setGrades([]);
        setScoreInputs({});
      }
    } catch (err) {
      console.error('Gagal memuat data penilaian:', err);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [
    activeRole,
    user?.id,
    user?.email,
    user?.teacherId,
    user?.profile?.full_name,
    effectiveAssignmentId,
    effectiveSubjectId,
    effectiveClassId,
    scopeContext?.scopeKey,
    onlyActiveContext,
    buildScoreInputsForAssessment,
  ]);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  useRealtimeSync(
    [
      'simpel_assessments',
      'simpel_grades',
      'simpel_students',
      'simpel_assignments',
      'simpel_class_members',
      'simpel_teachers',
      'simpel_users_cache_v2',
      'simpel_mi_lingkup_materi_custom_v1',
      'simpel_mi_lingkup_materi_hidden_v1',
    ],
    () => {
      setScopeVersion((v) => v + 1);
      void loadData(true);
    }
  );

  // Helper resolusi scope key untuk sebuah asesmen (LM1..LM4, STS, SAS, atau __unscoped__)
  const getAssessmentEffectiveScopeKey = useCallback((a: Assessment): string => {
    const raw = String(a.scope_key || '').trim();
    if (raw) return raw;
    if (a.assessment_type === 'Sumatif_Tengah_Semester') return 'STS';
    if (a.assessment_type === 'Sumatif_Akhir_Semester') return 'SAS';
    return '__unscoped__';
  }, []);

  // Daftar asesmen sesuai konteks mapel/kelas (sebelum filter tab Lingkup Materi & jenis)
  const contextAssessments = useMemo(() => {
    return assessments.filter((a) => {
      if (onlyActiveContext && effectiveSubjectId) {
        const linked = a.assignment || assignments.find((asg) => asg.id === a.assignment_id);
        if (!linked) return false;
        if (effectiveAssignmentId) {
          if (linked.id !== effectiveAssignmentId) return false;
        } else {
          if (linked.subject_id !== effectiveSubjectId) return false;
          if (effectiveClassId && linked.class_id !== effectiveClassId) return false;
        }
      }
      return true;
    });
  }, [assessments, assignments, onlyActiveContext, effectiveSubjectId, effectiveClassId, effectiveAssignmentId]);

  // Daftar Tab Lingkup Materi / Unit Evaluasi (Sumatif LM 1..4, STS, SAS, dan kustom)
  const scopeTabs = useMemo(() => {
    const subjId = scopeContext?.subjectId || effectiveSubjectId || 'sbj-ind';
    const clsLevel = scopeContext?.classLevel || 4;
    const configured = curriculumWorkspaceService.getLingkupMateriList(subjId, clsLevel, 'Ganjil');
    const presets = curriculumWorkspaceService.getPresetLingkupMateriTemplates(subjId, clsLevel, 'Ganjil');

    const unitList = [...configured];
    const seen = new Set(unitList.map((u) => u.scope_key));
    for (const p of presets) {
      if (!seen.has(p.scope_key)) {
        unitList.push(p);
        seen.add(p.scope_key);
      }
    }

    const tabs: Array<{ key: string; code: string; title: string; count: number; isSpecial?: boolean }> = [
      {
        key: 'all',
        code: 'Semua Unit',
        title: 'Tampilkan semua lingkup materi & ujian',
        count: contextAssessments.length,
      },
    ];

    const countByScope = new Map<string, number>();
    for (const a of contextAssessments) {
      const sk = getAssessmentEffectiveScopeKey(a);
      countByScope.set(sk, (countByScope.get(sk) || 0) + 1);
    }

    for (const u of unitList) {
      tabs.push({
        key: u.scope_key,
        code: u.code,
        title: u.title,
        count: countByScope.get(u.scope_key) || 0,
        isSpecial: u.is_special_summative,
      });
    }

    // Tambahkan tab jika ada asesmen kustom yang belum tercakup
    for (const [sk, cnt] of countByScope.entries()) {
      if (sk !== '__unscoped__' && !seen.has(sk)) {
        tabs.push({
          key: sk,
          code: sk,
          title: `Unit ${sk}`,
          count: cnt,
        });
      }
    }

    const unscopedCount = countByScope.get('__unscoped__') || 0;
    if (unscopedCount > 0) {
      tabs.push({
        key: '__unscoped__',
        code: 'Umum / Lainnya',
        title: 'Asesmen tanpa unit lingkup materi',
        count: unscopedCount,
      });
    }

    return tabs;
  }, [
    scopeContext?.subjectId,
    scopeContext?.classLevel,
    effectiveSubjectId,
    contextAssessments,
    getAssessmentEffectiveScopeKey,
    scopeVersion,
  ]);

  // Filter assessments for tabs according to context, activeScopeTab & typeFilter
  const visibleAssessments = useMemo(() => {
    return contextAssessments.filter((a) => {
      if (activeScopeTab !== 'all' && getAssessmentEffectiveScopeKey(a) !== activeScopeTab) {
        return false;
      }
      if (typeFilter !== 'all' && a.assessment_type !== typeFilter) return false;
      return true;
    });
  }, [contextAssessments, activeScopeTab, typeFilter, getAssessmentEffectiveScopeKey]);

  const handleSelectAssessment = useCallback(async (asmId: string) => {
    setSelectedAssessmentId(asmId);
    const asm = assessments.find((a) => a.id === asmId);
    const linked = asm?.assignment || assignments.find((a) => a.id === asm?.assignment_id);
    if (linked) {
      setWorkspaceSelection({
        assignmentId: linked.id,
        subjectId: linked.subject_id,
        classId: linked.class_id,
        classLevel: linked.class?.level || null,
      });
    }
    try {
      dirtyStudentIdsRef.current.clear();
      const grds = await assessmentService.getGrades(asmId);
      setGrades(grds);
      setScoreInputs(
        buildScoreInputsForAssessment(
          asm,
          grds,
          assignments,
          students,
          classMembers,
          Number(settings?.kktp_default || 75)
        )
      );
    } catch (err) {
      console.error('Gagal memilih asesmen:', err);
    }
  }, [assessments, assignments, students, classMembers, settings?.kktp_default, buildScoreInputsForAssessment, setWorkspaceSelection]);

  const handleSelectScopeTab = (tabKey: string) => {
    setActiveScopeTab(tabKey);
    if (tabKey !== 'all' && tabKey !== '__unscoped__') {
      onScopeChange?.(tabKey);
    }
    const matching = contextAssessments.filter((a) => {
      const matchesScope = tabKey === 'all' || getAssessmentEffectiveScopeKey(a) === tabKey;
      const matchesType = typeFilter === 'all' || a.assessment_type === typeFilter;
      return matchesScope && matchesType;
    });
    if (matching.length > 0 && !matching.some((m) => m.id === selectedAssessmentId)) {
      void handleSelectAssessment(matching[0].id);
    } else if (matching.length === 0) {
      setSelectedAssessmentId('');
      setGrades([]);
      setScoreInputs({});
    }
  };

  // Resolve target assignment for creating a new assessment
  const activeContextAssignment = useMemo(() => {
    return (
      (effectiveAssignmentId && assignments.find((a) => a.id === effectiveAssignmentId)) ||
      assignments.find(
        (a) =>
          (!effectiveSubjectId || a.subject_id === effectiveSubjectId) &&
          (!effectiveClassId || a.class_id === effectiveClassId)
      ) ||
      assignments[0] ||
      null
    );
  }, [assignments, effectiveAssignmentId, effectiveSubjectId, effectiveClassId]);

  const availableScopeOptions = useMemo(() => {
    const selectedAsg =
      assignments.find((a) => a.id === formAssignmentId) || activeContextAssignment;
    const subjectId = selectedAsg?.subject_id || scopeContext?.subjectId || effectiveSubjectId || '';
    const classLevel = selectedAsg?.class?.level || scopeContext?.classLevel || 4;
    if (!subjectId) {
      return curriculumWorkspaceService.getPresetLingkupMateriTemplates('sbj-ind', classLevel, 'Ganjil');
    }
    const activeScopes = curriculumWorkspaceService.getLingkupMateriList(subjectId, classLevel, 'Ganjil');
    const presetTemplates = curriculumWorkspaceService.getPresetLingkupMateriTemplates(
      subjectId,
      classLevel,
      'Ganjil'
    );
    const merged = [...activeScopes];
    const seenKeys = new Set(merged.map((s) => s.scope_key));
    for (const tpl of presetTemplates) {
      if (!seenKeys.has(tpl.scope_key)) {
        merged.push(tpl);
        seenKeys.add(tpl.scope_key);
      }
    }
    return merged;
  }, [assignments, formAssignmentId, activeContextAssignment, scopeContext?.subjectId, scopeContext?.classLevel, effectiveSubjectId, scopeVersion]);

  const activeScopeForCreate =
    activeScopeTab !== 'all' && activeScopeTab !== '__unscoped__'
      ? activeScopeTab
      : scopeContext?.scopeKey || '';
  const activeScopeCodeForCreate =
    scopeTabs.find((t) => t.key === activeScopeForCreate)?.code || scopeContext?.scopeCode || '';

  const openCreateModal = (presetType?: AssessmentType, presetTitle?: string) => {
    setEditingAssessmentId(null);
    const defaultAsg = activeContextAssignment;
    setFormAssignmentId(defaultAsg?.id || '');
    const defaultScopeType: AssessmentType =
      presetType ||
      (activeScopeForCreate === 'STS'
        ? 'Sumatif_Tengah_Semester'
        : activeScopeForCreate === 'SAS'
        ? 'Sumatif_Akhir_Semester'
        : activeScopeForCreate
        ? 'Sumatif_Lingkup_Materi'
        : 'Formatif');
    setFormType(defaultScopeType);

    const subjLabel = defaultAsg?.subject?.name || scopeContext?.subjectName || 'Mapel';
    const scopeLabel = activeScopeCodeForCreate || '';
    const autoTitle =
      presetTitle ||
      (defaultScopeType === 'Sumatif_Tengah_Semester'
        ? `STS Offline - ${subjLabel}`
        : defaultScopeType === 'Sumatif_Akhir_Semester'
        ? `SAS Offline - ${subjLabel}`
        : defaultScopeType === 'Sumatif_Lingkup_Materi'
        ? `Sumatif ${scopeLabel || 'Materi'} - ${subjLabel}`
        : `Formatif ${scopeLabel || 'Harian'} - ${subjLabel}`);

    setFormTitle(autoTitle);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormKktp(Number(settings?.kktp_default || 75));
    setFormScopeKey(activeScopeForCreate);
    setShowFormModal(true);
  };

  const openEditModal = (asm: Assessment) => {
    setEditingAssessmentId(asm.id);
    setFormAssignmentId(asm.assignment_id);
    setFormTitle(asm.title);
    setFormType(asm.assessment_type);
    setFormDate(asm.assessment_date);
    setFormKktp(Number(asm.kktp));
    setFormScopeKey(asm.scope_key || '');
    setShowFormModal(true);
  };

  // Quick 1-click creator for offline assessments without kisi-kisi/soal
  const handleQuickCreateOffline = async (
    type: AssessmentType,
    customTitle?: string
  ) => {
    const targetAsg = activeContextAssignment;
    if (!targetAsg) {
      openCreateModal(type, customTitle);
      return;
    }

    const effectiveUnitKey =
      type === 'Sumatif_Tengah_Semester'
        ? 'STS'
        : type === 'Sumatif_Akhir_Semester'
        ? 'SAS'
        : activeScopeForCreate || (type === 'Sumatif_Lingkup_Materi' || type === 'Formatif' ? 'LM1' : '');
    const subjName = targetAsg.subject?.name || scopeContext?.subjectName || 'Mata Pelajaran';
    const scopeLabel = activeScopeCodeForCreate || (effectiveUnitKey === 'LM1' ? 'LM 1' : 'Harian');
    const title =
      customTitle ||
      (type === 'Formatif'
        ? `Asesmen Formatif ${scopeLabel} (Offline) - ${subjName}`
        : type === 'Sumatif_Tengah_Semester'
        ? `STS Offline - ${subjName}`
        : type === 'Sumatif_Akhir_Semester'
        ? `SAS Offline - ${subjName}`
        : `Sumatif ${scopeLabel} (Offline) - ${subjName}`);

    try {
      const created = await assessmentService.createAssessment({
        assignment_id: targetAsg.id,
        title,
        assessment_type: type,
        assessment_date: new Date().toISOString().split('T')[0],
        kktp: Number(settings?.kktp_default || 75),
        scope_key: effectiveUnitKey || null,
      });
      if (effectiveUnitKey) {
        setActiveScopeTab(effectiveUnitKey);
      }
      await loadData();
      await handleSelectAssessment(created.id);
      showToast(`Daftar isian nilai "${title}" siap diisi (tanpa perlu kisi-kisi/soal).`, 'success');
    } catch (err) {
      console.error('Gagal membuat daftar nilai cepat:', err);
      showToast('Gagal membuat daftar nilai asesmen.', 'error');
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAssignmentId) {
      showToast('Pilih penugasan mata pelajaran & kelas terlebih dahulu.', 'error');
      return;
    }

    try {
      if (editingAssessmentId) {
        await assessmentService.updateAssessment(editingAssessmentId, {
          assignment_id: formAssignmentId,
          title: formTitle,
          assessment_type: formType,
          assessment_date: formDate,
          kktp: formKktp,
          scope_key: formScopeKey || null,
        });
        setShowFormModal(false);
        await loadData();
        await handleSelectAssessment(editingAssessmentId);
        showToast(`Daftar nilai "${formTitle}" berhasil diperbarui.`, 'success');
      } else {
        const created = await assessmentService.createAssessment({
          assignment_id: formAssignmentId,
          title: formTitle,
          assessment_type: formType,
          assessment_date: formDate,
          kktp: formKktp,
          scope_key: formScopeKey || scopeContext?.scopeKey || null,
        });
        setShowFormModal(false);
        setFormTitle('');
        await loadData();
        await handleSelectAssessment(created.id);
        showToast(`Daftar nilai "${created.title}" berhasil dibuat dan siap diisi.`, 'success');
      }
    } catch (err) {
      console.error('Gagal menyimpan asesmen:', err);
      showToast('Terjadi kesalahan saat menyimpan instrumen asesmen.', 'error');
    }
  };

  const handleDeleteAssessment = async () => {
    if (!confirmDeleteAsm) return;
    try {
      await assessmentService.deleteAssessment(confirmDeleteAsm.id);
      const deletedTitle = confirmDeleteAsm.title;
      setConfirmDeleteAsm(null);
      setSelectedAssessmentId('');
      await loadData();
      showToast(`Daftar nilai "${deletedTitle}" telah dihapus.`, 'info');
    } catch (err) {
      console.error('Gagal menghapus asesmen:', err);
      showToast('Gagal menghapus instrumen asesmen.', 'error');
    }
  };

  const handleScoreChange = (studentId: string, val: number) => {
    dirtyStudentIdsRef.current.add(studentId);
    const safeVal = Number.isNaN(val) ? 0 : Math.min(100, Math.max(0, val));
    setScoreInputs((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        score: safeVal,
      },
    }));
  };

  const handleFeedbackChange = (studentId: string, text: string) => {
    dirtyStudentIdsRef.current.add(studentId);
    setScoreInputs((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        feedback: text,
      },
    }));
  };

  const currentAsm =
    visibleAssessments.find((a) => a.id === selectedAssessmentId) ||
    assessments.find((a) => a.id === selectedAssessmentId);
  const currentKktp = currentAsm ? Number(currentAsm.kktp) : Number(settings?.kktp_default || 75);
  const displayedStudents = getStudentsForAssessment(currentAsm, assignments, students, classMembers);

  const handleApplyUniformScore = () => {
    if (!currentAsm || displayedStudents.length === 0) return;
    const numericVal = uniformScore.trim() === '' ? currentKktp : Math.min(100, Math.max(0, Number(uniformScore)));
    if (Number.isNaN(numericVal)) return;

    displayedStudents.forEach((s) => dirtyStudentIdsRef.current.add(s.id));
    setScoreInputs((prev) => {
      const next = { ...prev };
      displayedStudents.forEach((s) => {
        next[s.id] = {
          score: numericVal,
          feedback: prev[s.id]?.feedback || '',
        };
      });
      return next;
    });
    showToast(`Seluruh nilai siswa diisi seragam (${numericVal}). Jangan lupa klik Simpan Nilai.`, 'info');
  };

  const handleSaveGrades = async () => {
    if (!currentAsm) return;
    setIsSaving(true);
    try {
      const entries = displayedStudents.map((s) => ({
        studentId: s.id,
        score: scoreInputs[s.id]?.score ?? currentKktp,
        feedback: scoreInputs[s.id]?.feedback || null,
      }));

      await assessmentService.saveGrades(currentAsm.id, entries);
      dirtyStudentIdsRef.current.clear();
      notifyDomFormSaved();
      const grds = await assessmentService.getGrades(currentAsm.id);
      setGrades(grds);

      const linked = currentAsm.assignment || assignments.find((a) => a.id === currentAsm.assignment_id);
      const targetSlot = reportService.resolveLedgerSlotForAssessment(
        currentAsm,
        linked?.subject_id,
        linked?.class?.level || 4
      );
      const ledgerMsg = targetSlot
        ? ` dan diteruskan ke kolom ${LEDGER_SLOT_LABELS[targetSlot]} Leger Nilai.`
        : '.';

      const belowKktpCount = entries.filter((e) => e.score < currentKktp).length;
      if (belowKktpCount > 0) {
        showToast(
          `Daftar nilai disimpan${ledgerMsg} ${belowKktpCount} siswa (< KKTP ${currentKktp}) otomatis masuk ke Remedial.`,
          'success'
        );
      } else {
        showToast(`Daftar nilai siswa berhasil disimpan${ledgerMsg}`, 'success');
      }
    } catch (err) {
      console.error('Gagal menyimpan nilai:', err);
      showToast('Gagal menyimpan daftar nilai siswa.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openLedgerSyncDialog = () => {
    if (!currentAsm) return;
    const scopeHint = (currentAsm.scope_key || scopeContext?.scopeKey || '').toUpperCase();
    if (currentAsm.assessment_type === 'Sumatif_Tengah_Semester' || scopeHint === 'STS') {
      setLedgerTargetSlot('stsScore');
    } else if (currentAsm.assessment_type === 'Sumatif_Akhir_Semester' || scopeHint === 'SAS') {
      setLedgerTargetSlot('sasScore');
    } else if (scopeHint === 'LM2') {
      setLedgerTargetSlot('lm2');
    } else if (scopeHint === 'LM3') {
      setLedgerTargetSlot('lm3');
    } else if (scopeHint === 'LM4') {
      setLedgerTargetSlot('lm4');
    } else {
      setLedgerTargetSlot('lm1');
    }
    setShowLedgerSyncModal(true);
  };

  const handleConfirmSyncToLedger = async () => {
    if (!currentAsm) return;
    const linked = currentAsm.assignment || assignments.find((a) => a.id === currentAsm.assignment_id);
    if (!linked?.class_id || !linked?.subject_id) {
      showToast('Penugasan kelas & mapel tidak ditemukan untuk dikirim ke leger.', 'error');
      return;
    }

    try {
      const scoreMap: Record<string, number> = {};
      displayedStudents.forEach((s) => {
        scoreMap[s.id] = scoreInputs[s.id]?.score ?? currentKktp;
      });
      const count = await reportService.syncAssessmentScoresToLedger(
        linked.class_id,
        linked.subject_id,
        ledgerTargetSlot,
        scoreMap
      );
      setShowLedgerSyncModal(false);
      const slotLabels: Record<typeof ledgerTargetSlot, string> = {
        lm1: 'Sumatif LM 1',
        lm2: 'Sumatif LM 2',
        lm3: 'Sumatif LM 3',
        lm4: 'Sumatif LM 4',
        stsScore: 'STS',
        sasScore: 'SAS',
      };
      showToast(
        `${count} nilai siswa berhasil disinkronkan ke kolom ${slotLabels[ledgerTargetSlot]} di Leger Nilai Rapor.`,
        'success'
      );
    } catch (err) {
      console.error('Gagal mengirim nilai ke leger:', err);
      showToast('Gagal menyinkronkan nilai ke leger rapor.', 'error');
    }
  };

  const handleExportCSV = () => {
    if (!currentAsm) return;
    const linked = currentAsm.assignment || assignments.find((a) => a.id === currentAsm.assignment_id);
    const headers = ['No', 'NIS', 'NISN', 'Nama_Siswa', 'Nilai', 'Ketuntasan_KKTP', 'Catatan_Umpan_Balik'];
    const rows = displayedStudents.map((s, idx) => {
      const val = scoreInputs[s.id]?.score ?? 0;
      const fb = scoreInputs[s.id]?.feedback || '';
      const passed = val >= currentKktp ? 'TUNTAS' : 'PERLU REMEDIAL';
      return [
        idx + 1,
        s.nis,
        s.nisn || '-',
        `"${s.full_name.replace(/"/g, '""')}"`,
        val,
        passed,
        `"${fb.replace(/"/g, '""')}"`,
      ].join(',');
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = `${currentAsm.title}_${linked?.class?.name || 'kelas'}`.replace(/\s+/g, '_');
    a.download = `daftar_nilai_${safeName}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Daftar nilai siswa berhasil diekspor ke CSV.', 'success');
  };

  const handlePrintDocument = () => {
    if (!currentAsm) return;
    const linked = currentAsm.assignment || assignments.find((a) => a.id === currentAsm.assignment_id);
    const tableRows = displayedStudents
      .map((s, idx) => {
        const g = grades.find((gr) => gr.student_id === s.id);
        const score = g ? Number(g.score) : scoreInputs[s.id]?.score ?? 0;
        const feedback = g?.feedback ?? scoreInputs[s.id]?.feedback ?? '-';
        const passed = score >= currentKktp;
        return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="center"><strong>${s.full_name}</strong></td>
          <td class="center font-mono">${s.nis} / ${s.nisn || '-'}</td>
          <td class="center font-bold" style="font-size:11pt;color:${passed ? '#047857' : '#e11d48'};">${score}</td>
          <td class="center font-bold" style="color:${passed ? '#047857' : '#e11d48'};">${passed ? 'TUNTAS' : 'REMEDIAL'}</td>
          <td>${feedback || '-'}</td>
        </tr>
      `;
      })
      .join('');

    const contentHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 35px;">No</th>
            <th>Nama Lengkap Peserta Didik</th>
            <th style="width: 130px;">NIS / NISN</th>
            <th style="width: 70px;">Nilai</th>
            <th style="width: 100px;">Ketuntasan KKTP</th>
            <th>Catatan Umpan Balik Guru</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    printDocumentDirectly(contentHtml, {
      title: `LEMBAR DAFTAR NILAI & KETUNTASAN SISWA`,
      subtitle: `${currentAsm.title} - Ambang KKTP: ${currentKktp}`,
      schoolName: settings?.school_name,
      schoolAddress: settings?.address,
      logoUrl: settings?.logo_url || undefined,
      metadata: [
        { label: 'Mata Pelajaran', value: linked?.subject?.name || scopeContext?.subjectName || '-' },
        { label: 'Rombongan Belajar', value: linked?.class?.name || scopeContext?.className || '-' },
        { label: 'Tipe Asesmen', value: currentAsm.assessment_type.replace(/_/g, ' ') },
        { label: 'Tanggal Pelaksanaan', value: currentAsm.assessment_date },
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

  // Metrics summary for current assessment
  const summaryStats = useMemo(() => {
    if (!currentAsm || displayedStudents.length === 0) {
      return { total: 0, saved: 0, passed: 0, remedial: 0, average: 0 };
    }
    const savedSet = new Set(grades.map((g) => g.student_id));
    let sum = 0;
    let passed = 0;
    displayedStudents.forEach((s) => {
      const sc = scoreInputs[s.id]?.score ?? currentKktp;
      sum += sc;
      if (sc >= currentKktp) passed++;
    });
    return {
      total: displayedStudents.length,
      saved: savedSet.size,
      passed,
      remedial: displayedStudents.length - passed,
      average: Math.round((sum / displayedStudents.length) * 10) / 10,
    };
  }, [currentAsm, displayedStudents, grades, scoreInputs, currentKktp]);

  const savedStudentIds = useMemo(() => new Set(grades.map((g) => g.student_id)), [grades]);

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Daftar Isian Nilai Formatif &amp; Sumatif Siswa
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola nilai asesmen formatif, sumatif lingkup materi, STS, maupun SAS secara langsung — mendukung pelaksanaan asesmen secara offline tanpa wajib membuat kisi-kisi dan soal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate('leger-nilai')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg shadow-xs transition-colors"
              title="Lihat Rekapitulasi Leger Nilai TP/LM & Rapor"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-950" />
              <span>Buka Leger Nilai Rapor</span>
            </button>
          )}
          {currentAsm && (
            <>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
                title="Unduh daftar nilai ke format CSV"
              >
                <Download className="w-4 h-4 text-emerald-700" />
                <span>Ekspor CSV</span>
              </button>
              <button
                onClick={handlePrintDocument}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
                title="Cetak format resmi daftar nilai lengkap kop madrasah"
              >
                <Printer className="w-4 h-4 text-emerald-800" />
                <span>Cetak PDF</span>
              </button>
            </>
          )}
          <button
            onClick={() => openCreateModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-900 text-xs font-bold rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-700" />
            <span>Buat Daftar Nilai Baru</span>
          </button>
          <button
            onClick={handleSaveGrades}
            disabled={isSaving || !currentAsm}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Nilai'}</span>
          </button>
        </div>
      </div>

      {/* Banner Informasi Mode Asesmen Offline Mandiri */}
      <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 text-xs text-emerald-950">
          <ClipboardCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              Mode Daftar Nilai Mandiri (Asesmen Offline Didukung)
            </p>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              Anda dapat langsung membuat instrumen penilaian <strong>Formatif</strong> maupun <strong>Sumatif</strong> (LM 1–4, STS, SAS) dan menginput nilai siswa dari ujian kertas, praktik, atau lisan <strong>meskipun belum membuat Kisi-kisi maupun Naskah Soal</strong>.
            </p>
          </div>
        </div>
        {assignments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleQuickCreateOffline('Formatif')}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-700" />
              <span>+ Formatif {activeScopeCodeForCreate || 'Offline'}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                handleQuickCreateOffline(
                  activeScopeForCreate === 'STS'
                    ? 'Sumatif_Tengah_Semester'
                    : activeScopeForCreate === 'SAS'
                    ? 'Sumatif_Akhir_Semester'
                    : 'Sumatif_Lingkup_Materi'
                )
              }
              className="px-2.5 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-amber-300" />
              <span>
                + Sumatif {activeScopeCodeForCreate || 'LM 1'}
              </span>
            </button>
          </div>
        )}
      </div>

      {statusMessage && (
        <div
          className={`flex items-center gap-2 p-3 text-xs font-medium rounded-lg border ${
            statusMessage.type === 'error'
              ? 'text-rose-800 bg-rose-50 border-rose-200'
              : statusMessage.type === 'info'
              ? 'text-amber-900 bg-amber-50 border-amber-200'
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

      {/* Tab Sumatif Lingkup Materi, Jenis Asesmen & Daftar Instrumen Nilai */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
        {/* Baris 1: Header Konteks & Filter Jenis Asesmen dalam bentuk Tab */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900">
                Navigasi Sumatif Lingkup Materi &amp; Instrumen Nilai
              </h2>
              <p className="text-[11px] text-slate-500">
                Pilih tab unit Lingkup Materi dan instrumen nilai. Nilai Sumatif otomatis diteruskan ke Leger Nilai.
              </p>
            </div>
            {effectiveSubjectId && (
              <button
                type="button"
                onClick={() => setOnlyActiveContext((v) => !v)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                  onlyActiveContext
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {onlyActiveContext
                  ? `Konteks: ${scopeContext?.subjectName || 'Mapel Aktif'} (${scopeContext?.className || 'Rombel'})`
                  : 'Tampilkan Semua Mapel'}
              </button>
            )}
          </div>

          {/* Tab Filter Jenis Asesmen (Tanpa Dropdown) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5 shrink-0" />
            {(
              [
                { value: 'all', label: 'Semua' },
                { value: 'Formatif', label: 'Formatif' },
                { value: 'Sumatif_Lingkup_Materi', label: 'Sumatif LM' },
                { value: 'Sumatif_Tengah_Semester', label: 'STS' },
                { value: 'Sumatif_Akhir_Semester', label: 'SAS' },
              ] as const
            ).map((item) => {
              const isSelected = typeFilter === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTypeFilter(item.value)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-white text-emerald-900 font-bold shadow-2xs border border-emerald-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Baris 2: Tab Sumatif Lingkup Materi (LM 1..4, STS, SAS, Kustom) */}
        <div className="border-t border-slate-100 pt-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Tab Lingkup Materi / Unit Evaluasi
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {scopeTabs.map((tab) => {
              const isTabActive = activeScopeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleSelectScopeTab(tab.key)}
                  title={tab.title}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 cursor-pointer ${
                    isTabActive
                      ? tab.isSpecial
                        ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-xs'
                        : 'bg-emerald-800 text-white border-emerald-900 font-bold shadow-xs'
                      : tab.isSpecial
                      ? 'bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                  }`}
                >
                  <span>{tab.code}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                      isTabActive
                        ? tab.isSpecial
                          ? 'bg-amber-700/20 text-slate-950'
                          : 'bg-emerald-950/60 text-amber-300'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Baris 3: Tab Daftar Nilai / Instrumen Asesmen + Aksi Instrumen Terpilih */}
        <div className="border-t border-slate-100 pt-3 flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Tab Daftar Nilai / Instrumen ({visibleAssessments.length})
            </p>
            {visibleAssessments.length === 0 ? (
              <div className="px-3 py-2 rounded-lg bg-slate-50 border border-dashed border-slate-300 text-xs text-slate-500">
                Belum ada daftar nilai pada tab unit &amp; jenis ini. Klik tombol <strong>+ Formatif</strong> atau <strong>+ Sumatif</strong> di atas untuk membuat langsung.
              </div>
            ) : (
              <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
                {visibleAssessments.map((a) => {
                  const isSelected = currentAsm?.id === a.id;
                  const linked = a.assignment || assignments.find((asg) => asg.id === a.assignment_id);
                  const targetSlot = reportService.resolveLedgerSlotForAssessment(
                    a,
                    linked?.subject_id,
                    linked?.class?.level || 4
                  );
                  const clsBadge = !onlyActiveContext && linked?.class?.name ? `${linked.class.name} · ` : '';

                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleSelectAssessment(a.id)}
                      className={`text-left px-3 py-2 rounded-xl border transition-all shrink-0 max-w-[260px] cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-500/40 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            a.assessment_type === 'Formatif'
                              ? 'bg-sky-100 text-sky-900'
                              : a.assessment_type === 'Sumatif_Lingkup_Materi'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-amber-100 text-amber-950'
                          }`}
                        >
                          {a.assessment_type === 'Sumatif_Lingkup_Materi'
                            ? 'Sumatif LM'
                            : a.assessment_type === 'Sumatif_Tengah_Semester'
                            ? 'STS'
                            : a.assessment_type === 'Sumatif_Akhir_Semester'
                            ? 'SAS'
                            : 'Formatif'}
                        </span>
                        {targetSlot && (
                          <span className="text-[9px] font-bold text-emerald-700 font-mono">
                            → Leger {LEDGER_SLOT_LABELS[targetSlot]}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                        {clsBadge}{a.title}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {a.assessment_date} · KKTP {a.kktp}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {currentAsm && (
            <div className="flex flex-wrap items-center gap-2 shrink-0 lg:pt-5">
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono tabular-nums">
                <span className="text-slate-500 mr-1">KKTP:</span>
                <strong className="text-emerald-900">{currentKktp}</strong>
                <span className="text-slate-300 mx-2">|</span>
                <span className="text-slate-600">{currentAsm.assessment_date}</span>
              </div>

              <button
                type="button"
                onClick={openLedgerSyncDialog}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-bold transition-colors"
                title="Pilih kolom tujuan secara manual bila ingin memindahkan ke kolom LM/STS/SAS lain di Leger Nilai Rapor"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Sinkron ke Leger</span>
              </button>

              <button
                type="button"
                onClick={() => openEditModal(currentAsm)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors"
                title="Ubah judul, jenis, tanggal, atau KKTP"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setConfirmDeleteAsm(currentAsm)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                title="Hapus daftar nilai ini"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Ringkasan & Alat Bantu Cepat Nilai */}
        {currentAsm && (
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold">
                Siswa: <strong className="font-mono">{summaryStats.total}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-100 font-semibold">
                Tersimpan: <strong className="font-mono">{summaryStats.saved}/{summaryStats.total}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100 font-semibold">
                Tuntas: <strong className="font-mono">{summaryStats.passed}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-800 border border-rose-100 font-semibold">
                Remedial: <strong className="font-mono">{summaryStats.remedial}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-semibold">
                Rata-rata: <strong className="font-mono">{summaryStats.average}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                placeholder={`Nilai (${currentKktp})`}
                value={uniformScore}
                onChange={(e) => setUniformScore(e.target.value)}
                className="w-24 text-xs font-mono px-2.5 py-1 border border-slate-200 rounded-lg focus:outline-emerald-600"
              />
              <button
                type="button"
                onClick={handleApplyUniformScore}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold border border-slate-200 transition-colors"
              >
                Terapkan ke Semua
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabel Input Nilai Siswa */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nama Lengkap Siswa</th>
                <th className="py-3 px-4 w-32 text-center">Nilai (0 - 100)</th>
                <th className="py-3 px-4 w-40 text-center">Ketuntasan KKTP</th>
                <th className="py-3 px-4">Catatan Umpan Balik Guru</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Memuat daftar nilai...
                  </td>
                </tr>
              ) : !currentAsm ? (
                <tr>
                  <td colSpan={5} className="py-10 px-6 text-center">
                    <div className="max-w-lg mx-auto space-y-3">
                      <p className="text-sm font-bold text-slate-800">
                        Belum Ada Daftar Nilai untuk Konteks Ini
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Anda dapat langsung membuat lembar isian nilai untuk asesmen Formatif maupun Sumatif (termasuk hasil tes tertulis, praktik, atau lisan offline) tanpa perlu menyusun Kisi-kisi dan Bank Soal terlebih dahulu.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        {assignments.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleQuickCreateOffline('Formatif')}
                              className="px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs font-bold transition-colors flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Buat Daftar Nilai Formatif</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickCreateOffline(
                                  scopeContext?.scopeKey === 'STS'
                                    ? 'Sumatif_Tengah_Semester'
                                    : scopeContext?.scopeKey === 'SAS'
                                    ? 'Sumatif_Akhir_Semester'
                                    : 'Sumatif_Lingkup_Materi'
                                )
                              }
                              className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5 text-amber-300" />
                              <span>
                                Buat Daftar Nilai Sumatif {scopeContext?.scopeCode || 'Materi'}
                              </span>
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => openCreateModal()}
                          className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Buat Daftar Nilai Kustom</span>
                        </button>
                      </div>
                      {onlyActiveContext && assessments.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setOnlyActiveContext(false)}
                          className="text-xs font-semibold text-emerald-700 hover:underline pt-1"
                        >
                          Lihat seluruh {assessments.length} instrumen asesmen dari semua mapel/kelas →
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Belum ada siswa terdaftar di rombel untuk penugasan ini. Pastikan siswa sudah dimasukkan ke rombel melalui menu Data Siswa atau Kelas.
                  </td>
                </tr>
              ) : (
                displayedStudents.map((student, idx) => {
                  const input = scoreInputs[student.id] || { score: currentKktp, feedback: '' };
                  const isPassed = input.score >= currentKktp;
                  const isAlreadySaved = savedStudentIds.has(student.id);

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{student.full_name}</span>
                          {!isAlreadySaved && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-semibold">
                              Belum disimpan
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          NIS: {student.nis}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={input.score}
                          onChange={(e) => handleScoreChange(student.id, Number(e.target.value))}
                          className="w-20 text-center font-mono tabular-nums font-bold text-sm py-1.5 px-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isPassed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Tuntas</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>Perlu Remedial</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="Umpan balik motivasi atau catatan pemahaman..."
                          value={input.feedback}
                          onChange={(e) => handleFeedbackChange(student.id, e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {currentAsm && displayedStudents.length > 0 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">
              Tekan tombol <strong>Simpan Nilai</strong> untuk menyimpan seluruh skor dan umpan balik siswa.
            </span>
            <button
              onClick={handleSaveGrades}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Semua Nilai'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Daftar Nilai Asesmen */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingAssessmentId ? 'Ubah Informasi Daftar Nilai' : 'Buat Daftar Nilai Asesmen Baru'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Cocok untuk asesmen daring maupun luring (tes tulis, lisan, praktik, proyek) tanpa memerlukan kisi-kisi atau soal di sistem.
            </p>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Penugasan Mapel &amp; Kelas</label>
                <select
                  value={formAssignmentId}
                  onChange={(e) => setFormAssignmentId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  required
                >
                  {assignments.length === 0 ? (
                    <option value="">Belum ada penugasan mengajar</option>
                  ) : (
                    assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.class?.name || '-'} - {a.subject?.name || 'Mata Pelajaran'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Daftar Nilai / Asesmen</label>
                <input
                  type="text"
                  placeholder="Contoh: Sumatif LM 1 Offline - Tes Tulis Bab 1"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Jenis Asesmen</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { value: 'Formatif', label: 'Formatif' },
                      { value: 'Sumatif_Lingkup_Materi', label: 'Sumatif Lingkup Materi' },
                      { value: 'Sumatif_Tengah_Semester', label: 'STS (Tengah Semester)' },
                      { value: 'Sumatif_Akhir_Semester', label: 'SAS (Akhir Semester)' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setFormType(opt.value);
                        if (opt.value === 'Sumatif_Tengah_Semester') setFormScopeKey('STS');
                        else if (opt.value === 'Sumatif_Akhir_Semester') setFormScopeKey('SAS');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border text-left transition-colors cursor-pointer ${
                        formType === opt.value
                          ? 'bg-emerald-800 text-white border-emerald-900 font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tab Lingkup Materi / Unit Evaluasi
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormScopeKey('')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      formScopeKey === ''
                        ? 'bg-emerald-800 text-white border-emerald-900 font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                    }`}
                  >
                    Umum / Lintas Unit
                  </button>
                  {availableScopeOptions.map((sc) => (
                    <button
                      key={sc.scope_key}
                      type="button"
                      onClick={() => setFormScopeKey(sc.scope_key)}
                      title={sc.title}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                        formScopeKey === sc.scope_key
                          ? 'bg-emerald-800 text-white border-emerald-900 font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                      }`}
                    >
                      {sc.code}
                    </button>
                  ))}
                  {formScopeKey &&
                    !availableScopeOptions.some((sc) => sc.scope_key === formScopeKey) && (
                      <button
                        type="button"
                        onClick={() => setFormScopeKey(formScopeKey)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-emerald-800 text-white border-emerald-900"
                      >
                        {formScopeKey}
                      </button>
                    )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Asesmen</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kriteria Tuntas (KKTP)</label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={formKktp}
                    onChange={(e) => setFormKktp(Number(e.target.value))}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  {editingAssessmentId ? 'Simpan Perubahan' : 'Simpan Daftar Nilai'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Daftar Nilai */}
      {confirmDeleteAsm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Hapus Daftar Nilai Asesmen?</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Instrumen <strong>{confirmDeleteAsm.title}</strong> beserta seluruh nilai siswa di dalamnya akan dihapus permanen.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteAsm(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteAssessment}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg"
              >
                Ya, Hapus Daftar Nilai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Kirim Nilai ke Leger Rapor */}
      {showLedgerSyncModal && currentAsm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Kirim Nilai ke Leger Rapor</h3>
              <p className="text-xs text-slate-500 mt-1">
                Nilai siswa dari <strong>{currentAsm.title}</strong> akan langsung dimasukkan ke kolom leger rapor mata pelajaran terkait.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Pilih Kolom Tujuan di Leger Nilai Rapor:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { slot: 'lm1', label: 'Sumatif LM 1' },
                    { slot: 'lm2', label: 'Sumatif LM 2' },
                    { slot: 'lm3', label: 'Sumatif LM 3' },
                    { slot: 'lm4', label: 'Sumatif LM 4' },
                    { slot: 'stsScore', label: 'STS (Tengah Sem.)' },
                    { slot: 'sasScore', label: 'SAS (Akhir Sem.)' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.slot}
                    type="button"
                    onClick={() => setLedgerTargetSlot(item.slot)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors text-left cursor-pointer ${
                      ledgerTargetSlot === item.slot
                        ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowLedgerSyncModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSyncToLedger}
                className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
