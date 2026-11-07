export interface CapaianPembelajaranItem {
  id: string;
  subject_id: string;
  subject_name: string;
  phase: 'A' | 'B' | 'C';
  class_level: number;
  element: string; // e.g., 'Menyimak', 'Membaca dan Memirsa', 'Berbicara dan Mempresentasikan', 'Menulis'
  description: string;
  source: string;
  created_at: string;
}

export interface TujuanPembelajaranItem {
  id: string;
  cp_id?: string;
  subject_id: string;
  subject_name: string;
  class_level: number;
  code: string; // e.g. 'TP 4.1'
  description: string;
  scope_of_material: string; // Lingkup Materi / Bab
  semester: 'Ganjil' | 'Genap';
  allocated_hours: number; // JP
  is_active: boolean;
  created_at: string;
}

export interface AlurTujuanPembelajaranItem {
  id: string;
  subject_id: string;
  subject_name: string;
  class_level: number;
  semester: 'Ganjil' | 'Genap';
  sequence_order: number;
  stage_name: string; // e.g., 'Tahap 1'
  chapter_title: string; // e.g., 'Bab 1: Sudah Besar'
  tp_codes: string[]; // e.g. ['TP 4.1', 'TP 4.2']
  material_summary: string;
  allocated_hours: number; // e.g. 18 JP
  assessment_plan: string;
  created_at: string;
}

export interface ModulAjarItem {
  id: string;
  teacher_id: string;
  teacher_name: string;
  subject_id: string;
  subject_name: string;
  class_level: number;
  semester: 'Ganjil' | 'Genap';
  chapter_title: string;
  topic: string;
  target_tp_code: string;
  allocated_meetings: string; // e.g., '3 Pertemuan (6 JP)'
  deep_learning_approach: string; // Kurikulum Berbasis Cinta & Pembelajaran Mendalam
  learning_activities: {
    introduction: string;
    core_deep_learning: string;
    closing_reflection: string;
  };
  google_drive_url: string;
  status: 'Draft' | 'Diajukan' | 'Disetujui' | 'Perlu Revisi';
  review_notes?: string;
  created_at: string;
}

export interface LKPDItem {
  id: string;
  teacher_id: string;
  teacher_name: string;
  subject_id: string;
  subject_name: string;
  class_level: number;
  title: string;
  chapter_topic: string;
  target_tp_code: string;
  activity_type: 'Individu' | 'Kelompok Kolaboratif' | 'Penyelidikan / Eksperimen';
  instructions: string;
  rubric_summary: string;
  google_drive_url: string;
  created_at: string;
}

export type EvaluationScopeKey = 'LM1' | 'LM2' | 'LM3' | 'LM4' | 'STS' | 'SAS';

export interface LingkupMateriConfig {
  id: string;
  scope_key: EvaluationScopeKey;
  code: string; // e.g., 'LM 1', 'LM 2', 'STS', 'SAS'
  label: string; // e.g., 'Lingkup Materi 1'
  title: string; // e.g., 'Bab 1: Sudah Besar'
  subject_id: string;
  class_level: number;
  semester: 'Ganjil' | 'Genap';
  associated_tps: string[];
  description: string;
  is_special_summative?: boolean; // true for STS and SAS
}

export interface KisiKisiItem {
  id: string;
  subject_id: string;
  subject_name: string;
  class_level: number;
  scope_key: EvaluationScopeKey; // LM1, LM2, LM3, LM4, STS, SAS
  assessment_type: 'Formatif Lingkup Materi' | 'Sumatif Lingkup Materi' | 'Sumatif Tengah Semester (STS)' | 'Sumatif Akhir Semester (SAS)';
  tp_code: string;
  material_topic: string;
  indicator: string;
  cognitive_level: 'L1 (Pengetahuan/Pemahaman)' | 'L2 (Aplikasi)' | 'L3 (Penalaran/HOTS)';
  question_type: 'Pilihan Ganda' | 'Isian Singkat' | 'Uraian' | 'Unjuk Kerja / Praktik';
  question_numbers: string; // e.g. '1, 2, 5'
  scoring_weight: number;
  created_at: string;
}

export interface SoalAsesmenItem {
  id: string;
  kisikisi_id?: string;
  subject_id: string;
  subject_name: string;
  class_level: number;
  scope_key: EvaluationScopeKey; // LM1, LM2, LM3, LM4, STS, SAS
  tp_code: string;
  question_number: number;
  question_type: 'Pilihan Ganda' | 'Isian Singkat' | 'Uraian' | 'Praktik';
  stimulus: string; // Konteks / bacaan cinta madrasah / studi kasus
  question_text: string;
  options?: string[]; // for PG [A, B, C, D]
  correct_answer: string;
  scoring_rubric: string;
  score_points: number;
  created_at: string;
}
