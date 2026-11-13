import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  DEMO_ACADEMIC_YEAR,
  DEMO_SEMESTER,
} from '../lib/demoData';
import { academicService } from './academicService';
import { fetchUsersList } from './userService';
import { curriculumService } from './curriculumService';
import { journalService } from './journalService';
import { supervisionService } from './supervisionService';
import { attendanceService } from './attendanceService';
import { reportService } from './reportService';

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

export interface TeacherAssignedSlot {
  assignmentId: string;
  classId: string;
  className: string;
  classLevel: number;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectCategory: string;
  phase: string;
}

export interface TeacherSubjectGroup {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectCategory: string;
  classes: TeacherAssignedSlot[];
}

export interface TeacherDashboardData {
  teacherId: string | null;
  teacherName: string;
  nip: string;
  specialization: string;
  academicYearName: string;
  semesterName: string;
  kktpDefault: number;
  assignedClassesCount: number;
  totalSubjectsTaught: number;
  assignedClasses: TeacherAssignedSlot[];
  subjectsSummary: TeacherSubjectGroup[];
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
  recentSupervision: {
    id: string;
    date: string;
    supervisorName: string;
    subjectName: string;
    className: string;
    totalScore: number;
    predicate: string;
    recommendations: string;
  } | null;
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
          principalName: settingsRes.data?.principal_name || 'Kepala Madrasah',
        };
      }
    } catch (err) {
      console.warn('Supabase fetchAdminDashboardData fallback to demo:', err);
    }
  }

  // Fallback ke penyimpanan data lokal
  const [users, teachers, students, classes, settings, years, semesters] = await Promise.all([
    fetchUsersList(),
    academicService.getTeachers(),
    academicService.getStudents(),
    academicService.getClasses(),
    academicService.getSettings(),
    academicService.getAcademicYears(),
    academicService.getSemesters(),
  ]);

  const activeYear = years.find((y) => y.is_active) || years[0] || DEMO_ACADEMIC_YEAR;
  const activeSemester = semesters.find((s) => s.is_active) || semesters[0] || DEMO_SEMESTER;

  return {
    totalUsers: users.length,
    totalTeachers: teachers.length,
    totalStudents: students.length,
    totalClasses: classes.length,
    activeAccountsCount: users.filter((u) => u.is_active).length,
    academicYearName: activeYear.name,
    semesterName: activeSemester.semester_type,
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

      if (!teachersCount.error && (teachersCount.count || 0) > 0) {
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
          attendanceRateToday: 0,
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

export async function fetchTeacherDashboardData(
  teacherId?: string | null,
  currentUser?: {
    id?: string;
    email?: string;
    profile?: { full_name?: string; nip?: string | null };
    teacherId?: string | null;
  } | null
): Promise<TeacherDashboardData> {
  const [resolvedTeacher, allAssignments, settings, years, semesters] = await Promise.all([
    academicService.resolveTeacherForUser(
      currentUser || (teacherId ? { teacherId } : null)
    ),
    academicService.getTeachingAssignments(),
    academicService.getSettings(),
    academicService.getAcademicYears(),
    academicService.getSemesters(),
  ]);

  const effectiveTeacherId = resolvedTeacher?.id || teacherId || null;
  const activeYear = years.find((y) => y.id === settings.active_academic_year_id) || years.find((y) => y.is_active) || DEMO_ACADEMIC_YEAR;
  const activeSemester = semesters.find((s) => s.id === settings.active_semester_id) || semesters.find((s) => s.is_active) || DEMO_SEMESTER;

  const teacherAssignments = effectiveTeacherId
    ? allAssignments.filter((a) => a.teacher_id === effectiveTeacherId)
    : [];

  const assignedClasses: TeacherAssignedSlot[] = teacherAssignments
    .filter((a) => a.class && a.subject)
    .map((a) => ({
      assignmentId: a.id,
      classId: a.class_id,
      className: a.class?.name || 'Kelas',
      classLevel: a.class?.level || 4,
      subjectId: a.subject_id,
      subjectName: a.subject?.name || 'Mata Pelajaran',
      subjectCode: a.subject?.code || '-',
      subjectCategory: a.subject?.category || 'Umum',
      phase: a.class?.phase || 'B',
    }))
    .sort((a, b) => a.classLevel - b.classLevel || a.subjectName.localeCompare(b.subjectName, 'id'));

  const subjectGroupMap = new Map<string, TeacherSubjectGroup>();
  for (const slot of assignedClasses) {
    const existing = subjectGroupMap.get(slot.subjectId);
    if (existing) {
      existing.classes.push(slot);
    } else {
      subjectGroupMap.set(slot.subjectId, {
        subjectId: slot.subjectId,
        subjectName: slot.subjectName,
        subjectCode: slot.subjectCode,
        subjectCategory: slot.subjectCategory,
        classes: [slot],
      });
    }
  }
  const subjectsSummary = Array.from(subjectGroupMap.values());

  const [docs, journals, supervisions] = await Promise.all([
    effectiveTeacherId ? curriculumService.getDocuments({ teacherId: effectiveTeacherId }) : Promise.resolve([]),
    effectiveTeacherId ? journalService.getJournals({ teacherId: effectiveTeacherId }) : Promise.resolve([]),
    effectiveTeacherId ? supervisionService.getRecords({ teacherId: effectiveTeacherId }) : Promise.resolve([]),
  ]);

  const latestSupervision = supervisions[0] || null;
  const teacherFullName = resolvedTeacher
    ? `${resolvedTeacher.title_prefix ? resolvedTeacher.title_prefix + ' ' : ''}${resolvedTeacher.full_name}${resolvedTeacher.title_suffix ? ', ' + resolvedTeacher.title_suffix : ''}`.trim()
    : currentUser?.profile?.full_name || 'Guru Madrasah';

  return {
    teacherId: effectiveTeacherId,
    teacherName: teacherFullName,
    nip: resolvedTeacher?.nip || currentUser?.profile?.nip || '-',
    specialization: resolvedTeacher?.specialization || 'Pendidik',
    academicYearName: activeYear.name,
    semesterName: activeSemester.semester_type,
    kktpDefault: Number(settings.kktp_default) || 75,
    assignedClassesCount: assignedClasses.length,
    totalSubjectsTaught: subjectsSummary.length,
    assignedClasses,
    subjectsSummary,
    submittedDocsCount: docs.length,
    approvedDocsCount: docs.filter((d) => d.status === 'Disetujui').length,
    revisionDocsCount: docs.filter((d) => d.status === 'Perlu Revisi').length,
    journalsCount: journals.length,
    recentJournals: journals.slice(0, 5).map((j) => ({
      id: j.id,
      date: j.date,
      className: j.assignment?.class?.name || 'Kelas',
      subjectName: j.assignment?.subject?.name || 'Mata Pelajaran',
      topic: j.topic,
    })),
    recentSupervision: latestSupervision
      ? {
          id: latestSupervision.id,
          date: latestSupervision.supervision_date,
          supervisorName: latestSupervision.supervisor?.full_name || settings.principal_name || 'Kepala Madrasah',
          subjectName: latestSupervision.subject?.name || 'Mata Pelajaran',
          className: latestSupervision.class?.name || 'Kelas',
          totalScore: Number(latestSupervision.total_score) || 0,
          predicate: latestSupervision.predicate || '-',
          recommendations:
            latestSupervision.recommendations ||
            latestSupervision.strengths ||
            'Supervisi tercatat dalam sistem.',
        }
      : null,
  };
}

export async function fetchHomeroomDashboardData(
  homeroomClassId?: string | null,
  currentUser?: {
    id?: string;
    email?: string;
    profile?: { full_name?: string };
    teacherId?: string | null;
    homeroomClassId?: string | null;
  } | null
): Promise<HomeroomDashboardData> {
  const homeroomClass = await academicService.resolveHomeroomClassForUser(
    currentUser || (homeroomClassId ? { homeroomClassId } : null)
  );

  if (!homeroomClass) {
    return {
      className: 'Belum Ada Rombel Ditugaskan',
      phase: '-',
      totalStudents: 0,
      homeroomTeacherName: currentUser?.profile?.full_name || '-',
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

  const [allStudents, members, attendances, assignments] = await Promise.all([
    academicService.getStudents(),
    academicService.getClassMembers(homeroomClass.id),
    attendanceService.getAttendance({ classId: homeroomClass.id }),
    academicService.getTeachingAssignments(),
  ]);

  const enrolledIds = new Set(members.map((m) => m.student_id));
  const classStudents = allStudents
    .filter((s) => enrolledIds.has(s.id))
    .map((s) => ({
      id: s.id,
      nis: s.nis,
      fullName: s.full_name,
      gender: s.gender,
      parentPhone: s.parent_phone || null,
    }));

  const stats = attendanceService.getStats(attendances);
  const classAssignments = assignments.filter((a) => a.class_id === homeroomClass.id);

  const gradeCompletenessStatus = await Promise.all(
    classAssignments.map(async (asg) => {
      const ledger = await reportService.getSubjectLedger(homeroomClass.id, asg.subject_id);
      const gradedCount = ledger.filter((r) => r.finalScore > 0).length;
      const teacherName = asg.teacher
        ? `${asg.teacher.title_prefix ? asg.teacher.title_prefix + ' ' : ''}${asg.teacher.full_name}${asg.teacher.title_suffix ? ', ' + asg.teacher.title_suffix : ''}`.trim()
        : 'Guru Pengampu';
      return {
        subjectName: asg.subject?.name || 'Mata Pelajaran',
        teacherName,
        isComplete: classStudents.length > 0 && gradedCount >= classStudents.length,
        gradedStudentsCount: gradedCount,
        totalStudents: classStudents.length,
      };
    })
  );

  const homeroomTeacher = homeroomClass.homeroom_teacher;
  const homeroomTeacherName = homeroomTeacher
    ? `${homeroomTeacher.title_prefix ? homeroomTeacher.title_prefix + ' ' : ''}${homeroomTeacher.full_name}${homeroomTeacher.title_suffix ? ', ' + homeroomTeacher.title_suffix : ''}`.trim()
    : currentUser?.profile?.full_name || 'Wali Kelas';

  return {
    className: homeroomClass.name,
    phase: homeroomClass.phase,
    totalStudents: classStudents.length,
    homeroomTeacherName,
    students: classStudents,
    attendanceSummary: {
      hadirCount: stats.hadir,
      sakitCount: stats.sakit,
      izinCount: stats.izin,
      alpaCount: stats.alpa,
      attendancePercentage: stats.hadirPercentage,
    },
    gradeCompletenessStatus,
  };
}

