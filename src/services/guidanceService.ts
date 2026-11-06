import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { StudentGuidanceRecord, GuidanceStatus } from '../types/database.types';
import { DEMO_GUIDANCES, DEMO_STUDENTS } from '../lib/demoData';

const STORAGE_KEY = 'simpel_student_guidance';

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

export const guidanceService = {
  async getGuidanceRecords(userRole: string, currentUserId: string): Promise<StudentGuidanceRecord[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('student_guidance_records')
          .select('*, student:students(*), recorder:profiles(*)')
          .order('guidance_date', { ascending: false });

        // Enforce RLS restriction: regular teachers only see their own recorded records
        if (userRole !== 'admin' && userRole !== 'kepala_madrasah') {
          query = query.eq('recorded_by', currentUserId);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) return data as StudentGuidanceRecord[];
      } catch (err) {
        console.warn('Supabase getGuidanceRecords fallback:', err);
      }
    }

    let records = getLocal<StudentGuidanceRecord[]>(STORAGE_KEY, DEMO_GUIDANCES);
    if (userRole !== 'admin' && userRole !== 'kepala_madrasah') {
      records = records.filter((r) => r.recorded_by === currentUserId);
    }

    return records.map((r) => ({
      ...r,
      student: r.student || DEMO_STUDENTS.find((s) => s.id === r.student_id),
    }));
  },

  async createGuidanceRecord(
    payload: Omit<StudentGuidanceRecord, 'id' | 'created_at' | 'updated_at'>
  ): Promise<StudentGuidanceRecord> {
    const newRecord: StudentGuidanceRecord = {
      ...payload,
      id: `gd-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      student: DEMO_STUDENTS.find((s) => s.id === payload.student_id),
    };

    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('student_guidance_records').insert(newRecord).select().single();
        if (data) return data as StudentGuidanceRecord;
      } catch (err) {
        console.warn('Supabase createGuidanceRecord fallback:', err);
      }
    }

    const current = getLocal<StudentGuidanceRecord[]>(STORAGE_KEY, DEMO_GUIDANCES);
    const updated = [newRecord, ...current];
    setLocal(STORAGE_KEY, updated);
    return newRecord;
  },

  async updateGuidanceStatus(id: string, status: GuidanceStatus): Promise<StudentGuidanceRecord> {
    const records = getLocal<StudentGuidanceRecord[]>(STORAGE_KEY, DEMO_GUIDANCES);
    const item = records.find((r) => r.id === id);
    if (!item) throw new Error('Data bimbingan tidak ditemukan');

    const updatedItem: StudentGuidanceRecord = {
      ...item,
      status,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('student_guidance_records').update({ status }).eq('id', id);
      } catch (err) {
        console.warn('Supabase updateGuidanceStatus fallback:', err);
      }
    }

    const updatedList = records.map((r) => (r.id === id ? updatedItem : r));
    setLocal(STORAGE_KEY, updatedList);
    return updatedItem;
  },
};
