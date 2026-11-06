-- ==============================================================================
-- SIMPEL MI AL IHSAN - REVISI MODUL SUPERVISI FORMULIR LANGSUNG (TAHAP 2+)
-- Migrasi: 20261105000005_revised_supervision_module.sql
-- Keterangan:
-- Supervisi Kepala Madrasah beralih murni menggunakan formulir langsung di aplikasi,
-- bukan upload atau tautan Google Drive.
-- Menyediakan instrumen dinamis, aspek penilaian, indikator, rekap skor terstruktur,
-- dan siklus tindak lanjut.
-- ==============================================================================

-- 1. TIPE ENUM TAMBAHAN
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

-- 2. TABEL INSTRUMEN SUPERVISI (DAPAT DIKONFIGURASI ADMIN / KAMAD)
CREATE TABLE IF NOT EXISTS public.supervision_instruments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    supervision_type supervision_type_enum NOT NULL DEFAULT 'Pelaksanaan_KBM',
    description TEXT,
    scale_min INT NOT NULL DEFAULT 1,
    scale_max INT NOT NULL DEFAULT 4,
    scale_type TEXT NOT NULL DEFAULT '1-4', -- '1-4', '1-100', 'Ya/Tidak'
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

-- 3. ASPEK PENILAIAN DALAM INSTRUMEN
CREATE TABLE IF NOT EXISTS public.supervision_aspects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID NOT NULL REFERENCES public.supervision_instruments(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Contoh: 'Perencanaan', 'Pelaksanaan KBM Mendalam', 'Kurikulum Berbasis Cinta', 'Pengelolaan Kelas', 'Asesmen'
    order_index INT NOT NULL DEFAULT 1,
    weight NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_instrument_aspect_order UNIQUE (instrument_id, order_index)
);

-- 4. INDIKATOR PENILAIAN PER ASPEK
CREATE TABLE IF NOT EXISTS public.supervision_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aspect_id UUID NOT NULL REFERENCES public.supervision_aspects(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- Contoh: 'IND-1.1'
    name TEXT NOT NULL,
    description TEXT,
    order_index INT NOT NULL DEFAULT 1,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 4.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_aspect_indicator_order UNIQUE (aspect_id, order_index)
);

-- 5. REVISI TABEL SUPERVISION_RECORDS (HASIL SUPERVISI TERSTRUKTUR LENGKAP)
-- Jika tabel lama ada, kita sesuaikan atau buat baru
CREATE TABLE IF NOT EXISTS public.supervision_records_new (
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
    topic TEXT NOT NULL, -- Materi / Topik pembelajaran yang diobservasi

    -- Uraian Aspek Kualitatif & Kurikulum Khusus Al Ihsan
    aspect_planning_notes TEXT,
    aspect_execution_notes TEXT,
    aspect_assessment_notes TEXT,
    aspect_classroom_management_notes TEXT,
    deep_learning_implementation_notes TEXT, -- Penerapan Pembelajaran Mendalam
    love_based_curriculum_notes TEXT,        -- Penerapan Kurikulum Berbasis Cinta
    general_observation_notes TEXT,          -- Catatan hasil pengamatan menyeluruh
    strengths TEXT,                          -- Kelebihan guru
    areas_for_improvement TEXT,              -- Hal yang perlu ditingkatkan
    recommendations TEXT NOT NULL,           -- Rekomendasi dan saran
    action_plan_summary TEXT,                -- Ringkasan rencana tindak lanjut

    -- Skor Kuantitatif & Predikat
    total_score NUMERIC(5,2),
    max_possible_score NUMERIC(5,2),
    percentage_score NUMERIC(5,2),
    predicate VARCHAR(20), -- 'Amat Baik', 'Baik', 'Cukup', 'Kurang'

    -- Status & Validasi
    is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
    is_shared_with_teacher BOOLEAN NOT NULL DEFAULT TRUE,
    teacher_feedback TEXT,
    teacher_acknowledged_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

-- Migrasi data lama dari supervision_records jika ada
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'supervision_records') THEN
        INSERT INTO public.supervision_records_new (
            id, teacher_id, assignment_id, academic_year_id, semester_id,
            supervision_date, supervisor_id, topic,
            strengths, areas_for_improvement, recommendations, created_at
        )
        SELECT 
            id, teacher_id, assignment_id, academic_year_id, semester_id,
            supervision_date, supervisor_id, 'KBM Terjadwal',
            strengths, weaknesses, recommendations, created_at
        FROM public.supervision_records
        ON CONFLICT (id) DO NOTHING;
        
        DROP TABLE public.supervision_records CASCADE;
    END IF;
    ALTER TABLE public.supervision_records_new RENAME TO supervision_records;
EXCEPTION WHEN OTHERS THEN
    -- Fallback jika tabel sudah berbentuk supervision_records
    null;
END $$;

-- 6. TABEL HASIL SKOR PER INDIKATOR (SUPERVISION_RESULTS)
CREATE TABLE IF NOT EXISTS public.supervision_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supervision_record_id UUID NOT NULL REFERENCES public.supervision_records(id) ON DELETE CASCADE,
    indicator_id UUID NOT NULL REFERENCES public.supervision_indicators(id) ON DELETE CASCADE,
    score NUMERIC(5,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    CONSTRAINT uq_supervision_record_indicator UNIQUE (supervision_record_id, indicator_id)
);

-- 7. TABEL TINDAK LANJUT SUPERVISI (SUPERVISION_FOLLOWUPS)
CREATE TABLE IF NOT EXISTS public.supervision_followups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supervision_record_id UUID NOT NULL REFERENCES public.supervision_records(id) ON DELETE CASCADE,
    activity_description TEXT NOT NULL, -- Uraian tindak lanjut
    person_in_charge TEXT NOT NULL,    -- Penanggung jawab (Guru, Kepala, KKG)
    target_date DATE,                  -- Target waktu
    status followup_status_enum NOT NULL DEFAULT 'Belum_Dilaksanakan',
    result_notes TEXT,                 -- Catatan hasil tindak lanjut
    completion_date DATE,              -- Tanggal penyelesaian
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

-- 8. INDEX UNTUK PERFORMA & FILTER LAPORAN
CREATE INDEX IF NOT EXISTS idx_supervision_teacher_date ON public.supervision_records(teacher_id, supervision_date);
CREATE INDEX IF NOT EXISTS idx_supervision_year_sem ON public.supervision_records(academic_year_id, semester_id);
CREATE INDEX IF NOT EXISTS idx_supervision_type ON public.supervision_records(supervision_type);
CREATE INDEX IF NOT EXISTS idx_supervision_results_record ON public.supervision_results(supervision_record_id);
CREATE INDEX IF NOT EXISTS idx_supervision_followups_record ON public.supervision_followups(supervision_record_id);

-- 9. TRIGGER UPDATED_AT
DO $$ 
DECLARE
    tbl text;
    tables text[] := ARRAY[
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

-- 10. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.supervision_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_aspects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_followups ENABLE ROW LEVEL SECURITY;

-- Instruments, Aspects, Indicators:
-- Semua user terautentikasi dapat melihat instrumen
-- Hanya Admin & Kepala Madrasah yang dapat mengonfigurasi
CREATE POLICY "supervision_instruments_read" ON public.supervision_instruments
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "supervision_instruments_manage" ON public.supervision_instruments
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.has_role('kepala_madrasah'))
    WITH CHECK (public.is_admin() OR public.has_role('kepala_madrasah'));

CREATE POLICY "supervision_aspects_read" ON public.supervision_aspects
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "supervision_aspects_manage" ON public.supervision_aspects
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.has_role('kepala_madrasah'))
    WITH CHECK (public.is_admin() OR public.has_role('kepala_madrasah'));

CREATE POLICY "supervision_indicators_read" ON public.supervision_indicators
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "supervision_indicators_manage" ON public.supervision_indicators
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.has_role('kepala_madrasah'))
    WITH CHECK (public.is_admin() OR public.has_role('kepala_madrasah'));

-- Supervision Records:
-- SELECT: Kepala Madrasah, Admin, atau Guru yang bersangkutan (jika di-share)
CREATE POLICY "supervision_records_select" ON public.supervision_records
    FOR SELECT TO authenticated
    USING (
        public.is_principal()
        OR (teacher_id = public.get_current_teacher_id() AND is_shared_with_teacher = TRUE)
    );

-- INSERT: HANYA Kepala Madrasah & Admin
CREATE POLICY "supervision_records_insert" ON public.supervision_records
    FOR INSERT TO authenticated
    WITH CHECK (public.is_principal());

-- UPDATE: Kepala Madrasah & Admin (atau Guru hanya untuk memberikan tanggapan balik / konfirmasi)
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

-- DELETE: HANYA Admin
CREATE POLICY "supervision_records_delete" ON public.supervision_records
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- Supervision Results:
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

CREATE POLICY "supervision_results_manage" ON public.supervision_results
    FOR ALL TO authenticated
    USING (public.is_principal())
    WITH CHECK (public.is_principal());

-- Supervision Followups:
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

-- 11. TRIGGER KEAMANAN PENGESAHAN SUPERVISI
-- Jika supervisi sudah disahkan (is_finalized = TRUE), Kepala Madrasah atau Guru tidak dapat mengubah skor tanpa izin Admin
CREATE OR REPLACE FUNCTION public.enforce_supervision_lock()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_finalized = TRUE AND NOT public.is_admin() THEN
        -- Izinkan guru hanya memperbarui catatan tanggapan balik dan waktu konfirmasi
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

-- 12. SEED INSTRUMEN DEFAULT SUPERVISI MI MA'ARIF AL IHSAN
INSERT INTO public.supervision_instruments (
    id, name, supervision_type, description, scale_min, scale_max, scale_type, is_active
) VALUES (
    'ins-00000000-0000-0000-0000-000000000001',
    'Instrumen Observasi KBM Pembelajaran Mendalam & Berbasis Cinta',
    'Pelaksanaan_KBM',
    'Standar evaluasi supervisi klinis dan pembelajaran mendalam berkarakter ke-Ma’arif-an',
    1, 4, '1-4', TRUE
) ON CONFLICT DO NOTHING;

-- Aspek Default
INSERT INTO public.supervision_aspects (id, instrument_id, name, order_index, weight, description)
VALUES
    ('asp-001', 'ins-00000000-0000-0000-0000-000000000001', 'Perencanaan Pembelajaran', 1, 1.00, 'Kesiapan Modul Ajar, TP, ATP, dan media'),
    ('asp-002', 'ins-00000000-0000-0000-0000-000000000001', 'Pelaksanaan Pembelajaran Mendalam (Deep Learning)', 2, 1.50, 'Aktivitas pemahaman bermakna, berpikir kritis, dan kolaborasi'),
    ('asp-003', 'ins-00000000-0000-0000-0000-000000000001', 'Penerapan Kurikulum Berbasis Cinta', 3, 1.50, 'Iklim kasih sayang, penghargaan pada siswa, dan akhlak karimah'),
    ('asp-004', 'ins-00000000-0000-0000-0000-000000000001', 'Pengelolaan Kelas & Interaksi', 4, 1.00, 'Kondusifitas ruang belajar dan manajemen waktu'),
    ('asp-005', 'ins-00000000-0000-0000-0000-000000000001', 'Asesmen Formatif & Refleksi', 5, 1.00, 'Umpan balik langsung dan refleksi bersama murid')
ON CONFLICT DO NOTHING;

-- Indikator Default
INSERT INTO public.supervision_indicators (id, aspect_id, code, name, description, order_index, max_score)
VALUES
    ('ind-101', 'asp-001', '1.1', 'Kesesuaian TP dengan Karakteristik Siswa', 'Tujuan pembelajaran jelas dan terukur', 1, 4.00),
    ('ind-102', 'asp-001', '1.2', 'Kesiapan Lembar Kerja Peserta Didik (LKPD)', 'LKPD memfasilitasi eksplorasi mandiri', 2, 4.00),
    ('ind-201', 'asp-002', '2.1', 'Stimulasi Berpikir Kritis & Reflektif', 'Guru memantik pertanyaan terbuka dan mendalam', 1, 4.00),
    ('ind-202', 'asp-002', '2.2', 'Konstruksi Pengetahuan Kontekstual', 'Mengaitkan materi dengan kehidupan nyata santri', 2, 4.00),
    ('ind-301', 'asp-003', '3.1', 'Interaksi Kasih Sayang & Keteladanan', 'Komunikasi santun, ramah anak, dan tanpa kekerasan', 1, 4.00),
    ('ind-302', 'asp-003', '3.2', 'Penguatan Nilai Rahmatan lil Alamin', 'Menanamkan rasa syukur, persaudaraan, dan empati', 2, 4.00),
    ('ind-401', 'asp-004', '4.1', 'Keterlibatan Aktif Seluruh Murid', 'Semua anak berpartisipasi setara tanpa diskriminasi', 1, 4.00),
    ('ind-501', 'asp-005', '5.1', 'Pemberian Umpan Balik Positif Konstruktif', 'Guru mengapresiasi usaha dan memberikan arahan perbaikan', 1, 4.00)
ON CONFLICT DO NOTHING;
