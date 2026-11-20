import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { assessmentService } from '../../services/assessmentService';
import { academicService } from '../../services/academicService';
import { curriculumWorkspaceService } from '../../services/curriculumWorkspaceService';
import {
  RemedialRecord,
  EnrichmentRecord,
  Student,
  TeachingAssignment,
  ClassMember,
} from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { GradeScopeContext } from './GradesPage';
import {
  Plus,
  CheckCircle,
  TrendingUp,
  Sparkles,
  Save,
  Search,
  AlertCircle,
  Clock,
  Trash2,
  BookOpen,
} from 'lucide-react';

interface RemedialEnrichmentPageProps {
  scopeContext?: GradeScopeContext;
}

export const RemedialEnrichmentPage: React.FC<RemedialEnrichmentPageProps> = ({ scopeContext }) => {
  const { user, activeRole } = useAuth();
  const { selectedAssignmentId, selectedSubjectId, selectedClassId } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'remedial' | 'enrichment'>('remedial');
  const [remedials, setRemedials] = useState<RemedialRecord[]>([]);
  const [enrichments, setEnrichments] = useState<EnrichmentRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingBatch, setIsSavingBatch] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Filter states untuk tabel remedial
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [assignmentFilter, setAssignmentFilter] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'passed' | 'not_passed'>('all');

  // Draft input inline nilai hasil remedial & bentuk kegiatan per record id
  const [draftScores, setDraftScores] = useState<Record<string, string>>({});
  const [draftActivities, setDraftActivities] = useState<Record<string, string>>({});
  const [confirmDeleteRem, setConfirmDeleteRem] = useState<RemedialRecord | null>(null);

  // Modal State
  const [showRemedialModal, setShowRemedialModal] = useState<boolean>(false);
  const [showEnrichmentModal, setShowEnrichmentModal] = useState<boolean>(false);

  // Form Remedial manual
  const [remAssignmentId, setRemAssignmentId] = useState<string>('');
  const [remStudentId, setRemStudentId] = useState<string>('');
  const [remScopeKey, setRemScopeKey] = useState<string>('');
  const [remObjective, setRemObjective] = useState<string>('');
  const [remActivity, setRemActivity] = useState<string>('');
  const [remDate, setRemDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remScoreBefore, setRemScoreBefore] = useState<number>(65);
  const [remScoreAfter, setRemScoreAfter] = useState<string>('');
  const [remFollowup, setRemFollowup] = useState<string>('');

  // Form Pengayaan
  const [enrAssignmentId, setEnrAssignmentId] = useState<string>('');
  const [enrStudentId, setEnrStudentId] = useState<string>('');
  const [enrTopic, setEnrTopic] = useState<string>('');
  const [enrActivity, setEnrActivity] = useState<string>('');
  const [enrDate, setEnrDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [enrNotes, setEnrNotes] = useState<string>('');

  const effectiveSubjectId = scopeContext?.subjectId || selectedSubjectId || '';
  const effectiveClassId = scopeContext?.classId || selectedClassId || '';
  const effectiveAssignmentId = scopeContext?.assignmentId || selectedAssignmentId || '';

  const showNotice = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  useEffect(() => {
    setScopeFilter('all');
    if (effectiveAssignmentId) {
      setAssignmentFilter(effectiveAssignmentId);
    } else if (effectiveClassId) {
      setAssignmentFilter('__active_class__');
    } else {
      setAssignmentFilter('all');
    }
  }, [effectiveSubjectId, effectiveAssignmentId, effectiveClassId]);

  const getStudentsForAssignment = useCallback(
    (asgId: string, asgsPool: TeachingAssignment[], stdsPool: Student[], membersPool: ClassMember[]): Student[] => {
      const targetAsg = asgsPool.find((a) => a.id === asgId);
      if (!targetAsg) return stdsPool;
      const enrolledIds = membersPool
        .filter((m) => m.class_id === targetAsg.class_id)
        .map((m) => m.student_id);
      return stdsPool.filter((s) => enrolledIds.includes(s.id));
    },
    []
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Sinkronkan terlebih dahulu semua siswa yang nilainya < KKTP ke daftar remedial secara otomatis
      await assessmentService.syncAllAutoRemedials();

      const [rems, enrs, stds, asgs, members, teacher, tchs] = await Promise.all([
        assessmentService.getRemedialRecords(),
        assessmentService.getEnrichmentRecords(),
        academicService.getStudents(),
        academicService.getTeachingAssignments(),
        academicService.getClassMembers(),
        academicService.resolveTeacherForUser(user),
        academicService.getTeachers(),
      ]);

      const scopedAsgs =
        activeRole === 'guru'
          ? academicService.filterAssignmentsForUser(asgs, user, teacher, tchs)
          : asgs;
      const scopedAsgIds = new Set(scopedAsgs.map((a) => a.id));

      // Isolasi ketat per mata pelajaran agar nama siswa dari mapel lain tidak muncul di tab mapel ini
      const subjectScopedAsgs = effectiveSubjectId
        ? scopedAsgs.filter((a) => a.subject_id === effectiveSubjectId)
        : scopedAsgs;
      const subjectScopedIds = new Set(subjectScopedAsgs.map((a) => a.id));

      const belongsToCurrentSubject = (assignmentId: string, embeddedAsg?: TeachingAssignment) => {
        if (subjectScopedIds.has(assignmentId)) return true;
        if (activeRole === 'guru' && !scopedAsgIds.has(assignmentId)) {
          const resolved = asgs.find((a) => a.id === assignmentId) || embeddedAsg;
          if (!resolved) return false;
          const matchesUser = academicService.filterAssignmentsForUser([resolved], user, teacher, tchs).length > 0;
          if (!matchesUser) return false;
          return !effectiveSubjectId || resolved.subject_id === effectiveSubjectId;
        }
        if (effectiveSubjectId) {
          const resolved = asgs.find((a) => a.id === assignmentId) || embeddedAsg;
          if (!resolved) return false;
          return resolved.subject_id === effectiveSubjectId;
        }
        return activeRole !== 'guru';
      };

      const filteredRems = rems.filter((r) => belongsToCurrentSubject(r.assignment_id, r.assignment));
      const filteredEnrs = enrs.filter((e) => belongsToCurrentSubject(e.assignment_id, e.assignment));

      setRemedials(filteredRems);
      setEnrichments(filteredEnrs);
      setStudents(stds);
      setClassMembers(members);
      setAssignments(subjectScopedAsgs);

      const nextDraftScores: Record<string, string> = {};
      const nextDraftActivities: Record<string, string> = {};
      filteredRems.forEach((r) => {
        nextDraftScores[r.id] =
          r.score_after === null || r.score_after === undefined ? '' : String(r.score_after);
        nextDraftActivities[r.id] = r.remedial_activity || '';
      });
      setDraftScores(nextDraftScores);
      setDraftActivities(nextDraftActivities);

      const defaultAsg =
        (effectiveAssignmentId && subjectScopedAsgs.find((a) => a.id === effectiveAssignmentId)) ||
        subjectScopedAsgs.find(
          (a) =>
            (!effectiveSubjectId || a.subject_id === effectiveSubjectId) &&
            (!effectiveClassId || a.class_id === effectiveClassId)
        ) ||
        subjectScopedAsgs[0];

      const preferredAsgId = defaultAsg?.id || '';
      setRemAssignmentId((prev) =>
        subjectScopedAsgs.some((a) => a.id === prev) ? prev : preferredAsgId
      );
      setEnrAssignmentId((prev) =>
        subjectScopedAsgs.some((a) => a.id === prev) ? prev : preferredAsgId
      );

      const filteredRemStudents = getStudentsForAssignment(preferredAsgId, subjectScopedAsgs, stds, members);
      const firstStudent = filteredRemStudents[0] || stds[0];
      if (firstStudent) {
        setRemStudentId((prev) =>
          filteredRemStudents.some((s) => s.id === prev) ? prev : firstStudent.id
        );
        setEnrStudentId((prev) =>
          filteredRemStudents.some((s) => s.id === prev) ? prev : firstStudent.id
        );
      }
    } catch (err) {
      console.error('Gagal memuat data remedial & pengayaan:', err);
    } finally {
      setIsLoading(false);
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
    getStudentsForAssignment,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRealtimeSync(
    [
      'simpel_remedial',
      'simpel_enrichment',
      'simpel_assessments',
      'simpel_grades',
      'simpel_students',
      'simpel_assignments',
      'simpel_class_members',
      'simpel_teachers',
      'simpel_users_cache_v2',
      'simpel_mi_lingkup_materi_custom_v1',
    ],
    () => {
      void loadData();
    }
  );

  // Pilihan Lingkup Materi untuk modal tambah manual sesuai penugasan terpilih
  const modalScopeOptions = useMemo(() => {
    const asg = assignments.find((a) => a.id === remAssignmentId);
    if (!asg) return [];
    const custom = curriculumWorkspaceService.getLingkupMateriList(
      asg.subject_id,
      asg.class?.level || 4
    );
    const presets = curriculumWorkspaceService.getPresetLingkupMateriTemplates(
      asg.subject_id,
      asg.class?.level || 4
    );
    const merged = [...custom];
    presets.forEach((p) => {
      if (!merged.some((m) => m.scope_key === p.scope_key)) merged.push(p);
    });
    return merged;
  }, [assignments, remAssignmentId]);

  const assignmentScopedRemedials = useMemo(() => {
    return remedials.filter((r) => {
      if (assignmentFilter === '__active_class__') {
        const asg = r.assignment || assignments.find((a) => a.id === r.assignment_id);
        return Boolean(effectiveClassId && asg?.class_id === effectiveClassId);
      }
      if (assignmentFilter !== 'all' && r.assignment_id !== assignmentFilter) return false;
      return true;
    });
  }, [remedials, assignments, assignmentFilter, effectiveClassId]);

  const assignmentScopedEnrichments = useMemo(() => {
    return enrichments.filter((e) => {
      if (assignmentFilter === '__active_class__') {
        const asg = e.assignment || assignments.find((a) => a.id === e.assignment_id);
        return Boolean(effectiveClassId && asg?.class_id === effectiveClassId);
      }
      if (assignmentFilter !== 'all' && e.assignment_id !== assignmentFilter) return false;
      return true;
    });
  }, [enrichments, assignments, assignmentFilter, effectiveClassId]);

  // Daftar opsi filter Lingkup Materi dari data remedial mapel & kelas aktif
  const availableScopeFilters = useMemo(() => {
    const map = new Map<string, string>();
    assignmentScopedRemedials.forEach((r) => {
      if (r.scope_label) {
        map.set(r.scope_label, r.scope_label);
      } else if (r.scope_key) {
        map.set(r.scope_key, r.scope_key);
      }
    });
    return Array.from(map.values());
  }, [assignmentScopedRemedials]);

  const filteredRemedials = useMemo(() => {
    return assignmentScopedRemedials.filter((r) => {
      const label = r.scope_label || r.scope_key || '';
      if (scopeFilter !== 'all' && label !== scopeFilter) return false;

      const isEmpty = r.score_after === null || r.score_after === undefined;
      const kktp = Number(r.kktp || 75);
      if (statusFilter === 'pending' && !isEmpty) return false;
      if (statusFilter === 'passed' && (isEmpty || Number(r.score_after) < kktp)) return false;
      if (statusFilter === 'not_passed' && (isEmpty || Number(r.score_after) >= kktp)) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const name = (r.student?.full_name || '').toLowerCase();
        const nis = (r.student?.nis || '').toLowerCase();
        const obj = (r.unachieved_objective || '').toLowerCase();
        const sc = label.toLowerCase();
        if (!name.includes(q) && !nis.includes(q) && !obj.includes(q) && !sc.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [assignmentScopedRemedials, scopeFilter, statusFilter, searchTerm]);

  const remedialMetrics = useMemo(() => {
    const pending = assignmentScopedRemedials.filter(
      (r) => r.score_after === null || r.score_after === undefined
    ).length;
    const passed = assignmentScopedRemedials.filter(
      (r) => r.score_after !== null && r.score_after !== undefined && Number(r.score_after) >= Number(r.kktp || 75)
    ).length;
    const notPassed = assignmentScopedRemedials.length - pending - passed;
    return { total: assignmentScopedRemedials.length, pending, passed, notPassed };
  }, [assignmentScopedRemedials]);

  const dirtyIds = useMemo(() => {
    return assignmentScopedRemedials
      .filter((r) => {
        const currentScoreStr = r.score_after === null || r.score_after === undefined ? '' : String(r.score_after);
        const draftScoreStr = (draftScores[r.id] ?? '').trim();
        const currentAct = r.remedial_activity || '';
        const draftAct = draftActivities[r.id] ?? '';
        return currentScoreStr !== draftScoreStr || currentAct !== currentActDirtySafe(currentAct, draftAct);
      })
      .map((r) => r.id);
  }, [assignmentScopedRemedials, draftScores, draftActivities]);

  function currentActDirtySafe(a: string, b: string): string {
    return b === a ? a : b;
  }

  const handleSaveSingleRow = async (record: RemedialRecord) => {
    const rawScore = (draftScores[record.id] ?? '').trim();
    const parsedScore = rawScore === '' ? null : Math.min(100, Math.max(0, Number(rawScore)));
    if (rawScore !== '' && Number.isNaN(Number(rawScore))) {
      showNotice('Nilai remedial harus berupa angka 0–100.');
      return;
    }
    const nextActivity = (draftActivities[record.id] ?? record.remedial_activity).trim();

    await assessmentService.updateRemedialRecord(record.id, {
      score_after: parsedScore,
      remedial_activity: nextActivity || record.remedial_activity,
      execution_date: new Date().toISOString().split('T')[0],
    });
    showNotice(
      parsedScore === null
        ? `Catatan remedial ${record.student?.full_name || 'siswa'} diperbarui (nilai hasil remedial dikosongkan).`
        : `Nilai hasil remedial ${record.student?.full_name || 'siswa'} (${parsedScore}) berhasil disimpan.`
    );
    await loadData();
  };

  const handleSaveAllDrafts = async () => {
    if (dirtyIds.length === 0) return;
    setIsSavingBatch(true);
    try {
      let savedCount = 0;
      for (const id of dirtyIds) {
        const record = remedials.find((r) => r.id === id);
        if (!record) continue;
        const rawScore = (draftScores[id] ?? '').trim();
        if (rawScore !== '' && Number.isNaN(Number(rawScore))) continue;
        const parsedScore = rawScore === '' ? null : Math.min(100, Math.max(0, Number(rawScore)));
        const nextActivity = (draftActivities[id] ?? record.remedial_activity).trim();
        await assessmentService.updateRemedialRecord(id, {
          score_after: parsedScore,
          remedial_activity: nextActivity || record.remedial_activity,
          execution_date: new Date().toISOString().split('T')[0],
        });
        savedCount++;
      }
      showNotice(`${savedCount} baris nilai & kegiatan remedial berhasil disimpan.`);
      await loadData();
    } catch (err) {
      console.error('Gagal menyimpan batch remedial:', err);
    } finally {
      setIsSavingBatch(false);
    }
  };

  const handleDeleteRemedial = async () => {
    if (!confirmDeleteRem) return;
    await assessmentService.deleteRemedialRecord(confirmDeleteRem.id);
    setConfirmDeleteRem(null);
    showNotice('Catatan remedial dihapus.');
    await loadData();
  };

  const handleCreateRemedial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remAssignmentId || !remStudentId) return;
    const selectedScopeObj = modalScopeOptions.find((s) => s.scope_key === remScopeKey);
    const parsedScoreAfter = remScoreAfter.trim() === '' ? null : Math.min(100, Math.max(0, Number(remScoreAfter)));
    try {
      await assessmentService.createRemedialRecord({
        assignment_id: remAssignmentId,
        student_id: remStudentId,
        scope_key: remScopeKey || null,
        scope_label: selectedScopeObj ? `${selectedScopeObj.code}: ${selectedScopeObj.title}` : null,
        unachieved_objective: remObjective,
        remedial_activity: remActivity,
        execution_date: remDate,
        score_before: remScoreBefore,
        score_after: parsedScoreAfter,
        follow_up_action:
          remFollowup.trim() ||
          (parsedScoreAfter === null
            ? 'Belum Dinilai (Perlu Remedial)'
            : parsedScoreAfter >= 75
            ? 'Tuntas KKTP'
            : 'Belum Tuntas'),
        is_auto: false,
        kktp: 75,
      });
      setShowRemedialModal(false);
      showNotice('Catatan program remedial berhasil disimpan.');
      void loadData();
    } catch (err) {
      console.error('Gagal membuat remedial:', err);
    }
  };

  const handleCreateEnrichment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrAssignmentId || !enrStudentId) return;
    try {
      await assessmentService.createEnrichmentRecord({
        assignment_id: enrAssignmentId,
        student_id: enrStudentId,
        objective_topic: enrTopic,
        enrichment_activity: enrActivity,
        execution_date: enrDate,
        result_notes: enrNotes,
      });
      setShowEnrichmentModal(false);
      showNotice('Catatan program pengayaan berhasil disimpan.');
      void loadData();
    } catch (err) {
      console.error('Gagal membuat pengayaan:', err);
    }
  };

  const remModalStudents = getStudentsForAssignment(remAssignmentId, assignments, students, classMembers);
  const enrModalStudents = getStudentsForAssignment(enrAssignmentId, assignments, students, classMembers);

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Program Remedial & Pengayaan</h1>
            {(scopeContext?.subjectName || assignments[0]?.subject?.name) && (
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-bold">
                Mapel: {scopeContext?.subjectName || assignments[0]?.subject?.name}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Siswa dengan nilai asesmen di bawah KKTP otomatis masuk khusus pada mata pelajaran terkait beserta lingkup materinya dengan kolom nilai hasil remedial kosong untuk diisi guru.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'remedial' && dirtyIds.length > 0 && (
            <button
              onClick={handleSaveAllDrafts}
              disabled={isSavingBatch}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingBatch ? 'Menyimpan...' : `Simpan ${dirtyIds.length} Nilai Remedial`}</span>
            </button>
          )}
          {activeTab === 'remedial' ? (
            <button
              onClick={() => {
                setRemScopeKey('');
                setRemObjective('');
                setRemActivity('Pendampingan & evaluasi ulang lingkup materi');
                setRemScoreAfter('');
                setRemFollowup('');
                setShowRemedialModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Rekam Manual</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setEnrTopic('');
                setEnrActivity('');
                setEnrNotes('');
                setShowEnrichmentModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Rekam Pengayaan</span>
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Segmented Control Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('remedial')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'remedial'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-700" />
            <span>Program Remedial ({assignmentScopedRemedials.length})</span>
            {remedialMetrics.pending > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                {remedialMetrics.pending} Belum Dinilai
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('enrichment')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'enrichment'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Program Pengayaan ({assignmentScopedEnrichments.length})</span>
          </button>
        </div>

        {activeTab === 'remedial' && assignmentScopedRemedials.length > 0 && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
              Nilai Kosong: {remedialMetrics.pending}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold">
              Tuntas KKTP: {remedialMetrics.passed}
            </span>
            {remedialMetrics.notPassed > 0 && (
              <span className="px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-900 font-semibold">
                Belum Tuntas: {remedialMetrics.notPassed}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Konten Tab Remedial */}
      {activeTab === 'remedial' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari siswa atau lingkup materi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
              />
            </div>

            <select
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value)}
              className="text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-emerald-600"
            >
              {effectiveClassId && !effectiveAssignmentId && (
                <option value="__active_class__">
                  {scopeContext?.className || 'Kelas Terpilih'} — {scopeContext?.subjectName || 'Mapel Ini'}
                </option>
              )}
              <option value="all">
                {effectiveSubjectId
                  ? `Semua Kelas (${scopeContext?.subjectName || assignments[0]?.subject?.name || 'Mapel Ini'})`
                  : 'Semua Kelas & Mata Pelajaran'}
              </option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.class?.name || '-'} — {a.subject?.name || '-'}
                </option>
              ))}
            </select>

            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-emerald-600"
            >
              <option value="all">Semua Lingkup Materi</option>
              {availableScopeFilters.map((lbl) => (
                <option key={lbl} value={lbl}>
                  {lbl}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-emerald-600"
            >
              <option value="all">Semua Status Remedial</option>
              <option value="pending">Nilai Masih Kosong (Perlu Diisi)</option>
              <option value="passed">Sudah Tuntas KKTP</option>
              <option value="not_passed">Masih Di Bawah KKTP</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-4">Lingkup Materi & Tujuan Belum Tercapai</th>
                    <th className="py-3 px-4">Bentuk Kegiatan Remedial</th>
                    <th className="py-3 px-4 text-center">Nilai Awal</th>
                    <th className="py-3 px-4 text-center">Nilai Hasil Remedial</th>
                    <th className="py-3 px-4">Status & Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Menyinkronkan dan memuat data remedial...
                      </td>
                    </tr>
                  ) : filteredRemedials.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        Belum ada siswa yang memerlukan remedial. Saat guru mengisi nilai asesmen di bawah KKTP, siswa beserta lingkup materinya akan muncul otomatis di sini.
                      </td>
                    </tr>
                  ) : (
                    filteredRemedials.map((r) => {
                      const asg = r.assignment || assignments.find((a) => a.id === r.assignment_id);
                      const kktp = Number(r.kktp || 75);
                      const draftScoreStr = draftScores[r.id] ?? '';
                      const draftActStr = draftActivities[r.id] ?? r.remedial_activity;
                      const savedScoreStr =
                        r.score_after === null || r.score_after === undefined ? '' : String(r.score_after);
                      const isRowDirty =
                        draftScoreStr.trim() !== savedScoreStr || draftActStr !== (r.remedial_activity || '');

                      const hasDraftNumeric = draftScoreStr.trim() !== '' && !Number.isNaN(Number(draftScoreStr));
                      const previewScore = hasDraftNumeric ? Number(draftScoreStr) : r.score_after;
                      const isEmptyScore = previewScore === null || previewScore === undefined;
                      const isPassed = !isEmptyScore && Number(previewScore) >= kktp;

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900">{r.student?.full_name || 'Siswa'}</span>
                              {r.is_auto && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-bold">
                                  Otomatis
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                              NIS: {r.student?.nis || '-'}
                              {asg ? ` · ${asg.class?.name || ''} ${asg.subject?.name || ''}` : ''}
                            </div>
                          </td>

                          <td className="py-3 px-4 align-top max-w-xs">
                            {(r.scope_label || r.scope_key) && (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 mb-1 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold">
                                <BookOpen className="w-3 h-3 text-amber-700 shrink-0" />
                                <span>{r.scope_label || r.scope_key}</span>
                              </div>
                            )}
                            <p className="text-slate-800 font-medium leading-snug">{r.unachieved_objective}</p>
                          </td>

                          <td className="py-3 px-4 align-top min-w-[200px]">
                            <input
                              type="text"
                              value={draftActStr}
                              onChange={(e) =>
                                setDraftActivities((prev) => ({ ...prev, [r.id]: e.target.value }))
                              }
                              placeholder="Tulis bentuk remedial..."
                              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white text-slate-700"
                            />
                          </td>

                          <td className="py-3 px-4 text-center align-top">
                            <span className="inline-block font-mono tabular-nums text-rose-700 font-bold text-sm">
                              {r.score_before}
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono">KKTP {kktp}</div>
                          </td>

                          <td className="py-3 px-4 text-center align-top">
                            <div className="flex flex-col items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={draftScoreStr}
                                placeholder="Kosong"
                                onChange={(e) =>
                                  setDraftScores((prev) => ({ ...prev, [r.id]: e.target.value }))
                                }
                                className={`w-24 text-center font-mono tabular-nums font-bold text-sm py-1.5 px-2 rounded-lg border focus:outline-emerald-600 ${
                                  draftScoreStr.trim() === ''
                                    ? 'bg-amber-50/70 border-amber-300 text-amber-900 placeholder:text-amber-500 placeholder:font-normal placeholder:text-xs'
                                    : isPassed
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                    : 'bg-rose-50 border-rose-300 text-rose-800'
                                }`}
                              />
                              {draftScoreStr.trim() === '' && (
                                <span className="text-[10px] font-semibold text-amber-700">
                                  Isi nilai hasil
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 align-top">
                            <div className="flex flex-col gap-1.5">
                              {isEmptyScore ? (
                                <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Menunggu Nilai Remedial</span>
                                </span>
                              ) : isPassed ? (
                                <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                                  <span>{r.follow_up_action || 'Tuntas KKTP'}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                  <span>{r.follow_up_action || 'Belum Tuntas KKTP'}</span>
                                </span>
                              )}

                              <div className="flex items-center gap-1.5">
                                {isRowDirty && (
                                  <button
                                    type="button"
                                    onClick={() => void handleSaveSingleRow(r)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold transition-colors cursor-pointer"
                                  >
                                    <Save className="w-3 h-3" />
                                    <span>Simpan</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteRem(r)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                  title="Hapus baris remedial"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredRemedials.length > 0 && dirtyIds.length > 0 && (
              <div className="p-3 bg-amber-50/70 border-t border-amber-200 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-amber-950">
                  Ada <strong>{dirtyIds.length}</strong> perubahan nilai/kegiatan remedial yang belum disimpan.
                </span>
                <button
                  type="button"
                  onClick={handleSaveAllDrafts}
                  disabled={isSavingBatch}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg shadow-xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingBatch ? 'Menyimpan...' : 'Simpan Semua Nilai Remedial'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Konten Tab Pengayaan */}
      {activeTab === 'enrichment' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                  <th className="py-3 px-4">Nama Siswa Unggul</th>
                  <th className="py-3 px-4">Materi / Topik Pengayaan</th>
                  <th className="py-3 px-4">Bentuk Kegiatan Pendalaman</th>
                  <th className="py-3 px-4 text-center">Tanggal</th>
                  <th className="py-3 px-4">Catatan Kinerja & Karya</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Memuat data pengayaan...
                    </td>
                  </tr>
                ) : assignmentScopedEnrichments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Belum ada catatan pengayaan tersimpan untuk mata pelajaran ini.
                    </td>
                  </tr>
                ) : (
                  assignmentScopedEnrichments.map((e) => {
                    const asg = e.assignment || assignments.find((a) => a.id === e.assignment_id);
                    return (
                      <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{e.student?.full_name || 'Siswa'}</div>
                          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                            NIS: {e.student?.nis || '-'}
                            {asg ? ` · ${asg.class?.name || ''} ${asg.subject?.name || ''}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-900 font-bold">{e.objective_topic}</td>
                        <td className="py-3 px-4 text-slate-600">{e.enrichment_activity}</td>
                        <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-500">
                          {e.execution_date}
                        </td>
                        <td className="py-3 px-4 text-slate-800">{e.result_notes || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Remedial */}
      {confirmDeleteRem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Hapus Catatan Remedial?</h3>
            <p className="text-xs text-slate-600">
              Catatan remedial untuk <strong>{confirmDeleteRem.student?.full_name || 'Siswa'}</strong> pada{' '}
              <strong>{confirmDeleteRem.scope_label || confirmDeleteRem.unachieved_objective}</strong> akan dihapus.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteRem(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteRemedial}
                className="px-4 py-1.5 text-xs bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Remedial Manual */}
      {showRemedialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 mb-1">Catat Program Remedial Siswa</h3>
            <p className="text-xs text-slate-500 mb-4">
              Tambahkan intervensi remedial beserta lingkup materinya. Nilai sesudah remedial boleh dikosongkan dahulu untuk diisi kemudian.
            </p>

            <form onSubmit={handleCreateRemedial} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran & Kelas</label>
                <select
                  value={remAssignmentId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setRemAssignmentId(nextId);
                    const nextStds = getStudentsForAssignment(nextId, assignments, students, classMembers);
                    setRemStudentId(nextStds[0]?.id || '');
                  }}
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Siswa</label>
                <select
                  value={remStudentId}
                  onChange={(e) => setRemStudentId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  required
                >
                  {remModalStudents.length === 0 ? (
                    <option value="">Belum ada siswa terdaftar di rombel ini</option>
                  ) : (
                    remModalStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} (NIS: {s.nis})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Lingkup Materi</label>
                <select
                  value={remScopeKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    setRemScopeKey(key);
                    const found = modalScopeOptions.find((o) => o.scope_key === key);
                    if (found && !remObjective.trim()) {
                      setRemObjective(`${found.code}: ${found.title}`);
                    }
                  }}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                >
                  <option value="">Pilih Lingkup Materi (Opsional)</option>
                  {modalScopeOptions.map((o) => (
                    <option key={o.scope_key} value={o.scope_key}>
                      {o.code}: {o.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">TP / Materi yang Belum Tercapai</label>
                <input
                  type="text"
                  placeholder="Contoh: LM 1 — TP 4.1: Membedakan ide pokok dan ide pendukung"
                  value={remObjective}
                  onChange={(e) => setRemObjective(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bentuk Pembelajaran Remedial</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Pendampingan tutor sebaya dan latihan terbimbing..."
                  value={remActivity}
                  onChange={(e) => setRemActivity(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nilai Semula</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={remScoreBefore}
                    onChange={(e) => setRemScoreBefore(Number(e.target.value))}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nilai Sesudah (Opsional)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Kosongkan..."
                    value={remScoreAfter}
                    onChange={(e) => setRemScoreAfter(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={remDate}
                    onChange={(e) => setRemDate(e.target.value)}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tindak Lanjut / Status</label>
                <input
                  type="text"
                  placeholder="Otomatis menyesuaikan nilai hasil remedial..."
                  value={remFollowup}
                  onChange={(e) => setRemFollowup(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRemedialModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Rekam Remedial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Pengayaan */}
      {showEnrichmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Catat Program Pengayaan Siswa</h3>
            <p className="text-xs text-slate-500 mb-4">
              Dokumentasikan aktivitas eksplorasi tingkat lanjut bagi peserta didik yang melampaui KKTP.
            </p>

            <form onSubmit={handleCreateEnrichment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran & Kelas</label>
                <select
                  value={enrAssignmentId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setEnrAssignmentId(nextId);
                    const nextStds = getStudentsForAssignment(nextId, assignments, students, classMembers);
                    setEnrStudentId(nextStds[0]?.id || '');
                  }}
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Siswa Unggul</label>
                <select
                  value={enrStudentId}
                  onChange={(e) => setEnrStudentId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  required
                >
                  {enrModalStudents.length === 0 ? (
                    <option value="">Belum ada siswa terdaftar di rombel ini</option>
                  ) : (
                    enrModalStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} (NIS: {s.nis})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Topik Pendalaman</label>
                <input
                  type="text"
                  placeholder="Contoh: Menulis Cerita Fabel Bergambar untuk Mading Madrasah"
                  value={enrTopic}
                  onChange={(e) => setEnrTopic(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bentuk Aktivitas Pengayaan</label>
                <textarea
                  rows={2}
                  placeholder="Deskripsikan penugasan mandiri / riset sederhana / karya kolaboratif..."
                  value={enrActivity}
                  onChange={(e) => setEnrActivity(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Pelaksanaan</label>
                <input
                  type="date"
                  value={enrDate}
                  onChange={(e) => setEnrDate(e.target.value)}
                  className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hasil & Apresiasi Guru</label>
                <textarea
                  rows={2}
                  placeholder="Catatan prestasi, kualitas produk hasil belajar..."
                  value={enrNotes}
                  onChange={(e) => setEnrNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEnrichmentModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  Simpan Rekam Pengayaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
