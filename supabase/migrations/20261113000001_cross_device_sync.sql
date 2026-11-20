-- ==============================================================================
-- SIMPEL MI AL IHSAN - SINKRONISASI LINTAS PERANGKAT & AUTENTIKASI GURU
-- Memungkinkan login akun guru/wali kelas & sinkronisasi state lintas URL/perangkat
-- Madrasah: MI Ma'arif Al Ihsan Soborejo
-- ==============================================================================

-- 1. Izinkan baca identitas & logo madrasah pada halaman Login sebelum autentikasi
DROP POLICY IF EXISTS "system_settings_public_read" ON public.system_settings;
CREATE POLICY "system_settings_public_read" ON public.system_settings
    FOR SELECT TO anon, authenticated USING (TRUE);

-- 2. Tabel app_sync_state untuk sinkronisasi lintas kontainer & perangkat
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

-- 3. Tabel kredensial ter-hash khusus Admin + RPC verifikasi aman (SECURITY DEFINER)
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
