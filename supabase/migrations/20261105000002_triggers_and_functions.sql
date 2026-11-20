-- ==============================================================================
-- SIMPEL MI AL IHSAN - FUNGSI & TRIGGER KEAMANAN (TAHAP 2)
-- Bagian 2: Helper Functions RLS, Audit Logging, & Enforce Lock Rules
-- Madrasah: MI Ma'arif Al Ihsan Soborejo
-- ==============================================================================

-- 1. FUNGSI OTOMATIS TIMESTAMP UPDATED_AT
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('Asia/Jakarta', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang trigger updated_at pada tabel utama
DO $$ 
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'profiles', 'teachers', 'students', 'teaching_journals',
        'grades', 'final_grades', 'document_links', 'student_guidance_records'
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

-- 2. OTOMATISASI PROFIL DARI AUTH.USERS
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

-- 3. HELPER KEAMANAN ROW LEVEL SECURITY (RLS)
-- Menggunakan SECURITY DEFINER dan caching query untuk performa tinggi

-- Cek apakah user saat ini memiliki peran tertentu
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

-- Dapatkan teacher_id dari akun login saat ini
CREATE OR REPLACE FUNCTION public.get_current_teacher_id()
RETURNS UUID AS $$
DECLARE
    tid UUID;
BEGIN
    SELECT id INTO tid FROM public.teachers WHERE user_id = auth.uid() LIMIT 1;
    RETURN tid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Cek apakah user saat ini adalah wali kelas dari kelas tertentu
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

-- Cek apakah user mengampu penugasan mengajar tertentu
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

-- Cek apakah siswa berada dalam salah satu kelas yang diajar oleh guru ini
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

-- 4. TRIGGER AUDIT LOG PERUBAHAN NILAI (GRADE AUDIT TRAIL)
CREATE OR REPLACE FUNCTION public.track_grade_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Catat hanya jika nilai mengalami perubahan angka
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

-- 5. TRIGGER ENFORCE GRADE LOCK (PENGUNCIAN NILAI SETELAH PENGESAHAN)
CREATE OR REPLACE FUNCTION public.enforce_grade_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_is_locked BOOLEAN := FALSE;
    v_report_locked BOOLEAN := FALSE;
BEGIN
    -- Cek status kunci sistem madrasah
    SELECT is_report_card_locked INTO v_report_locked FROM public.system_settings LIMIT 1;
    IF v_report_locked = TRUE AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Akses ditolak: Seluruh periode penilaian dan rapor saat ini sedang dikunci oleh madrasah.';
    END IF;

    -- Cek apakah asesmen ini berada pada assignment dengan nilai akhir yang sudah dikunci
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

-- 6. PENCATATAN AKTIVITAS KEAMANAN (ACTIVITY LOG HELPER)
CREATE OR REPLACE FUNCTION public.log_activity(
    p_action TEXT,
    p_entity TEXT,
    p_entity_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.activity_logs (
        user_id,
        action_name,
        entity_name,
        entity_id,
        details
    ) VALUES (
        auth.uid(),
        p_action,
        p_entity,
        p_entity_id,
        p_details
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
