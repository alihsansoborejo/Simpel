import { supabase, isSupabaseAvailable, reportSupabaseOutcome } from '../lib/supabaseClient';
import { StudentAttendance, AttendanceStatus } from '../types/database.types';
import { DEMO_ATTENDANCES } from '../lib/demoData';

const STORAGE_KEY = 'simpel_student_attendance';

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

export const attendanceService = {
  async getAttendance(filters: {
    classId?: string;
    date?: string;
    studentId?: string;
    academicYearId?: string;
    semesterId?: string;
  }): Promise<StudentAttendance[]> {
    if (isSupabaseAvailable()) {
      try {
        let query = supabase.from('student_attendance').select('*, student:students(*)');
        if (filters.classId && isUuid(filters.classId)) query = query.eq('class_id', filters.classId);
        if (filters.date) query = query.eq('date', filters.date);
        if (filters.studentId && isUuid(filters.studentId)) query = query.eq('student_id', filters.studentId);
        if (filters.academicYearId && isUuid(filters.academicYearId)) query = query.eq('academic_year_id', filters.academicYearId);
        if (filters.semesterId && isUuid(filters.semesterId)) query = query.eq('semester_id', filters.semesterId);

        const { data, error } = await query;
        reportSupabaseOutcome(error);
        if (!error && data && data.length > 0) return data as StudentAttendance[];
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase getAttendance fallback:', err);
      }
    }

    let records = getLocal<StudentAttendance[]>(STORAGE_KEY, DEMO_ATTENDANCES);
    if (filters.classId) records = records.filter((r) => r.class_id === filters.classId);
    if (filters.date) records = records.filter((r) => r.date === filters.date);
    if (filters.studentId) records = records.filter((r) => r.student_id === filters.studentId);
    if (filters.academicYearId) records = records.filter((r) => r.academic_year_id === filters.academicYearId);
    if (filters.semesterId) records = records.filter((r) => r.semester_id === filters.semesterId);

    return records;
  },

  async recordAttendance(
    entries: Array<{
      studentId: string;
      classId: string;
      date: string;
      status: AttendanceStatus;
      notes?: string | null;
      recordedBy: string;
      academicYearId: string;
      semesterId: string;
    }>
  ): Promise<StudentAttendance[]> {
    const allRecords = getLocal<StudentAttendance[]>(STORAGE_KEY, DEMO_ATTENDANCES);
    const newItems: StudentAttendance[] = [];

    for (const entry of entries) {
      // Periksa duplikasi berdasarkan student_id dan date
      const existingIdx = allRecords.findIndex(
        (r) => r.student_id === entry.studentId && r.date === entry.date
      );

      const generatedId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const record: StudentAttendance = {
        id: existingIdx >= 0 && isUuid(allRecords[existingIdx].id) ? allRecords[existingIdx].id : generatedId,
        student_id: entry.studentId,
        class_id: entry.classId,
        date: entry.date,
        status: entry.status,
        notes: entry.notes || null,
        recorded_by: entry.recordedBy,
        academic_year_id: entry.academicYearId,
        semester_id: entry.semesterId,
        created_at: new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        allRecords[existingIdx] = record;
      } else {
        allRecords.push(record);
      }
      newItems.push(record);
    }

    if (isSupabaseAvailable()) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUid = sessionData?.session?.user?.id;
        const dbItems = newItems
          .map((item) => {
            const resolvedRecorder = isUuid(item.recorded_by)
              ? item.recorded_by
              : isUuid(sessionUid)
              ? sessionUid!
              : '';
            return {
              id: item.id,
              student_id: item.student_id,
              class_id: item.class_id,
              date: item.date,
              status: item.status,
              notes: item.notes,
              recorded_by: resolvedRecorder,
              academic_year_id: item.academic_year_id,
              semester_id: item.semester_id,
            };
          })
          .filter(
            (item) =>
              isUuid(item.id) &&
              isUuid(item.student_id) &&
              isUuid(item.class_id) &&
              isUuid(item.recorded_by) &&
              isUuid(item.academic_year_id) &&
              isUuid(item.semester_id)
          );

        if (dbItems.length > 0) {
          const { error } = await supabase
            .from('student_attendance')
            .upsert(dbItems, { onConflict: 'student_id,date' });
          reportSupabaseOutcome(error);
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase recordAttendance fallback:', err);
      }
    }

    setLocal(STORAGE_KEY, allRecords);
    return newItems;
  },

  getStats(records: StudentAttendance[]) {
    const total = records.length;
    if (total === 0) return { hadir: 0, sakit: 0, izin: 0, alpa: 0, hadirPercentage: 0 };

    const hadir = records.filter((r) => r.status === 'Hadir').length;
    const sakit = records.filter((r) => r.status === 'Sakit').length;
    const izin = records.filter((r) => r.status === 'Izin').length;
    const alpa = records.filter((r) => r.status === 'Alpa').length;

    const hadirPercentage = Math.round((hadir / total) * 100);

    return { hadir, sakit, izin, alpa, hadirPercentage, total };
  },
};
