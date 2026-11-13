import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { DocumentLink, DocumentStatus, DocumentReview } from '../types/database.types';
import { DEMO_DOCUMENT_LINKS } from '../lib/demoData';
import { academicService } from './academicService';

const STORAGE_KEY = 'simpel_curriculum_documents';
const REVIEWS_STORAGE_KEY = 'simpel_curriculum_reviews';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v?: string | null) => typeof v === 'string' && UUID_REGEX.test(v);

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

export const curriculumService = {
  async getDocuments(filters?: {
    teacherId?: string;
    classId?: string;
    subjectId?: string;
    documentType?: string;
    status?: DocumentStatus;
  }): Promise<DocumentLink[]> {
    let baseItems = getLocal<DocumentLink[]>(STORAGE_KEY, DEMO_DOCUMENT_LINKS);

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('document_links')
          .select('*, teacher:teachers(*), class:classes(*), subject:subjects(*)')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const seen = new Set(baseItems.map((d) => d.id));
          const merged = [...baseItems];
          for (const item of data as DocumentLink[]) {
            if (!seen.has(item.id)) {
              merged.push(item);
              seen.add(item.id);
            }
          }
          baseItems = merged;
        }
      } catch (err) {
        console.warn('Supabase getDocuments fallback:', err);
      }
    }

    const [teachers, classes, subjects] = await Promise.all([
      academicService.getTeachers(),
      academicService.getClasses(),
      academicService.getSubjects(),
    ]);

    let items = baseItems.map((d) => ({
      ...d,
      teacher: teachers.find((t) => t.id === d.teacher_id) || d.teacher,
      class: classes.find((c) => c.id === d.class_id) || d.class,
      subject: subjects.find((s) => s.id === d.subject_id) || d.subject,
    }));

    if (filters?.teacherId) items = items.filter((d) => d.teacher_id === filters.teacherId);
    if (filters?.classId) items = items.filter((d) => d.class_id === filters.classId);
    if (filters?.subjectId) items = items.filter((d) => d.subject_id === filters.subjectId);
    if (filters?.documentType) items = items.filter((d) => d.document_type === filters.documentType);
    if (filters?.status) items = items.filter((d) => d.status === filters.status);

    return items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  async createDocument(payload: Omit<DocumentLink, 'id' | 'created_at' | 'updated_at'>): Promise<DocumentLink> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `doc-${Date.now()}`;
    const [teachers, classes, subjects] = await Promise.all([
      academicService.getTeachers(),
      academicService.getClasses(),
      academicService.getSubjects(),
    ]);

    let newDoc: DocumentLink = {
      ...payload,
      id,
      teacher: teachers.find((t) => t.id === payload.teacher_id),
      class: classes.find((c) => c.id === payload.class_id),
      subject: subjects.find((s) => s.id === payload.subject_id),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (
      isSupabaseConfigured &&
      isUuid(id) &&
      isUuid(payload.teacher_id) &&
      isUuid(payload.class_id) &&
      isUuid(payload.subject_id)
    ) {
      try {
        const { teacher: _t, class: _c, subject: _s, ...dbDoc } = newDoc;
        const { data } = await supabase.from('document_links').insert(dbDoc).select().single();
        if (data) {
          newDoc = {
            ...(data as DocumentLink),
            teacher: newDoc.teacher,
            class: newDoc.class,
            subject: newDoc.subject,
          };
        }
      } catch (err) {
        console.warn('Supabase createDocument fallback:', err);
      }
    }

    const items = getLocal<DocumentLink[]>(STORAGE_KEY, DEMO_DOCUMENT_LINKS);
    const updated = [newDoc, ...items.filter((d) => d.id !== newDoc.id)];
    setLocal(STORAGE_KEY, updated);
    return newDoc;
  },

  async updateDocument(id: string, updates: Partial<DocumentLink>): Promise<DocumentLink> {
    const items = await this.getDocuments();
    const doc = items.find((d) => d.id === id);
    if (!doc) throw new Error('Dokumen tidak ditemukan');

    const updatedDoc: DocumentLink = {
      ...doc,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && isUuid(id)) {
      try {
        const { teacher: _t, class: _c, subject: _s, ...dbUpdates } = updates;
        await supabase.from('document_links').update(dbUpdates).eq('id', id);
      } catch (err) {
        console.warn('Supabase updateDocument fallback:', err);
      }
    }

    const localItems = getLocal<DocumentLink[]>(STORAGE_KEY, DEMO_DOCUMENT_LINKS);
    const updatedList = localItems.some((d) => d.id === id)
      ? localItems.map((d) => (d.id === id ? updatedDoc : d))
      : [updatedDoc, ...localItems];
    setLocal(STORAGE_KEY, updatedList);
    return updatedDoc;
  },

  async submitDocument(id: string): Promise<DocumentLink> {
    return this.updateDocument(id, {
      status: 'Diajukan',
      submission_date: new Date().toISOString(),
    });
  },

  async reviewDocument(
    documentId: string,
    decision: 'Disetujui' | 'Perlu Revisi',
    notes: string,
    reviewerId: string
  ): Promise<DocumentLink> {
    const updated = await this.updateDocument(documentId, {
      status: decision,
    });

    const revId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rev-${Date.now()}`;
    const newReview: DocumentReview = {
      id: revId,
      document_link_id: documentId,
      reviewed_by: reviewerId,
      status_decision: decision,
      review_notes: notes,
      reviewed_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { reviewer: _r, ...dbReview } = newReview;
        await supabase.from('document_reviews').insert(dbReview);
      } catch (err) {
        console.warn('Supabase reviewDocument fallback:', err);
      }
    }

    const reviews = getLocal<DocumentReview[]>(REVIEWS_STORAGE_KEY, []);
    setLocal(REVIEWS_STORAGE_KEY, [newReview, ...reviews]);

    return updated;
  },

  async getDocumentReviews(documentId: string): Promise<DocumentReview[]> {
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('document_reviews')
          .select('*, reviewer:profiles(*)')
          .eq('document_link_id', documentId)
          .order('reviewed_at', { ascending: false });
        if (data) return data as DocumentReview[];
      } catch (err) {
        console.warn('Supabase getDocumentReviews fallback:', err);
      }
    }
    const reviews = getLocal<DocumentReview[]>(REVIEWS_STORAGE_KEY, []);
    return reviews.filter((r) => r.document_link_id === documentId);
  },
};
