import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  SupervisionRecord,
  SupervisionInstrument,
  SupervisionFollowup,
  FollowupStatus,
} from '../types/database.types';
import {
  DEMO_SUPERVISION_RECORDS,
  DEMO_INSTRUMENTS,
  DEMO_TEACHERS,
  DEMO_CLASSES,
  DEMO_SUBJECTS,
} from '../lib/demoData';

const STORAGE_KEY = 'simpel_supervision_records';
const INSTRUMENTS_KEY = 'simpel_supervision_instruments';

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

export const supervisionService = {
  async getRecords(filters?: {
    teacherId?: string;
    academicYearId?: string;
    semesterId?: string;
    supervisionType?: string;
  }): Promise<SupervisionRecord[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('supervision_records_new')
          .select('*, teacher:teachers(*), class:classes(*), subject:subjects(*), supervisor:profiles(*)')
          .order('supervision_date', { ascending: false });

        if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId);
        if (filters?.academicYearId) query = query.eq('academic_year_id', filters.academicYearId);
        if (filters?.semesterId) query = query.eq('semester_id', filters.semesterId);
        if (filters?.supervisionType) query = query.eq('supervision_type', filters.supervisionType);

        const { data, error } = await query;
        if (!error && data && data.length > 0) return data as SupervisionRecord[];
      } catch (err) {
        console.warn('Supabase getRecords fallback:', err);
      }
    }

    let records = getLocal<SupervisionRecord[]>(STORAGE_KEY, DEMO_SUPERVISION_RECORDS);
    if (filters?.teacherId) records = records.filter((r) => r.teacher_id === filters.teacherId);
    if (filters?.academicYearId) records = records.filter((r) => r.academic_year_id === filters.academicYearId);
    if (filters?.semesterId) records = records.filter((r) => r.semester_id === filters.semesterId);
    if (filters?.supervisionType) records = records.filter((r) => r.supervision_type === filters.supervisionType);

    return records.map((r) => ({
      ...r,
      teacher: r.teacher || DEMO_TEACHERS.find((t) => t.id === r.teacher_id),
      class: r.class || DEMO_CLASSES.find((c) => c.id === r.class_id),
      subject: r.subject || DEMO_SUBJECTS.find((s) => s.id === r.subject_id),
    }));
  },

  async createRecord(
    payload: Omit<SupervisionRecord, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SupervisionRecord> {
    const newRecord: SupervisionRecord = {
      ...payload,
      id: `spv-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      teacher: DEMO_TEACHERS.find((t) => t.id === payload.teacher_id),
      class: DEMO_CLASSES.find((c) => c.id === payload.class_id),
      subject: DEMO_SUBJECTS.find((s) => s.id === payload.subject_id),
      followups: [],
    };

    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('supervision_records_new').insert(newRecord).select().single();
        if (data) return data as SupervisionRecord;
      } catch (err) {
        console.warn('Supabase createRecord fallback:', err);
      }
    }

    const current = await this.getRecords();
    const updated = [newRecord, ...current];
    setLocal(STORAGE_KEY, updated);
    return newRecord;
  },

  async updateRecord(id: string, updates: Partial<SupervisionRecord>): Promise<SupervisionRecord> {
    const records = await this.getRecords();
    const existing = records.find((r) => r.id === id);
    if (!existing) throw new Error('Data supervisi tidak ditemukan');

    const updatedRecord: SupervisionRecord = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('supervision_records_new').update(updates).eq('id', id);
      } catch (err) {
        console.warn('Supabase updateRecord fallback:', err);
      }
    }

    const updatedList = records.map((r) => (r.id === id ? updatedRecord : r));
    setLocal(STORAGE_KEY, updatedList);
    return updatedRecord;
  },

  async getInstruments(): Promise<SupervisionInstrument[]> {
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('supervision_instruments').select('*').eq('is_active', true);
        if (data && data.length > 0) return data as SupervisionInstrument[];
      } catch (err) {
        console.warn('Supabase getInstruments fallback:', err);
      }
    }
    return getLocal<SupervisionInstrument[]>(INSTRUMENTS_KEY, DEMO_INSTRUMENTS);
  },

  async addFollowup(
    supervisionRecordId: string,
    activityDescription: string,
    personInCharge: string,
    targetDate: string
  ): Promise<SupervisionFollowup> {
    const newFollowup: SupervisionFollowup = {
      id: `fup-${Date.now()}`,
      supervision_record_id: supervisionRecordId,
      activity_description: activityDescription,
      person_in_charge: personInCharge,
      target_date: targetDate,
      status: 'Dalam_Proses',
      result_notes: null,
      completion_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const records = await this.getRecords();
    const rec = records.find((r) => r.id === supervisionRecordId);
    if (rec) {
      rec.followups = [...(rec.followups || []), newFollowup];
      setLocal(STORAGE_KEY, records);
    }
    return newFollowup;
  },

  async updateFollowupStatus(
    recordId: string,
    followupId: string,
    status: FollowupStatus,
    resultNotes?: string
  ): Promise<void> {
    const records = await this.getRecords();
    const rec = records.find((r) => r.id === recordId);
    if (rec && rec.followups) {
      rec.followups = rec.followups.map((f) =>
        f.id === followupId
          ? {
              ...f,
              status,
              result_notes: resultNotes !== undefined ? resultNotes : f.result_notes,
              completion_date: status === 'Selesai' ? new Date().toISOString().split('T')[0] : f.completion_date,
              updated_at: new Date().toISOString(),
            }
          : f
      );
      setLocal(STORAGE_KEY, records);
    }
  },
};
