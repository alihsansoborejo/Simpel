import { supabase, isSupabaseAvailable, reportSupabaseOutcome } from '../lib/supabaseClient';
import { KoKurikulerItem, KoKurikulerSubMenu } from '../types/kokurikuler.types';
import { syncService } from './syncService';

const STORAGE_KEY = 'simpel_mi_kokurikuler_items_v1';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v?: string | null) => typeof v === 'string' && UUID_REGEX.test(v);

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

function isMissingTableError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || msg.includes('kokurikuler_items');
}

function getStored(): KoKurikulerItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setStored(items: KoKurikulerItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Gagal menyimpan data Ko Kurikuler:', err);
  }
}

function sortItems(items: KoKurikulerItem[]): KoKurikulerItem[] {
  return [...items].sort((a, b) =>
    (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '')
  );
}

export interface KoKurikulerScopeFilter {
  teacherIds?: string[];
  userIds?: string[];
  email?: string | null;
  fullName?: string | null;
  homeroomClassLevel?: number | null;
}

export const kokurikulerService = {
  getAll(): KoKurikulerItem[] {
    return sortItems(getStored());
  },

  async fetchAll(): Promise<KoKurikulerItem[]> {
    let items = getStored();

    if (isSupabaseAvailable()) {
      try {
        const { data, error } = await supabase
          .from('kokurikuler_items')
          .select('*')
          .order('updated_at', { ascending: false });

        if (!error) {
          reportSupabaseOutcome(null);
          if (Array.isArray(data) && data.length > 0) {
            const mapById = new Map<string, KoKurikulerItem>();
            let changedFromRemote = false;

            for (const localItem of items) {
              mapById.set(localItem.id, localItem);
            }
            for (const remoteItem of data as KoKurikulerItem[]) {
              const existing = mapById.get(remoteItem.id);
              if (!existing) {
                mapById.set(remoteItem.id, remoteItem);
                changedFromRemote = true;
              } else {
                const remoteTs = Date.parse(remoteItem.updated_at || remoteItem.created_at || '') || 0;
                const localTs = Date.parse(existing.updated_at || existing.created_at || '') || 0;
                if (remoteTs > localTs) {
                  mapById.set(remoteItem.id, remoteItem);
                  changedFromRemote = true;
                }
              }
            }

            items = Array.from(mapById.values());
            if (changedFromRemote) {
              syncService.setLocalCacheSilently(STORAGE_KEY, JSON.stringify(items));
            }
          }
        } else if (!isMissingTableError(error)) {
          reportSupabaseOutcome(error);
        }
      } catch (err) {
        if (!isMissingTableError(err)) {
          reportSupabaseOutcome(err);
          console.warn('Supabase kokurikuler fetchAll fallback:', err);
        }
      }
    }

    return sortItems(items);
  },

  filterByScope(items: KoKurikulerItem[], scope?: KoKurikulerScopeFilter): KoKurikulerItem[] {
    if (!scope) return sortItems(items);

    const teacherIdSet = new Set((scope.teacherIds || []).filter(Boolean));
    const userIdSet = new Set((scope.userIds || []).filter(Boolean));
    const emailLower = String(scope.email || '').trim().toLowerCase();
    const nameLower = String(scope.fullName || '').trim().toLowerCase();
    const homeroomLevel = scope.homeroomClassLevel ?? null;

    if (
      teacherIdSet.size === 0 &&
      userIdSet.size === 0 &&
      !emailLower &&
      !nameLower &&
      homeroomLevel === null
    ) {
      return [];
    }

    return sortItems(
      items.filter((item) => {
        if (item.teacher_id && (teacherIdSet.has(item.teacher_id) || userIdSet.has(item.teacher_id))) {
          return true;
        }
        if (item.teacher_user_id && userIdSet.has(item.teacher_user_id)) {
          return true;
        }
        if (emailLower && item.recorder_email && item.recorder_email.trim().toLowerCase() === emailLower) {
          return true;
        }
        if (nameLower && item.teacher_name && item.teacher_name.trim().toLowerCase() === nameLower) {
          return true;
        }
        if (homeroomLevel !== null && (item.class_level === homeroomLevel || item.class_level === 0)) {
          return true;
        }
        return false;
      })
    );
  },

  getByTeacherScope(matchingTeacherIds: string[]): KoKurikulerItem[] {
    const all = this.getAll();
    if (!matchingTeacherIds || matchingTeacherIds.length === 0) return [];
    const idSet = new Set(matchingTeacherIds);
    return all.filter((item) => item.teacher_id && idSet.has(item.teacher_id));
  },

  getBySubMenu(subMenu: KoKurikulerSubMenu, matchingTeacherIds?: string[]): KoKurikulerItem[] {
    const scoped = matchingTeacherIds
      ? this.getByTeacherScope(matchingTeacherIds)
      : this.getAll();
    return scoped.filter((item) => item.sub_menu === subMenu);
  },

  getCountsBySubMenu(
    matchingTeacherIds?: string[],
    scope?: KoKurikulerScopeFilter,
    sourceItems?: KoKurikulerItem[]
  ): Record<KoKurikulerSubMenu, number> {
    const base = sourceItems ? sortItems(sourceItems) : this.getAll();
    const scoped = scope
      ? this.filterByScope(base, scope)
      : matchingTeacherIds
      ? this.filterByScope(base, { teacherIds: matchingTeacherIds })
      : base;

    const counts: Record<KoKurikulerSubMenu, number> = {
      perencanaan: 0,
      'bahan-ajar': 0,
      asesmen: 0,
      administrasi: 0,
    };
    for (const item of scoped) {
      if (item.sub_menu in counts) {
        counts[item.sub_menu] += 1;
      }
    }
    return counts;
  },

  async saveItem(
    payload: Omit<KoKurikulerItem, 'id' | 'created_at' | 'updated_at'> & {
      id?: string;
      created_at?: string;
    }
  ): Promise<KoKurikulerItem> {
    const list = getStored();
    const now = new Date().toISOString();
    const existing = payload.id ? list.find((item) => item.id === payload.id) : undefined;
    const id = payload.id || generateUuid();

    const saved: KoKurikulerItem = {
      ...payload,
      id,
      created_at: existing?.created_at || payload.created_at || now,
      updated_at: now,
    };

    const next = existing
      ? list.map((item) => (item.id === saved.id ? saved : item))
      : [saved, ...list];
    setStored(next);
    void syncService.flushMutations();

    if (isSupabaseAvailable() && isUuid(saved.id)) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUid = sessionData?.session?.user?.id;
        const dbPayload = {
          id: saved.id,
          sub_menu: saved.sub_menu,
          teacher_id: saved.teacher_id || null,
          teacher_user_id: isUuid(sessionUid)
            ? sessionUid
            : isUuid(saved.teacher_user_id)
            ? saved.teacher_user_id
            : null,
          recorder_email: saved.recorder_email || null,
          teacher_name: saved.teacher_name,
          class_level: Number(saved.class_level) || 0,
          class_name: saved.class_name,
          semester: saved.semester,
          academic_year: saved.academic_year,
          theme_or_dimension: saved.theme_or_dimension,
          title: saved.title,
          description: saved.description || '',
          target_participants: saved.target_participants || null,
          allocated_hours: saved.allocated_hours ?? 0,
          activity_date: saved.activity_date || null,
          file_id: saved.file_id || null,
          file_name: saved.file_name || null,
          google_drive_url: saved.google_drive_url || null,
          folder_path: saved.folder_path || null,
          curriculum_doc_id: saved.curriculum_doc_id || null,
          status: saved.status,
          review_notes: saved.review_notes || null,
          reviewed_at: saved.reviewed_at || null,
          created_at: saved.created_at,
          updated_at: saved.updated_at,
        };
        const { error } = await supabase
          .from('kokurikuler_items')
          .upsert(dbPayload, { onConflict: 'id' });
        if (!error) {
          reportSupabaseOutcome(null);
        } else if (!isMissingTableError(error)) {
          reportSupabaseOutcome(error);
        }
      } catch (err) {
        if (!isMissingTableError(err)) {
          reportSupabaseOutcome(err);
          console.warn('Supabase kokurikuler saveItem fallback:', err);
        }
      }
    }

    return saved;
  },

  async deleteItem(id: string): Promise<void> {
    const next = getStored().filter((item) => item.id !== id);
    setStored(next);
    void syncService.flushMutations();

    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const { error } = await supabase.from('kokurikuler_items').delete().eq('id', id);
        if (!error) {
          reportSupabaseOutcome(null);
        } else if (!isMissingTableError(error)) {
          reportSupabaseOutcome(error);
        }
      } catch (err) {
        if (!isMissingTableError(err)) {
          reportSupabaseOutcome(err);
          console.warn('Supabase kokurikuler deleteItem fallback:', err);
        }
      }
    }
  },
};
