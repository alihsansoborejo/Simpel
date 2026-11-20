import { supabase, isSupabaseAvailable, reportSupabaseOutcome } from '../lib/supabaseClient';
import { StudentGuidanceRecord, GuidanceStatus } from '../types/database.types';
import { DEMO_GUIDANCES } from '../lib/demoData';
import { academicService } from './academicService';
import { syncService } from './syncService';

const STORAGE_KEY = 'simpel_student_guidance';

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v?: string | null) => typeof v === 'string' && UUID_REGEX.test(v);

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface GuidanceUserContext {
  id?: string;
  email?: string;
  teacherId?: string | null;
  homeroomClassId?: string | null;
  profile?: { full_name?: string; nip?: string | null };
}

export const guidanceService = {
  async getGuidanceRecords(
    userRole: string,
    currentUserId: string,
    userContext?: GuidanceUserContext | null
  ): Promise<StudentGuidanceRecord[]> {
    let baseRecords = getLocal<StudentGuidanceRecord[]>(STORAGE_KEY, DEMO_GUIDANCES);
    let sessionUid = '';

    if (isSupabaseAvailable()) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (isUuid(sessionData?.session?.user?.id)) {
          sessionUid = sessionData!.session!.user!.id;
        }

        const { data, error } = await supabase
          .from('student_guidance_records')
          .select('*, student:students(*), recorder:profiles(*)')
          .order('guidance_date', { ascending: false });

        reportSupabaseOutcome(error);
        if (!error && Array.isArray(data) && data.length > 0) {
          const mapById = new Map<string, StudentGuidanceRecord>();
          let changedFromRemote = false;

          for (const localItem of baseRecords) {
            mapById.set(localItem.id, localItem);
          }
          for (const remoteItem of data as StudentGuidanceRecord[]) {
            const existing = mapById.get(remoteItem.id);
            if (!existing) {
              mapById.set(remoteItem.id, remoteItem);
              changedFromRemote = true;
            } else {
              const remoteTs = Date.parse(remoteItem.updated_at || remoteItem.created_at || '') || 0;
              const localTs = Date.parse(existing.updated_at || existing.created_at || '') || 0;
              if (remoteTs > localTs) {
                mapById.set(remoteItem.id, {
                  ...existing,
                  ...remoteItem,
                  recorder_name: remoteItem.recorder_name || remoteItem.recorder?.full_name || existing.recorder_name,
                  recorder_email: remoteItem.recorder_email || remoteItem.recorder?.email || existing.recorder_email,
                });
                changedFromRemote = true;
              }
            }
          }

          baseRecords = Array.from(mapById.values());
          if (changedFromRemote) {
            syncService.setLocalCacheSilently(
              STORAGE_KEY,
              JSON.stringify(baseRecords.map(({ student: _s, recorder: _r, ...rest }) => rest))
            );
          }
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase getGuidanceRecords fallback:', err);
      }
    }

    const effectiveUser = userContext || (currentUserId ? { id: currentUserId } : null);
    const [students, teachersPool, resolvedTeacher] = await Promise.all([
      academicService.getStudents(),
      academicService.getTeachers(),
      academicService.resolveTeacherForUser(effectiveUser),
    ]);

    const studentMap = new Map(students.map((s) => [s.id, s]));
    const { candidateTeacherIds, candidateUserIds } = academicService.getMatchingTeacherIdsForUser(
      effectiveUser,
      resolvedTeacher,
      teachersPool
    );
    if (currentUserId) candidateUserIds.add(currentUserId);
    if (sessionUid) candidateUserIds.add(sessionUid);

    const userEmailLower = String(userContext?.email || '').trim().toLowerCase();

    let homeroomStudentIds = new Set<string>();
    if (userRole === 'wali_kelas' && effectiveUser) {
      try {
        const homeroomClass = await academicService.resolveHomeroomClassForUser(effectiveUser, resolvedTeacher);
        if (homeroomClass) {
          const members = await academicService.getClassMembers(homeroomClass.id);
          homeroomStudentIds = new Set(members.map((m) => m.student_id));
        }
      } catch {
        // ignore homeroom lookup failure
      }
    }

    let records = baseRecords.map((r) => ({
      ...r,
      student: studentMap.get(r.student_id) || r.student,
      recorder_name: r.recorder_name || r.recorder?.full_name || null,
      recorder_email: r.recorder_email || r.recorder?.email || null,
    }));

    if (userRole !== 'admin' && userRole !== 'kepala_madrasah') {
      records = records.filter((r) => {
        if (r.recorded_by && (candidateUserIds.has(r.recorded_by) || candidateTeacherIds.has(r.recorded_by))) {
          return true;
        }
        if (r.recorder_user_id && candidateUserIds.has(r.recorder_user_id)) {
          return true;
        }
        if (r.teacher_id && (candidateTeacherIds.has(r.teacher_id) || candidateUserIds.has(r.teacher_id))) {
          return true;
        }
        if (userEmailLower) {
          const recEmail = String(r.recorder_email || r.recorder?.email || '').trim().toLowerCase();
          if (recEmail && recEmail === userEmailLower) return true;
        }
        if (userRole === 'wali_kelas' && homeroomStudentIds.has(r.student_id)) {
          return true;
        }
        return false;
      });
    }

    return records.sort((a, b) => {
      const dateDiff = (b.guidance_date || '').localeCompare(a.guidance_date || '');
      if (dateDiff !== 0) return dateDiff;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  },

  async createGuidanceRecord(
    payload: Omit<StudentGuidanceRecord, 'id' | 'created_at' | 'updated_at'>
  ): Promise<StudentGuidanceRecord> {
    const id = generateUuid();
    const students = await academicService.getStudents();
    const matchedStudent = students.find((s) => s.id === payload.student_id);
    const now = new Date().toISOString();

    let newRecord: StudentGuidanceRecord = {
      ...payload,
      id,
      student: matchedStudent,
      created_at: now,
      updated_at: now,
    };

    const current = getLocal<StudentGuidanceRecord[]>(STORAGE_KEY, DEMO_GUIDANCES);
    const updatedLocal = [newRecord, ...current.filter((r) => r.id !== newRecord.id)];
    setLocal(STORAGE_KEY, updatedLocal);
    void syncService.flushMutations();

    if (isSupabaseAvailable() && isUuid(id) && isUuid(payload.student_id)) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUid = sessionData?.session?.user?.id;
        const recordedBy = isUuid(sessionUid)
          ? sessionUid
          : isUuid(payload.recorded_by)
          ? payload.recorded_by
          : '';

        if (isUuid(recordedBy)) {
          const dbPayload = {
            id: newRecord.id,
            student_id: newRecord.student_id,
            recorded_by: recordedBy,
            teacher_id: isUuid(newRecord.teacher_id) ? newRecord.teacher_id : null,
            recorder_name: newRecord.recorder_name || null,
            recorder_email: newRecord.recorder_email || null,
            guidance_date: newRecord.guidance_date,
            guidance_type: newRecord.guidance_type,
            problem_description: newRecord.problem_description,
            counseling_summary: newRecord.counseling_summary,
            recommendation_followup: newRecord.recommendation_followup,
            status: newRecord.status,
            created_at: newRecord.created_at,
            updated_at: newRecord.updated_at,
          };

          let { data, error } = await supabase
            .from('student_guidance_records')
            .insert(dbPayload)
            .select()
            .maybeSingle();

          // Fallback jika kolom tambahan belum ditambahkan di Supabase
          if (error && (error.code === '42703' || error.code === 'PGRST204')) {
            const { teacher_id: _tid, recorder_name: _rn, recorder_email: _re, ...legacyPayload } = dbPayload;
            const retry = await supabase
              .from('student_guidance_records')
              .insert(legacyPayload)
              .select()
              .maybeSingle();
            data = retry.data;
            error = retry.error;
          }

          reportSupabaseOutcome(error);
          if (!error && data) {
            newRecord = {
              ...(data as StudentGuidanceRecord),
              recorder_name: newRecord.recorder_name,
              recorder_email: newRecord.recorder_email,
              recorder_user_id: newRecord.recorder_user_id || newRecord.recorded_by,
              student: matchedStudent,
            };
            const latest = getLocal<StudentGuidanceRecord[]>(STORAGE_KEY, updatedLocal);
            setLocal(STORAGE_KEY, [newRecord, ...latest.filter((r) => r.id !== newRecord.id)]);
            void syncService.flushMutations();
          }
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase createGuidanceRecord fallback:', err);
      }
    }

    return newRecord;
  },

  async updateGuidanceStatus(id: string, status: GuidanceStatus): Promise<StudentGuidanceRecord> {
    const allRecords = await this.getGuidanceRecords('admin', '');
    const localRecords = getLocal<StudentGuidanceRecord[]>(STORAGE_KEY, DEMO_GUIDANCES);
    const item = allRecords.find((r) => r.id === id) || localRecords.find((r) => r.id === id);
    if (!item) throw new Error('Data bimbingan tidak ditemukan');

    const updatedItem: StudentGuidanceRecord = {
      ...item,
      status,
      updated_at: new Date().toISOString(),
    };

    const nextLocal = localRecords.some((r) => r.id === id)
      ? localRecords.map((r) => (r.id === id ? updatedItem : r))
      : [updatedItem, ...localRecords];
    setLocal(STORAGE_KEY, nextLocal);
    void syncService.flushMutations();

    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const { error } = await supabase
          .from('student_guidance_records')
          .update({ status, updated_at: updatedItem.updated_at })
          .eq('id', id);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase updateGuidanceStatus fallback:', err);
      }
    }

    return updatedItem;
  },

  async deleteGuidanceRecord(id: string): Promise<void> {
    const current = getLocal<StudentGuidanceRecord[]>(STORAGE_KEY, DEMO_GUIDANCES);
    setLocal(
      STORAGE_KEY,
      current.filter((r) => r.id !== id)
    );
    void syncService.flushMutations();

    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const { error } = await supabase.from('student_guidance_records').delete().eq('id', id);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase deleteGuidanceRecord fallback:', err);
      }
    }
  },
};
