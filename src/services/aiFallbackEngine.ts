import {
  ModulAjarRequest,
  ModulAjarResult,
  LKPDRequest,
  LKPDResult,
  AssessmentQuestionRequest,
  AssessmentQuestionResult,
  LearningIdeaRequest,
  LearningIdeaResult,
  TeacherReflectionRequest,
  TeacherReflectionResult,
  LearningAnalysisRequest,
  LearningAnalysisResult,
  PrincipalAssistantRequest,
  PrincipalAssistantResult,
  ChatMessage,
} from '../types/ai.types';

export function buildModulAjarFallback(req: ModulAjarRequest): ModulAjarResult {
  const subject = req.subject || 'Bahasa Indonesia';
  const grade = req.grade || 'Kelas 4';
  const semester = req.semester || 'Ganjil';
  const academicYear = req.academicYear || '2026/2027';
  const topic = req.topic || 'Materi Pokok Pembelajaran';
  const timeAllocation = req.timeAllocation || '2 x 35 Menit (1 Pertemuan)';
  const faseLabel = /[12]/.test(grade) ? 'Fase A' : /[34]/.test(grade) ? 'Fase B' : 'Fase C';

  return {
    identitas: {
      madrasah: "MI Ma'arif Al Ihsan Soborejo",
      mataPelajaran: subject,
      faseKelas: `${grade} (${faseLabel})`,
      alokasiWaktu: timeAllocation,
      tahunAjaran: academicYear,
      semester,
      materiPokok: topic,
      penyusun: 'Tim Guru MI Ma’arif Al Ihsan Soborejo',
    },
    tujuanPembelajaran: [
      req.tp || `Peserta didik mampu memahami konsep utama ${topic} pada mata pelajaran ${subject} secara bermakna.`,
      `Peserta didik mampu mengaitkan materi ${topic} dengan pengalaman nyata di lingkungan madrasah serta menumbuhkan nilai kasih sayang dan akhlak mulia.`,
      `Peserta didik mampu menyajikan hasil eksplorasi atau karya terkait ${topic} secara mandiri dan kolaboratif.`,
    ],
    pemahamanBermakna: `Mempelajari ${topic} membantu peserta didik memahami manfaat ilmu pengetahuan dalam kehidupan sehari-hari sekaligus menumbuhkan rasa syukur, keteladanan, dan kepedulian terhadap sesama.`,
    pertanyaanPemantik: [
      `Pernahkah kalian menemui peristiwa atau contoh nyata yang berkaitan dengan ${topic} di sekitar madrasah atau rumah?`,
      `Mengapa memahami ${topic} sangat bermanfaat untuk kehidupan kita sehari-hari?`,
      `Bagaimana cara kita mempraktikkan sikap baik dan saling menghargai saat mempelajari materi ini bersama teman?`,
    ],
    kegiatanPembelajaran: {
      pendahuluan: {
        durasi: '10 Menit',
        langkah: [
          'Guru membuka pelajaran dengan salam santun, menyapa peserta didik dengan hangat, serta memimpin doa bersama.',
          'Guru mengecek kesiapan belajar dan suasana hati siswa melalui sapaan empatik.',
          `Apersepsi kontekstual: Guru mengaitkan pengalaman sehari-hari siswa dengan topik ${topic}.`,
          'Guru menyampaikan tujuan pembelajaran dan kesepakatan adab belajar bersama.',
        ],
      },
      inti: {
        durasi: '50 Menit',
        mindfulLearning: [
          `Siswa diajak menenangkan diri sejenak untuk memusatkan perhatian sebelum mengamati stimulus materi ${topic}.`,
          `Siswa mengamati contoh konkret, gambar, atau bacaan terkait ${topic} secara saksama dan mencatat poin penting.`,
        ],
        meaningfulLearning: [
          `Siswa berdiskusi dalam kelompok heterogen yang inklusif untuk memecahkan studi kasus kontekstual tentang ${topic}.`,
          'Guru berkeliling memberikan bimbingan bertahap (scaffolding) sesuai kebutuhan masing-masing kelompok.',
        ],
        joyfulLearning: [
          `Siswa mengikuti aktivitas permainan edukatif atau kartu konsep seputar ${topic} secara aktif dan gembira.`,
          'Perwakilan kelompok mempresentasikan hasil karya dan teman lain memberikan apresiasi positif.',
        ],
      },
      penutup: {
        durasi: '10 Menit',
        langkah: [
          `Guru bersama siswa menyimpulkan poin-poin inti pembelajaran ${topic}.`,
          'Refleksi singkat mengenai pemahaman dan perasaan siswa selama kegiatan belajar.',
          'Guru menyampaikan penguatan akhlak mulia, tindak lanjut pertemuan berikutnya, doa penutup, dan salam.',
        ],
      },
    },
    asesmen: {
      diagnostik: `Tanya jawab lisan di awal pelajaran untuk memetakan pemahaman awal siswa tentang ${topic}.`,
      formatif: 'Observasi keaktifan diskusi kelompok, sikap kolaboratif, dan ketepatan mengerjakan lembar aktivitas.',
      sumatif: `Latihan soal atau unjuk kerja di akhir lingkup materi ${topic} sesuai kriteria ketuntasan.`,
      rubrik: 'Penilaian 4 kategori (Perlu Bimbingan, Cukup, Baik, Sangat Baik) meliputi penguasaan konsep, keterampilan, dan adab belajar.',
    },
    diferensiasi: {
      konten: `Menyediakan bacaan bertahap, media visual bergambar, dan contoh konkret terkait ${topic}.`,
      proses: 'Kelompok yang membutuhkan pendampingan dibimbing secara intensif oleh guru, sedangkan siswa mahir diberi tantangan lanjutan.',
      produk: 'Peserta didik dapat menyajikan hasil belajar dalam bentuk tulisan ringkas, peta konsep, gambar, atau presentasi lisan.',
    },
    mediaSumber: [
      `Buku Teks ${subject} Kurikulum Merdeka (Kemendikbudristek / Kemenag RI)`,
      'Lembar Kerja Peserta Didik (LKPD) dan kartu aktivitas',
      'Benda konkret serta lingkungan sekitar MI Ma’arif Al Ihsan Soborejo',
    ],
    refleksi: {
      refleksiGuru: [
        'Apakah alokasi waktu pada tahap Mindful, Meaningful, dan Joyful Learning sudah berjalan seimbang?',
        'Siswa mana yang memerlukan pendampingan khusus pada pertemuan selanjutnya?',
        `Apakah media belajar yang digunakan efektif membantu pemahaman ${topic}?`,
      ],
      refleksiSiswa: [
        'Bagian kegiatan mana yang paling menyenangkan dan mudah kamu pahami hari ini?',
        'Hal baik apa yang kamu pelajari dari kerja sama dengan teman kelompokmu?',
        'Apakah masih ada bagian materi yang ingin kamu tanyakan lebih lanjut?',
      ],
    },
  };
}

export function buildLKPDFallback(req: LKPDRequest): LKPDResult {
  const subject = req.subject || 'Mata Pelajaran';
  const grade = req.grade || 'Kelas 4';
  const topic = req.topic || 'Eksplorasi Konsep';
  const lo = req.learningObjective || `Peserta didik mampu memahami dan menerapkan konsep ${topic}.`;

  return {
    judul: `LKPD ${subject} — ${topic}`,
    identitas: {
      mataPelajaran: subject,
      faseKelas: grade,
      alokasiWaktu: '2 x 35 Menit',
      kelompokAtauNama: req.activityType || 'Kelompok Kolaboratif',
    },
    tujuanKegiatan: [
      lo,
      `Melatih ketelitian, rasa ingin tahu, dan kerja sama penuh kasih sayang saat mempelajari ${topic}.`,
    ],
    petunjukPengerjaan: [
      'Awali kegiatan dengan membaca basmalah dan berdoa bersama.',
      'Bacalah setiap instruksi dan materi pengantar secara cermat.',
      'Diskusikan jawaban bersama anggota kelompok dengan saling menghargai pendapat.',
      'Tuliskan hasil pengamatan dan kesimpulan dengan rapi dan jujur.',
    ],
    materiSingkat: `Ringkasan Materi ${topic}: Konsep ini mempelajari pokok bahasan ${topic} pada ${subject} ${grade} yang dapat kita temukan penerapannya dalam kegiatan sehari-hari di madrasah dan rumah.`,
    aktivitasSiswa: [
      { tahap: '1. Amati (Mindful)', kegiatan: `Amati contoh nyata atau ilustrasi tentang ${topic} yang disajikan guru.` },
      { tahap: '2. Diskusikan (Meaningful)', kegiatan: `Catat temuan penting tentang ${topic} bersama kelompokmu.` },
      { tahap: '3. Sajikan (Joyful)', kegiatan: 'Presentasikan hasil diskusi kelompok secara percaya diri di depan kelas.' },
    ],
    pertanyaanTugas: [
      {
        nomor: 1,
        pertanyaan: `Jelaskan dengan bahasamu sendiri apa yang kamu ketahui tentang ${topic}!`,
        ruangJawabanType: 'garis',
        skorMaksimal: 25,
      },
      {
        nomor: 2,
        pertanyaan: `Tuliskan minimal 2 contoh penerapan ${topic} di lingkungan madrasah atau rumah!`,
        ruangJawabanType: 'tabel',
        skorMaksimal: 35,
      },
      {
        nomor: 3,
        pertanyaan: `Bagaimana sikap teladan dan kasih sayang yang dapat kita tunjukkan saat mempraktikkan materi ${topic}?`,
        ruangJawabanType: 'garis',
        skorMaksimal: 40,
      },
    ],
    lembarRefleksiSiswa: 'Lingkari perasaanmu setelah mengerjakan LKPD ini (Sangat Senang / Senang / Perlu Bimbingan) dan tuliskan satu hal baru yang kamu pelajari hari ini.',
    kriteriaPenilaian: [
      { aspek: 'Ketepatan Konsep', kriteria: `Jawaban sesuai dengan tujuan pembelajaran ${topic}`, skor: 40 },
      { aspek: 'Penalaran & Contoh', kriteria: 'Mampu memberi contoh nyata yang relevan', skor: 35 },
      { aspek: 'Kerjasama & Adab', kriteria: 'Santun, aktif, dan menghargai teman kelompok', skor: 25 },
    ],
  };
}

export function buildAssessmentFallback(req: AssessmentQuestionRequest): AssessmentQuestionResult {
  const subject = req.subject || 'Mata Pelajaran';
  const grade = req.grade || 'Kelas 4';
  const topic = req.topic || 'Materi Pembelajaran';
  const count = Math.min(Math.max(Number(req.questionCount) || 5, 1), 20);
  const weight = Math.round(100 / count);

  const kisiKisi = Array.from({ length: count }, (_, idx) => ({
    nomor: idx + 1,
    tp: req.learningObjective || `Memahami konsep ${topic}`,
    materi: topic,
    indikator: `Disajikan permasalahan kontekstual tentang ${topic}, peserta didik mampu menentukan penyelesaian yang tepat (Butir ${idx + 1}).`,
    levelKognitif: idx % 3 === 0 ? 'L1 (Pemahaman)' : idx % 3 === 1 ? 'L2 (Aplikasi)' : 'L3 (Penalaran)',
    bentukSoal: idx % 2 === 0 ? 'Pilihan Ganda' : 'Uraian Singkat',
    nomorSoal: idx + 1,
  }));

  const daftarSoal = Array.from({ length: count }, (_, idx) => {
    const isPg = idx % 2 === 0;
    return isPg
      ? {
          nomor: idx + 1,
          bentuk: 'Pilihan Ganda',
          stimulus: `Perhatikan situasi pembelajaran ${subject} mengenai ${topic} berikut ini.`,
          pertanyaan: `Manakah pernyataan yang paling tepat mengenai penerapan konsep ${topic} pada butir soal nomor ${idx + 1}?`,
          pilihan: [
            `A. Menerapkan konsep ${topic} secara tepat dan penuh tanggung jawab`,
            `B. Mengabaikan aturan dasar pada ${topic}`,
            `C. Menggunakan cara yang tidak sesuai dengan prinsip ${topic}`,
            `D. Menunda penyelesaian tanpa melakukan pengamatan`,
          ],
          kunciJawaban: 'A',
          pembahasan: `Penerapan ${topic} yang tepat ditunjukkan oleh pilihan A sesuai prinsip pembelajaran bermakna.`,
          bobotSkor: weight,
        }
      : {
          nomor: idx + 1,
          bentuk: 'Uraian',
          stimulus: `Dalam kegiatan sehari-hari di madrasah, siswa sering menjumpai hal yang berkaitan dengan ${topic}.`,
          pertanyaan: `Jelaskan secara singkat langkah yang tepat untuk memahami atau menerapkan ${topic} dalam kehidupan sehari-hari!`,
          kunciJawaban: `Mengidentifikasi konsep inti ${topic}, menghubungkan dengan contoh nyata, serta mempraktikkannya dengan sikap santun dan teliti.`,
          pembahasan: 'Jawaban dinilai berdasarkan ketepatan konsep inti dan relevansi contoh nyata yang dituliskan siswa.',
          bobotSkor: weight,
        };
  });

  return {
    judulAsesmen: `Asesmen ${subject} — ${topic}`,
    mataPelajaran: subject,
    faseKelas: grade,
    kisiKisi: req.includeGrid ? kisiKisi : [],
    daftarSoal,
    pedomanPenskoran: {
      rumusNilai: 'Nilai Akhir = (Skor Perolehan / Skor Maksimal) x 100',
      rubrik: req.includeRubric
        ? [
            { kriteria: 'Sangat Baik (90–100)', skor: 'Menguasai seluruh konsep dan mampu memberi contoh kontekstual secara tepat' },
            { kriteria: 'Baik (75–89)', skor: 'Memahami konsep inti dengan benar dan sedikit kekeliruan minor' },
            { kriteria: 'Perlu Bimbingan (<75)', skor: 'Membutuhkan pendampingan ulang pada konsep dasar' },
          ]
        : [],
    },
  };
}

export function buildLearningIdeasFallback(req: LearningIdeaRequest): LearningIdeaResult {
  const topic = req.topic || 'Materi Pembelajaran';
  return {
    topik: topic,
    ideAktivitas: [
      {
        namaAktivitas: `Eksplorasi Kontekstual ${topic}`,
        kategori: req.category || 'all',
        deskripsi: `Aktivitas belajar aktif untuk ${req.subject} ${req.grade} yang menghubungkan materi ${topic} dengan benda nyata di sekitar madrasah.`,
        alatBahan: ['Kartu konsep warna-warni', 'Kertas plano / buku tulis', 'Benda konkret sekitar kelas'],
        langkahPelaksanaan: [
          `Guru membagi siswa menjadi kelompok kecil dan membagikan kartu tantangan bertema ${topic}.`,
          'Siswa berdiskusi dan menyusun temuan mereka secara kolaboratif.',
          'Kelompok saling berkunjung (Gallery Walk) dan memberi apresiasi.',
        ],
        nilaiKarakter: 'Gotong royong, rasa ingin tahu, saling menghargai, dan keteladanan.',
      },
    ],
    permainanEdukatif: [
      {
        namaGame: `Estafet Kartu ${topic}`,
        aturanMain: 'Setiap kelompok mencocokkan kartu soal dan kartu jawaban secara bergantian selama 5 menit dengan tertib.',
        manfaatBelajar: `Menguatkan daya ingat dan pemahaman konsep ${topic} secara menyenangkan.`,
      },
    ],
    ceritaKontekstual: {
      judulCerita: `Belajar ${topic} di Halaman Madrasah`,
      naskahCerita: `Suatu pagi di MI Ma'arif Al Ihsan Soborejo, para siswa kelas ${req.grade} belajar bersama tentang ${topic}. Dengan saling membantu dan mendengarkan pendapat teman, mereka menemukan bahwa belajar terasa jauh lebih mudah dan menyenangkan.`,
      pesanMoral: 'Ilmu menjadi berkah ketika dipelajari dengan kerendahan hati dan sikap tolong-menolong.',
      pertanyaanDiskusi: [
        `Apa pelajaran penting yang ditemukan para tokoh terkait ${topic}?`,
        'Bagaimana sikap yang baik saat berdiskusi bersama teman?',
      ],
    },
    ideMediaLingkungan: [
      {
        namaMedia: `Papan Pintar ${topic}`,
        bahanSekitar: ['Kardus bekas', 'Kertas origami', 'Spidol'],
        caraMembuat: 'Tempelkan kertas warna pada kardus sebagai papan kategori, lalu buat kartu kata/gambar kecil.',
        caraPenggunaan: `Siswa menempelkan kartu sesuai konsep ${topic} secara berkelompok di depan kelas.`,
      },
    ],
  };
}

export function buildTeacherReflectionFallback(req: TeacherReflectionRequest): TeacherReflectionResult {
  return {
    ringkasanKbm: `Pembelajaran ${req.subject} (${req.grade}) pada topik "${req.topic}" telah terlaksana dengan catatan utama: ${req.journalNotes || 'siswa mengikuti kegiatan pembelajaran dengan cukup baik'}.`,
    identifikasiKendala: [
      req.journalNotes || 'Sebagian siswa masih memerlukan bimbingan visual untuk memahami konsep inti.',
      req.studentResponse || 'Keaktifan siswa belum merata di seluruh kelompok belajar.',
    ],
    analisisPenyebab: [
      'Keberagaman gaya belajar dan kecepatan pemahaman antarpeserta didik.',
      'Perlunya variasi aktivitas konkret sebelum masuk ke latihan soal abstrak.',
    ],
    alternatifSolusi: [
      {
        area: 'Strategi Scaffolding',
        rekomendasi: `Sediakan contoh langkah demi langkah menggunakan media visual konkret pada awal materi ${req.topic}.`,
      },
      {
        area: 'Diferensiasi Kelompok',
        rekomendasi: 'Bentuk kelompok tutor sebaya yang inklusif agar siswa yang cepat paham dapat mendampingi temannya dengan penuh kasih.',
      },
    ],
    rencanaPerbaikan: [
      {
        langkah: 'Menyiapkan kartu bantu belajar & apersepsi 5 menit di awal pertemuan berikutnya',
        waktuTarget: 'Pertemuan berikutnya',
        indikatorKeberhasilan: 'Minimal 85% siswa aktif menjawab pertanyaan pemantik dan menyelesaikan tugas.',
      },
    ],
    rekomendasiPendekatanCinta: 'Awali pembelajaran dengan afirmasi positif dan peluk/sapa hangat secara moral bahwa setiap anak memiliki keunikan dan waktu bertumbuhnya masing-masing.',
  };
}

export function buildLearningAnalysisFallback(req: LearningAnalysisRequest): LearningAnalysisResult {
  const passPct = Number(req.passPercentage) || 0;
  const statusKelas: LearningAnalysisResult['ringkasanStatistik']['statusKelas'] =
    passPct >= 85
      ? 'Sangat Baik'
      : passPct >= 70
      ? 'Baik'
      : passPct >= 55
      ? 'Cukup'
      : 'Perlu Pendampingan Khusus';

  return {
    ringkasanStatistik: {
      rataRata: Number(req.averageScore) || 0,
      tuntasCount: Number(req.passCount) || 0,
      belumTuntasCount: Number(req.remedialCount) || 0,
      persentaseTuntas: passPct,
      statusKelas,
    },
    interpretasiKualitatif: `Dari ${req.totalStudents} siswa pada mata pelajaran ${req.subject} (${req.grade}) materi ${req.topic}, diperoleh rata-rata kelas ${req.averageScore} dengan ketuntasan ${passPct}% terhadap KKTP ${req.kktp}.`,
    analisisTujuanBelumTercapai:
      req.unachievedObjectives && req.unachievedObjectives.length > 0
        ? req.unachievedObjectives
        : [`Pendalaman konsep ${req.topic} pada soal aplikasi kontekstual`],
    rekomendasiRemedial: [
      {
        kelompokSiswa: `${req.remedialCount} siswa di bawah KKTP (${req.kktp})`,
        kegiatan: `Bimbingan ulang terstruktur materi ${req.topic} menggunakan contoh konkret dan latihan bertahap.`,
        metode: 'Bimbingan kelompok kecil (small group coaching) & tutor sebaya',
      },
    ],
    rekomendasiPengayaan: [
      {
        kelompokSiswa: `${req.passCount} siswa tuntas (>= ${req.kktp})`,
        kegiatanTantangan: `Proyek mini pemecahan masalah atau soal pengayaan HOTS seputar ${req.topic}.`,
      },
    ],
    narasiEvaluasiGuru: `Secara umum pembelajaran ${req.topic} berada pada kategori ${statusKelas}. Siswa yang belum tuntas akan didampingi melalui pembelajaran ulang yang ramah dan bertahap, sementara siswa tuntas diberi pengayaan kontekstual.`,
  };
}

export function buildPrincipalAssistantFallback(req: PrincipalAssistantRequest): PrincipalAssistantResult {
  return {
    periodeAnalisis: `Periode ${req.periodType.replace('_', ' ')} — Semester ${req.semester} (${req.academicYear})`,
    dasarDataDigunakan: [
      `Jumlah Tenaga Pendidik: ${req.stats.totalTeachers} guru`,
      `Kepatuhan Perangkat Pembelajaran: ${req.stats.compliancePercent}%`,
      `Rata-rata Kehadiran Siswa: ${req.stats.avgStudentAttendance}%`,
      `Supervisi KBM Selesai: ${req.stats.supervisionCompletedCount} | Tindak Lanjut: ${req.stats.supervisionNeedFollowupCount}`,
      `Rata-rata Nilai Akademik Madrasah: ${req.stats.averageSchoolScore}`,
    ],
    ringkasanEksekutif: `Mutu pembelajaran semester ${req.semester} (${req.academicYear}) menunjukkan capaian kepatuhan perangkat ${req.stats.compliancePercent}% dan rata-rata kehadiran siswa ${req.stats.avgStudentAttendance}%, dengan rata-rata nilai madrasah ${req.stats.averageSchoolScore}.`,
    analisisKehadiranSiswa: {
      kondisi: `Kehadiran rata-rata siswa tercatat sebesar ${req.stats.avgStudentAttendance}%.`,
      tren: req.stats.avgStudentAttendance >= 90 ? 'Stabil baik dan kondusif' : 'Perlu pemantauan intensif di beberapa rombel',
      rekomendasiTindakLanjut: 'Koordinasikan wali kelas untuk melakukan komunikasi hangat kepada orang tua bagi siswa yang sering izin atau alpa.',
    },
    evaluasiAdministrasiGuru: {
      tingkatKepatuhan: `${req.stats.compliancePercent}% perangkat telah diunggah/disusun`,
      catatanKelengkapan: 'Dorong guru pengampu melengkapi perangkat CP, TP, ATP, Modul Ajar, serta asesmen lingkup materi secara berkala.',
    },
    evaluasiSupervisiKbm: {
      aspekKuat: ['Kedisiplinan pembukaan dan penutupan KBM bernuansa islami', 'Interaksi penuh kasih sayang di kelas'],
      aspekPerluPerbaikan: [
        `${req.stats.supervisionNeedFollowupCount} guru memerlukan penguatan tindak lanjut supervisi pada diferensiasi proses dan asesmen formatif`,
      ],
    },
    rekomendasiPeningkatanMutu: [
      'Laksanakan pendampingan KKG internal madrasah untuk berbagi praktik baik pembelajaran mendalam.',
      'Jadwalkan supervisi klinis lanjutan bagi guru yang membutuhkan dukungan penyusunan asesmen HOTS.',
    ],
    poinArahanRapatDewanGuru: [
      'Apresiasi kepada guru yang telah melengkapi perangkat dan jurnal KBM tepat waktu.',
      'Komitmen bersama menjaga kehadiran siswa serta penguatan karakter Kurikulum Berbasis Cinta.',
      req.focusConcern ? `Fokus khusus: ${req.focusConcern}` : 'Sinergi wali kelas dan guru mapel menjelang asesmen sumatif.',
    ],
    batasanInterpretasi: 'Ringkasan ini disusun berdasarkan data operasional madrasah yang tercatat dalam sistem pada saat analisis dilakukan.',
  };
}

export function buildChatFallback(messages: { role: 'user' | 'assistant'; content: string }[]): ChatMessage {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  return {
    id: `msg-${Date.now()}`,
    role: 'assistant',
    content: `Terima kasih atas pertanyaan Anda mengenai "${lastUserMsg.slice(0, 120)}".\n\nBerikut panduan praktis untuk pembelajaran di MI Ma'arif Al Ihsan Soborejo:\n1. **Keterkaitan Kurikulum Merdeka & KBC**: Pastikan tujuan pembelajaran terukur (ABCD/kompetensi + materi) dan disisipi nilai keteladanan serta kasih sayang.\n2. **Pendekatan Deep Learning**: Rancang langkah Mindful (kesadaran penuh), Meaningful (bermakna kontekstual), dan Joyful (menggembirakan).\n3. **Tindak Lanjut Asesmen**: Gunakan hasil asesmen formatif untuk memetakan siswa yang perlu pendampingan bertahap maupun pengayaan.\n\nAnda juga dapat langsung memakai tab **Modul Ajar**, **LKPD**, atau **Bank Soal** di halaman ini untuk menghasilkan dokumen terstruktur yang siap diekspor.`,
    timestamp: new Date().toISOString(),
  };
}
