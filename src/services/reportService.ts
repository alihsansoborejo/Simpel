import { Student, ClassRoom, Subject, ClassMember } from '../types/database.types';
import { academicService } from './academicService';
import { DEMO_STUDENTS, DEMO_SUBJECTS, DEMO_CLASSES } from '../lib/demoData';

export interface StudentSubjectScore {
  studentId: string;
  studentName: string;
  nis: string;
  lmScores: {
    lm1: number;
    lm2: number;
    lm3: number;
    lm4: number;
  };
  avgLm: number;
  stsScore: number;
  sasScore: number;
  finalScore: number;
  predicate: 'A' | 'B' | 'C' | 'D';
  highestCompetency: string;
  lowestCompetency: string;
}

export interface ClassLegerRow {
  studentId: string;
  studentName: string;
  nis: string;
  subjectScores: Record<string, number>; // subject_id -> final score
  totalScore: number;
  averageScore: number;
  rank: number;
}

const STORAGE_KEYS = {
  SUBJECT_LEDGER: 'simpel_subject_ledger_v1',
  REPORT_LOCKS: 'simpel_report_card_locks_v1',
};

function getLocal<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to store ${key}:`, err);
  }
}

export const reportService = {
  // Hitung Nilai Akhir & Predikat
  calculateFinalScore(lm: { lm1: number; lm2: number; lm3: number; lm4: number }, sts: number, sas: number): {
    avgLm: number;
    finalScore: number;
    predicate: 'A' | 'B' | 'C' | 'D';
  } {
    const avgLm = Math.round((lm.lm1 + lm.lm2 + lm.lm3 + lm.lm4) / 4);
    // Formula Kurikulum Merdeka Madrasah: (2 * RataLM + STS + SAS) / 4
    const finalScore = Math.round((avgLm * 2 + sts + sas) / 4);

    let predicate: 'A' | 'B' | 'C' | 'D' = 'B';
    if (finalScore >= 91) predicate = 'A';
    else if (finalScore >= 81) predicate = 'B';
    else if (finalScore >= 75) predicate = 'C';
    else predicate = 'D';

    return { avgLm, finalScore, predicate };
  },

  // Dapatkan Leger Per Mata Pelajaran
  async getSubjectLedger(classId: string, subjectId: string): Promise<StudentSubjectScore[]> {
    const key = `${classId}_${subjectId}`;
    const allStore = getLocal<Record<string, StudentSubjectScore[]>>(STORAGE_KEYS.SUBJECT_LEDGER, {});

    if (allStore[key] && allStore[key].length > 0) {
      return allStore[key];
    }

    // Buat data awal terintegrasi dari siswa rombel
    const [students, members, subjects] = await Promise.all([
      academicService.getStudents(),
      academicService.getClassMembers(classId),
      academicService.getSubjects(),
    ]);

    const enrolledIds = members.map((m) => m.student_id);
    const pool = students.filter((s) => enrolledIds.includes(s.id));

    if (pool.length === 0) {
      return [];
    }

    const currentSubject = subjects.find((s) => s.id === subjectId) || DEMO_SUBJECTS[6];

    // Seed data nilai dengan variasi realistis sesuai KKTP 75
    const initialScores: StudentSubjectScore[] = pool.map((s, idx) => {
      // Variasi nilai berbasis nomor urut
      const base = 82 + ((idx * 3) % 14);
      const lm1 = Math.min(96, Math.max(70, base + (idx % 2 === 0 ? 3 : -2)));
      const lm2 = Math.min(98, Math.max(68, base + (idx % 3 === 0 ? 4 : -4)));
      const lm3 = Math.min(95, Math.max(72, base + (idx % 2 === 1 ? 2 : 1)));
      const lm4 = Math.min(97, Math.max(70, base + 2));
      const sts = Math.min(95, Math.max(70, base - (idx % 2 === 0 ? 1 : 3)));
      const sas = Math.min(98, Math.max(72, base + (idx % 2 === 0 ? 4 : 0)));

      const { avgLm, finalScore, predicate } = this.calculateFinalScore(
        { lm1, lm2, lm3, lm4 },
        sts,
        sas
      );

      const highDesc = `Menunjukkan penguasaan sangat baik dalam memahami konsep pokok materi ${currentSubject.name} dan penerapan budi pekerti kasih sayang.`;
      const lowDesc =
        finalScore < 80
          ? `Perlu pendampingan dan latihan mandiri lebih intensif dalam penguatan pemahaman evaluasi ${currentSubject.name}.`
          : `Mampu mengoptimalkan penalaran kritis dengan bimbingan bertahap pada materi lanjutan.`;

      return {
        studentId: s.id,
        studentName: s.full_name,
        nis: s.nis,
        lmScores: { lm1, lm2, lm3, lm4 },
        avgLm,
        stsScore: sts,
        sasScore: sas,
        finalScore,
        predicate,
        highestCompetency: highDesc,
        lowestCompetency: lowDesc,
      };
    });

    allStore[key] = initialScores;
    setLocal(STORAGE_KEYS.SUBJECT_LEDGER, allStore);
    return initialScores;
  },

  async saveSubjectLedger(
    classId: string,
    subjectId: string,
    scores: StudentSubjectScore[]
  ): Promise<void> {
    const key = `${classId}_${subjectId}`;
    const allStore = getLocal<Record<string, StudentSubjectScore[]>>(STORAGE_KEYS.SUBJECT_LEDGER, {});
    allStore[key] = scores;
    setLocal(STORAGE_KEYS.SUBJECT_LEDGER, allStore);
  },

  // Leger Kompilasi Seluruh Mapel dalam Satu Rombel Kelas
  async getClassOverallLedger(classId: string): Promise<{
    subjects: Subject[];
    rows: ClassLegerRow[];
  }> {
    const [subjects, students, members] = await Promise.all([
      academicService.getSubjects(),
      academicService.getStudents(),
      academicService.getClassMembers(classId),
    ]);

    const enrolledIds = members.map((m) => m.student_id);
    const pool = students.filter((s) => enrolledIds.includes(s.id));

    if (pool.length === 0) {
      return { subjects, rows: [] };
    }

    // Ambil data nilai per mapel
    const subjectLedgers: Record<string, StudentSubjectScore[]> = {};
    for (const sbj of subjects) {
      subjectLedgers[sbj.id] = await this.getSubjectLedger(classId, sbj.id);
    }

    const rows: ClassLegerRow[] = pool.map((s) => {
      const subjectScores: Record<string, number> = {};
      let total = 0;

      subjects.forEach((sbj) => {
        const studentScore = subjectLedgers[sbj.id]?.find((entry) => entry.studentId === s.id);
        const score = studentScore ? studentScore.finalScore : 80;
        subjectScores[sbj.id] = score;
        total += score;
      });

      const avg = subjects.length > 0 ? Math.round((total / subjects.length) * 10) / 10 : 0;

      return {
        studentId: s.id,
        studentName: s.full_name,
        nis: s.nis,
        subjectScores,
        totalScore: total,
        averageScore: avg,
        rank: 1, // Akan dihitung setelah disortir
      };
    });

    // Urutkan berdasarkan total nilai untuk peringkat
    rows.sort((a, b) => b.totalScore - a.totalScore);
    rows.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return { subjects, rows };
  },

  // Kunci Rapor
  isReportCardLocked(classId: string): boolean {
    const locks = getLocal<Record<string, boolean>>(STORAGE_KEYS.REPORT_LOCKS, {});
    return Boolean(locks[classId]);
  },

  setReportCardLock(classId: string, locked: boolean): void {
    const locks = getLocal<Record<string, boolean>>(STORAGE_KEYS.REPORT_LOCKS, {});
    locks[classId] = locked;
    setLocal(STORAGE_KEYS.REPORT_LOCKS, locks);
  },
};
