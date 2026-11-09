/**
 * Definisi TypeScript untuk Skema Basis Data SIMPEL MI AL IHSAN
 * Selaras 100% dengan PostgreSQL Supabase Migration Tahap 2
 */

export type UserRole = 'admin' | 'kepala_madrasah' | 'guru' | 'wali_kelas';

export type SemesterType = 'Ganjil' | 'Genap';

export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';

export type DocumentStatus = 'Draft' | 'Diajukan' | 'Disetujui' | 'Perlu Revisi';

export type AssessmentType =
  | 'Formatif'
  | 'Sumatif_Lingkup_Materi'
  | 'Sumatif_Tengah_Semester'
  | 'Sumatif_Akhir_Semester';

export type GuidanceStatus = 'Memerlukan_Tindak_Lanjut' | 'Dalam_Proses' | 'Selesai';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  is_primary: boolean;
  created_at: string;
}

export interface SystemSettings {
  id: string;
  school_name: string;
  nsm: string;
  npsn: string;
  address: string;
  principal_name: string;
  principal_nip: string;
  active_academic_year_id: string | null;
  active_semester_id: string | null;
  kktp_default: number;
  is_report_card_locked: boolean;
  logo_url?: string | null;
  favicon_url?: string | null;
  updated_at: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface Semester {
  id: string;
  academic_year_id: string;
  semester_type: SemesterType;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface Teacher {
  id: string;
  user_id: string | null;
  nip: string | null;
  nuptk: string | null;
  full_name: string;
  title_prefix: string | null;
  title_suffix: string | null;
  gender: 'L' | 'P';
  phone_number: string | null;
  specialization: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  nis: string;
  nisn: string | null;
  full_name: string;
  nickname: string | null;
  gender: 'L' | 'P';
  birth_place: string | null;
  birth_date: string | null;
  parent_guardian_name: string | null;
  parent_phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassRoom {
  id: string;
  level: number;
  name: string;
  phase: 'A' | 'B' | 'C';
  capacity: number;
  created_at: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  category: 'PAI' | 'Umum' | 'Muatan Lokal' | "Khas Ma'arif";
  order_index: number;
  created_at: string;
}

export interface ClassMember {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string;
  student_number: number | null;
  created_at: string;
  student?: Student;
  class?: ClassRoom;
}

export interface TeachingAssignment {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  academic_year_id: string;
  semester_id: string;
  created_at: string;
  teacher?: Teacher;
  class?: ClassRoom;
  subject?: Subject;
}

export interface HomeroomAssignment {
  id: string;
  teacher_id: string;
  class_id: string;
  academic_year_id: string;
  created_at: string;
  teacher?: Teacher;
  class?: ClassRoom;
}

export interface TeachingJournal {
  id: string;
  assignment_id: string;
  date: string;
  period_hours: string;
  topic: string;
  learning_objective: string;
  learning_activities: string;
  learning_method: string;
  reflection: string | null;
  obstacles: string | null;
  follow_up: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assignment?: TeachingAssignment;
}

export interface StudentAttendance {
  id: string;
  class_id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  notes: string | null;
  recorded_by: string;
  academic_year_id: string;
  semester_id: string;
  created_at: string;
  student?: Student;
}

export interface DocumentLink {
  id: string;
  teacher_id: string;
  academic_year_id: string;
  semester_id: string;
  class_id: string | null;
  subject_id: string | null;
  document_type: string;
  title: string;
  google_drive_url: string;
  file_id: string | null;
  status: DocumentStatus;
  submission_date: string | null;
  created_at: string;
  updated_at: string;
  teacher?: Teacher;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action_name: string;
  entity_name: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  profile?: Profile;
}

// ==========================================
// MODUL SUPERVISI TERSTRUKTUR (REVISI FORMULIR LANGSUNG)
// ==========================================
export type SupervisionType =
  | 'Perencanaan_Pembelajaran'
  | 'Pelaksanaan_KBM'
  | 'Penilaian_Asesmen'
  | 'Supervisi_Klinis';

export type FollowupStatus = 'Belum_Dilaksanakan' | 'Dalam_Proses' | 'Selesai';

export interface SupervisionInstrument {
  id: string;
  name: string;
  supervision_type: SupervisionType;
  description: string | null;
  scale_min: number;
  scale_max: number;
  scale_type: string;
  academic_year_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  aspects?: SupervisionAspect[];
}

export interface SupervisionAspect {
  id: string;
  instrument_id: string;
  name: string;
  order_index: number;
  weight: number;
  description: string | null;
  created_at: string;
  indicators?: SupervisionIndicator[];
}

export interface SupervisionIndicator {
  id: string;
  aspect_id: string;
  code: string;
  name: string;
  description: string | null;
  order_index: number;
  max_score: number;
  created_at: string;
}

export interface SupervisionRecord {
  id: string;
  instrument_id: string | null;
  teacher_id: string;
  supervisor_id: string;
  academic_year_id: string;
  semester_id: string;
  class_id: string | null;
  subject_id: string | null;
  assignment_id: string | null;
  supervision_date: string;
  supervision_type: SupervisionType;
  topic: string;

  // Aspek Kualitatif & Kurikulum Khusus
  aspect_planning_notes: string | null;
  aspect_execution_notes: string | null;
  aspect_assessment_notes: string | null;
  aspect_classroom_management_notes: string | null;
  deep_learning_implementation_notes: string | null;
  love_based_curriculum_notes: string | null;
  general_observation_notes: string | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  recommendations: string;
  action_plan_summary: string | null;

  // Kuantitatif & Predikat
  total_score: number | null;
  max_possible_score: number | null;
  percentage_score: number | null;
  predicate: string | null;

  // Status & Validasi
  is_finalized: boolean;
  is_shared_with_teacher: boolean;
  teacher_feedback: string | null;
  teacher_acknowledged_at: string | null;
  created_at: string;
  updated_at: string;

  teacher?: Teacher;
  supervisor?: Profile;
  class?: ClassRoom;
  subject?: Subject;
  results?: SupervisionResult[];
  followups?: SupervisionFollowup[];
}

export interface SupervisionResult {
  id: string;
  supervision_record_id: string;
  indicator_id: string;
  score: number;
  notes: string | null;
  created_at: string;
  indicator?: SupervisionIndicator;
}

export interface SupervisionFollowup {
  id: string;
  supervision_record_id: string;
  activity_description: string;
  person_in_charge: string;
  target_date: string | null;
  status: FollowupStatus;
  result_notes: string | null;
  completion_date: string | null;
  created_at: string;
  updated_at: string;
}

// ==========================================
// MODUL ASESMEN, NILAI, REMEDIAL & PENGAYAAN
// ==========================================
export interface Assessment {
  id: string;
  assignment_id: string;
  title: string;
  assessment_type: AssessmentType;
  assessment_date: string;
  kktp: number;
  created_at: string;
  assignment?: TeachingAssignment;
}

export interface Grade {
  id: string;
  assessment_id: string;
  student_id: string;
  score: number;
  feedback: string | null;
  created_at: string;
  updated_at: string;
  student?: Student;
}

export interface GradeAuditLog {
  id: string;
  grade_id: string;
  student_id: string;
  old_score: number | null;
  new_score: number;
  changed_by: string;
  reason: string;
  created_at: string;
  changer?: Profile;
}

export interface RemedialRecord {
  id: string;
  assignment_id: string;
  student_id: string;
  unachieved_objective: string;
  remedial_activity: string;
  execution_date: string;
  score_before: number;
  score_after: number;
  follow_up_action: string | null;
  created_at: string;
  student?: Student;
  assignment?: TeachingAssignment;
}

export interface EnrichmentRecord {
  id: string;
  assignment_id: string;
  student_id: string;
  objective_topic: string;
  enrichment_activity: string;
  execution_date: string;
  result_notes: string | null;
  created_at: string;
  student?: Student;
  assignment?: TeachingAssignment;
}

// ==========================================
// MODUL BIMBINGAN SISWA (BK - TERLINDUNGI)
// ==========================================
export interface StudentGuidanceRecord {
  id: string;
  student_id: string;
  recorded_by: string;
  guidance_date: string;
  guidance_type: 'Belajar' | 'Sosial' | 'Perilaku' | 'Motivasi' | 'Keluarga';
  problem_description: string;
  counseling_summary: string;
  recommendation_followup: string;
  status: GuidanceStatus;
  created_at: string;
  updated_at: string;
  student?: Student;
  recorder?: Profile;
}

// ==========================================
// TELAAH DOKUMEN & JADWAL
// ==========================================
export interface DocumentReview {
  id: string;
  document_link_id: string;
  reviewed_by: string;
  status_decision: 'Disetujui' | 'Perlu Revisi';
  review_notes: string;
  reviewed_at: string;
  reviewer?: Profile;
}

export interface LearningSchedule {
  id: string;
  assignment_id: string;
  day_of_week: number;
  period_start: number;
  period_end: number;
  start_time: string;
  end_time: string;
  assignment?: TeachingAssignment;
}

// ==========================================
// TAHAP 7: SISTEM NOTIFIKASI INTERNAL OPERASIONAL
// ==========================================
export type NotificationCategory =
  | 'presensi'
  | 'jurnal'
  | 'dokumen'
  | 'revisi_dokumen'
  | 'nilai'
  | 'supervisi'
  | 'tindak_lanjut_supervisi'
  | 'akademik'
  | 'pengumuman';

export interface AppNotification {
  id: string;
  recipient_id?: string | null;
  target_role?: UserRole | 'semua';
  category: NotificationCategory;
  title: string;
  message: string;
  action_url?: string;
  is_read: boolean;
  created_at: string;
}



