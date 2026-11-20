import { supabase, isSupabaseAvailable, reportSupabaseOutcome } from '../lib/supabaseClient';
import { DocumentLink, DocumentStatus, DocumentReview } from '../types/database.types';
import { DEMO_DOCUMENT_LINKS } from '../lib/demoData';
import { academicService } from './academicService';
import { notificationService } from './notificationService';

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

    if (isSupabaseAvailable()) {
      try {
        const { data, error } = await supabase
          .from('document_links')
          .select('*, teacher:teachers(*), class:classes(*), subject:subjects(*)')
          .order('created_at', { ascending: false });

        reportSupabaseOutcome(error);
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
        reportSupabaseOutcome(err);
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
      isSupabaseAvailable() &&
      isUuid(id) &&
      isUuid(payload.teacher_id) &&
      isUuid(payload.academic_year_id) &&
      isUuid(payload.semester_id)
    ) {
      try {
        const { teacher: _t, class: _c, subject: _s, ...rawDoc } = newDoc;
        const dbDoc = {
          ...rawDoc,
          class_id: isUuid(rawDoc.class_id) ? rawDoc.class_id : null,
          subject_id: isUuid(rawDoc.subject_id) ? rawDoc.subject_id : null,
        };
        const { data, error } = await supabase.from('document_links').insert(dbDoc).select().single();
        reportSupabaseOutcome(error);
        if (!error && data) {
          newDoc = {
            ...(data as DocumentLink),
            teacher: newDoc.teacher,
            class: newDoc.class,
            subject: newDoc.subject,
          };
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase createDocument fallback:', err);
      }
    }

    const items = getLocal<DocumentLink[]>(STORAGE_KEY, DEMO_DOCUMENT_LINKS);
    const updated = [newDoc, ...items.filter((d) => d.id !== newDoc.id)];
    setLocal(STORAGE_KEY, updated);

    if (newDoc.status === 'Diajukan') {
      const teacherLabel = newDoc.teacher?.full_name || 'Dewan Guru';
      void notificationService.addNotification({
        target_role: 'kepala_madrasah',
        category: 'dokumen',
        title: `Dokumen Baru Diajukan: ${newDoc.document_type}`,
        message: `${teacherLabel} mengirimkan "${newDoc.title}" ke arsip Google Drive madrasah untuk ditelaah.`,
        action_url: 'dashboard',
      });
    }

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

    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const { teacher: _t, class: _c, subject: _s, ...dbUpdates } = updates;
        const { error } = await supabase.from('document_links').update(dbUpdates).eq('id', id);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
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
    const updated = await this.updateDocument(id, {
      status: 'Diajukan',
      submission_date: new Date().toISOString(),
    });
    const teacherLabel = updated.teacher?.full_name || 'Dewan Guru';
    void notificationService.addNotification({
      target_role: 'kepala_madrasah',
      category: 'dokumen',
      title: `Pengajuan Telaah: ${updated.document_type}`,
      message: `${teacherLabel} mengajukan "${updated.title}" untuk ditelaah dan disetujui.`,
      action_url: 'dashboard',
    });
    return updated;
  },

  async deleteDocument(id: string): Promise<void> {
    if (isSupabaseAvailable() && isUuid(id)) {
      try {
        const { error } = await supabase.from('document_links').delete().eq('id', id);
        reportSupabaseOutcome(error);
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase deleteDocument fallback:', err);
      }
    }
    const localItems = getLocal<DocumentLink[]>(STORAGE_KEY, DEMO_DOCUMENT_LINKS);
    setLocal(
      STORAGE_KEY,
      localItems.filter((d) => d.id !== id)
    );
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

    if (isSupabaseAvailable() && isUuid(documentId)) {
      try {
        let resolvedReviewerId = isUuid(reviewerId) ? reviewerId : '';
        if (!resolvedReviewerId) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (isUuid(sessionData?.session?.user?.id)) resolvedReviewerId = sessionData!.session!.user!.id;
        }
        if (isUuid(resolvedReviewerId)) {
          const { reviewer: _r, ...dbReview } = { ...newReview, reviewed_by: resolvedReviewerId };
          const { error } = await supabase.from('document_reviews').insert(dbReview);
          reportSupabaseOutcome(error);
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase reviewDocument fallback:', err);
      }
    }

    const reviews = getLocal<DocumentReview[]>(REVIEWS_STORAGE_KEY, []);
    setLocal(REVIEWS_STORAGE_KEY, [newReview, ...reviews]);

    void notificationService.addNotification({
      target_role: 'guru',
      category: 'dokumen',
      title: `Hasil Telaah Kepala Madrasah: ${decision}`,
      message: `Dokumen "${updated.title}" (${updated.document_type}) berstatus ${decision}.${notes ? ` Catatan: ${notes}` : ''}`,
      action_url: 'arsip-drive',
    });

    return updated;
  },

  async getAllReviews(): Promise<DocumentReview[]> {
    const localReviews = getLocal<DocumentReview[]>(REVIEWS_STORAGE_KEY, []);
    if (isSupabaseAvailable()) {
      try {
        const { data, error } = await supabase
          .from('document_reviews')
          .select('*, reviewer:profiles(*)')
          .order('reviewed_at', { ascending: false });
        reportSupabaseOutcome(error);
        if (!error && Array.isArray(data) && data.length > 0) {
          const seen = new Set(localReviews.map((r) => r.id));
          const merged = [...localReviews];
          for (const item of data as DocumentReview[]) {
            if (!seen.has(item.id)) {
              merged.push(item);
              seen.add(item.id);
            }
          }
          return merged.sort((a, b) => (b.reviewed_at || '').localeCompare(a.reviewed_at || ''));
        }
      } catch (err) {
        reportSupabaseOutcome(err);
        console.warn('Supabase getAllReviews fallback:', err);
      }
    }
    return localReviews.sort((a, b) => (b.reviewed_at || '').localeCompare(a.reviewed_at || ''));
  },

  async getDocumentReviews(documentId: string): Promise<DocumentReview[]> {
    const all = await this.getAllReviews();
    return all.filter((r) => r.document_link_id === documentId);
  },
};
