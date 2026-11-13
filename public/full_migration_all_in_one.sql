-- ==============================================================================
-- SIMPEL MI AL IHSAN - FULL MIGRATION SCRIPT (TAHAP 2)
-- Sistem Informasi Manajemen Pembelajaran MI Ma'arif Al Ihsan Soborejo
-- Terdiri dari:
-- 1. Extensions, Types, & 42 Tabel Relasional
-- 2. Constraints, Unique Index, & Foreign Key Cascades
-- 3. Stored Helper Functions & Triggers Keamanan (Locking & Audit Trail)
-- 4. Pengaktifan Row Level Security (RLS) & Kebijakan Hak Akses Ketat
-- 5. Seed Data Master Awal (TA 2026/2027, Semester, Kelas 1-6, Mapel)
-- ==============================================================================

-- ==========================================
-- BAGIAN 1: EXTENSIONS & ENUMS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

-- ==========================================
-- BAGIAN 2: TABEL PENGGUNA & MASTER DATA
-- ==========================================
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

CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_name TEXT NOT NULL DEFAULT 'MI Ma’arif Al Ihsan Soborejo',
    nsm TEXT DEFAULT '111233080000',
    npsn TEXT DEFAULT '60700000',
    address TEXT DEFAULT 'Soborejo, Kec. Pringsurat, Kab. Temanggung, Jawa Tengah',
    principal_name TEXT DEFAULT 'Drs. H. Ahmad Ihsan, M.Pd.I',
    principal_nip TEXT DEFAULT '197508122005011003',
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
    name TEXT NOT NULL UNIQUE,
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
    nisn TEXT UNIQUE,
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
    name TEXT NOT NULL,
    phase VARCHAR(1) NOT NULL CHECK (phase IN ('A', 'B', 'C')),
    capacity INT NOT NULL DEFAULT 28,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_class_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('PAI', 'Umum', 'Muatan Lokal', 'Khas Ma''arif')),
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

-- ==========================================
-- BAGIAN 3: PENUGASAN & KBM HARIAN
-- ==========================================
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
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    period_start INT NOT NULL CHECK (period_start >= 1),
    period_end INT NOT NULL CHECK (period_end >= period_start),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    CONSTRAINT ck_schedule_time CHECK (end_time > start_time)
);

-- PERENCANAAN
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
    code TEXT NOT NULL,
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
    technique TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

-- KBM
CREATE TABLE IF NOT EXISTS public.teaching_journals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_hours TEXT NOT NULL,
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
    evidence_type TEXT NOT NULL,
    google_drive_url TEXT,
    notes TEXT,
    recorded_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS public.learning_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    recorded_by UUID NOT NULL REFERENCES public.profiles(id),
    dimension TEXT NOT NULL,
    observation_notes TEXT NOT NULL,
    observed_at DATE NOT NULL DEFAULT CURRENT_DATE
);

-- ASESMEN & NILAI
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
    name TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.final_grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.teaching_assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    formative_average NUMERIC(5,2),
    summative_average NUMERIC(5,2),
    final_score NUMERIC(5,2) NOT NULL,
    letter_grade VARCHAR(2),
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
    promotion_status TEXT,
    is_validated_by_homeroom BOOLEAN NOT NULL DEFAULT FALSE,
    is_approved_by_principal BOOLEAN NOT NULL DEFAULT FALSE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_report_card UNIQUE (student_id, academic_year_id, semester_id)
);

-- GOOGLE DRIVE ARCHIVE & SUPERVISION
CREATE TABLE IF NOT EXISTS public.document_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL,
    title TEXT NOT NULL,
    google_drive_url TEXT NOT NULL,
    file_id TEXT,
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

-- ==========================================
-- MODUL SUPERVISI TERSTRUKTUR (FORMULIR LANGSUNG)
-- ==========================================
DO $$ BEGIN
    CREATE TYPE supervision_type_enum AS ENUM (
        'Perencanaan_Pembelajaran',
        'Pelaksanaan_KBM',
        'Penilaian_Asesmen',
        'Supervisi_Klinis'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE followup_status_enum AS ENUM (
        'Belum_Dilaksanakan',
        'Dalam_Proses',
        'Selesai'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.supervision_instruments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    supervision_type supervision_type_enum NOT NULL DEFAULT 'Pelaksanaan_KBM',
    description TEXT,
    scale_min INT NOT NULL DEFAULT 1,
    scale_max INT NOT NULL DEFAULT 4,
    scale_type TEXT NOT NULL DEFAULT '1-4',
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.supervision_aspects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID NOT NULL REFERENCES public.supervision_instruments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INT NOT NULL DEFAULT 1,
    weight NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_instrument_aspect_order UNIQUE (instrument_id, order_index)
);

CREATE TABLE IF NOT EXISTS public.supervision_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aspect_id UUID NOT NULL REFERENCES public.supervision_aspects(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    order_index INT NOT NULL DEFAULT 1,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 4.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_aspect_indicator_order UNIQUE (aspect_id, order_index)
);

CREATE TABLE IF NOT EXISTS public.supervision_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID REFERENCES public.supervision_instruments(id) ON DELETE SET NULL,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    supervisor_id UUID NOT NULL REFERENCES public.profiles(id),
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    assignment_id UUID REFERENCES public.teaching_assignments(id) ON DELETE SET NULL,
    supervision_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supervision_type supervision_type_enum NOT NULL DEFAULT 'Pelaksanaan_KBM',
    topic TEXT NOT NULL,

    -- Catatan Aspek Kualitatif & Kurikulum Khusus Al Ihsan
    aspect_planning_notes TEXT,
    aspect_execution_notes TEXT,
    aspect_assessment_notes TEXT,
    aspect_classroom_management_notes TEXT,
    deep_learning_implementation_notes TEXT,
    love_based_curriculum_notes TEXT,
    general_observation_notes TEXT,
    strengths TEXT,
    areas_for_improvement TEXT,
    recommendations TEXT NOT NULL,
    action_plan_summary TEXT,

    -- Skor Kuantitatif & Predikat
    total_score NUMERIC(5,2),
    max_possible_score NUMERIC(5,2),
    percentage_score NUMERIC(5,2),
    predicate VARCHAR(20),

    -- Status & Validasi
    is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
    is_shared_with_teacher BOOLEAN NOT NULL DEFAULT TRUE,
    teacher_feedback TEXT,
    teacher_acknowledged_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE TABLE IF NOT EXISTS public.supervision_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supervision_record_id UUID NOT NULL REFERENCES public.supervision_records(id) ON DELETE CASCADE,
    indicator_id UUID NOT NULL REFERENCES public.supervision_indicators(id) ON DELETE CASCADE,
    score NUMERIC(5,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_supervision_record_indicator UNIQUE (supervision_record_id, indicator_id)
);

CREATE TABLE IF NOT EXISTS public.supervision_followups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supervision_record_id UUID NOT NULL REFERENCES public.supervision_records(id) ON DELETE CASCADE,
    activity_description TEXT NOT NULL,
    person_in_charge TEXT NOT NULL,
    target_date DATE,
    status followup_status_enum NOT NULL DEFAULT 'Belum_Dilaksanakan',
    result_notes TEXT,
    completion_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

-- BIMBINGAN SISWA
CREATE TABLE IF NOT EXISTS public.student_guidance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    recorded_by UUID NOT NULL REFERENCES public.profiles(id),
    guidance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    guidance_type TEXT NOT NULL,
    problem_description TEXT NOT NULL,
    counseling_summary TEXT NOT NULL,
    recommendation_followup TEXT NOT NULL,
    status guidance_status_type NOT NULL DEFAULT 'Dalam_Proses',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

-- NOTIFIKASI, AI & AUDIT LOGS
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
    feature_type TEXT NOT NULL,
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

-- INDEXES
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
CREATE INDEX IF NOT EXISTS idx_supervision_teacher_date ON public.supervision_records(teacher_id, supervision_date);
CREATE INDEX IF NOT EXISTS idx_supervision_year_sem ON public.supervision_records(academic_year_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_supervision_type ON public.supervision_records(supervision_type);
CREATE INDEX IF NOT EXISTS idx_supervision_results_record ON public.supervision_results(supervision_record_id);
CREATE INDEX IF NOT EXISTS idx_supervision_followups_record ON public.supervision_followups(supervision_record_id);

-- ==========================================
-- BAGIAN 4: FUNCTIONS & TRIGGERS
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('Asia/Jakarta', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ 
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'system_settings', 'profiles', 'teachers', 'students', 'teaching_journals',
        'grades', 'final_grades', 'document_links', 'student_guidance_records',
        'supervision_instruments', 'supervision_records', 'supervision_followups'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS tr_set_updated_at ON public.%I;
            CREATE TRIGGER tr_set_updated_at
            BEFORE UPDATE ON public.%I
            FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
        ', tbl, tbl);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    role_val text;
    idx int := 0;
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url',
        TRUE
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;

    IF lower(NEW.email) = 'alihsansoborejo@gmail.com' THEN
        INSERT INTO public.user_roles (user_id, role, is_primary)
        VALUES (NEW.id, 'admin', TRUE)
        ON CONFLICT (user_id, role) DO NOTHING;
    ELSIF jsonb_typeof(NEW.raw_user_meta_data->'roles') = 'array' THEN
        FOR role_val IN SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles') LOOP
            IF role_val IN ('guru', 'wali_kelas', 'kepala_madrasah') THEN
                INSERT INTO public.user_roles (user_id, role, is_primary)
                VALUES (NEW.id, role_val::user_role_type, idx = 0)
                ON CONFLICT (user_id, role) DO NOTHING;
                idx := idx + 1;
            END IF;
        END LOOP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
        INSERT INTO public.user_roles (user_id, role, is_primary)
        VALUES (NEW.id, 'guru', TRUE)
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sinkronisasi akun auth.users yang sudah telanjur dibuat sebelum skrip SQL dijalankan
INSERT INTO public.profiles (id, email, full_name, avatar_url, is_active)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    au.raw_user_meta_data->>'avatar_url',
    TRUE
FROM auth.users au
WHERE au.email IS NOT NULL
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email;

INSERT INTO public.user_roles (user_id, role, is_primary)
SELECT au.id, 'admin'::user_role_type, TRUE
FROM auth.users au
WHERE lower(au.email) = 'alihsansoborejo@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- HELPER FUNCTIONS FOR RLS
CREATE OR REPLACE FUNCTION public.has_role(target_role user_role_type)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = target_role
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_role('admin');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_principal()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_role('kepala_madrasah') OR public.has_role('admin');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_teacher_id()
RETURNS UUID AS $$
DECLARE
    tid UUID;
BEGIN
    SELECT id INTO tid FROM public.teachers WHERE user_id = auth.uid() LIMIT 1;
    RETURN tid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_homeroom_of_class(target_class_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    tid UUID;
BEGIN
    IF public.is_admin() OR public.has_role('kepala_madrasah') THEN
        RETURN TRUE;
    END IF;

    tid := public.get_current_teacher_id();
    IF tid IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.homeroom_assignments ha
        JOIN public.academic_years ay ON ha.academic_year_id = ay.id
        WHERE ha.teacher_id = tid
          AND ha.class_id = target_class_id
          AND ay.is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_teacher_of_assignment(target_assignment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    tid UUID;
BEGIN
    IF public.is_admin() THEN
        RETURN TRUE;
    END IF;

    tid := public.get_current_teacher_id();
    IF tid IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.teaching_assignments
        WHERE id = target_assignment_id
          AND teacher_id = tid
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_student_taught_by_me(target_student_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    tid UUID;
BEGIN
    IF public.is_admin() OR public.has_role('kepala_madrasah') THEN
        RETURN TRUE;
    END IF;

    tid := public.get_current_teacher_id();
    IF tid IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.class_members cm
        JOIN public.teaching_assignments ta ON cm.class_id = ta.class_id AND cm.academic_year_id = ta.academic_year_id
        WHERE cm.student_id = target_student_id
          AND ta.teacher_id = tid
    ) OR EXISTS (
        SELECT 1 FROM public.class_members cm
        JOIN public.homeroom_assignments ha ON cm.class_id = ha.class_id AND cm.academic_year_id = ha.academic_year_id
        WHERE cm.student_id = target_student_id
          AND ha.teacher_id = tid
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- GRADE AUDIT TRIGGER
CREATE OR REPLACE FUNCTION public.track_grade_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.score IS DISTINCT FROM NEW.score THEN
        INSERT INTO public.grade_audit_logs (
            grade_id,
            student_id,
            old_score,
            new_score,
            changed_by,
            reason
        ) VALUES (
            NEW.id,
            NEW.student_id,
            OLD.score,
            NEW.score,
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
            COALESCE(NEW.feedback, 'Pembaruan nilai oleh pengampu melalui sistem')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_grade_audit_log ON public.grades;
CREATE TRIGGER tr_grade_audit_log
AFTER UPDATE ON public.grades
FOR EACH ROW EXECUTE FUNCTION public.track_grade_change();

-- GRADE LOCK TRIGGER
CREATE OR REPLACE FUNCTION public.enforce_grade_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_is_locked BOOLEAN := FALSE;
    v_report_locked BOOLEAN := FALSE;
BEGIN
    SELECT is_report_card_locked INTO v_report_locked FROM public.system_settings LIMIT 1;
    IF v_report_locked = TRUE AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Akses ditolak: Seluruh periode penilaian dan rapor saat ini sedang dikunci oleh madrasah.';
    END IF;

    SELECT fg.is_locked INTO v_is_locked
    FROM public.assessments a
    JOIN public.final_grades fg ON fg.assignment_id = a.assignment_id AND fg.student_id = NEW.student_id
    WHERE a.id = NEW.assessment_id;

    IF v_is_locked = TRUE AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Akses ditolak: Nilai untuk siswa ini pada mata pelajaran tersebut telah disahkan dan dikunci.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_enforce_grade_lock ON public.grades;
CREATE TRIGGER tr_enforce_grade_lock
BEFORE UPDATE OR DELETE ON public.grades
FOR EACH ROW EXECUTE FUNCTION public.enforce_grade_lock();

-- SUPERVISION LOCK TRIGGER
CREATE OR REPLACE FUNCTION public.enforce_supervision_lock()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_finalized = TRUE AND NOT public.is_admin() THEN
        IF (NEW.total_score IS DISTINCT FROM OLD.total_score OR 
            NEW.recommendations IS DISTINCT FROM OLD.recommendations OR
            NEW.strengths IS DISTINCT FROM OLD.strengths) THEN
            RAISE EXCEPTION 'Akses ditolak: Hasil supervisi ini telah disahkan dan berstatus final.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_enforce_supervision_lock ON public.supervision_records;
CREATE TRIGGER tr_enforce_supervision_lock
BEFORE UPDATE ON public.supervision_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_supervision_lock();

-- ==========================================
-- BAGIAN 5: ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
DO $$ 
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'profiles', 'user_roles', 'system_settings', 'academic_years', 'semesters',
        'teachers', 'students', 'classes', 'subjects', 'class_members',
        'teaching_assignments', 'homeroom_assignments', 'schedules',
        'learning_outcomes', 'learning_objectives', 'learning_sequences', 'atp_objectives',
        'annual_programs', 'semester_programs', 'teaching_modules', 'worksheets', 'assessment_plans',
        'teaching_journals', 'student_attendance', 'learning_evidence', 'learning_progress',
        'assessments', 'assessment_components', 'grades', 'grade_audit_logs',
        'remedial_records', 'enrichment_records', 'final_grades', 'student_descriptions', 'report_cards',
        'document_links', 'document_link_versions', 'document_reviews', 'supervision_instruments',
        'supervision_aspects', 'supervision_indicators', 'supervision_records', 'supervision_results',
        'supervision_followups', 'student_guidance_records', 'notifications', 'ai_generations', 'activity_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    END LOOP;
END $$;

-- Profiles
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_all_authenticated" ON public.profiles
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
    FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (id = auth.uid() OR public.is_admin());

-- User Roles
DROP POLICY IF EXISTS "user_roles_select_own_or_admin" ON public.user_roles;
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
CREATE POLICY "user_roles_admin_all" ON public.user_roles
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Master Tables
DO $$ 
DECLARE
    tbl text;
    master_tables text[] := ARRAY[
        'system_settings', 'academic_years', 'semesters', 'classes', 'subjects',
        'teachers', 'students', 'class_members', 'teaching_assignments', 'homeroom_assignments', 'schedules'
    ];
BEGIN
    FOREACH tbl IN ARRAY master_tables LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS %I_read_all ON public.%I;
            CREATE POLICY %I_read_all ON public.%I FOR SELECT TO authenticated USING (TRUE);

            DROP POLICY IF EXISTS %I_admin_manage ON public.%I;
            CREATE POLICY %I_admin_manage ON public.%I FOR ALL TO authenticated 
                USING (public.is_admin()) WITH CHECK (public.is_admin());
        ', tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl);
    END LOOP;
END $$;

-- Planning Tables
DO $$ 
DECLARE
    tbl text;
    plan_tables text[] := ARRAY[
        'learning_outcomes', 'learning_objectives', 'learning_sequences', 'atp_objectives',
        'annual_programs', 'semester_programs', 'teaching_modules', 'worksheets', 'assessment_plans'
    ];
BEGIN
    FOREACH tbl IN ARRAY plan_tables LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS %I_read_auth ON public.%I;
            CREATE POLICY %I_read_auth ON public.%I FOR SELECT TO authenticated USING (TRUE);
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END $$;

DROP POLICY IF EXISTS "modules_write_own" ON public.teaching_modules;
CREATE POLICY "modules_write_own" ON public.teaching_modules
    FOR ALL TO authenticated
    USING (public.is_teacher_of_assignment(assignment_id) OR public.is_admin())
    WITH CHECK (public.is_teacher_of_assignment(assignment_id) OR public.is_admin());

DROP POLICY IF EXISTS "worksheets_write_own" ON public.worksheets;
CREATE POLICY "worksheets_write_own" ON public.worksheets
    FOR ALL TO authenticated
    USING (public.is_teacher_of_assignment(assignment_id) OR public.is_admin())
    WITH CHECK (public.is_teacher_of_assignment(assignment_id) OR public.is_admin());

-- Teaching Journals
DROP POLICY IF EXISTS "journals_select" ON public.teaching_journals;
CREATE POLICY "journals_select" ON public.teaching_journals
    FOR SELECT TO authenticated
    USING (public.is_teacher_of_assignment(assignment_id) OR public.is_principal());

DROP POLICY IF EXISTS "journals_write_own" ON public.teaching_journals;
CREATE POLICY "journals_write_own" ON public.teaching_journals
    FOR ALL TO authenticated
    USING (public.is_teacher_of_assignment(assignment_id) OR public.is_admin())
    WITH CHECK (public.is_teacher_of_assignment(assignment_id) OR public.is_admin());

-- Attendance
DROP POLICY IF EXISTS "attendance_select" ON public.student_attendance;
CREATE POLICY "attendance_select" ON public.student_attendance
    FOR SELECT TO authenticated
    USING (
        public.is_homeroom_of_class(class_id)
        OR public.is_student_taught_by_me(student_id)
        OR public.is_principal()
    );

DROP POLICY IF EXISTS "attendance_write" ON public.student_attendance;
CREATE POLICY "attendance_write" ON public.student_attendance
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_homeroom_of_class(class_id)
        OR public.is_student_taught_by_me(student_id)
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "attendance_update" ON public.student_attendance;
CREATE POLICY "attendance_update" ON public.student_attendance
    FOR UPDATE TO authenticated
    USING (
        recorded_by = auth.uid()
        OR public.is_homeroom_of_class(class_id)
        OR public.is_admin()
    )
    WITH CHECK (
        recorded_by = auth.uid()
        OR public.is_homeroom_of_class(class_id)
        OR public.is_admin()
    );

-- Assessments & Grades
DROP POLICY IF EXISTS "assessments_select" ON public.assessments;
CREATE POLICY "assessments_select" ON public.assessments
    FOR SELECT TO authenticated
    USING (public.is_teacher_of_assignment(assignment_id) OR public.is_principal());

DROP POLICY IF EXISTS "assessments_write_own" ON public.assessments;
CREATE POLICY "assessments_write_own" ON public.assessments
    FOR ALL TO authenticated
    USING (public.is_teacher_of_assignment(assignment_id) OR public.is_admin())
    WITH CHECK (public.is_teacher_of_assignment(assignment_id) OR public.is_admin());

DROP POLICY IF EXISTS "grades_select" ON public.grades;
CREATE POLICY "grades_select" ON public.grades
    FOR SELECT TO authenticated
    USING (public.is_student_taught_by_me(student_id) OR public.is_principal());

DROP POLICY IF EXISTS "grades_insert" ON public.grades;
CREATE POLICY "grades_insert" ON public.grades
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.assessments a
            WHERE a.id = assessment_id
              AND (public.is_teacher_of_assignment(a.assignment_id) OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "grades_update" ON public.grades;
CREATE POLICY "grades_update" ON public.grades
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.assessments a
            WHERE a.id = assessment_id
              AND (public.is_teacher_of_assignment(a.assignment_id) OR public.is_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.assessments a
            WHERE a.id = assessment_id
              AND (public.is_teacher_of_assignment(a.assignment_id) OR public.is_admin())
        )
    );

-- Remedial & Enrichment
DROP POLICY IF EXISTS "remedial_all" ON public.remedial_records;
CREATE POLICY "remedial_all" ON public.remedial_records
    FOR ALL TO authenticated
    USING (public.is_teacher_of_assignment(assignment_id) OR public.is_principal())
    WITH CHECK (public.is_teacher_of_assignment(assignment_id) OR public.is_admin());

DROP POLICY IF EXISTS "enrichment_all" ON public.enrichment_records;
CREATE POLICY "enrichment_all" ON public.enrichment_records
    FOR ALL TO authenticated
    USING (public.is_teacher_of_assignment(assignment_id) OR public.is_principal())
    WITH CHECK (public.is_teacher_of_assignment(assignment_id) OR public.is_admin());

DROP POLICY IF EXISTS "grade_audit_read" ON public.grade_audit_logs;
CREATE POLICY "grade_audit_read" ON public.grade_audit_logs
    FOR SELECT TO authenticated
    USING (public.is_principal() OR public.is_admin());

-- Final Grades & Report Cards
DROP POLICY IF EXISTS "final_grades_select" ON public.final_grades;
CREATE POLICY "final_grades_select" ON public.final_grades
    FOR SELECT TO authenticated
    USING (public.is_student_taught_by_me(student_id) OR public.is_principal());

DROP POLICY IF EXISTS "final_grades_write" ON public.final_grades;
CREATE POLICY "final_grades_write" ON public.final_grades
    FOR ALL TO authenticated
    USING (public.is_teacher_of_assignment(assignment_id) OR public.is_admin())
    WITH CHECK (public.is_teacher_of_assignment(assignment_id) OR public.is_admin());

DROP POLICY IF EXISTS "report_cards_select" ON public.report_cards;
CREATE POLICY "report_cards_select" ON public.report_cards
    FOR SELECT TO authenticated
    USING (public.is_homeroom_of_class(class_id) OR public.is_principal());

DROP POLICY IF EXISTS "report_cards_write" ON public.report_cards;
CREATE POLICY "report_cards_write" ON public.report_cards
    FOR ALL TO authenticated
    USING (public.is_homeroom_of_class(class_id) OR public.is_admin())
    WITH CHECK (public.is_homeroom_of_class(class_id) OR public.is_admin());

-- Google Drive Documents
DROP POLICY IF EXISTS "doc_links_select" ON public.document_links;
CREATE POLICY "doc_links_select" ON public.document_links
    FOR SELECT TO authenticated
    USING (teacher_id = public.get_current_teacher_id() OR public.is_principal());

DROP POLICY IF EXISTS "doc_links_write" ON public.document_links;
CREATE POLICY "doc_links_write" ON public.document_links
    FOR ALL TO authenticated
    USING (teacher_id = public.get_current_teacher_id() OR public.is_admin())
    WITH CHECK (teacher_id = public.get_current_teacher_id() OR public.is_admin());

DROP POLICY IF EXISTS "doc_reviews_select" ON public.document_reviews;
CREATE POLICY "doc_reviews_select" ON public.document_reviews
    FOR SELECT TO authenticated
    USING (
        public.is_principal()
        OR EXISTS (
            SELECT 1 FROM public.document_links dl
            WHERE dl.id = document_link_id
              AND dl.teacher_id = public.get_current_teacher_id()
        )
    );

DROP POLICY IF EXISTS "doc_reviews_write" ON public.document_reviews;
CREATE POLICY "doc_reviews_write" ON public.document_reviews
    FOR ALL TO authenticated
    USING (public.is_principal() OR public.is_admin())
    WITH CHECK (public.is_principal() OR public.is_admin());

-- MODUL SUPERVISI TERSTRUKTUR POLICIES
DROP POLICY IF EXISTS "supervision_instruments_read" ON public.supervision_instruments;
CREATE POLICY "supervision_instruments_read" ON public.supervision_instruments
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "supervision_instruments_manage" ON public.supervision_instruments;
CREATE POLICY "supervision_instruments_manage" ON public.supervision_instruments
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.has_role('kepala_madrasah'))
    WITH CHECK (public.is_admin() OR public.has_role('kepala_madrasah'));

DROP POLICY IF EXISTS "supervision_aspects_read" ON public.supervision_aspects;
CREATE POLICY "supervision_aspects_read" ON public.supervision_aspects
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "supervision_aspects_manage" ON public.supervision_aspects;
CREATE POLICY "supervision_aspects_manage" ON public.supervision_aspects
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.has_role('kepala_madrasah'))
    WITH CHECK (public.is_admin() OR public.has_role('kepala_madrasah'));

DROP POLICY IF EXISTS "supervision_indicators_read" ON public.supervision_indicators;
CREATE POLICY "supervision_indicators_read" ON public.supervision_indicators
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "supervision_indicators_manage" ON public.supervision_indicators;
CREATE POLICY "supervision_indicators_manage" ON public.supervision_indicators
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.has_role('kepala_madrasah'))
    WITH CHECK (public.is_admin() OR public.has_role('kepala_madrasah'));

DROP POLICY IF EXISTS "supervision_records_select" ON public.supervision_records;
CREATE POLICY "supervision_records_select" ON public.supervision_records
    FOR SELECT TO authenticated
    USING (
        public.is_principal()
        OR (teacher_id = public.get_current_teacher_id() AND is_shared_with_teacher = TRUE)
    );

DROP POLICY IF EXISTS "supervision_records_insert" ON public.supervision_records;
CREATE POLICY "supervision_records_insert" ON public.supervision_records
    FOR INSERT TO authenticated
    WITH CHECK (public.is_principal());

DROP POLICY IF EXISTS "supervision_records_update" ON public.supervision_records;
CREATE POLICY "supervision_records_update" ON public.supervision_records
    FOR UPDATE TO authenticated
    USING (
        public.is_principal()
        OR (teacher_id = public.get_current_teacher_id() AND is_shared_with_teacher = TRUE)
    )
    WITH CHECK (
        public.is_principal()
        OR (teacher_id = public.get_current_teacher_id() AND is_shared_with_teacher = TRUE)
    );

DROP POLICY IF EXISTS "supervision_records_delete" ON public.supervision_records;
CREATE POLICY "supervision_records_delete" ON public.supervision_records
    FOR DELETE TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "supervision_results_select" ON public.supervision_results;
CREATE POLICY "supervision_results_select" ON public.supervision_results
    FOR SELECT TO authenticated
    USING (
        public.is_principal()
        OR EXISTS (
            SELECT 1 FROM public.supervision_records sr
            WHERE sr.id = supervision_record_id
              AND sr.teacher_id = public.get_current_teacher_id()
              AND sr.is_shared_with_teacher = TRUE
        )
    );

DROP POLICY IF EXISTS "supervision_results_manage" ON public.supervision_results;
CREATE POLICY "supervision_results_manage" ON public.supervision_results
    FOR ALL TO authenticated
    USING (public.is_principal())
    WITH CHECK (public.is_principal());

DROP POLICY IF EXISTS "supervision_followups_select" ON public.supervision_followups;
CREATE POLICY "supervision_followups_select" ON public.supervision_followups
    FOR SELECT TO authenticated
    USING (
        public.is_principal()
        OR EXISTS (
            SELECT 1 FROM public.supervision_records sr
            WHERE sr.id = supervision_record_id
              AND sr.teacher_id = public.get_current_teacher_id()
              AND sr.is_shared_with_teacher = TRUE
        )
    );

DROP POLICY IF EXISTS "supervision_followups_manage" ON public.supervision_followups;
CREATE POLICY "supervision_followups_manage" ON public.supervision_followups
    FOR ALL TO authenticated
    USING (
        public.is_principal()
        OR EXISTS (
            SELECT 1 FROM public.supervision_records sr
            WHERE sr.id = supervision_record_id
              AND sr.teacher_id = public.get_current_teacher_id()
        )
    )
    WITH CHECK (
        public.is_principal()
        OR EXISTS (
            SELECT 1 FROM public.supervision_records sr
            WHERE sr.id = supervision_record_id
              AND sr.teacher_id = public.get_current_teacher_id()
        )
    );

-- Student Guidance (BK)
DROP POLICY IF EXISTS "guidance_select_strict" ON public.student_guidance_records;
CREATE POLICY "guidance_select_strict" ON public.student_guidance_records
    FOR SELECT TO authenticated
    USING (recorded_by = auth.uid() OR public.is_principal());

DROP POLICY IF EXISTS "guidance_insert_own" ON public.student_guidance_records;
CREATE POLICY "guidance_insert_own" ON public.student_guidance_records
    FOR INSERT TO authenticated
    WITH CHECK (recorded_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "guidance_update_own" ON public.student_guidance_records;
CREATE POLICY "guidance_update_own" ON public.student_guidance_records
    FOR UPDATE TO authenticated
    USING (recorded_by = auth.uid() OR public.is_admin())
    WITH CHECK (recorded_by = auth.uid() OR public.is_admin());

-- Notifications & AI
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications
    FOR ALL TO authenticated
    USING (recipient_id = auth.uid() OR recipient_id IS NULL)
    WITH CHECK (recipient_id = auth.uid() OR recipient_id IS NULL);

DROP POLICY IF EXISTS "ai_generations_own" ON public.ai_generations;
CREATE POLICY "ai_generations_own" ON public.ai_generations
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "activity_logs_select_admin" ON public.activity_logs;
CREATE POLICY "activity_logs_select_admin" ON public.activity_logs
    FOR SELECT TO authenticated
    USING (public.is_principal() OR public.is_admin());

DROP POLICY IF EXISTS "activity_logs_insert_authenticated" ON public.activity_logs;
CREATE POLICY "activity_logs_insert_authenticated" ON public.activity_logs
    FOR INSERT TO authenticated
    WITH CHECK (TRUE);

-- ==========================================
-- BAGIAN 6: SEED DATA MASTER AWAL
-- ==========================================
INSERT INTO public.system_settings (
    school_name,
    nsm,
    npsn,
    address,
    principal_name,
    principal_nip,
    kktp_default,
    is_report_card_locked
)
SELECT
    'MI Ma’arif Al Ihsan Soborejo',
    '111233080000',
    '60700000',
    'Soborejo, Kec. Pringsurat, Kab. Temanggung, Jawa Tengah',
    'Drs. H. Ahmad Ihsan, M.Pd.I',
    '197508122005011003',
    75.00,
    FALSE
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);

INSERT INTO public.academic_years (id, name, start_date, end_date, is_active)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', '2026/2027', '2026-07-15', '2027-06-25', TRUE),
    ('a0000000-0000-0000-0000-000000000002', '2025/2026', '2025-07-15', '2026-06-25', FALSE)
ON CONFLICT (name) DO NOTHING;

UPDATE public.system_settings
SET active_academic_year_id = 'a0000000-0000-0000-0000-000000000001'
WHERE active_academic_year_id IS NULL;

INSERT INTO public.semesters (id, academic_year_id, semester_type, start_date, end_date, is_active)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ganjil', '2026-07-15', '2026-12-20', TRUE),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Genap', '2027-01-05', '2027-06-25', FALSE)
ON CONFLICT (academic_year_id, semester_type) DO NOTHING;

UPDATE public.system_settings
SET active_semester_id = 'b0000000-0000-0000-0000-000000000001'
WHERE active_semester_id IS NULL;

INSERT INTO public.classes (id, level, name, phase, capacity)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 1, 'Kelas 1', 'A', 28),
    ('c0000000-0000-0000-0000-000000000002', 2, 'Kelas 2', 'A', 28),
    ('c0000000-0000-0000-0000-000000000003', 3, 'Kelas 3', 'B', 28),
    ('c0000000-0000-0000-0000-000000000004', 4, 'Kelas 4', 'B', 28),
    ('c0000000-0000-0000-0000-000000000005', 5, 'Kelas 5', 'C', 28),
    ('c0000000-0000-0000-0000-000000000006', 6, 'Kelas 6', 'C', 28)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.subjects (code, name, category, order_index)
VALUES
    ('QH', 'Al-Qur’an Hadis', 'PAI', 1),
    ('AA', 'Akidah Akhlak', 'PAI', 2),
    ('FIK', 'Fikih', 'PAI', 3),
    ('SKI', 'Sejarah Kebudayaan Islam', 'PAI', 4),
    ('ARB', 'Bahasa Arab', 'PAI', 5),
    ('ASWJ', 'Ke-NU-an / Ke-Ma''arif-an', 'Khas Ma''arif', 6),
    ('PP', 'Pendidikan Pancasila', 'Umum', 7),
    ('BIN', 'Bahasa Indonesia', 'Umum', 8),
    ('MTK', 'Matematika', 'Umum', 9),
    ('IPAS', 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', 'Umum', 10),
    ('PJOK', 'PJOK', 'Umum', 11),
    ('SB', 'Seni dan Budaya', 'Umum', 12),
    ('ING', 'Bahasa Inggris', 'Umum', 13),
    ('BJW', 'Bahasa Jawa', 'Muatan Lokal', 14)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.teachers (id, nip, full_name, title_prefix, title_suffix, gender, specialization)
VALUES
    ('d0000000-0000-0000-0000-000000000001', '198204152010011015', 'Ahmad Fauzi', 'Ust.', 'S.Pd.I', 'L', 'Guru Kelas & PAI'),
    ('d0000000-0000-0000-0000-000000000002', '198711202014022008', 'Siti Maryam', 'Usth.', 'S.Pd.', 'P', 'Guru Kelas 4'),
    ('d0000000-0000-0000-0000-000000000003', '199003052019031012', 'Muhammad Ridwan', 'Ust.', 'S.Pd.', 'L', 'Guru PJOK & Mulok')
ON CONFLICT (nip) DO NOTHING;

INSERT INTO public.students (id, nis, nisn, full_name, nickname, gender, birth_place, birth_date)
VALUES
    ('e0000000-0000-0000-0000-000000000001', '260401', '0145678901', 'Muhammad Ilham Pratama [DEMO]', 'Ilham', 'L', 'Temanggung', '2016-04-12'),
    ('e0000000-0000-0000-0000-000000000002', '260402', '0145678902', 'Aisyah Nur Salsabila [DEMO]', 'Aisyah', 'P', 'Magelang', '2016-08-25'),
    ('e0000000-0000-0000-0000-000000000003', '260403', '0145678903', 'Fajar Khoirul Anam [DEMO]', 'Fajar', 'L', 'Temanggung', '2016-01-19')
ON CONFLICT (nis) DO NOTHING;

INSERT INTO public.class_members (student_id, class_id, academic_year_id, student_number)
VALUES
    ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 1),
    ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 2),
    ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 3)
ON CONFLICT (student_id, academic_year_id) DO NOTHING;

INSERT INTO public.homeroom_assignments (teacher_id, class_id, academic_year_id)
VALUES
    ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (class_id, academic_year_id) DO NOTHING;

-- INSTRUMEN DEFAULT SUPERVISI MI MA'ARIF AL IHSAN
INSERT INTO public.supervision_instruments (
    id, name, supervision_type, description, scale_min, scale_max, scale_type, is_active
) VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'Instrumen Observasi KBM Pembelajaran Mendalam & Berbasis Cinta',
    'Pelaksanaan_KBM',
    'Standar evaluasi supervisi klinis dan pembelajaran mendalam berkarakter ke-Ma’arif-an',
    1, 4, '1-4', TRUE
) ON CONFLICT DO NOTHING;

INSERT INTO public.supervision_aspects (id, instrument_id, name, order_index, weight, description)
VALUES
    ('f1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Perencanaan Pembelajaran', 1, 1.00, 'Kesiapan Modul Ajar, TP, ATP, dan media'),
    ('f1000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'Pelaksanaan Pembelajaran Mendalam (Deep Learning)', 2, 1.50, 'Aktivitas pemahaman bermakna, berpikir kritis, dan kolaborasi'),
    ('f1000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 'Penerapan Kurikulum Berbasis Cinta', 3, 1.50, 'Iklim kasih sayang, penghargaan pada siswa, dan akhlak karimah'),
    ('f1000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 'Pengelolaan Kelas & Interaksi', 4, 1.00, 'Kondusifitas ruang belajar dan manajemen waktu'),
    ('f1000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000001', 'Asesmen Formatif & Refleksi', 5, 1.00, 'Umpan balik langsung dan refleksi bersama murid')
ON CONFLICT DO NOTHING;

INSERT INTO public.supervision_indicators (id, aspect_id, code, name, description, order_index, max_score)
VALUES
    ('f2000000-0000-0000-0000-000000000101', 'f1000000-0000-0000-0000-000000000001', '1.1', 'Kesesuaian TP dengan Karakteristik Siswa', 'Tujuan pembelajaran jelas dan terukur', 1, 4.00),
    ('f2000000-0000-0000-0000-000000000102', 'f1000000-0000-0000-0000-000000000001', '1.2', 'Kesiapan Lembar Kerja Peserta Didik (LKPD)', 'LKPD memfasilitasi eksplorasi mandiri', 2, 4.00),
    ('f2000000-0000-0000-0000-000000000201', 'f1000000-0000-0000-0000-000000000002', '2.1', 'Stimulasi Berpikir Kritis & Reflektif', 'Guru memantik pertanyaan terbuka dan mendalam', 1, 4.00),
    ('f2000000-0000-0000-0000-000000000202', 'f1000000-0000-0000-0000-000000000002', '2.2', 'Konstruksi Pengetahuan Kontekstual', 'Mengaitkan materi dengan kehidupan nyata santri', 2, 4.00),
    ('f2000000-0000-0000-0000-000000000301', 'f1000000-0000-0000-0000-000000000003', '3.1', 'Interaksi Kasih Sayang & Keteladanan', 'Komunikasi santun, ramah anak, dan tanpa kekerasan', 1, 4.00),
    ('f2000000-0000-0000-0000-000000000302', 'f1000000-0000-0000-0000-000000000003', '3.2', 'Penguatan Nilai Rahmatan lil Alamin', 'Menanamkan rasa syukur, persaudaraan, dan empati', 2, 4.00),
    ('f2000000-0000-0000-0000-000000000401', 'f1000000-0000-0000-0000-000000000004', '4.1', 'Keterlibatan Aktif Seluruh Murid', 'Semua anak berpartisipasi setara tanpa diskriminasi', 1, 4.00),
    ('f2000000-0000-0000-0000-000000000501', 'f1000000-0000-0000-0000-000000000005', '5.1', 'Pemberian Umpan Balik Positif Konstruktif', 'Guru mengapresiasi usaha dan memberikan arahan perbaikan', 1, 4.00)
ON CONFLICT DO NOTHING;

-- ==========================================
-- BAGIAN 7: AKTIFKAN SUPABASE REALTIME REPLICATION
-- ==========================================
DO $$
DECLARE
    tbl text;
    rt_tables text[] := ARRAY[
        'system_settings', 'academic_years', 'semesters', 'classes', 'subjects',
        'teachers', 'students', 'class_members', 'teaching_assignments', 'homeroom_assignments',
        'schedules', 'teaching_journals', 'student_attendance', 'assessments', 'grades',
        'final_grades', 'report_cards', 'document_links', 'supervision_records',
        'student_guidance_records', 'notifications'
    ];
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH tbl IN ARRAY rt_tables LOOP
            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime'
                  AND schemaname = 'public'
                  AND tablename = tbl
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
            END IF;
        END LOOP;
    END IF;
END $$;

-- ==========================================
-- BAGIAN 8: SINKRONISASI LINTAS PERANGKAT & AUTENTIKASI GURU
-- ==========================================
DROP POLICY IF EXISTS "system_settings_public_read" ON public.system_settings;
CREATE POLICY "system_settings_public_read" ON public.system_settings
    FOR SELECT TO anon, authenticated USING (TRUE);

CREATE TABLE IF NOT EXISTS public.app_sync_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    revision BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_sync_state_read_all" ON public.app_sync_state;
CREATE POLICY "app_sync_state_read_all" ON public.app_sync_state
    FOR SELECT TO anon, authenticated USING (TRUE);

DROP POLICY IF EXISTS "app_sync_state_write_auth" ON public.app_sync_state;
CREATE POLICY "app_sync_state_write_auth" ON public.app_sync_state
    FOR INSERT TO authenticated
    WITH CHECK (key NOT IN ('simpel_users_cache_v2', 'simpel_settings') OR public.is_admin());

DROP POLICY IF EXISTS "app_sync_state_update_auth" ON public.app_sync_state;
CREATE POLICY "app_sync_state_update_auth" ON public.app_sync_state
    FOR UPDATE TO authenticated
    USING (key NOT IN ('simpel_users_cache_v2', 'simpel_settings') OR public.is_admin())
    WITH CHECK (key NOT IN ('simpel_users_cache_v2', 'simpel_settings') OR public.is_admin());

DROP POLICY IF EXISTS "app_sync_state_delete_admin" ON public.app_sync_state;
CREATE POLICY "app_sync_state_delete_admin" ON public.app_sync_state
    FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.app_user_credentials (
    email TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    roles JSONB NOT NULL DEFAULT '["guru"]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    teacher_id TEXT,
    homeroom_class_id TEXT,
    phone_number TEXT,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_user_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_user_credentials_admin_only" ON public.app_user_credentials;
CREATE POLICY "app_user_credentials_admin_only" ON public.app_user_credentials
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.sync_app_user_credentials(
    p_users JSONB,
    p_prune BOOLEAN DEFAULT FALSE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
    v_email TEXT;
    v_user_id TEXT;
    v_full_name TEXT;
    v_roles JSONB;
    v_is_active BOOLEAN;
    v_teacher_id TEXT;
    v_phone TEXT;
    v_raw_pw TEXT;
    v_salt TEXT;
    v_hash TEXT;
    v_emails TEXT[] := ARRAY[]::TEXT[];
    v_count INTEGER := 0;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Hanya Administrator madrasah yang berhak menyinkronkan kredensial.';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_users, '[]'::jsonb)) LOOP
        v_email := LOWER(TRIM(COALESCE(v_item->>'email', '')));
        IF v_email = '' THEN
            CONTINUE;
        END IF;

        v_emails := array_append(v_emails, v_email);
        v_user_id := COALESCE(NULLIF(TRIM(v_item->>'id'), ''), 'usr-' || md5(v_email));
        v_full_name := COALESCE(NULLIF(TRIM(v_item->>'full_name'), ''), split_part(v_email, '@', 1));
        v_roles := CASE
            WHEN jsonb_typeof(v_item->'roles') = 'array' THEN v_item->'roles'
            ELSE '["guru"]'::jsonb
        END;
        v_is_active := COALESCE((v_item->>'is_active')::BOOLEAN, TRUE);
        v_teacher_id := NULLIF(TRIM(COALESCE(v_item->'teacher_info'->>'id', '')), '');
        v_phone := NULLIF(TRIM(COALESCE(v_item->>'phone_number', '')), '');

        v_raw_pw := NULLIF(TRIM(COALESCE(v_item->>'password', '')), '');
        IF v_raw_pw IN ('__CLOUD_VERIFIED__', '••••••••') THEN
            v_raw_pw := NULL;
        END IF;

        v_salt := encode(sha256((random()::text || clock_timestamp()::text || v_email)::bytea), 'hex');
        v_hash := encode(sha256((v_salt || ':' || COALESCE(v_raw_pw, 'AlIhsan2026!'))::bytea), 'hex');

        INSERT INTO public.app_user_credentials (
            email, user_id, full_name, roles, is_active, teacher_id, phone_number, salt, password_hash, updated_at
        ) VALUES (
            v_email, v_user_id, v_full_name, v_roles, v_is_active, v_teacher_id, v_phone, v_salt, v_hash, NOW()
        )
        ON CONFLICT (email) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            full_name = EXCLUDED.full_name,
            roles = EXCLUDED.roles,
            is_active = EXCLUDED.is_active,
            teacher_id = COALESCE(EXCLUDED.teacher_id, public.app_user_credentials.teacher_id),
            phone_number = COALESCE(EXCLUDED.phone_number, public.app_user_credentials.phone_number),
            salt = CASE WHEN v_raw_pw IS NOT NULL THEN EXCLUDED.salt ELSE public.app_user_credentials.salt END,
            password_hash = CASE WHEN v_raw_pw IS NOT NULL THEN EXCLUDED.password_hash ELSE public.app_user_credentials.password_hash END,
            updated_at = NOW();

        v_count := v_count + 1;
    END LOOP;

    IF p_prune AND COALESCE(array_length(v_emails, 1), 0) > 0 THEN
        DELETE FROM public.app_user_credentials
        WHERE email <> 'alihsansoborejo@gmail.com'
          AND NOT (email = ANY(v_emails));
    END IF;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_app_user_credentials(JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_app_user_credentials(JSONB, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_app_user_login(
    p_email TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT := LOWER(TRIM(COALESCE(p_email, '')));
    v_rec public.app_user_credentials%ROWTYPE;
    v_computed TEXT;
BEGIN
    IF v_email = '' THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_found');
    END IF;

    SELECT * INTO v_rec
    FROM public.app_user_credentials
    WHERE email = v_email
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'not_found');
    END IF;

    IF NOT v_rec.is_active THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'inactive');
    END IF;

    v_computed := encode(sha256((v_rec.salt || ':' || COALESCE(p_password, ''))::bytea), 'hex');
    IF v_computed <> v_rec.password_hash THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason', 'invalid_password');
    END IF;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'user', jsonb_build_object(
            'id', v_rec.user_id,
            'email', v_rec.email,
            'full_name', v_rec.full_name,
            'roles', v_rec.roles,
            'is_active', v_rec.is_active,
            'teacher_id', v_rec.teacher_id,
            'homeroom_class_id', v_rec.homeroom_class_id,
            'phone_number', v_rec.phone_number
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_app_user_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_app_user_login(TEXT, TEXT) TO anon, authenticated;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'app_sync_state'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.app_sync_state;
        END IF;
    END IF;
END $$;
