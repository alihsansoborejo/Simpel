import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  AcademicYear,
  Semester,
  ClassRoom,
  Student,
  Teacher,
  Subject,
  TeachingAssignment,
  SystemSettings,
  ClassMember,
  HomeroomAssignment,
} from '../types/database.types';
import {
  DEMO_ACADEMIC_YEAR,
  DEMO_SEMESTER,
  DEMO_CLASSES,
  DEMO_STUDENTS,
  DEMO_TEACHERS,
  DEMO_SUBJECTS,
  DEMO_TEACHING_ASSIGNMENTS,
  DEMO_SYSTEM_SETTINGS,
  DEMO_CLASS_MEMBERS,
  DEMO_HOMEROOM_ASSIGNMENTS,
} from '../lib/demoData';

const STORAGE_KEYS = {
  ACADEMIC_YEARS: 'simpel_academic_years',
  SEMESTERS: 'simpel_semesters',
  CLASSES: 'simpel_classes',
  STUDENTS: 'simpel_students',
  TEACHERS: 'simpel_teachers',
  SUBJECTS: 'simpel_subjects',
  ASSIGNMENTS: 'simpel_assignments',
  SETTINGS: 'simpel_settings',
  CLASS_MEMBERS: 'simpel_class_members',
  HOMEROOM_ASSIGNMENTS: 'simpel_homeroom_assignments',
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value?: string | null): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

let lastCloudSyncError: string | null = null;

export const academicService = {
  getLastCloudSyncError(): string | null {
    return lastCloudSyncError;
  },

  // === SISTEM PENGATURAN ===
  async getSettings(): Promise<SystemSettings> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('system_settings').select('*').limit(1).maybeSingle();
        if (!error && data) return data as SystemSettings;
      } catch (err) {
        console.warn('Supabase getSettings fallback:', err);
      }
    }
    return getLocal<SystemSettings>(STORAGE_KEYS.SETTINGS, DEMO_SYSTEM_SETTINGS);
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    const current = await this.getSettings();
    const updated: SystemSettings = { ...current, ...settings, updated_at: new Date().toISOString() };
    setLocal(STORAGE_KEYS.SETTINGS, updated);
    lastCloudSyncError = null;

    if (isSupabaseConfigured) {
      try {
        const dbPayload: Record<string, unknown> = {
          updated_at: updated.updated_at,
        };
        if (updated.school_name !== undefined) dbPayload.school_name = updated.school_name;
        if (updated.nsm !== undefined) dbPayload.nsm = updated.nsm;
        if (updated.npsn !== undefined) dbPayload.npsn = updated.npsn;
        if (updated.address !== undefined) dbPayload.address = updated.address;
        if (updated.principal_name !== undefined) dbPayload.principal_name = updated.principal_name;
        if (updated.principal_nip !== undefined) dbPayload.principal_nip = updated.principal_nip;
        if (updated.logo_url !== undefined) dbPayload.logo_url = updated.logo_url;
        if (updated.favicon_url !== undefined) dbPayload.favicon_url = updated.favicon_url;
        if (updated.kktp_default !== undefined) dbPayload.kktp_default = Number(updated.kktp_default);
        if (updated.is_report_card_locked !== undefined) dbPayload.is_report_card_locked = Boolean(updated.is_report_card_locked);
        if (isUuid(updated.active_academic_year_id)) dbPayload.active_academic_year_id = updated.active_academic_year_id;
        if (isUuid(updated.active_semester_id)) dbPayload.active_semester_id = updated.active_semester_id;

        const { data: existingRow, error: fetchErr } = await supabase
          .from('system_settings')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (fetchErr) {
          lastCloudSyncError = `${fetchErr.message} (${fetchErr.code || 'RLS/Auth'})`;
          console.warn('Supabase fetch system_settings error:', fetchErr);
        } else if (existingRow?.id && isUuid(existingRow.id)) {
          const { error: updateErr } = await supabase
            .from('system_settings')
            .update(dbPayload)
            .eq('id', existingRow.id);
          if (updateErr) {
            lastCloudSyncError = `${updateErr.message} (${updateErr.code || 'UpdateError'})`;
            console.warn('Supabase updateSettings error:', updateErr);
          }
        } else {
          const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;
          const { error: insertErr } = await supabase
            .from('system_settings')
            .insert(newId ? { id: newId, ...dbPayload } : dbPayload);
          if (insertErr) {
            lastCloudSyncError = `${insertErr.message} (${insertErr.code || 'InsertError'})`;
            console.warn('Supabase insert system_settings error:', insertErr);
          }
        }
      } catch (err: any) {
        lastCloudSyncError = err?.message || 'Gagal menghubungi Supabase.';
        console.warn('Supabase updateSettings fallback:', err);
      }
    }
    return updated;
  },

  // === TAHUN PELAJARAN & SEMESTER ===
  async getAcademicYears(): Promise<AcademicYear[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('academic_years').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data as AcademicYear[];
      } catch (err) {
        console.warn('Supabase getAcademicYears fallback:', err);
      }
    }
    return getLocal<AcademicYear[]>(STORAGE_KEYS.ACADEMIC_YEARS, [DEMO_ACADEMIC_YEAR]);
  },

  async createAcademicYear(payload: Omit<AcademicYear, 'id' | 'created_at'>): Promise<AcademicYear> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ay-${Date.now()}`;
    const newYear: AcademicYear = {
      ...payload,
      id,
      created_at: new Date().toISOString(),
    };
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('academic_years').insert(newYear).select().single();
        if (data) return data as AcademicYear;
      } catch (err) {
        console.warn('Supabase createAcademicYear fallback:', err);
      }
    }
    const years = await this.getAcademicYears();
    const updated = [newYear, ...years];
    setLocal(STORAGE_KEYS.ACADEMIC_YEARS, updated);
    return newYear;
  },

  async getSemesters(): Promise<Semester[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('semesters').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data as Semester[];
      } catch (err) {
        console.warn('Supabase getSemesters fallback:', err);
      }
    }
    return getLocal<Semester[]>(STORAGE_KEYS.SEMESTERS, [
      DEMO_SEMESTER,
      {
        id: 'sem-genap-2026',
        academic_year_id: 'ay-2026',
        semester_type: 'Genap',
        start_date: '2027-01-05',
        end_date: '2027-06-25',
        is_active: false,
        created_at: '2026-07-01T00:00:00+07:00',
      },
    ]);
  },

  // === DATA KELAS (ROMBEL) ===
  async getClasses(): Promise<ClassRoom[]> {
    let classesList: ClassRoom[] = [];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('classes').select('*').order('level', { ascending: true });
        if (!error && data && data.length > 0) classesList = data as ClassRoom[];
      } catch (err) {
        console.warn('Supabase getClasses fallback:', err);
      }
    }
    if (classesList.length === 0) {
      classesList = getLocal<ClassRoom[]>(STORAGE_KEYS.CLASSES, DEMO_CLASSES);
    }

    // Attach homeroom teacher resolution
    const homerooms = await this.getHomeroomAssignments();
    const teachers = await this.getTeachers();

    return classesList.map((c) => {
      const hr = homerooms.find((h) => h.class_id === c.id);
      const teacherId = hr ? hr.teacher_id : c.homeroom_teacher_id;
      const teacher = teachers.find((t) => t.id === teacherId);
      return {
        ...c,
        homeroom_teacher_id: teacherId || null,
        homeroom_teacher: teacher,
      };
    }).sort((a, b) => a.level - b.level);
  },

  async createClass(payload: Omit<ClassRoom, 'id' | 'created_at'>): Promise<ClassRoom> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cls-${Date.now()}`;
    const newClass: ClassRoom = {
      ...payload,
      id,
      created_at: new Date().toISOString(),
    };
    if (isSupabaseConfigured) {
      try {
        const { homeroom_teacher_id: _hr, homeroom_teacher: _ht, ...dbClass } = newClass;
        const { data } = await supabase.from('classes').insert(dbClass).select().single();
        if (data) return data as ClassRoom;
      } catch (err) {
        console.warn('Supabase createClass fallback:', err);
      }
    }
    const classes = await this.getClasses();
    const updated = [...classes, newClass].sort((a, b) => a.level - b.level);
    setLocal(STORAGE_KEYS.CLASSES, updated);

    if (payload.homeroom_teacher_id) {
      await this.assignHomeroomTeacher(newClass.id, payload.homeroom_teacher_id);
    }

    return newClass;
  },

  async updateClass(id: string, payload: Partial<ClassRoom>): Promise<ClassRoom> {
    const classes = await this.getClasses();
    const cls = classes.find((c) => c.id === id);
    if (!cls) throw new Error('Data rombel kelas tidak ditemukan');

    const updatedClass: ClassRoom = {
      ...cls,
      ...payload,
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('classes').update({
          name: updatedClass.name,
          level: updatedClass.level,
          phase: updatedClass.phase,
          capacity: updatedClass.capacity,
        }).eq('id', id);
      } catch (err) {
        console.warn('Supabase updateClass fallback:', err);
      }
    }

    const updated = classes.map((c) => (c.id === id ? updatedClass : c)).sort((a, b) => a.level - b.level);
    setLocal(STORAGE_KEYS.CLASSES, updated);

    if (payload.homeroom_teacher_id !== undefined) {
      if (payload.homeroom_teacher_id) {
        await this.assignHomeroomTeacher(id, payload.homeroom_teacher_id);
      } else {
        await this.removeHomeroomTeacher(id);
      }
    }

    return updatedClass;
  },

  async deleteClass(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('classes').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteClass fallback:', err);
      }
    }
    const classes = await this.getClasses();
    const updated = classes.filter((c) => c.id !== id);
    setLocal(STORAGE_KEYS.CLASSES, updated);
  },

  // === DATA SISWA ===
  async getStudents(): Promise<Student[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('students').select('*').order('full_name', { ascending: true });
        if (!error && data && data.length > 0) return data as Student[];
      } catch (err) {
        console.warn('Supabase getStudents fallback:', err);
      }
    }
    return getLocal<Student[]>(STORAGE_KEYS.STUDENTS, DEMO_STUDENTS);
  },

  async createStudent(payload: Omit<Student, 'id' | 'created_at' | 'updated_at'>): Promise<Student> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `std-${Date.now()}`;
    const newStudent: Student = {
      ...payload,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('students').insert(newStudent).select().single();
        if (data) return data as Student;
      } catch (err) {
        console.warn('Supabase createStudent fallback:', err);
      }
    }
    const students = await this.getStudents();
    const updated = [newStudent, ...students];
    setLocal(STORAGE_KEYS.STUDENTS, updated);
    return newStudent;
  },

  async updateStudent(id: string, payload: Partial<Student>): Promise<Student> {
    const students = await this.getStudents();
    const student = students.find((s) => s.id === id);
    if (!student) throw new Error('Data siswa tidak ditemukan');

    const updatedStudent: Student = { ...student, ...payload, updated_at: new Date().toISOString() };
    if (isSupabaseConfigured) {
      try {
        await supabase.from('students').update(payload).eq('id', id);
      } catch (err) {
        console.warn('Supabase updateStudent fallback:', err);
      }
    }
    const updated = students.map((s) => (s.id === id ? updatedStudent : s));
    setLocal(STORAGE_KEYS.STUDENTS, updated);
    return updatedStudent;
  },

  async deleteStudent(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('students').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteStudent fallback:', err);
      }
    }
    const students = await this.getStudents();
    const updated = students.filter((s) => s.id !== id);
    setLocal(STORAGE_KEYS.STUDENTS, updated);
  },

  // === DATA GURU ===
  async getTeachers(): Promise<Teacher[]> {
    const localTeachers = getLocal<Teacher[]>(STORAGE_KEYS.TEACHERS, DEMO_TEACHERS);
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('teachers').select('*').order('full_name', { ascending: true });
        if (!error && Array.isArray(data)) {
          const remoteTeachers = data as Teacher[];
          const merged: Teacher[] = [...remoteTeachers];
          const seenIds = new Set(remoteTeachers.map((t) => t.id));
          const seenNames = new Set(remoteTeachers.map((t) => t.full_name.trim().toLowerCase()));
          const seenNips = new Set(remoteTeachers.map((t) => t.nip?.trim()).filter(Boolean) as string[]);

          for (const lt of localTeachers) {
            const normName = lt.full_name.trim().toLowerCase();
            const normNip = lt.nip?.trim() || '';
            if (seenIds.has(lt.id) || (normNip && seenNips.has(normNip)) || seenNames.has(normName)) {
              continue;
            }
            merged.push(lt);
            seenIds.add(lt.id);
            seenNames.add(normName);
            if (normNip) seenNips.add(normNip);
          }

          return merged.sort((a, b) => a.full_name.localeCompare(b.full_name, 'id'));
        }
      } catch (err) {
        console.warn('Supabase getTeachers fallback:', err);
      }
    }
    return localTeachers;
  },

  async createTeacher(payload: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>): Promise<Teacher> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tch-${Date.now()}`;
    const now = new Date().toISOString();
    const cleanNip = payload.nip?.trim() || null;
    const cleanNuptk = payload.nuptk?.trim() || null;

    let savedTeacher: Teacher = {
      ...payload,
      nip: cleanNip,
      nuptk: cleanNuptk,
      id,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured) {
      try {
        const supabasePayload = {
          ...savedTeacher,
          user_id: isUuid(payload.user_id) ? payload.user_id : null,
        };
        let { data, error } = await supabase.from('teachers').insert(supabasePayload).select().single();
        if (error && supabasePayload.user_id !== null) {
          const retry = await supabase
            .from('teachers')
            .insert({ ...supabasePayload, user_id: null })
            .select()
            .single();
          data = retry.data;
          error = retry.error;
        }
        if (!error && data) {
          savedTeacher = data as Teacher;
        }
      } catch (err) {
        console.warn('Supabase createTeacher fallback:', err);
      }
    }

    const localTeachers = getLocal<Teacher[]>(STORAGE_KEYS.TEACHERS, DEMO_TEACHERS);
    const updated = [savedTeacher, ...localTeachers.filter((t) => t.id !== savedTeacher.id)];
    setLocal(STORAGE_KEYS.TEACHERS, updated);
    return savedTeacher;
  },

  async updateTeacher(id: string, payload: Partial<Teacher>): Promise<Teacher> {
    const teachers = await this.getTeachers();
    const teacher = teachers.find((t) => t.id === id);
    if (!teacher) throw new Error('Data tenaga pendidik tidak ditemukan');

    const cleanPayload: Partial<Teacher> = {
      ...payload,
      ...(payload.nip !== undefined ? { nip: payload.nip?.trim() || null } : {}),
      ...(payload.nuptk !== undefined ? { nuptk: payload.nuptk?.trim() || null } : {}),
    };

    const updatedTeacher: Teacher = {
      ...teacher,
      ...cleanPayload,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && isUuid(id)) {
      try {
        const supabaseUpdate: Partial<Teacher> = { ...cleanPayload };
        if ('user_id' in supabaseUpdate && !isUuid(supabaseUpdate.user_id)) {
          delete supabaseUpdate.user_id;
        }
        await supabase.from('teachers').update(supabaseUpdate).eq('id', id);
      } catch (err) {
        console.warn('Supabase updateTeacher fallback:', err);
      }
    }

    const localTeachers = getLocal<Teacher[]>(STORAGE_KEYS.TEACHERS, DEMO_TEACHERS);
    const existsInLocal = localTeachers.some((t) => t.id === id);
    const updated = existsInLocal
      ? localTeachers.map((t) => (t.id === id ? updatedTeacher : t))
      : [updatedTeacher, ...localTeachers];
    setLocal(STORAGE_KEYS.TEACHERS, updated);
    return updatedTeacher;
  },

  async deleteTeacher(id: string): Promise<void> {
    if (isSupabaseConfigured && isUuid(id)) {
      try {
        await supabase.from('teachers').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteTeacher fallback:', err);
      }
    }
    const localTeachers = getLocal<Teacher[]>(STORAGE_KEYS.TEACHERS, DEMO_TEACHERS);
    const updated = localTeachers.filter((t) => t.id !== id);
    setLocal(STORAGE_KEYS.TEACHERS, updated);
  },

  // === PENUGASAN WALI KELAS (HOMEROOM) ===
  async getHomeroomAssignments(): Promise<HomeroomAssignment[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('homeroom_assignments')
          .select('*, teacher:teachers(*), class:classes(*)');
        if (!error && data && data.length > 0) return data as HomeroomAssignment[];
      } catch (err) {
        console.warn('Supabase getHomeroomAssignments fallback:', err);
      }
    }
    return getLocal<HomeroomAssignment[]>(STORAGE_KEYS.HOMEROOM_ASSIGNMENTS, DEMO_HOMEROOM_ASSIGNMENTS);
  },

  async assignHomeroomTeacher(
    classId: string,
    teacherId: string,
    academicYearId: string = 'ay-2026'
  ): Promise<HomeroomAssignment> {
    const current = await this.getHomeroomAssignments();
    const teachers = await this.getTeachers();
    const teacher = teachers.find((t) => t.id === teacherId);

    const existingIndex = current.findIndex((h) => h.class_id === classId);
    let result: HomeroomAssignment;

    if (existingIndex >= 0) {
      current[existingIndex] = {
        ...current[existingIndex],
        teacher_id: teacherId,
        teacher: teacher || current[existingIndex].teacher,
        academic_year_id: academicYearId,
      };
      result = current[existingIndex];
    } else {
      result = {
        id: `hr-${Date.now()}`,
        class_id: classId,
        teacher_id: teacherId,
        academic_year_id: academicYearId,
        created_at: new Date().toISOString(),
        teacher,
      };
      current.push(result);
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from('homeroom_assignments').upsert(
          {
            class_id: classId,
            teacher_id: teacherId,
            academic_year_id: academicYearId,
          },
          { onConflict: 'class_id,academic_year_id' }
        );
      } catch (err) {
        console.warn('Supabase assignHomeroomTeacher fallback:', err);
      }
    }

    setLocal(STORAGE_KEYS.HOMEROOM_ASSIGNMENTS, current);
    return result;
  },

  async removeHomeroomTeacher(classId: string): Promise<void> {
    const current = await this.getHomeroomAssignments();
    const updated = current.filter((h) => h.class_id !== classId);
    setLocal(STORAGE_KEYS.HOMEROOM_ASSIGNMENTS, updated);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('homeroom_assignments').delete().eq('class_id', classId);
      } catch (err) {
        console.warn('Supabase removeHomeroomTeacher fallback:', err);
      }
    }
  },

  // === DATA MATA PELAJARAN ===
  async getSubjects(): Promise<Subject[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('subjects').select('*').order('order_index', { ascending: true });
        if (!error && data && data.length > 0) return data as Subject[];
      } catch (err) {
        console.warn('Supabase getSubjects fallback:', err);
      }
    }
    return getLocal<Subject[]>(STORAGE_KEYS.SUBJECTS, DEMO_SUBJECTS);
  },

  async createSubject(payload: Omit<Subject, 'id' | 'created_at'>): Promise<Subject> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sbj-${Date.now()}`;
    const newSubject: Subject = {
      ...payload,
      id,
      created_at: new Date().toISOString(),
    };
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('subjects').insert(newSubject).select().single();
        if (data) return data as Subject;
      } catch (err) {
        console.warn('Supabase createSubject fallback:', err);
      }
    }
    const subjects = await this.getSubjects();
    const updated = [...subjects, newSubject].sort((a, b) => a.order_index - b.order_index);
    setLocal(STORAGE_KEYS.SUBJECTS, updated);
    return newSubject;
  },

  // === PENUGASAN GURU MENGAJAR ===
  async getTeachingAssignments(): Promise<TeachingAssignment[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('teaching_assignments')
          .select('*, teacher:teachers(*), class:classes(*), subject:subjects(*)');
        if (!error && data && data.length > 0) return data as TeachingAssignment[];
      } catch (err) {
        console.warn('Supabase getTeachingAssignments fallback:', err);
      }
    }
    return getLocal<TeachingAssignment[]>(STORAGE_KEYS.ASSIGNMENTS, DEMO_TEACHING_ASSIGNMENTS);
  },

  async createTeachingAssignment(
    payload: Omit<TeachingAssignment, 'id' | 'created_at' | 'teacher' | 'class' | 'subject'>
  ): Promise<TeachingAssignment> {
    const teachers = await this.getTeachers();
    const classes = await this.getClasses();
    const subjects = await this.getSubjects();

    const newAssignment: TeachingAssignment = {
      ...payload,
      id: `asg-${Date.now()}`,
      created_at: new Date().toISOString(),
      teacher: teachers.find((t) => t.id === payload.teacher_id),
      class: classes.find((c) => c.id === payload.class_id),
      subject: subjects.find((s) => s.id === payload.subject_id),
    };

    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('teaching_assignments').insert(payload).select().single();
        if (data) return data as TeachingAssignment;
      } catch (err) {
        console.warn('Supabase createTeachingAssignment fallback:', err);
      }
    }

    const assignments = await this.getTeachingAssignments();
    const updated = [newAssignment, ...assignments];
    setLocal(STORAGE_KEYS.ASSIGNMENTS, updated);
    return newAssignment;
  },

  async upsertTeachingAssignment(
    classId: string,
    subjectId: string,
    teacherId: string,
    academicYearId: string = 'ay-2026',
    semesterId: string = 'sem-ganjil-2026'
  ): Promise<TeachingAssignment | null> {
    const teachers = await this.getTeachers();
    const classes = await this.getClasses();
    const subjects = await this.getSubjects();
    const current = await this.getTeachingAssignments();

    // Jika dikosongkan ('unassigned' atau '')
    if (!teacherId || teacherId === 'unassigned') {
      const filtered = current.filter(
        (a) => !(a.class_id === classId && a.subject_id === subjectId)
      );
      setLocal(STORAGE_KEYS.ASSIGNMENTS, filtered);
      if (isSupabaseConfigured) {
        try {
          await supabase
            .from('teaching_assignments')
            .delete()
            .match({ class_id: classId, subject_id: subjectId, academic_year_id: academicYearId, semester_id: semesterId });
        } catch (e) {
          console.warn('Supabase delete assignment error:', e);
        }
      }
      return null;
    }

    const teacher = teachers.find((t) => t.id === teacherId);
    const cls = classes.find((c) => c.id === classId);
    const subject = subjects.find((s) => s.id === subjectId);

    const existingIndex = current.findIndex(
      (a) => a.class_id === classId && a.subject_id === subjectId
    );

    let result: TeachingAssignment;

    if (existingIndex >= 0) {
      current[existingIndex] = {
        ...current[existingIndex],
        teacher_id: teacherId,
        teacher: teacher || current[existingIndex].teacher,
        class: cls || current[existingIndex].class,
        subject: subject || current[existingIndex].subject,
      };
      result = current[existingIndex];
      setLocal(STORAGE_KEYS.ASSIGNMENTS, [...current]);

      if (isSupabaseConfigured) {
        try {
          await supabase
            .from('teaching_assignments')
            .update({ teacher_id: teacherId })
            .eq('id', result.id);
        } catch (e) {
          console.warn('Supabase update assignment error:', e);
        }
      }
    } else {
      result = {
        id: `asg-${classId}-${subjectId}`,
        class_id: classId,
        subject_id: subjectId,
        teacher_id: teacherId,
        academic_year_id: academicYearId,
        semester_id: semesterId,
        created_at: new Date().toISOString(),
        teacher,
        class: cls,
        subject,
      };
      const updated = [result, ...current];
      setLocal(STORAGE_KEYS.ASSIGNMENTS, updated);

      if (isSupabaseConfigured) {
        try {
          await supabase.from('teaching_assignments').insert({
            class_id: classId,
            subject_id: subjectId,
            teacher_id: teacherId,
            academic_year_id: academicYearId,
            semester_id: semesterId,
          });
        } catch (e) {
          console.warn('Supabase insert assignment error:', e);
        }
      }
    }

    return result;
  },

  async batchAssignClassTeachers(
    classId: string,
    assignmentsList: { subject_id: string; teacher_id: string }[],
    academicYearId: string = 'ay-2026',
    semesterId: string = 'sem-ganjil-2026'
  ): Promise<void> {
    for (const item of assignmentsList) {
      await this.upsertTeachingAssignment(
        classId,
        item.subject_id,
        item.teacher_id,
        academicYearId,
        semesterId
      );
    }
  },

  // === ANGGOTA KELAS (ROMBEL SISWA) ===
  async getClassMembers(classId?: string): Promise<ClassMember[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('class_members').select('*, student:students(*), class:classes(*)');
        if (classId) {
          query = query.eq('class_id', classId);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) return data as ClassMember[];
      } catch (err) {
        console.warn('Supabase getClassMembers fallback:', err);
      }
    }
    const all = getLocal<ClassMember[]>(STORAGE_KEYS.CLASS_MEMBERS, DEMO_CLASS_MEMBERS);
    return classId ? all.filter((m) => m.class_id === classId) : all;
  },

  async assignStudentToClass(studentId: string, classId: string, academicYearId: string): Promise<ClassMember> {
    const students = await this.getStudents();
    const classes = await this.getClasses();
    const currentMembers = await this.getClassMembers();

    const newMember: ClassMember = {
      id: `cm-${Date.now()}`,
      student_id: studentId,
      class_id: classId,
      academic_year_id: academicYearId,
      student_number: currentMembers.filter((m) => m.class_id === classId).length + 1,
      created_at: new Date().toISOString(),
      student: students.find((s) => s.id === studentId),
      class: classes.find((c) => c.id === classId),
    };

    const updated = [...currentMembers.filter((m) => m.student_id !== studentId), newMember];
    setLocal(STORAGE_KEYS.CLASS_MEMBERS, updated);
    return newMember;
  },
};
