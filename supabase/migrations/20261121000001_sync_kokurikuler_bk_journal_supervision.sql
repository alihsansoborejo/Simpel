-- ============================================================================
-- MIGRATION: Sinkronisasi Lintas Perangkat & Multi-Role untuk
--            Ko Kurikuler, BK (Bimbingan Siswa), Jurnal Mengajar, & Supervisi
-- Tanggal: 2026-11-21
-- Idempoten: Aman dijalankan berulang kali di Supabase SQL Editor.
-- ============================================================================

-- 1. Helper Resolusi Identitas Guru Lintas Perangkat (memeriksa SEMUA baris teachers
--    yang cocok berdasarkan user_id, app_user_credentials.teacher_id, maupun full_name)
CREATE OR REPLACE FUNCTION public.is_matching_teacher(target_teacher_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
    v_teacher_id_text TEXT;
BEGIN
    IF target_teacher_id IS NULL OR auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.teachers t
        WHERE t.id = target_teacher_id
          AND t.user_id = auth.uid()
    ) THEN
        RETURN TRUE;
    END IF;

    v_email := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
    IF v_email <> '' THEN
        SELECT NULLIF(TRIM(teacher_id), '') INTO v_teacher_id_text
        FROM public.app_user_credentials
        WHERE email = v_email
        LIMIT 1;

        IF v_teacher_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           AND v_teacher_id_text::UUID = target_teacher_id THEN
            RETURN TRUE;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.teachers t
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE t.id = target_teacher_id
          AND NULLIF(TRIM(p.full_name), '') IS NOT NULL
          AND LOWER(TRIM(t.full_name)) = LOWER(TRIM(p.full_name))
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- Perbarui helper penugasan & wali kelas agar mendukung banyak kemungkinan ID guru
CREATE OR REPLACE FUNCTION public.is_homeroom_of_class(target_class_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.is_admin() OR public.has_role('kepala_madrasah') THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.homeroom_assignments ha
        JOIN public.academic_years ay ON ha.academic_year_id = ay.id
        WHERE ha.class_id = target_class_id
          AND ay.is_active = TRUE
          AND public.is_matching_teacher(ha.teacher_id)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_assignment(target_assignment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.is_admin() THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.teaching_assignments ta
        WHERE ta.id = target_assignment_id
          AND public.is_matching_teacher(ta.teacher_id)
    );
END;
$$;

-- 2. TABEL BARU: public.kokurikuler_items (Perencanaan, Bahan Ajar, Asesmen, Administrasi Ko Kurikuler)
CREATE TABLE IF NOT EXISTS public.kokurikuler_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sub_menu TEXT NOT NULL,
    teacher_id TEXT,
    teacher_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recorder_email TEXT,
    teacher_name TEXT NOT NULL DEFAULT 'Guru Madrasah',
    class_level INTEGER NOT NULL DEFAULT 0,
    class_name TEXT NOT NULL DEFAULT 'Lintas Kelas (Semua Rombel)',
    semester TEXT NOT NULL DEFAULT 'Ganjil',
    academic_year TEXT NOT NULL DEFAULT '2026/2027',
    theme_or_dimension TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    target_participants TEXT,
    allocated_hours NUMERIC(6,2) DEFAULT 0,
    activity_date TEXT,
    file_id TEXT,
    file_name TEXT,
    google_drive_url TEXT,
    folder_path TEXT,
    curriculum_doc_id TEXT,
    status TEXT NOT NULL DEFAULT 'Draft',
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE INDEX IF NOT EXISTS idx_kokurikuler_submenu_updated
    ON public.kokurikuler_items(sub_menu, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_kokurikuler_teacher
    ON public.kokurikuler_items(teacher_id);

DROP TRIGGER IF EXISTS tr_set_updated_at ON public.kokurikuler_items;
CREATE TRIGGER tr_set_updated_at
    BEFORE UPDATE ON public.kokurikuler_items
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.kokurikuler_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_kokurikuler_owner(
    p_teacher_id TEXT,
    p_teacher_user_id UUID,
    p_recorder_email TEXT,
    p_teacher_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    IF p_teacher_user_id = auth.uid() THEN
        RETURN TRUE;
    END IF;

    v_email := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
    IF v_email <> '' AND p_recorder_email IS NOT NULL AND LOWER(TRIM(p_recorder_email)) = v_email THEN
        RETURN TRUE;
    END IF;

    IF p_teacher_id IS NOT NULL THEN
        IF p_teacher_id = auth.uid()::text THEN
            RETURN TRUE;
        END IF;
        IF p_teacher_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           AND public.is_matching_teacher(p_teacher_id::UUID) THEN
            RETURN TRUE;
        END IF;
    END IF;

    IF p_teacher_name IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND NULLIF(TRIM(p.full_name), '') IS NOT NULL
          AND LOWER(TRIM(p.full_name)) = LOWER(TRIM(p_teacher_name))
    ) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

DROP POLICY IF EXISTS "kokurikuler_select" ON public.kokurikuler_items;
CREATE POLICY "kokurikuler_select" ON public.kokurikuler_items
    FOR SELECT TO authenticated
    USING (
        public.is_principal()
        OR public.is_kokurikuler_owner(teacher_id, teacher_user_id, recorder_email, teacher_name)
        OR (
            public.has_role('wali_kelas')
            AND (
                class_level = 0
                OR EXISTS (
                    SELECT 1
                    FROM public.homeroom_assignments ha
                    JOIN public.classes c ON c.id = ha.class_id
                    JOIN public.academic_years ay ON ay.id = ha.academic_year_id
                    WHERE ay.is_active = TRUE
                      AND public.is_matching_teacher(ha.teacher_id)
                      AND c.level = class_level
                )
            )
        )
    );

DROP POLICY IF EXISTS "kokurikuler_write" ON public.kokurikuler_items;
CREATE POLICY "kokurikuler_write" ON public.kokurikuler_items
    FOR ALL TO authenticated
    USING (
        public.is_principal()
        OR public.is_kokurikuler_owner(teacher_id, teacher_user_id, recorder_email, teacher_name)
    )
    WITH CHECK (
        public.is_principal()
        OR public.is_kokurikuler_owner(teacher_id, teacher_user_id, recorder_email, teacher_name)
    );

-- 3. PEMBARUAN TABEL & RLS: public.student_guidance_records (Bimbingan Siswa / BK)
ALTER TABLE public.student_guidance_records ALTER COLUMN recorded_by DROP NOT NULL;
ALTER TABLE public.student_guidance_records ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL;
ALTER TABLE public.student_guidance_records ADD COLUMN IF NOT EXISTS recorder_name TEXT;
ALTER TABLE public.student_guidance_records ADD COLUMN IF NOT EXISTS recorder_email TEXT;

DROP POLICY IF EXISTS "guidance_select_strict" ON public.student_guidance_records;
CREATE POLICY "guidance_select_strict" ON public.student_guidance_records
    FOR SELECT TO authenticated
    USING (
        recorded_by = auth.uid()
        OR public.is_principal()
        OR (teacher_id IS NOT NULL AND public.is_matching_teacher(teacher_id))
        OR (
            recorder_email IS NOT NULL
            AND LOWER(TRIM(recorder_email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
        )
        OR EXISTS (
            SELECT 1 FROM public.class_members cm
            WHERE cm.student_id = student_guidance_records.student_id
              AND public.is_homeroom_of_class(cm.class_id)
        )
    );

DROP POLICY IF EXISTS "guidance_insert_own" ON public.student_guidance_records;
CREATE POLICY "guidance_insert_own" ON public.student_guidance_records
    FOR INSERT TO authenticated
    WITH CHECK (
        recorded_by = auth.uid()
        OR recorded_by IS NULL
        OR public.is_principal()
    );

DROP POLICY IF EXISTS "guidance_update_own" ON public.student_guidance_records;
CREATE POLICY "guidance_update_own" ON public.student_guidance_records
    FOR UPDATE TO authenticated
    USING (
        recorded_by = auth.uid()
        OR public.is_principal()
        OR (teacher_id IS NOT NULL AND public.is_matching_teacher(teacher_id))
        OR (
            recorder_email IS NOT NULL
            AND LOWER(TRIM(recorder_email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
        )
        OR EXISTS (
            SELECT 1 FROM public.class_members cm
            WHERE cm.student_id = student_guidance_records.student_id
              AND public.is_homeroom_of_class(cm.class_id)
        )
    )
    WITH CHECK (
        recorded_by = auth.uid()
        OR public.is_principal()
        OR (teacher_id IS NOT NULL AND public.is_matching_teacher(teacher_id))
        OR (
            recorder_email IS NOT NULL
            AND LOWER(TRIM(recorder_email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
        )
        OR EXISTS (
            SELECT 1 FROM public.class_members cm
            WHERE cm.student_id = student_guidance_records.student_id
              AND public.is_homeroom_of_class(cm.class_id)
        )
    );

DROP POLICY IF EXISTS "guidance_delete_own" ON public.student_guidance_records;
CREATE POLICY "guidance_delete_own" ON public.student_guidance_records
    FOR DELETE TO authenticated
    USING (
        recorded_by = auth.uid()
        OR public.is_principal()
        OR (teacher_id IS NOT NULL AND public.is_matching_teacher(teacher_id))
        OR (
            recorder_email IS NOT NULL
            AND LOWER(TRIM(recorder_email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
        )
    );

-- 4. PEMBARUAN RLS: public.teaching_journals (Jurnal Mengajar)
DROP POLICY IF EXISTS "journals_select" ON public.teaching_journals;
CREATE POLICY "journals_select" ON public.teaching_journals
    FOR SELECT TO authenticated
    USING (public.is_teacher_of_assignment(assignment_id) OR public.is_principal());

DROP POLICY IF EXISTS "journals_write_own" ON public.teaching_journals;
CREATE POLICY "journals_write_own" ON public.teaching_journals
    FOR ALL TO authenticated
    USING (public.is_teacher_of_assignment(assignment_id) OR public.is_principal())
    WITH CHECK (public.is_teacher_of_assignment(assignment_id) OR public.is_principal());

-- 5. PEMBARUAN TABEL & RLS: public.supervision_records, supervision_results, supervision_followups
ALTER TABLE public.supervision_records ALTER COLUMN supervisor_id DROP NOT NULL;

DROP POLICY IF EXISTS "supervision_records_select" ON public.supervision_records;
CREATE POLICY "supervision_records_select" ON public.supervision_records
    FOR SELECT TO authenticated
    USING (
        public.is_principal()
        OR (public.is_matching_teacher(teacher_id) AND is_shared_with_teacher = TRUE)
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
        OR (public.is_matching_teacher(teacher_id) AND is_shared_with_teacher = TRUE)
    )
    WITH CHECK (
        public.is_principal()
        OR (public.is_matching_teacher(teacher_id) AND is_shared_with_teacher = TRUE)
    );

DROP POLICY IF EXISTS "supervision_records_delete" ON public.supervision_records;
CREATE POLICY "supervision_records_delete" ON public.supervision_records
    FOR DELETE TO authenticated
    USING (public.is_principal());

DROP POLICY IF EXISTS "supervision_results_select" ON public.supervision_results;
CREATE POLICY "supervision_results_select" ON public.supervision_results
    FOR SELECT TO authenticated
    USING (
        public.is_principal()
        OR EXISTS (
            SELECT 1 FROM public.supervision_records sr
            WHERE sr.id = supervision_record_id
              AND public.is_matching_teacher(sr.teacher_id)
              AND sr.is_shared_with_teacher = TRUE
        )
    );

DROP POLICY IF EXISTS "supervision_followups_select" ON public.supervision_followups;
CREATE POLICY "supervision_followups_select" ON public.supervision_followups
    FOR SELECT TO authenticated
    USING (
        public.is_principal()
        OR EXISTS (
            SELECT 1 FROM public.supervision_records sr
            WHERE sr.id = supervision_record_id
              AND public.is_matching_teacher(sr.teacher_id)
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
              AND public.is_matching_teacher(sr.teacher_id)
              AND sr.is_shared_with_teacher = TRUE
        )
    )
    WITH CHECK (
        public.is_principal()
        OR EXISTS (
            SELECT 1 FROM public.supervision_records sr
            WHERE sr.id = supervision_record_id
              AND public.is_matching_teacher(sr.teacher_id)
              AND sr.is_shared_with_teacher = TRUE
        )
    );

-- 6. AKTIFKAN SUPABASE REALTIME & HAK AKSES
DO $$
DECLARE
    tbl text;
    rt_tables text[] := ARRAY[
        'kokurikuler_items',
        'student_guidance_records',
        'teaching_journals',
        'supervision_records',
        'supervision_results',
        'supervision_followups'
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kokurikuler_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_guidance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teaching_journals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervision_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervision_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervision_followups TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_matching_teacher(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_kokurikuler_owner(TEXT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_homeroom_of_class(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_assignment(UUID) TO authenticated;
