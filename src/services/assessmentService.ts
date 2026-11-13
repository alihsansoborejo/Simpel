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
  DEMO_STUDENTS,
} from '../lib/demoData';

const STORAGE_KEYS = {
  ASSESSMENTS: 'simpel_assessments',
  GRADES: 'simpel_grades',
  REMEDIAL: 'simpel_remedial',
  ENRICHMENT: 'simpel_enrichment',
};

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
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('assessments')
          .select('*, assignment:teaching_assignments(*, teacher:teachers(*), class:classes(*), subject:subjects(*))')
          .order('assessment_date', { ascending: false });

        if (assignmentId) query = query.eq('assignment_id', assignmentId);

        const { data, error } = await query;
        if (!error && data && data.length > 0) return data as Assessment[];
      } catch (err) {
        console.warn('Supabase getAssessments fallback:', err);
      }
    }

    let items = getLocal<Assessment[]>(STORAGE_KEYS.ASSESSMENTS, DEMO_ASSESSMENTS);
    if (assignmentId) items = items.filter((a) => a.assignment_id === assignmentId);
    return items;
  },

  async createAssessment(payload: Omit<Assessment, 'id' | 'created_at'>): Promise<Assessment> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `asm-${Date.now()}`;
    const newAsm: Assessment = {
      ...payload,
      id,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { assignment: _a, ...dbAsm } = newAsm;
        const { data } = await supabase.from('assessments').insert(dbAsm).select().single();
        if (data) return data as Assessment;
      } catch (err) {
        console.warn('Supabase createAssessment fallback:', err);
      }
    }

    const items = await this.getAssessments();
    const updated = [newAsm, ...items];
    setLocal(STORAGE_KEYS.ASSESSMENTS, updated);
    return newAsm;
  },

  // === NILAI (GRADES) ===
  async getGrades(assessmentId: string): Promise<Grade[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('grades')
          .select('*, student:students(*)')
          .eq('assessment_id', assessmentId);

        if (!error && data && data.length > 0) return data as Grade[];
      } catch (err) {
        console.warn('Supabase getGrades fallback:', err);
      }
    }

    const all = getLocal<Grade[]>(STORAGE_KEYS.GRADES, DEMO_GRADES);
    const filtered = all.filter((g) => g.assessment_id === assessmentId);

    // Pastikan relasi student terisi
    return filtered.map((g) => ({
      ...g,
      student: g.student || DEMO_STUDENTS.find((s) => s.id === g.student_id),
    }));
  },

  async saveGrades(
    assessmentId: string,
    entries: Array<{ studentId: string; score: number; feedback?: string | null }>
  ): Promise<Grade[]> {
    const all = getLocal<Grade[]>(STORAGE_KEYS.GRADES, DEMO_GRADES);
    const updatedGrades: Grade[] = [];

    for (const item of entries) {
      const existingIdx = all.findIndex(
        (g) => g.assessment_id === assessmentId && g.student_id === item.studentId
      );

      const record: Grade = {
        id: existingIdx >= 0 ? all[existingIdx].id : `grd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        assessment_id: assessmentId,
        student_id: item.studentId,
        score: Math.min(100, Math.max(0, item.score)),
        feedback: item.feedback || null,
        created_at: existingIdx >= 0 ? all[existingIdx].created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        student: DEMO_STUDENTS.find((s) => s.id === item.studentId),
      };

      if (existingIdx >= 0) {
        all[existingIdx] = record;
      } else {
        all.push(record);
      }
      updatedGrades.push(record);
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from('grades').upsert(
          updatedGrades.map((g) => ({
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

    setLocal(STORAGE_KEYS.GRADES, all);
    return updatedGrades;
  },

  // === REMEDIAL ===
  async getRemedialRecords(assignmentId?: string): Promise<RemedialRecord[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('remedial_records')
          .select('*, student:students(*), assignment:teaching_assignments(*)')
          .order('execution_date', { ascending: false });

        if (assignmentId) query = query.eq('assignment_id', assignmentId);

        const { data, error } = await query;
        if (!error && data && data.length > 0) return data as RemedialRecord[];
      } catch (err) {
        console.warn('Supabase getRemedialRecords fallback:', err);
      }
    }

    let items = getLocal<RemedialRecord[]>(STORAGE_KEYS.REMEDIAL, DEMO_REMEDIAL);
    if (assignmentId) items = items.filter((r) => r.assignment_id === assignmentId);
    return items;
  },

  async createRemedialRecord(payload: Omit<RemedialRecord, 'id' | 'created_at'>): Promise<RemedialRecord> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rem-${Date.now()}`;
    const newRecord: RemedialRecord = {
      ...payload,
      id,
      created_at: new Date().toISOString(),
      student: DEMO_STUDENTS.find((s) => s.id === payload.student_id),
    };

    if (isSupabaseConfigured) {
      try {
        const { student: _s, assignment: _a, ...dbPayload } = newRecord;
        const { data } = await supabase.from('remedial_records').insert(dbPayload).select().single();
        if (data) return data as RemedialRecord;
      } catch (err) {
        console.warn('Supabase createRemedialRecord fallback:', err);
      }
    }

    const current = await this.getRemedialRecords();
    const updated = [newRecord, ...current];
    setLocal(STORAGE_KEYS.REMEDIAL, updated);
    return newRecord;
  },

  // === PENGAYAAN ===
  async getEnrichmentRecords(assignmentId?: string): Promise<EnrichmentRecord[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('enrichment_records')
          .select('*, student:students(*), assignment:teaching_assignments(*)')
          .order('execution_date', { ascending: false });

        if (assignmentId) query = query.eq('assignment_id', assignmentId);

        const { data, error } = await query;
        if (!error && data && data.length > 0) return data as EnrichmentRecord[];
      } catch (err) {
        console.warn('Supabase getEnrichmentRecords fallback:', err);
      }
    }

    let items = getLocal<EnrichmentRecord[]>(STORAGE_KEYS.ENRICHMENT, DEMO_ENRICHMENT);
    if (assignmentId) items = items.filter((e) => e.assignment_id === assignmentId);
    return items;
  },

  async createEnrichmentRecord(payload: Omit<EnrichmentRecord, 'id' | 'created_at'>): Promise<EnrichmentRecord> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `enr-${Date.now()}`;
    const newRecord: EnrichmentRecord = {
      ...payload,
      id,
      created_at: new Date().toISOString(),
      student: DEMO_STUDENTS.find((s) => s.id === payload.student_id),
    };

    if (isSupabaseConfigured) {
      try {
        const { student: _s, assignment: _a, ...dbPayload } = newRecord;
        const { data } = await supabase.from('enrichment_records').insert(dbPayload).select().single();
        if (data) return data as EnrichmentRecord;
      } catch (err) {
        console.warn('Supabase createEnrichmentRecord fallback:', err);
      }
    }

    const current = await this.getEnrichmentRecords();
    const updated = [newRecord, ...current];
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
