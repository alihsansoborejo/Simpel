/**
 * Definisi TypeScript untuk Modul AI & Asisten Cerdas Pembelajaran
 * SIMPEL MI AL IHSAN - Tahap 6
 * Standar: Kurikulum Merdeka, Pembelajaran Mendalam, Kurikulum Berbasis Cinta
 */

import { UserRole } from './database.types';

export type AIFeatureType =
  | 'modul_ajar'
  | 'lkpd'
  | 'soal_asesmen'
  | 'ide_pembelajaran'
  | 'refleksi_guru'
  | 'analisis_belajar'
  | 'kepala_madrasah'
  | 'tanya_jawab';

export type AIDifficulty = 'dasar' | 'menengah' | 'tantangan_hots';

export interface ModulAjarRequest {
  subject: string;
  grade: string;
  semester: 'Ganjil' | 'Genap';
  academicYear: string;
  topic: string;
  cp: string;
  tp: string;
  timeAllocation: string;
  studentCharacteristics: string;
  deepLearningApproach: string; // Mindful, Meaningful, Joyful
  cintaValues: string; // Nilai KBC: Kasih Sayang, Keteladanan, Inklusif, Akhlak Mulia
  regenerateSection?: string; // 'identitas' | 'langkah' | 'pemantik' | 'asesmen' | 'diferensiasi' | 'refleksi'
  currentContent?: string;
}

export interface ModulAjarResult {
  identitas: {
    madrasah: string;
    mataPelajaran: string;
    faseKelas: string;
    alokasiWaktu: string;
    tahunAjaran: string;
    semester: string;
    materiPokok: string;
    penyusun: string;
  };
  tujuanPembelajaran: string[];
  pemahamanBermakna: string;
  pertanyaanPemantik: string[];
  kegiatanPembelajaran: {
    pendahuluan: {
      durasi: string;
      langkah: string[];
    };
    inti: {
      durasi: string;
      mindfulLearning: string[];
      meaningfulLearning: string[];
      joyfulLearning: string[];
    };
    penutup: {
      durasi: string;
      langkah: string[];
    };
  };
  asesmen: {
    diagnostik: string;
    formatif: string;
    sumatif: string;
    rubrik: string;
  };
  diferensiasi: {
    konten: string;
    proses: string;
    produk: string;
  };
  mediaSumber: string[];
  refleksi: {
    refleksiGuru: string[];
    refleksiSiswa: string[];
  };
  rawMarkdown?: string;
}

export interface LKPDRequest {
  subject: string;
  grade: string;
  topic: string;
  learningObjective: string;
  difficulty: AIDifficulty;
  activityType?: string; // Mandiri, Kelompok, Proyek
}

export interface LKPDResult {
  judul: string;
  identitas: {
    mataPelajaran: string;
    faseKelas: string;
    alokasiWaktu: string;
    kelompokAtauNama: string;
  };
  tujuanKegiatan: string[];
  petunjukPengerjaan: string[];
  materiSingkat: string;
  aktivitasSiswa: {
    tahap: string;
    kegiatan: string;
  }[];
  pertanyaanTugas: {
    nomor: number;
    pertanyaan: string;
    ruangJawabanType: 'garis' | 'tabel' | 'gambar' | 'pilihan';
    skorMaksimal: number;
  }[];
  lembarRefleksiSiswa: string;
  kriteriaPenilaian: {
    aspek: string;
    kriteria: string;
    skor: number;
  }[];
  rawMarkdown?: string;
}

export interface AssessmentQuestionRequest {
  subject: string;
  grade: string;
  topic: string;
  learningObjective: string;
  questionTypes: ('pg' | 'isian' | 'menjodohkan' | 'uraian' | 'literasi' | 'numerasi' | 'hots')[];
  questionCount: number;
  difficulty: 'dasar' | 'sedang' | 'tinggi_hots';
  includeGrid: boolean; // Kisi-kisi
  includeRubric: boolean; // Pedoman penskoran
}

export interface AssessmentQuestionResult {
  judulAsesmen: string;
  mataPelajaran: string;
  faseKelas: string;
  kisiKisi: {
    nomor: number;
    tp: string;
    materi: string;
    indikator: string;
    levelKognitif: string;
    bentukSoal: string;
    nomorSoal: number;
  }[];
  daftarSoal: {
    nomor: number;
    bentuk: string;
    stimulus?: string;
    pertanyaan: string;
    pilihan?: string[]; // Untuk PG
    kunciJawaban: string;
    pembahasan: string;
    bobotSkor: number;
  }[];
  pedomanPenskoran: {
    rumusNilai: string;
    rubrik: {
      kriteria: string;
      skor: string;
    }[];
  };
  rawMarkdown?: string;
}

export interface LearningIdeaRequest {
  subject: string;
  grade: string;
  topic: string;
  category: 'ice_breaking_game' | 'contextual_story' | 'collaborative_project' | 'environmental_learning' | 'educational_media' | 'all';
}

export interface LearningIdeaResult {
  topik: string;
  ideAktivitas: {
    namaAktivitas: string;
    kategori: string;
    deskripsi: string;
    alatBahan: string[];
    langkahPelaksanaan: string[];
    nilaiKarakter: string;
  }[];
  permainanEdukatif: {
    namaGame: string;
    aturanMain: string;
    manfaatBelajar: string;
  }[];
  ceritaKontekstual: {
    judulCerita: string;
    naskahCerita: string;
    pesanMoral: string;
    pertanyaanDiskusi: string[];
  };
  ideMediaLingkungan: {
    namaMedia: string;
    bahanSekitar: string[];
    caraMembuat: string;
    caraPenggunaan: string;
  }[];
  rawMarkdown?: string;
}

export interface TeacherReflectionRequest {
  subject: string;
  grade: string;
  topic: string;
  journalNotes: string; // Catatan guru / kendala saat KBM
  studentResponse: string; // Respon siswa
}

export interface TeacherReflectionResult {
  ringkasanKbm: string;
  identifikasiKendala: string[];
  analisisPenyebab: string[];
  alternatifSolusi: {
    area: string;
    rekomendasi: string;
  }[];
  rencanaPerbaikan: {
    langkah: string;
    waktuTarget: string;
    indikatorKeberhasilan: string;
  }[];
  rekomendasiPendekatanCinta: string;
  rawMarkdown?: string;
}

export interface LearningAnalysisRequest {
  subject: string;
  grade: string;
  topic: string;
  kktp: number;
  totalStudents: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passCount: number;
  remedialCount: number;
  passPercentage: number;
  unachievedObjectives: string[];
  commonMistakes?: string;
}

export interface LearningAnalysisResult {
  ringkasanStatistik: {
    rataRata: number;
    tuntasCount: number;
    belumTuntasCount: number;
    persentaseTuntas: number;
    statusKelas: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Pendampingan Khusus';
  };
  interpretasiKualitatif: string;
  analisisTujuanBelumTercapai: string[];
  rekomendasiRemedial: {
    kelompokSiswa: string;
    kegiatan: string;
    metode: string;
  }[];
  rekomendasiPengayaan: {
    kelompokSiswa: string;
    kegiatanTantangan: string;
  }[];
  narasiEvaluasiGuru: string;
  rawMarkdown?: string;
}

export interface PrincipalAssistantRequest {
  academicYear: string;
  semester: 'Ganjil' | 'Genap';
  periodType: 'tengah_semester' | 'akhir_semester' | 'bulanan';
  stats: {
    totalTeachers: number;
    compliancePercent: number; // Persentase kelengkapan perangkat
    avgStudentAttendance: number;
    supervisionCompletedCount: number;
    supervisionNeedFollowupCount: number;
    averageSchoolScore: number;
  };
  focusConcern?: string;
}

export interface PrincipalAssistantResult {
  periodeAnalisis: string;
  dasarDataDigunakan: string[];
  ringkasanEksekutif: string;
  analisisKehadiranSiswa: {
    kondisi: string;
    tren: string;
    rekomendasiTindakLanjut: string;
  };
  evaluasiAdministrasiGuru: {
    tingkatKepatuhan: string;
    catatanKelengkapan: string;
  };
  evaluasiSupervisiKbm: {
    aspekKuat: string[];
    aspekPerluPerbaikan: string[];
  };
  rekomendasiPeningkatanMutu: string[];
  poinArahanRapatDewanGuru: string[];
  batasanInterpretasi: string;
  rawMarkdown?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AIAuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  featureType: AIFeatureType;
  promptSummary: string;
  modelName: string;
  status: 'sukses' | 'gagal' | 'cached';
  durationMs: number;
  tokensUsed?: number;
  userFeedback?: 'puas' | 'cukup' | 'perlu_perbaikan' | null;
  createdAt: string;
}

export interface AIDocumentDraft {
  id: string;
  title: string;
  featureType: AIFeatureType;
  subject: string;
  grade: string;
  academicYear: string;
  semester: string;
  content: any;
  status: 'draft' | 'diajukan' | 'disetujui';
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}
