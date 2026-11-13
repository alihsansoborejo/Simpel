-- ==============================================================================
-- SIMPEL MI AL IHSAN - SKEMA BASIS DATA UTAMA (TAHAP 2)
-- Bagian 1: Extensions, Custom Types, Tabel, Foreign Key, Check Constraints, & Index
-- Tanggal: 2026-11-05
-- Madrasah: MI Ma'arif Al Ihsan Soborejo
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM ('admin', 'kepala_madrasah', 'guru', 'wali_kelas');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE semester_type AS ENUM ('Ganjil', 'Genap');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status_type AS ENUM ('Hadir', 'Sakit', 'Izin', 'Alpa');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE document_status_type AS ENUM ('Draft', 'Diajukan', 'Disetujui', 'Perlu Revisi');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE assessment_type_enum AS ENUM ('Formatif', 'Sumatif_Lingkup_Materi', 'Sumatif_Tengah_Semester', 'Sumatif_Akhir_Semester');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE guidance_status_type AS ENUM ('Memerlukan_Tindak_Lanjut', 'Dalam_Proses', 'Selesai');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. PROFILES & USER ROLES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role user_role_type NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_user_role UNIQUE (user_id, role)
);

-- 4. MASTER DATA MADRASAH
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_name TEXT NOT NULL DEFAULT 'MI Ma’arif Al Ihsan Soborejo',
    nsm TEXT DEFAULT '111233080000',
    npsn TEXT DEFAULT '60700000',
    address TEXT DEFAULT 'Soborejo, Kec. Pringsurat, Kab. Temanggung, Jawa Tengah',
    principal_name TEXT DEFAULT 'Kepala Madrasah, S.Pd.I',
    principal_nip TEXT DEFAULT '-',
    logo_url TEXT,
    favicon_url TEXT,
    active_academic_year_id UUID,
    active_semester_id UUID,
    kktp_default NUMERIC(5,2) NOT NULL DEFAULT 75.00,
    is_report_card_locked BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS favicon_url TEXT;

CREATE TABLE IF NOT EXISTS public.academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE, -- Contoh: '2026/2027'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT ck_academic_year_dates CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS public.semesters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    semester_type semester_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_semester_year UNIQUE (academic_year_id, semester_type),
    CONSTRAINT ck_semester_dates CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
    nip TEXT UNIQUE,
    nuptk TEXT UNIQUE,
    full_name TEXT NOT NULL,
    title_prefix TEXT,
    title_suffix TEXT,
    gender VARCHAR(1) NOT NULL CHECK (gender IN ('L', 'P')),
    phone_number TEXT,
    specialization TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nis TEXT NOT NULL UNIQUE,
    nisn TEXT UNIQUE, -- Validasi unique, boleh null
    full_name TEXT NOT NULL,
    nickname TEXT,
    gender VARCHAR(1) NOT NULL CHECK (gender IN ('L', 'P')),
    birth_place TEXT,
    birth_date DATE,
    parent_guardian_name TEXT,
    parent_phone TEXT,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level INT NOT NULL CHECK (level BETWEEN 1 AND 6),
    name TEXT NOT NULL, -- Contoh: 'Kelas 1A', 'Kelas 4'
    phase VARCHAR(1) NOT NULL CHECK (phase IN ('A', 'B', 'C')), -- Kurikulum Merdeka (Fase A: 1-2, Fase B: 3-4, Fase C: 5-6)
    capacity INT NOT NULL DEFAULT 28,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_class_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE, -- Contoh: 'PAI-AQ', 'MTK', 'BIN', 'ASWJ'
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('PAI', 'Umum', 'Muatan Lokal', 'Khas Ma''arif')),
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

-- 5. PENUGASAN AKADEMIK & KEANGGOTAAN KELAS
CREATE TABLE IF NOT EXISTS public.class_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    student_number INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_student_year_class UNIQUE (student_id, academic_year_id)
);

CREATE TABLE IF NOT EXISTS public.teaching_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_teaching_assignment UNIQUE (teacher_id, class_id, subject_id, academic_year_id, semester_id)
);

CREATE TABLE IF NOT EXISTS public.homeroom_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_homeroom_class_year UNIQUE (class_id, academic_year_id)
);

CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Senin, 6=Sabtu
    period_start INT NOT NULL CHECK (period_start >= 1),
    period_end INT NOT NULL CHECK (period_end >= period_start),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    CONSTRAINT ck_schedule_time CHECK (end_time > start_time)
);

-- 6. PERENCANAAN PEMBELAJARAN (KURIKULUM MERDEKA & BERBASIS CINTA)
CREATE TABLE IF NOT EXISTS public.learning_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    phase VARCHAR(1) NOT NULL CHECK (phase IN ('A', 'B', 'C')),
    element TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.learning_objectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learning_outcome_id UUID REFERENCES public.learning_outcomes(id) ON DELETE SET NULL,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- Contoh: 'TP-1.1'
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.learning_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    total_hours INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.atp_objectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learning_sequence_id UUID NOT NULL REFERENCES public.learning_sequences(id) ON DELETE CASCADE,
    learning_objective_id UUID NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
    sequence_order INT NOT NULL,
    allocated_hours INT NOT NULL DEFAULT 2,
    CONSTRAINT uq_atp_order UNIQUE (learning_sequence_id, sequence_order)
);

CREATE TABLE IF NOT EXISTS public.annual_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    total_allocated_hours INT NOT NULL,
    content_summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.semester_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    annual_program_id UUID NOT NULL REFERENCES public.annual_programs(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    monthly_breakdown JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.teaching_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    duration_hours INT NOT NULL DEFAULT 2,
    pancasila_profiles TEXT[],
    deep_learning_elements TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.worksheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teaching_module_id UUID REFERENCES public.teaching_modules(id) ON DELETE SET NULL,
    assignment_id UUID NOT NULL REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    instructions TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.assessment_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    assessment_type assessment_type_enum NOT NULL,
    weight NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    technique TEXT NOT NULL, -- Contoh: 'Tes Tulis', 'Kinerja Portofolio'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

-- 7. KBM HARIAN: PRESENSI & JURNAL MENGAJAR
CREATE TABLE IF NOT EXISTS public.teaching_journals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_hours TEXT NOT NULL, -- Contoh: 'Jam ke-1 s.d. 3'
    topic TEXT NOT NULL,
    learning_objective TEXT NOT NULL,
    learning_activities TEXT NOT NULL,
    learning_method TEXT NOT NULL,
    reflection TEXT,
    obstacles TEXT,
    follow_up TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.student_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status attendance_status_type NOT NULL DEFAULT 'Hadir',
    notes TEXT,
    recorded_by UUID NOT NULL REFERENCES public.profiles(id),
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_student_attendance_daily UNIQUE (student_id, date)
);

CREATE TABLE IF NOT EXISTS public.learning_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    assignment_id UUID NOT NULL REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL, -- 'Portofolio', 'Foto Karya', 'Rekaman Bacaan'
    google_drive_url TEXT,
    notes TEXT,
    recorded_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS public.learning_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    recorded_by UUID NOT NULL REFERENCES public.profiles(id),
    dimension TEXT NOT NULL, -- 'Beriman & Bertakwa', 'Gotong Royong', dsb.
    observation_notes TEXT NOT NULL,
    observed_at DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 8. PENILAIAN, ASESMEN, REMEDIAL & PENGAYAAN
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    assessment_type assessment_type_enum NOT NULL,
    assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    kktp NUMERIC(5,2) NOT NULL DEFAULT 75.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.assessment_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Contoh: 'Tujuan Pembelajaran 1'
    weight NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 100.00
);

CREATE TABLE IF NOT EXISTS public.grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    score NUMERIC(5,2) NOT NULL,
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT ck_grade_score CHECK (score >= 0.00 AND score <= 100.00),
    CONSTRAINT uq_student_assessment_grade UNIQUE (assessment_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.grade_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grade_id UUID NOT NULL REFERENCES public.grades(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    old_score NUMERIC(5,2),
    new_score NUMERIC(5,2) NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.profiles(id),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.remedial_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    unachieved_objective TEXT NOT NULL,
    remedial_activity TEXT NOT NULL,
    execution_date DATE NOT NULL DEFAULT CURRENT_DATE,
    score_before NUMERIC(5,2) NOT NULL,
    score_after NUMERIC(5,2) NOT NULL,
    follow_up_action TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT ck_remedial_scores CHECK (score_before >= 0 AND score_after >= 0 AND score_before <= 100 AND score_after <= 100)
);

CREATE TABLE IF NOT EXISTS public.enrichment_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    objective_topic TEXT NOT NULL,
    enrichment_activity TEXT NOT NULL,
    execution_date DATE NOT NULL DEFAULT CURRENT_DATE,
    result_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

-- 9. RAPOR & CATATAN PERKEMBANGAN
CREATE TABLE IF NOT EXISTS public.final_grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    formative_average NUMERIC(5,2),
    summative_average NUMERIC(5,2),
    final_score NUMERIC(5,2) NOT NULL,
    letter_grade VARCHAR(2), -- 'A', 'B', 'C', 'D'
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_final_grade UNIQUE (assignment_id, student_id),
    CONSTRAINT ck_final_score CHECK (final_score >= 0.00 AND final_score <= 100.00)
);

CREATE TABLE IF NOT EXISTS public.student_descriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    final_grade_id UUID NOT NULL REFERENCES public.final_grades(id) ON DELETE CASCADE,
    highest_achievement_desc TEXT NOT NULL,
    lowest_achievement_desc TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_student_desc UNIQUE (final_grade_id)
);

CREATE TABLE IF NOT EXISTS public.report_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    homeroom_teacher_id UUID NOT NULL REFERENCES public.teachers(id),
    attendance_hadir INT NOT NULL DEFAULT 0,
    attendance_sakit INT NOT NULL DEFAULT 0,
    attendance_izin INT NOT NULL DEFAULT 0,
    attendance_alpa INT NOT NULL DEFAULT 0,
    homeroom_notes TEXT,
    promotion_status TEXT, -- 'Naik ke Kelas ...', 'Tinggal di Kelas ...', 'Lulus'
    is_validated_by_homeroom BOOLEAN NOT NULL DEFAULT FALSE,
    is_approved_by_principal BOOLEAN NOT NULL DEFAULT FALSE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_report_card UNIQUE (student_id, academic_year_id, semester_id)
);

-- 10. ARSIP DOKUMEN GOOGLE DRIVE & SUPERVISI KEPALA MADRASAH
CREATE TABLE IF NOT EXISTS public.document_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL, -- 'Modul_Ajar', 'Prota', 'Prosem', 'LKPD', 'ATP', 'Kisi_Kisi'
    title TEXT NOT NULL,
    google_drive_url TEXT NOT NULL,
    file_id TEXT, -- Google Drive File ID jika tersedia
    status document_status_type NOT NULL DEFAULT 'Draft',
    submission_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.document_link_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_link_id UUID NOT NULL REFERENCES public.document_links(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    google_drive_url TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_doc_version UNIQUE (document_link_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.document_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_link_id UUID NOT NULL REFERENCES public.document_links(id) ON DELETE CASCADE,
    reviewed_by UUID NOT NULL REFERENCES public.profiles(id),
    status_decision document_status_type NOT NULL CHECK (status_decision IN ('Disetujui', 'Perlu Revisi')),
    review_notes TEXT NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.supervision_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES public.teaching_assignments(id) ON DELETE SET NULL,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    supervision_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supervisor_id UUID NOT NULL REFERENCES public.profiles(id),
    score_planning NUMERIC(5,2),
    score_execution NUMERIC(5,2),
    score_assessment NUMERIC(5,2),
    strengths TEXT,
    weaknesses TEXT,
    recommendations TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

-- 11. BIMBINGAN SISWA (BK - SENSITIF & TERLINDUNGI)
CREATE TABLE IF NOT EXISTS public.student_guidance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    recorded_by UUID NOT NULL REFERENCES public.profiles(id),
    guidance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    guidance_type TEXT NOT NULL, -- 'Belajar', 'Sosial', 'Perilaku', 'Motivasi', 'Keluarga'
    problem_description TEXT NOT NULL,
    counseling_summary TEXT NOT NULL,
    recommendation_followup TEXT NOT NULL,
    status guidance_status_type NOT NULL DEFAULT 'Dalam_Proses',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

-- 12. NOTIFIKASI, ASISTEN AI GEMINI, & LOG AKTIVITAS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_role TEXT DEFAULT 'semua',
    category TEXT DEFAULT 'akademik',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

ALTER TABLE public.notifications ALTER COLUMN recipient_id DROP NOT NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'semua';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'akademik';

CREATE TABLE IF NOT EXISTS public.ai_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    feature_type TEXT NOT NULL, -- 'Modul_Ajar', 'TP_ATP', 'LKPD', 'Rubrik', 'Remedial'
    prompt_topic TEXT NOT NULL,
    result_content TEXT NOT NULL,
    is_adopted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_name TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

-- 13. INDEKS PERFORMA & INTEGRITAS TINGGI
CREATE INDEX IF NOT EXISTS idx_class_members_class_year ON public.class_members(class_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_lookup ON public.teaching_assignments(teacher_id, class_id, academic_year_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON public.student_attendance(class_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_sem ON public.student_attendance(student_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_journals_assignment_date ON public.teaching_journals(assignment_id, date);
CREATE INDEX IF NOT EXISTS idx_grades_assessment_student ON public.grades(assessment_id, student_id);
CREATE INDEX IF NOT EXISTS idx_final_grades_assignment ON public.final_grades(assignment_id);
CREATE INDEX IF NOT EXISTS idx_report_cards_student_sem ON public.report_cards(student_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_doc_links_teacher_status ON public.document_links(teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_guidance_student ON public.student_guidance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);
