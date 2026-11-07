import {
  CapaianPembelajaranItem,
  TujuanPembelajaranItem,
  AlurTujuanPembelajaranItem,
  ModulAjarItem,
  LKPDItem,
  KisiKisiItem,
  SoalAsesmenItem,
  LingkupMateriConfig,
  EvaluationScopeKey,
} from '../types/curriculum.types';

const STORAGE_KEYS = {
  CP: 'simpel_mi_cp_items_v1',
  TP: 'simpel_mi_tp_items_v1',
  ATP: 'simpel_mi_atp_items_v1',
  MODUL: 'simpel_mi_modul_items_v1',
  LKPD: 'simpel_mi_lkpd_items_v1',
  KISI: 'simpel_mi_kisi_items_v1',
  SOAL: 'simpel_mi_soal_items_v1',
};

// =========================================================================
// DATA AWAL RESMI KURIKULUM MERDEKA + KURIKULUM BERBASIS CINTA (KELAS 4)
// =========================================================================

const INITIAL_CP: CapaianPembelajaranItem[] = [
  {
    id: 'cp-bi-1',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    phase: 'B',
    class_level: 4,
    element: 'Menyimak',
    description:
      'Peserta didik mampu memahami ide pokok dan ide pendukung pada teks informatif serta mampu menyampaikan kembali gagasan secara santun berbasis kasih sayang.',
    source: 'BSKAP Kemendikbudristek No. 032/H/KR/2024 & Panduan Kurikulum Madrasah',
    created_at: '2026-07-15T08:00:00+07:00',
  },
  {
    id: 'cp-bi-2',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    phase: 'B',
    class_level: 4,
    element: 'Membaca dan Memirsa',
    description:
      'Peserta didik mampu memahami pesan dan informasi tentang kehidupan sehari-hari, teks narasi, dan puisi anak dalam bentuk cetak atau elektronik serta melafalkan kata-kata baru.',
    source: 'BSKAP Kemendikbudristek No. 032/H/KR/2024',
    created_at: '2026-07-15T08:00:00+07:00',
  },
  {
    id: 'cp-bi-3',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    phase: 'B',
    class_level: 4,
    element: 'Berbicara dan Mempresentasikan',
    description:
      'Peserta didik mampu melafalkan kata secara fasih, menyajikan ungkapan santun menggunakan Kurikulum Berbasis Cinta, serta berdiskusi aktif dengan teman sejawat.',
    source: 'BSKAP Kemendikbudristek No. 032/H/KR/2024',
    created_at: '2026-07-15T08:00:00+07:00',
  },
  {
    id: 'cp-bi-4',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    phase: 'B',
    class_level: 4,
    element: 'Menulis',
    description:
      'Peserta didik mampu menulis teks narasi dan deskripsi dengan tulisan tegak bersambung, kosakata baku, dan tanda baca yang tepat untuk mengekspresikan empati.',
    source: 'BSKAP Kemendikbudristek No. 032/H/KR/2024',
    created_at: '2026-07-15T08:00:00+07:00',
  },
  {
    id: 'cp-ipas-1',
    subject_id: 'sbj-ipas',
    subject_name: 'IPAS',
    phase: 'B',
    class_level: 4,
    element: 'Pemahaman IPAS',
    description:
      'Peserta didik menganalisis hubungan antara bentuk serta fungsi bagian tubuh pada manusia dan tumbuhan, wujud zat, serta interaksi sosial lingkungan madrasah Soborejo.',
    source: 'BSKAP Kemendikbudristek No. 032/H/KR/2024',
    created_at: '2026-07-15T08:00:00+07:00',
  },
];

const INITIAL_TP: TujuanPembelajaranItem[] = [
  {
    id: 'tp-bi-1',
    cp_id: 'cp-bi-1',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    code: 'TP 4.1',
    description: 'Mengidentifikasi ide pokok dari teks cerita rakyat nusantara secara teliti dan empati.',
    scope_of_material: 'Bab 1: Sudah Besar (Teks Narasi)',
    semester: 'Ganjil',
    allocated_hours: 12,
    is_active: true,
    created_at: '2026-07-16T08:00:00+07:00',
  },
  {
    id: 'tp-bi-2',
    cp_id: 'cp-bi-2',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    code: 'TP 4.2',
    description: 'Menjelaskan arti kata-kata baru dan kalimat transitif/intransitif menggunakan KBBI.',
    scope_of_material: 'Bab 1: Tata Bahasa & Kosakata Baru',
    semester: 'Ganjil',
    allocated_hours: 10,
    is_active: true,
    created_at: '2026-07-16T08:00:00+07:00',
  },
  {
    id: 'tp-bi-3',
    cp_id: 'cp-bi-4',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    code: 'TP 4.3',
    description: 'Menuliskan paragraf deskripsi sederhana tentang lingkungan madrasah dengan kosakata baku.',
    scope_of_material: 'Bab 2: Di Bawah Atap (Teks Deskripsi)',
    semester: 'Ganjil',
    allocated_hours: 14,
    is_active: true,
    created_at: '2026-07-16T08:00:00+07:00',
  },
  {
    id: 'tp-bi-4',
    cp_id: 'cp-bi-3',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    code: 'TP 4.4',
    description: 'Mempresentasikan hasil pengamatan tanaman di lingkungan madrasah dengan penuh percaya diri.',
    scope_of_material: 'Bab 3: Lihat Sekitar (Presentasi & Wawancara)',
    semester: 'Ganjil',
    allocated_hours: 12,
    is_active: true,
    created_at: '2026-07-16T08:00:00+07:00',
  },
  {
    id: 'tp-bi-5',
    cp_id: 'cp-bi-4',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    code: 'TP 4.5',
    description: 'Membedakan teks narasi fiksi dan non-fiksi serta menyusun simpulan berbasis rasa syukur.',
    scope_of_material: 'Bab 4: Meliuk dan Menerjang',
    semester: 'Genap',
    allocated_hours: 16,
    is_active: true,
    created_at: '2026-07-16T08:00:00+07:00',
  },
  {
    id: 'tp-ipas-1',
    cp_id: 'cp-ipas-1',
    subject_id: 'sbj-ipas',
    subject_name: 'IPAS',
    class_level: 4,
    code: 'TP 4.1',
    description: 'Mengidentifikasi bagian-bagian tubuh tumbuhan serta fungsinya bagi kehidupan alam sekitar.',
    scope_of_material: 'Bab 1: Tumbuhan Sumber Kehidupan di Bumi',
    semester: 'Ganjil',
    allocated_hours: 14,
    is_active: true,
    created_at: '2026-07-16T08:00:00+07:00',
  },
];

const INITIAL_ATP: AlurTujuanPembelajaranItem[] = [
  {
    id: 'atp-bi-1',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    semester: 'Ganjil',
    sequence_order: 1,
    stage_name: 'Tahap 1',
    chapter_title: 'Bab 1: Sudah Besar',
    tp_codes: ['TP 4.1', 'TP 4.2'],
    material_summary: 'Menyimak cerita rakyat, kalimat transitif & intransitif, membuka kamus KBBI, mengenali emosi dan empati.',
    allocated_hours: 18,
    assessment_plan: 'Tes tertulis kalimat transitif, unjuk kerja membaca nyaring.',
    created_at: '2026-07-17T08:00:00+07:00',
  },
  {
    id: 'atp-bi-2',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    semester: 'Ganjil',
    sequence_order: 2,
    stage_name: 'Tahap 2',
    chapter_title: 'Bab 2: Di Bawah Atap',
    tp_codes: ['TP 4.3'],
    material_summary: 'Tugas pembagian kerja di rumah/madrasah, kata hubung, penulisan kalimat bermajas ringan, teks deskripsi.',
    allocated_hours: 18,
    assessment_plan: 'Produk tulisan deskripsi lingkungan madrasah penuh cinta.',
    created_at: '2026-07-17T08:00:00+07:00',
  },
  {
    id: 'atp-bi-3',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    semester: 'Ganjil',
    sequence_order: 3,
    stage_name: 'Tahap 3',
    chapter_title: 'Bab 3: Lihat Sekitar',
    tp_codes: ['TP 4.4'],
    material_summary: 'Membaca denah rute madrasah, kalimat persuasif, rambu lalu lintas, wawancara santun.',
    allocated_hours: 18,
    assessment_plan: 'Praktik wawancara sederhana petugas madrasah.',
    created_at: '2026-07-17T08:00:00+07:00',
  },
  {
    id: 'atp-bi-4',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    semester: 'Ganjil',
    sequence_order: 4,
    stage_name: 'Tahap 4',
    chapter_title: 'Bab 4: Meliuk dan Menerjang',
    tp_codes: ['TP 4.5'],
    material_summary: 'Cerita rakyat nusantara, ide pokok paragraf, majas personifikasi, menulis puisi ungkapan cinta bunda.',
    allocated_hours: 18,
    assessment_plan: 'Asesmen Sumatif Akhir Semester (SAS).',
    created_at: '2026-07-17T08:00:00+07:00',
  },
];

const INITIAL_MODUL: ModulAjarItem[] = [
  {
    id: 'modul-bi-1',
    teacher_id: 'tch-1',
    teacher_name: 'Ahmad Fauzi, S.Pd.I',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    semester: 'Ganjil',
    chapter_title: 'Bab 1: Sudah Besar',
    topic: 'Kalimat Transitif dan Intransitif Berbasis Kisah Kasih Sayang',
    target_tp_code: 'TP 4.1 & TP 4.2',
    allocated_meetings: '3 Pertemuan (6 JP)',
    deep_learning_approach:
      'Pendekatan Pembelajaran Mendalam (Deep Learning): Bermakna (Meaningful), Menyenangkan (Joyful), dan Berkesadaran Penuh (Mindful). Siswa diajak memahami bahwa setiap tindakan dan kata memiliki dampak pada perasaan orang lain.',
    learning_activities: {
      introduction: 'Tadarus singkat, sapaan hangat penuh cinta, apersepsi cerita "Budi Menolong Ibu".',
      core_deep_learning:
        'Siswa membaca teks cerita secara berpasangan, menggarisbawahi verba tindakan (transitif) dan verba keadaan (intransitif), kemudian bermain kartu kalimat kasih sayang.',
      closing_reflection:
        'Refleksi berkesadaran: Siswa menuliskan satu kalimat transitif berupa kebaikan yang akan mereka perbuat hari ini untuk orang tua atau teman.',
    },
    google_drive_url: 'https://drive.google.com/drive/folders/simpel-mi-al-ihsan-modul-ajar-bab1',
    status: 'Disetujui',
    review_notes: 'Modul ajar sangat inspiratif, memadukan Kurikulum Merdeka dan Kurikulum Berbasis Cinta secara serasi.',
    created_at: '2026-07-20T09:00:00+07:00',
  },
  {
    id: 'modul-bi-2',
    teacher_id: 'tch-1',
    teacher_name: 'Ahmad Fauzi, S.Pd.I',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    semester: 'Ganjil',
    chapter_title: 'Bab 2: Di Bawah Atap',
    topic: 'Menyusun Paragraf Deskripsi Madrasahku Penuh Berkah',
    target_tp_code: 'TP 4.3',
    allocated_meetings: '3 Pertemuan (6 JP)',
    deep_learning_approach:
      'Pembelajaran berbasis observasi indrawi di lingkungan madrasah MI Ma’arif Al Ihsan Soborejo, menanamkan rasa memiliki dan cinta terhadap tempat menuntut ilmu.',
    learning_activities: {
      introduction: 'Doa bersama, apresiasi kebersihan kelas, penjelasan tujuan menulis deskripsi.',
      core_deep_learning:
        'Siswa berkeliling mengamati halaman madrasah, mencatat warna bunga, semilir angin, dan suara canda tawa teman, lalu merangkainya menjadi teks deskripsi terpadu.',
      closing_reflection: 'Menampilkan karya di majalah dinding kelas dengan apresiasi tepuk cinta.',
    },
    google_drive_url: 'https://drive.google.com/drive/folders/simpel-mi-al-ihsan-modul-ajar-bab2',
    status: 'Diajukan',
    created_at: '2026-08-10T10:00:00+07:00',
  },
];

const INITIAL_LKPD: LKPDItem[] = [
  {
    id: 'lkpd-bi-1',
    teacher_id: 'tch-1',
    teacher_name: 'Ahmad Fauzi, S.Pd.I',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    title: 'LKPD 01: Berburu Kalimat Transitif & Intransitif Kasih Sayang',
    chapter_topic: 'Bab 1: Sudah Besar',
    target_tp_code: 'TP 4.2',
    activity_type: 'Kelompok Kolaboratif',
    instructions:
      '1. Bacalah wacana "Indahnya Berbagi di Madrasah" dengan seksama bersama kelompokmu.\n2. Temukan minimal 3 kalimat transitif (membutuhkan objek) dan 2 kalimat intransitif.\n3. Diskusikan makna pesan moral dari setiap kalimat yang kamu temukan.',
    rubric_summary: 'Ketepatan klasifikasi (60%), kerapian penulisan (20%), kerjasama tim santun (20%).',
    google_drive_url: 'https://docs.google.com/document/d/lkpd-bahasa-indonesia-01-al-ihsan',
    created_at: '2026-07-22T08:30:00+07:00',
  },
  {
    id: 'lkpd-bi-2',
    teacher_id: 'tch-1',
    teacher_name: 'Ahmad Fauzi, S.Pd.I',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    title: 'LKPD 02: Lembar Pengamatan Deskripsi Keindahan Madrasah',
    chapter_topic: 'Bab 2: Di Bawah Atap',
    target_tp_code: 'TP 4.3',
    activity_type: 'Individu',
    instructions:
      '1. Duduklah di serambi musholla atau pojok baca madrasah dengan tenang.\n2. Amati 3 objek menarik (taman bunga, deretan kelas, atau pohon rindang).\n3. Tuliskan 1 paragraf deskripsi minimal 4 kalimat dengan kosakata baku.',
    rubric_summary: 'Kesesuaian objek (40%), kekayaan kosakata (40%), kesantunan bahasa (20%).',
    google_drive_url: 'https://docs.google.com/document/d/lkpd-bahasa-indonesia-02-al-ihsan',
    created_at: '2026-08-12T08:30:00+07:00',
  },
];

export const LINGKUP_MATERI_CONFIGS: LingkupMateriConfig[] = [
  // === BAHASA INDONESIA KELAS 4 ===
  {
    id: 'lm-bi-1',
    scope_key: 'LM1',
    code: 'LM 1',
    label: 'Lingkup Materi 1',
    title: 'Bab 1: Sudah Besar (Teks Narasi & Kalimat Transitif)',
    subject_id: 'sbj-ind',
    class_level: 4,
    semester: 'Ganjil',
    associated_tps: ['TP 4.1', 'TP 4.2'],
    description: 'Menyimak cerita, mengenali emosi, kalimat transitif & intransitif, membuka kamus KBBI.',
  },
  {
    id: 'lm-bi-2',
    scope_key: 'LM2',
    code: 'LM 2',
    label: 'Lingkup Materi 2',
    title: 'Bab 2: Di Bawah Atap (Teks Deskripsi & Kosakata)',
    subject_id: 'sbj-ind',
    class_level: 4,
    semester: 'Ganjil',
    associated_tps: ['TP 4.3'],
    description: 'Tugas di rumah/madrasah, kata hubung antarkalimat, penulisan teks deskripsi penuh cinta.',
  },
  {
    id: 'lm-bi-sts',
    scope_key: 'STS',
    code: 'STS',
    label: 'Sumatif Tengah Semester',
    title: 'Sumatif Tengah Semester (STS) Ganjil',
    subject_id: 'sbj-ind',
    class_level: 4,
    semester: 'Ganjil',
    associated_tps: ['TP 4.1', 'TP 4.2', 'TP 4.3'],
    description: 'Asesmen sumatif tengah semester mencakup materi Bab 1 (Sudah Besar) dan Bab 2 (Di Bawah Atap).',
    is_special_summative: true,
  },
  {
    id: 'lm-bi-3',
    scope_key: 'LM3',
    code: 'LM 3',
    label: 'Lingkup Materi 3',
    title: 'Bab 3: Lihat Sekitar (Wawancara & Denah Rute)',
    subject_id: 'sbj-ind',
    class_level: 4,
    semester: 'Ganjil',
    associated_tps: ['TP 4.4'],
    description: 'Membaca denah rute madrasah, kalimat persuasif, rambu lalu lintas, wawancara santun.',
  },
  {
    id: 'lm-bi-4',
    scope_key: 'LM4',
    code: 'LM 4',
    label: 'Lingkup Materi 4',
    title: 'Bab 4: Meliuk dan Menerjang (Ide Pokok & Majas)',
    subject_id: 'sbj-ind',
    class_level: 4,
    semester: 'Ganjil',
    associated_tps: ['TP 4.5'],
    description: 'Cerita rakyat nusantara, ide pokok paragraf, majas personifikasi, menulis ungkapan rasa syukur.',
  },
  {
    id: 'lm-bi-sas',
    scope_key: 'SAS',
    code: 'SAS',
    label: 'Sumatif Akhir Semester',
    title: 'Sumatif Akhir Semester (SAS) Ganjil',
    subject_id: 'sbj-ind',
    class_level: 4,
    semester: 'Ganjil',
    associated_tps: ['TP 4.1', 'TP 4.2', 'TP 4.3', 'TP 4.4', 'TP 4.5'],
    description: 'Asesmen sumatif akhir semester komprehensif mengukur seluruh TP 4.1 s.d. TP 4.5 untuk pelaporan rapor.',
    is_special_summative: true,
  },

  // === IPAS KELAS 4 ===
  {
    id: 'lm-ipas-1',
    scope_key: 'LM1',
    code: 'LM 1',
    label: 'Lingkup Materi 1',
    title: 'Bab 1: Tumbuhan Sumber Kehidupan di Bumi',
    subject_id: 'sbj-ipas',
    class_level: 4,
    semester: 'Ganjil',
    associated_tps: ['TP 4.1'],
    description: 'Menganalisis bagian tubuh tumbuhan, fotosintesis, dan perkembangbiakan tanaman madrasah.',
  },
  {
    id: 'lm-ipas-2',
    scope_key: 'LM2',
    code: 'LM 2',
    label: 'Lingkup Materi 2',
    title: 'Bab 2: Wujud Zat dan Perubahannya',
    subject_id: 'sbj-ipas',
    class_level: 4,
    semester: 'Ganjil',
    associated_tps: ['TP 4.2'],
    description: 'Massa dan volume materi, karakteristik zat padat, cair, gas, dan perubahan wujud zat.',
  },
  {
    id: 'lm-ipas-sts',
    scope_key: 'STS',
    code: 'STS',
    label: 'Sumatif Tengah Semester',
    title: 'Sumatif Tengah Semester (STS) IPAS Ganjil',
    subject_id: 'sbj-ipas',
    class_level: 4,
    semester: 'Ganjil',
    associated_tps: ['TP 4.1', 'TP 4.2'],
    description: 'Asesmen sumatif tengah semester IPAS Bab Tumbuhan dan Wujud Zat.',
    is_special_summative: true,
  },
  {
    id: 'lm-ipas-3',
    scope_key: 'LM3',
    code: 'LM 3',
    label: 'Lingkup Materi 3',
    title: 'Bab 3: Gaya di Sekitar Kita',
    subject_id: 'sbj-ipas',
    class_level: 4,
    semester: 'Ganjil',
    associated_tps: ['TP 4.3'],
    description: 'Pengaruh gaya otot, gesek, magnet, dan gravitasi terhadap benda di lingkungan sekitar.',
  },
  {
    id: 'lm-ipas-4',
    scope_key: 'LM4',
    code: 'LM 4',
    label: 'Lingkup Materi 4',
    title: 'Bab 4: Mengubah Bentuk Energi',
    subject_id: 'sbj-ipas',
    class_level: 4,
    semester: 'Ganjil',
    associated_tps: ['TP 4.4'],
    description: 'Transformasi energi gerak, cahaya, listrik, dan pemanfaatannya dalam kehidupan sehari-hari.',
  },
  {
    id: 'lm-ipas-sas',
    scope_key: 'SAS',
    code: 'SAS',
    label: 'Sumatif Akhir Semester',
    title: 'Sumatif Akhir Semester (SAS) IPAS Ganjil',
    subject_id: 'sbj-ipas',
    class_level: 4,
    semester: 'Ganjil',
    associated_tps: ['TP 4.1', 'TP 4.2', 'TP 4.3', 'TP 4.4'],
    description: 'Asesmen akhir semester menyeluruh IPAS untuk pengolahan nilai rapor.',
    is_special_summative: true,
  },
];

const INITIAL_KISI: KisiKisiItem[] = [
  // LM 1
  {
    id: 'kisi-bi-1',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    scope_key: 'LM1',
    assessment_type: 'Formatif Lingkup Materi',
    tp_code: 'TP 4.1',
    material_topic: 'Teks Cerita Rakyat & Ide Pokok',
    indicator: 'Disajikan cuplikan fabel, peserta didik dapat menentukan ide pokok paragraf secara tepat.',
    cognitive_level: 'L2 (Aplikasi)',
    question_type: 'Pilihan Ganda',
    question_numbers: '1, 2',
    scoring_weight: 20,
    created_at: '2026-07-25T10:00:00+07:00',
  },
  {
    id: 'kisi-bi-2',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    scope_key: 'LM1',
    assessment_type: 'Sumatif Lingkup Materi',
    tp_code: 'TP 4.2',
    material_topic: 'Kalimat Transitif dan Intransitif',
    indicator: 'Disajikan kalimat acak, peserta didik dapat mengidentifikasi kalimat yang membutuhkan objek.',
    cognitive_level: 'L2 (Aplikasi)',
    question_type: 'Pilihan Ganda',
    question_numbers: '3, 4',
    scoring_weight: 20,
    created_at: '2026-07-25T10:00:00+07:00',
  },
  // LM 2
  {
    id: 'kisi-bi-lm2-1',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    scope_key: 'LM2',
    assessment_type: 'Formatif Lingkup Materi',
    tp_code: 'TP 4.3',
    material_topic: 'Teks Deskripsi & Kosakata Baru',
    indicator: 'Disajikan paragraf deskripsi madrasah, siswa dapat menemukan makna kata berimbuhan ber- dan me-.',
    cognitive_level: 'L2 (Aplikasi)',
    question_type: 'Isian Singkat',
    question_numbers: '1, 2',
    scoring_weight: 25,
    created_at: '2026-08-05T10:00:00+07:00',
  },
  // STS Khusus
  {
    id: 'kisi-bi-3',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    scope_key: 'STS',
    assessment_type: 'Sumatif Tengah Semester (STS)',
    tp_code: 'TP 4.3',
    material_topic: 'Menulis Paragraf Deskripsi Madrasah Penuh Berkah',
    indicator: 'Peserta didik dapat menyusun satu paragraf deskripsi logis bertema kasih sayang di madrasah.',
    cognitive_level: 'L3 (Penalaran/HOTS)',
    question_type: 'Uraian',
    question_numbers: '5',
    scoring_weight: 30,
    created_at: '2026-08-15T10:00:00+07:00',
  },
  {
    id: 'kisi-bi-sts-2',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    scope_key: 'STS',
    assessment_type: 'Sumatif Tengah Semester (STS)',
    tp_code: 'TP 4.2',
    material_topic: 'Analisis Kalimat Transitif & Konjungsi',
    indicator: 'Disajikan narasi pendek, peserta didik dapat menelaah hubungan sebab-akibat kalimat.',
    cognitive_level: 'L2 (Aplikasi)',
    question_type: 'Pilihan Ganda',
    question_numbers: '1 s.d. 4',
    scoring_weight: 30,
    created_at: '2026-08-15T10:00:00+07:00',
  },
  // SAS Khusus
  {
    id: 'kisi-bi-sas-1',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    scope_key: 'SAS',
    assessment_type: 'Sumatif Akhir Semester (SAS)',
    tp_code: 'TP 4.4 & TP 4.5',
    material_topic: 'Komprehensif Literasi & Majas Personifikasi',
    indicator: 'Disajikan kutipan cerita rakyat, peserta didik dapat menyimpulkan amanat moral dan majas.',
    cognitive_level: 'L3 (Penalaran/HOTS)',
    question_type: 'Uraian',
    question_numbers: '1 s.d. 5',
    scoring_weight: 40,
    created_at: '2026-11-01T10:00:00+07:00',
  },
];

const INITIAL_SOAL: SoalAsesmenItem[] = [
  // LM 1
  {
    id: 'soal-bi-1',
    kisikisi_id: 'kisi-bi-1',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    scope_key: 'LM1',
    tp_code: 'TP 4.1',
    question_number: 1,
    question_type: 'Pilihan Ganda',
    stimulus:
      'Di sebuah padang rumput yang asri dekat Soborejo, Kancil selalu membagikan buah mentimun segar kepada teman-temannya yang sedang lapar tanpa meminta imbalan sedikit pun.',
    question_text: 'Sifat terpuji yang ditunjukkan tokoh Kancil dalam kutipan cerita di atas adalah...',
    options: ['A. Cerdik dan lincah', 'B. Dermawan dan penuh kasih sayang', 'C. Sombong dan licik', 'D. Hemat dan pendiam'],
    correct_answer: 'B',
    scoring_rubric: 'Jawaban benar mendapat skor 10, salah mendapat 0.',
    score_points: 10,
    created_at: '2026-07-26T11:00:00+07:00',
  },
  {
    id: 'soal-bi-2',
    kisikisi_id: 'kisi-bi-2',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    scope_key: 'LM1',
    tp_code: 'TP 4.2',
    question_number: 2,
    question_type: 'Pilihan Ganda',
    stimulus: 'Perhatikan kalimat-kalimat berikut:\n(1) Farhan membaca buku di perpustakaan madrasah.\n(2) Burung kenari itu bernyanyi merdu di dahan.',
    question_text: 'Manakah dari kalimat di atas yang termasuk jenis kalimat transitif?',
    options: ['A. Kalimat (1) saja', 'B. Kalimat (2) saja', 'C. Keduanya transitif', 'D. Keduanya intransitif'],
    correct_answer: 'A',
    scoring_rubric: 'Jawaban benar bernilai 10 (karena kata "membaca" membutuhkan objek "buku").',
    score_points: 10,
    created_at: '2026-07-26T11:00:00+07:00',
  },
  // LM 2
  {
    id: 'soal-bi-lm2-1',
    kisikisi_id: 'kisi-bi-lm2-1',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    scope_key: 'LM2',
    tp_code: 'TP 4.3',
    question_number: 1,
    question_type: 'Isian Singkat',
    stimulus: 'Halaman madrasah tampak bersih dan asri karena siswa selalu ... sampah pada tempatnya.',
    question_text: 'Kata berimbuhan yang tepat untuk melengkapi kalimat rumpang di atas adalah...',
    correct_answer: 'membuang / meletakkan',
    scoring_rubric: 'Kata bentukan me- yang bermakna tindakan positif dinilai 10 poin.',
    score_points: 10,
    created_at: '2026-08-06T11:00:00+07:00',
  },
  // STS Khusus
  {
    id: 'soal-bi-3',
    kisikisi_id: 'kisi-bi-3',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    scope_key: 'STS',
    tp_code: 'TP 4.3',
    question_number: 1,
    question_type: 'Uraian',
    stimulus: 'Suasana pagi hari di MI Ma’arif Al Ihsan Soborejo sangat sejuk, suara burung berkicau menyambut kedatangan guru dan siswa yang tersenyum saling mengucap salam.',
    question_text: 'Tuliskanlah 1 (satu) paragraf deskripsi singkat (minimal 3 kalimat) yang menggambarkan rasa kasih sayang antar sesama teman di madrasahmu!',
    correct_answer:
      'Contoh jawaban siswa: Di kelas kami, semua teman saling menyayangi dan membantu. Jika ada teman yang tidak membawa pensil, kami meminjamkannya dengan ikhlas. Saat jam istirahat, kami membagi bekal bersama dengan rasa gembira.',
    scoring_rubric: 'Skor 20 jika kalimat padu & bertema cinta; skor 10 jika ada ketidaksesuaian tanda baca; skor 5 jika belum padu.',
    score_points: 20,
    created_at: '2026-08-16T11:00:00+07:00',
  },
  // SAS Khusus
  {
    id: 'soal-bi-sas-1',
    kisikisi_id: 'kisi-bi-sas-1',
    subject_id: 'sbj-ind',
    subject_name: 'Bahasa Indonesia',
    class_level: 4,
    scope_key: 'SAS',
    tp_code: 'TP 4.5',
    question_number: 1,
    question_type: 'Uraian',
    stimulus: '"Daun-daun kelapa melambai ramah kepada para peziarah yang melintasi jalan desa Soborejo."',
    question_text: 'Gaya bahasa (majas) apakah yang digunakan dalam kalimat di atas? Jelaskan alasanmu!',
    correct_answer: 'Majas personifikasi, karena mengumpamakan benda mati (daun kelapa) dapat melambai seperti manusia.',
    scoring_rubric: 'Skor 15 jika menyebut majas personifikasi dan menjelaskan alasannya secara tepat.',
    score_points: 15,
    created_at: '2026-11-02T11:00:00+07:00',
  },
];

// Helper get from localStorage or fallback
function getStored<T>(key: string, initial: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return initial;
  }
}

function setStored<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to write to localStorage for key:', key, err);
  }
}

export const curriculumWorkspaceService = {
  // === CP ===
  getCPList(): CapaianPembelajaranItem[] {
    return getStored(STORAGE_KEYS.CP, INITIAL_CP);
  },
  saveCP(item: CapaianPembelajaranItem): void {
    const list = this.getCPList();
    const idx = list.findIndex((c) => c.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    setStored(STORAGE_KEYS.CP, list);
  },
  deleteCP(id: string): void {
    const list = this.getCPList().filter((c) => c.id !== id);
    setStored(STORAGE_KEYS.CP, list);
  },

  // === TP ===
  getTPList(): TujuanPembelajaranItem[] {
    return getStored(STORAGE_KEYS.TP, INITIAL_TP);
  },
  saveTP(item: TujuanPembelajaranItem): void {
    const list = this.getTPList();
    const idx = list.findIndex((t) => t.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    setStored(STORAGE_KEYS.TP, list);
  },
  deleteTP(id: string): void {
    const list = this.getTPList().filter((t) => t.id !== id);
    setStored(STORAGE_KEYS.TP, list);
  },

  // === ATP ===
  getATPList(): AlurTujuanPembelajaranItem[] {
    return getStored(STORAGE_KEYS.ATP, INITIAL_ATP);
  },
  saveATP(item: AlurTujuanPembelajaranItem): void {
    const list = this.getATPList();
    const idx = list.findIndex((a) => a.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.push(item);
    }
    setStored(STORAGE_KEYS.ATP, list);
  },
  deleteATP(id: string): void {
    const list = this.getATPList().filter((a) => a.id !== id);
    setStored(STORAGE_KEYS.ATP, list);
  },

  // === MODUL AJAR ===
  getModulList(): ModulAjarItem[] {
    return getStored(STORAGE_KEYS.MODUL, INITIAL_MODUL);
  },
  saveModul(item: ModulAjarItem): void {
    const list = this.getModulList();
    const idx = list.findIndex((m) => m.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    setStored(STORAGE_KEYS.MODUL, list);
  },
  deleteModul(id: string): void {
    const list = this.getModulList().filter((m) => m.id !== id);
    setStored(STORAGE_KEYS.MODUL, list);
  },

  // === LKPD ===
  getLKPDList(): LKPDItem[] {
    return getStored(STORAGE_KEYS.LKPD, INITIAL_LKPD);
  },
  saveLKPD(item: LKPDItem): void {
    const list = this.getLKPDList();
    const idx = list.findIndex((l) => l.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    setStored(STORAGE_KEYS.LKPD, list);
  },
  deleteLKPD(id: string): void {
    const list = this.getLKPDList().filter((l) => l.id !== id);
    setStored(STORAGE_KEYS.LKPD, list);
  },

  // === KISI-KISI ===
  getKisiList(): KisiKisiItem[] {
    return getStored(STORAGE_KEYS.KISI, INITIAL_KISI);
  },
  saveKisi(item: KisiKisiItem): void {
    const list = this.getKisiList();
    const idx = list.findIndex((k) => k.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    setStored(STORAGE_KEYS.KISI, list);
  },
  deleteKisi(id: string): void {
    const list = this.getKisiList().filter((k) => k.id !== id);
    setStored(STORAGE_KEYS.KISI, list);
  },

  // === SOAL ASESMEN ===
  getSoalList(): SoalAsesmenItem[] {
    return getStored(STORAGE_KEYS.SOAL, INITIAL_SOAL);
  },
  saveSoal(item: SoalAsesmenItem): void {
    const list = this.getSoalList();
    const idx = list.findIndex((s) => s.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.push(item);
    }
    setStored(STORAGE_KEYS.SOAL, list);
  },
  deleteSoal(id: string): void {
    const list = this.getSoalList().filter((s) => s.id !== id);
    setStored(STORAGE_KEYS.SOAL, list);
  },

  // === LINGKUP MATERI (LM) & STS / SAS ===
  getLingkupMateriList(subjectId = 'sbj-ind', classLevel = 4): LingkupMateriConfig[] {
    return LINGKUP_MATERI_CONFIGS.filter(
      (lm) => lm.subject_id === subjectId && lm.class_level === classLevel
    );
  },
};
