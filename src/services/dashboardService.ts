import { supabase, isSupabaseAvailable, reportSupabaseOutcome } from '../lib/supabaseClient';
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

export interface PrincipalDocumentSummary {
  id: string;
  title: string;
  documentType: string;
  teacherName: string;
  className: string;
  subjectName: string;
  status: 'Draft' | 'Diajukan' | 'Disetujui' | 'Perlu Revisi';
  submissionDate: string;
  driveUrl: string;
  fileId: string | null;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
}

export interface PrincipalDashboardData {
  totalTeachers: number;
  totalStudents: number;
  totalClasses: number;
  pendingDocumentsCount: number;
  approvedDocumentsCount: number;
  revisionDocumentsCount: number;
  totalSupervisions: number;
  totalJournalsToday: number;
  pendingDocuments: PrincipalDocumentSummary[];
  submittedDocuments: PrincipalDocumentSummary[];
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
  classId: string | null;
  className: string;
  phase: string;
  totalStudents: number;
  homeroomTeacherName: string;
  officials: Array<{
    id: string;
    roleName: string;
    studentName: string;
    nis: string;
  }>;
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
  if (isSupabaseAvailable()) {
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

      const firstErr =
        usersRes.error ||
        teachersRes.error ||
        studentsRes.error ||
        classesRes.error ||
        activeYearRes.error ||
        activeSemRes.error ||
        settingsRes.error ||
        null;
      reportSupabaseOutcome(firstErr);

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
      reportSupabaseOutcome(err);
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
  const [teachers, students, classes, subjects, docs, reviews, journals, supervisions] = await Promise.all([
    academicService.getTeachers(),
    academicService.getStudents(),
    academicService.getClasses(),
    academicService.getSubjects(),
    curriculumService.getDocuments(),
    curriculumService.getAllReviews(),
    journalService.getJournals(),
    supervisionService.getRecords(),
  ]);

  const classMap = new Map(classes.map((c) => [c.id, c.name]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
  const latestReviewByDoc = new Map<string, { notes: string; reviewedAt: string }>();
  for (const rev of reviews) {
    if (!latestReviewByDoc.has(rev.document_link_id)) {
      latestReviewByDoc.set(rev.document_link_id, {
        notes: rev.review_notes || '',
        reviewedAt: rev.reviewed_at || '',
      });
    }
  }

  const submittedDocuments: PrincipalDocumentSummary[] = docs
    .filter((d) => d.status !== 'Draft')
    .map((d) => {
      const latestRev = latestReviewByDoc.get(d.id);
      return {
        id: d.id,
        title: d.title,
        documentType: d.document_type,
        teacherName: d.teacher?.full_name || 'Guru Madrasah',
        className: d.class?.name || (d.class_id ? classMap.get(d.class_id) : undefined) || 'Semua Kelas',
        subjectName: d.subject?.name || (d.subject_id ? subjectMap.get(d.subject_id) : undefined) || 'Mata Pelajaran',
        status: d.status,
        submissionDate: d.submission_date || d.created_at,
        driveUrl: d.google_drive_url,
        fileId: d.file_id || null,
        reviewNotes: latestRev?.notes || null,
        reviewedAt: latestRev?.reviewedAt || null,
      };
    });

  const pendingDocuments = submittedDocuments.filter((d) => d.status === 'Diajukan');
  const approvedDocuments = submittedDocuments.filter((d) => d.status === 'Disetujui');
  const revisionDocuments = submittedDocuments.filter((d) => d.status === 'Perlu Revisi');

  return {
    totalTeachers: teachers.length,
    totalStudents: students.length,
    totalClasses: classes.length,
    pendingDocumentsCount: pendingDocuments.length,
    approvedDocumentsCount: approvedDocuments.length,
    revisionDocumentsCount: revisionDocuments.length,
    totalSupervisions: supervisions.length,
    totalJournalsToday: journals.length,
    pendingDocuments,
    submittedDocuments,
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
  const [resolvedTeacher, allAssignments, settings, years, semesters, teachersPool, allClasses, allSubjects] = await Promise.all([
    academicService.resolveTeacherForUser(
      currentUser || (teacherId ? { teacherId } : null)
    ),
    academicService.getTeachingAssignments(),
    academicService.getSettings(),
    academicService.getAcademicYears(),
    academicService.getSemesters(),
    academicService.getTeachers(),
    academicService.getClasses(),
    academicService.getSubjects(),
  ]);

  const effectiveTeacherId = resolvedTeacher?.id || teacherId || null;
  const activeYear = years.find((y) => y.id === settings.active_academic_year_id) || years.find((y) => y.is_active) || DEMO_ACADEMIC_YEAR;
  const activeSemester = semesters.find((s) => s.id === settings.active_semester_id) || semesters.find((s) => s.is_active) || DEMO_SEMESTER;

  const userContext = currentUser || (teacherId ? { teacherId } : null);
  const teacherAssignments = academicService.filterAssignmentsForUser(
    allAssignments,
    userContext,
    resolvedTeacher,
    teachersPool
  );
  const { candidateTeacherIds, candidateUserIds } = academicService.getMatchingTeacherIdsForUser(
    userContext,
    resolvedTeacher,
    teachersPool
  );
  if (effectiveTeacherId) candidateTeacherIds.add(effectiveTeacherId);

  const classById = new Map(allClasses.map((c) => [c.id, c]));
  const subjectById = new Map(allSubjects.map((s) => [s.id, s]));

  const assignedClasses: TeacherAssignedSlot[] = teacherAssignments
    .map((a) => {
      const cls = a.class || classById.get(a.class_id);
      const sbj = a.subject || subjectById.get(a.subject_id);
      return {
        assignmentId: a.id,
        classId: cls?.id || a.class_id,
        className: cls?.name || 'Kelas',
        classLevel: cls?.level || 4,
        subjectId: sbj?.id || a.subject_id,
        subjectName: sbj?.name || 'Mata Pelajaran',
        subjectCode: sbj?.code || '-',
        subjectCategory: sbj?.category || 'Umum',
        phase: cls?.phase || 'B',
      };
    })
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

  const teacherAssignmentIds = new Set(teacherAssignments.map((a) => a.id));
  const [allDocs, allJournals, allSupervisions] = await Promise.all([
    candidateTeacherIds.size > 0 || candidateUserIds.size > 0 ? curriculumService.getDocuments() : Promise.resolve([]),
    candidateTeacherIds.size > 0 || teacherAssignmentIds.size > 0 ? journalService.getJournals() : Promise.resolve([]),
    candidateTeacherIds.size > 0 ? supervisionService.getRecords() : Promise.resolve([]),
  ]);

  const docs = allDocs.filter(
    (d) => candidateTeacherIds.has(d.teacher_id) || candidateUserIds.has(d.teacher_id)
  );
  const journals = allJournals.filter(
    (j) =>
      teacherAssignmentIds.has(j.assignment_id) ||
      (j.assignment?.teacher_id ? candidateTeacherIds.has(j.assignment.teacher_id) : false)
  );
  const supervisions = allSupervisions.filter((s) => candidateTeacherIds.has(s.teacher_id));

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
      classId: null,
      className: 'Belum Ada Rombel Ditugaskan',
      phase: '-',
      totalStudents: 0,
      homeroomTeacherName: currentUser?.profile?.full_name || '-',
      officials: [],
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

  const [allStudents, members, officials, attendances, assignments] = await Promise.all([
    academicService.getStudents(),
    academicService.getClassMembers(homeroomClass.id),
    academicService.getClassOfficials(homeroomClass.id),
    attendanceService.getAttendance({ classId: homeroomClass.id }),
    academicService.getTeachingAssignments(),
  ]);

  const memberOrderMap = new Map<string, number>();
  members.forEach((m, idx) => {
    memberOrderMap.set(m.student_id, m.student_number || idx + 1);
  });

  const enrolledIds = new Set(members.map((m) => m.student_id));
  const studentById = new Map(allStudents.map((s) => [s.id, s]));

  const classStudents = allStudents
    .filter((s) => enrolledIds.has(s.id))
    .sort((a, b) => {
      const numA = memberOrderMap.get(a.id) ?? 9999;
      const numB = memberOrderMap.get(b.id) ?? 9999;
      if (numA !== numB) return numA - numB;
      return a.full_name.localeCompare(b.full_name, 'id');
    })
    .map((s) => ({
      id: s.id,
      nis: s.nis,
      fullName: s.full_name,
      gender: s.gender,
      parentPhone: s.parent_phone || null,
    }));

  const resolvedOfficials = officials.map((o) => {
    const std = o.student || studentById.get(o.student_id);
    return {
      id: o.id,
      roleName: o.role_name,
      studentName: std?.full_name || 'Siswa',
      nis: std?.nis || '-',
    };
  });

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
    classId: homeroomClass.id,
    className: homeroomClass.name,
    phase: homeroomClass.phase,
    totalStudents: classStudents.length,
    homeroomTeacherName,
    officials: resolvedOfficials,
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

