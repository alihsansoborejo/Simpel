import {
  Profile,
  UserRole,
  ClassRoom,
  Student,
  Teacher,
  AcademicYear,
  Semester,
  SystemSettings,
  Subject,
  TeachingAssignment,
  ClassMember,
  DocumentLink,
  StudentAttendance,
  TeachingJournal,
  Assessment,
  Grade,
  RemedialRecord,
  EnrichmentRecord,
  StudentGuidanceRecord,
  SupervisionRecord,
  SupervisionInstrument,
  HomeroomAssignment,
} from '../types/database.types';

export interface DemoUserAccount {
  id: string;
  email: string;
  password: string;
  profile: Profile;
  roles: UserRole[];
  teacherId?: string;
  homeroomClassId?: string;
}

export const DEMO_SYSTEM_SETTINGS: SystemSettings = {
  id: 'set-001',
  school_name: 'MI Ma’arif Al Ihsan Soborejo',
  nsm: '111233230045',
  npsn: '60711921',
  address: 'Soborejo, Kec. Pringsurat, Kab. Temanggung, Jawa Tengah',
  principal_name: 'MUIN, S.Pd.I.',
  principal_nip: '197508152005011004',
  active_academic_year_id: 'ay-2026',
  active_semester_id: 'sem-ganjil-2026',
  kktp_default: 75,
  is_report_card_locked: false,
  logo_url: '/logo-mi-alihsan.svg',
  favicon_url: '/favicon.svg',
  updated_at: '2026-11-10T08:00:00+07:00',
};

export const DEMO_ACADEMIC_YEAR: AcademicYear = {
  id: 'ay-2026',
  name: '2026/2027',
  start_date: '2026-07-15',
  end_date: '2027-06-25',
  is_active: true,
  created_at: '2026-07-01T00:00:00+07:00',
};

export const DEMO_SEMESTER: Semester = {
  id: 'sem-ganjil-2026',
  academic_year_id: 'ay-2026',
  semester_type: 'Ganjil',
  start_date: '2026-07-15',
  end_date: '2026-12-20',
  is_active: true,
  created_at: '2026-07-01T00:00:00+07:00',
};

export const DEMO_CLASSES: ClassRoom[] = [
  { id: 'cls-1', level: 1, name: 'Kelas 1', phase: 'A', capacity: 28, homeroom_teacher_id: null, created_at: '2026-07-01' },
  { id: 'cls-2', level: 2, name: 'Kelas 2', phase: 'A', capacity: 28, homeroom_teacher_id: null, created_at: '2026-07-01' },
  { id: 'cls-3', level: 3, name: 'Kelas 3', phase: 'B', capacity: 28, homeroom_teacher_id: null, created_at: '2026-07-01' },
  { id: 'cls-4', level: 4, name: 'Kelas 4', phase: 'B', capacity: 28, homeroom_teacher_id: null, created_at: '2026-07-01' },
  { id: 'cls-5', level: 5, name: 'Kelas 5', phase: 'C', capacity: 28, homeroom_teacher_id: null, created_at: '2026-07-01' },
  { id: 'cls-6', level: 6, name: 'Kelas 6', phase: 'C', capacity: 28, homeroom_teacher_id: null, created_at: '2026-07-01' },
];

export const DEMO_SUBJECTS: Subject[] = [
  { id: 'sbj-qh', code: 'QH', name: "Al-Qur'an Hadis", category: 'PAI', order_index: 1, created_at: '2026-07-01' },
  { id: 'sbj-aa', code: 'AA', name: 'Akidah Akhlak', category: 'PAI', order_index: 2, created_at: '2026-07-01' },
  { id: 'sbj-fiq', code: 'FIQ', name: 'Fikih', category: 'PAI', order_index: 3, created_at: '2026-07-01' },
  { id: 'sbj-ski', code: 'SKI', name: 'Sejarah Kebudayaan Islam', category: 'PAI', order_index: 4, created_at: '2026-07-01' },
  { id: 'sbj-arb', code: 'ARB', name: 'Bahasa Arab', category: 'PAI', order_index: 5, created_at: '2026-07-01' },
  { id: 'sbj-pp', code: 'PP', name: 'Pendidikan Pancasila', category: 'Umum', order_index: 6, created_at: '2026-07-01' },
  { id: 'sbj-ind', code: 'IND', name: 'Bahasa Indonesia', category: 'Umum', order_index: 7, created_at: '2026-07-01' },
  { id: 'sbj-mtk', code: 'MTK', name: 'Matematika', category: 'Umum', order_index: 8, created_at: '2026-07-01' },
  { id: 'sbj-ipas', code: 'IPAS', name: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', category: 'Umum', order_index: 9, created_at: '2026-07-01' },
  { id: 'sbj-sbd', code: 'SBD', name: 'Seni Budaya & Prakarya', category: 'Umum', order_index: 10, created_at: '2026-07-01' },
  { id: 'sbj-pjk', code: 'PJK', name: 'Pendidikan Jasmani Olahraga dan Kesehatan (PJOK)', category: 'Umum', order_index: 11, created_at: '2026-07-01' },
  { id: 'sbj-asw', code: 'ASW', name: "Ke-NU-an / Aswaja (Khas Ma'arif)", category: "Khas Ma'arif", order_index: 12, created_at: '2026-07-01' },
  { id: 'sbj-bjw', code: 'BJW', name: 'Bahasa Jawa (Mulok)', category: 'Muatan Lokal', order_index: 13, created_at: '2026-07-01' },
  { id: 'sbj-eng', code: 'ENG', name: 'Bahasa Inggris', category: 'Muatan Lokal', order_index: 14, created_at: '2026-07-01' },
];

// Akun Tunggal: 1 Administrator Madrasah
export const DEMO_USERS: DemoUserAccount[] = [
  {
    id: 'usr-admin-1',
    email: 'alihsansoborejo@gmail.com',
    password: 'AlIhsan2026!',
    profile: {
      id: 'usr-admin-1',
      email: 'alihsansoborejo@gmail.com',
      full_name: 'Administrator Madrasah',
      phone_number: '081234567800',
      avatar_url: null,
      is_active: true,
      created_at: '2026-07-01T08:00:00+07:00',
      updated_at: '2026-11-10T12:00:00+07:00',
    },
    roles: ['admin'],
  },
];

// Data Operasional Bersih & Kosong (Siap Diisi Nyata Oleh Administrator)
export const DEMO_TEACHERS: Teacher[] = [];
export const DEMO_STUDENTS: Student[] = [];
export const DEMO_HOMEROOM_ASSIGNMENTS: HomeroomAssignment[] = [];
export const DEMO_TEACHING_ASSIGNMENTS: TeachingAssignment[] = [];
export const DEMO_CLASS_MEMBERS: ClassMember[] = [];
export const DEMO_DOCUMENT_LINKS: DocumentLink[] = [];
export const DEMO_ATTENDANCES: StudentAttendance[] = [];
export const DEMO_JOURNALS: TeachingJournal[] = [];
export const DEMO_ASSESSMENTS: Assessment[] = [];
export const DEMO_GRADES: Grade[] = [];
export const DEMO_REMEDIAL: RemedialRecord[] = [];
export const DEMO_ENRICHMENT: EnrichmentRecord[] = [];
export const DEMO_GUIDANCES: StudentGuidanceRecord[] = [];
export const DEMO_SUPERVISION_RECORDS: SupervisionRecord[] = [];

// Template Master Rubrik Supervisi (KBM Mendalam & Kurikulum Cinta)
export const DEMO_INSTRUMENTS: SupervisionInstrument[] = [
  {
    id: 'ins-1',
    name: 'Instrumen Supervisi KBM Mendalam & Kurikulum Cinta',
    supervision_type: 'Pelaksanaan_KBM',
    description: 'Pedoman pengamatan pelaksanaan pembelajaran berorientasi Deep Learning dan kasih sayang di kelas.',
    scale_min: 1,
    scale_max: 4,
    scale_type: '1-4',
    academic_year_id: 'ay-2026',
    is_active: true,
    created_by: 'usr-admin-1',
    created_at: '2026-07-01T08:00:00+07:00',
    updated_at: '2026-07-01T08:00:00+07:00',
  },
];
