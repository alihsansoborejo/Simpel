import { supabase, isSupabaseAvailable, reportSupabaseOutcome } from '../lib/supabaseClient';
import {
  Assessment,
  Grade,
  RemedialRecord,
  EnrichmentRecord,
} from '../types/database.types';
import {
  DEMO_ASSESSMENTS,
  DEMO_GRADES,
  DEMO_REMEDIAL,
  DEMO_ENRICHMENT,
} from '../lib/demoData';
import { academicService } from './academicService';
import { curriculumWorkspaceService } from './curriculumWorkspaceService';
import { reportService } from './reportService';
import { syncService } from './syncService';

const STORAGE_KEYS = {
  ASSESSMENTS: 'simpel_assessments',
  GRADES: 'simpel_grades',
  REMEDIAL: 'simpel_remedial',
  ENRICHMENT: 'simpel_enrichment',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v?: string | null) => typeof v === 'string' && UUID_REGEX.test(v);

function getLocal<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to store ${key}:`, err);
  }
}

function emitSyncEvent(keys: string[]): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('simpel:remote-sync', { detail: { keys } }));
  }
}

function getTimeMs(value?: string | null): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function stripLocalRemedialMeta(rec: RemedialRecord) {
  const {
    student: _s,
    assignment: _a,
    assessment_id: _aid,
    scope_key: _sk,
    scope_label: _sl,
    is_auto: _ia,
    kktp: _k,
    updated_at: _ua,
    ...dbPayload
  } = rec as RemedialRecord & { updated_at?: string };
  return dbPayload;
}

function resolveAssessmentScopeInfo(asm: Assessment): {
  scopeKey: string;
  scopeLabel: string;
  tps: string[];
} {
  const subjectId = asm.assignment?.subject_id || '';
  const classLevel = asm.assignment?.class?.level || 4;
  const rawKey = (asm.scope_key || '').trim();

  let effectiveKey = rawKey;
  if (!effectiveKey) {
    if (asm.assessment_type === 'Sumatif_Tengah_Semester') effectiveKey = 'STS';
    else if (asm.assessment_type === 'Sumatif_Akhir_Semester') effectiveKey = 'SAS';
  }

  if (effectiveKey && subjectId) {
    const customList = curriculumWorkspaceService.getLingkupMateriList(subjectId, classLevel);
    const presetList = curriculumWorkspaceService.getPresetLingkupMateriTemplates(subjectId, classLevel);
    const matched =
      customList.find((s) => s.scope_key === effectiveKey) ||
      presetList.find((s) => s.scope_key === effectiveKey);
    if (matched) {
      return {
        scopeKey: matched.scope_key,
        scopeLabel: `${matched.code}: ${matched.title}`,
        tps: matched.associated_tps || [],
      };
    }
  }

  if (effectiveKey) {
    return {
      scopeKey: effectiveKey,
      scopeLabel: `${effectiveKey} — ${asm.title}`,
      tps: [],
    };
  }

  const typeLabel = asm.assessment_type.replace(/_/g, ' ');
  return {
    scopeKey: `ASM_${asm.id}`,
    scopeLabel: `${typeLabel}: ${asm.title}`,
    tps: [],
  };
}

export interface LearningAnalysisResult {
  totalStudents: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passedCount: number;
  remedialCount: number;
  passRate: number;
  distribution: {
    excellent: number; // 90-100
    good: number;      // 80-89
    fair: number;      // 70-79
    needsHelp: number; // < 70
  };
  remedialCandidates: Array<{ studentId: string; studentName: string; score: number }>;
  enrichmentCandidates: Array<{ studentId: string; studentName: string; score: number }>;
}

export const assessmentService = {
  // === ASESMEN ===
  async getAssessments(assignmentId?: string): Promise<Assessment[]> {
    let baseItems = getLocal<Assessment[]>(STORAGE_KEYS.ASSESSMENTS, DEMO_ASSESSMENTS);
    const localMetaById = new Map(baseItems.map((a) => [a.id, a]));

    if (isSupabaseAvailable()) {
      try {
        const { data, error } = await supabase
          .from('assessments')
          .select('*, assignment:teaching_assignments(*, teacher:teachers(*), class:classes(*), subject:subjects(*))')
          .order('assessment_date', { ascending: false });

        reportSupabaseOutcome(error);
        if (!error && Array.isArray(data) && data.length > 0) {
          const mergedMap = new Map<string, Assessment>();
          let changedFromRemote = false;
          for (const localItem of baseItems) {
            mergedMap.set(localItem.id, localItem);
          }
          for (const item of data as Assessment[]) {
            const localMeta = mergedMap.get(item.id) || localMetaById.get(item.id);
            if (!localMeta) {
              mergedMap.set(item.id, {
                ...item,
                scope_key: item.scope_key ?? null,
              });
              changedFromRemote = true;
            } else {
              const remoteMs = getTimeMs(item.updated_at || item.created_at);
              const localMs = getTimeMs(localMeta.updated_at || localMeta.created_at);
              if (remoteMs > localMs) {
                mergedMap.set(item.id, {
                  ...item,
                  scope_key: item.scope_key ?? localMeta.scope_key ?? null,
                });
                changedFromRemote = true;
              }
            }
          }
          baseItems = Array.from(mergedMap.values());
          if (changedFromRemote) {
            syncService.setLocalCacheSilently(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(baseItems));
          }
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase getAssessments fallback:', err);
      }
    }

    const assignments = await academicService.getTeachingAssignments();
    let hydrated = baseItems.map((a) => ({
      ...a,
      assignment: assignments.find((asg) => asg.id === a.assignment_id) || a.assignment,
    }));

    if (assignmentId) hydrated = hydrated.filter((a) => a.assignment_id === assignmentId);
    return hydrated.sort((a, b) => b.assessment_date.localeCompare(a.assessment_date));
  },

  async createAssessment(payload: Omit<Assessment, 'id' | 'created_at'>): Promise<Assessment> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `asm-${Date.now()}`;
    const assignments = await academicService.getTeachingAssignments();
    const matchedAssignment = assignments.find((a) => a.id === payload.assignment_id);
    const now = new Date().toISOString();

    let newAsm: Assessment = {
      ...payload,
      id,
      assignment: matchedAssignment,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseAvailable() && isUuid(id) && isUuid(payload.assignment_id)) {
      try {
        const { assignment: _a, ...dbAsm } = newAsm;
        let { data, error } = await supabase.from('assessments').insert(dbAsm).select().single();
        if (
          error &&
          (error.code === 'PGRST204' ||
            String(error.message || '').includes('scope_key') ||
            String(error.message || '').includes('updated_at'))
        ) {
          const { scope_key: _sk, updated_at: _ua, ...legacyDbAsm } = dbAsm;
          ({ data, error } = await supabase.from('assessments').insert(legacyDbAsm).select().single());
        }
        reportSupabaseOutcome(error);
        if (!error && data) {
          newAsm = {
            ...(data as Assessment),
            scope_key: (data as Assessment).scope_key ?? payload.scope_key ?? null,
            updated_at: (data as Assessment).updated_at ?? now,
            assignment: matchedAssignment,
          };
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase createAssessment fallback:', err);
      }
    }

    const items = getLocal<Assessment[]>(STORAGE_KEYS.ASSESSMENTS, DEMO_ASSESSMENTS);
    const updated = [newAsm, ...items.filter((a) => a.id !== newAsm.id)];
    setLocal(STORAGE_KEYS.ASSESSMENTS, updated);
    emitSyncEvent([STORAGE_KEYS.ASSESSMENTS]);
    return newAsm;
  },

  async updateAssessment(
    id: string,
    patch: Partial<Pick<Assessment, 'title' | 'assessment_type' | 'assessment_date' | 'kktp' | 'assignment_id' | 'scope_key'>>
  ): Promise<Assessment | null> {
    const items = getLocal<Assessment[]>(STORAGE_KEYS.ASSESSMENTS, DEMO_ASSESSMENTS);
    const existing = items.find((a) => a.id === id);
    if (!existing) return null;

    const assignments = await academicService.getTeachingAssignments();
    const nextAssignmentId = patch.assignment_id || existing.assignment_id;
    const matchedAssignment = assignments.find((a) => a.id === nextAssignmentId);
    const now = new Date().toISOString();

    const updatedRecord: Assessment = {
      ...existing,
      ...patch,
      assignment_id: nextAssignmentId,
      assignment: matchedAssignment || existing.assignment,
      updated_at: now,
    };

    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const dbPatch: Record<string, unknown> = {
          updated_at: now,
        };
        if (patch.title !== undefined) dbPatch.title = patch.title;
        if (patch.assessment_type !== undefined) dbPatch.assessment_type = patch.assessment_type;
        if (patch.assessment_date !== undefined) dbPatch.assessment_date = patch.assessment_date;
        if (patch.kktp !== undefined) dbPatch.kktp = patch.kktp;
        if (patch.assignment_id !== undefined && isUuid(patch.assignment_id)) {
          dbPatch.assignment_id = patch.assignment_id;
        }
        if (patch.scope_key !== undefined) {
          dbPatch.scope_key = patch.scope_key;
        }
        if (Object.keys(dbPatch).length > 0) {
          let { error } = await supabase.from('assessments').update(dbPatch).eq('id', id);
          if (
            error &&
            (error.code === 'PGRST204' ||
              String(error.message || '').includes('scope_key') ||
              String(error.message || '').includes('updated_at'))
          ) {
            const { scope_key: _sk, updated_at: _ua, ...legacyPatch } = dbPatch;
            if (Object.keys(legacyPatch).length > 0) {
              ({ error } = await supabase.from('assessments').update(legacyPatch).eq('id', id));
            } else {
              error = null;
            }
          }
          reportSupabaseOutcome(error);
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase updateAssessment fallback:', err);
      }
    }

    const updatedItems = items.map((a) => (a.id === id ? updatedRecord : a));
    setLocal(STORAGE_KEYS.ASSESSMENTS, updatedItems);
    await this.syncAutoRemedialsForAssessment(id);
    await reportService.syncAssessmentToLedger(id);
    emitSyncEvent([STORAGE_KEYS.ASSESSMENTS, STORAGE_KEYS.REMEDIAL, 'simpel_subject_ledger_v1']);
    return updatedRecord;
  },

  async deleteAssessment(id: string): Promise<void> {
    const itemsBefore = getLocal<Assessment[]>(STORAGE_KEYS.ASSESSMENTS, DEMO_ASSESSMENTS);
    const deletedAsm = itemsBefore.find((a) => a.id === id);

    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const { error: grdErr } = await supabase.from('grades').delete().eq('assessment_id', id);
        const { error: asmErr } = await supabase.from('assessments').delete().eq('id', id);
        reportSupabaseOutcome(grdErr || asmErr);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase deleteAssessment fallback:', err);
      }
    }

    setLocal(
      STORAGE_KEYS.ASSESSMENTS,
      itemsBefore.filter((a) => a.id !== id)
    );

    const grades = getLocal<Grade[]>(STORAGE_KEYS.GRADES, DEMO_GRADES);
    setLocal(
      STORAGE_KEYS.GRADES,
      grades.filter((g) => g.assessment_id !== id)
    );

    // Bersihkan antrean remedial otomatis yang masih kosong untuk asesmen yang dihapus
    const remedials = getLocal<RemedialRecord[]>(STORAGE_KEYS.REMEDIAL, DEMO_REMEDIAL);
    setLocal(
      STORAGE_KEYS.REMEDIAL,
      remedials.filter((r) => !(r.assessment_id === id && r.is_auto && r.score_after === null))
    );

    if (deletedAsm?.assignment_id) {
      const assignments = await academicService.getTeachingAssignments();
      const asg = assignments.find((a) => a.id === deletedAsm.assignment_id);
      if (asg?.class_id && asg?.subject_id) {
        await reportService.syncFromAssessmentsForSubject(asg.class_id, asg.subject_id, {
          forceOverwrite: false,
        });
      }
    }
    emitSyncEvent([STORAGE_KEYS.ASSESSMENTS, STORAGE_KEYS.GRADES, STORAGE_KEYS.REMEDIAL, 'simpel_subject_ledger_v1']);
  },

  // === NILAI (GRADES) ===
  async getGrades(assessmentId: string): Promise<Grade[]> {
    let baseGrades = getLocal<Grade[]>(STORAGE_KEYS.GRADES, DEMO_GRADES);

    if (isSupabaseAvailable() && isUuid(assessmentId)) {
      try {
        const { data, error } = await supabase
          .from('grades')
          .select('*, student:students(*)')
          .eq('assessment_id', assessmentId);

        reportSupabaseOutcome(error);
        if (!error && Array.isArray(data) && data.length > 0) {
          const mergedMap = new Map<string, Grade>();
          let changedFromRemote = false;
          for (const g of baseGrades) {
            mergedMap.set(`${g.assessment_id}_${g.student_id}`, g);
          }
          for (const item of data as Grade[]) {
            const key = `${item.assessment_id}_${item.student_id}`;
            const existing = mergedMap.get(key);
            if (!existing) {
              mergedMap.set(key, item);
              changedFromRemote = true;
            } else {
              const remoteMs = getTimeMs(item.updated_at || item.created_at);
              const localMs = getTimeMs(existing.updated_at || existing.created_at);
              if (remoteMs > localMs) {
                mergedMap.set(key, item);
                changedFromRemote = true;
              }
            }
          }
          baseGrades = Array.from(mergedMap.values());
          if (changedFromRemote) {
            syncService.setLocalCacheSilently(STORAGE_KEYS.GRADES, JSON.stringify(baseGrades));
          }
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase getGrades fallback:', err);
      }
    }

    const students = await academicService.getStudents();
    const filtered = baseGrades.filter((g) => g.assessment_id === assessmentId);

    return filtered.map((g) => ({
      ...g,
      student: students.find((s) => s.id === g.student_id) || g.student,
    }));
  },

  async saveGrades(
    assessmentId: string,
    entries: Array<{ studentId: string; score: number; feedback?: string | null }>
  ): Promise<Grade[]> {
    const all = getLocal<Grade[]>(STORAGE_KEYS.GRADES, DEMO_GRADES);
    const students = await academicService.getStudents();
    const updatedGrades: Grade[] = [];
    const now = new Date().toISOString();

    for (const item of entries) {
      const existingIdx = all.findIndex(
        (g) => g.assessment_id === assessmentId && g.student_id === item.studentId
      );

      const record: Grade = {
        id:
          existingIdx >= 0
            ? all[existingIdx].id
            : typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `grd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        assessment_id: assessmentId,
        student_id: item.studentId,
        score: Math.min(100, Math.max(0, item.score)),
        feedback: item.feedback || null,
        created_at: existingIdx >= 0 ? all[existingIdx].created_at : now,
        updated_at: now,
        student: students.find((s) => s.id === item.studentId),
      };

      if (existingIdx >= 0) {
        all[existingIdx] = record;
      } else {
        all.push(record);
      }
      updatedGrades.push(record);
    }

    if (isSupabaseAvailable() && isUuid(assessmentId)) {
      const syncable = updatedGrades.filter((g) => isUuid(g.id) && isUuid(g.student_id));
      if (syncable.length > 0) {
        try {
          const { error } = await supabase.from('grades').upsert(
            syncable.map((g) => ({
              id: g.id,
              assessment_id: g.assessment_id,
              student_id: g.student_id,
              score: g.score,
              feedback: g.feedback,
              updated_at: g.updated_at,
            })),
            { onConflict: 'assessment_id,student_id' }
          );
          reportSupabaseOutcome(error);
        } catch (err) {
          reportSupabaseOutcome(err);
          console.warn('Supabase saveGrades fallback:', err);
        }
      }
    }

    setLocal(STORAGE_KEYS.GRADES, all);
    // Sinkronkan siswa di bawah KKTP secara otomatis ke kolom Remedial (dengan nilai hasil remedial masih kosong)
    await this.syncAutoRemedialsForAssessment(assessmentId);
    // Teruskan otomatis ke Leger Nilai Rapor untuk semua asesmen Formatif & Sumatif
    await reportService.syncAssessmentToLedger(assessmentId);
    emitSyncEvent([STORAGE_KEYS.GRADES, STORAGE_KEYS.REMEDIAL, 'simpel_subject_ledger_v1']);
    void syncService.flushMutations();
    return updatedGrades;
  },

  // === SINKRONISASI REMEDIAL OTOMATIS ===
  async syncAutoRemedialsForAssessment(assessmentId: string): Promise<number> {
    const assessments = await this.getAssessments();
    const asm = assessments.find((a) => a.id === assessmentId);
    if (!asm) return 0;

    const grades = await this.getGrades(assessmentId);
    if (grades.length === 0) return 0;

    const kktp = Number(asm.kktp || 75);
    const scopeInfo = resolveAssessmentScopeInfo(asm);
    const objectiveText = `${scopeInfo.scopeLabel}${scopeInfo.tps.length > 0 ? ` (${scopeInfo.tps.join(', ')})` : ''} — ${asm.title}`;

    const currentRemedials = getLocal<RemedialRecord[]>(STORAGE_KEYS.REMEDIAL, DEMO_REMEDIAL);
    let nextRemedials = [...currentRemedials];
    let addedCount = 0;
    let changed = false;

    for (const grade of grades) {
      const score = Number(grade.score);
      const existingIdx = nextRemedials.findIndex(
        (r) => r.assessment_id === asm.id && r.student_id === grade.student_id
      );

      if (score < kktp) {
        if (existingIdx >= 0) {
          const existing = nextRemedials[existingIdx];
          if (
            existing.score_before !== score ||
            existing.scope_label !== scopeInfo.scopeLabel ||
            existing.kktp !== kktp
          ) {
            nextRemedials[existingIdx] = {
              ...existing,
              score_before: score,
              scope_key: scopeInfo.scopeKey,
              scope_label: scopeInfo.scopeLabel,
              unachieved_objective: existing.is_auto ? objectiveText : existing.unachieved_objective,
              kktp,
            };
            changed = true;
          }
        } else {
          const id =
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          nextRemedials.unshift({
            id,
            assignment_id: asm.assignment_id,
            student_id: grade.student_id,
            assessment_id: asm.id,
            scope_key: scopeInfo.scopeKey,
            scope_label: scopeInfo.scopeLabel,
            unachieved_objective: objectiveText,
            remedial_activity: 'Pendampingan & evaluasi ulang lingkup materi',
            execution_date: asm.assessment_date || new Date().toISOString().split('T')[0],
            score_before: score,
            score_after: null,
            follow_up_action: 'Belum Dinilai (Perlu Remedial)',
            is_auto: true,
            kktp,
            created_at: new Date().toISOString(),
          });
          addedCount++;
          changed = true;
        }
      } else if (existingIdx >= 0) {
        // Jika nilai asesmen awal diperbaiki menjadi >= KKTP sebelum nilai remedial diisi, bersihkan dari daftar perlu remedial
        const existing = nextRemedials[existingIdx];
        if (existing.is_auto && (existing.score_after === null || existing.score_after === undefined)) {
          nextRemedials.splice(existingIdx, 1);
          changed = true;
        }
      }
    }

    if (changed) {
      setLocal(STORAGE_KEYS.REMEDIAL, nextRemedials);
    }
    return addedCount;
  },

  async syncAllAutoRemedials(): Promise<number> {
    const assessments = await this.getAssessments();
    if (assessments.length === 0) return 0;

    let allGrades = getLocal<Grade[]>(STORAGE_KEYS.GRADES, DEMO_GRADES);
    if (isSupabaseAvailable()) {
      try {
        const { data, error } = await supabase.from('grades').select('*');
        reportSupabaseOutcome(error);
        if (!error && Array.isArray(data) && data.length > 0) {
          const mergedMap = new Map<string, Grade>();
          for (const g of allGrades) {
            mergedMap.set(`${g.assessment_id}_${g.student_id}`, g);
          }
          for (const item of data as Grade[]) {
            const key = `${item.assessment_id}_${item.student_id}`;
            const existing = mergedMap.get(key);
            if (!existing) {
              mergedMap.set(key, item);
            } else {
              const remoteMs = getTimeMs(item.updated_at || item.created_at);
              const localMs = getTimeMs(existing.updated_at || existing.created_at);
              if (remoteMs >= localMs) {
                mergedMap.set(key, item);
              }
            }
          }
          allGrades = Array.from(mergedMap.values());
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase batch syncAllAutoRemedials grades fallback:', err);
      }
    }

    const gradesByAsm = new Map<string, Grade[]>();
    for (const g of allGrades) {
      const list = gradesByAsm.get(g.assessment_id);
      if (list) list.push(g);
      else gradesByAsm.set(g.assessment_id, [g]);
    }

    const nextRemedials = [...getLocal<RemedialRecord[]>(STORAGE_KEYS.REMEDIAL, DEMO_REMEDIAL)];
    const indexByKey = new Map<string, number>();
    nextRemedials.forEach((r, idx) => {
      if (r.assessment_id) {
        indexByKey.set(`${r.assessment_id}__${r.student_id}`, idx);
      }
    });

    let addedCount = 0;
    let changed = false;

    for (const asm of assessments) {
      const grades = gradesByAsm.get(asm.id);
      if (!grades || grades.length === 0) continue;

      const kktp = Number(asm.kktp || 75);
      const scopeInfo = resolveAssessmentScopeInfo(asm);
      const objectiveText = `${scopeInfo.scopeLabel}${scopeInfo.tps.length > 0 ? ` (${scopeInfo.tps.join(', ')})` : ''} — ${asm.title}`;

      for (const grade of grades) {
        const score = Number(grade.score);
        const mapKey = `${asm.id}__${grade.student_id}`;
        const existingIdx = indexByKey.get(mapKey) ?? -1;

        if (score < kktp) {
          if (existingIdx >= 0 && nextRemedials[existingIdx]) {
            const existing = nextRemedials[existingIdx];
            if (
              existing.score_before !== score ||
              existing.scope_label !== scopeInfo.scopeLabel ||
              existing.kktp !== kktp
            ) {
              nextRemedials[existingIdx] = {
                ...existing,
                score_before: score,
                scope_key: scopeInfo.scopeKey,
                scope_label: scopeInfo.scopeLabel,
                unachieved_objective: existing.is_auto ? objectiveText : existing.unachieved_objective,
                kktp,
              };
              changed = true;
            }
          } else {
            const id =
              typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const newRec: RemedialRecord = {
              id,
              assignment_id: asm.assignment_id,
              student_id: grade.student_id,
              assessment_id: asm.id,
              scope_key: scopeInfo.scopeKey,
              scope_label: scopeInfo.scopeLabel,
              unachieved_objective: objectiveText,
              remedial_activity: 'Pendampingan & evaluasi ulang lingkup materi',
              execution_date: asm.assessment_date || new Date().toISOString().split('T')[0],
              score_before: score,
              score_after: null,
              follow_up_action: 'Belum Dinilai (Perlu Remedial)',
              is_auto: true,
              kktp,
              created_at: new Date().toISOString(),
            };
            nextRemedials.unshift(newRec);
            // Rebuild map indices since unshift shifts indices
            indexByKey.clear();
            nextRemedials.forEach((r, idx) => {
              if (r.assessment_id) indexByKey.set(`${r.assessment_id}__${r.student_id}`, idx);
            });
            addedCount++;
            changed = true;
          }
        } else if (existingIdx >= 0 && nextRemedials[existingIdx]) {
          const existing = nextRemedials[existingIdx];
          if (existing.is_auto && (existing.score_after === null || existing.score_after === undefined)) {
            nextRemedials.splice(existingIdx, 1);
            indexByKey.clear();
            nextRemedials.forEach((r, idx) => {
              if (r.assessment_id) indexByKey.set(`${r.assessment_id}__${r.student_id}`, idx);
            });
            changed = true;
          }
        }
      }
    }

    if (changed) {
      setLocal(STORAGE_KEYS.REMEDIAL, nextRemedials);
    }
    return addedCount;
  },

  // === REMEDIAL ===
  async getRemedialRecords(assignmentId?: string): Promise<RemedialRecord[]> {
    let baseItems = getLocal<RemedialRecord[]>(STORAGE_KEYS.REMEDIAL, DEMO_REMEDIAL);

    if (isSupabaseAvailable()) {
      try {
        const { data, error } = await supabase
          .from('remedial_records')
          .select('*, student:students(*), assignment:teaching_assignments(*)')
          .order('execution_date', { ascending: false });

        reportSupabaseOutcome(error);
        if (!error && Array.isArray(data) && data.length > 0) {
          const mergedMap = new Map<string, RemedialRecord>();
          for (const r of baseItems) {
            mergedMap.set(r.id, r);
          }
          for (const item of data as RemedialRecord[]) {
            const existing = mergedMap.get(item.id);
            if (!existing) {
              mergedMap.set(item.id, item);
            } else {
              const remoteMs = getTimeMs((item as any).updated_at || item.created_at);
              const localMs = getTimeMs((existing as any).updated_at || existing.created_at);
              if (remoteMs > localMs || (item.score_after !== null && existing.score_after === null)) {
                mergedMap.set(item.id, {
                  ...existing,
                  ...item,
                  assessment_id: item.assessment_id ?? existing.assessment_id,
                  scope_key: item.scope_key ?? existing.scope_key,
                  scope_label: item.scope_label ?? existing.scope_label,
                  is_auto: item.is_auto ?? existing.is_auto,
                  kktp: item.kktp ?? existing.kktp,
                });
              }
            }
          }
          baseItems = Array.from(mergedMap.values());
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase getRemedialRecords fallback:', err);
      }
    }

    const [students, assignments] = await Promise.all([
      academicService.getStudents(),
      academicService.getTeachingAssignments(),
    ]);

    let items = baseItems.map((r) => ({
      ...r,
      score_after: r.score_after === undefined ? null : r.score_after,
      student: students.find((s) => s.id === r.student_id) || r.student,
      assignment: assignments.find((a) => a.id === r.assignment_id) || r.assignment,
    }));

    if (assignmentId) items = items.filter((r) => r.assignment_id === assignmentId);
    return items.sort((a, b) => b.execution_date.localeCompare(a.execution_date));
  },

  async createRemedialRecord(payload: Omit<RemedialRecord, 'id' | 'created_at'>): Promise<RemedialRecord> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rem-${Date.now()}`;
    const [students, assignments] = await Promise.all([
      academicService.getStudents(),
      academicService.getTeachingAssignments(),
    ]);

    let newRecord: RemedialRecord = {
      ...payload,
      id,
      created_at: new Date().toISOString(),
      student: students.find((s) => s.id === payload.student_id),
      assignment: assignments.find((a) => a.id === payload.assignment_id),
    };

    if (
      isSupabaseAvailable() &&
      newRecord.score_after !== null &&
      isUuid(id) &&
      isUuid(payload.assignment_id) &&
      isUuid(payload.student_id)
    ) {
      try {
        const dbPayload = stripLocalRemedialMeta(newRecord);
        const { data, error } = await supabase.from('remedial_records').insert(dbPayload).select().single();
        reportSupabaseOutcome(error);
        if (!error && data) {
          newRecord = {
            ...(data as RemedialRecord),
            scope_key: newRecord.scope_key ?? null,
            scope_label: newRecord.scope_label ?? null,
            assessment_id: newRecord.assessment_id ?? null,
            is_auto: newRecord.is_auto ?? false,
            kktp: newRecord.kktp ?? null,
            student: newRecord.student,
            assignment: newRecord.assignment,
          };
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase createRemedialRecord fallback:', err);
      }
    }

    const current = getLocal<RemedialRecord[]>(STORAGE_KEYS.REMEDIAL, DEMO_REMEDIAL);
    const updated = [newRecord, ...current.filter((r) => r.id !== newRecord.id)];
    setLocal(STORAGE_KEYS.REMEDIAL, updated);
    return newRecord;
  },

  async updateRemedialRecord(
    id: string,
    patch: Partial<Pick<RemedialRecord, 'score_after' | 'remedial_activity' | 'execution_date' | 'follow_up_action' | 'unachieved_objective'>>
  ): Promise<RemedialRecord | null> {
    const current = getLocal<RemedialRecord[]>(STORAGE_KEYS.REMEDIAL, DEMO_REMEDIAL);
    const existing = current.find((r) => r.id === id);
    if (!existing) return null;

    const kktpThreshold = Number(existing.kktp || 75);
    const nextScoreAfter =
      patch.score_after === undefined
        ? existing.score_after
        : patch.score_after === null
        ? null
        : Math.min(100, Math.max(0, Number(patch.score_after)));

    let nextFollowUp = patch.follow_up_action !== undefined ? patch.follow_up_action : existing.follow_up_action;
    if (patch.score_after !== undefined && patch.follow_up_action === undefined) {
      if (nextScoreAfter === null) {
        nextFollowUp = 'Belum Dinilai (Perlu Remedial)';
      } else if (nextScoreAfter >= kktpThreshold) {
        nextFollowUp = 'Tuntas KKTP';
      } else {
        nextFollowUp = 'Belum Tuntas (Perlu Bimbingan Lanjut)';
      }
    }

    const updatedRecord: RemedialRecord & { updated_at?: string } = {
      ...existing,
      ...patch,
      score_after: nextScoreAfter,
      follow_up_action: nextFollowUp,
      updated_at: new Date().toISOString(),
    };

    if (
      isSupabaseAvailable() &&
      updatedRecord.score_after !== null &&
      isUuid(id) &&
      isUuid(updatedRecord.assignment_id) &&
      isUuid(updatedRecord.student_id)
    ) {
      try {
        const dbPayload = stripLocalRemedialMeta(updatedRecord);
        const { error } = await supabase.from('remedial_records').upsert(dbPayload, { onConflict: 'id' });
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase updateRemedialRecord fallback:', err);
      }
    }

    const nextList = current.map((r) => (r.id === id ? updatedRecord : r));
    setLocal(STORAGE_KEYS.REMEDIAL, nextList);
    if (patch.score_after !== undefined) {
      if (updatedRecord.assessment_id) {
        await reportService.syncAssessmentToLedger(updatedRecord.assessment_id);
      } else if (updatedRecord.assignment_id) {
        const assignments = await academicService.getTeachingAssignments();
        const asg = assignments.find((a) => a.id === updatedRecord.assignment_id);
        if (asg?.class_id && asg?.subject_id) {
          await reportService.syncFromAssessmentsForSubject(asg.class_id, asg.subject_id, {
            forceOverwrite: false,
          });
        }
      }
    }
    emitSyncEvent([STORAGE_KEYS.REMEDIAL, 'simpel_subject_ledger_v1']);
    return updatedRecord;
  },

  async deleteRemedialRecord(id: string): Promise<void> {
    const current = getLocal<RemedialRecord[]>(STORAGE_KEYS.REMEDIAL, DEMO_REMEDIAL);
    const targetRec = current.find((r) => r.id === id);

    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const { error } = await supabase.from('remedial_records').delete().eq('id', id);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase deleteRemedialRecord fallback:', err);
      }
    }
    setLocal(
      STORAGE_KEYS.REMEDIAL,
      current.filter((r) => r.id !== id)
    );
    if (targetRec?.assessment_id) {
      await reportService.syncAssessmentToLedger(targetRec.assessment_id);
    }
    emitSyncEvent([STORAGE_KEYS.REMEDIAL, 'simpel_subject_ledger_v1']);
  },

  // === PENGAYAAN ===
  async getEnrichmentRecords(assignmentId?: string): Promise<EnrichmentRecord[]> {
    let baseItems = getLocal<EnrichmentRecord[]>(STORAGE_KEYS.ENRICHMENT, DEMO_ENRICHMENT);

    if (isSupabaseAvailable()) {
      try {
        const { data, error } = await supabase
          .from('enrichment_records')
          .select('*, student:students(*), assignment:teaching_assignments(*)')
          .order('execution_date', { ascending: false });

        reportSupabaseOutcome(error);
        if (!error && Array.isArray(data) && data.length > 0) {
          const seen = new Set(baseItems.map((e) => e.id));
          const merged = [...baseItems];
          for (const item of data as EnrichmentRecord[]) {
            if (!seen.has(item.id)) {
              merged.push(item);
              seen.add(item.id);
            }
          }
          baseItems = merged;
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase getEnrichmentRecords fallback:', err);
      }
    }

    const [students, assignments] = await Promise.all([
      academicService.getStudents(),
      academicService.getTeachingAssignments(),
    ]);

    let items = baseItems.map((e) => ({
      ...e,
      student: students.find((s) => s.id === e.student_id) || e.student,
      assignment: assignments.find((a) => a.id === e.assignment_id) || e.assignment,
    }));

    if (assignmentId) items = items.filter((e) => e.assignment_id === assignmentId);
    return items.sort((a, b) => b.execution_date.localeCompare(a.execution_date));
  },

  async createEnrichmentRecord(payload: Omit<EnrichmentRecord, 'id' | 'created_at'>): Promise<EnrichmentRecord> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `enr-${Date.now()}`;
    const [students, assignments] = await Promise.all([
      academicService.getStudents(),
      academicService.getTeachingAssignments(),
    ]);

    let newRecord: EnrichmentRecord = {
      ...payload,
      id,
      created_at: new Date().toISOString(),
      student: students.find((s) => s.id === payload.student_id),
      assignment: assignments.find((a) => a.id === payload.assignment_id),
    };

    if (isSupabaseAvailable() && isUuid(id) && isUuid(payload.assignment_id) && isUuid(payload.student_id)) {
      try {
        const { student: _s, assignment: _a, ...dbPayload } = newRecord;
        const { data, error } = await supabase.from('enrichment_records').insert(dbPayload).select().single();
        reportSupabaseOutcome(error);
        if (!error && data) {
          newRecord = {
            ...(data as EnrichmentRecord),
            student: newRecord.student,
            assignment: newRecord.assignment,
          };
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase createEnrichmentRecord fallback:', err);
      }
    }

    const current = getLocal<EnrichmentRecord[]>(STORAGE_KEYS.ENRICHMENT, DEMO_ENRICHMENT);
    const updated = [newRecord, ...current.filter((e) => e.id !== newRecord.id)];
    setLocal(STORAGE_KEYS.ENRICHMENT, updated);
    return newRecord;
  },

  // === ANALISIS HASIL BELAJAR RIIL ===
  async getLearningAnalysis(assessmentId: string, kktpThreshold = 75): Promise<LearningAnalysisResult> {
    const grades = await this.getGrades(assessmentId);
    const totalStudents = grades.length;

    if (totalStudents === 0) {
      return {
        totalStudents: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        passedCount: 0,
        remedialCount: 0,
        passRate: 0,
        distribution: { excellent: 0, good: 0, fair: 0, needsHelp: 0 },
        remedialCandidates: [],
        enrichmentCandidates: [],
      };
    }

    const scores = grades.map((g) => Number(g.score));
    const sum = scores.reduce((acc, curr) => acc + curr, 0);
    const averageScore = Math.round((sum / totalStudents) * 10) / 10;
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);

    const passedList = grades.filter((g) => Number(g.score) >= kktpThreshold);
    const remedialList = grades.filter((g) => Number(g.score) < kktpThreshold);

    const passedCount = passedList.length;
    const remedialCount = remedialList.length;
    const passRate = Math.round((passedCount / totalStudents) * 100);

    const distribution = {
      excellent: scores.filter((s) => s >= 90).length,
      good: scores.filter((s) => s >= 80 && s < 90).length,
      fair: scores.filter((s) => s >= 70 && s < 80).length,
      needsHelp: scores.filter((s) => s < 70).length,
    };

    const remedialCandidates = remedialList.map((g) => ({
      studentId: g.student_id,
      studentName: g.student?.full_name || 'Siswa',
      score: Number(g.score),
    }));

    const enrichmentCandidates = passedList
      .filter((g) => Number(g.score) >= 88)
      .map((g) => ({
        studentId: g.student_id,
        studentName: g.student?.full_name || 'Siswa',
        score: Number(g.score),
      }));

    return {
      totalStudents,
      averageScore,
      highestScore,
      lowestScore,
      passedCount,
      remedialCount,
      passRate,
      distribution,
      remedialCandidates,
      enrichmentCandidates,
    };
  },
};
