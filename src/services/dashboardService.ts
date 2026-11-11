import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  DEMO_SYSTEM_SETTINGS,
  DEMO_ACADEMIC_YEAR,
  DEMO_SEMESTER,
  DEMO_CLASSES,
  DEMO_STUDENTS,
  DEMO_TEACHERS,
  DEMO_USERS,
} from '../lib/demoData';
import { academicService } from './academicService';
import { fetchUsersList } from './userService';
import { curriculumService } from './curriculumService';
import { journalService } from './journalService';

export interface AdminDashboardData {
  totalUsers: number;
  totalTeachers: number;
  totalStudents: number;
  totalClasses: number;
  activeAccountsCount: number;
  academicYearName: string;
  semesterName: string;
  isReportCardLocked: boolean;
  schoolName: string;
  principalName: string;
}

export interface PrincipalDashboardData {
  totalTeachers: number;
  totalStudents: number;
  totalClasses: number;
  pendingDocumentsCount: number;
  approvedDocumentsCount: number;
  totalJournalsToday: number;
  attendanceRateToday: number;
  pendingDocuments: Array<{
    id: string;
    title: string;
    documentType: string;
    teacherName: string;
    submissionDate: string;
    driveUrl: string;
  }>;
  recentJournals: Array<{
    id: string;
    teacherName: string;
    subjectName: string;
    className: string;
    date: string;
    topic: string;
  }>;
}

export interface TeacherDashboardData {
  teacherName: string;
  nip: string;
  specialization: string;
  assignedClassesCount: number;
  totalSubjectsTaught: number;
  assignedClasses: Array<{
    assignmentId: string;
    className: string;
    subjectName: string;
    subjectCode: string;
    phase: string;
  }>;
  submittedDocsCount: number;
  approvedDocsCount: number;
  revisionDocsCount: number;
  journalsCount: number;
  recentJournals: Array<{
    id: string;
    date: string;
    className: string;
    subjectName: string;
    topic: string;
  }>;
}

export interface HomeroomDashboardData {
  className: string;
  phase: string;
  totalStudents: number;
  homeroomTeacherName: string;
  students: Array<{
    id: string;
    nis: string;
    fullName: string;
    gender: 'L' | 'P';
    parentPhone: string | null;
  }>;
  attendanceSummary: {
    hadirCount: number;
    sakitCount: number;
    izinCount: number;
    alpaCount: number;
    attendancePercentage: number;
  };
  gradeCompletenessStatus: Array<{
    subjectName: string;
    teacherName: string;
    isComplete: boolean;
    gradedStudentsCount: number;
    totalStudents: number;
  }>;
}

export async function fetchAdminDashboardData(): Promise<AdminDashboardData> {
  if (isSupabaseConfigured) {
    try {
      const [usersRes, teachersRes, studentsRes, classesRes, activeYearRes, activeSemRes, settingsRes] =
        await Promise.all([
          supabase.from('profiles').select('id, is_active', { count: 'exact' }),
          supabase.from('teachers').select('id', { count: 'exact' }),
          supabase.from('students').select('id', { count: 'exact' }),
          supabase.from('classes').select('id', { count: 'exact' }),
          supabase.from('academic_years').select('name').eq('is_active', true).maybeSingle(),
          supabase.from('semesters').select('semester_type').eq('is_active', true).maybeSingle(),
          supabase.from('system_settings').select('*').limit(1).maybeSingle(),
        ]);

      if (!usersRes.error && usersRes.count !== null) {
        const activeCount = (usersRes.data || []).filter((u: any) => u.is_active).length;

        return {
          totalUsers: usersRes.count || 0,
          totalTeachers: teachersRes.count || 0,
          totalStudents: studentsRes.count || 0,
          totalClasses: classesRes.count || 0,
          activeAccountsCount: activeCount,
          academicYearName: activeYearRes.data?.name || '2026/2027',
          semesterName: activeSemRes.data?.semester_type || 'Ganjil',
          isReportCardLocked: settingsRes.data?.is_report_card_locked || false,
          schoolName: settingsRes.data?.school_name || 'MI Ma’arif Al Ihsan Soborejo',
          principalName: settingsRes.data?.principal_name || 'Drs. H. Ahmad Ihsan, M.Pd.I',
        };
      }
    } catch (err) {
      console.warn('Supabase fetchAdminDashboardData fallback to demo:', err);
    }
  }

  // Fallback ke penyimpanan data lokal
  const [users, teachers, students, classes, settings] = await Promise.all([
    fetchUsersList(),
    academicService.getTeachers(),
    academicService.getStudents(),
    academicService.getClasses(),
    academicService.getSettings(),
  ]);

  return {
    totalUsers: users.length,
    totalTeachers: teachers.length,
    totalStudents: students.length,
    totalClasses: classes.length,
    activeAccountsCount: users.filter((u) => u.is_active).length,
    academicYearName: DEMO_ACADEMIC_YEAR.name,
    semesterName: DEMO_SEMESTER.semester_type,
    isReportCardLocked: settings.is_report_card_locked,
    schoolName: settings.school_name,
    principalName: settings.principal_name,
  };
}

export async function fetchPrincipalDashboardData(): Promise<PrincipalDashboardData> {
  if (isSupabaseConfigured) {
    try {
      const [teachersCount, studentsCount, classesCount, docsRes, journalsRes] = await Promise.all([
        supabase.from('teachers').select('id', { count: 'exact' }),
        supabase.from('students').select('id', { count: 'exact' }),
        supabase.from('classes').select('id', { count: 'exact' }),
        supabase
          .from('document_links')
          .select('id, title, document_type, status, submission_date, google_drive_url, teacher:teachers(full_name)')
          .order('submission_date', { ascending: false }),
        supabase
          .from('teaching_journals')
          .select(`
            id, date, topic,
            assignment:teaching_assignments (
              teacher:teachers(full_name),
              subject:subjects(name),
              class:classes(name)
            )
          `)
          .order('date', { ascending: false })
          .limit(5),
      ]);

      if (!teachersCount.error) {
        const docs = docsRes.data || [];
        const pending = docs.filter((d: any) => d.status === 'Diajukan');
        const approved = docs.filter((d: any) => d.status === 'Disetujui');

        return {
          totalTeachers: teachersCount.count || 0,
          totalStudents: studentsCount.count || 0,
          totalClasses: classesCount.count || 0,
          pendingDocumentsCount: pending.length,
          approvedDocumentsCount: approved.length,
          totalJournalsToday: (journalsRes.data || []).length,
          attendanceRateToday: 96.5,
          pendingDocuments: pending.map((d: any) => ({
            id: d.id,
            title: d.title,
            documentType: d.document_type,
            teacherName: d.teacher?.full_name || 'Dewan Guru',
            submissionDate: d.submission_date || new Date().toISOString(),
            driveUrl: d.google_drive_url,
          })),
          recentJournals: (journalsRes.data || []).map((j: any) => ({
            id: j.id,
            teacherName: j.assignment?.teacher?.full_name || 'Guru Pengampu',
            subjectName: j.assignment?.subject?.name || 'Mata Pelajaran',
            className: j.assignment?.class?.name || 'Kelas',
            date: j.date,
            topic: j.topic,
          })),
        };
      }
    } catch (err) {
      console.warn('Supabase fetchPrincipalDashboardData fallback to demo:', err);
    }
  }

  // Fallback ke penyimpanan data lokal
  const [teachers, students, classes, docs, journals] = await Promise.all([
    academicService.getTeachers(),
    academicService.getStudents(),
    academicService.getClasses(),
    curriculumService.getDocuments(),
    journalService.getJournals(),
  ]);

  const pendingDocs = docs.filter((d) => d.status === 'Diajukan');
  const approvedDocs = docs.filter((d) => d.status === 'Disetujui');

  return {
    totalTeachers: teachers.length,
    totalStudents: students.length,
    totalClasses: classes.length,
    pendingDocumentsCount: pendingDocs.length,
    approvedDocumentsCount: approvedDocs.length,
    totalJournalsToday: journals.length,
    attendanceRateToday: 0,
    pendingDocuments: pendingDocs.map((d) => ({
      id: d.id,
      title: d.title,
      documentType: d.document_type,
      teacherName: d.teacher?.full_name || 'Guru Madrasah',
      submissionDate: d.submission_date || d.created_at,
      driveUrl: d.google_drive_url,
    })),
    recentJournals: journals.slice(0, 5).map((j) => ({
      id: j.id,
      teacherName: j.assignment?.teacher?.full_name || 'Guru',
      subjectName: j.assignment?.subject?.name || 'Mata Pelajaran',
      className: j.assignment?.class?.name || 'Kelas',
      date: j.date,
      topic: j.topic,
    })),
  };
}

export async function fetchTeacherDashboardData(teacherId?: string | null): Promise<TeacherDashboardData> {
  if (isSupabaseConfigured && teacherId) {
    try {
      const [teacherRes, assignmentsRes, docsRes, journalsRes] = await Promise.all([
        supabase.from('teachers').select('*').eq('id', teacherId).single(),
        supabase
          .from('teaching_assignments')
          .select('id, class:classes(name, phase), subject:subjects(name, code)')
          .eq('teacher_id', teacherId),
        supabase.from('document_links').select('id, status').eq('teacher_id', teacherId),
        supabase
          .from('teaching_journals')
          .select(`
            id, date, topic,
            assignment:teaching_assignments!inner (
              teacher_id,
              class:classes(name),
              subject:subjects(name)
            )
          `)
          .eq('assignment.teacher_id', teacherId)
          .order('date', { ascending: false })
          .limit(5),
      ]);

      if (!teacherRes.error && teacherRes.data) {
        const assignments = (assignmentsRes.data || []).map((a: any) => ({
          assignmentId: a.id,
          className: a.class?.name || '',
          subjectName: a.subject?.name || '',
          subjectCode: a.subject?.code || '',
          phase: a.class?.phase || 'B',
        }));

        const docs = docsRes.data || [];

        return {
          teacherName: teacherRes.data?.full_name || 'Guru Madrasah',
          nip: teacherRes.data?.nip || '-',
          specialization: teacherRes.data?.specialization || 'Pendidik',
          assignedClassesCount: assignments.length,
          totalSubjectsTaught: new Set(assignments.map((a) => a.subjectCode)).size,
          assignedClasses: assignments,
          submittedDocsCount: docs.length,
          approvedDocsCount: docs.filter((d: any) => d.status === 'Disetujui').length,
          revisionDocsCount: docs.filter((d: any) => d.status === 'Perlu Revisi').length,
          journalsCount: (journalsRes.data || []).length,
          recentJournals: (journalsRes.data || []).map((j: any) => ({
            id: j.id,
            date: j.date,
            className: j.assignment?.class?.name || 'Kelas',
            subjectName: j.assignment?.subject?.name || 'Mapel',
            topic: j.topic,
          })),
        };
      }
    } catch (err) {
      console.warn('Supabase fetchTeacherDashboardData fallback to demo:', err);
    }
  }

  // Fallback ketika belum ada penugasan guru
  return {
    teacherName: 'Guru Madrasah',
    nip: '-',
    specialization: 'Pendidik',
    assignedClassesCount: 0,
    totalSubjectsTaught: 0,
    assignedClasses: [],
    submittedDocsCount: 0,
    approvedDocsCount: 0,
    revisionDocsCount: 0,
    journalsCount: 0,
    recentJournals: [],
  };
}

export async function fetchHomeroomDashboardData(homeroomClassId?: string | null): Promise<HomeroomDashboardData> {
  if (isSupabaseConfigured && homeroomClassId) {
    try {
      const [classRes, studentsRes] = await Promise.all([
        supabase.from('classes').select('name, phase').eq('id', homeroomClassId).single(),
        supabase
          .from('class_members')
          .select('student:students(id, nis, full_name, gender, parent_phone)')
          .eq('class_id', homeroomClassId),
      ]);

      if (!classRes.error && classRes.data) {
        const students = (studentsRes.data || []).map((m: any) => ({
          id: m.student?.id || '',
          nis: m.student?.nis || '',
          fullName: m.student?.full_name || '',
          gender: m.student?.gender || 'L',
          parentPhone: m.student?.parent_phone || null,
        }));

        return {
          className: classRes.data?.name || 'Kelas Binaan',
          phase: classRes.data?.phase || 'B',
          totalStudents: students.length,
          homeroomTeacherName: 'Wali Kelas',
          students,
          attendanceSummary: {
            hadirCount: 0,
            sakitCount: 0,
            izinCount: 0,
            alpaCount: 0,
            attendancePercentage: 0,
          },
          gradeCompletenessStatus: [],
        };
      }
    } catch (err) {
      console.warn('Supabase fetchHomeroomDashboardData fallback to demo:', err);
    }
  }

  // Fallback ketika belum ada rombel aktif
  return {
    className: 'Belum Ada Rombel Ditugaskan',
    phase: '-',
    totalStudents: 0,
    homeroomTeacherName: '-',
    students: [],
    attendanceSummary: {
      hadirCount: 0,
      sakitCount: 0,
      izinCount: 0,
      alpaCount: 0,
      attendancePercentage: 0,
    },
    gradeCompletenessStatus: [],
  };
}
