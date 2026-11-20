import {
  CapaianPembelajaranItem,
  TujuanPembelajaranItem,
  AlurTujuanPembelajaranItem,
  ProtaItem,
  PromesItem,
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
  PROTA: 'simpel_mi_prota_items_v1',
  PROMES: 'simpel_mi_promes_items_v1',
  MODUL: 'simpel_mi_modul_items_v1',
  LKPD: 'simpel_mi_lkpd_items_v1',
  KISI: 'simpel_mi_kisi_items_v1',
  SOAL: 'simpel_mi_soal_items_v1',
  LINGKUP_MATERI: 'simpel_mi_lingkup_materi_custom_v1',
  HIDDEN_PRESET_SCOPES: 'simpel_mi_lingkup_materi_hidden_v1',
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

const INITIAL_KISI: KisiKisiItem[] = [];

const INITIAL_SOAL: SoalAsesmenItem[] = [];

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

  // === PROTA ===
  getProtaList(): ProtaItem[] {
    return getStored<ProtaItem>(STORAGE_KEYS.PROTA, []);
  },
  saveProta(item: ProtaItem): void {
    const list = this.getProtaList();
    const idx = list.findIndex((p) => p.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    setStored(STORAGE_KEYS.PROTA, list);
  },
  deleteProta(id: string): void {
    const list = this.getProtaList().filter((p) => p.id !== id);
    setStored(STORAGE_KEYS.PROTA, list);
  },

  // === PROMES ===
  getPromesList(): PromesItem[] {
    return getStored<PromesItem>(STORAGE_KEYS.PROMES, []);
  },
  savePromes(item: PromesItem): void {
    const list = this.getPromesList();
    const idx = list.findIndex((p) => p.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    setStored(STORAGE_KEYS.PROMES, list);
  },
  deletePromes(id: string): void {
    const list = this.getPromesList().filter((p) => p.id !== id);
    setStored(STORAGE_KEYS.PROMES, list);
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

  // === LINGKUP MATERI (LM) PRESET + KUSTOM ===
  getCustomLingkupMateri(): LingkupMateriConfig[] {
    return getStored<LingkupMateriConfig>(STORAGE_KEYS.LINGKUP_MATERI, []);
  },

  getHiddenPresetScopeKeys(): Array<{ subject_id: string; class_level: number; scope_key: string }> {
    return getStored<{ subject_id: string; class_level: number; scope_key: string }>(
      STORAGE_KEYS.HIDDEN_PRESET_SCOPES,
      []
    );
  },

  getPresetLingkupMateriTemplates(
    subjectId = 'sbj-ind',
    classLevel = 4,
    semester: 'Ganjil' | 'Genap' = 'Ganjil'
  ): LingkupMateriConfig[] {
    const staticMatches = LINGKUP_MATERI_CONFIGS.filter(
      (lm) => lm.subject_id === subjectId && lm.class_level === classLevel
    );
    if (staticMatches.length > 0) {
      return staticMatches;
    }

    const tpItems = this.getTPList().filter(
      (tp) => tp.subject_id === subjectId && tp.class_level === classLevel
    );
    const tpCode = (idx: number) => tpItems[idx]?.code || `TP ${classLevel}.${idx + 1}`;
    const allTpCodes =
      tpItems.length > 0
        ? tpItems.slice(0, 4).map((t) => t.code)
        : [`TP ${classLevel}.1`, `TP ${classLevel}.2`, `TP ${classLevel}.3`, `TP ${classLevel}.4`];

    return [
      {
        id: `lm-${subjectId}-${classLevel}-1`,
        scope_key: 'LM1',
        code: 'LM 1',
        label: 'Lingkup Materi 1',
        title: tpItems[0]?.scope_of_material || `Lingkup Materi 1 (Kelas ${classLevel})`,
        subject_id: subjectId,
        class_level: classLevel,
        semester,
        associated_tps: [tpCode(0)],
        description: `Evaluasi formatif & sumatif lingkup materi 1 untuk Kelas ${classLevel}.`,
      },
      {
        id: `lm-${subjectId}-${classLevel}-2`,
        scope_key: 'LM2',
        code: 'LM 2',
        label: 'Lingkup Materi 2',
        title: tpItems[1]?.scope_of_material || `Lingkup Materi 2 (Kelas ${classLevel})`,
        subject_id: subjectId,
        class_level: classLevel,
        semester,
        associated_tps: [tpCode(1)],
        description: `Evaluasi formatif & sumatif lingkup materi 2 untuk Kelas ${classLevel}.`,
      },
      {
        id: `lm-${subjectId}-${classLevel}-sts`,
        scope_key: 'STS',
        code: 'STS',
        label: `Sumatif Tengah Semester (${semester})`,
        title: `Sumatif Tengah Semester (STS ${semester})`,
        subject_id: subjectId,
        class_level: classLevel,
        semester,
        associated_tps: [tpCode(0), tpCode(1)],
        description: `Asesmen sumatif tengah semester untuk mengukur capaian materi paruh pertama semester ${semester.toLowerCase()}.`,
        is_special_summative: true,
      },
      {
        id: `lm-${subjectId}-${classLevel}-3`,
        scope_key: 'LM3',
        code: 'LM 3',
        label: 'Lingkup Materi 3',
        title: tpItems[2]?.scope_of_material || `Lingkup Materi 3 (Kelas ${classLevel})`,
        subject_id: subjectId,
        class_level: classLevel,
        semester,
        associated_tps: [tpCode(2)],
        description: `Evaluasi formatif & sumatif lingkup materi 3 untuk Kelas ${classLevel}.`,
      },
      {
        id: `lm-${subjectId}-${classLevel}-4`,
        scope_key: 'LM4',
        code: 'LM 4',
        label: 'Lingkup Materi 4',
        title: tpItems[3]?.scope_of_material || `Lingkup Materi 4 (Kelas ${classLevel})`,
        subject_id: subjectId,
        class_level: classLevel,
        semester,
        associated_tps: [tpCode(3)],
        description: `Evaluasi formatif & sumatif lingkup materi 4 untuk Kelas ${classLevel}.`,
      },
      {
        id: `lm-${subjectId}-${classLevel}-sas`,
        scope_key: 'SAS',
        code: 'SAS',
        label: `Sumatif Akhir Semester (${semester})`,
        title: `Sumatif Akhir Semester (SAS ${semester})`,
        subject_id: subjectId,
        class_level: classLevel,
        semester,
        associated_tps: allTpCodes,
        description: `Asesmen sumatif akhir semester komprehensif penentu capaian rapor semester ${semester.toLowerCase()}.`,
        is_special_summative: true,
      },
    ];
  },

  activatePresetLingkupMateri(
    subjectId: string,
    classLevel: number,
    semester: 'Ganjil' | 'Genap' = 'Ganjil',
    scopeKeys?: string[]
  ): LingkupMateriConfig[] {
    const templates = this.getPresetLingkupMateriTemplates(subjectId, classLevel, semester);
    const chosen = scopeKeys && scopeKeys.length > 0
      ? templates.filter((t) => scopeKeys.includes(t.scope_key))
      : templates;

    const existingList = this.getCustomLingkupMateri();
    const added: LingkupMateriConfig[] = [];

    for (const tpl of chosen) {
      const alreadyExists = existingList.some(
        (x) =>
          x.subject_id === subjectId &&
          x.class_level === classLevel &&
          x.scope_key === tpl.scope_key
      );
      if (!alreadyExists) {
        const entry: LingkupMateriConfig = {
          ...tpl,
          id: `lm-${subjectId}-${classLevel}-${tpl.scope_key}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          is_custom: false,
        };
        existingList.push(entry);
        added.push(entry);
      }
    }

    setStored(STORAGE_KEYS.LINGKUP_MATERI, existingList);

    const hidden = this.getHiddenPresetScopeKeys().filter(
      (h) =>
        !(
          h.subject_id === subjectId &&
          h.class_level === classLevel &&
          (!scopeKeys || scopeKeys.includes(h.scope_key))
        )
    );
    setStored(STORAGE_KEYS.HIDDEN_PRESET_SCOPES, hidden);

    return this.getLingkupMateriList(subjectId, classLevel, semester);
  },

  saveLingkupMateri(item: Omit<LingkupMateriConfig, 'id' | 'scope_key'> & { id?: string; scope_key?: string }): LingkupMateriConfig {
    const existingList = this.getCustomLingkupMateri();
    const subjectItems = this.getLingkupMateriList(item.subject_id, item.class_level, item.semester);

    let scopeKey = (item.scope_key || '').trim();
    if (!scopeKey) {
      const normalized = item.code
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 16);
      let candidate = normalized || `LM${subjectItems.length + 1}`;
      let suffix = 1;
      while (subjectItems.some((s) => s.scope_key === candidate && s.id !== item.id)) {
        candidate = `${normalized || 'LM'}_${++suffix}`;
      }
      scopeKey = candidate;
    }

    const savedItem: LingkupMateriConfig = {
      ...item,
      id: item.id || `lm-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      scope_key: scopeKey,
      is_custom: item.is_custom ?? true,
    };

    const idx = existingList.findIndex(
      (x) =>
        x.id === savedItem.id ||
        (x.subject_id === savedItem.subject_id &&
          x.class_level === savedItem.class_level &&
          x.scope_key === savedItem.scope_key)
    );
    if (idx >= 0) {
      existingList[idx] = savedItem;
    } else {
      existingList.push(savedItem);
    }
    setStored(STORAGE_KEYS.LINGKUP_MATERI, existingList);

    const hidden = this.getHiddenPresetScopeKeys().filter(
      (h) =>
        !(
          h.subject_id === savedItem.subject_id &&
          h.class_level === savedItem.class_level &&
          h.scope_key === savedItem.scope_key
        )
    );
    setStored(STORAGE_KEYS.HIDDEN_PRESET_SCOPES, hidden);

    return savedItem;
  },

  deleteLingkupMateri(subjectId: string, classLevel: number, scopeKey: string): void {
    const customList = this.getCustomLingkupMateri().filter(
      (x) => !(x.subject_id === subjectId && x.class_level === classLevel && x.scope_key === scopeKey)
    );
    setStored(STORAGE_KEYS.LINGKUP_MATERI, customList);

    const isPreset = ['LM1', 'LM2', 'LM3', 'LM4', 'STS', 'SAS'].includes(scopeKey);
    if (isPreset) {
      const hidden = this.getHiddenPresetScopeKeys();
      if (
        !hidden.some(
          (h) => h.subject_id === subjectId && h.class_level === classLevel && h.scope_key === scopeKey
        )
      ) {
        hidden.push({ subject_id: subjectId, class_level: classLevel, scope_key: scopeKey });
        setStored(STORAGE_KEYS.HIDDEN_PRESET_SCOPES, hidden);
      }
    }
  },

  restorePresetLingkupMateri(subjectId: string, classLevel: number): void {
    this.activatePresetLingkupMateri(subjectId, classLevel, 'Ganjil');
  },

  getLingkupMateriList(subjectId = 'sbj-ind', classLevel = 4, semester: 'Ganjil' | 'Genap' = 'Ganjil'): LingkupMateriConfig[] {
    const customMatches = this.getCustomLingkupMateri().filter(
      (c) => c.subject_id === subjectId && c.class_level === classLevel
    );

    // Sertakan juga scope yang sudah memiliki item kisi-kisi atau soal yang disimpan guru sebelumnya
    const existingItemScopes = new Set<string>([
      ...this.getKisiList()
        .filter((k) => k.subject_id === subjectId && k.class_level === classLevel)
        .map((k) => k.scope_key),
      ...this.getSoalList()
        .filter((s) => s.subject_id === subjectId && s.class_level === classLevel)
        .map((s) => s.scope_key),
    ]);

    const templates = this.getPresetLingkupMateriTemplates(subjectId, classLevel, semester);
    const hiddenKeys = new Set(
      this.getHiddenPresetScopeKeys()
        .filter((h) => h.subject_id === subjectId && h.class_level === classLevel)
        .map((h) => h.scope_key)
    );

    const result: LingkupMateriConfig[] = [...customMatches];
    const presentKeys = new Set(customMatches.map((c) => c.scope_key));

    for (const scKey of existingItemScopes) {
      if (!presentKeys.has(scKey) && !hiddenKeys.has(scKey)) {
        const matchedTpl = templates.find((t) => t.scope_key === scKey);
        result.push(
          matchedTpl || {
            id: `lm-inferred-${subjectId}-${classLevel}-${scKey}`,
            scope_key: scKey,
            code: scKey,
            label: scKey,
            title: `${scKey} (${classLevel ? `Kelas ${classLevel}` : 'Evaluasi'})`,
            subject_id: subjectId,
            class_level: classLevel,
            semester,
            associated_tps: [],
            description: `Unit evaluasi ${scKey}.`,
            is_custom: true,
          }
        );
        presentKeys.add(scKey);
      }
    }

    // Urutkan rapi: LM1, LM2, STS, LM3, LM4, custom lain, SAS di akhir
    const orderWeight = (key: string): number => {
      if (key === 'LM1') return 1;
      if (key === 'LM2') return 2;
      if (key === 'STS') return 3;
      if (key === 'LM3') return 4;
      if (key === 'LM4') return 5;
      if (key === 'SAS') return 999;
      const lmNum = key.match(/^LM(\d+)$/i);
      if (lmNum) return 5 + parseInt(lmNum[1], 10);
      return 50;
    };

    return result.sort((a, b) => {
      const wa = orderWeight(a.scope_key);
      const wb = orderWeight(b.scope_key);
      if (wa !== wb) return wa - wb;
      return a.code.localeCompare(b.code, 'id');
    });
  },
};
