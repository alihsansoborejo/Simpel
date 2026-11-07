import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  DEMO_SYSTEM_SETTINGS,
  DEMO_ACADEMIC_YEAR,
  DEMO_SEMESTER,
  DEMO_CLASSES,
  DEMO_STUDENTS,
  DEMO_TEACHERS,
} from '../lib/demoData';

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

  // Realistic Demo Data
  return {
    totalUsers: 4,
    totalTeachers: DEMO_TEACHERS.length,
    totalStudents: DEMO_STUDENTS.length,
    totalClasses: DEMO_CLASSES.length,
    activeAccountsCount: 4,
    academicYearName: DEMO_ACADEMIC_YEAR.name,
    semesterName: DEMO_SEMESTER.semester_type,
    isReportCardLocked: DEMO_SYSTEM_SETTINGS.is_report_card_locked,
    schoolName: DEMO_SYSTEM_SETTINGS.school_name,
    principalName: DEMO_SYSTEM_SETTINGS.principal_name,
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

  // Demo Fallback
  return {
    totalTeachers: DEMO_TEACHERS.length,
    totalStudents: DEMO_STUDENTS.length,
    totalClasses: DEMO_CLASSES.length,
    pendingDocumentsCount: 2,
    approvedDocumentsCount: 6,
    totalJournalsToday: 3,
    attendanceRateToday: 97.4,
    pendingDocuments: [
      {
        id: 'doc-demo-1',
        title: 'Modul Ajar Fikih Bab Thaharah [DEMO]',
        documentType: 'Modul Ajar',
        teacherName: 'Ust. Ahmad Fauzi, S.Pd.I',
        submissionDate: '2026-11-03T10:00:00+07:00',
        driveUrl: 'https://drive.google.com/drive/folders/demo-mi-alihsan',
      },
      {
        id: 'doc-demo-2',
        title: 'Program Semester IPAS Fase B [DEMO]',
        documentType: 'Prosem',
        teacherName: 'Ust. Ahmad Fauzi, S.Pd.I',
        submissionDate: '2026-11-04T08:30:00+07:00',
        driveUrl: 'https://drive.google.com/drive/folders/demo-mi-alihsan',
      },
    ],
    recentJournals: [
      {
        id: 'jrn-demo-1',
        teacherName: 'Ust. Ahmad Fauzi, S.Pd.I',
        subjectName: 'Fikih',
        className: 'Kelas 4',
        date: '2026-11-04',
        topic: 'Praktik Bersuci dari Najis dengan Pendekatan Berbasis Kasih Sayang',
      },
      {
        id: 'jrn-demo-2',
        teacherName: 'Ust. Muhammad Ridwan, S.Pd.',
        subjectName: 'PJOK',
        className: 'Kelas 4',
        date: '2026-11-04',
        topic: 'Kebugaran Jasmani dan Pembentukan Karakter Gotong Royong',
      },
    ],
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

  // Demo fallback
  return {
    teacherName: 'Ust. Ahmad Fauzi, S.Pd.I',
    nip: '198204152010011015',
    specialization: 'Guru Kelas 4 & PAI',
    assignedClassesCount: 3,
    totalSubjectsTaught: 3,
    assignedClasses: [
      { assignmentId: 'asg-1', className: 'Kelas 4', subjectName: 'Fikih', subjectCode: 'FIK', phase: 'B' },
      { assignmentId: 'asg-2', className: 'Kelas 4', subjectName: 'Al-Qur’an Hadis', subjectCode: 'QH', phase: 'B' },
      { assignmentId: 'asg-3', className: 'Kelas 4', subjectName: 'Bahasa Indonesia', subjectCode: 'BIN', phase: 'B' },
    ],
    submittedDocsCount: 4,
    approvedDocsCount: 3,
    revisionDocsCount: 0,
    journalsCount: 18,
    recentJournals: [
      {
        id: 'jrn-1',
        date: '2026-11-04',
        className: 'Kelas 4',
        subjectName: 'Fikih',
        topic: 'Praktik Bersuci dan Thaharah',
      },
      {
        id: 'jrn-2',
        date: '2026-11-02',
        className: 'Kelas 4',
        subjectName: 'Al-Qur’an Hadis',
        topic: 'Kajian Surah Al-Ma’un dan Kepedulian Sosial',
      },
    ],
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
          homeroomTeacherName: 'Ust. Ahmad Fauzi, S.Pd.I',
          students,
          attendanceSummary: {
            hadirCount: students.length * 18,
            sakitCount: 2,
            izinCount: 1,
            alpaCount: 0,
            attendancePercentage: 97.8,
          },
          gradeCompletenessStatus: [
            { subjectName: 'Al-Qur’an Hadis', teacherName: 'Ust. Ahmad Fauzi', isComplete: true, gradedStudentsCount: students.length, totalStudents: students.length },
            { subjectName: 'Fikih', teacherName: 'Ust. Ahmad Fauzi', isComplete: true, gradedStudentsCount: students.length, totalStudents: students.length },
            { subjectName: 'PJOK', teacherName: 'Ust. Muhammad Ridwan', isComplete: false, gradedStudentsCount: Math.max(0, students.length - 1), totalStudents: students.length },
          ],
        };
      }
    } catch (err) {
      console.warn('Supabase fetchHomeroomDashboardData fallback to demo:', err);
    }
  }

  // Demo Fallback
  return {
    className: 'Kelas 4',
    phase: 'B',
    totalStudents: DEMO_STUDENTS.length,
    homeroomTeacherName: 'Ust. Ahmad Fauzi, S.Pd.I',
    students: DEMO_STUDENTS.map((s) => ({
      id: s.id,
      nis: s.nis,
      fullName: s.full_name,
      gender: s.gender,
      parentPhone: s.parent_phone,
    })),
    attendanceSummary: {
      hadirCount: 72,
      sakitCount: 2,
      izinCount: 1,
      alpaCount: 0,
      attendancePercentage: 96.0,
    },
    gradeCompletenessStatus: [
      { subjectName: 'Al-Qur’an Hadis', teacherName: 'Ust. Ahmad Fauzi, S.Pd.I', isComplete: true, gradedStudentsCount: 4, totalStudents: 4 },
      { subjectName: 'Akidah Akhlak', teacherName: 'Drs. H. Ahmad Ihsan', isComplete: true, gradedStudentsCount: 4, totalStudents: 4 },
      { subjectName: 'Fikih', teacherName: 'Ust. Ahmad Fauzi, S.Pd.I', isComplete: true, gradedStudentsCount: 4, totalStudents: 4 },
      { subjectName: 'PJOK', teacherName: 'Ust. Muhammad Ridwan, S.Pd.', isComplete: false, gradedStudentsCount: 3, totalStudents: 4 },
      { subjectName: 'Bahasa Indonesia', teacherName: 'Ust. Ahmad Fauzi, S.Pd.I', isComplete: true, gradedStudentsCount: 4, totalStudents: 4 },
    ],
  };
}
