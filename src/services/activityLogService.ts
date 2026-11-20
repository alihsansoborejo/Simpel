import { isSupabaseAvailable, reportSupabaseOutcome, supabase } from '../lib/supabaseClient';

export interface ActivityLog {
  id: string;
  userId?: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  details?: string;
  timestamp: string;
  ip?: string;
}

const STORAGE_KEY = 'simpel_mi_activity_logs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v?: string | null) => typeof v === 'string' && UUID_REGEX.test(v);

export const activityLogService = {
  async log(entry: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<void> {
    const newEntry: ActivityLog = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
    };

    // Save to local storage for quick retrieval & demo
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list: ActivityLog[] = raw ? JSON.parse(raw) : [];
      list.unshift(newEntry);
      if (list.length > 200) list.pop();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }

    // Attempt Supabase insert using exact schema columns (action_name, entity_name, details jsonb)
    if (isSupabaseAvailable()) {
      try {
        let resolvedUserId: string | null = isUuid(entry.userId) ? entry.userId! : null;
        if (!resolvedUserId) {
          const { data: sessionData } = await supabase.auth.getSession();
          const authUid = sessionData?.session?.user?.id;
          if (isUuid(authUid)) resolvedUserId = authUid!;
        }
        if (!resolvedUserId) return;

        const { error } = await supabase.from('activity_logs').insert([
          {
            user_id: resolvedUserId,
            action_name: entry.action,
            entity_name: entry.module,
            details: {
              userName: entry.userName,
              userRole: entry.userRole,
              description: entry.details || null,
            },
            created_at: newEntry.timestamp,
          },
        ]);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        // Silent fallback to local storage
      }
    }
  },

  async getRecentLogs(limit = 50): Promise<ActivityLog[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const list: ActivityLog[] = JSON.parse(raw);
        return list.slice(0, limit);
      }
    } catch {
      // ignore
    }
    return [];
  },
};
