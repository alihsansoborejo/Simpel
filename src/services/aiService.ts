/**
 * Layanan Klien untuk AI Assistant SIMPEL MI AL IHSAN
 * Menghubungkan antarmuka frontend dengan endpoint backend Express /api/ai/*
 * Serta mengelola draf dokumen lokal, riwayat log, dan fungsi ekspor Word/PDF
 */

import {
  AIFeatureType,
  AIAuditLogEntry,
  AIDocumentDraft,
  ModulAjarRequest,
  ModulAjarResult,
  LKPDRequest,
  LKPDResult,
  AssessmentQuestionRequest,
  AssessmentQuestionResult,
  LearningIdeaRequest,
  LearningIdeaResult,
  TeacherReflectionRequest,
  TeacherReflectionResult,
  LearningAnalysisRequest,
  LearningAnalysisResult,
  PrincipalAssistantRequest,
  PrincipalAssistantResult,
  ChatMessage,
} from '../types/ai.types';

const DRAFTS_STORAGE_KEY = 'simpel_ai_document_drafts_v1';

export const aiService = {
  // 1. Health check
  async checkHealth(): Promise<{ status: string; isGeminiConfigured: boolean; activeModel: string }> {
    try {
      const res = await fetch('/api/ai/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('AI health check failed:', err);
      return { status: 'offline', isGeminiConfigured: false, activeModel: 'gemini-3.8-flash (fallback)' };
    }
  },

  // 2. Audit logs
  async getLogs(): Promise<AIAuditLogEntry[]> {
    try {
      const res = await fetch('/api/ai/logs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.logs || [];
    } catch (err) {
      console.warn('Failed to fetch AI logs:', err);
      return [];
    }
  },

  async logUsage(data: {
    userId: string;
    userName: string;
    userRole: string;
    featureType: AIFeatureType;
    promptSummary: string;
    durationMs: number;
    status: 'sukses' | 'gagal' | 'cached';
  }): Promise<void> {
    try {
      await fetch('/api/ai/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.warn('Could not post AI usage log:', err);
    }
  },

  async submitFeedback(logId: string, feedback: 'puas' | 'cukup' | 'perlu_perbaikan'): Promise<boolean> {
    try {
      const res = await fetch('/api/ai/log-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, feedback }),
      });
      return res.ok;
    } catch (err) {
      console.warn('Feedback submit failed:', err);
      return false;
    }
  },

  // 3. AI Penyusun Modul Ajar
  async generateModulAjar(req: ModulAjarRequest): Promise<ModulAjarResult> {
    const res = await fetch('/api/ai/modul-ajar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Gagal menyusun Modul Ajar (Status: ${res.status})`);
    const json = await res.json();
    return json.data;
  },

  // 4. AI Pembuat LKPD
  async generateLKPD(req: LKPDRequest): Promise<LKPDResult> {
    const res = await fetch('/api/ai/lkpd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Gagal membuat LKPD (Status: ${res.status})`);
    const json = await res.json();
    return json.data;
  },

  // 5. AI Pembuat Soal & Asesmen
  async generateAssessment(req: AssessmentQuestionRequest): Promise<AssessmentQuestionResult> {
    const res = await fetch('/api/ai/soal-asesmen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Gagal membuat soal asesmen (Status: ${res.status})`);
    const json = await res.json();
    return json.data;
  },

  // 6. AI Ide Pembelajaran & Media
  async generateLearningIdeas(req: LearningIdeaRequest): Promise<LearningIdeaResult> {
    const res = await fetch('/api/ai/ide-pembelajaran', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Gagal membuat ide pembelajaran (Status: ${res.status})`);
    const json = await res.json();
    return json.data;
  },

  // 7. AI Asisten Refleksi Guru
  async generateTeacherReflection(req: TeacherReflectionRequest): Promise<TeacherReflectionResult> {
    const res = await fetch('/api/ai/refleksi-guru', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Gagal menganalisis refleksi mengajar (Status: ${res.status})`);
    const json = await res.json();
    return json.data;
  },

  // 8. AI Analisis Hasil Belajar
  async generateLearningAnalysis(req: LearningAnalysisRequest): Promise<LearningAnalysisResult> {
    const res = await fetch('/api/ai/analisis-belajar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Gagal menganalisis hasil belajar (Status: ${res.status})`);
    const json = await res.json();
    return json.data;
  },

  // 9. AI Asisten Kepala Madrasah
  async generatePrincipalAssistant(req: PrincipalAssistantRequest): Promise<PrincipalAssistantResult> {
    const res = await fetch('/api/ai/kepala-madrasah', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Gagal menyusun analisis manajerial kepala madrasah (Status: ${res.status})`);
    const json = await res.json();
    return json.data;
  },

  // 10. AI Asisten SIMPEL (Chatbot)
  async sendChatMessage(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<ChatMessage> {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error(`Gagal mengirim pesan chat (Status: ${res.status})`);
    const json = await res.json();
    return json.message;
  },

  // ==========================================
  // PENGELOLAAN DRAF DOKUMEN & SUBMIT
  // ==========================================
  getDrafts(): AIDocumentDraft[] {
    try {
      const data = localStorage.getItem(DRAFTS_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveDraft(draft: Omit<AIDocumentDraft, 'id' | 'createdAt' | 'updatedAt'>): AIDocumentDraft {
    const drafts = this.getDrafts();
    const newDraft: AIDocumentDraft = {
      ...draft,
      id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    drafts.unshift(newDraft);
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    return newDraft;
  },

  updateDraft(id: string, updates: Partial<AIDocumentDraft>): AIDocumentDraft | null {
    const drafts = this.getDrafts();
    const index = drafts.findIndex((d) => d.id === id);
    if (index === -1) return null;
    drafts[index] = {
      ...drafts[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    return drafts[index];
  },

  deleteDraft(id: string): boolean {
    const drafts = this.getDrafts();
    const filtered = drafts.filter((d) => d.id !== id);
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  },

  submitDraftForReview(id: string): AIDocumentDraft | null {
    return this.updateDraft(id, {
      status: 'diajukan',
      submittedAt: new Date().toISOString(),
    });
  },

  // ==========================================
  // FITUR EKSPOR WORD & PDF & SALIN
  // ==========================================
  exportToWord(filename: string, title: string, htmlContent: string) {
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${title}</title>
        <style>
          body { font-family: 'Calibri', 'Times New Roman', serif; font-size: 11pt; color: #1e293b; line-height: 1.5; margin: 20mm; }
          h1, h2, h3 { color: #047857; margin-top: 16pt; margin-bottom: 6pt; }
          h1 { font-size: 16pt; border-bottom: 2pt solid #047857; padding-bottom: 4pt; }
          h2 { font-size: 13pt; border-bottom: 1pt solid #cbd5e1; }
          h3 { font-size: 11pt; }
          table { width: 100%; border-collapse: collapse; margin-top: 8pt; margin-bottom: 12pt; }
          th, td { border: 1pt solid #94a3b8; padding: 6pt 8pt; text-align: left; font-size: 10pt; }
          th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; }
          .kop { text-align: center; border-bottom: 3pt double #047857; padding-bottom: 10pt; margin-bottom: 16pt; }
          .kop h2 { margin: 0; font-size: 14pt; color: #047857; border: none; }
          .kop p { margin: 2pt 0; font-size: 9pt; color: #475569; }
          .badge { background-color: #fef3c7; color: #92400e; padding: 2pt 6pt; border-radius: 4pt; font-size: 9pt; font-weight: bold; }
          .box-cinta { background-color: #f0fdf4; border-left: 4pt solid #059669; padding: 8pt 12pt; margin: 10pt 0; }
        </style>
      </head>
      <body>
        <div class="kop">
          <h2>LEMBAGA PENDIDIKAN MA'ARIF NU</h2>
          <h2 style="font-size: 16pt; color: #065f46;">MI MA'ARIF AL IHSAN SOBOREJO</h2>
          <p>Alamat: Soborejo, Kec. Pringsurat, Kabupaten Temanggung, Jawa Tengah</p>
          <p>Sistem Informasi Manajemen Pembelajaran (SIMPEL) - Kurikulum Merdeka & Kurikulum Berbasis Cinta</p>
        </div>
        ${htmlContent}
        <br/><br/>
        <table style="border: none; width: 100%; margin-top: 20pt;">
          <tr style="border: none;">
            <td style="border: none; width: 50%; text-align: center;">
              Mengetahui,<br/>
              Kepala Madrasah<br/><br/><br/><br/>
              <b>H. Mahfudz, M.Pd.I</b><br/>
              NIP. 197508122005011003
            </td>
            <td style="border: none; width: 50%; text-align: center;">
              Soborejo, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>
              Guru Pengampu,<br/><br/><br/><br/>
              <b>Ahmad Fauzi, S.Pd.I</b><br/>
              NUPTK. 8452763665200012
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', header], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  exportToPrintPDF(contentElementId: string, customTitle?: string) {
    const el = document.getElementById(contentElementId);
    if (!el) {
      window.print();
      return;
    }

    import('./printService').then(({ printDocumentDirectly }) => {
      printDocumentDirectly(el.innerHTML, {
        title: customTitle || 'DOKUMEN HASIL PERANCANGAN AI PEMBELAJARAN',
        subtitle: 'Kurikulum Berbasis Cinta (KBC) & Pembelajaran Mendalam (Deep Learning)',
        metadata: [
          { label: 'Model AI', value: 'Google Gemini 3.8 Flash' },
          { label: 'Tahun Ajaran', value: '2025/2026 (Semester Ganjil)' },
          { label: 'Tanggal Penyusunan', value: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) },
        ],
        signature: {
          leftTitle: 'Penyusun / Guru Pengampu,',
          leftName: 'Ust. Ahmad Fauzi, S.Pd.I',
          leftNip: '198503122019031008',
          rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          rightTitle: 'Mengetahui,<br>Kepala Madrasah,',
          rightName: 'MUIN, S.Pd.I',
          rightNip: '197508152005011004',
        },
      });
    }).catch(() => {
      window.print();
    });
  },

  async copyText(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
      return false;
    }
  },
};
