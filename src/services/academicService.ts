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

export const academicService = {
  // === SISTEM PENGATURAN ===
  async getSettings(): Promise<SystemSettings> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('system_settings').select('*').limit(1).single();
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
    if (isSupabaseConfigured) {
      try {
        await supabase.from('system_settings').update(settings).eq('id', current.id);
      } catch (err) {
        console.warn('Supabase updateSettings fallback:', err);
      }
    }
    setLocal(STORAGE_KEYS.SETTINGS, updated);
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
    const newYear: AcademicYear = {
      ...payload,
      id: `ay-${Date.now()}`,
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
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('classes').select('*').order('level', { ascending: true });
        if (!error && data && data.length > 0) return data as ClassRoom[];
      } catch (err) {
        console.warn('Supabase getClasses fallback:', err);
      }
    }
    return getLocal<ClassRoom[]>(STORAGE_KEYS.CLASSES, DEMO_CLASSES);
  },

  async createClass(payload: Omit<ClassRoom, 'id' | 'created_at'>): Promise<ClassRoom> {
    const newClass: ClassRoom = {
      ...payload,
      id: `cls-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('classes').insert(newClass).select().single();
        if (data) return data as ClassRoom;
      } catch (err) {
        console.warn('Supabase createClass fallback:', err);
      }
    }
    const classes = await this.getClasses();
    const updated = [...classes, newClass].sort((a, b) => a.level - b.level);
    setLocal(STORAGE_KEYS.CLASSES, updated);
    return newClass;
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
    const newStudent: Student = {
      ...payload,
      id: `std-${Date.now()}`,
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
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('teachers').select('*').order('full_name', { ascending: true });
        if (!error && data && data.length > 0) return data as Teacher[];
      } catch (err) {
        console.warn('Supabase getTeachers fallback:', err);
      }
    }
    return getLocal<Teacher[]>(STORAGE_KEYS.TEACHERS, DEMO_TEACHERS);
  },

  async createTeacher(payload: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>): Promise<Teacher> {
    const newTeacher: Teacher = {
      ...payload,
      id: `tch-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('teachers').insert(newTeacher).select().single();
        if (data) return data as Teacher;
      } catch (err) {
        console.warn('Supabase createTeacher fallback:', err);
      }
    }
    const teachers = await this.getTeachers();
    const updated = [newTeacher, ...teachers];
    setLocal(STORAGE_KEYS.TEACHERS, updated);
    return newTeacher;
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
    const newSubject: Subject = {
      ...payload,
      id: `sbj-${Date.now()}`,
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
