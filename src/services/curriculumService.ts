import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { DocumentLink, DocumentStatus, DocumentReview } from '../types/database.types';
import { DEMO_DOCUMENT_LINKS } from '../lib/demoData';

const STORAGE_KEY = 'simpel_curriculum_documents';
const REVIEWS_STORAGE_KEY = 'simpel_curriculum_reviews';

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
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('document_links')
          .select('*, teacher:teachers(*), class:classes(*), subject:subjects(*)')
          .order('created_at', { ascending: false });

        if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId);
        if (filters?.classId) query = query.eq('class_id', filters.classId);
        if (filters?.subjectId) query = query.eq('subject_id', filters.subjectId);
        if (filters?.documentType) query = query.eq('document_type', filters.documentType);
        if (filters?.status) query = query.eq('status', filters.status);

        const { data, error } = await query;
        if (!error && data && data.length > 0) return data as DocumentLink[];
      } catch (err) {
        console.warn('Supabase getDocuments fallback:', err);
      }
    }

    let items = getLocal<DocumentLink[]>(STORAGE_KEY, DEMO_DOCUMENT_LINKS);
    if (filters?.teacherId) items = items.filter((d) => d.teacher_id === filters.teacherId);
    if (filters?.classId) items = items.filter((d) => d.class_id === filters.classId);
    if (filters?.subjectId) items = items.filter((d) => d.subject_id === filters.subjectId);
    if (filters?.documentType) items = items.filter((d) => d.document_type === filters.documentType);
    if (filters?.status) items = items.filter((d) => d.status === filters.status);

    return items;
  },

  async createDocument(payload: Omit<DocumentLink, 'id' | 'created_at' | 'updated_at'>): Promise<DocumentLink> {
    const newDoc: DocumentLink = {
      ...payload,
      id: `doc-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('document_links').insert(newDoc).select().single();
        if (data) return data as DocumentLink;
      } catch (err) {
        console.warn('Supabase createDocument fallback:', err);
      }
    }

    const items = await this.getDocuments();
    const updated = [newDoc, ...items];
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

    if (isSupabaseConfigured) {
      try {
        await supabase.from('document_links').update(updates).eq('id', id);
      } catch (err) {
        console.warn('Supabase updateDocument fallback:', err);
      }
    }

    const updatedList = items.map((d) => (d.id === id ? updatedDoc : d));
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

    const newReview: DocumentReview = {
      id: `rev-${Date.now()}`,
      document_link_id: documentId,
      reviewed_by: reviewerId,
      status_decision: decision,
      review_notes: notes,
      reviewed_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('document_reviews').insert(newReview);
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
