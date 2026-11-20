import { supabase, isSupabaseAvailable, reportSupabaseOutcome } from '../lib/supabaseClient';
import {
  SupervisionRecord,
  SupervisionInstrument,
  SupervisionFollowup,
  FollowupStatus,
} from '../types/database.types';
import {
  DEMO_SUPERVISION_RECORDS,
  DEMO_INSTRUMENTS,
} from '../lib/demoData';
import { academicService } from './academicService';
import { syncService } from './syncService';
import { notificationService } from './notificationService';

const STORAGE_KEY = 'simpel_supervision_records';
const INSTRUMENTS_KEY = 'simpel_supervision_instruments';
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
    let baseRecords = getLocal<SupervisionRecord[]>(STORAGE_KEY, DEMO_SUPERVISION_RECORDS);

    if (isSupabaseAvailable()) {
      try {
        const [{ data, error }, followupsRes] = await Promise.all([
          supabase
            .from('supervision_records')
            .select('*, teacher:teachers(*), class:classes(*), subject:subjects(*), supervisor:profiles(*)')
            .order('supervision_date', { ascending: false }),
          supabase.from('supervision_followups').select('*').order('created_at', { ascending: true }),
        ]);

        reportSupabaseOutcome(error);
        if (!error && Array.isArray(data) && data.length > 0) {
          const followupsByRec = new Map<string, SupervisionFollowup[]>();
          if (!followupsRes.error && Array.isArray(followupsRes.data)) {
            for (const fup of followupsRes.data as SupervisionFollowup[]) {
              const list = followupsByRec.get(fup.supervision_record_id) || [];
              list.push(fup);
              followupsByRec.set(fup.supervision_record_id, list);
            }
          }

          const mapById = new Map<string, SupervisionRecord>();
          let changedFromRemote = false;

          for (const localRec of baseRecords) {
            mapById.set(localRec.id, localRec);
          }

          for (const remoteItem of data as SupervisionRecord[]) {
            const remoteFollowups = followupsByRec.get(remoteItem.id);
            const existing = mapById.get(remoteItem.id);
            const enrichedRemote: SupervisionRecord = {
              ...remoteItem,
              followups:
                remoteFollowups && remoteFollowups.length > 0
                  ? remoteFollowups
                  : existing?.followups || [],
            };

            if (!existing) {
              mapById.set(remoteItem.id, enrichedRemote);
              changedFromRemote = true;
            } else {
              const remoteTs = Date.parse(remoteItem.updated_at || remoteItem.created_at || '') || 0;
              const localTs = Date.parse(existing.updated_at || existing.created_at || '') || 0;
              if (remoteTs > localTs) {
                mapById.set(remoteItem.id, enrichedRemote);
                changedFromRemote = true;
              } else if (remoteFollowups && remoteFollowups.length > (existing.followups?.length || 0)) {
                mapById.set(remoteItem.id, { ...existing, followups: remoteFollowups });
                changedFromRemote = true;
              }
            }
          }

          baseRecords = Array.from(mapById.values());
          if (changedFromRemote) {
            syncService.setLocalCacheSilently(
              STORAGE_KEY,
              JSON.stringify(
                baseRecords.map(({ teacher: _t, class: _c, subject: _s, supervisor: _sup, results: _res, ...rest }) => rest)
              )
            );
          }
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase getRecords fallback:', err);
      }
    }

    const [teachers, classes, subjects] = await Promise.all([
      academicService.getTeachers(),
      academicService.getClasses(),
      academicService.getSubjects(),
    ]);

    const teacherMap = new Map(teachers.map((t) => [t.id, t]));
    const classMap = new Map(classes.map((c) => [c.id, c]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    let records = baseRecords.map((r) => ({
      ...r,
      teacher: teacherMap.get(r.teacher_id) || r.teacher,
      class: (r.class_id ? classMap.get(r.class_id) : undefined) || r.class,
      subject: (r.subject_id ? subjectMap.get(r.subject_id) : undefined) || r.subject,
    }));

    if (filters?.teacherId) records = records.filter((r) => r.teacher_id === filters.teacherId);
    if (filters?.academicYearId) records = records.filter((r) => r.academic_year_id === filters.academicYearId);
    if (filters?.semesterId) records = records.filter((r) => r.semester_id === filters.semesterId);
    if (filters?.supervisionType) records = records.filter((r) => r.supervision_type === filters.supervisionType);

    return records.sort((a, b) => {
      const dateDiff = (b.supervision_date || '').localeCompare(a.supervision_date || '');
      if (dateDiff !== 0) return dateDiff;
      return (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '');
    });
  },

  async createRecord(
    payload: Omit<SupervisionRecord, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SupervisionRecord> {
    const id = generateUuid();
    const [teachers, classes, subjects, activeCtx] = await Promise.all([
      academicService.getTeachers(),
      academicService.getClasses(),
      academicService.getSubjects(),
      academicService.resolveActiveAcademicContext(),
    ]);

    const resolvedYearId = isUuid(payload.academic_year_id)
      ? payload.academic_year_id
      : activeCtx.academicYearId;
    const resolvedSemId = isUuid(payload.semester_id)
      ? payload.semester_id
      : activeCtx.semesterId;
    const now = new Date().toISOString();

    let newRecord: SupervisionRecord = {
      ...payload,
      id,
      academic_year_id: resolvedYearId,
      semester_id: resolvedSemId,
      created_at: now,
      updated_at: now,
      teacher: teachers.find((t) => t.id === payload.teacher_id),
      class: classes.find((c) => c.id === payload.class_id),
      subject: subjects.find((s) => s.id === payload.subject_id),
      followups: [],
    };

    const current = getLocal<SupervisionRecord[]>(STORAGE_KEY, DEMO_SUPERVISION_RECORDS);
    const updatedLocal = [newRecord, ...current.filter((r) => r.id !== newRecord.id)];
    setLocal(STORAGE_KEY, updatedLocal);
    void syncService.flushMutations();

    if (
      isSupabaseAvailable() &&
      isUuid(id) &&
      isUuid(payload.teacher_id) &&
      isUuid(resolvedYearId) &&
      isUuid(resolvedSemId)
    ) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUid = sessionData?.session?.user?.id;
        const supervisorId = isUuid(sessionUid)
          ? sessionUid
          : isUuid(payload.supervisor_id)
          ? payload.supervisor_id
          : '';

        if (isUuid(supervisorId)) {
          const {
            teacher: _t,
            class: _c,
            subject: _s,
            supervisor: _sup,
            results: _res,
            followups: _f,
            ...rawDbPayload
          } = newRecord;
          const dbPayload = {
            ...rawDbPayload,
            supervisor_id: supervisorId,
            instrument_id: isUuid(rawDbPayload.instrument_id) ? rawDbPayload.instrument_id : null,
            class_id: isUuid(rawDbPayload.class_id) ? rawDbPayload.class_id : null,
            subject_id: isUuid(rawDbPayload.subject_id) ? rawDbPayload.subject_id : null,
            assignment_id: isUuid(rawDbPayload.assignment_id) ? rawDbPayload.assignment_id : null,
          };
          const { data, error } = await supabase
            .from('supervision_records')
            .insert(dbPayload)
            .select()
            .maybeSingle();
          reportSupabaseOutcome(error);
          if (!error && data) {
            newRecord = {
              ...(data as SupervisionRecord),
              teacher: newRecord.teacher,
              class: newRecord.class,
              subject: newRecord.subject,
              followups: [],
            };
            const latest = getLocal<SupervisionRecord[]>(STORAGE_KEY, updatedLocal);
            setLocal(STORAGE_KEY, [newRecord, ...latest.filter((r) => r.id !== newRecord.id)]);
            void syncService.flushMutations();
          }
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase createRecord fallback:', err);
      }
    }

    if (newRecord.is_shared_with_teacher) {
      const teacherName = newRecord.teacher?.full_name || 'Guru';
      void notificationService.addNotification({
        target_role: 'guru',
        category: 'supervisi',
        title: `Hasil Supervisi KBM: ${teacherName}`,
        message: `Observasi topik "${newRecord.topic}" telah dicatat (Nilai: ${newRecord.percentage_score || newRecord.total_score}% · ${newRecord.predicate}).`,
        action_url: 'supervisi-guru',
      });
    }

    return newRecord;
  },

  async updateRecord(id: string, updates: Partial<SupervisionRecord>): Promise<SupervisionRecord> {
    const records = await this.getRecords();
    const existing = records.find((r) => r.id === id);
    if (!existing) throw new Error('Data supervisi tidak ditemukan');

    const now = new Date().toISOString();
    const updatedRecord: SupervisionRecord = {
      ...existing,
      ...updates,
      updated_at: now,
    };

    const current = getLocal<SupervisionRecord[]>(STORAGE_KEY, DEMO_SUPERVISION_RECORDS);
    const updatedList = current.some((r) => r.id === id)
      ? current.map((r) => (r.id === id ? updatedRecord : r))
      : [updatedRecord, ...current];
    setLocal(STORAGE_KEY, updatedList);
    void syncService.flushMutations();

    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const {
          teacher: _t,
          class: _c,
          subject: _s,
          supervisor: _sup,
          results: _res,
          followups: _f,
          ...dbUpdates
        } = updates;
        const { error } = await supabase
          .from('supervision_records')
          .update({ ...dbUpdates, updated_at: now })
          .eq('id', id);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase updateRecord fallback:', err);
      }
    }

    return updatedRecord;
  },

  async deleteRecord(id: string): Promise<void> {
    const current = getLocal<SupervisionRecord[]>(STORAGE_KEY, DEMO_SUPERVISION_RECORDS);
    setLocal(
      STORAGE_KEY,
      current.filter((r) => r.id !== id)
    );
    void syncService.flushMutations();

    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const { error } = await supabase.from('supervision_records').delete().eq('id', id);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase deleteRecord fallback:', err);
      }
    }
  },

  async getInstruments(): Promise<SupervisionInstrument[]> {
    if (isSupabaseAvailable()) {
      try {
        const { data, error } = await supabase.from('supervision_instruments').select('*').eq('is_active', true);
        reportSupabaseOutcome(error);
        if (!error && data && data.length > 0) return data as SupervisionInstrument[];
      } catch (err) {
        reportSupabaseOutcome(err);
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
    const now = new Date().toISOString();
    const newFollowup: SupervisionFollowup = {
      id: generateUuid(),
      supervision_record_id: supervisionRecordId,
      activity_description: activityDescription,
      person_in_charge: personInCharge,
      target_date: targetDate,
      status: 'Dalam_Proses',
      result_notes: null,
      completion_date: null,
      created_at: now,
      updated_at: now,
    };

    const records = await this.getRecords();
    const updatedRecords = records.map((r) =>
      r.id === supervisionRecordId
        ? { ...r, followups: [...(r.followups || []), newFollowup], updated_at: now }
        : r
    );
    setLocal(STORAGE_KEY, updatedRecords);
    void syncService.flushMutations();

    if (isSupabaseAvailable() && isUuid(supervisionRecordId) && isUuid(newFollowup.id)) {
      try {
        const { error } = await supabase.from('supervision_followups').insert(newFollowup);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase addFollowup fallback:', err);
      }
    }

    return newFollowup;
  },

  async updateFollowupStatus(
    recordId: string,
    followupId: string,
    status: FollowupStatus,
    resultNotes?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const completionDate = status === 'Selesai' ? now.split('T')[0] : null;
    const records = await this.getRecords();

    const updatedRecords = records.map((rec) => {
      if (rec.id !== recordId || !rec.followups) return rec;
      return {
        ...rec,
        updated_at: now,
        followups: rec.followups.map((f) =>
          f.id === followupId
            ? {
                ...f,
                status,
                result_notes: resultNotes !== undefined ? resultNotes : f.result_notes,
                completion_date: completionDate ?? f.completion_date,
                updated_at: now,
              }
            : f
        ),
      };
    });

    setLocal(STORAGE_KEY, updatedRecords);
    void syncService.flushMutations();

    if (isSupabaseAvailable() && isUuid(followupId)) {
      try {
        const updatePayload: Record<string, any> = { status, updated_at: now };
        if (resultNotes !== undefined) updatePayload.result_notes = resultNotes;
        if (completionDate) updatePayload.completion_date = completionDate;
        const { error } = await supabase
          .from('supervision_followups')
          .update(updatePayload)
          .eq('id', followupId);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase updateFollowupStatus fallback:', err);
      }
    }
  },
};
