-- ==============================================================================
-- SIMPEL MI AL IHSAN - SEED DATA MASTER & DEMO (TAHAP 2)
-- Bagian 4: Data Master Awal Madrasah (Tahun Pelajaran, Semester, Kelas, Mapel)
-- Label: SEMUA DATA DITANDAI DENGAN JELAS UNTUK PENGUJIAN
-- Madrasah: MI Ma'arif Al Ihsan Soborejo
-- ==============================================================================

-- 1. SYSTEM SETTINGS
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

-- 2. TAHUN PELAJARAN (2026/2027 AKTIF)
INSERT INTO public.academic_years (id, name, start_date, end_date, is_active)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', '2026/2027', '2026-07-15', '2027-06-25', TRUE),
    ('a0000000-0000-0000-0000-000000000002', '2025/2026', '2025-07-15', '2026-06-25', FALSE)
ON CONFLICT (name) DO NOTHING;

-- Update foreign key active_academic_year_id di system_settings
UPDATE public.system_settings
SET active_academic_year_id = 'a0000000-0000-0000-0000-000000000001'
WHERE active_academic_year_id IS NULL;

-- 3. SEMESTER (GANJIL AKTIF)
INSERT INTO public.semesters (id, academic_year_id, semester_type, start_date, end_date, is_active)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ganjil', '2026-07-15', '2026-12-20', TRUE),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Genap', '2027-01-05', '2027-06-25', FALSE)
ON CONFLICT (academic_year_id, semester_type) DO NOTHING;

UPDATE public.system_settings
SET active_semester_id = 'b0000000-0000-0000-0000-000000000001'
WHERE active_semester_id IS NULL;

-- 4. KELAS 1 SAMPAI KELAS 6 (SESUAI FASE KURIKULUM MERDEKA)
INSERT INTO public.classes (id, level, name, phase, capacity)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 1, 'Kelas 1', 'A', 28),
    ('c0000000-0000-0000-0000-000000000002', 2, 'Kelas 2', 'A', 28),
    ('c0000000-0000-0000-0000-000000000003', 3, 'Kelas 3', 'B', 28),
    ('c0000000-0000-0000-0000-000000000004', 4, 'Kelas 4', 'B', 28),
    ('c0000000-0000-0000-0000-000000000005', 5, 'Kelas 5', 'C', 28),
    ('c0000000-0000-0000-0000-000000000006', 6, 'Kelas 6', 'C', 28)
ON CONFLICT (name) DO NOTHING;

-- 5. MATA PELAJARAN MADRASAH (PAI, KHAS MA'ARIF, UMUM, MULOK)
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

-- 6. DATA CONTOH DEMO GURU & SISWA UNTUK PENGUJIAN
INSERT INTO public.teachers (id, nip, full_name, title_prefix, title_suffix, gender, specialization)
VALUES
    ('d0000000-0000-0000-0000-000000000001', '198204152010011015', 'Ahmad Fauzi', 'Ust.', 'S.Pd.I', 'L', 'Guru Kelas & PAI'),
    ('d0000000-0000-0000-0000-000000000002', '198711202014022008', 'Siti Maryam', 'Usth.', 'S.Pd.', 'P', 'Guru Kelas 4'),
    ('d0000000-0000-0000-0000-000000000003', '199003052019031012', 'Muhammad Ridwan', 'Ust.', 'S.Pd.', 'L', 'Guru PJOK & Mulok')
ON CONFLICT (nip) DO NOTHING;

-- Siswa Demo Kelas 4
INSERT INTO public.students (id, nis, nisn, full_name, nickname, gender, birth_place, birth_date)
VALUES
    ('e0000000-0000-0000-0000-000000000001', '260401', '0145678901', 'Muhammad Ilham Pratama [DEMO]', 'Ilham', 'L', 'Temanggung', '2016-04-12'),
    ('e0000000-0000-0000-0000-000000000002', '260402', '0145678902', 'Aisyah Nur Salsabila [DEMO]', 'Aisyah', 'P', 'Magelang', '2016-08-25'),
    ('e0000000-0000-0000-0000-000000000003', '260403', '0145678903', 'Fajar Khoirul Anam [DEMO]', 'Fajar', 'L', 'Temanggung', '2016-01-19')
ON CONFLICT (nis) DO NOTHING;

-- Plotting Siswa Demo ke Kelas 4
INSERT INTO public.class_members (student_id, class_id, academic_year_id, student_number)
VALUES
    ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 1),
    ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 2),
    ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 3)
ON CONFLICT (student_id, academic_year_id) DO NOTHING;

-- Penetapan Siti Maryam sebagai Wali Kelas 4
INSERT INTO public.homeroom_assignments (teacher_id, class_id, academic_year_id)
VALUES
    ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (class_id, academic_year_id) DO NOTHING;
