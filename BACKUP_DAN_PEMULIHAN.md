# PANDUAN PENCADANGAN DAN PEMULIHAN SISTEM (BACKUP & RECOVERY)
**SIMPEL MI AL IHSAN – Sistem Informasi Manajemen Pembelajaran MI Ma'arif Al Ihsan Soborejo**
*Versi: 2.1 Production-Ready (Tahap 7)*

---

## 1. PENCADANGAN DATABASE (SUPABASE POSTGRESQL)

Sistem database utama menggunakan PostgreSQL yang di-hosting pada Supabase Cloud (`pwdhltrxdijsmmrsuheb.supabase.co`).

### A. Pencadangan Skema & Data Lengkap (pg_dump)
Pencadangan rutin direkomendasikan setiap akhir pekan atau setelah periode penilaian semester:

```bash
# Export skema dan data database
pg_dump --host=db.pwdhltrxdijsmmrsuheb.supabase.co \
        --port=5432 \
        --username=postgres \
        --dbname=postgres \
        --format=plain \
        --no-owner \
        --no-privileges \
        --file=simpel_mi_alihsan_backup_$(date +%Y%m%d).sql
```

### B. Pencadangan Skema via Supabase CLI
```bash
# Link project Supabase
npx supabase link --project-ref pwdhltrxdijsmmrsuheb

# Buat dump skema DDL
npx supabase db dump -f supabase_schema_backup.sql

# Buat dump data
npx supabase db dump --data-only -f supabase_data_backup.sql
```

### C. Ekspor Mandiri Data Kritis ke Format CSV / Excel
SIMPEL MI AL IHSAN menyediakan tombol ekspor data pada modul:
1. **Daftar Nilai & Leger Nilai**: Unduh format Excel/CSV per kelas dan per mapel.
2. **Presensi Siswa Bulanan**: Unduh rekapitulasi kehadiran per rombel.
3. **Data Master Guru & Siswa**: Dapat disinkronkan melalui tabel profil Supabase.

---

## 2. PEMULIHAN DATABASE (DATABASE DISASTER RECOVERY)

Jika terjadi insiden data terhapus atau kerusakan integritas data:

1. **Persiapan Database Baru / Bersih**:
   - Buka SQL Editor di Dashboard Supabase.
   - Atau buat database target baru.
2. **Eksekusi Pemulihan Skema**:
   - Jalankan berkas migrasi master: `public/full_migration_all_in_one.sql`.
   - Periksa tabel inti: `profiles`, `user_roles`, `academic_years`, `classes`, `subjects`, `students`, `teachers`, `teaching_assignments`, `attendance`, `journals`, `grade_components`, `student_grades`, `learning_scopes`, `curriculum_documents`, `supervisions`, `guidance_records`, `ai_generations`, `notifications`.
3. **Impor Berkas Cadangan**:
   ```bash
   psql --host=db.pwdhltrxdijsmmrsuheb.supabase.co \
        --port=5432 \
        --username=postgres \
        --dbname=postgres \
        < simpel_mi_alihsan_backup_YYYYMMDD.sql
   ```

---

## 3. PENCADANGAN DAN PEMULIHAN DOKUMEN GOOGLE DRIVE

### A. Arsitektur Penyimpanan Berkas
- Sesuai prinsip arsitektur sistem, **file binary dokumen kurikulum (CP, TP, ATP, Modul Ajar, LKPD, Soal)** TIDAK disimpan di database Supabase, melainkan pada **Google Shared Drive (Google Workspace)** resmi madrasah.
- Supabase hanya menyimpan metadata identitas dokumen, nama guru penyusun, status persetujuan, dan URL tautan Google Drive.

### B. Prosedur Keamanan Google Shared Drive
1. Buat Shared Drive khusus: `Arsip Pembelajaran MI Ma'arif Al Ihsan`.
2. Struktur folder standar:
   ```
   ├── Tahun Pelajaran 2025-2026
   │   ├── Semester Ganjil
   │   │   ├── Kelas 1
   │   │   ├── Kelas 4
   │   │   └── ...
   │   └── Semester Genap
   ```
3. Kelola izin Google Drive:
   - **Kepala Madrasah & Kurikulum**: Pengelola (Manager)
   - **Guru Pengampu**: Pengelola Konten / Kontributor
   - **Hak Akses Tautan Dokumen**: "Siapa saja dengan tautan dapat melihat" (Viewer).
4. **Pencadangan Google Drive**:
   - Gunakan fitur Google Takeout institusi atau Google Drive Backup Sync ke hard drive eksternal madrasah setiap akhir semester.

---

## 4. PENANGGULANGAN INSIDEN AKUN ADMINISTRATOR

1. **Jika Kredensial Admin Utama Hilang**:
   - Masuk ke dashboard Supabase: `https://supabase.com/dashboard/project/pwdhltrxdijsmmrsuheb/auth/users`.
   - Lakukan Reset Password untuk email `alihsansoborejo@gmail.com`.
2. **Jika Akses API Gemini Terputus**:
   - Periksa kuota Google Cloud Console atau ganti `GEMINI_API_KEY` pada environment variables server.
   - Sistem memiliki penanganan gracefully degrading di mana modul akademik non-AI tetap berjalan 100% normal tanpa terganggu.
