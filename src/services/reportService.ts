import { supabase, isSupabaseAvailable, reportSupabaseOutcome } from '../lib/supabaseClient';
import { DEMO_ASSESSMENTS, DEMO_GRADES, DEMO_REMEDIAL } from '../lib/demoData';
import { Assessment, Grade, RemedialRecord, Subject } from '../types/database.types';
import { academicService } from './academicService';
import { curriculumWorkspaceService } from './curriculumWorkspaceService';

export type LedgerSlot = 'lm1' | 'lm2' | 'lm3' | 'lm4' | 'stsScore' | 'sasScore';

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
  isDescriptionCustom?: boolean;
  manualEditedAt?: string;
  manualEditedSlots?: Partial<Record<LedgerSlot, string>>;
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
  ASSESSMENTS: 'simpel_assessments',
  GRADES: 'simpel_grades',
  REMEDIAL: 'simpel_remedial',
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

function emitLedgerSync(keys: string[]): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('simpel:remote-sync', { detail: { keys } }));
}

function maxTimestamp(...values: Array<string | null | undefined>): string {
  let best = '';
  let bestMs = 0;
  for (const v of values) {
    if (!v) continue;
    const ms = Date.parse(v);
    if (!Number.isNaN(ms) && ms >= bestMs) {
      bestMs = ms;
      best = v;
    } else if (!best) {
      best = v;
    }
  }
  return best || new Date().toISOString();
}

async function loadMergedAssessmentSources(): Promise<{
  assessments: Assessment[];
  grades: Grade[];
  remedials: RemedialRecord[];
}> {
  const localAssessments = getLocal<Assessment[]>(STORAGE_KEYS.ASSESSMENTS, DEMO_ASSESSMENTS);
  const localGrades = getLocal<Grade[]>(STORAGE_KEYS.GRADES, DEMO_GRADES);
  const localRemedials = getLocal<RemedialRecord[]>(STORAGE_KEYS.REMEDIAL, DEMO_REMEDIAL);

  if (!isSupabaseAvailable()) {
    return {
      assessments: localAssessments,
      grades: localGrades,
      remedials: localRemedials,
    };
  }

  let assessments = [...localAssessments];
  let grades = [...localGrades];
  let remedials = [...localRemedials];

  try {
    const [asmRes, grdRes, remRes] = await Promise.allSettled([
      supabase.from('assessments').select('*, assignment:teaching_assignments(*)'),
      supabase.from('grades').select('*'),
      supabase.from('remedial_records').select('*'),
    ]);

    const firstSupabaseErr =
      (asmRes.status === 'fulfilled' ? asmRes.value.error : asmRes.reason) ||
      (grdRes.status === 'fulfilled' ? grdRes.value.error : grdRes.reason) ||
      (remRes.status === 'fulfilled' ? remRes.value.error : remRes.reason) ||
      null;
    reportSupabaseOutcome(firstSupabaseErr);

    if (asmRes.status === 'fulfilled' && !asmRes.value.error && Array.isArray(asmRes.value.data)) {
      const localById = new Map(localAssessments.map((a) => [a.id, a]));
      const byId = new Map<string, Assessment>();
      for (const a of localAssessments) byId.set(a.id, a);
      for (const ra of asmRes.value.data as Assessment[]) {
        const lm = localById.get(ra.id);
        byId.set(ra.id, {
          ...ra,
          scope_key: ra.scope_key ?? lm?.scope_key ?? null,
          assignment: ra.assignment || lm?.assignment,
        });
      }
      assessments = Array.from(byId.values());
    }

    if (grdRes.status === 'fulfilled' && !grdRes.value.error && Array.isArray(grdRes.value.data)) {
      const byKey = new Map<string, Grade>();
      for (const lg of localGrades) {
        byKey.set(`${lg.assessment_id}__${lg.student_id}`, lg);
      }
      for (const rg of grdRes.value.data as Grade[]) {
        const key = `${rg.assessment_id}__${rg.student_id}`;
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, rg);
        } else {
          const rMs = Date.parse(rg.updated_at || rg.created_at || '') || 0;
          const lMs = Date.parse(existing.updated_at || existing.created_at || '') || 0;
          if (rMs >= lMs) {
            byKey.set(key, rg);
          }
        }
      }
      grades = Array.from(byKey.values());
    }

    if (remRes.status === 'fulfilled' && !remRes.value.error && Array.isArray(remRes.value.data)) {
      const byId = new Map<string, RemedialRecord>();
      for (const lr of localRemedials) byId.set(lr.id, lr);
      for (const rr of remRes.value.data as RemedialRecord[]) {
        const existing = byId.get(rr.id);
        if (!existing) {
          byId.set(rr.id, rr);
        } else {
          const rMs = Date.parse((rr as RemedialRecord & { updated_at?: string }).updated_at || rr.created_at || '') || 0;
          const lMs = Date.parse((existing as RemedialRecord & { updated_at?: string }).updated_at || existing.created_at || '') || 0;
          if (rMs >= lMs || (existing.score_after === null && rr.score_after !== null)) {
            byId.set(rr.id, {
              ...existing,
              ...rr,
              assessment_id: rr.assessment_id ?? existing.assessment_id ?? null,
              scope_key: rr.scope_key ?? existing.scope_key ?? null,
            });
          }
        }
      }
      remedials = Array.from(byId.values());
    }
  } catch (err) {
    reportSupabaseOutcome(err);
    console.warn('Supabase loadMergedAssessmentSources fallback:', err);
  }

  return { assessments, grades, remedials };
}

function formatCompetencyPhrase(rawText: string, fallback: string): string {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/\.+$/, '');
  if (!cleaned) return fallback;

  // Jika berawalan kata benda/judul bab seperti "Bab 1:", "Materi ", "Lingkup Materi ", awali dengan "materi "
  if (/^(Bab|Materi|Lingkup Materi|Unit)\b/i.test(cleaned)) {
    return `materi ${cleaned}`;
  }

  // Kecilkan huruf pertama jika berupa kata kerja operasional TP agar menyatu dalam kalimat
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}

export interface CompetencyDescriptionParams {
  subjectId?: string;
  subjectName: string;
  classLevel?: number;
  lmScores: { lm1: number; lm2: number; lm3: number; lm4: number };
  stsScore: number;
  sasScore: number;
  finalScore: number;
  kktp?: number;
}

function buildCompetencyDescriptions(params: CompetencyDescriptionParams): {
  highestCompetency: string;
  lowestCompetency: string;
} {
  const {
    subjectId,
    subjectName,
    classLevel = 4,
    lmScores,
    stsScore,
    sasScore,
    finalScore,
    kktp = 75,
  } = params;

  const lmConfigs = subjectId
    ? curriculumWorkspaceService
        .getLingkupMateriList(subjectId, classLevel)
        .filter((s) => !s.is_special_summative && s.scope_key !== 'STS' && s.scope_key !== 'SAS')
    : [];
  const tpItems = subjectId
    ? curriculumWorkspaceService
        .getTPList()
        .filter((tp) => tp.subject_id === subjectId && tp.class_level === classLevel)
    : [];

  const getLmPhrase = (index: number): string => {
    const scopeKey = `LM${index + 1}`;
    const cfg = lmConfigs.find((c) => c.scope_key.toUpperCase() === scopeKey) || lmConfigs[index];
    const tpCode = cfg?.associated_tps?.[0];
    const matchedTp =
      (tpCode ? tpItems.find((t) => t.code === tpCode) : undefined) || tpItems[index];

    if (matchedTp?.description) {
      return formatCompetencyPhrase(
        matchedTp.description,
        `materi Lingkup Materi ${index + 1} ${subjectName}`
      );
    }
    if (cfg?.title && !/^Lingkup Materi \d+ \(Kelas \d+\)$/i.test(cfg.title.trim())) {
      return formatCompetencyPhrase(
        cfg.title,
        `materi Lingkup Materi ${index + 1} ${subjectName}`
      );
    }
    return `materi Lingkup Materi ${index + 1} ${subjectName}`;
  };

  const lmEntries = (
    [
      { code: 'LM 1', score: Number(lmScores.lm1) || 0, phrase: getLmPhrase(0) },
      { code: 'LM 2', score: Number(lmScores.lm2) || 0, phrase: getLmPhrase(1) },
      { code: 'LM 3', score: Number(lmScores.lm3) || 0, phrase: getLmPhrase(2) },
      { code: 'LM 4', score: Number(lmScores.lm4) || 0, phrase: getLmPhrase(3) },
    ] as const
  ).filter((e) => e.score > 0);

  const stsNum = Number(stsScore) || 0;
  const sasNum = Number(sasScore) || 0;
  const examEntries = [
    ...(stsNum > 0
      ? [{ code: 'STS', score: stsNum, phrase: `evaluasi Sumatif Tengah Semester ${subjectName}` }]
      : []),
    ...(sasNum > 0
      ? [{ code: 'SAS', score: sasNum, phrase: `evaluasi Sumatif Akhir Semester ${subjectName}` }]
      : []),
  ];

  const allAssessed = [...lmEntries, ...examEntries];

  if (allAssessed.length === 0 && finalScore <= 0) {
    return {
      highestCompetency: `Belum ada nilai asesmen yang tercatat pada mata pelajaran ${subjectName}.`,
      lowestCompetency: `Menunggu pengisian nilai Sumatif Lingkup Materi, STS, dan SAS.`,
    };
  }

  const primaryPool = lmEntries.length > 0 ? lmEntries : allAssessed;
  const sortedPrimaryDesc = [...primaryPool].sort((a, b) => b.score - a.score);
  const sortedAllDesc = [...allAssessed].sort((a, b) => b.score - a.score);
  const best = sortedPrimaryDesc[0] || {
    code: 'NA',
    score: finalScore,
    phrase: `materi pokok ${subjectName}`,
  };
  const worst = sortedPrimaryDesc[sortedPrimaryDesc.length - 1] || best;

  let highestCompetency: string;
  if (best.score >= kktp) {
    const levelLabel =
      best.score >= 90 ? 'sangat baik' : best.score >= Math.max(kktp + 6, 81) ? 'baik' : 'cukup baik';
    const tiedBest = sortedPrimaryDesc.filter((e) => e.score === best.score);
    if (tiedBest.length > 1 && tiedBest.length <= 2) {
      highestCompetency = `Menunjukkan penguasaan ${levelLabel} dalam ${tiedBest[0].phrase} (${tiedBest[0].code}: ${tiedBest[0].score}) serta ${tiedBest[1].phrase} (${tiedBest[1].code}: ${tiedBest[1].score}; Nilai Akhir: ${finalScore}).`;
    } else {
      highestCompetency = `Menunjukkan penguasaan ${levelLabel} dalam ${best.phrase} (${best.code}: ${best.score}; Nilai Akhir: ${finalScore}).`;
    }
  } else {
    highestCompetency = `Mulai memahami dasar ${best.phrase} (${best.code}: ${best.score}), namun capaian masih di bawah KKTP ${kktp} (Nilai Akhir: ${finalScore}).`;
  }

  const belowKktpAll = [...allAssessed]
    .filter((e) => e.score < kktp)
    .sort((a, b) => a.score - b.score);

  let lowestCompetency: string;
  if (belowKktpAll.length > 0) {
    const lowestItem = belowKktpAll[0];
    const summaryCodes = belowKktpAll
      .slice(0, 3)
      .map((e) => `${e.code}: ${e.score}`)
      .join(', ');
    lowestCompetency =
      belowKktpAll.length === 1
        ? `Perlu pendampingan dan program remedial pada ${lowestItem.phrase} (${lowestItem.code}: ${lowestItem.score}, di bawah KKTP ${kktp}).`
        : `Perlu pendampingan intensif dan remedial khususnya pada ${lowestItem.phrase} (${summaryCodes}; di bawah KKTP ${kktp}).`;
  } else if (sortedPrimaryDesc.length >= 2 && worst.score < best.score) {
    lowestCompetency =
      worst.score >= 90
        ? `Seluruh kompetensi telah tuntas sangat baik; pertahankan ketelitian dan pengayaan pada ${worst.phrase} (${worst.code}: ${worst.score}).`
        : worst.score >= Math.max(kktp + 6, 81)
        ? `Perlu latihan pengayaan mandiri agar capaian pada ${worst.phrase} (${worst.code}: ${worst.score}) semakin optimal.`
        : `Perlu penguatan latihan terarah pada ${worst.phrase} (${worst.code}: ${worst.score}) agar ketuntasan semakin mantap.`;
  } else {
    const lowestExamOrAll = sortedAllDesc[sortedAllDesc.length - 1] || best;
    if (lowestExamOrAll.score < best.score) {
      lowestCompetency = `Perlu penguatan latihan mandiri pada ${lowestExamOrAll.phrase} (${lowestExamOrAll.code}: ${lowestExamOrAll.score}).`;
    } else if (finalScore >= 90) {
      lowestCompetency = `Pertahankan prestasi sangat baik pada ${subjectName} dengan pengayaan materi lanjutan (Nilai Akhir: ${finalScore}).`;
    } else {
      lowestCompetency = `Perlu latihan mandiri secara berkala pada materi ${subjectName} agar capaian kompetensi semakin meningkat (${best.code}: ${best.score}; Nilai Akhir: ${finalScore}).`;
    }
  }

  return { highestCompetency, lowestCompetency };
}

export function resolveLedgerSlotForAssessment(
  asm: Pick<Assessment, 'assessment_type' | 'scope_key' | 'title'>,
  subjectId?: string,
  classLevel = 4
): LedgerSlot | null {
  const scopeHint = String(asm.scope_key || '').trim().toUpperCase();
  const titleHint = String(asm.title || '').trim().toUpperCase();

  if (asm.assessment_type === 'Sumatif_Tengah_Semester' || scopeHint === 'STS') {
    return 'stsScore';
  }
  if (asm.assessment_type === 'Sumatif_Akhir_Semester' || scopeHint === 'SAS') {
    return 'sasScore';
  }

  const directMatch = scopeHint.match(/^LM[_\s-]*([1-4])$/);
  if (directMatch) {
    return `lm${directMatch[1]}` as LedgerSlot;
  }

  if (subjectId) {
    const configured = curriculumWorkspaceService.getLingkupMateriList(subjectId, classLevel);
    const presets = curriculumWorkspaceService.getPresetLingkupMateriTemplates(subjectId, classLevel);
    const seen = new Set(configured.map((s) => s.scope_key));
    const scopeList = [...configured, ...presets.filter((p) => !seen.has(p.scope_key))].filter(
      (s) => !s.is_special_summative && s.scope_key !== 'STS' && s.scope_key !== 'SAS'
    );

    if (scopeHint) {
      const idx = scopeList.findIndex(
        (s) =>
          s.scope_key.toUpperCase() === scopeHint ||
          s.code.trim().toUpperCase() === scopeHint ||
          s.title.trim().toUpperCase() === scopeHint
      );
      if (idx >= 0) {
        return `lm${(idx % 4) + 1}` as LedgerSlot;
      }
    }

    if (titleHint) {
      const idxByTitle = scopeList.findIndex(
        (s) =>
          (s.code && titleHint.includes(s.code.trim().toUpperCase())) ||
          (s.title && s.title.trim().length >= 4 && titleHint.includes(s.title.trim().toUpperCase()))
      );
      if (idxByTitle >= 0) {
        return `lm${(idxByTitle % 4) + 1}` as LedgerSlot;
      }
    }
  }

  const titlePatternMatch =
    titleHint.match(/\bLM[\s_:-]*([1-4])\b/) ||
    titleHint.match(/\bLINGKUP\s*MATERI[\s_:-]*([1-4])\b/) ||
    titleHint.match(/\bBAB[\s_:-]*([1-4])\b/) ||
    titleHint.match(/\bUNIT[\s_:-]*([1-4])\b/) ||
    titleHint.match(/\bTP[\s_:-]*\d+\.([1-4])\b/);
  if (titlePatternMatch) {
    return `lm${titlePatternMatch[1]}` as LedgerSlot;
  }

  if (/\bSTS\b|TENGAH SEMESTER/.test(titleHint)) return 'stsScore';
  if (/\bSAS\b|AKHIR SEMESTER/.test(titleHint)) return 'sasScore';

  if (asm.assessment_type === 'Sumatif_Lingkup_Materi' || asm.assessment_type === 'Formatif') {
    return 'lm1';
  }

  return null;
}

export const reportService = {
  resolveLedgerSlotForAssessment,
  buildCompetencyDescriptions,

  // Hitung Nilai Akhir & Predikat
  calculateFinalScore(
    lm: { lm1: number; lm2: number; lm3: number; lm4: number },
    sts: number,
    sas: number,
    kktp = 75
  ): {
    avgLm: number;
    finalScore: number;
    predicate: 'A' | 'B' | 'C' | 'D';
  } {
    const lmValues = [lm.lm1, lm.lm2, lm.lm3, lm.lm4].map((v) => Number(v) || 0);
    const activeLms = lmValues.filter((v) => v > 0);
    const avgLm =
      activeLms.length > 0
        ? Math.round(activeLms.reduce((acc, v) => acc + v, 0) / activeLms.length)
        : 0;

    const stsNum = Number(sts) || 0;
    const sasNum = Number(sas) || 0;
    const hasAnyScore = avgLm > 0 || stsNum > 0 || sasNum > 0;
    // Formula Kurikulum Merdeka Madrasah: (2 * RataLM + STS + SAS) / 4
    const finalScore = hasAnyScore ? Math.round((avgLm * 2 + stsNum + sasNum) / 4) : 0;

    const minB = Math.max(kktp + 1, 81);
    const minA = Math.max(minB + 1, 91);

    let predicate: 'A' | 'B' | 'C' | 'D' = 'D';
    if (finalScore >= minA) predicate = 'A';
    else if (finalScore >= minB) predicate = 'B';
    else if (finalScore >= kktp) predicate = 'C';
    else predicate = 'D';

    return { avgLm, finalScore, predicate };
  },

  // Kumpulkan skor riil dari Daftar Nilai Siswa (Formatif & Sumatif Lingkup Materi, STS, SAS) + Remedial (score_after)
  async collectRealAssessmentScoresForSubject(
    classId: string,
    subjectId: string
  ): Promise<Record<string, Partial<Record<LedgerSlot, { score: number; updatedAt: string; isSummative: boolean }>>>> {
    const [assignments, classes, sources] = await Promise.all([
      academicService.getTeachingAssignments(),
      academicService.getClasses(),
      loadMergedAssessmentSources(),
    ]);
    const asgMap = new Map(assignments.map((a) => [a.id, a]));
    const targetClass = classes.find((c) => c.id === classId);
    const classLevel = targetClass?.level || 4;

    const { assessments: allAssessments, grades: allGrades, remedials: allRemedials } = sources;

    const subjectAssessments = allAssessments
      .filter((asm) => {
        const asg = asgMap.get(asm.assignment_id) || asm.assignment;
        return asg && asg.class_id === classId && asg.subject_id === subjectId;
      })
      // Formatif diproses lebih dulu agar Sumatif selalu menjadi prioritas utama per slot
      .sort((a, b) => {
        const aIsSum = a.assessment_type !== 'Formatif' ? 1 : 0;
        const bIsSum = b.assessment_type !== 'Formatif' ? 1 : 0;
        if (aIsSum !== bIsSum) return aIsSum - bIsSum;
        const dateCmp = String(a.assessment_date || '').localeCompare(String(b.assessment_date || ''));
        if (dateCmp !== 0) return dateCmp;
        return String(a.created_at || '').localeCompare(String(b.created_at || ''));
      });

    if (subjectAssessments.length === 0) return {};

    const gradesByAsm = new Map<string, Grade[]>();
    for (const g of allGrades) {
      const list = gradesByAsm.get(g.assessment_id);
      if (list) list.push(g);
      else gradesByAsm.set(g.assessment_id, [g]);
    }

    const remedialByAsmStudent = new Map<string, RemedialRecord>();
    for (const r of allRemedials) {
      if (r.assessment_id && r.score_after !== null && r.score_after !== undefined) {
        remedialByAsmStudent.set(`${r.assessment_id}__${r.student_id}`, r);
      }
    }

    const result: Record<
      string,
      Partial<Record<LedgerSlot, { score: number; updatedAt: string; isSummative: boolean }>>
    > = {};

    for (const asm of subjectAssessments) {
      const isSummative = asm.assessment_type !== 'Formatif';
      const slot = resolveLedgerSlotForAssessment(asm, subjectId, classLevel);
      if (!slot) continue;

      const asmGrades = gradesByAsm.get(asm.id) || [];
      for (const g of asmGrades) {
        const rem = remedialByAsmStudent.get(`${asm.id}__${g.student_id}`);
        const baseScore = Math.min(100, Math.max(0, Number(g.score) || 0));
        const remScore =
          rem && rem.score_after !== null && rem.score_after !== undefined
            ? Math.min(100, Math.max(0, Number(rem.score_after) || 0))
            : null;
        const effectiveScore = remScore !== null ? Math.max(baseScore, remScore) : baseScore;
        const remUpdatedAt = (rem as (RemedialRecord & { updated_at?: string }) | undefined)?.updated_at;
        const updatedAt = maxTimestamp(
          g.updated_at,
          g.created_at,
          remUpdatedAt,
          rem?.created_at,
          asm.created_at
        );

        if (!result[g.student_id]) result[g.student_id] = {};
        const prevSlot = result[g.student_id][slot];
        if (!prevSlot || !prevSlot.isSummative || isSummative) {
          result[g.student_id][slot] = {
            score: effectiveScore,
            updatedAt,
            isSummative,
          };
        }
      }
    }

    return result;
  },

  // Dapatkan Leger Per Mata Pelajaran (Selalu terhubung ke Daftar Nilai & Siswa Rombel)
  async getSubjectLedger(classId: string, subjectId: string): Promise<StudentSubjectScore[]> {
    const key = `${classId}_${subjectId}`;
    const allStore = getLocal<Record<string, StudentSubjectScore[]>>(STORAGE_KEYS.SUBJECT_LEDGER, {});
    const storedRows = Array.isArray(allStore[key]) ? allStore[key] : [];

    const [students, members, subjects, classes, sysSettings, realScoresByStudent] = await Promise.all([
      academicService.getStudents(),
      academicService.getClassMembers(classId),
      academicService.getSubjects(),
      academicService.getClasses(),
      academicService.getSettings(),
      this.collectRealAssessmentScoresForSubject(classId, subjectId),
    ]);

    const memberOrderMap = new Map<string, number>();
    members.forEach((m, idx) => memberOrderMap.set(m.student_id, m.student_number ?? idx + 1));
    const enrolledSet = new Set(members.map((m) => m.student_id));
    const pool = students
      .filter((s) => enrolledSet.has(s.id))
      .sort((a, b) => {
        const na = memberOrderMap.get(a.id) ?? 9999;
        const nb = memberOrderMap.get(b.id) ?? 9999;
        if (na !== nb) return na - nb;
        return a.full_name.localeCompare(b.full_name, 'id');
      });

    if (pool.length === 0) {
      return [];
    }

    const currentSubject = subjects.find((s) => s.id === subjectId);
    const currentClass = classes.find((c) => c.id === classId);
    const subjectName = currentSubject?.name || 'Mata Pelajaran';
    const classLevel = currentClass?.level || 4;
    const kktp = Number(sysSettings?.kktp_default) || 75;
    const storedMap = new Map(storedRows.map((r) => [r.studentId, r]));

    let storeChanged = storedRows.length !== pool.length;

    const mergedRows: StudentSubjectScore[] = pool.map((s) => {
      const existing = storedMap.get(s.id);
      const baseLm = existing?.lmScores
        ? {
            lm1: Number(existing.lmScores.lm1) || 0,
            lm2: Number(existing.lmScores.lm2) || 0,
            lm3: Number(existing.lmScores.lm3) || 0,
            lm4: Number(existing.lmScores.lm4) || 0,
          }
        : { lm1: 0, lm2: 0, lm3: 0, lm4: 0 };
      let sts = Number(existing?.stsScore) || 0;
      let sas = Number(existing?.sasScore) || 0;

      const realSlots = realScoresByStudent[s.id];
      if (realSlots) {
        const slots: LedgerSlot[] = ['lm1', 'lm2', 'lm3', 'lm4', 'stsScore', 'sasScore'];
        for (const slot of slots) {
          const entry = realSlots[slot];
          if (!entry) continue;
          const currentVal =
            slot === 'stsScore' ? sts : slot === 'sasScore' ? sas : baseLm[slot];
          const slotManualAt =
            existing?.manualEditedSlots?.[slot] ??
            (existing?.manualEditedSlots ? undefined : existing?.manualEditedAt);
          const shouldApply =
            currentVal === 0 ||
            !slotManualAt ||
            Date.parse(entry.updatedAt) > Date.parse(slotManualAt);

          if (shouldApply && currentVal !== entry.score) {
            if (slot === 'stsScore') sts = entry.score;
            else if (slot === 'sasScore') sas = entry.score;
            else baseLm[slot] = entry.score;
            storeChanged = true;
          }
        }
      }

      const { avgLm, finalScore, predicate } = this.calculateFinalScore(baseLm, sts, sas, kktp);
      const desc = buildCompetencyDescriptions({
        subjectId,
        subjectName,
        classLevel,
        lmScores: baseLm,
        stsScore: sts,
        sasScore: sas,
        finalScore,
        kktp,
      });

      const resolvedHighest =
        existing?.isDescriptionCustom && existing.highestCompetency
          ? existing.highestCompetency
          : desc.highestCompetency;
      const resolvedLowest =
        existing?.isDescriptionCustom && existing.lowestCompetency
          ? existing.lowestCompetency
          : desc.lowestCompetency;

      if (
        !existing ||
        existing.avgLm !== avgLm ||
        existing.finalScore !== finalScore ||
        existing.predicate !== predicate ||
        existing.studentName !== s.full_name ||
        existing.nis !== s.nis ||
        existing.highestCompetency !== resolvedHighest ||
        existing.lowestCompetency !== resolvedLowest
      ) {
        storeChanged = true;
      }

      return {
        studentId: s.id,
        studentName: s.full_name,
        nis: s.nis,
        lmScores: baseLm,
        avgLm,
        stsScore: sts,
        sasScore: sas,
        finalScore,
        predicate,
        highestCompetency: resolvedHighest,
        lowestCompetency: resolvedLowest,
        ...(existing?.isDescriptionCustom ? { isDescriptionCustom: true } : {}),
        ...(existing?.manualEditedAt ? { manualEditedAt: existing.manualEditedAt } : {}),
        ...(existing?.manualEditedSlots ? { manualEditedSlots: existing.manualEditedSlots } : {}),
      };
    });

    if (storeChanged) {
      allStore[key] = mergedRows;
      setLocal(STORAGE_KEYS.SUBJECT_LEDGER, allStore);
    }

    return mergedRows;
  },

  async saveSubjectLedger(
    classId: string,
    subjectId: string,
    scores: StudentSubjectScore[],
    markManualEdit = false
  ): Promise<void> {
    const key = `${classId}_${subjectId}`;
    const allStore = getLocal<Record<string, StudentSubjectScore[]>>(STORAGE_KEYS.SUBJECT_LEDGER, {});
    const prevRows = Array.isArray(allStore[key]) ? allStore[key] : [];
    const prevMap = new Map(prevRows.map((r) => [r.studentId, r]));
    const now = new Date().toISOString();

    if (!markManualEdit) {
      allStore[key] = scores;
    } else {
      allStore[key] = scores.map((row) => {
        const prev = prevMap.get(row.studentId);
        const nextManualSlots: Partial<Record<LedgerSlot, string>> = {
          ...(prev?.manualEditedSlots || row.manualEditedSlots || {}),
        };
        const slots: LedgerSlot[] = ['lm1', 'lm2', 'lm3', 'lm4', 'stsScore', 'sasScore'];
        let anySlotChanged = false;

        for (const slot of slots) {
          const prevVal = prev
            ? slot === 'stsScore'
              ? prev.stsScore
              : slot === 'sasScore'
              ? prev.sasScore
              : prev.lmScores[slot]
            : 0;
          const nextVal =
            slot === 'stsScore'
              ? row.stsScore
              : slot === 'sasScore'
              ? row.sasScore
              : row.lmScores[slot];
          if (Number(prevVal) !== Number(nextVal)) {
            nextManualSlots[slot] = now;
            anySlotChanged = true;
          }
        }

        return {
          ...row,
          ...(anySlotChanged ? { manualEditedAt: now } : {}),
          ...(Object.keys(nextManualSlots).length > 0 ? { manualEditedSlots: nextManualSlots } : {}),
        };
      });
    }
    setLocal(STORAGE_KEYS.SUBJECT_LEDGER, allStore);
    emitLedgerSync([STORAGE_KEYS.SUBJECT_LEDGER]);
  },

  async syncAssessmentScoresToLedger(
    classId: string,
    subjectId: string,
    targetSlot: LedgerSlot,
    scoresByStudentId: Record<string, number>
  ): Promise<number> {
    const [currentRows, subjects, classes, sysSettings] = await Promise.all([
      this.getSubjectLedger(classId, subjectId),
      academicService.getSubjects(),
      academicService.getClasses(),
      academicService.getSettings(),
    ]);
    if (currentRows.length === 0) return 0;

    const subjectName = subjects.find((s) => s.id === subjectId)?.name || 'Mata Pelajaran';
    const classLevel = classes.find((c) => c.id === classId)?.level || 4;
    const kktp = Number(sysSettings?.kktp_default) || 75;
    let updatedCount = 0;

    const nextRows = currentRows.map((row) => {
      if (scoresByStudentId[row.studentId] === undefined) return row;
      updatedCount++;
      const score = Math.min(100, Math.max(0, Number(scoresByStudentId[row.studentId]) || 0));
      const newLm = { ...row.lmScores };
      let newSts = row.stsScore;
      let newSas = row.sasScore;

      if (targetSlot === 'stsScore') newSts = score;
      else if (targetSlot === 'sasScore') newSas = score;
      else newLm[targetSlot] = score;

      const { avgLm, finalScore, predicate } = this.calculateFinalScore(newLm, newSts, newSas, kktp);
      const desc = buildCompetencyDescriptions({
        subjectId,
        subjectName,
        classLevel,
        lmScores: newLm,
        stsScore: newSts,
        sasScore: newSas,
        finalScore,
        kktp,
      });

      const nextManualSlots = { ...(row.manualEditedSlots || {}) };
      delete nextManualSlots[targetSlot];

      const { manualEditedAt: _clearManual, manualEditedSlots: _oldSlots, ...rest } = row;
      return {
        ...rest,
        lmScores: newLm,
        avgLm,
        stsScore: newSts,
        sasScore: newSas,
        finalScore,
        predicate,
        highestCompetency:
          row.isDescriptionCustom && row.highestCompetency
            ? row.highestCompetency
            : desc.highestCompetency,
        lowestCompetency:
          row.isDescriptionCustom && row.lowestCompetency
            ? row.lowestCompetency
            : desc.lowestCompetency,
        ...(Object.keys(nextManualSlots).length > 0 ? { manualEditedSlots: nextManualSlots } : {}),
      };
    });

    await this.saveSubjectLedger(classId, subjectId, nextRows, false);
    return updatedCount;
  },

  // Teruskan otomatis nilai dari satu instrumen Daftar Nilai (+ Remedial) ke Leger
  async syncAssessmentToLedger(
    assessmentId: string,
    targetSlotOverride?: LedgerSlot,
    scoresOverride?: Record<string, number>
  ): Promise<{ updatedCount: number; slot: LedgerSlot | null }> {
    const sources = await loadMergedAssessmentSources();
    const asm = sources.assessments.find((a) => a.id === assessmentId);
    if (!asm) return { updatedCount: 0, slot: null };

    const [assignments, classes] = await Promise.all([
      academicService.getTeachingAssignments(),
      academicService.getClasses(),
    ]);
    const linkedAsg = assignments.find((a) => a.id === asm.assignment_id) || asm.assignment;
    if (!linkedAsg?.class_id || !linkedAsg?.subject_id) {
      return { updatedCount: 0, slot: null };
    }

    const cls = classes.find((c) => c.id === linkedAsg.class_id);
    const classLevel = cls?.level || linkedAsg.class?.level || 4;
    const slot =
      targetSlotOverride ||
      resolveLedgerSlotForAssessment(asm, linkedAsg.subject_id, classLevel);

    if (!slot) {
      return { updatedCount: 0, slot: null };
    }

    if (targetSlotOverride && scoresOverride && Object.keys(scoresOverride).length > 0) {
      const updatedCount = await this.syncAssessmentScoresToLedger(
        linkedAsg.class_id,
        linkedAsg.subject_id,
        targetSlotOverride,
        scoresOverride
      );
      return { updatedCount, slot: targetSlotOverride };
    }

    const { updatedStudents } = await this.syncFromAssessmentsForSubject(
      linkedAsg.class_id,
      linkedAsg.subject_id,
      { forceOverwrite: false }
    );
    return { updatedCount: updatedStudents, slot };
  },

  // Tarik ulang paksa seluruh nilai Daftar Nilai & Remedial untuk (classId, subjectId) ke Leger
  async syncFromAssessmentsForSubject(
    classId: string,
    subjectId: string,
    options?: { forceOverwrite?: boolean }
  ): Promise<{ updatedStudents: number; filledSlots: number }> {
    const key = `${classId}_${subjectId}`;
    if (options?.forceOverwrite) {
      const allStore = getLocal<Record<string, StudentSubjectScore[]>>(STORAGE_KEYS.SUBJECT_LEDGER, {});
      if (Array.isArray(allStore[key])) {
        allStore[key] = allStore[key].map(
          ({ manualEditedAt: _m, manualEditedSlots: _ms, ...rest }) => rest
        );
        setLocal(STORAGE_KEYS.SUBJECT_LEDGER, allStore);
      }
    }

    const realScores = await this.collectRealAssessmentScoresForSubject(classId, subjectId);
    const updatedStudents = Object.keys(realScores).length;
    const filledSlots = Object.values(realScores).reduce(
      (sum, slots) => sum + Object.keys(slots).length,
      0
    );

    await this.getSubjectLedger(classId, subjectId);
    emitLedgerSync([STORAGE_KEYS.SUBJECT_LEDGER]);
    return { updatedStudents, filledSlots };
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

    const enrolledIds = new Set(members.map((m) => m.student_id));
    const pool = students.filter((s) => enrolledIds.has(s.id));

    if (pool.length === 0) {
      return { subjects, rows: [] };
    }

    const subjectLedgersList = await Promise.all(
      subjects.map((sbj) => this.getSubjectLedger(classId, sbj.id))
    );
    const subjectLedgers: Record<string, StudentSubjectScore[]> = {};
    subjects.forEach((sbj, idx) => {
      subjectLedgers[sbj.id] = subjectLedgersList[idx];
    });

    const rows: ClassLegerRow[] = pool.map((s) => {
      const subjectScores: Record<string, number> = {};
      let total = 0;

      subjects.forEach((sbj) => {
        const studentScore = subjectLedgers[sbj.id]?.find((entry) => entry.studentId === s.id);
        const score = studentScore ? studentScore.finalScore : 0;
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
    rows.sort((a, b) => b.totalScore - a.totalScore || a.studentName.localeCompare(b.studentName, 'id'));
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
