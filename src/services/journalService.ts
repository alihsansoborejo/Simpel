import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { TeachingJournal } from '../types/database.types';
import { DEMO_JOURNALS } from '../lib/demoData';

const STORAGE_KEY = 'simpel_teaching_journals';

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

export const journalService = {
  async getJournals(filters?: { assignmentId?: string; date?: string; teacherId?: string }): Promise<TeachingJournal[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('teaching_journals')
          .select('*, assignment:teaching_assignments(*, teacher:teachers(*), class:classes(*), subject:subjects(*))')
          .order('date', { ascending: false });

        if (filters?.assignmentId) query = query.eq('assignment_id', filters.assignmentId);
        if (filters?.date) query = query.eq('date', filters.date);

        const { data, error } = await query;
        if (!error && data && data.length > 0) return data as TeachingJournal[];
      } catch (err) {
        console.warn('Supabase getJournals fallback:', err);
      }
    }

    let journals = getLocal<TeachingJournal[]>(STORAGE_KEY, DEMO_JOURNALS);
    if (filters?.assignmentId) journals = journals.filter((j) => j.assignment_id === filters.assignmentId);
    if (filters?.date) journals = journals.filter((j) => j.date === filters.date);
    if (filters?.teacherId) {
      journals = journals.filter((j) => j.assignment?.teacher_id === filters.teacherId);
    }
    return journals;
  },

  async createJournal(payload: Omit<TeachingJournal, 'id' | 'created_at' | 'updated_at'>): Promise<TeachingJournal> {
    const newJournal: TeachingJournal = {
      ...payload,
      id: `jrn-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('teaching_journals').insert(newJournal).select().single();
        if (data) return data as TeachingJournal;
      } catch (err) {
        console.warn('Supabase createJournal fallback:', err);
      }
    }

    const current = await this.getJournals();
    const updated = [newJournal, ...current];
    setLocal(STORAGE_KEY, updated);
    return newJournal;
  },

  async updateJournal(id: string, updates: Partial<TeachingJournal>): Promise<TeachingJournal> {
    const journals = await this.getJournals();
    const existing = journals.find((j) => j.id === id);
    if (!existing) throw new Error('Jurnal tidak ditemukan');

    const updatedJournal: TeachingJournal = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('teaching_journals').update(updates).eq('id', id);
      } catch (err) {
        console.warn('Supabase updateJournal fallback:', err);
      }
    }

    const updated = journals.map((j) => (j.id === id ? updatedJournal : j));
    setLocal(STORAGE_KEY, updated);
    return updatedJournal;
  },

  async deleteJournal(id: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.from('teaching_journals').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteJournal fallback:', err);
      }
    }
    const journals = await this.getJournals();
    setLocal(STORAGE_KEY, journals.filter((j) => j.id !== id));
  },
};
