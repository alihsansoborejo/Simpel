-- ==============================================================================
-- SIMPEL MI AL IHSAN - PERBAIKAN SINKRONISASI NILAI GURU & PERANGKAT KELAS
-- 1. Menambahkan kolom & trigger updated_at pada tabel assessments
-- 2. Membuat tabel class_officials (Pengurus / Perangkat Kelas) + RLS & Realtime
-- 3. Menyempurnakan resolusi teacher_id pada get_current_teacher_id() & akses wali kelas pada assessments
-- 4. Mengizinkan sinkronisasi key operasional simpel_* pada app_sync_state bagi guru/wali kelas yang login via verifikasi akun madrasah
-- ==============================================================================

-- 1. Pastikan tabel assessments memiliki kolom scope_key dan updated_at
ALTER TABLE public.assessments
    ADD COLUMN IF NOT EXISTS scope_key TEXT;

ALTER TABLE public.assessments
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now());

DROP TRIGGER IF EXISTS tr_set_updated_at ON public.assessments;
CREATE TRIGGER tr_set_updated_at
BEFORE UPDATE ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Tabel Pengurus / Perangkat Kelas (class_officials)
CREATE TABLE IF NOT EXISTS public.class_officials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
    role_name TEXT NOT NULL,
    order_index INT NOT NULL DEFAULT 10,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Jakarta', now())
);

CREATE INDEX IF NOT EXISTS idx_class_officials_class ON public.class_officials(class_id, order_index);
CREATE INDEX IF NOT EXISTS idx_class_officials_student ON public.class_officials(student_id);

DROP TRIGGER IF EXISTS tr_set_updated_at ON public.class_officials;
CREATE TRIGGER tr_set_updated_at
BEFORE UPDATE ON public.class_officials
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.class_officials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_officials_select" ON public.class_officials;
CREATE POLICY "class_officials_select" ON public.class_officials
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "class_officials_write" ON public.class_officials;
CREATE POLICY "class_officials_write" ON public.class_officials
    FOR ALL TO authenticated
    USING (public.is_homeroom_of_class(class_id) OR public.is_admin())
    WITH CHECK (public.is_homeroom_of_class(class_id) OR public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_officials TO authenticated;

-- 3. Perkuat resolusi guru login pada get_current_teacher_id() (user_id, email kredensial, atau kesamaan nama profil)
CREATE OR REPLACE FUNCTION public.get_current_teacher_id()
RETURNS UUID AS $$
DECLARE
    tid UUID;
    v_email TEXT;
    v_teacher_id_text TEXT;
BEGIN
    SELECT id INTO tid FROM public.teachers WHERE user_id = auth.uid() LIMIT 1;
    IF tid IS NOT NULL THEN
        RETURN tid;
    END IF;

    v_email := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
    IF v_email <> '' THEN
        SELECT NULLIF(TRIM(teacher_id), '') INTO v_teacher_id_text
        FROM public.app_user_credentials
        WHERE email = v_email
        LIMIT 1;

        IF v_teacher_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            SELECT id INTO tid FROM public.teachers WHERE id = v_teacher_id_text::UUID LIMIT 1;
            IF tid IS NOT NULL THEN
                RETURN tid;
            END IF;
        END IF;

        SELECT t.id INTO tid
        FROM public.teachers t
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE LOWER(TRIM(t.full_name)) = LOWER(TRIM(p.full_name))
        LIMIT 1;
    END IF;

    RETURN tid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Izinkan wali kelas membaca asesmen di kelas binaannya untuk leger nilai
DROP POLICY IF EXISTS "assessments_select" ON public.assessments;
CREATE POLICY "assessments_select" ON public.assessments
    FOR SELECT TO authenticated
    USING (
        public.is_teacher_of_assignment(assignment_id)
        OR public.is_principal()
        OR EXISTS (
            SELECT 1 FROM public.teaching_assignments ta
            WHERE ta.id = assignment_id
              AND public.is_homeroom_of_class(ta.class_id)
        )
    );

-- 4. Sinkronisasi app_sync_state untuk seluruh perangkat & guru (tetap melindungi key sensitif admin)
DROP POLICY IF EXISTS "app_sync_state_write_auth" ON public.app_sync_state;
CREATE POLICY "app_sync_state_write_auth" ON public.app_sync_state
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        key LIKE 'simpel\_%' ESCAPE '\'
        AND (
            key NOT IN ('simpel_users_cache_v2', 'simpel_settings')
            OR (auth.uid() IS NOT NULL AND public.is_admin())
        )
    );

DROP POLICY IF EXISTS "app_sync_state_update_auth" ON public.app_sync_state;
CREATE POLICY "app_sync_state_update_auth" ON public.app_sync_state
    FOR UPDATE TO anon, authenticated
    USING (
        key LIKE 'simpel\_%' ESCAPE '\'
        AND (
            key NOT IN ('simpel_users_cache_v2', 'simpel_settings')
            OR (auth.uid() IS NOT NULL AND public.is_admin())
        )
    )
    WITH CHECK (
        key LIKE 'simpel\_%' ESCAPE '\'
        AND (
            key NOT IN ('simpel_users_cache_v2', 'simpel_settings')
            OR (auth.uid() IS NOT NULL AND public.is_admin())
        )
    );

GRANT SELECT, INSERT, UPDATE ON public.app_sync_state TO anon;

-- 5. Daftarkan class_officials dan app_sync_state ke Realtime Publication
DO $$
DECLARE
    tbl text;
    rt_tables text[] := ARRAY['class_officials', 'app_sync_state'];
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

-- 6. Sinkronkan perubahan peran (seperti penambahan role kepala_madrasah pada guru) ke public.user_roles
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
    v_profile_id UUID;
    v_role_txt TEXT;
    v_primary_assigned BOOLEAN;
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

        SELECT p.id INTO v_profile_id
        FROM public.profiles p
        WHERE LOWER(TRIM(p.email)) = v_email
        LIMIT 1;

        IF v_profile_id IS NOT NULL THEN
            DELETE FROM public.user_roles
            WHERE user_id = v_profile_id
              AND NOT (v_email = 'alihsansoborejo@gmail.com' AND role = 'admin'::public.user_role_type);

            v_primary_assigned := FALSE;
            FOR v_role_txt IN
                SELECT r
                FROM unnest(ARRAY['admin', 'kepala_madrasah', 'wali_kelas', 'guru']) AS r
                WHERE EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(v_roles) AS elem WHERE elem = r
                )
            LOOP
                INSERT INTO public.user_roles (user_id, role, is_primary)
                VALUES (v_profile_id, v_role_txt::public.user_role_type, NOT v_primary_assigned)
                ON CONFLICT (user_id, role) DO UPDATE
                SET is_primary = EXCLUDED.is_primary;
                v_primary_assigned := TRUE;
            END LOOP;
        END IF;

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

