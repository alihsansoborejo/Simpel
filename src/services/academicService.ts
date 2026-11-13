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

const USERS_SYNC_STORAGE_KEY = 'simpel_users_cache_v2';

export function cleanTeacherIdentifier(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (
    !trimmed ||
    /^[-–—_.0/]+$/.test(trimmed) ||
    /^(non-?pns|tidak ada|belum ada|null|na|n\/a)$/i.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

export function normalizePersonName(name?: string | null): string {
  if (!name) return '';
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
}

function stripPersonTitles(name?: string | null): string {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/^(ust\.?|ustadz|ustadzah|h\.?|hj\.?|drs\.?|dr\.?|kh\.?)\s+/gi, '')
    .replace(/,\s*(s\.?pd\.?i?|s\.?pd|m\.?pd\.?i?|m\.?pd|s\.?ag|s\.?kom|s\.?e|m\.?ag|s\.?si|gr\.?).*$/gi, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateTeacherUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let isReconcilingTeachers = false;

function reconcileTeachersWithSyncedAccounts(baseTeachers: Teacher[]): Teacher[] {
  if (isReconcilingTeachers || typeof window === 'undefined') return baseTeachers;
  isReconcilingTeachers = true;

  try {
    const resultTeachers: Teacher[] = baseTeachers.map((t) => ({
      ...t,
      nip: cleanTeacherIdentifier(t.nip),
      nuptk: cleanTeacherIdentifier(t.nuptk),
      phone_number: cleanTeacherIdentifier(t.phone_number),
    }));

    let teachersChanged = resultTeachers.some(
      (t, idx) =>
        t.nip !== baseTeachers[idx].nip ||
        t.nuptk !== baseTeachers[idx].nuptk ||
        t.phone_number !== baseTeachers[idx].phone_number
    );

    const rawUsers = localStorage.getItem(USERS_SYNC_STORAGE_KEY);
    if (!rawUsers) {
      if (teachersChanged) {
        setLocal(STORAGE_KEYS.TEACHERS, resultTeachers);
      }
      return resultTeachers;
    }

    const parsedUsers = JSON.parse(rawUsers);
    if (!Array.isArray(parsedUsers) || parsedUsers.length === 0) {
      if (teachersChanged) {
        setLocal(STORAGE_KEYS.TEACHERS, resultTeachers);
      }
      return resultTeachers;
    }

    let usersChanged = false;
    const claimedTeacherIds = new Set<string>();
    const newlyCreatedForCloud: Teacher[] = [];
    const now = new Date().toISOString();

    const updatedUsers = parsedUsers.map((u: any) => {
      const roles: string[] = Array.isArray(u.roles) ? u.roles : [];
      const email = String(u.email || '').trim().toLowerCase();
      const normName = normalizePersonName(u.full_name);

      if (!normName || u.teacher_detached === true) {
        return u;
      }

      const isEducatorAccount =
        roles.some((r) => ['guru', 'wali_kelas', 'kepala_madrasah'].includes(r)) ||
        (email !== 'alihsansoborejo@gmail.com' && !!u.specialization);

      if (!isEducatorAccount) {
        return u;
      }

      const cleanNip = cleanTeacherIdentifier(u.nip);
      const cleanNuptk = cleanTeacherIdentifier(u.nuptk);
      const cleanPhone = cleanTeacherIdentifier(u.phone_number);

      // Cari teacher yang valid dan belum diklaim oleh akun lain
      let matchedIndex = -1;

      if (u.teacher_info?.id && !claimedTeacherIds.has(u.teacher_info.id)) {
        const idxByLink = resultTeachers.findIndex(
          (t) => t.id === u.teacher_info.id && normalizePersonName(t.full_name) === normName
        );
        if (idxByLink !== -1) matchedIndex = idxByLink;
      }

      if (matchedIndex === -1) {
        matchedIndex = resultTeachers.findIndex(
          (t) => !claimedTeacherIds.has(t.id) && t.user_id === u.id && normalizePersonName(t.full_name) === normName
        );
      }

      if (matchedIndex === -1 && cleanNip) {
        matchedIndex = resultTeachers.findIndex(
          (t) => !claimedTeacherIds.has(t.id) && cleanTeacherIdentifier(t.nip) === cleanNip
        );
      }

      if (matchedIndex === -1) {
        matchedIndex = resultTeachers.findIndex(
          (t) => !claimedTeacherIds.has(t.id) && normalizePersonName(t.full_name) === normName
        );
      }

      let linkedTeacher: Teacher;

      if (matchedIndex !== -1) {
        const existing = resultTeachers[matchedIndex];
        claimedTeacherIds.add(existing.id);

        const nextTeacher: Teacher = {
          ...existing,
          user_id: existing.user_id || u.id,
          full_name: existing.full_name || String(u.full_name).trim(),
          title_prefix: existing.title_prefix ?? (u.title_prefix || null),
          title_suffix: existing.title_suffix ?? (u.title_suffix || null),
          nip: cleanTeacherIdentifier(existing.nip) ?? cleanNip,
          nuptk: cleanTeacherIdentifier(existing.nuptk) ?? cleanNuptk,
          gender: existing.gender || (u.gender === 'P' ? 'P' : 'L'),
          phone_number: cleanTeacherIdentifier(existing.phone_number) ?? cleanPhone,
          specialization:
            existing.specialization ||
            u.specialization ||
            (roles.includes('kepala_madrasah') ? 'Kepala Madrasah' : 'Guru Pengampu'),
          is_active: existing.is_active ?? (u.is_active ?? true),
        };

        if (
          nextTeacher.nip !== existing.nip ||
          nextTeacher.nuptk !== existing.nuptk ||
          nextTeacher.phone_number !== existing.phone_number ||
          nextTeacher.user_id !== existing.user_id ||
          nextTeacher.title_suffix !== existing.title_suffix ||
          nextTeacher.specialization !== existing.specialization
        ) {
          resultTeachers[matchedIndex] = nextTeacher;
          teachersChanged = true;
        }
        linkedTeacher = nextTeacher;
      } else {
        linkedTeacher = {
          id: generateTeacherUuid(),
          user_id: u.id,
          full_name: String(u.full_name).trim(),
          title_prefix: u.title_prefix || null,
          title_suffix: u.title_suffix || null,
          nip: cleanNip,
          nuptk: cleanNuptk,
          gender: u.gender === 'P' ? 'P' : 'L',
          phone_number: cleanPhone,
          specialization:
            u.specialization ||
            (roles.includes('kepala_madrasah') ? 'Kepala Madrasah' : 'Guru Pengampu'),
          is_active: u.is_active ?? true,
          created_at: u.created_at || now,
          updated_at: now,
        };
        claimedTeacherIds.add(linkedTeacher.id);
        resultTeachers.push(linkedTeacher);
        newlyCreatedForCloud.push(linkedTeacher);
        teachersChanged = true;
      }

      const needsUserUpdate =
        u.teacher_info?.id !== linkedTeacher.id ||
        u.teacher_info?.nip !== linkedTeacher.nip ||
        u.teacher_info?.specialization !== linkedTeacher.specialization ||
        u.nip !== cleanNip ||
        u.nuptk !== cleanNuptk;

      if (needsUserUpdate) {
        usersChanged = true;
        return {
          ...u,
          nip: cleanNip,
          nuptk: cleanNuptk,
          phone_number: cleanPhone ?? u.phone_number ?? null,
          teacher_info: {
            id: linkedTeacher.id,
            nip: linkedTeacher.nip,
            specialization: linkedTeacher.specialization,
          },
        };
      }

      return u;
    });

    const sorted = [...resultTeachers].sort((a, b) => a.full_name.localeCompare(b.full_name, 'id'));

    if (teachersChanged) {
      setLocal(STORAGE_KEYS.TEACHERS, sorted);
    }
    if (usersChanged) {
      setLocal(USERS_SYNC_STORAGE_KEY, updatedUsers);
    }

    if (isSupabaseConfigured && newlyCreatedForCloud.length > 0) {
      for (const nt of newlyCreatedForCloud) {
        const cloudRow = {
          ...nt,
          user_id: isUuid(nt.user_id) ? nt.user_id : null,
        };
        void supabase
          .from('teachers')
          .upsert(cloudRow, { onConflict: 'id' })
          .then(({ error }) => {
            if (error) console.warn('Background sync teacher ke Supabase dilewati:', error.message);
          });
      }
    }

    return sorted;
  } catch (err) {
    console.warn('Reconcile teachers & accounts error:', err);
    return baseTeachers;
  } finally {
    isReconcilingTeachers = false;
  }
}

let lastCloudSyncError: string | null = null;

export const academicService = {
  getLastCloudSyncError(): string | null {
    return lastCloudSyncError;
  },

  // === SISTEM PENGATURAN ===
  async getSettings(): Promise<SystemSettings> {
    const localSettings = getLocal<SystemSettings | null>(STORAGE_KEYS.SETTINGS, null);
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('system_settings').select('*').limit(1).maybeSingle();
        if (!error && data) {
          const remoteSettings = data as SystemSettings;
          if (
            localSettings &&
            localSettings.updated_at &&
            remoteSettings.updated_at &&
            Date.parse(localSettings.updated_at) > Date.parse(remoteSettings.updated_at)
          ) {
            return localSettings;
          }
          return remoteSettings;
        }
      } catch (err) {
        console.warn('Supabase getSettings fallback:', err);
      }
    }
    return localSettings || DEMO_SYSTEM_SETTINGS;
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
          const seenNames = new Set(remoteTeachers.map((t) => normalizePersonName(t.full_name)));
          const seenNips = new Set(
            remoteTeachers.map((t) => cleanTeacherIdentifier(t.nip)).filter(Boolean) as string[]
          );

          for (const lt of localTeachers) {
            const normName = normalizePersonName(lt.full_name);
            const normNip = cleanTeacherIdentifier(lt.nip);
            if (seenIds.has(lt.id) || (normNip && seenNips.has(normNip)) || seenNames.has(normName)) {
              continue;
            }
            merged.push(lt);
            seenIds.add(lt.id);
            seenNames.add(normName);
            if (normNip) seenNips.add(normNip);
          }

          return reconcileTeachersWithSyncedAccounts(merged);
        }
      } catch (err) {
        console.warn('Supabase getTeachers fallback:', err);
      }
    }
    return reconcileTeachersWithSyncedAccounts(localTeachers);
  },

  async createTeacher(payload: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>): Promise<Teacher> {
    const id = generateTeacherUuid();
    const now = new Date().toISOString();
    const cleanNip = cleanTeacherIdentifier(payload.nip);
    const cleanNuptk = cleanTeacherIdentifier(payload.nuptk);
    const cleanPhone = cleanTeacherIdentifier(payload.phone_number);

    let savedTeacher: Teacher = {
      ...payload,
      nip: cleanNip,
      nuptk: cleanNuptk,
      phone_number: cleanPhone,
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
      ...(payload.nip !== undefined ? { nip: cleanTeacherIdentifier(payload.nip) } : {}),
      ...(payload.nuptk !== undefined ? { nuptk: cleanTeacherIdentifier(payload.nuptk) } : {}),
      ...(payload.phone_number !== undefined ? { phone_number: cleanTeacherIdentifier(payload.phone_number) } : {}),
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

    // Sinkronkan balik perubahan data guru ke akun tertaut di Manajemen Akun
    try {
      const rawUsers = localStorage.getItem(USERS_SYNC_STORAGE_KEY);
      if (rawUsers) {
        const parsedUsers = JSON.parse(rawUsers);
        if (Array.isArray(parsedUsers)) {
          let touched = false;
          const nextUsers = parsedUsers.map((u: any) => {
            if (u.teacher_info?.id === id || (updatedTeacher.user_id && u.id === updatedTeacher.user_id)) {
              touched = true;
              return {
                ...u,
                full_name: updatedTeacher.full_name,
                title_prefix: updatedTeacher.title_prefix,
                title_suffix: updatedTeacher.title_suffix,
                nip: updatedTeacher.nip,
                nuptk: updatedTeacher.nuptk,
                gender: updatedTeacher.gender,
                phone_number: updatedTeacher.phone_number,
                specialization: updatedTeacher.specialization,
                is_active: updatedTeacher.is_active,
                teacher_info: {
                  id: updatedTeacher.id,
                  nip: updatedTeacher.nip,
                  specialization: updatedTeacher.specialization,
                },
              };
            }
            return u;
          });
          if (touched) setLocal(USERS_SYNC_STORAGE_KEY, nextUsers);
        }
      }
    } catch {
      // ignore
    }

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
    const target = localTeachers.find((t) => t.id === id);
    const updated = localTeachers.filter((t) => t.id !== id);
    setLocal(STORAGE_KEYS.TEACHERS, updated);

    // Putuskan tautan di akun agar tidak otomatis dibuat ulang sampai admin mengaktifkan ulang
    try {
      const rawUsers = localStorage.getItem(USERS_SYNC_STORAGE_KEY);
      if (rawUsers) {
        const parsedUsers = JSON.parse(rawUsers);
        if (Array.isArray(parsedUsers)) {
          let touched = false;
          const nextUsers = parsedUsers.map((u: any) => {
            if (u.teacher_info?.id === id || (target?.user_id && u.id === target.user_id)) {
              touched = true;
              return { ...u, teacher_info: null, teacher_detached: true };
            }
            return u;
          });
          if (touched) setLocal(USERS_SYNC_STORAGE_KEY, nextUsers);
        }
      }
    } catch {
      // ignore
    }
  },

  // === RESOLUSI IDENTITAS GURU & WALI KELAS ===
  async resolveTeacherForUser(
    user?: {
      id?: string;
      email?: string;
      profile?: { full_name?: string };
      teacherId?: string | null;
    } | null
  ): Promise<Teacher | null> {
    if (!user) return null;
    const teachers = await this.getTeachers();
    if (teachers.length === 0) return null;

    if (user.teacherId) {
      const byDirectId = teachers.find((t) => t.id === user.teacherId);
      if (byDirectId) return byDirectId;
    }

    if (user.id) {
      const byUserId = teachers.find((t) => t.user_id && t.user_id === user.id);
      if (byUserId) return byUserId;
    }

    try {
      const rawUsers = localStorage.getItem(USERS_SYNC_STORAGE_KEY);
      if (rawUsers) {
        const parsedUsers = JSON.parse(rawUsers);
        if (Array.isArray(parsedUsers)) {
          const emailLower = String(user.email || '').trim().toLowerCase();
          const matchedUser = parsedUsers.find(
            (u: any) =>
              (user.id && u.id === user.id) ||
              (emailLower && String(u.email || '').trim().toLowerCase() === emailLower)
          );
          if (matchedUser?.teacher_info?.id) {
            const byUserCacheId = teachers.find((t) => t.id === matchedUser.teacher_info.id);
            if (byUserCacheId) return byUserCacheId;
          }
          if (matchedUser?.full_name) {
            const normCached = normalizePersonName(matchedUser.full_name);
            const byCachedName = teachers.find((t) => normalizePersonName(t.full_name) === normCached);
            if (byCachedName) return byCachedName;
          }
        }
      }
    } catch {
      // ignore parse error
    }

    const normFull = normalizePersonName(user.profile?.full_name);
    if (normFull) {
      const byExactName = teachers.find((t) => normalizePersonName(t.full_name) === normFull);
      if (byExactName) return byExactName;

      const strippedTarget = stripPersonTitles(user.profile?.full_name);
      if (strippedTarget) {
        const byStripped = teachers.find(
          (t) => stripPersonTitles(t.full_name) === strippedTarget
        );
        if (byStripped) return byStripped;
      }
    }

    return null;
  },

  async resolveHomeroomClassForUser(
    user?: {
      id?: string;
      email?: string;
      profile?: { full_name?: string };
      teacherId?: string | null;
      homeroomClassId?: string | null;
    } | null,
    resolvedTeacher?: Teacher | null
  ): Promise<ClassRoom | null> {
    if (!user) return null;
    const [classes, homerooms] = await Promise.all([
      this.getClasses(),
      this.getHomeroomAssignments(),
    ]);

    const teacher = resolvedTeacher ?? (await this.resolveTeacherForUser(user));
    if (teacher) {
      const hr = homerooms.find((h) => h.teacher_id === teacher.id);
      if (hr) {
        const matched = classes.find((c) => c.id === hr.class_id);
        if (matched) return matched;
      }
      const clsByHr = classes.find((c) => c.homeroom_teacher_id === teacher.id);
      if (clsByHr) return clsByHr;
    }

    if (user.homeroomClassId) {
      const byId = classes.find((c) => c.id === user.homeroomClassId);
      if (byId) return byId;
    }

    return null;
  },

  // === PENUGASAN WALI KELAS (HOMEROOM) ===
  async getHomeroomAssignments(): Promise<HomeroomAssignment[]> {
    const localList = getLocal<HomeroomAssignment[]>(
      STORAGE_KEYS.HOMEROOM_ASSIGNMENTS,
      DEMO_HOMEROOM_ASSIGNMENTS
    );
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('homeroom_assignments')
          .select('*, teacher:teachers(*), class:classes(*)');
        if (!error && Array.isArray(data) && data.length > 0) {
          const remoteList = data as HomeroomAssignment[];
          const merged = [...localList];
          for (const r of remoteList) {
            if (!merged.some((l) => l.class_id === r.class_id)) {
              merged.push(r);
            }
          }
          return merged;
        }
      } catch (err) {
        console.warn('Supabase getHomeroomAssignments fallback:', err);
      }
    }
    return localList;
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

    if (isSupabaseConfigured && isUuid(classId) && isUuid(teacherId) && isUuid(academicYearId)) {
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

    if (isSupabaseConfigured && isUuid(classId)) {
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
    const localRaw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS) : null;
    const localAssignments = getLocal<TeachingAssignment[]>(
      STORAGE_KEYS.ASSIGNMENTS,
      DEMO_TEACHING_ASSIGNMENTS
    );

    let baseAssignments: TeachingAssignment[] = [...localAssignments];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('teaching_assignments')
          .select('*, teacher:teachers(*), class:classes(*), subject:subjects(*)');
        if (!error && Array.isArray(data) && data.length > 0) {
          const remoteAssignments = data as TeachingAssignment[];
          if (localRaw === null) {
            baseAssignments = remoteAssignments;
          } else {
            const seenPairs = new Set(
              baseAssignments.map((a) => `${a.class_id}_${a.subject_id}`)
            );
            for (const ra of remoteAssignments) {
              const pairKey = `${ra.class_id}_${ra.subject_id}`;
              if (!seenPairs.has(pairKey)) {
                baseAssignments.push(ra);
                seenPairs.add(pairKey);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Supabase getTeachingAssignments fallback:', err);
      }
    }

    if (baseAssignments.length === 0) return [];

    // Selalu hidrasi relasi teacher, class, dan subject dari data master terbaru
    const [teachers, classes, subjects] = await Promise.all([
      this.getTeachers(),
      this.getClasses(),
      this.getSubjects(),
    ]);

    return baseAssignments.map((a) => ({
      ...a,
      teacher: teachers.find((t) => t.id === a.teacher_id) || a.teacher,
      class: classes.find((c) => c.id === a.class_id) || a.class,
      subject: subjects.find((s) => s.id === a.subject_id) || a.subject,
    }));
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

    if (
      isSupabaseConfigured &&
      isUuid(payload.class_id) &&
      isUuid(payload.subject_id) &&
      isUuid(payload.teacher_id) &&
      isUuid(payload.academic_year_id) &&
      isUuid(payload.semester_id)
    ) {
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
      if (isSupabaseConfigured && isUuid(classId) && isUuid(subjectId)) {
        try {
          const matchObj: Record<string, string> = { class_id: classId, subject_id: subjectId };
          if (isUuid(academicYearId)) matchObj.academic_year_id = academicYearId;
          if (isUuid(semesterId)) matchObj.semester_id = semesterId;
          await supabase.from('teaching_assignments').delete().match(matchObj);
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
        academic_year_id: academicYearId || current[existingIndex].academic_year_id,
        semester_id: semesterId || current[existingIndex].semester_id,
        teacher: teacher || current[existingIndex].teacher,
        class: cls || current[existingIndex].class,
        subject: subject || current[existingIndex].subject,
      };
      result = current[existingIndex];
      setLocal(STORAGE_KEYS.ASSIGNMENTS, [...current]);

      if (isSupabaseConfigured && isUuid(result.id) && isUuid(teacherId)) {
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

      if (
        isSupabaseConfigured &&
        isUuid(classId) &&
        isUuid(subjectId) &&
        isUuid(teacherId) &&
        isUuid(academicYearId) &&
        isUuid(semesterId)
      ) {
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
