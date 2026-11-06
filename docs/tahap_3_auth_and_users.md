# PANDUAN PENGATURAN AUTENTIKASI & PENGELOLAAN PENGGUNA (TAHAP 3)
## SIMPEL MI AL IHSAN — MI Ma’arif Al Ihsan Soborejo

Dokumen ini menjelaskan tata cara konfigurasi Supabase Auth, variabel lingkungan, pembuatan akun Administrator perdana, pengelolaan multi-peran, dan pengujian keamanan.

---

### 1. Variabel Lingkungan (.env)
Pastikan file `.env` diisi tanpa mengekspos service role key ke frontend:
```bash
# Frontend / Vercel Environment Variables
VITE_SUPABASE_URL="https://[YOUR_PROJECT_ID].supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 2. Cara Membuat Akun Admin Pertama Secara Aman

Karena pendaftaran publik sengaja dimatikan demi keamanan madrasah, akun Administrator pertama dibuat melalui **Supabase Dashboard**:

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) -> Proyek Anda.
2. Masuk ke menu **Authentication** -> **Users**.
3. Klik tombol **Add user** -> Pilih **Create user**.
4. Masukkan:
   - Email: `admin@alihsan.sch.id`
   - Password: `[PasswordKuatAdmin2026!]`
   - Centang **Auto Confirm User?** (Aktifkan).
5. Setelah user dibuat, buka **SQL Editor** dan jalankan query berikut untuk menetapkan peran `admin` pada akun tersebut:
```sql
-- Dapatkan user_id dari auth.users
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@alihsan.sch.id' LIMIT 1;
    
    -- Pastikan profil terisi
    INSERT INTO public.profiles (id, email, full_name, is_active)
    VALUES (v_user_id, 'admin@alihsan.sch.id', 'Administrator SIMPEL MI Al Ihsan', TRUE)
    ON CONFLICT (id) DO UPDATE SET full_name = 'Administrator SIMPEL MI Al Ihsan';

    -- Tetapkan peran admin
    INSERT INTO public.user_roles (user_id, role, is_primary)
    VALUES (v_user_id, 'admin', TRUE)
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;
```

---

### 3. Cara Mengundang & Mendaftarkan Dewan Guru

1. Masuk ke aplikasi SIMPEL menggunakan akun **Administrator**.
2. Di sidebar navigasi, buka menu **Kelola Pengguna & Peran**.
3. Klik tombol **Tambah Akun Baru**.
4. Isi Nama Lengkap, Email resmi madrasah, dan Nomor WhatsApp.
5. Jika akun bersangkutan adalah guru kelas/mapel, pilih data guru pada dropdown **Hubungkan ke Profil Guru**.
6. Centang peran yang sesuai:
   - Jika guru biasa: centang **Guru Pengampu**.
   - Jika guru sekaligus wali kelas: centang **Guru Pengampu** DAN **Wali Kelas**.
   - Jika kepala madrasah: centang **Kepala Madrasah**.
7. Klik **Simpan Akun Pengguna**. Sistem mencatat operasi ini ke dalam tabel `activity_logs`.

---

### 4. Akun Uji Coba Cepat (Demo Mode Offline)

Bila Anda sedang menguji aplikasi saat Supabase belum dihubungkan dengan API key, Anda dapat langsung mengklik tombol uji coba cepat pada layar login:
- **Admin**: `admin@alihsan.sch.id`
- **Kepala Madrasah**: `kamad@alihsan.sch.id`
- **Guru & Wali Kelas 4**: `guru@alihsan.sch.id` (Dapat beralih antara Dasbor Guru dan Dasbor Wali Kelas 4 melalui tombol pemilih peran di bagian atas layar!)
- **Guru PJOK**: `guru.pjok@alihsan.sch.id`
- Kata Sandi: `AlIhsan2026!`

---

### 5. Cara Menjalankan Aplikasi Secara Lokal
```bash
# 1. Pastikan dependensi terpasang
npm install

# 2. Jalankan server pengembang
npm run dev

# 3. Buka peramban di http://localhost:3000
```

---

### 6. Panduan Deployment ke Vercel

1. Hubungkan repositori GitHub proyek ke dashboard Vercel (`https://vercel.com`).
2. Framework Preset: Pilih **Vite**.
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Pada menu **Environment Variables**, tambahkan:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Klik **Deploy**. Aplikasi SIMPEL MI AL IHSAN siap digunakan oleh seluruh dewan guru.
