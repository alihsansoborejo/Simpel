import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

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

    // Attempt Supabase insert if audit table exists
    if (isSupabaseConfigured) {
      try {
        await supabase.from('activity_logs').insert([
          {
            user_id: entry.userId,
            user_name: entry.userName,
            user_role: entry.userRole,
            action: entry.action,
            module: entry.module,
            details: entry.details,
            created_at: newEntry.timestamp,
          },
        ]);
      } catch (err) {
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
