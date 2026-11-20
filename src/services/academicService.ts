import {
  supabase,
  isSupabaseConfigured,
  isSupabaseAvailable,
  isSupabaseBypassed,
  reportSupabaseOutcome,
  detectSupabaseQuotaError,
} from '../lib/supabaseClient';
import {
  AcademicYear,
  Semester,
  ClassRoom,
  Student,
  Teacher,
  Subject,
  TeachingAssignment,
  SystemSettings,
  ClassMember,
  HomeroomAssignment,
  ClassOfficial,
} from '../types/database.types';
import {
  DEMO_ACADEMIC_YEAR,
  DEMO_SEMESTER,
  DEMO_CLASSES,
  DEMO_STUDENTS,
  DEMO_TEACHERS,
  DEMO_SUBJECTS,
  DEMO_TEACHING_ASSIGNMENTS,
  DEMO_SYSTEM_SETTINGS,
  DEMO_CLASS_MEMBERS,
  DEMO_HOMEROOM_ASSIGNMENTS,
  DEMO_CLASS_OFFICIALS,
} from '../lib/demoData';
import { syncService } from './syncService';

const STORAGE_KEYS = {
  ACADEMIC_YEARS: 'simpel_academic_years',
  SEMESTERS: 'simpel_semesters',
  CLASSES: 'simpel_classes',
  STUDENTS: 'simpel_students',
  TEACHERS: 'simpel_teachers',
  SUBJECTS: 'simpel_subjects',
  ASSIGNMENTS: 'simpel_assignments',
  SETTINGS: 'simpel_settings',
  CLASS_MEMBERS: 'simpel_class_members',
  HOMEROOM_ASSIGNMENTS: 'simpel_homeroom_assignments',
  CLASS_OFFICIALS: 'simpel_class_officials',
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
  } finally {
    invalidateAcademicCache();
  }
}

function emitAcademicSyncEvent(keys: string[]): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('simpel:remote-sync', { detail: { keys } }));
  }
}

// === CACHE TTL + IN-FLIGHT DEDUP UNTUK PERFORMA OPTIMAL ===
const ACADEMIC_CACHE_TTL_MS = 2500;
const academicReadCache = new Map<string, { value: unknown; expiresAt: number }>();
const academicInflightCache = new Map<string, Promise<unknown>>();

export function invalidateAcademicCache(prefix?: string): void {
  if (!prefix) {
    academicReadCache.clear();
    academicInflightCache.clear();
    lastReconcileSignature = '';
    lastReconciledTeachers = null;
    return;
  }
  for (const key of Array.from(academicReadCache.keys())) {
    if (key.startsWith(prefix)) academicReadCache.delete(key);
  }
  for (const key of Array.from(academicInflightCache.keys())) {
    if (key.startsWith(prefix)) academicInflightCache.delete(key);
  }
  if (prefix === 'teachers') {
    lastReconcileSignature = '';
    lastReconciledTeachers = null;
  }
}

async function cachedAcademicRead<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = academicReadCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }
  const inflight = academicInflightCache.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }
  const promise = fetcher()
    .then((result) => {
      academicReadCache.set(key, { value: result, expiresAt: Date.now() + ACADEMIC_CACHE_TTL_MS });
      academicInflightCache.delete(key);
      return result;
    })
    .catch((err) => {
      academicInflightCache.delete(key);
      throw err;
    });
  academicInflightCache.set(key, promise);
  return promise;
}

if (typeof window !== 'undefined') {
  const globalWindow = window as unknown as { __simpelAcademicCacheListenerBound?: boolean };
  if (!globalWindow.__simpelAcademicCacheListenerBound) {
    globalWindow.__simpelAcademicCacheListenerBound = true;
    window.addEventListener('simpel:remote-sync', () => invalidateAcademicCache());
    window.addEventListener('storage', () => invalidateAcademicCache());
  }
}

// === URUTAN KANONIKAL MATA PELAJARAN MADRASAH ===
export function getMadrasahSubjectSortRank(subject?: {
  id?: string | null;
  code?: string | null;
  name?: string | null;
  order_index?: number | null;
} | null): number {
  if (!subject) return 999;
  const id = String(subject.id || '').trim().toLowerCase();
  const code = String(subject.code || '').trim().toUpperCase();
  const name = String(subject.name || '').trim().toLowerCase();

  if (id === 'sbj-qh' || code === 'QH' || name.includes('qur') || name.includes('hadis')) return 1;
  if (id === 'sbj-aa' || code === 'AA' || name.includes('akidah') || name.includes('akhlak')) return 2;
  if (id === 'sbj-fiq' || code === 'FIQ' || code === 'FIK' || name.includes('fikih') || name.includes('fiqih')) return 3;
  if (id === 'sbj-ski' || code === 'SKI' || name.includes('sejarah kebudayaan islam') || /\bski\b/.test(name)) return 4;
  if (id === 'sbj-pp' || code === 'PP' || code === 'PPKN' || name.includes('pancasila')) return 5;
  if (id === 'sbj-ind' || code === 'IND' || code === 'BI' || code === 'BIN' || name.includes('bahasa indonesia')) return 6;
  if (id === 'sbj-arb' || code === 'ARB' || code === 'BA' || name.includes('bahasa arab')) return 7;
  if (id === 'sbj-mtk' || code === 'MTK' || name.includes('matematika')) return 8;
  if (id === 'sbj-ipas' || code === 'IPAS' || name.includes('ipas') || name.includes('ilmu pengetahuan alam')) return 9;
  if (id === 'sbj-pjk' || code === 'PJK' || code === 'PJOK' || name.includes('pjok') || name.includes('jasmani')) return 10;
  if (
    id === 'sbj-sbd' ||
    code === 'SBD' ||
    code === 'SBDP' ||
    code === 'SB' ||
    code === 'SR' ||
    name.includes('seni rupa') ||
    name.includes('seni budaya') ||
    name.includes('seni dan budaya') ||
    name.includes('sbdp')
  ) {
    return 11;
  }
  if (id === 'sbj-eng' || code === 'ENG' || code === 'ING' || code === 'BING' || name.includes('bahasa inggris')) return 12;
  if (
    id === 'sbj-asw' ||
    code === 'ASW' ||
    code === 'ASWJ' ||
    name.includes('aswaja') ||
    name.includes('ke-nu-an') ||
    name.includes("ma'arif") ||
    name.includes('ma’arif')
  ) {
    return 13;
  }
  if (id === 'sbj-bjw' || code === 'BJW' || name.includes('bahasa jawa')) return 14;

  return 100 + (typeof subject.order_index === 'number' ? subject.order_index : 999);
}

export function getCanonicalSubjectKey(subject?: {
  id?: string | null;
  code?: string | null;
  name?: string | null;
  order_index?: number | null;
} | null): string {
  if (!subject) return '';
  const rank = getMadrasahSubjectSortRank(subject);
  if (rank < 100) return `madrasah-${rank}`;
  const normCode = String(subject.code || '').trim().toUpperCase();
  if (normCode) return `code-${normCode}`;
  const normName = String(subject.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (normName) return `name-${normName}`;
  return String(subject.id || '');
}

export function getCanonicalClassKey(cls?: {
  id?: string | null;
  level?: number | null;
  name?: string | null;
} | null): string {
  if (!cls) return '';
  const level = typeof cls.level === 'number' && cls.level > 0 ? cls.level : parseClassLevelFromInput(cls.name || cls.id) || 0;
  const normName = String(cls.name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (normName) return `lvl-${level}::${normName}`;
  if (level > 0) return `lvl-${level}::kelas ${level}`;
  return String(cls.id || '');
}

export function sortSubjectsCanonical<
  T extends { id?: string | null; code?: string | null; name?: string | null; order_index?: number | null }
>(subjects: T[]): T[] {
  return [...subjects].sort((a, b) => {
    const rankDiff = getMadrasahSubjectSortRank(a) - getMadrasahSubjectSortRank(b);
    if (rankDiff !== 0) return rankDiff;
    const orderDiff = (a.order_index ?? 999) - (b.order_index ?? 999);
    if (orderDiff !== 0) return orderDiff;
    return String(a.name || '').localeCompare(String(b.name || ''), 'id');
  });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value?: string | null): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

const USERS_SYNC_STORAGE_KEY = 'simpel_users_cache_v2';

export function cleanTeacherIdentifier(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (
    !trimmed ||
    /^[-–—_.0/]+$/.test(trimmed) ||
    /^(non-?pns|tidak ada|belum ada|null|na|n\/a)$/i.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

export function compactTeacherIdentifier(value?: string | null): string | null {
  const cleaned = cleanTeacherIdentifier(value);
  if (!cleaned) return null;
  const compacted = cleaned.replace(/[\s.-]+/g, '').toLowerCase();
  return compacted || null;
}

export function normalizePersonName(name?: string | null): string {
  if (!name) return '';
  return String(name)
    .replace(/[`’‘]/g, "'")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function stripPersonTitles(name?: string | null): string {
  if (!name) return '';
  let cleaned = String(name).replace(/[`’‘]/g, "'").trim().toLowerCase();
  // Hapus semua bagian gelar setelah tanda koma pertama (misal: ", S.Pd.I, M.Pd")
  cleaned = cleaned.replace(/,\s*.*$/g, '');
  // Hapus prefiks gelar/sapaan berulang (misal: "Ust. H. ", "Drs. Hj. ")
  for (let i = 0; i < 4; i++) {
    const next = cleaned
      .replace(/^(?:ust\.?|ustadzah|ustadz|ibu|bapak|bpk\.?|h\.?|hj\.?|ny\.?|drs\.?|dra\.?|dr\.?|k\.?h\.?|prof\.?|ir\.?)\s+/i, '')
      .trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  // Hapus gelar akademik di akhir tanpa tanda koma
  cleaned = cleaned
    .replace(/\b(?:s\.?pd\.?i?|s\.?pd\.?sd|s\.?pd|m\.?pd\.?i?|m\.?pd|s\.?ag|m\.?ag|s\.?kom|s\.?e|s\.?si|s\.?sos\.?i?|s\.?h\.?i?|s\.?sy|s\.?psi|s\.?th\.?i?|m\.?m|m\.?si|m\.?hum|a\.?ma\.?pd|a\.?ma|a\.?md|gr\.?)\b/gi, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

export function getTeacherDisplayName(teacher?: Partial<Teacher> | null): string {
  if (!teacher) return '';
  return `${teacher.title_prefix ? `${teacher.title_prefix} ` : ''}${teacher.full_name || ''}${
    teacher.title_suffix ? `, ${teacher.title_suffix}` : ''
  }`.trim();
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function parseClassLevelFromInput(value?: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return value >= 1 && value <= 6 ? value : null;
  }
  const raw = String(value).trim();
  if (!raw) return null;

  // Cek format romawi I - VI
  const romanMap: Record<string, number> = {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
    vi: 6,
  };
  const cleanedLower = raw.toLowerCase().replace(/^kelas\s*/i, '').trim();
  if (romanMap[cleanedLower]) return romanMap[cleanedLower];

  // Cek digit 1-6 di dalam teks seperti "1", "Kelas 1", "1A", "cls-1", "Kelas 1A"
  const match = raw.match(/(?:^|\b|kelas\s*|cls-?)([1-6])(?:[a-z\s]|$)/i) || raw.match(/([1-6])/);
  if (match) {
    const lvl = Number(match[1]);
    if (lvl >= 1 && lvl <= 6) return lvl;
  }
  return null;
}

const DEFAULT_OFFICIAL_ROLE_ORDER: Record<string, number> = {
  'Ketua Kelas': 1,
  'Wakil Ketua Kelas': 2,
  Sekretaris: 3,
  Bendahara: 4,
  'Seksi Kerohanian & Ibadah': 5,
  'Seksi Kebersihan & Keindahan': 6,
  'Seksi Keamanan & Ketertiban': 7,
  'Seksi Olahraga & Pramuka': 8,
  Anggota: 9,
};

function syncTeacherWaliRoleInUserCache(teacherId: string, shouldHaveWaliRole: boolean, teachersPool: Teacher[]): void {
  if (typeof window === 'undefined' || !teacherId) return;
  try {
    const rawUsers = localStorage.getItem(USERS_SYNC_STORAGE_KEY);
    if (!rawUsers) return;
    const parsedUsers = JSON.parse(rawUsers);
    if (!Array.isArray(parsedUsers)) return;

    const targetTeacher = teachersPool.find((t) => t.id === teacherId);
    const targetNameNorm = normalizePersonName(targetTeacher?.full_name);

    let touched = false;
    const nextUsers = parsedUsers.map((u: any) => {
      const isMatch =
        u.teacher_info?.id === teacherId ||
        (targetTeacher?.user_id && u.id === targetTeacher.user_id) ||
        (targetNameNorm && normalizePersonName(u.full_name) === targetNameNorm);

      if (!isMatch) return u;

      const currentRoles: string[] = Array.isArray(u.roles) ? [...u.roles] : ['guru'];
      if (shouldHaveWaliRole) {
        if (!currentRoles.includes('wali_kelas')) {
          touched = true;
          return { ...u, roles: [...currentRoles, 'wali_kelas'] };
        }
      } else if (currentRoles.includes('wali_kelas')) {
        const filtered = currentRoles.filter((r) => r !== 'wali_kelas');
        const nextRoles = filtered.length > 0 ? filtered : ['guru'];
        touched = true;
        return { ...u, roles: nextRoles };
      }
      return u;
    });

    if (touched) {
      setLocal(USERS_SYNC_STORAGE_KEY, nextUsers);
    }
  } catch (err) {
    console.warn('Gagal menyinkronkan peran wali_kelas ke cache pengguna:', err);
  }
}

let isReconcilingTeachers = false;
let lastReconcileSignature = '';
let lastReconciledTeachers: Teacher[] | null = null;

function hashStringFnv1a(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function reconcileTeachersWithSyncedAccounts(baseTeachers: Teacher[]): Teacher[] {
  if (isReconcilingTeachers || typeof window === 'undefined') return baseTeachers;

  const rawUsers = localStorage.getItem(USERS_SYNC_STORAGE_KEY) || '';
  const baseSig = `${baseTeachers.map((t) => `${t.id}:${t.updated_at || ''}:${t.nip || ''}:${t.user_id || ''}:${t.full_name || ''}`).join('|')}__${rawUsers.length}:${hashStringFnv1a(rawUsers)}`;
  if (lastReconciledTeachers && baseSig === lastReconcileSignature) {
    return lastReconciledTeachers;
  }

  isReconcilingTeachers = true;

  try {
    const resultTeachers: Teacher[] = baseTeachers.map((t) => ({
      ...t,
      nip: cleanTeacherIdentifier(t.nip),
      nuptk: cleanTeacherIdentifier(t.nuptk),
      phone_number: cleanTeacherIdentifier(t.phone_number),
    }));

    let teachersChanged = resultTeachers.some(
      (t, idx) =>
        t.nip !== baseTeachers[idx].nip ||
        t.nuptk !== baseTeachers[idx].nuptk ||
        t.phone_number !== baseTeachers[idx].phone_number
    );

    if (!rawUsers) {
      if (teachersChanged) {
        setLocal(STORAGE_KEYS.TEACHERS, resultTeachers);
      }
      lastReconcileSignature = baseSig;
      lastReconciledTeachers = resultTeachers;
      return resultTeachers;
    }

    const parsedUsers = JSON.parse(rawUsers);
    if (!Array.isArray(parsedUsers) || parsedUsers.length === 0) {
      if (teachersChanged) {
        setLocal(STORAGE_KEYS.TEACHERS, resultTeachers);
      }
      return resultTeachers;
    }

    let usersChanged = false;
    const claimedTeacherIds = new Set<string>();
    const newlyCreatedForCloud: Teacher[] = [];
    const now = new Date().toISOString();

    const activeUsersById = new Map<string, any>();
    const teacherLinkCounts = new Map<string, number>();
    for (const pu of parsedUsers) {
      if (pu?.id) activeUsersById.set(pu.id, pu);
      const tid = pu?.teacher_info?.id;
      if (tid) teacherLinkCounts.set(tid, (teacherLinkCounts.get(tid) || 0) + 1);
    }

    const isTeacherOwnedByAnotherPerson = (t: Teacher, u: any): boolean => {
      if (!t.user_id || t.user_id === u.id) return false;
      const ownerUser = activeUsersById.get(t.user_id);
      if (!ownerUser) return false;
      const uEmail = String(u.email || '').trim().toLowerCase();
      const ownerEmail = String(ownerUser.email || '').trim().toLowerCase();
      if (uEmail && ownerEmail && uEmail === ownerEmail) return false;
      const uStripped = stripPersonTitles(u.full_name);
      const ownerStripped = stripPersonTitles(ownerUser.full_name);
      if (uStripped && ownerStripped && uStripped === ownerStripped) return false;
      return true;
    };

    const updatedUsers = parsedUsers.map((u: any) => {
      const roles: string[] = Array.isArray(u.roles) ? u.roles : [];
      const email = String(u.email || '').trim().toLowerCase();
      const normName = normalizePersonName(u.full_name);
      const strippedNormName = stripPersonTitles(u.full_name);

      if (!normName || u.teacher_detached === true) {
        return u;
      }

      const isEducatorAccount =
        roles.some((r) => ['guru', 'wali_kelas', 'kepala_madrasah'].includes(r)) ||
        (email !== 'alihsansoborejo@gmail.com' && !!u.specialization);

      if (!isEducatorAccount) {
        return u;
      }

      const cleanNip = cleanTeacherIdentifier(u.nip);
      const compactNip = compactTeacherIdentifier(u.nip);
      const cleanNuptk = cleanTeacherIdentifier(u.nuptk);
      const compactNuptk = compactTeacherIdentifier(u.nuptk);
      const cleanPhone = cleanTeacherIdentifier(u.phone_number);

      // Cari teacher yang valid dan belum diklaim oleh akun lain
      let matchedIndex = -1;

      if (u.teacher_info?.id && !claimedTeacherIds.has(u.teacher_info.id)) {
        const isUniqueLink = (teacherLinkCounts.get(u.teacher_info.id) || 0) <= 1;
        const idxByLink = resultTeachers.findIndex((t) => {
          if (t.id !== u.teacher_info.id) return false;
          if (isTeacherOwnedByAnotherPerson(t, u)) return false;
          if (isUniqueLink) return true;
          const tStripped = stripPersonTitles(t.full_name);
          return (
            normalizePersonName(t.full_name) === normName ||
            (strippedNormName && tStripped === strippedNormName)
          );
        });
        if (idxByLink !== -1) matchedIndex = idxByLink;
      }

      if (matchedIndex === -1 && u.id) {
        matchedIndex = resultTeachers.findIndex(
          (t) => !claimedTeacherIds.has(t.id) && t.user_id === u.id
        );
      }

      if (matchedIndex === -1 && compactNip) {
        matchedIndex = resultTeachers.findIndex(
          (t) => !claimedTeacherIds.has(t.id) && compactTeacherIdentifier(t.nip) === compactNip
        );
      }

      if (matchedIndex === -1 && compactNuptk) {
        matchedIndex = resultTeachers.findIndex(
          (t) => !claimedTeacherIds.has(t.id) && compactTeacherIdentifier(t.nuptk) === compactNuptk
        );
      }

      if (matchedIndex === -1) {
        matchedIndex = resultTeachers.findIndex(
          (t) =>
            !claimedTeacherIds.has(t.id) &&
            !isTeacherOwnedByAnotherPerson(t, u) &&
            normalizePersonName(t.full_name) === normName
        );
      }

      if (matchedIndex === -1 && strippedNormName) {
        matchedIndex = resultTeachers.findIndex((t) => {
          if (claimedTeacherIds.has(t.id)) return false;
          if (isTeacherOwnedByAnotherPerson(t, u)) return false;
          const tCompactNip = compactTeacherIdentifier(t.nip);
          if (compactNip && tCompactNip && compactNip !== tCompactNip) return false;
          return (
            stripPersonTitles(t.full_name) === strippedNormName ||
            stripPersonTitles(getTeacherDisplayName(t)) === strippedNormName
          );
        });
      }

      let linkedTeacher: Teacher;

      if (matchedIndex !== -1) {
        const existing = resultTeachers[matchedIndex];
        claimedTeacherIds.add(existing.id);

        const shouldAdoptUserId = !existing.user_id || !activeUsersById.has(existing.user_id);
        const nextTeacher: Teacher = {
          ...existing,
          user_id: shouldAdoptUserId ? u.id : existing.user_id,
          full_name: existing.full_name || String(u.full_name).trim(),
          title_prefix: existing.title_prefix ?? (u.title_prefix || null),
          title_suffix: existing.title_suffix ?? (u.title_suffix || null),
          nip: cleanTeacherIdentifier(existing.nip) ?? cleanNip,
          nuptk: cleanTeacherIdentifier(existing.nuptk) ?? cleanNuptk,
          gender: existing.gender || (u.gender === 'P' ? 'P' : 'L'),
          phone_number: cleanTeacherIdentifier(existing.phone_number) ?? cleanPhone,
          specialization:
            existing.specialization ||
            u.specialization ||
            (roles.includes('kepala_madrasah') ? 'Kepala Madrasah' : 'Guru Pengampu'),
          is_active: existing.is_active ?? (u.is_active ?? true),
        };

        if (
          nextTeacher.nip !== existing.nip ||
          nextTeacher.nuptk !== existing.nuptk ||
          nextTeacher.phone_number !== existing.phone_number ||
          nextTeacher.user_id !== existing.user_id ||
          nextTeacher.title_suffix !== existing.title_suffix ||
          nextTeacher.specialization !== existing.specialization
        ) {
          resultTeachers[matchedIndex] = nextTeacher;
          teachersChanged = true;
        }
        linkedTeacher = nextTeacher;
      } else {
        linkedTeacher = {
          id: generateUuid(),
          user_id: u.id,
          full_name: String(u.full_name).trim(),
          title_prefix: u.title_prefix || null,
          title_suffix: u.title_suffix || null,
          nip: cleanNip,
          nuptk: cleanNuptk,
          gender: u.gender === 'P' ? 'P' : 'L',
          phone_number: cleanPhone,
          specialization:
            u.specialization ||
            (roles.includes('kepala_madrasah') ? 'Kepala Madrasah' : 'Guru Pengampu'),
          is_active: u.is_active ?? true,
          created_at: u.created_at || now,
          updated_at: now,
        };
        claimedTeacherIds.add(linkedTeacher.id);
        resultTeachers.push(linkedTeacher);
        newlyCreatedForCloud.push(linkedTeacher);
        teachersChanged = true;
      }

      const needsUserUpdate =
        u.teacher_info?.id !== linkedTeacher.id ||
        u.teacher_info?.nip !== linkedTeacher.nip ||
        u.teacher_info?.specialization !== linkedTeacher.specialization ||
        u.nip !== cleanNip ||
        u.nuptk !== cleanNuptk;

      if (needsUserUpdate) {
        usersChanged = true;
        return {
          ...u,
          nip: cleanNip,
          nuptk: cleanNuptk,
          phone_number: cleanPhone ?? u.phone_number ?? null,
          teacher_info: {
            id: linkedTeacher.id,
            nip: linkedTeacher.nip,
            specialization: linkedTeacher.specialization,
          },
        };
      }

      return u;
    });

    const sorted = [...resultTeachers].sort((a, b) => a.full_name.localeCompare(b.full_name, 'id'));

    if (teachersChanged) {
      setLocal(STORAGE_KEYS.TEACHERS, sorted);
    }
    if (usersChanged) {
      setLocal(USERS_SYNC_STORAGE_KEY, updatedUsers);
    }

    if (isSupabaseAvailable() && newlyCreatedForCloud.length > 0) {
      for (const nt of newlyCreatedForCloud) {
        const cloudRow = {
          ...nt,
          user_id: isUuid(nt.user_id) ? nt.user_id : null,
        };
        void supabase
          .from('teachers')
          .upsert(cloudRow, { onConflict: 'id' })
          .then(({ error }) => {
            reportSupabaseOutcome(error);
            if (error) console.warn('Background sync teacher ke Supabase dilewati:', error.message);
          });
      }
    }

    lastReconcileSignature = baseSig;
    lastReconciledTeachers = sorted;
    return sorted;
  } catch (err) {
    console.warn('Reconcile teachers & accounts error:', err);
    return baseTeachers;
  } finally {
    isReconcilingTeachers = false;
  }
}

let lastCloudSyncError: string | null = null;

export const academicService = {
  getLastCloudSyncError(): string | null {
    return lastCloudSyncError;
  },

  async resolveActiveAcademicContext(): Promise<{ academicYearId: string; semesterId: string }> {
    const [settings, years, semesters] = await Promise.all([
      this.getSettings(),
      this.getAcademicYears(),
      this.getSemesters(),
    ]);
    const activeYear =
      (isUuid(settings.active_academic_year_id)
        ? years.find((y) => y.id === settings.active_academic_year_id)
        : undefined) ||
      years.find((y) => isUuid(y.id) && y.is_active) ||
      years.find((y) => isUuid(y.id)) ||
      years.find((y) => y.id === settings.active_academic_year_id) ||
      years.find((y) => y.is_active) ||
      years[0] ||
      DEMO_ACADEMIC_YEAR;
    const activeSem =
      (isUuid(settings.active_semester_id)
        ? semesters.find((s) => s.id === settings.active_semester_id)
        : undefined) ||
      semesters.find((s) => isUuid(s.id) && s.is_active) ||
      semesters.find((s) => isUuid(s.id)) ||
      semesters.find((s) => s.id === settings.active_semester_id) ||
      semesters.find((s) => s.is_active) ||
      semesters[0] ||
      DEMO_SEMESTER;
    return {
      academicYearId: activeYear.id,
      semesterId: activeSem.id,
    };
  },

  async resolveClassTarget(classIdOrLevel: string | number, existingClasses?: ClassRoom[]): Promise<ClassRoom | null> {
    const classes = existingClasses || (await this.getClasses());
    if (classes.length === 0) return null;

    const rawStr = String(classIdOrLevel ?? '').trim();
    if (!rawStr) return null;

    // 1. Cocokkan ID persis terlebih dahulu
    const byId = classes.find((c) => c.id === rawStr);
    if (byId) return byId;

    // 2. Cocokkan nama kelas secara persis atau tanpa prefiks "Kelas" (misal: "Kelas 1A", "1A")
    const lowerRaw = rawStr.toLowerCase().replace(/\s+/g, ' ');
    const strippedRaw = lowerRaw.replace(/^(kelas|rombel|kls)\s+/i, '').trim();
    const byExactName = classes.find((c) => {
      const cName = c.name.trim().toLowerCase().replace(/\s+/g, ' ');
      const cStripped = cName.replace(/^(kelas|rombel|kls)\s+/i, '').trim();
      return cName === lowerRaw || (strippedRaw !== '' && cStripped === strippedRaw);
    });
    if (byExactName) return byExactName;

    // 3. Cocokkan berdasarkan level (misal: "cls-1", "1", "Kelas 1", "I")
    const parsedLevel = parseClassLevelFromInput(rawStr);
    if (parsedLevel !== null) {
      const byLevel = classes.find((c) => c.level === parsedLevel);
      if (byLevel) return byLevel;
    }

    return null;
  },

  // === SISTEM PENGATURAN ===
  async getSettings(): Promise<SystemSettings> {
    return cachedAcademicRead('settings', async () => {
      const localSettings = getLocal<SystemSettings | null>(STORAGE_KEYS.SETTINGS, null);
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await supabase.from('system_settings').select('*').limit(1).maybeSingle();
          reportSupabaseOutcome(error);
          if (!error && data) {
            const remoteSettings = data as SystemSettings;
            if (
              localSettings &&
              localSettings.updated_at &&
              remoteSettings.updated_at &&
              Date.parse(localSettings.updated_at) > Date.parse(remoteSettings.updated_at)
            ) {
              return localSettings;
            }
            // Simpan ke cache lokal agar logo & identitas tetap bertahan di server sinkronisasi lokal saat cloud gangguan/offline
            if (!localSettings || JSON.stringify(localSettings) !== JSON.stringify(remoteSettings)) {
              setLocal(STORAGE_KEYS.SETTINGS, remoteSettings);
            }
            return remoteSettings;
          }
        } catch (err) {
          reportSupabaseOutcome(err);
          console.warn('Supabase getSettings fallback:', err);
        }
      }
      return localSettings || DEMO_SYSTEM_SETTINGS;
    });
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    const current = await this.getSettings();
    const updated: SystemSettings = { ...current, ...settings, updated_at: new Date().toISOString() };
    setLocal(STORAGE_KEYS.SETTINGS, updated);
    lastCloudSyncError = null;

    if (isSupabaseConfigured && !isSupabaseAvailable()) {
      if (!isSupabaseBypassed()) {
        lastCloudSyncError =
          'Kuota egres database Supabase habis (exceed_egress_quota). Pengaturan & logo tetap tersimpan di server aplikasi lokal.';
      }
      return updated;
    }

    if (isSupabaseAvailable()) {
      try {
        const dbPayload: Record<string, unknown> = {
          updated_at: updated.updated_at,
        };
        if (updated.school_name !== undefined) dbPayload.school_name = updated.school_name;
        if (updated.nsm !== undefined) dbPayload.nsm = updated.nsm;
        if (updated.npsn !== undefined) dbPayload.npsn = updated.npsn;
        if (updated.address !== undefined) dbPayload.address = updated.address;
        if (updated.principal_name !== undefined) dbPayload.principal_name = updated.principal_name;
        if (updated.principal_nip !== undefined) dbPayload.principal_nip = updated.principal_nip;
        if (updated.logo_url !== undefined) dbPayload.logo_url = updated.logo_url;
        if (updated.favicon_url !== undefined) dbPayload.favicon_url = updated.favicon_url;
        if (updated.kktp_default !== undefined) dbPayload.kktp_default = Number(updated.kktp_default);
        if (updated.is_report_card_locked !== undefined) dbPayload.is_report_card_locked = Boolean(updated.is_report_card_locked);
        if (isUuid(updated.active_academic_year_id)) dbPayload.active_academic_year_id = updated.active_academic_year_id;
        if (isUuid(updated.active_semester_id)) dbPayload.active_semester_id = updated.active_semester_id;

        const { data: existingRow, error: fetchErr } = await supabase
          .from('system_settings')
          .select('id')
          .limit(1)
          .maybeSingle();

        reportSupabaseOutcome(fetchErr);
        if (fetchErr) {
          lastCloudSyncError = detectSupabaseQuotaError(fetchErr)
            ? 'Kuota egres database Supabase habis (exceed_egress_quota). Pengaturan tetap tersimpan di server aplikasi lokal.'
            : `${fetchErr.message} (${fetchErr.code || 'RLS/Auth'})`;
          console.warn('Supabase fetch system_settings error:', fetchErr);
        } else if (existingRow?.id && isUuid(existingRow.id)) {
          const { error: updateErr } = await supabase
            .from('system_settings')
            .update(dbPayload)
            .eq('id', existingRow.id);
          reportSupabaseOutcome(updateErr);
          if (updateErr) {
            lastCloudSyncError = detectSupabaseQuotaError(updateErr)
              ? 'Kuota egres database Supabase habis (exceed_egress_quota).'
              : `${updateErr.message} (${updateErr.code || 'UpdateError'})`;
            console.warn('Supabase updateSettings error:', updateErr);
          }
        } else {
          const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;
          const { error: insertErr } = await supabase
            .from('system_settings')
            .insert(newId ? { id: newId, ...dbPayload } : dbPayload);
          reportSupabaseOutcome(insertErr);
          if (insertErr) {
            lastCloudSyncError = detectSupabaseQuotaError(insertErr)
              ? 'Kuota egres database Supabase habis (exceed_egress_quota).'
              : `${insertErr.message} (${insertErr.code || 'InsertError'})`;
            console.warn('Supabase insert system_settings error:', insertErr);
          }
        }
      } catch (err: any) {
        reportSupabaseOutcome(err);
        lastCloudSyncError = detectSupabaseQuotaError(err)
          ? 'Kuota egres database Supabase habis (exceed_egress_quota).'
          : err?.message || 'Gagal menghubungi Supabase.';
        console.warn('Supabase updateSettings fallback:', err);
      }
    }
    return updated;
  },

  // === TAHUN PELAJARAN & SEMESTER ===
  async getAcademicYears(): Promise<AcademicYear[]> {
    return cachedAcademicRead('academic_years', async () => {
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await supabase.from('academic_years').select('*').order('created_at', { ascending: false });
          reportSupabaseOutcome(error);
          if (!error && data && data.length > 0) return data as AcademicYear[];
        } catch (err) {
          reportSupabaseOutcome(err);
          console.warn('Supabase getAcademicYears fallback:', err);
        }
      }
      return getLocal<AcademicYear[]>(STORAGE_KEYS.ACADEMIC_YEARS, [DEMO_ACADEMIC_YEAR]);
    });
  },

  async createAcademicYear(payload: Omit<AcademicYear, 'id' | 'created_at'>): Promise<AcademicYear> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ay-${Date.now()}`;
    const newYear: AcademicYear = {
      ...payload,
      id,
      created_at: new Date().toISOString(),
    };
    if (isSupabaseAvailable()) {
      try {
        const { data, error } = await supabase.from('academic_years').insert(newYear).select().single();
        reportSupabaseOutcome(error);
        if (!error && data) {
          invalidateAcademicCache();
          return data as AcademicYear;
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase createAcademicYear fallback:', err);
      }
    }
    const years = await this.getAcademicYears();
    const updated = [newYear, ...years];
    setLocal(STORAGE_KEYS.ACADEMIC_YEARS, updated);
    return newYear;
  },

  async getSemesters(): Promise<Semester[]> {
    return cachedAcademicRead('semesters', async () => {
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await supabase.from('semesters').select('*').order('created_at', { ascending: false });
          reportSupabaseOutcome(error);
          if (!error && data && data.length > 0) return data as Semester[];
        } catch (err) {
          reportSupabaseOutcome(err);
          console.warn('Supabase getSemesters fallback:', err);
        }
      }
      return getLocal<Semester[]>(STORAGE_KEYS.SEMESTERS, [
        DEMO_SEMESTER,
        {
          id: 'sem-genap-2026',
          academic_year_id: 'ay-2026',
          semester_type: 'Genap',
          start_date: '2027-01-05',
          end_date: '2027-06-25',
          is_active: false,
          created_at: '2026-07-01T00:00:00+07:00',
        },
      ]);
    });
  },

  // === DATA KELAS (ROMBEL) ===
  async getClasses(): Promise<ClassRoom[]> {
    return cachedAcademicRead('classes', async () => {
      const localClasses = getLocal<ClassRoom[]>(STORAGE_KEYS.CLASSES, DEMO_CLASSES);
      const rawAssignments = getLocal<TeachingAssignment[]>(STORAGE_KEYS.ASSIGNMENTS, []);
      const harvestedClasses = rawAssignments
        .map((a) => a.class)
        .filter((c): c is ClassRoom => Boolean(c && c.id && c.name));

      let remoteClasses: ClassRoom[] = [];
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await supabase.from('classes').select('*').order('level', { ascending: true });
          reportSupabaseOutcome(error);
          if (!error && Array.isArray(data) && data.length > 0) {
            remoteClasses = data as ClassRoom[];
          }
        } catch (err) {
          reportSupabaseOutcome(err);
          console.warn('Supabase getClasses fallback:', err);
        }
      }

      const combined = [...remoteClasses, ...localClasses, ...harvestedClasses];
      const canonicalByKey = new Map<string, ClassRoom>();
      const aliasIdsByCanonicalId = new Map<string, Set<string>>();

      for (const cls of combined) {
        if (!cls || !cls.id) continue;
        const key = getCanonicalClassKey(cls) || cls.id;
        const existing = canonicalByKey.get(key);
        if (!existing) {
          canonicalByKey.set(key, { ...cls });
          aliasIdsByCanonicalId.set(cls.id, new Set([cls.id]));
        } else {
          const preferNew =
            (!isUuid(existing.id) && isUuid(cls.id)) ||
            (remoteClasses.some((r) => r.id === cls.id) && !remoteClasses.some((r) => r.id === existing.id));
          const winner = preferNew ? cls : existing;
          const loser = preferNew ? existing : cls;
          const mergedClass: ClassRoom = {
            ...loser,
            ...winner,
            homeroom_teacher_id: winner.homeroom_teacher_id ?? loser.homeroom_teacher_id ?? null,
          };
          canonicalByKey.set(key, mergedClass);
          const aliases = aliasIdsByCanonicalId.get(existing.id) || new Set([existing.id]);
          aliases.add(cls.id);
          if (mergedClass.id !== existing.id) {
            aliasIdsByCanonicalId.delete(existing.id);
          }
          aliasIdsByCanonicalId.set(mergedClass.id, aliases);
        }
      }

      const classesList = Array.from(canonicalByKey.values());

      // Attach homeroom teacher resolution
      const [homerooms, teachers] = await Promise.all([
        this.getHomeroomAssignments(),
        this.getTeachers(),
      ]);

      return classesList
        .map((c) => {
          const aliases = aliasIdsByCanonicalId.get(c.id) || new Set([c.id]);
          const hr = homerooms.find((h) => aliases.has(h.class_id));
          const localMatch = localClasses.find((lc) => aliases.has(lc.id) && lc.homeroom_teacher_id);
          const teacherId = hr?.teacher_id ?? c.homeroom_teacher_id ?? localMatch?.homeroom_teacher_id ?? null;
          const teacher = teacherId ? teachers.find((t) => t.id === teacherId) : undefined;
          return {
            ...c,
            homeroom_teacher_id: teacherId || null,
            homeroom_teacher: teacher,
          };
        })
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'id'));
    });
  },

  async createClass(payload: Omit<ClassRoom, 'id' | 'created_at'>): Promise<ClassRoom> {
    const id = generateUuid();
    let savedClass: ClassRoom = {
      ...payload,
      id,
      created_at: new Date().toISOString(),
    };
    if (isSupabaseAvailable()) {
      try {
        const { homeroom_teacher_id: _hr, homeroom_teacher: _ht, ...dbClass } = savedClass;
        const { data, error } = await supabase.from('classes').insert(dbClass).select().single();
        reportSupabaseOutcome(error);
        if (!error && data) {
          savedClass = { ...(data as ClassRoom), homeroom_teacher_id: payload.homeroom_teacher_id || null };
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase createClass fallback:', err);
      }
    }

    const classes = getLocal<ClassRoom[]>(STORAGE_KEYS.CLASSES, DEMO_CLASSES);
    const updated = [...classes.filter((c) => c.id !== savedClass.id), savedClass].sort(
      (a, b) => a.level - b.level || a.name.localeCompare(b.name, 'id')
    );
    setLocal(STORAGE_KEYS.CLASSES, updated);

    if (payload.homeroom_teacher_id) {
      await this.assignHomeroomTeacher(savedClass.id, payload.homeroom_teacher_id);
    }

    return savedClass;
  },

  async updateClass(id: string, payload: Partial<ClassRoom>): Promise<ClassRoom> {
    const classes = await this.getClasses();
    const cls = classes.find((c) => c.id === id);
    if (!cls) throw new Error('Data rombel kelas tidak ditemukan');

    const updatedClass: ClassRoom = {
      ...cls,
      ...payload,
    };

    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const { error } = await supabase
          .from('classes')
          .update({
            name: updatedClass.name,
            level: updatedClass.level,
            phase: updatedClass.phase,
            capacity: updatedClass.capacity,
          })
          .eq('id', id);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase updateClass fallback:', err);
      }
    }

    const localClasses = getLocal<ClassRoom[]>(STORAGE_KEYS.CLASSES, DEMO_CLASSES);
    const updated = (localClasses.some((c) => c.id === id)
      ? localClasses.map((c) => (c.id === id ? { ...c, ...updatedClass, homeroom_teacher: undefined } : c))
      : [...localClasses, { ...updatedClass, homeroom_teacher: undefined }]
    ).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'id'));
    setLocal(STORAGE_KEYS.CLASSES, updated);

    if (payload.homeroom_teacher_id !== undefined) {
      if (payload.homeroom_teacher_id) {
        await this.assignHomeroomTeacher(id, payload.homeroom_teacher_id);
      } else {
        await this.removeHomeroomTeacher(id);
      }
    }

    return updatedClass;
  },

  async deleteClass(id: string): Promise<void> {
    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const { error } = await supabase.from('classes').delete().eq('id', id);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase deleteClass fallback:', err);
      }
    }
    await this.removeHomeroomTeacher(id);

    const classes = getLocal<ClassRoom[]>(STORAGE_KEYS.CLASSES, DEMO_CLASSES);
    setLocal(STORAGE_KEYS.CLASSES, classes.filter((c) => c.id !== id));

    const members = getLocal<ClassMember[]>(STORAGE_KEYS.CLASS_MEMBERS, DEMO_CLASS_MEMBERS);
    setLocal(STORAGE_KEYS.CLASS_MEMBERS, members.filter((m) => m.class_id !== id));

    const officials = getLocal<ClassOfficial[]>(STORAGE_KEYS.CLASS_OFFICIALS, DEMO_CLASS_OFFICIALS);
    setLocal(STORAGE_KEYS.CLASS_OFFICIALS, officials.filter((o) => o.class_id !== id));

    const assignments = getLocal<TeachingAssignment[]>(STORAGE_KEYS.ASSIGNMENTS, DEMO_TEACHING_ASSIGNMENTS);
    setLocal(STORAGE_KEYS.ASSIGNMENTS, assignments.filter((a) => a.class_id !== id));
  },

  // === DATA SISWA ===
  async getStudents(): Promise<Student[]> {
    return cachedAcademicRead('students', async () => {
      const localStudents = getLocal<Student[]>(STORAGE_KEYS.STUDENTS, DEMO_STUDENTS);
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await supabase.from('students').select('*').order('full_name', { ascending: true });
          reportSupabaseOutcome(error);
          if (!error && Array.isArray(data)) {
            const remote = data as Student[];
            if (remote.length > 0) {
              const seenIds = new Set(remote.map((s) => s.id));
              const seenNis = new Set(remote.map((s) => s.nis));
              const merged = [...remote];
              for (const ls of localStudents) {
                if (!seenIds.has(ls.id) && !seenNis.has(ls.nis)) {
                  merged.push(ls);
                }
              }
              return merged.sort((a, b) => a.full_name.localeCompare(b.full_name, 'id'));
            }
          }
        } catch (err) {
          reportSupabaseOutcome(err);
          console.warn('Supabase getStudents fallback:', err);
        }
      }
      return [...localStudents].sort((a, b) => a.full_name.localeCompare(b.full_name, 'id'));
    });
  },

  async createStudent(payload: Omit<Student, 'id' | 'created_at' | 'updated_at'>): Promise<Student> {
    const normalizedNis = String(payload.nis || '').trim();
    const normalizedNisn = payload.nisn && String(payload.nisn).trim() !== '' ? String(payload.nisn).trim() : null;
    const now = new Date().toISOString();

    const cleanPayload: Omit<Student, 'id' | 'created_at' | 'updated_at'> = {
      ...payload,
      nis: normalizedNis,
      nisn: normalizedNisn,
      nickname: payload.nickname && String(payload.nickname).trim() !== '' ? String(payload.nickname).trim() : null,
    };

    const id = generateUuid();
    let savedStudent: Student = {
      ...cleanPayload,
      id,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseAvailable()) {
      try {
        // Cek apakah NIS sudah ada di database cloud agar tidak gagal constraint UNIQUE(nis)
        if (normalizedNis) {
          const { data: existingCloud, error: checkErr } = await supabase
            .from('students')
            .select('*')
            .eq('nis', normalizedNis)
            .maybeSingle();
          reportSupabaseOutcome(checkErr);

          if (!checkErr && existingCloud?.id) {
            const { data: updatedCloud, error: updErr } = await supabase
              .from('students')
              .update({ ...cleanPayload, updated_at: now })
              .eq('id', existingCloud.id)
              .select()
              .single();
            reportSupabaseOutcome(updErr);
            if (!updErr && updatedCloud) {
              savedStudent = updatedCloud as Student;
            } else {
              savedStudent = { ...(existingCloud as Student), ...cleanPayload, updated_at: now };
            }
            const localStudents = getLocal<Student[]>(STORAGE_KEYS.STUDENTS, DEMO_STUDENTS);
            const merged = [
              savedStudent,
              ...localStudents.filter((s) => s.id !== savedStudent.id && s.nis.trim() !== normalizedNis),
            ];
            setLocal(STORAGE_KEYS.STUDENTS, merged);
            return savedStudent;
          }
        }

        const { data, error } = await supabase.from('students').insert(savedStudent).select().single();
        reportSupabaseOutcome(error);
        if (!error && data) {
          savedStudent = data as Student;
        } else if (error) {
          console.warn('Supabase createStudent insert error:', error.message);
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase createStudent fallback:', err);
      }
    }
    const localStudents = getLocal<Student[]>(STORAGE_KEYS.STUDENTS, DEMO_STUDENTS);
    const updated = [
      savedStudent,
      ...localStudents.filter((s) => s.id !== savedStudent.id && (!normalizedNis || s.nis.trim() !== normalizedNis)),
    ];
    setLocal(STORAGE_KEYS.STUDENTS, updated);
    return savedStudent;
  },

  async updateStudent(id: string, payload: Partial<Student>): Promise<Student> {
    const students = await this.getStudents();
    const student = students.find((s) => s.id === id);
    if (!student) throw new Error('Data siswa tidak ditemukan');

    const normalizedPayload: Partial<Student> = {
      ...payload,
      ...(payload.nis !== undefined ? { nis: String(payload.nis).trim() } : {}),
      ...(payload.nisn !== undefined
        ? { nisn: payload.nisn && String(payload.nisn).trim() !== '' ? String(payload.nisn).trim() : null }
        : {}),
      ...(payload.nickname !== undefined
        ? { nickname: payload.nickname && String(payload.nickname).trim() !== '' ? String(payload.nickname).trim() : null }
        : {}),
    };

    const updatedStudent: Student = {
      ...student,
      ...normalizedPayload,
      updated_at: new Date().toISOString(),
    };
    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const { error } = await supabase
          .from('students')
          .update({ ...normalizedPayload, updated_at: updatedStudent.updated_at })
          .eq('id', id);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase updateStudent fallback:', err);
      }
    }
    const localStudents = getLocal<Student[]>(STORAGE_KEYS.STUDENTS, DEMO_STUDENTS);
    const existsInLocal = localStudents.some((s) => s.id === id);
    const updated = existsInLocal
      ? localStudents.map((s) => (s.id === id ? updatedStudent : s))
      : [updatedStudent, ...localStudents];
    setLocal(STORAGE_KEYS.STUDENTS, updated);
    return updatedStudent;
  },

  async deleteStudent(id: string): Promise<void> {
    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const { error } = await supabase.from('students').delete().eq('id', id);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase deleteStudent fallback:', err);
      }
    }
    const localStudents = getLocal<Student[]>(STORAGE_KEYS.STUDENTS, DEMO_STUDENTS);
    setLocal(STORAGE_KEYS.STUDENTS, localStudents.filter((s) => s.id !== id));

    const members = getLocal<ClassMember[]>(STORAGE_KEYS.CLASS_MEMBERS, DEMO_CLASS_MEMBERS);
    setLocal(STORAGE_KEYS.CLASS_MEMBERS, members.filter((m) => m.student_id !== id));

    const officials = getLocal<ClassOfficial[]>(STORAGE_KEYS.CLASS_OFFICIALS, DEMO_CLASS_OFFICIALS);
    setLocal(STORAGE_KEYS.CLASS_OFFICIALS, officials.filter((o) => o.student_id !== id));
    emitAcademicSyncEvent([STORAGE_KEYS.STUDENTS, STORAGE_KEYS.CLASS_MEMBERS, STORAGE_KEYS.CLASS_OFFICIALS]);
    void syncService.flushMutations();
  },

  // === DATA GURU ===
  async getTeachers(): Promise<Teacher[]> {
    return cachedAcademicRead('teachers', async () => {
      const localTeachers = getLocal<Teacher[]>(STORAGE_KEYS.TEACHERS, DEMO_TEACHERS);
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await supabase.from('teachers').select('*').order('full_name', { ascending: true });
          reportSupabaseOutcome(error);
          if (!error && Array.isArray(data)) {
            const remoteTeachers = data as Teacher[];
            const merged: Teacher[] = [...remoteTeachers];
            const seenIds = new Set(remoteTeachers.map((t) => t.id));
            const seenNames = new Set(remoteTeachers.map((t) => normalizePersonName(t.full_name)));
            const seenNips = new Set(
              remoteTeachers.map((t) => cleanTeacherIdentifier(t.nip)).filter(Boolean) as string[]
            );

            for (const lt of localTeachers) {
              const normName = normalizePersonName(lt.full_name);
              const normNip = cleanTeacherIdentifier(lt.nip);
              if (seenIds.has(lt.id) || (normNip && seenNips.has(normNip)) || seenNames.has(normName)) {
                continue;
              }
              merged.push(lt);
              seenIds.add(lt.id);
              seenNames.add(normName);
              if (normNip) seenNips.add(normNip);
            }

            return reconcileTeachersWithSyncedAccounts(merged);
          }
        } catch (err) {
          reportSupabaseOutcome(err);
          console.warn('Supabase getTeachers fallback:', err);
        }
      }
      return reconcileTeachersWithSyncedAccounts(localTeachers);
    });
  },

  async createTeacher(payload: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>): Promise<Teacher> {
    const id = generateUuid();
    const now = new Date().toISOString();
    const cleanNip = cleanTeacherIdentifier(payload.nip);
    const cleanNuptk = cleanTeacherIdentifier(payload.nuptk);
    const cleanPhone = cleanTeacherIdentifier(payload.phone_number);

    let savedTeacher: Teacher = {
      ...payload,
      nip: cleanNip,
      nuptk: cleanNuptk,
      phone_number: cleanPhone,
      id,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseAvailable()) {
      try {
        const supabasePayload = {
          ...savedTeacher,
          user_id: isUuid(payload.user_id) ? payload.user_id : null,
        };
        let { data, error } = await supabase.from('teachers').insert(supabasePayload).select().single();
        if (error && supabasePayload.user_id !== null && !detectSupabaseQuotaError(error)) {
          const retry = await supabase
            .from('teachers')
            .insert({ ...supabasePayload, user_id: null })
            .select()
            .single();
          data = retry.data;
          error = retry.error;
        }
        reportSupabaseOutcome(error);
        if (!error && data) {
          savedTeacher = data as Teacher;
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase createTeacher fallback:', err);
      }
    }

    const localTeachers = getLocal<Teacher[]>(STORAGE_KEYS.TEACHERS, DEMO_TEACHERS);
    const updated = [savedTeacher, ...localTeachers.filter((t) => t.id !== savedTeacher.id)];
    setLocal(STORAGE_KEYS.TEACHERS, updated);
    return savedTeacher;
  },

  async updateTeacher(id: string, payload: Partial<Teacher>): Promise<Teacher> {
    const teachers = await this.getTeachers();
    const teacher = teachers.find((t) => t.id === id);
    if (!teacher) throw new Error('Data tenaga pendidik tidak ditemukan');

    const cleanPayload: Partial<Teacher> = {
      ...payload,
      ...(payload.nip !== undefined ? { nip: cleanTeacherIdentifier(payload.nip) } : {}),
      ...(payload.nuptk !== undefined ? { nuptk: cleanTeacherIdentifier(payload.nuptk) } : {}),
      ...(payload.phone_number !== undefined ? { phone_number: cleanTeacherIdentifier(payload.phone_number) } : {}),
    };

    const updatedTeacher: Teacher = {
      ...teacher,
      ...cleanPayload,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const supabaseUpdate: Partial<Teacher> = { ...cleanPayload };
        if ('user_id' in supabaseUpdate && !isUuid(supabaseUpdate.user_id)) {
          delete supabaseUpdate.user_id;
        }
        const { error } = await supabase.from('teachers').update(supabaseUpdate).eq('id', id);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase updateTeacher fallback:', err);
      }
    }

    const localTeachers = getLocal<Teacher[]>(STORAGE_KEYS.TEACHERS, DEMO_TEACHERS);
    const existsInLocal = localTeachers.some((t) => t.id === id);
    const updated = existsInLocal
      ? localTeachers.map((t) => (t.id === id ? updatedTeacher : t))
      : [updatedTeacher, ...localTeachers];
    setLocal(STORAGE_KEYS.TEACHERS, updated);

    // Sinkronkan balik perubahan data guru ke akun tertaut di Manajemen Akun
    try {
      const rawUsers = localStorage.getItem(USERS_SYNC_STORAGE_KEY);
      if (rawUsers) {
        const parsedUsers = JSON.parse(rawUsers);
        if (Array.isArray(parsedUsers)) {
          let touched = false;
          const nextUsers = parsedUsers.map((u: any) => {
            if (u.teacher_info?.id === id || (updatedTeacher.user_id && u.id === updatedTeacher.user_id)) {
              touched = true;
              return {
                ...u,
                full_name: updatedTeacher.full_name,
                title_prefix: updatedTeacher.title_prefix,
                title_suffix: updatedTeacher.title_suffix,
                nip: updatedTeacher.nip,
                nuptk: updatedTeacher.nuptk,
                gender: updatedTeacher.gender,
                phone_number: updatedTeacher.phone_number,
                specialization: updatedTeacher.specialization,
                is_active: updatedTeacher.is_active,
                teacher_info: {
                  id: updatedTeacher.id,
                  nip: updatedTeacher.nip,
                  specialization: updatedTeacher.specialization,
                },
              };
            }
            return u;
          });
          if (touched) setLocal(USERS_SYNC_STORAGE_KEY, nextUsers);
        }
      }
    } catch {
      // ignore
    }

    return updatedTeacher;
  },

  async deleteTeacher(id: string): Promise<void> {
    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const { error } = await supabase.from('teachers').delete().eq('id', id);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase deleteTeacher fallback:', err);
      }
    }
    const localTeachers = getLocal<Teacher[]>(STORAGE_KEYS.TEACHERS, DEMO_TEACHERS);
    const target = localTeachers.find((t) => t.id === id);
    const updated = localTeachers.filter((t) => t.id !== id);
    setLocal(STORAGE_KEYS.TEACHERS, updated);

    // Putuskan tautan di akun agar tidak otomatis dibuat ulang sampai admin mengaktifkan ulang
    try {
      const rawUsers = localStorage.getItem(USERS_SYNC_STORAGE_KEY);
      if (rawUsers) {
        const parsedUsers = JSON.parse(rawUsers);
        if (Array.isArray(parsedUsers)) {
          let touched = false;
          const nextUsers = parsedUsers.map((u: any) => {
            if (u.teacher_info?.id === id || (target?.user_id && u.id === target.user_id)) {
              touched = true;
              return { ...u, teacher_info: null, teacher_detached: true };
            }
            return u;
          });
          if (touched) setLocal(USERS_SYNC_STORAGE_KEY, nextUsers);
        }
      }
    } catch {
      // ignore
    }
  },

  // === RESOLUSI IDENTITAS GURU & WALI KELAS ===
  async resolveTeacherForUser(
    user?: {
      id?: string;
      email?: string;
      profile?: { full_name?: string; nip?: string | null };
      teacherId?: string | null;
    } | null
  ): Promise<Teacher | null> {
    if (!user) return null;
    const teachers = await this.getTeachers();
    if (teachers.length === 0) return null;

    let cachedMatchedUser: any = null;
    try {
      const rawUsers = localStorage.getItem(USERS_SYNC_STORAGE_KEY);
      if (rawUsers) {
        const parsedUsers = JSON.parse(rawUsers);
        if (Array.isArray(parsedUsers)) {
          const emailLower = String(user.email || '').trim().toLowerCase();
          cachedMatchedUser = parsedUsers.find(
            (u: any) =>
              (user.id && u.id === user.id) ||
              (emailLower && String(u.email || '').trim().toLowerCase() === emailLower) ||
              (user.teacherId && u.teacher_info?.id === user.teacherId)
          );
        }
      }
    } catch {
      // ignore parse error
    }

    const candidateUserIds = new Set<string>();
    if (user.id) candidateUserIds.add(user.id);
    if (cachedMatchedUser?.id) candidateUserIds.add(cachedMatchedUser.id);

    if (user.teacherId) {
      const byDirectId = teachers.find((t) => t.id === user.teacherId);
      if (byDirectId) return byDirectId;
    }

    if (cachedMatchedUser?.teacher_info?.id) {
      const byUserCacheId = teachers.find((t) => t.id === cachedMatchedUser.teacher_info.id);
      if (byUserCacheId) return byUserCacheId;
    }

    if (candidateUserIds.size > 0) {
      const byUserId = teachers.find((t) => t.user_id && candidateUserIds.has(t.user_id));
      if (byUserId) return byUserId;
    }

    const profileNip = compactTeacherIdentifier(user.profile?.nip);
    if (profileNip) {
      const byProfileNip = teachers.find((t) => compactTeacherIdentifier(t.nip) === profileNip);
      if (byProfileNip) return byProfileNip;
    }

    const cacheNip = compactTeacherIdentifier(cachedMatchedUser?.nip || cachedMatchedUser?.teacher_info?.nip);
    if (cacheNip) {
      const byCacheNip = teachers.find((t) => compactTeacherIdentifier(t.nip) === cacheNip);
      if (byCacheNip) return byCacheNip;
    }

    const cacheNuptk = compactTeacherIdentifier(cachedMatchedUser?.nuptk);
    if (cacheNuptk) {
      const byCacheNuptk = teachers.find((t) => compactTeacherIdentifier(t.nuptk) === cacheNuptk);
      if (byCacheNuptk) return byCacheNuptk;
    }

    if (cachedMatchedUser?.full_name) {
      const normCached = normalizePersonName(cachedMatchedUser.full_name);
      const byCachedName = teachers.find(
        (t) =>
          normalizePersonName(t.full_name) === normCached ||
          normalizePersonName(getTeacherDisplayName(t)) === normCached
      );
      if (byCachedName) return byCachedName;

      const strippedCached = stripPersonTitles(cachedMatchedUser.full_name);
      if (strippedCached) {
        const byStrippedCached = teachers.find(
          (t) =>
            stripPersonTitles(t.full_name) === strippedCached ||
            stripPersonTitles(getTeacherDisplayName(t)) === strippedCached
        );
        if (byStrippedCached) return byStrippedCached;
      }
    }

    const normFull = normalizePersonName(user.profile?.full_name);
    if (normFull) {
      const byExactName = teachers.find(
        (t) =>
          normalizePersonName(t.full_name) === normFull ||
          normalizePersonName(getTeacherDisplayName(t)) === normFull
      );
      if (byExactName) return byExactName;

      const strippedTarget = stripPersonTitles(user.profile?.full_name);
      if (strippedTarget) {
        const byStripped = teachers.find(
          (t) =>
            stripPersonTitles(t.full_name) === strippedTarget ||
            stripPersonTitles(getTeacherDisplayName(t)) === strippedTarget
        );
        if (byStripped) return byStripped;
      }
    }

    return null;
  },

  getMatchingTeacherIdsForUser(
    user?: {
      id?: string;
      email?: string;
      profile?: { full_name?: string; nip?: string | null };
      teacherId?: string | null;
    } | null,
    resolvedTeacher?: Teacher | null,
    teachersPool?: Teacher[]
  ): {
    candidateTeacherIds: Set<string>;
    candidateUserIds: Set<string>;
    matchesTeacherRecord: (t?: Partial<Teacher> | null) => boolean;
  } {
    const candidateUserIds = new Set<string>();
    const candidateTeacherIds = new Set<string>();
    const candidateNips = new Set<string>();
    const candidateNuptks = new Set<string>();
    const candidateStrippedNames = new Set<string>();

    if (!user && !resolvedTeacher) {
      return {
        candidateTeacherIds,
        candidateUserIds,
        matchesTeacherRecord: () => false,
      };
    }

    if (user?.id) candidateUserIds.add(user.id);

    const addTeacherIdentifiers = (t?: Partial<Teacher> | null) => {
      if (!t) return;
      if (t.id) candidateTeacherIds.add(t.id);
      if (t.user_id) candidateUserIds.add(t.user_id);
      const nip = compactTeacherIdentifier(t.nip);
      if (nip) candidateNips.add(nip);
      const nuptk = compactTeacherIdentifier(t.nuptk);
      if (nuptk) candidateNuptks.add(nuptk);
      const s1 = stripPersonTitles(t.full_name);
      if (s1) candidateStrippedNames.add(s1);
      const s2 = stripPersonTitles(getTeacherDisplayName(t));
      if (s2) candidateStrippedNames.add(s2);
    };

    addTeacherIdentifiers(resolvedTeacher);
    if (user?.teacherId) candidateTeacherIds.add(user.teacherId);

    const profileNip = compactTeacherIdentifier(user?.profile?.nip);
    if (profileNip) candidateNips.add(profileNip);
    const profileStripped = stripPersonTitles(user?.profile?.full_name);
    if (profileStripped) candidateStrippedNames.add(profileStripped);

    const activeOtherUserIds = new Set<string>();
    if (typeof window !== 'undefined' && user) {
      try {
        const rawUsers = localStorage.getItem(USERS_SYNC_STORAGE_KEY);
        if (rawUsers) {
          const parsedUsers = JSON.parse(rawUsers);
          if (Array.isArray(parsedUsers)) {
            const emailLower = String(user.email || '').trim().toLowerCase();
            const cachedMatchedUser = parsedUsers.find(
              (u: any) =>
                (user.id && u.id === user.id) ||
                (emailLower && String(u.email || '').trim().toLowerCase() === emailLower) ||
                (user.teacherId && u.teacher_info?.id === user.teacherId)
            );
            if (cachedMatchedUser) {
              if (cachedMatchedUser.id) candidateUserIds.add(cachedMatchedUser.id);
              if (cachedMatchedUser.teacher_info?.id) {
                candidateTeacherIds.add(cachedMatchedUser.teacher_info.id);
              }
              const uNip = compactTeacherIdentifier(cachedMatchedUser.nip || cachedMatchedUser.teacher_info?.nip);
              if (uNip) candidateNips.add(uNip);
              const uNuptk = compactTeacherIdentifier(cachedMatchedUser.nuptk);
              if (uNuptk) candidateNuptks.add(uNuptk);
              const uName = stripPersonTitles(cachedMatchedUser.full_name);
              if (uName) candidateStrippedNames.add(uName);
            }

            // Kumpulkan user_id milik akun orang lain yang benar-benar berbeda identitasnya
            for (const pu of parsedUsers) {
              if (!pu?.id || candidateUserIds.has(pu.id)) continue;
              const puEmail = String(pu.email || '').trim().toLowerCase();
              if (emailLower && puEmail === emailLower) {
                candidateUserIds.add(pu.id);
                continue;
              }
              const puName = stripPersonTitles(pu.full_name);
              const puNip = compactTeacherIdentifier(pu.nip || pu.teacher_info?.nip);
              const samePersonByIdentity =
                Boolean(puName && candidateStrippedNames.has(puName)) ||
                Boolean(puNip && candidateNips.has(puNip));
              if (!samePersonByIdentity) {
                activeOtherUserIds.add(pu.id);
              }
            }
          }
        }
      } catch {
        // ignore parse error
      }
    }

    const pool: Teacher[] =
      teachersPool && teachersPool.length > 0
        ? teachersPool
        : typeof window !== 'undefined'
        ? getLocal<Teacher[]>(STORAGE_KEYS.TEACHERS, DEMO_TEACHERS)
        : [];

    const matchesTeacherRecord = (t?: Partial<Teacher> | null): boolean => {
      if (!t) return false;
      if (t.id && candidateTeacherIds.has(t.id)) return true;
      if (t.user_id && candidateUserIds.has(t.user_id)) return true;
      const tNip = compactTeacherIdentifier(t.nip);
      if (tNip && candidateNips.has(tNip)) return true;
      const tNuptk = compactTeacherIdentifier(t.nuptk);
      if (tNuptk && candidateNuptks.has(tNuptk)) return true;

      // Tolak pencocokan nama hanya jika record jelas milik akun aktif orang lain atau NIP berbeda
      if (t.user_id && activeOtherUserIds.has(t.user_id)) return false;
      if (tNip && candidateNips.size > 0 && !candidateNips.has(tNip)) return false;

      const s1 = stripPersonTitles(t.full_name);
      const s2 = stripPersonTitles(getTeacherDisplayName(t));
      return Boolean((s1 && candidateStrippedNames.has(s1)) || (s2 && candidateStrippedNames.has(s2)));
    };

    for (const t of pool) {
      if (matchesTeacherRecord(t)) {
        candidateTeacherIds.add(t.id);
      }
    }

    return { candidateTeacherIds, candidateUserIds, matchesTeacherRecord };
  },

  /**
   * Memfilter daftar penugasan mengajar agar seluruh penugasan milik guru aktif
   * tetap terbaca meskipun terdapat perbedaan ID antara cache lokal, akun pengguna, atau database cloud.
   */
  filterAssignmentsForUser(
    assignments: TeachingAssignment[],
    user?: {
      id?: string;
      email?: string;
      profile?: { full_name?: string; nip?: string | null };
      teacherId?: string | null;
    } | null,
    resolvedTeacher?: Teacher | null,
    teachersPool?: Teacher[]
  ): TeachingAssignment[] {
    if (!user && !resolvedTeacher) return [];

    const { candidateTeacherIds, matchesTeacherRecord } = this.getMatchingTeacherIdsForUser(
      user,
      resolvedTeacher,
      teachersPool
    );

    return assignments.filter((a) => {
      if (candidateTeacherIds.has(a.teacher_id)) return true;
      if (a.teacher && matchesTeacherRecord(a.teacher)) return true;
      return false;
    });
  },

  async resolveHomeroomClassForUser(
    user?: {
      id?: string;
      email?: string;
      profile?: { full_name?: string; nip?: string | null };
      teacherId?: string | null;
      homeroomClassId?: string | null;
    } | null,
    resolvedTeacher?: Teacher | null
  ): Promise<ClassRoom | null> {
    if (!user) return null;
    const [classes, homerooms, teachersPool] = await Promise.all([
      this.getClasses(),
      this.getHomeroomAssignments(),
      this.getTeachers(),
    ]);

    const teacher = resolvedTeacher ?? (await this.resolveTeacherForUser(user));
    const { candidateTeacherIds } = this.getMatchingTeacherIdsForUser(user, teacher, teachersPool);

    if (candidateTeacherIds.size > 0) {
      const hr = homerooms.find((h) => candidateTeacherIds.has(h.teacher_id));
      if (hr) {
        const matched = classes.find((c) => c.id === hr.class_id);
        if (matched) return matched;
      }
      const clsByHr = classes.find(
        (c) => c.homeroom_teacher_id && candidateTeacherIds.has(c.homeroom_teacher_id)
      );
      if (clsByHr) return clsByHr;
    }

    if (user.homeroomClassId) {
      const target = await this.resolveClassTarget(user.homeroomClassId, classes);
      if (target) return target;
    }

    return null;
  },

  // === PENUGASAN WALI KELAS (HOMEROOM) ===
  async getHomeroomAssignments(): Promise<HomeroomAssignment[]> {
    return cachedAcademicRead('homerooms', async () => {
      const localList = getLocal<HomeroomAssignment[]>(
        STORAGE_KEYS.HOMEROOM_ASSIGNMENTS,
        DEMO_HOMEROOM_ASSIGNMENTS
      );
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await supabase
            .from('homeroom_assignments')
            .select('*, teacher:teachers(*), class:classes(*)');
          reportSupabaseOutcome(error);
          if (!error && Array.isArray(data) && data.length > 0) {
            const remoteList = data as HomeroomAssignment[];
            const byClass = new Map<string, HomeroomAssignment>();
            for (const r of remoteList) byClass.set(r.class_id, r);
            for (const l of localList) {
              if (!byClass.has(l.class_id)) {
                byClass.set(l.class_id, l);
              }
            }
            return Array.from(byClass.values());
          }
        } catch (err) {
          reportSupabaseOutcome(err);
          console.warn('Supabase getHomeroomAssignments fallback:', err);
        }
      }
      return localList;
    });
  },

  async assignHomeroomTeacher(
    classId: string,
    teacherId: string,
    academicYearId?: string
  ): Promise<HomeroomAssignment> {
    const ctx = await this.resolveActiveAcademicContext();
    const effectiveYearId =
      academicYearId && academicYearId !== 'ay-2026'
        ? academicYearId
        : isUuid(ctx.academicYearId)
        ? ctx.academicYearId
        : academicYearId || ctx.academicYearId;

    const current = await this.getHomeroomAssignments();
    const teachers = await this.getTeachers();
    const teacher = teachers.find((t) => t.id === teacherId);

    const prevEntry = current.find((h) => h.class_id === classId);
    const previousTeacherId = prevEntry?.teacher_id;

    const existingIndex = current.findIndex((h) => h.class_id === classId);
    let result: HomeroomAssignment;

    if (existingIndex >= 0) {
      current[existingIndex] = {
        ...current[existingIndex],
        teacher_id: teacherId,
        teacher: teacher || current[existingIndex].teacher,
        academic_year_id: effectiveYearId,
      };
      result = current[existingIndex];
    } else {
      result = {
        id: `hr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        class_id: classId,
        teacher_id: teacherId,
        academic_year_id: effectiveYearId,
        created_at: new Date().toISOString(),
        teacher,
      };
      current.push(result);
    }

    if (isSupabaseAvailable() && isUuid(classId) && isUuid(teacherId) && isUuid(effectiveYearId)) {
      try {
        const { error } = await supabase.from('homeroom_assignments').upsert(
          {
            class_id: classId,
            teacher_id: teacherId,
            academic_year_id: effectiveYearId,
          },
          { onConflict: 'class_id,academic_year_id' }
        );
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase assignHomeroomTeacher fallback:', err);
      }
    }

    setLocal(STORAGE_KEYS.HOMEROOM_ASSIGNMENTS, current);

    // Sinkronkan juga kolom homeroom_teacher_id pada master classes
    const localClasses = getLocal<ClassRoom[]>(STORAGE_KEYS.CLASSES, DEMO_CLASSES);
    const updatedClasses = localClasses.map((c) =>
      c.id === classId ? { ...c, homeroom_teacher_id: teacherId, homeroom_teacher: undefined } : c
    );
    setLocal(STORAGE_KEYS.CLASSES, updatedClasses);

    // Sinkronkan peran 'wali_kelas' pada akun tertaut
    syncTeacherWaliRoleInUserCache(teacherId, true, teachers);
    if (previousTeacherId && previousTeacherId !== teacherId) {
      const stillHomeroomElsewhere = current.some((h) => h.teacher_id === previousTeacherId);
      if (!stillHomeroomElsewhere) {
        syncTeacherWaliRoleInUserCache(previousTeacherId, false, teachers);
      }
    }

    return result;
  },

  async removeHomeroomTeacher(classId: string): Promise<void> {
    const current = await this.getHomeroomAssignments();
    const removed = current.filter((h) => h.class_id === classId);
    const updated = current.filter((h) => h.class_id !== classId);
    setLocal(STORAGE_KEYS.HOMEROOM_ASSIGNMENTS, updated);

    const localClasses = getLocal<ClassRoom[]>(STORAGE_KEYS.CLASSES, DEMO_CLASSES);
    const updatedClasses = localClasses.map((c) =>
      c.id === classId ? { ...c, homeroom_teacher_id: null, homeroom_teacher: undefined } : c
    );
    setLocal(STORAGE_KEYS.CLASSES, updatedClasses);

    if (removed.length > 0) {
      const teachers = await this.getTeachers();
      for (const item of removed) {
        const stillHomeroomElsewhere = updated.some((h) => h.teacher_id === item.teacher_id);
        if (!stillHomeroomElsewhere) {
          syncTeacherWaliRoleInUserCache(item.teacher_id, false, teachers);
        }
      }
    }

    if (isSupabaseAvailable() && isUuid(classId)) {
      try {
        const { error } = await supabase.from('homeroom_assignments').delete().eq('class_id', classId);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase removeHomeroomTeacher fallback:', err);
      }
    }
  },

  // === DATA MATA PELAJARAN ===
  async getSubjects(): Promise<Subject[]> {
    return cachedAcademicRead('subjects', async () => {
      const localStored = getLocal<Subject[] | null>(STORAGE_KEYS.SUBJECTS, null);
      const localList = Array.isArray(localStored) && localStored.length > 0 ? localStored : DEMO_SUBJECTS;
      const rawAssignments = getLocal<TeachingAssignment[]>(STORAGE_KEYS.ASSIGNMENTS, []);
      const harvestedSubjects = rawAssignments
        .map((a) => a.subject)
        .filter((s): s is Subject => Boolean(s && s.id && s.name));

      let remoteSubjects: Subject[] = [];
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await supabase.from('subjects').select('*').order('order_index', { ascending: true });
          reportSupabaseOutcome(error);
          if (!error && Array.isArray(data) && data.length > 0) {
            remoteSubjects = data as Subject[];
          }
        } catch (err) {
          reportSupabaseOutcome(err);
          console.warn('Supabase getSubjects fallback:', err);
        }
      }

      const combined = [...remoteSubjects, ...localList, ...harvestedSubjects];
      const canonicalByKey = new Map<string, Subject>();

      for (const sbj of combined) {
        if (!sbj || !sbj.id) continue;
        const key = getCanonicalSubjectKey(sbj) || sbj.id;
        const existing = canonicalByKey.get(key);
        if (!existing) {
          canonicalByKey.set(key, sbj);
        } else {
          const preferNew =
            (!isUuid(existing.id) && isUuid(sbj.id)) ||
            (remoteSubjects.some((r) => r.id === sbj.id) && !remoteSubjects.some((r) => r.id === existing.id));
          if (preferNew) {
            canonicalByKey.set(key, sbj);
          }
        }
      }

      return sortSubjectsCanonical(Array.from(canonicalByKey.values()));
    });
  },

  async createSubject(payload: Omit<Subject, 'id' | 'created_at'>): Promise<Subject> {
    const id = generateUuid();
    let newSubject: Subject = {
      ...payload,
      id,
      created_at: new Date().toISOString(),
    };
    if (isSupabaseAvailable()) {
      try {
        const { data, error } = await supabase.from('subjects').insert(newSubject).select().single();
        reportSupabaseOutcome(error);
        if (!error && data) {
          newSubject = data as Subject;
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase createSubject fallback:', err);
      }
    }
    const subjects = await this.getSubjects();
    const updated = sortSubjectsCanonical([
      ...subjects.filter((s) => s.id !== newSubject.id),
      newSubject,
    ]);
    setLocal(STORAGE_KEYS.SUBJECTS, updated);
    return newSubject;
  },

  // === PENUGASAN GURU MENGAJAR ===
  async getTeachingAssignments(): Promise<TeachingAssignment[]> {
    return cachedAcademicRead('assignments', async () => {
      const localRaw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS) : null;
      const localAssignments = getLocal<TeachingAssignment[]>(
        STORAGE_KEYS.ASSIGNMENTS,
        DEMO_TEACHING_ASSIGNMENTS
      );

      let remoteAssignments: TeachingAssignment[] = [];
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await supabase
            .from('teaching_assignments')
            .select('*, teacher:teachers(*), class:classes(*), subject:subjects(*)');
          reportSupabaseOutcome(error);
          if (!error && Array.isArray(data) && data.length > 0) {
            remoteAssignments = data as TeachingAssignment[];
          }
        } catch (err) {
          reportSupabaseOutcome(err);
          console.warn('Supabase getTeachingAssignments fallback:', err);
        }
      }

      const [teachers, classes, subjects] = await Promise.all([
        this.getTeachers(),
        this.getClasses(),
        this.getSubjects(),
      ]);

      const classById = new Map<string, ClassRoom>(classes.map((c) => [c.id, c]));
      const classByCanonicalKey = new Map<string, ClassRoom>();
      for (const c of classes) {
        const key = getCanonicalClassKey(c);
        if (key && !classByCanonicalKey.has(key)) classByCanonicalKey.set(key, c);
      }
      for (const dc of DEMO_CLASSES) {
        const key = getCanonicalClassKey(dc);
        const target = key ? classByCanonicalKey.get(key) : undefined;
        if (target && !classById.has(dc.id)) {
          classById.set(dc.id, target);
        }
      }

      const subjectById = new Map<string, Subject>(subjects.map((s) => [s.id, s]));
      const subjectByCanonicalKey = new Map<string, Subject>();
      for (const s of subjects) {
        const key = getCanonicalSubjectKey(s);
        if (key && !subjectByCanonicalKey.has(key)) subjectByCanonicalKey.set(key, s);
      }
      for (const ds of DEMO_SUBJECTS) {
        const key = getCanonicalSubjectKey(ds);
        const target = key ? subjectByCanonicalKey.get(key) : undefined;
        if (target && !subjectById.has(ds.id)) {
          subjectById.set(ds.id, target);
        }
      }

      const resolveCanonicalClass = (rawClassId: string, embedded?: ClassRoom): ClassRoom | undefined => {
        if (classById.has(rawClassId)) return classById.get(rawClassId);
        if (embedded) {
          const k = getCanonicalClassKey(embedded);
          if (k && classByCanonicalKey.has(k)) return classByCanonicalKey.get(k);
        }
        const parsedLevel = parseClassLevelFromInput(rawClassId);
        if (parsedLevel !== null) {
          return classes.find((c) => c.level === parsedLevel) || embedded;
        }
        return embedded;
      };

      const resolveCanonicalSubject = (rawSubjectId: string, embedded?: Subject): Subject | undefined => {
        if (subjectById.has(rawSubjectId)) return subjectById.get(rawSubjectId);
        if (embedded) {
          const k = getCanonicalSubjectKey(embedded);
          if (k && subjectByCanonicalKey.has(k)) return subjectByCanonicalKey.get(k);
        }
        return embedded;
      };

      const resolveCanonicalTeacher = (rawTeacherId: string, embedded?: Teacher): Teacher | undefined => {
        const direct = teachers.find((t) => t.id === rawTeacherId);
        if (direct) return direct;
        if (embedded) {
          if (embedded.user_id) {
            const byUser = teachers.find((t) => t.user_id === embedded.user_id);
            if (byUser) return byUser;
          }
          const embNip = compactTeacherIdentifier(embedded.nip);
          if (embNip) {
            const byNip = teachers.find((t) => compactTeacherIdentifier(t.nip) === embNip);
            if (byNip) return byNip;
          }
          const embStripped = stripPersonTitles(embedded.full_name);
          if (embStripped) {
            const byName = teachers.find((t) => stripPersonTitles(t.full_name) === embStripped);
            if (byName) return byName;
          }
        }
        return embedded;
      };

      const rawCombined: Array<{ item: TeachingAssignment; fromRemote: boolean }> =
        localRaw === null && remoteAssignments.length > 0
          ? remoteAssignments.map((item) => ({ item, fromRemote: true }))
          : [
              ...remoteAssignments.map((item) => ({ item, fromRemote: true })),
              ...localAssignments.map((item) => ({ item, fromRemote: false })),
            ];

      if (rawCombined.length === 0) return [];

      const mergedByPair = new Map<string, { assignment: TeachingAssignment; ts: number; score: number }>();

      for (const { item, fromRemote } of rawCombined) {
        const resolvedClass = resolveCanonicalClass(item.class_id, item.class);
        const resolvedSubject = resolveCanonicalSubject(item.subject_id, item.subject);
        const resolvedTeacher = resolveCanonicalTeacher(item.teacher_id, item.teacher);

        const canonicalClassId = resolvedClass?.id || item.class_id;
        const canonicalSubjectId = resolvedSubject?.id || item.subject_id;
        const canonicalTeacherId = resolvedTeacher?.id || item.teacher_id;
        const pairKey = `${canonicalClassId}_${canonicalSubjectId}`;

        const normalized: TeachingAssignment = {
          ...item,
          class_id: canonicalClassId,
          subject_id: canonicalSubjectId,
          teacher_id: canonicalTeacherId,
          teacher: resolvedTeacher || item.teacher,
          class: resolvedClass || item.class,
          subject: resolvedSubject || item.subject,
        };

        const ts = Date.parse(item.updated_at || item.created_at || '') || 0;
        const score =
          (fromRemote ? 4 : 0) +
          (isUuid(item.class_id) && isUuid(item.subject_id) ? 2 : 0) +
          (isUuid(item.id) ? 1 : 0);

        const existing = mergedByPair.get(pairKey);
        if (!existing) {
          mergedByPair.set(pairKey, { assignment: normalized, ts, score });
        } else if (ts > existing.ts || (ts === existing.ts && score > existing.score)) {
          mergedByPair.set(pairKey, { assignment: normalized, ts, score });
        }
      }

      return Array.from(mergedByPair.values()).map((v) => v.assignment);
    });
  },

  async createTeachingAssignment(
    payload: Omit<TeachingAssignment, 'id' | 'created_at' | 'teacher' | 'class' | 'subject'>
  ): Promise<TeachingAssignment> {
    const [ctx, teachers, classes, subjects, current] = await Promise.all([
      this.resolveActiveAcademicContext(),
      this.getTeachers(),
      this.getClasses(),
      this.getSubjects(),
      this.getTeachingAssignments(),
    ]);

    const resolvedClass =
      (await this.resolveClassTarget(payload.class_id, classes)) ||
      classes.find((c) => c.id === payload.class_id);
    const effectiveClassId = resolvedClass?.id || payload.class_id;

    const subjectById = new Map(subjects.map((s) => [s.id, s]));
    const resolvedSubject =
      subjectById.get(payload.subject_id) ||
      (() => {
        const ds = DEMO_SUBJECTS.find((d) => d.id === payload.subject_id);
        if (!ds) return undefined;
        const key = getCanonicalSubjectKey(ds);
        return subjects.find((s) => getCanonicalSubjectKey(s) === key);
      })();
    const effectiveSubjectId = resolvedSubject?.id || payload.subject_id;

    const effectiveYearId =
      payload.academic_year_id && payload.academic_year_id !== 'ay-2026'
        ? payload.academic_year_id
        : ctx.academicYearId;
    const effectiveSemesterId =
      payload.semester_id && payload.semester_id !== 'sem-ganjil-2026'
        ? payload.semester_id
        : ctx.semesterId;

    const now = new Date().toISOString();
    let newAssignment: TeachingAssignment = {
      ...payload,
      class_id: effectiveClassId,
      subject_id: effectiveSubjectId,
      academic_year_id: effectiveYearId,
      semester_id: effectiveSemesterId,
      id: `asg-${effectiveClassId}-${effectiveSubjectId}`,
      created_at: now,
      updated_at: now,
      teacher: teachers.find((t) => t.id === payload.teacher_id),
      class: resolvedClass,
      subject: resolvedSubject,
    };

    if (
      isSupabaseAvailable() &&
      isUuid(effectiveClassId) &&
      isUuid(effectiveSubjectId) &&
      isUuid(payload.teacher_id) &&
      isUuid(effectiveYearId) &&
      isUuid(effectiveSemesterId)
    ) {
      try {
        const { data, error } = await supabase
          .from('teaching_assignments')
          .upsert(
            {
              class_id: effectiveClassId,
              subject_id: effectiveSubjectId,
              teacher_id: payload.teacher_id,
              academic_year_id: effectiveYearId,
              semester_id: effectiveSemesterId,
            },
            { onConflict: 'class_id,subject_id,academic_year_id,semester_id' }
          )
          .select()
          .maybeSingle();
        reportSupabaseOutcome(error);
        if (!error && data) {
          newAssignment = {
            ...(data as TeachingAssignment),
            updated_at: now,
            teacher: newAssignment.teacher,
            class: newAssignment.class,
            subject: newAssignment.subject,
          };
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase createTeachingAssignment fallback:', err);
      }
    }

    const updated = [
      newAssignment,
      ...current.filter(
        (a) => !(a.class_id === effectiveClassId && a.subject_id === effectiveSubjectId)
      ),
    ];
    setLocal(STORAGE_KEYS.ASSIGNMENTS, updated);
    return newAssignment;
  },

  async upsertTeachingAssignment(
    classId: string,
    subjectId: string,
    teacherId: string,
    academicYearId?: string,
    semesterId?: string
  ): Promise<TeachingAssignment | null> {
    const [ctx, teachers, classes, subjects, current] = await Promise.all([
      this.resolveActiveAcademicContext(),
      this.getTeachers(),
      this.getClasses(),
      this.getSubjects(),
      this.getTeachingAssignments(),
    ]);

    const effectiveYearId =
      academicYearId && academicYearId !== 'ay-2026'
        ? academicYearId
        : isUuid(ctx.academicYearId)
        ? ctx.academicYearId
        : academicYearId || ctx.academicYearId;
    const effectiveSemesterId =
      semesterId && semesterId !== 'sem-ganjil-2026'
        ? semesterId
        : isUuid(ctx.semesterId)
        ? ctx.semesterId
        : semesterId || ctx.semesterId;

    const resolvedClass =
      classes.find((c) => c.id === classId) ||
      (await this.resolveClassTarget(classId, classes)) ||
      undefined;
    const canonicalClassId = resolvedClass?.id || classId;

    const resolvedSubject =
      subjects.find((s) => s.id === subjectId) ||
      (() => {
        const ds = DEMO_SUBJECTS.find((d) => d.id === subjectId);
        if (!ds) return undefined;
        const key = getCanonicalSubjectKey(ds);
        return subjects.find((s) => getCanonicalSubjectKey(s) === key);
      })();
    const canonicalSubjectId = resolvedSubject?.id || subjectId;

    // Pastikan master classes & subjects di localStorage ikut rapi dan kanonikal agar lintas perangkat selaras
    const storedClasses = getLocal<ClassRoom[]>(STORAGE_KEYS.CLASSES, []);
    if (storedClasses.length !== classes.length || storedClasses.some((c, i) => classes[i]?.id !== c.id)) {
      setLocal(
        STORAGE_KEYS.CLASSES,
        classes.map(({ homeroom_teacher: _ht, ...rest }) => rest)
      );
    }
    const storedSubjects = getLocal<Subject[]>(STORAGE_KEYS.SUBJECTS, []);
    if (storedSubjects.length === 0 || storedSubjects.some((s) => !isUuid(s.id) && subjects.some((cs) => cs.id !== s.id && getCanonicalSubjectKey(cs) === getCanonicalSubjectKey(s)))) {
      setLocal(STORAGE_KEYS.SUBJECTS, subjects);
    }

    // Jika dikosongkan ('unassigned' atau '')
    if (!teacherId || teacherId === 'unassigned') {
      const filtered = current.filter(
        (a) => !(a.class_id === canonicalClassId && a.subject_id === canonicalSubjectId)
      );
      setLocal(STORAGE_KEYS.ASSIGNMENTS, filtered);
      if (isSupabaseAvailable() && isUuid(canonicalClassId) && isUuid(canonicalSubjectId)) {
        try {
          const matchObj: Record<string, string> = {
            class_id: canonicalClassId,
            subject_id: canonicalSubjectId,
          };
          if (isUuid(effectiveYearId)) matchObj.academic_year_id = effectiveYearId;
          if (isUuid(effectiveSemesterId)) matchObj.semester_id = effectiveSemesterId;
          const { error } = await supabase.from('teaching_assignments').delete().match(matchObj);
          reportSupabaseOutcome(error);
        } catch (e) {
          reportSupabaseOutcome(e);
          console.warn('Supabase delete assignment error:', e);
        }
      }
      return null;
    }

    const teacher = teachers.find((t) => t.id === teacherId);
    const now = new Date().toISOString();
    const existingIndex = current.findIndex(
      (a) => a.class_id === canonicalClassId && a.subject_id === canonicalSubjectId
    );

    let result: TeachingAssignment;
    let nextAssignments: TeachingAssignment[];

    if (existingIndex >= 0) {
      result = {
        ...current[existingIndex],
        class_id: canonicalClassId,
        subject_id: canonicalSubjectId,
        teacher_id: teacherId,
        academic_year_id: effectiveYearId || current[existingIndex].academic_year_id,
        semester_id: effectiveSemesterId || current[existingIndex].semester_id,
        updated_at: now,
        teacher: teacher || current[existingIndex].teacher,
        class: resolvedClass || current[existingIndex].class,
        subject: resolvedSubject || current[existingIndex].subject,
      };
      nextAssignments = current.map((a, idx) => (idx === existingIndex ? result : a));
    } else {
      result = {
        id: `asg-${canonicalClassId}-${canonicalSubjectId}`,
        class_id: canonicalClassId,
        subject_id: canonicalSubjectId,
        teacher_id: teacherId,
        academic_year_id: effectiveYearId,
        semester_id: effectiveSemesterId,
        created_at: now,
        updated_at: now,
        teacher,
        class: resolvedClass,
        subject: resolvedSubject,
      };
      nextAssignments = [result, ...current];
    }

    setLocal(STORAGE_KEYS.ASSIGNMENTS, nextAssignments);

    if (
      isSupabaseAvailable() &&
      isUuid(canonicalClassId) &&
      isUuid(canonicalSubjectId) &&
      isUuid(teacherId)
    ) {
      try {
        if (isUuid(effectiveYearId) && isUuid(effectiveSemesterId)) {
          const { data: upsertedRow, error: upsertErr } = await supabase
            .from('teaching_assignments')
            .upsert(
              {
                class_id: canonicalClassId,
                subject_id: canonicalSubjectId,
                teacher_id: teacherId,
                academic_year_id: effectiveYearId,
                semester_id: effectiveSemesterId,
              },
              { onConflict: 'class_id,subject_id,academic_year_id,semester_id' }
            )
            .select()
            .maybeSingle();

          reportSupabaseOutcome(upsertErr);
          if (!upsertErr && upsertedRow?.id) {
            result = { ...result, id: upsertedRow.id };
          } else if (upsertErr && !detectSupabaseQuotaError(upsertErr)) {
            if (isUuid(result.id)) {
              const { error } = await supabase
                .from('teaching_assignments')
                .update({ teacher_id: teacherId })
                .eq('id', result.id);
              reportSupabaseOutcome(error);
            } else {
              const { error } = await supabase
                .from('teaching_assignments')
                .update({ teacher_id: teacherId })
                .match({ class_id: canonicalClassId, subject_id: canonicalSubjectId });
              reportSupabaseOutcome(error);
            }
          }
        } else if (isUuid(result.id)) {
          const { error } = await supabase
            .from('teaching_assignments')
            .update({ teacher_id: teacherId })
            .eq('id', result.id);
          reportSupabaseOutcome(error);
        } else {
          const { error } = await supabase
            .from('teaching_assignments')
            .update({ teacher_id: teacherId })
            .match({ class_id: canonicalClassId, subject_id: canonicalSubjectId });
          reportSupabaseOutcome(error);
        }
      } catch (e) {
        reportSupabaseOutcome(e);
        console.warn('Supabase sync assignment error:', e);
      }
    }

    return result;
  },

  async batchAssignClassTeachers(
    classId: string,
    assignmentsList: { subject_id: string; teacher_id: string }[],
    academicYearId?: string,
    semesterId?: string
  ): Promise<void> {
    if (assignmentsList.length === 0) return;

    const [ctx, teachers, classes, subjects, current] = await Promise.all([
      this.resolveActiveAcademicContext(),
      this.getTeachers(),
      this.getClasses(),
      this.getSubjects(),
      this.getTeachingAssignments(),
    ]);

    const effectiveYearId =
      academicYearId && academicYearId !== 'ay-2026'
        ? academicYearId
        : isUuid(ctx.academicYearId)
        ? ctx.academicYearId
        : academicYearId || ctx.academicYearId;
    const effectiveSemesterId =
      semesterId && semesterId !== 'sem-ganjil-2026'
        ? semesterId
        : isUuid(ctx.semesterId)
        ? ctx.semesterId
        : semesterId || ctx.semesterId;

    const resolvedClass =
      classes.find((c) => c.id === classId) ||
      (await this.resolveClassTarget(classId, classes)) ||
      undefined;
    const canonicalClassId = resolvedClass?.id || classId;

    const teacherById = new Map(teachers.map((t) => [t.id, t]));
    const subjectById = new Map(subjects.map((s) => [s.id, s]));
    const subjectByKey = new Map(subjects.map((s) => [getCanonicalSubjectKey(s), s]));
    const nextMap = new Map<string, TeachingAssignment>(
      current.map((a) => [`${a.class_id}_${a.subject_id}`, a])
    );

    const now = new Date().toISOString();
    const supabaseUpsertPayloads: Array<{
      class_id: string;
      subject_id: string;
      teacher_id: string;
      academic_year_id: string;
      semester_id: string;
    }> = [];

    for (const item of assignmentsList) {
      if (!item.teacher_id || item.teacher_id === 'unassigned') continue;
      const resolvedSubject =
        subjectById.get(item.subject_id) ||
        (() => {
          const ds = DEMO_SUBJECTS.find((d) => d.id === item.subject_id);
          return ds ? subjectByKey.get(getCanonicalSubjectKey(ds)) : undefined;
        })();
      const canonicalSubjectId = resolvedSubject?.id || item.subject_id;
      const pairKey = `${canonicalClassId}_${canonicalSubjectId}`;
      const existing = nextMap.get(pairKey);
      const teacher = teacherById.get(item.teacher_id);

      const updatedItem: TeachingAssignment = existing
        ? {
            ...existing,
            class_id: canonicalClassId,
            subject_id: canonicalSubjectId,
            teacher_id: item.teacher_id,
            academic_year_id: effectiveYearId || existing.academic_year_id,
            semester_id: effectiveSemesterId || existing.semester_id,
            updated_at: now,
            teacher: teacher || existing.teacher,
            class: resolvedClass || existing.class,
            subject: resolvedSubject || existing.subject,
          }
        : {
            id: `asg-${canonicalClassId}-${canonicalSubjectId}`,
            class_id: canonicalClassId,
            subject_id: canonicalSubjectId,
            teacher_id: item.teacher_id,
            academic_year_id: effectiveYearId,
            semester_id: effectiveSemesterId,
            created_at: now,
            updated_at: now,
            teacher,
            class: resolvedClass,
            subject: resolvedSubject,
          };

      nextMap.set(pairKey, updatedItem);

      if (
        isSupabaseAvailable() &&
        isUuid(canonicalClassId) &&
        isUuid(canonicalSubjectId) &&
        isUuid(item.teacher_id) &&
        isUuid(effectiveYearId) &&
        isUuid(effectiveSemesterId)
      ) {
        supabaseUpsertPayloads.push({
          class_id: canonicalClassId,
          subject_id: canonicalSubjectId,
          teacher_id: item.teacher_id,
          academic_year_id: effectiveYearId,
          semester_id: effectiveSemesterId,
        });
      }
    }

    const storedClasses = getLocal<ClassRoom[]>(STORAGE_KEYS.CLASSES, []);
    if (storedClasses.length !== classes.length || storedClasses.some((c, i) => classes[i]?.id !== c.id)) {
      setLocal(
        STORAGE_KEYS.CLASSES,
        classes.map(({ homeroom_teacher: _ht, ...rest }) => rest)
      );
    }
    const storedSubjects = getLocal<Subject[]>(STORAGE_KEYS.SUBJECTS, []);
    if (storedSubjects.length === 0 || storedSubjects.some((s) => !isUuid(s.id) && subjects.some((cs) => cs.id !== s.id && getCanonicalSubjectKey(cs) === getCanonicalSubjectKey(s)))) {
      setLocal(STORAGE_KEYS.SUBJECTS, subjects);
    }
    setLocal(STORAGE_KEYS.ASSIGNMENTS, Array.from(nextMap.values()));

    if (supabaseUpsertPayloads.length > 0 && isSupabaseAvailable()) {
      try {
        const { error } = await supabase
          .from('teaching_assignments')
          .upsert(supabaseUpsertPayloads, {
            onConflict: 'class_id,subject_id,academic_year_id,semester_id',
          });
        reportSupabaseOutcome(error);
        if (error && !detectSupabaseQuotaError(error)) {
          for (const row of supabaseUpsertPayloads) {
            if (!isSupabaseAvailable()) break;
            const { error: rowErr } = await supabase
              .from('teaching_assignments')
              .update({ teacher_id: row.teacher_id })
              .match({ class_id: row.class_id, subject_id: row.subject_id });
            reportSupabaseOutcome(rowErr);
          }
        }
      } catch (e) {
        reportSupabaseOutcome(e);
        console.warn('Supabase batch assign sync error:', e);
      }
    }
  },

  // === ANGGOTA KELAS (ROMBEL SISWA) ===
  async getClassMembers(classId?: string): Promise<ClassMember[]> {
    const allMembers = await cachedAcademicRead('class_members', async () => {
      const localMembers = getLocal<ClassMember[]>(STORAGE_KEYS.CLASS_MEMBERS, DEMO_CLASS_MEMBERS);
      let baseMembers: ClassMember[] = [...localMembers];

      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await supabase
            .from('class_members')
            .select('*, student:students(*), class:classes(*)');
          reportSupabaseOutcome(error);
          if (!error && Array.isArray(data) && data.length > 0) {
            const remoteMembers = data as ClassMember[];
            const byStudentId = new Map<string, ClassMember>();
            for (const rm of remoteMembers) byStudentId.set(rm.student_id, rm);
            for (const lm of localMembers) {
              const existingRemote = byStudentId.get(lm.student_id);
              if (!existingRemote) {
                byStudentId.set(lm.student_id, lm);
              } else {
                const localTs = Date.parse((lm as ClassMember & { updated_at?: string }).updated_at || lm.created_at || '') || 0;
                const remoteTs = Date.parse((existingRemote as ClassMember & { updated_at?: string }).updated_at || existingRemote.created_at || '') || 0;
                if (localTs > remoteTs) {
                  byStudentId.set(lm.student_id, lm);
                }
              }
            }
            baseMembers = Array.from(byStudentId.values());
          }
        } catch (err) {
          reportSupabaseOutcome(err);
          console.warn('Supabase getClassMembers fallback:', err);
        }
      }

      const [students, classes] = await Promise.all([
        this.getStudents(),
        this.getClasses(),
      ]);

      const studentMap = new Map(students.map((s) => [s.id, s]));
      const classMap = new Map(classes.map((c) => [c.id, c]));

      return baseMembers
        .map((m) => {
          const resolvedClass = classMap.get(m.class_id) || m.class;
          const resolvedStudent = studentMap.get(m.student_id) || m.student;
          return {
            ...m,
            student: resolvedStudent,
            class: resolvedClass,
          };
        })
        .filter((m) => (students.length > 0 ? studentMap.has(m.student_id) : true))
        .sort((a, b) => {
          const numA = a.student_number ?? 9999;
          const numB = b.student_number ?? 9999;
          if (numA !== numB) return numA - numB;
          return (a.student?.full_name || '').localeCompare(b.student?.full_name || '', 'id');
        });
    });

    return classId ? allMembers.filter((m) => m.class_id === classId) : allMembers;
  },

  async assignStudentToClass(
    studentId: string,
    classIdOrLevel: string | number,
    academicYearId?: string
  ): Promise<ClassMember> {
    const [students, classes, currentMembers, ctx] = await Promise.all([
      this.getStudents(),
      this.getClasses(),
      this.getClassMembers(),
      this.resolveActiveAcademicContext(),
    ]);

    const targetClass = await this.resolveClassTarget(classIdOrLevel, classes);
    if (!targetClass) {
      throw new Error(`Rombel tujuan "${classIdOrLevel}" tidak ditemukan.`);
    }

    const effectiveYearId =
      academicYearId && isUuid(academicYearId)
        ? academicYearId
        : isUuid(ctx.academicYearId)
        ? ctx.academicYearId
        : academicYearId || ctx.academicYearId;

    const existingMember = currentMembers.find((m) => m.student_id === studentId);
    const sameClassMembers = currentMembers.filter(
      (m) => m.class_id === targetClass.id && m.student_id !== studentId
    );
    const nextNumber =
      existingMember && existingMember.class_id === targetClass.id && existingMember.student_number
        ? existingMember.student_number
        : sameClassMembers.length + 1;

    const now = new Date().toISOString();
    let savedMember: ClassMember & { updated_at?: string } = {
      id: existingMember?.class_id === targetClass.id ? existingMember.id : generateUuid(),
      student_id: studentId,
      class_id: targetClass.id,
      academic_year_id: effectiveYearId,
      student_number: nextNumber,
      created_at: now,
      updated_at: now,
      student: students.find((s) => s.id === studentId),
      class: targetClass,
    };

    if (
      isSupabaseAvailable() &&
      isUuid(studentId) &&
      isUuid(targetClass.id) &&
      isUuid(effectiveYearId)
    ) {
      try {
        const { data, error } = await supabase
          .from('class_members')
          .upsert(
            {
              student_id: studentId,
              class_id: targetClass.id,
              academic_year_id: effectiveYearId,
              student_number: nextNumber,
            },
            { onConflict: 'student_id,academic_year_id' }
          )
          .select()
          .single();
        reportSupabaseOutcome(error);
        if (!error && data) {
          savedMember = {
            ...(data as ClassMember),
            updated_at: now,
            student: savedMember.student,
            class: savedMember.class,
          };
        } else if (error) {
          console.warn('Supabase assignStudentToClass upsert warning:', error.message);
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase assignStudentToClass fallback:', err);
      }
    }

    // Jika siswa pindah dari kelas lain, bersihkan jabatan perangkat kelas di kelas lama
    if (existingMember && existingMember.class_id !== targetClass.id) {
      const officials = getLocal<ClassOfficial[]>(STORAGE_KEYS.CLASS_OFFICIALS, DEMO_CLASS_OFFICIALS);
      const removedFromOld = officials.filter(
        (o) => o.student_id === studentId && o.class_id === existingMember.class_id
      );
      if (removedFromOld.length > 0) {
        const cleanedOfficials = officials.filter(
          (o) => !(o.student_id === studentId && o.class_id === existingMember.class_id)
        );
        setLocal(STORAGE_KEYS.CLASS_OFFICIALS, cleanedOfficials);
        emitAcademicSyncEvent([STORAGE_KEYS.CLASS_OFFICIALS]);
        if (isSupabaseAvailable() && isUuid(studentId) && isUuid(existingMember.class_id)) {
          void supabase
            .from('class_officials')
            .delete()
            .eq('student_id', studentId)
            .eq('class_id', existingMember.class_id);
        }
      }
    }

    const updated = [...currentMembers.filter((m) => m.student_id !== studentId), savedMember];
    setLocal(STORAGE_KEYS.CLASS_MEMBERS, updated);
    return savedMember;
  },

  async removeStudentFromClass(studentId: string, classId?: string): Promise<void> {
    const currentMembers = getLocal<ClassMember[]>(STORAGE_KEYS.CLASS_MEMBERS, DEMO_CLASS_MEMBERS);
    const updated = currentMembers.filter((m) =>
      classId ? !(m.student_id === studentId && m.class_id === classId) : m.student_id !== studentId
    );
    setLocal(STORAGE_KEYS.CLASS_MEMBERS, updated);

    const officials = getLocal<ClassOfficial[]>(STORAGE_KEYS.CLASS_OFFICIALS, DEMO_CLASS_OFFICIALS);
    const cleanedOfficials = officials.filter((o) =>
      classId ? !(o.student_id === studentId && o.class_id === classId) : o.student_id !== studentId
    );
    if (cleanedOfficials.length !== officials.length) {
      setLocal(STORAGE_KEYS.CLASS_OFFICIALS, cleanedOfficials);
      emitAcademicSyncEvent([STORAGE_KEYS.CLASS_OFFICIALS]);
      if (isSupabaseAvailable() && isUuid(studentId)) {
        let offQuery = supabase.from('class_officials').delete().eq('student_id', studentId);
        if (classId && isUuid(classId)) {
          offQuery = offQuery.eq('class_id', classId);
        }
        void offQuery;
      }
    }

    if (isSupabaseAvailable() && isUuid(studentId)) {
      try {
        let query = supabase.from('class_members').delete().eq('student_id', studentId);
        if (classId && isUuid(classId)) {
          query = query.eq('class_id', classId);
        }
        const { error } = await query;
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase removeStudentFromClass fallback:', err);
      }
    }
  },

  async reorderClassMembersAlphabetically(classId: string): Promise<ClassMember[]> {
    const allMembers = await this.getClassMembers();
    const targetMembers = allMembers
      .filter((m) => m.class_id === classId)
      .sort((a, b) => (a.student?.full_name || '').localeCompare(b.student?.full_name || '', 'id'));

    const renumbered = targetMembers.map((m, idx) => ({
      ...m,
      student_number: idx + 1,
    }));

    const otherMembers = allMembers.filter((m) => m.class_id !== classId);
    setLocal(STORAGE_KEYS.CLASS_MEMBERS, [...otherMembers, ...renumbered]);

    if (isSupabaseAvailable() && isUuid(classId)) {
      for (const m of renumbered) {
        if (!isSupabaseAvailable()) break;
        if (isUuid(m.id)) {
          void supabase
            .from('class_members')
            .update({ student_number: m.student_number })
            .eq('id', m.id)
            .then(({ error }) => reportSupabaseOutcome(error));
        }
      }
    }

    return renumbered;
  },

  // === PERANGKAT KELAS (STRUKTUR ORGANISASI ROMBEL) ===
  async getClassOfficials(classId?: string): Promise<ClassOfficial[]> {
    let rawList = getLocal<ClassOfficial[]>(STORAGE_KEYS.CLASS_OFFICIALS, DEMO_CLASS_OFFICIALS);

    if (isSupabaseAvailable()) {
      try {
        const { data, error } = await supabase
          .from('class_officials')
          .select('*, student:students(*), class:classes(*)')
          .order('order_index', { ascending: true });

        if (!error) {
          reportSupabaseOutcome(null);
          if (Array.isArray(data) && data.length > 0) {
            const mergedMap = new Map<string, ClassOfficial>();
            let changedFromRemote = false;

            for (const lo of rawList) {
              mergedMap.set(lo.id, lo);
            }
            for (const ro of data as ClassOfficial[]) {
              const existing = mergedMap.get(ro.id);
              if (!existing) {
                mergedMap.set(ro.id, ro);
                changedFromRemote = true;
              } else {
                const remoteMs = Date.parse(ro.updated_at || ro.created_at || '') || 0;
                const localMs = Date.parse(existing.updated_at || existing.created_at || '') || 0;
                if (remoteMs > localMs) {
                  mergedMap.set(ro.id, ro);
                  changedFromRemote = true;
                }
              }
            }
            rawList = Array.from(mergedMap.values());
            if (changedFromRemote) {
              syncService.setLocalCacheSilently(
                STORAGE_KEYS.CLASS_OFFICIALS,
                JSON.stringify(rawList.map(({ student: _s, class: _c, ...rest }) => rest))
              );
            }
          }
        } else {
          const errCode = String(error.code || '');
          const errMsg = String(error.message || '').toLowerCase();
          // Abaikan diam-diam jika tabel class_officials belum dijalankan di SQL Editor Supabase
          if (errCode !== '42P01' && errCode !== 'PGRST205' && !errMsg.includes('class_officials')) {
            reportSupabaseOutcome(error);
          }
        }
      } catch (err) {
        console.warn('Supabase getClassOfficials fallback:', err);
      }
    }

    const [students, classes] = await Promise.all([
      this.getStudents(),
      this.getClasses(),
    ]);

    const studentMap = new Map(students.map((s) => [s.id, s]));
    const classMap = new Map(classes.map((c) => [c.id, c]));

    const hydrated = rawList
      .filter((o) => (students.length > 0 ? studentMap.has(o.student_id) : true))
      .map((o) => ({
        ...o,
        student: studentMap.get(o.student_id) || o.student,
        class: classMap.get(o.class_id) || o.class,
      }))
      .sort(
        (a, b) =>
          (a.order_index ?? 99) - (b.order_index ?? 99) ||
          a.role_name.localeCompare(b.role_name, 'id')
      );

    return classId ? hydrated.filter((o) => o.class_id === classId) : hydrated;
  },

  async upsertClassOfficial(payload: {
    id?: string;
    class_id: string;
    student_id: string;
    role_name: string;
    order_index?: number;
    notes?: string | null;
    academic_year_id?: string;
  }): Promise<ClassOfficial> {
    const [ctx, students, classes] = await Promise.all([
      this.resolveActiveAcademicContext(),
      this.getStudents(),
      this.getClasses(),
    ]);

    // Pastikan siswa terdaftar dalam rombel kelas tersebut
    const members = await this.getClassMembers(payload.class_id);
    if (!members.some((m) => m.student_id === payload.student_id)) {
      await this.assignStudentToClass(payload.student_id, payload.class_id, payload.academic_year_id || ctx.academicYearId);
    }

    const current = getLocal<ClassOfficial[]>(STORAGE_KEYS.CLASS_OFFICIALS, DEMO_CLASS_OFFICIALS);
    const now = new Date().toISOString();
    const trimmedRole = payload.role_name.trim();
    const orderIndex =
      payload.order_index ?? DEFAULT_OFFICIAL_ROLE_ORDER[trimmedRole] ?? 10;

    const existingIndex = payload.id
      ? current.findIndex((o) => o.id === payload.id)
      : current.findIndex(
          (o) =>
            o.class_id === payload.class_id &&
            o.role_name.toLowerCase() === trimmedRole.toLowerCase() &&
            !trimmedRole.toLowerCase().startsWith('seksi') &&
            trimmedRole.toLowerCase() !== 'anggota'
        );

    const existingId = existingIndex >= 0 ? current[existingIndex].id : payload.id;
    const resolvedId = existingId && isUuid(existingId) ? existingId : generateUuid();

    const record: ClassOfficial = {
      id: resolvedId,
      class_id: payload.class_id,
      student_id: payload.student_id,
      academic_year_id: payload.academic_year_id || ctx.academicYearId,
      role_name: trimmedRole,
      order_index: orderIndex,
      notes: payload.notes ?? null,
      created_at: existingIndex >= 0 ? current[existingIndex].created_at : now,
      updated_at: now,
      student: students.find((s) => s.id === payload.student_id),
      class: classes.find((c) => c.id === payload.class_id),
    };

    if (
      isSupabaseAvailable() &&
      isUuid(record.id) &&
      isUuid(record.class_id) &&
      isUuid(record.student_id)
    ) {
      try {
        const dbPayload = {
          id: record.id,
          class_id: record.class_id,
          student_id: record.student_id,
          academic_year_id: isUuid(record.academic_year_id) ? record.academic_year_id : null,
          role_name: record.role_name,
          order_index: record.order_index,
          notes: record.notes ?? null,
          created_at: record.created_at,
          updated_at: record.updated_at,
        };
        const { error } = await supabase
          .from('class_officials')
          .upsert(dbPayload, { onConflict: 'id' });
        if (error) {
          const errCode = String(error.code || '');
          if (errCode !== '42P01' && errCode !== 'PGRST205') {
            reportSupabaseOutcome(error);
          }
          console.warn('Supabase upsertClassOfficial warning:', error.message);
        } else {
          reportSupabaseOutcome(null);
        }
      } catch (err) {
        console.warn('Supabase upsertClassOfficial fallback:', err);
      }
    }

    const storageRecord = {
      id: record.id,
      class_id: record.class_id,
      student_id: record.student_id,
      academic_year_id: record.academic_year_id,
      role_name: record.role_name,
      order_index: record.order_index,
      notes: record.notes ?? null,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };

    const nextList =
      existingIndex >= 0
        ? current.map((o, idx) => (idx === existingIndex ? storageRecord : o))
        : [...current, storageRecord];

    setLocal(STORAGE_KEYS.CLASS_OFFICIALS, nextList);
    emitAcademicSyncEvent([STORAGE_KEYS.CLASS_OFFICIALS]);
    void syncService.flushMutations();
    return record;
  },

  async deleteClassOfficial(id: string): Promise<void> {
    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const { error } = await supabase.from('class_officials').delete().eq('id', id);
        if (error) {
          const errCode = String(error.code || '');
          if (errCode !== '42P01' && errCode !== 'PGRST205') {
            reportSupabaseOutcome(error);
          }
        }
      } catch (err) {
        console.warn('Supabase deleteClassOfficial fallback:', err);
      }
    }
    const current = getLocal<ClassOfficial[]>(STORAGE_KEYS.CLASS_OFFICIALS, DEMO_CLASS_OFFICIALS);
    setLocal(
      STORAGE_KEYS.CLASS_OFFICIALS,
      current.filter((o) => o.id !== id)
    );
    emitAcademicSyncEvent([STORAGE_KEYS.CLASS_OFFICIALS]);
    void syncService.flushMutations();
  },
};
