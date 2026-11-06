-- ==============================================================================
-- SIMPEL MI AL IHSAN - ROW LEVEL SECURITY (RLS) POLICIES (TAHAP 2)
-- Bagian 3: Pengaktifan RLS Menyeluruh & Kebijakan Hak Akses Ketat
-- Madrasah: MI Ma'arif Al Ihsan Soborejo
-- ==============================================================================

-- 1. AKTIFKAN RLS PADA SELURUH TABEL OPERASIONAL
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
        'document_links', 'document_link_versions', 'document_reviews', 'supervision_records',
        'student_guidance_records', 'notifications', 'ai_generations', 'activity_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    END LOOP;
END $$;

-- 2. KEBIJAKAN PROFILES & USER ROLES
-- Profiles: Setiap user dapat melihat profil rekan guru/staf; hanya diri sendiri & admin yang dapat mengedit
DROP POLICY IF EXISTS "profiles_select_all_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_all_authenticated" ON public.profiles
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
    FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (id = auth.uid() OR public.is_admin());

-- User Roles: Pengguna hanya melihat perannya sendiri; Hanya ADMIN yang boleh INSERT/UPDATE/DELETE (Mencegah privilege escalation)
DROP POLICY IF EXISTS "user_roles_select_own_or_admin" ON public.user_roles;
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
CREATE POLICY "user_roles_admin_all" ON public.user_roles
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. MASTER DATA UMUM (Academic Years, Semesters, Classes, Subjects, Teachers, Students, Settings)
-- Baca: Semua user terautentikasi (Guru, Wali, Kamad, Admin)
-- Tulis: HANYA ADMIN
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

-- 4. PERENCANAAN PEMBELAJARAN (CP, TP, ATP, Prota, Prosem, Modul, LKPD, Rencana Asesmen)
-- Semua guru & Kamad dapat melihat untuk kolaborasi/supervisi
-- Modifikasi: Guru pemilik penugasan atau Admin
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
        ', tbl, tbl);
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

-- 5. KBM HARIAN: JURNAL MENGAJAR & PRESENSI SISWA
-- Jurnal Mengajar:
-- Read: Guru pemilik, Kepala Madrasah, Admin
-- Write: Guru pengampu penugasan terkait atau Admin
DROP POLICY IF EXISTS "journals_select" ON public.teaching_journals;
CREATE POLICY "journals_select" ON public.teaching_journals
    FOR SELECT TO authenticated
    USING (
        public.is_teacher_of_assignment(assignment_id) 
        OR public.is_principal()
    );

DROP POLICY IF EXISTS "journals_write_own" ON public.teaching_journals;
CREATE POLICY "journals_write_own" ON public.teaching_journals
    FOR ALL TO authenticated
    USING (public.is_teacher_of_assignment(assignment_id) OR public.is_admin())
    WITH CHECK (public.is_teacher_of_assignment(assignment_id) OR public.is_admin());

-- Presensi Siswa:
-- Read: Guru kelas/mapel yang bersangkutan, Wali Kelas rombel tersebut, Kamad, Admin
-- Write: Guru pengampu jam tersebut, Wali Kelas, atau Admin
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

-- 6. ASESMEN & NILAI (ASSESSMENTS, COMPONENTS, GRADES, REMEDIAL, PENGAYAAN)
-- Read: Guru pengampu, Wali Kelas dari siswa terkait, Kamad, Admin
-- Write: HANYA Guru pengampu penugasan tersebut atau Admin
DROP POLICY IF EXISTS "assessments_select" ON public.assessments;
CREATE POLICY "assessments_select" ON public.assessments
    FOR SELECT TO authenticated
    USING (
        public.is_teacher_of_assignment(assignment_id)
        OR public.is_principal()
    );

DROP POLICY IF EXISTS "assessments_write_own" ON public.assessments;
CREATE POLICY "assessments_write_own" ON public.assessments
    FOR ALL TO authenticated
    USING (public.is_teacher_of_assignment(assignment_id) OR public.is_admin())
    WITH CHECK (public.is_teacher_of_assignment(assignment_id) OR public.is_admin());

DROP POLICY IF EXISTS "grades_select" ON public.grades;
CREATE POLICY "grades_select" ON public.grades
    FOR SELECT TO authenticated
    USING (
        public.is_student_taught_by_me(student_id)
        OR public.is_principal()
    );

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

-- Remedial & Pengayaan
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

-- Grade Audit Logs: Read-only untuk Kamad & Admin
DROP POLICY IF EXISTS "grade_audit_read" ON public.grade_audit_logs;
CREATE POLICY "grade_audit_read" ON public.grade_audit_logs
    FOR SELECT TO authenticated
    USING (public.is_principal() OR public.is_admin());

-- 7. RAPOR & FINAL GRADES
DROP POLICY IF EXISTS "final_grades_select" ON public.final_grades;
CREATE POLICY "final_grades_select" ON public.final_grades
    FOR SELECT TO authenticated
    USING (public.is_student_taught_by_me(student_id) OR public.is_principal());

DROP POLICY IF EXISTS "final_grades_write" ON public.final_grades;
CREATE POLICY "final_grades_write" ON public.final_grades
    FOR ALL TO authenticated
    USING (public.is_teacher_of_assignment(assignment_id) OR public.is_admin())
    WITH CHECK (public.is_teacher_of_assignment(assignment_id) OR public.is_admin());

-- Report Cards:
-- Read: Wali Kelas kelas binaan, Kamad, Admin
-- Write/Update: Wali kelas (mengisi catatan/validasi), Kamad (mengesahkan/mengunci), Admin
DROP POLICY IF EXISTS "report_cards_select" ON public.report_cards;
CREATE POLICY "report_cards_select" ON public.report_cards
    FOR SELECT TO authenticated
    USING (public.is_homeroom_of_class(class_id) OR public.is_principal());

DROP POLICY IF EXISTS "report_cards_write" ON public.report_cards;
CREATE POLICY "report_cards_write" ON public.report_cards
    FOR ALL TO authenticated
    USING (public.is_homeroom_of_class(class_id) OR public.is_admin())
    WITH CHECK (public.is_homeroom_of_class(class_id) OR public.is_admin());

-- 8. ARSIP DOKUMEN GOOGLE DRIVE & SUPERVISI
-- Document Links:
-- Read: Guru pemilik, Kamad, Admin
-- Write: Guru pemilik atau Admin
DROP POLICY IF EXISTS "doc_links_select" ON public.document_links;
CREATE POLICY "doc_links_select" ON public.document_links
    FOR SELECT TO authenticated
    USING (
        teacher_id = public.get_current_teacher_id()
        OR public.is_principal()
    );

DROP POLICY IF EXISTS "doc_links_write" ON public.document_links;
CREATE POLICY "doc_links_write" ON public.document_links
    FOR ALL TO authenticated
    USING (teacher_id = public.get_current_teacher_id() OR public.is_admin())
    WITH CHECK (teacher_id = public.get_current_teacher_id() OR public.is_admin());

-- Document Reviews:
-- Read: Guru pemilik dokumen yang di-review, Kamad, Admin
-- Write: HANYA Kepala Madrasah atau Admin
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

-- 9. BIMBINGAN SISWA (BK - STRICT PRIVACY POLICY)
-- PENTING: Hanya guru pencatat DAN Kepala Madrasah yang berhak melihat!
-- Guru lain tidak dapat mengakses catatan sensitif ini.
DROP POLICY IF EXISTS "guidance_select_strict" ON public.student_guidance_records;
CREATE POLICY "guidance_select_strict" ON public.student_guidance_records
    FOR SELECT TO authenticated
    USING (
        recorded_by = auth.uid() 
        OR public.is_principal()
    );

DROP POLICY IF EXISTS "guidance_insert_own" ON public.student_guidance_records;
CREATE POLICY "guidance_insert_own" ON public.student_guidance_records
    FOR INSERT TO authenticated
    WITH CHECK (recorded_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "guidance_update_own" ON public.student_guidance_records;
CREATE POLICY "guidance_update_own" ON public.student_guidance_records
    FOR UPDATE TO authenticated
    USING (recorded_by = auth.uid() OR public.is_admin())
    WITH CHECK (recorded_by = auth.uid() OR public.is_admin());

-- 10. NOTIFIKASI, ASISTEN AI & ACTIVITY LOGS
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications
    FOR ALL TO authenticated
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());

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
