import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
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

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('assessments')
          .select('*, assignment:teaching_assignments(*, teacher:teachers(*), class:classes(*), subject:subjects(*))')
          .order('assessment_date', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const seen = new Set(baseItems.map((a) => a.id));
          const merged = [...baseItems];
          for (const item of data as Assessment[]) {
            if (!seen.has(item.id)) {
              merged.push(item);
              seen.add(item.id);
            }
          }
          baseItems = merged;
        }
      } catch (err) {
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

    let newAsm: Assessment = {
      ...payload,
      id,
      assignment: matchedAssignment,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && isUuid(id) && isUuid(payload.assignment_id)) {
      try {
        const { assignment: _a, ...dbAsm } = newAsm;
        const { data } = await supabase.from('assessments').insert(dbAsm).select().single();
        if (data) {
          newAsm = { ...(data as Assessment), assignment: matchedAssignment };
        }
      } catch (err) {
        console.warn('Supabase createAssessment fallback:', err);
      }
    }

    const items = getLocal<Assessment[]>(STORAGE_KEYS.ASSESSMENTS, DEMO_ASSESSMENTS);
    const updated = [newAsm, ...items.filter((a) => a.id !== newAsm.id)];
    setLocal(STORAGE_KEYS.ASSESSMENTS, updated);
    return newAsm;
  },

  // === NILAI (GRADES) ===
  async getGrades(assessmentId: string): Promise<Grade[]> {
    let baseGrades = getLocal<Grade[]>(STORAGE_KEYS.GRADES, DEMO_GRADES);

    if (isSupabaseConfigured && isUuid(assessmentId)) {
      try {
        const { data, error } = await supabase
          .from('grades')
          .select('*, student:students(*)')
          .eq('assessment_id', assessmentId);

        if (!error && Array.isArray(data) && data.length > 0) {
          const seen = new Set(baseGrades.map((g) => `${g.assessment_id}_${g.student_id}`));
          const merged = [...baseGrades];
          for (const item of data as Grade[]) {
            const key = `${item.assessment_id}_${item.student_id}`;
            if (!seen.has(key)) {
              merged.push(item);
              seen.add(key);
            }
          }
          baseGrades = merged;
        }
      } catch (err) {
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
        created_at: existingIdx >= 0 ? all[existingIdx].created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        student: students.find((s) => s.id === item.studentId),
      };

      if (existingIdx >= 0) {
        all[existingIdx] = record;
      } else {
        all.push(record);
      }
      updatedGrades.push(record);
    }

    if (isSupabaseConfigured && isUuid(assessmentId)) {
      const syncable = updatedGrades.filter((g) => isUuid(g.id) && isUuid(g.student_id));
      if (syncable.length > 0) {
        try {
          await supabase.from('grades').upsert(
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
        } catch (err) {
          console.warn('Supabase saveGrades fallback:', err);
        }
      }
    }

    setLocal(STORAGE_KEYS.GRADES, all);
    return updatedGrades;
  },

  // === REMEDIAL ===
  async getRemedialRecords(assignmentId?: string): Promise<RemedialRecord[]> {
    let baseItems = getLocal<RemedialRecord[]>(STORAGE_KEYS.REMEDIAL, DEMO_REMEDIAL);

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('remedial_records')
          .select('*, student:students(*), assignment:teaching_assignments(*)')
          .order('execution_date', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const seen = new Set(baseItems.map((r) => r.id));
          const merged = [...baseItems];
          for (const item of data as RemedialRecord[]) {
            if (!seen.has(item.id)) {
              merged.push(item);
              seen.add(item.id);
            }
          }
          baseItems = merged;
        }
      } catch (err) {
        console.warn('Supabase getRemedialRecords fallback:', err);
      }
    }

    const [students, assignments] = await Promise.all([
      academicService.getStudents(),
      academicService.getTeachingAssignments(),
    ]);

    let items = baseItems.map((r) => ({
      ...r,
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

    if (isSupabaseConfigured && isUuid(id) && isUuid(payload.assignment_id) && isUuid(payload.student_id)) {
      try {
        const { student: _s, assignment: _a, ...dbPayload } = newRecord;
        const { data } = await supabase.from('remedial_records').insert(dbPayload).select().single();
        if (data) {
          newRecord = {
            ...(data as RemedialRecord),
            student: newRecord.student,
            assignment: newRecord.assignment,
          };
        }
      } catch (err) {
        console.warn('Supabase createRemedialRecord fallback:', err);
      }
    }

    const current = getLocal<RemedialRecord[]>(STORAGE_KEYS.REMEDIAL, DEMO_REMEDIAL);
    const updated = [newRecord, ...current.filter((r) => r.id !== newRecord.id)];
    setLocal(STORAGE_KEYS.REMEDIAL, updated);
    return newRecord;
  },

  // === PENGAYAAN ===
  async getEnrichmentRecords(assignmentId?: string): Promise<EnrichmentRecord[]> {
    let baseItems = getLocal<EnrichmentRecord[]>(STORAGE_KEYS.ENRICHMENT, DEMO_ENRICHMENT);

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('enrichment_records')
          .select('*, student:students(*), assignment:teaching_assignments(*)')
          .order('execution_date', { ascending: false });

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

    if (isSupabaseConfigured && isUuid(id) && isUuid(payload.assignment_id) && isUuid(payload.student_id)) {
      try {
        const { student: _s, assignment: _a, ...dbPayload } = newRecord;
        const { data } = await supabase.from('enrichment_records').insert(dbPayload).select().single();
        if (data) {
          newRecord = {
            ...(data as EnrichmentRecord),
            student: newRecord.student,
            assignment: newRecord.assignment,
          };
        }
      } catch (err) {
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
