import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { curriculumWorkspaceService } from '../../services/curriculumWorkspaceService';
import { printDocumentDirectly } from '../../services/printService';
import {
  CapaianPembelajaranItem,
  TujuanPembelajaranItem,
  AlurTujuanPembelajaranItem,
  ModulAjarItem,
  LKPDItem,
} from '../../types/curriculum.types';
import {
  BookOpen,
  Plus,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  FolderSync,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Filter,
  Check,
  X,
  Heart,
  Layers,
  ArrowRight,
} from 'lucide-react';

export type CurriculumTab = 'cp' | 'tp' | 'atp' | 'modul-ajar' | 'lkpd';

interface CurriculumManagementPageProps {
  defaultTab?: CurriculumTab;
  onNavigate?: (view: string) => void;
}

export const CurriculumManagementPage: React.FC<CurriculumManagementPageProps> = ({
  defaultTab = 'cp',
  onNavigate,
}) => {
  const { user, activeRole } = useAuth();
  const [activeTab, setActiveTab] = useState<CurriculumTab>(defaultTab);

  // Filter States
  const [selectedSubject, setSelectedSubject] = useState<string>('sbj-ind');
  const [selectedClass, setSelectedClass] = useState<number>(4);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Data States
  const [cpList, setCpList] = useState<CapaianPembelajaranItem[]>([]);
  const [tpList, setTpList] = useState<TujuanPembelajaranItem[]>([]);
  const [atpList, setAtpList] = useState<AlurTujuanPembelajaranItem[]>([]);
  const [modulList, setModulList] = useState<ModulAjarItem[]>([]);
  const [lkpdList, setLkpdList] = useState<LKPDItem[]>([]);

  // Modal States
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Form States
  const [cpForm, setCpForm] = useState({ element: 'Menyimak', description: '', source: 'BSKAP No. 032/H/KR/2024' });
  const [tpForm, setTpForm] = useState({ code: 'TP 4.', description: '', scope: '', semester: 'Ganjil' as 'Ganjil' | 'Genap', jp: 12 });
  const [atpForm, setAtpForm] = useState({ order: 1, stage: 'Tahap 1', chapter: '', tpCodes: 'TP 4.1', summary: '', jp: 18, assessment: '' });
  const [modulForm, setModulForm] = useState({ chapter: '', topic: '', tpCode: 'TP 4.1', meetings: '3 Pertemuan (6 JP)', driveUrl: '', intro: '', core: '', closing: '' });
  const [lkpdForm, setLkpdForm] = useState({ title: '', chapter: '', tpCode: 'TP 4.1', activityType: 'Kelompok Kolaboratif' as 'Individu' | 'Kelompok Kolaboratif' | 'Penyelidikan / Eksperimen', instructions: '', rubric: '', driveUrl: '' });

  // Sinkronisasi tab saat defaultTab berganti dari props
  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const loadData = () => {
    setCpList(curriculumWorkspaceService.getCPList());
    setTpList(curriculumWorkspaceService.getTPList());
    setAtpList(curriculumWorkspaceService.getATPList());
    setModulList(curriculumWorkspaceService.getModulList());
    setLkpdList(curriculumWorkspaceService.getLKPDList());
  };

  useEffect(() => {
    loadData();
  }, []);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Helper filter data per subject & class
  const filteredCP = cpList.filter(
    (c) =>
      c.subject_id === selectedSubject &&
      c.class_level === selectedClass &&
      (c.element.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredTP = tpList.filter(
    (t) =>
      t.subject_id === selectedSubject &&
      t.class_level === selectedClass &&
      (t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.scope_of_material.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredATP = atpList.filter(
    (a) =>
      a.subject_id === selectedSubject &&
      a.class_level === selectedClass &&
      (a.chapter_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.material_summary.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredModul = modulList.filter(
    (m) =>
      m.subject_id === selectedSubject &&
      m.class_level === selectedClass &&
      (m.chapter_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.topic.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredLKPD = lkpdList.filter(
    (l) =>
      l.subject_id === selectedSubject &&
      l.class_level === selectedClass &&
      (l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.chapter_topic.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Ekspor CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `perangkat_${activeTab}_kelas${selectedClass}.csv`;

    if (activeTab === 'cp') {
      headers = ['No', 'Mata Pelajaran', 'Fase', 'Elemen', 'Deskripsi Capaian Pembelajaran', 'Sumber Acuan'];
      rows = filteredCP.map((c, i) => [i + 1, c.subject_name, c.phase, c.element, `"${c.description}"`, `"${c.source}"`]);
    } else if (activeTab === 'tp') {
      headers = ['No', 'Kode TP', 'Mata Pelajaran', 'Kelas', 'Semester', 'Lingkup Materi / Bab', 'Tujuan Pembelajaran', 'Alokasi (JP)'];
      rows = filteredTP.map((t, i) => [i + 1, t.code, t.subject_name, t.class_level, t.semester, `"${t.scope_of_material}"`, `"${t.description}"`, t.allocated_hours]);
    } else if (activeTab === 'atp') {
      headers = ['Urutan', 'Tahap', 'Bab / Lingkup Materi', 'TP Terkait', 'Ringkasan Materi', 'Alokasi (JP)', 'Rencana Asesmen'];
      rows = filteredATP.map((a) => [a.sequence_order, a.stage_name, `"${a.chapter_title}"`, `"${a.tp_codes.join(', ')}"`, `"${a.material_summary}"`, a.allocated_hours, `"${a.assessment_plan}"`]);
    } else if (activeTab === 'modul-ajar') {
      headers = ['No', 'Bab', 'Topik Modul', 'Target TP', 'Pertemuan', 'Pendekatan Cinta / Deep Learning', 'Status', 'Tautan Drive'];
      rows = filteredModul.map((m, i) => [i + 1, `"${m.chapter_title}"`, `"${m.topic}"`, m.target_tp_code, m.allocated_meetings, `"${m.deep_learning_approach}"`, m.status, m.google_drive_url]);
    } else {
      headers = ['No', 'Judul LKPD', 'Bab / Topik', 'Target TP', 'Tipe Aktivitas', 'Petunjuk Singkat', 'Tautan Google Docs/Drive'];
      rows = filteredLKPD.map((l, i) => [i + 1, `"${l.title}"`, `"${l.chapter_topic}"`, l.target_tp_code, l.activity_type, `"${l.instructions}"`, l.google_drive_url]);
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`Berkas ${filename} berhasil diunduh.`);
  };

  // Cetak Dokumen
  const handlePrint = () => {
    const currentSubjectName = selectedSubject === 'sbj-ind' ? 'Bahasa Indonesia' : 'IPAS';
    let title = 'PERANGKAT PEMBELAJARAN MADRASAH';
    let subtitle = `${currentSubjectName} - Kelas ${selectedClass}`;
    let contentHtml = '';

    if (activeTab === 'cp') {
      title = 'DOKUMEN CAPAIAN PEMBELAJARAN (CP)';
      contentHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">No</th>
              <th style="width: 140px;">Elemen Capaian</th>
              <th>Deskripsi Capaian Pembelajaran</th>
              <th style="width: 70px;">Fase</th>
            </tr>
          </thead>
          <tbody>
            ${filteredCP.map((item, idx) => `
              <tr>
                <td class="center">${idx + 1}</td>
                <td><strong>${item.element}</strong></td>
                <td>${item.description}</td>
                <td class="center font-bold">Fase ${item.phase}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeTab === 'tp') {
      title = 'DOKUMEN TUJUAN PEMBELAJARAN (TP)';
      contentHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">No</th>
              <th style="width: 80px;">Kode TP</th>
              <th style="width: 160px;">Lingkup Materi</th>
              <th>Rumusan Tujuan Pembelajaran (TP)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTP.map((item, idx) => `
              <tr>
                <td class="center">${idx + 1}</td>
                <td class="center font-mono font-bold">${item.code}</td>
                <td><strong>${item.scope_of_material}</strong></td>
                <td>${item.description}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeTab === 'atp') {
      title = 'ALUR TUJUAN PEMBELAJARAN (ATP)';
      contentHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 55px;">Urutan</th>
              <th style="width: 90px;">Kode TP</th>
              <th>Alur Tujuan Pembelajaran & Aktivitas</th>
              <th style="width: 80px;">Alokasi JP</th>
            </tr>
          </thead>
          <tbody>
            ${filteredATP.map((item) => `
              <tr>
                <td class="center font-bold">Tahap ${item.sequence_order}</td>
                <td class="center font-mono font-bold">${item.tp_codes ? item.tp_codes.join(', ') : item.stage_name}</td>
                <td><strong>${item.chapter_title}</strong>: ${item.material_summary}</td>
                <td class="center font-bold">${item.allocated_hours} JP</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeTab === 'modul-ajar') {
      title = 'MODUL AJAR PEMBELAJARAN MENDALAM';
      contentHtml = filteredModul.map((m, idx) => `
        <div style="margin-bottom: 24px; border: 1px solid #cbd5e1; padding: 12px; page-break-inside: avoid;">
          <h3 style="margin: 0 0 8px 0; color: #047857;">${idx + 1}. ${m.chapter_title} (${m.allocated_meetings})</h3>
          <p style="margin: 2px 0;"><strong>Topik:</strong> ${m.topic}</p>
          <p style="margin: 2px 0;"><strong>Pendekatan:</strong> <span style="color:#047857;font-weight:bold;">${m.deep_learning_approach}</span></p>
          <div style="margin-top: 8px;"><strong>Langkah Pembelajaran Mendalam:</strong></div>
          <div style="margin-top: 4px; padding: 6px; background: #f8fafc; border-left: 3px solid #047857; font-size: 9.5pt;">${(m.learning_activities?.core_deep_learning || m.learning_activities?.introduction || '').replace(/\n/g, '<br>')}</div>
        </div>
      `).join('');
    } else if (activeTab === 'lkpd') {
      title = 'LEMBAR KERJA PESERTA DIDIK (LKPD)';
      contentHtml = filteredLKPD.map((l, idx) => `
        <div style="margin-bottom: 24px; border: 1px solid #cbd5e1; padding: 12px; page-break-inside: avoid;">
          <h3 style="margin: 0 0 6px 0; color: #047857;">${idx + 1}. ${l.title} (${l.activity_type})</h3>
          <p style="margin: 2px 0;"><strong>Materi / Bab:</strong> ${l.chapter_topic}</p>
          <div style="margin-top: 8px;"><strong>Instruksi & Lembar Tugas:</strong></div>
          <div style="margin-top: 4px; padding: 8px; background: #f8fafc; border: 1px dashed #94a3b8; font-size: 9.5pt;">${(l.instructions || '').replace(/\n/g, '<br>')}</div>
        </div>
      `).join('');
    }

    printDocumentDirectly(contentHtml, {
      title,
      subtitle: `${currentSubjectName} - Kelas ${selectedClass} (Tahun Pelajaran 2025/2026)`,
      metadata: [
        { label: 'Mata Pelajaran', value: currentSubjectName },
        { label: 'Tingkat Kelas', value: `Kelas ${selectedClass}` },
        { label: 'Kurikulum Acuan', value: 'Kurikulum Merdeka (KMA 450/2024) - KBC' },
        { label: 'Tanggal Dokumen', value: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) },
      ],
      signature: {
        leftTitle: 'Guru Pengampu Mata Pelajaran,',
        leftName: user?.profile?.full_name || 'Ust. Ahmad Fauzi, S.Pd.I',
        leftNip: '198503122019031008',
        rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        rightTitle: 'Mengetahui,<br>Kepala Madrasah,',
        rightName: 'MUIN, S.Pd.I',
        rightNip: '197508152005011004',
      },
    });
  };

  // Handler Submit Form
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const currentSubjectName = selectedSubject === 'sbj-ind' ? 'Bahasa Indonesia' : 'IPAS';

    if (activeTab === 'cp') {
      const item: CapaianPembelajaranItem = {
        id: editId || `cp-${Date.now()}`,
        subject_id: selectedSubject,
        subject_name: currentSubjectName,
        phase: 'B',
        class_level: selectedClass,
        element: cpForm.element,
        description: cpForm.description,
        source: cpForm.source,
        created_at: new Date().toISOString(),
      };
      curriculumWorkspaceService.saveCP(item);
      notify('Capaian Pembelajaran (CP) berhasil disimpan.');
    } else if (activeTab === 'tp') {
      const item: TujuanPembelajaranItem = {
        id: editId || `tp-${Date.now()}`,
        subject_id: selectedSubject,
        subject_name: currentSubjectName,
        class_level: selectedClass,
        code: tpForm.code,
        description: tpForm.description,
        scope_of_material: tpForm.scope,
        semester: tpForm.semester,
        allocated_hours: Number(tpForm.jp),
        is_active: true,
        created_at: new Date().toISOString(),
      };
      curriculumWorkspaceService.saveTP(item);
      notify('Tujuan Pembelajaran (TP) berhasil disimpan & terintegrasi ke Daftar Nilai.');
    } else if (activeTab === 'atp') {
      const item: AlurTujuanPembelajaranItem = {
        id: editId || `atp-${Date.now()}`,
        subject_id: selectedSubject,
        subject_name: currentSubjectName,
        class_level: selectedClass,
        semester: 'Ganjil',
        sequence_order: Number(atpForm.order),
        stage_name: atpForm.stage,
        chapter_title: atpForm.chapter,
        tp_codes: atpForm.tpCodes.split(',').map((s) => s.trim()),
        material_summary: atpForm.summary,
        allocated_hours: Number(atpForm.jp),
        assessment_plan: atpForm.assessment,
        created_at: new Date().toISOString(),
      };
      curriculumWorkspaceService.saveATP(item);
      notify('Alur Tujuan Pembelajaran (ATP) berhasil disimpan.');
    } else if (activeTab === 'modul-ajar') {
      const item: ModulAjarItem = {
        id: editId || `modul-${Date.now()}`,
        teacher_id: user?.teacherId || 'tch-1',
        teacher_name: user?.profile?.full_name || 'Guru Pendidik',
        subject_id: selectedSubject,
        subject_name: currentSubjectName,
        class_level: selectedClass,
        semester: 'Ganjil',
        chapter_title: modulForm.chapter,
        topic: modulForm.topic,
        target_tp_code: modulForm.tpCode,
        allocated_meetings: modulForm.meetings,
        deep_learning_approach: 'Kurikulum Berbasis Cinta & Pembelajaran Mendalam (Mindful, Meaningful, Joyful)',
        learning_activities: {
          introduction: modulForm.intro,
          core_deep_learning: modulForm.core,
          closing_reflection: modulForm.closing,
        },
        google_drive_url: modulForm.driveUrl || 'https://drive.google.com/drive/folders/simpel-mi-al-ihsan',
        status: 'Draft',
        created_at: new Date().toISOString(),
      };
      curriculumWorkspaceService.saveModul(item);
      notify('Modul Ajar Deep Learning berhasil disimpan sebagai draf.');
    } else {
      const item: LKPDItem = {
        id: editId || `lkpd-${Date.now()}`,
        teacher_id: user?.teacherId || 'tch-1',
        teacher_name: user?.profile?.full_name || 'Guru Pendidik',
        subject_id: selectedSubject,
        subject_name: currentSubjectName,
        class_level: selectedClass,
        title: lkpdForm.title,
        chapter_topic: lkpdForm.chapter,
        target_tp_code: lkpdForm.tpCode,
        activity_type: lkpdForm.activityType,
        instructions: lkpdForm.instructions,
        rubric_summary: lkpdForm.rubric,
        google_drive_url: lkpdForm.driveUrl || 'https://docs.google.com/document/d/simpel-mi-al-ihsan-lkpd',
        created_at: new Date().toISOString(),
      };
      curriculumWorkspaceService.saveLKPD(item);
      notify('Lembar Kerja Peserta Didik (LKPD) berhasil disimpan.');
    }

    setShowModal(false);
    setEditId(null);
    loadData();
  };

  // Buka Modal Tambah
  const handleOpenAdd = () => {
    setEditId(null);
    if (activeTab === 'cp') {
      setCpForm({ element: 'Menyimak', description: '', source: 'BSKAP No. 032/H/KR/2024' });
    } else if (activeTab === 'tp') {
      const nextNum = filteredTP.length + 1;
      setTpForm({ code: `TP ${selectedClass}.${nextNum}`, description: '', scope: '', semester: 'Ganjil', jp: 12 });
    } else if (activeTab === 'atp') {
      const nextSeq = filteredATP.length + 1;
      setAtpForm({ order: nextSeq, stage: `Tahap ${nextSeq}`, chapter: '', tpCodes: `TP ${selectedClass}.1`, summary: '', jp: 18, assessment: '' });
    } else if (activeTab === 'modul-ajar') {
      setModulForm({ chapter: '', topic: '', tpCode: 'TP 4.1', meetings: '3 Pertemuan (6 JP)', driveUrl: '', intro: 'Tadarus pagi, sapaan kasih sayang guru, apersepsi.', core: 'Eksplorasi konsep bermakna, diskusi kolaboratif santun.', closing: 'Refleksi berkesadaran dan doa penutup.' });
    } else {
      setLkpdForm({ title: '', chapter: '', tpCode: 'TP 4.1', activityType: 'Kelompok Kolaboratif', instructions: '', rubric: '', driveUrl: '' });
    }
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Notifikasi Pop-up */}
      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-900 text-amber-300 text-xs font-semibold flex items-center justify-between shadow-lg border border-emerald-700 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-white hover:text-amber-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
              Kurikulum Merdeka & Kurikulum Berbasis Cinta
            </span>
            <span className="text-xs text-slate-400">· MI Ma’arif Al Ihsan Soborejo</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Pengelolaan Perangkat Pembelajaran
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola CP, TP, ATP, Modul Ajar, dan LKPD secara aktif, terstruktur, serta tersinkronisasi ke Google Drive & Buku Nilai.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onNavigate && (
            <button
              onClick={() => onNavigate(activeTab === 'lkpd' ? 'asisten-ai-lkpd' : 'asisten-ai-modul')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-950 bg-amber-400 hover:bg-amber-300 transition-colors shadow-xs cursor-pointer"
              title="Buat Rancangan Otomatis dengan AI Gemini"
            >
              <Sparkles className="w-4 h-4 text-emerald-950" />
              <span>Buat dengan AI</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
            title="Ekspor ke CSV / Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
            title="Cetak Dokumen Resmi"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Cetak / PDF</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4 text-amber-300" />
            <span>Tambah {activeTab.toUpperCase()} Baru</span>
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('asisten-ai')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-500 transition-colors shadow-xs"
              title="Bantu Susun dengan AI"
            >
              <Sparkles className="w-4 h-4 text-emerald-950" />
              <span>Bantu AI</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar: Mapel & Kelas + Tab Sub Menu Aktif */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-xs">
        {/* Sub-Menu Tabs (CP, TP, ATP, Modul Ajar, LKPD) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
          <button
            onClick={() => setActiveTab('cp')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'cp'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>CP (Capaian Pembelajaran)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'cp' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredCP.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tp')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'tp'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>TP (Tujuan Pembelajaran)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'tp' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredTP.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('atp')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'atp'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>ATP (Alur Tujuan Pembelajaran)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'atp' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredATP.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('modul-ajar')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'modul-ajar'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Heart className="w-4 h-4 text-rose-400" />
            <span>Modul Ajar (Deep Learning)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'modul-ajar' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredModul.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('lkpd')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'lkpd'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FolderSync className="w-4 h-4" />
            <span>LKPD (Lembar Kerja Peserta Didik)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'lkpd' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredLKPD.length}
            </span>
          </button>
        </div>

        {/* Filter Baris: Pemilihan Mapel & Kelas & Kotak Pencarian */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Mata Pelajaran:</span>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="sbj-ind">Bahasa Indonesia</option>
                <option value="sbj-ipas">IPAS</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Tingkat Kelas:</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value={4}>Kelas 4 (Fase B)</option>
                <option value={1}>Kelas 1 (Fase A)</option>
                <option value={2}>Kelas 2 (Fase A)</option>
                <option value={3}>Kelas 3 (Fase B)</option>
                <option value={5}>Kelas 5 (Fase C)</option>
                <option value={6}>Kelas 6 (Fase C)</option>
              </select>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={`Cari dalam ${activeTab.toUpperCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: CAPAIAN PEMBELAJARAN (CP)
          ========================================================================= */}
      {activeTab === 'cp' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                Daftar Capaian Pembelajaran (CP) Fase B · Kelas 4
              </h3>
              <p className="text-xs text-emerald-700">
                Elemen kompetensi dasar yang harus dicapai peserta didik pada akhir fase.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredCP.length} Elemen
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredCP.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Tidak ada data Capaian Pembelajaran yang cocok dengan filter.
              </div>
            ) : (
              filteredCP.map((cp, idx) => (
                <div key={cp.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-emerald-100 text-emerald-800">
                        Elemen: {cp.element}
                      </span>
                      <span className="text-[11px] text-slate-400">Fase {cp.phase}</span>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">
                      {cp.description}
                    </p>
                    <p className="text-[10px] text-slate-400 italic">
                      Dasar Hukum / Sumber: {cp.source}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-start">
                    <button
                      onClick={() => {
                        setActiveTab('tp');
                        notify(`Beralih ke Tujuan Pembelajaran untuk elemen ${cp.element}`);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <span>Lihat TP Terkait</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Hapus CP elemen ${cp.element}?`)) {
                          curriculumWorkspaceService.deleteCP(cp.id);
                          loadData();
                          notify('Capaian Pembelajaran dihapus.');
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: TUJUAN PEMBELAJARAN (TP)
          ========================================================================= */}
      {activeTab === 'tp' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                Tujuan Pembelajaran (TP) Terpetakan Semester Ganjil & Genap
              </h3>
              <p className="text-xs text-emerald-700">
                TP ini terintegrasi langsung sebagai kolom penilaian di Buku Nilai Siswa (Formatif & Sumatif).
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredTP.length} TP
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Lingkup Materi / Bab</th>
                  <th className="px-4 py-3">Tujuan Pembelajaran (TP)</th>
                  <th className="px-4 py-3">Semester</th>
                  <th className="px-4 py-3">Alokasi JP</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTP.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada data Tujuan Pembelajaran.
                    </td>
                  </tr>
                ) : (
                  filteredTP.map((tp) => (
                    <tr key={tp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                          {tp.code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{tp.scope_of_material}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-md font-medium">{tp.description}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tp.semester === 'Ganjil' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'}`}>
                          {tp.semester}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 font-bold">{tp.allocated_hours} JP</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {onNavigate && (
                            <button
                              onClick={() => onNavigate('asesmen-nilai')}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px]"
                              title="Lihat di Buku Nilai"
                            >
                              Nilai
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Hapus ${tp.code}?`)) {
                                curriculumWorkspaceService.deleteTP(tp.id);
                                loadData();
                                notify('TP berhasil dihapus.');
                              }
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-600"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: ALUR TUJUAN PEMBELAJARAN (ATP)
          ========================================================================= */}
      {activeTab === 'atp' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                Alur Tujuan Pembelajaran (ATP) Sekuensial Semester Ganjil
              </h3>
              <p className="text-xs text-emerald-700">
                Urutan bab, TP terintegrasi, dan rencana evaluasi per unit materi.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredATP.length} Tahapan
            </span>
          </div>

          <div className="p-4 space-y-3">
            {filteredATP.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Tidak ada data Alur Pembelajaran.</p>
            ) : (
              filteredATP.map((atp) => (
                <div key={atp.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-emerald-500 transition-all space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-700 text-white font-bold text-[10px]">
                        {atp.stage_name}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900">{atp.chapter_title}</h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {atp.allocated_hours} JP
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`Hapus alur ${atp.chapter_title}?`)) {
                            curriculumWorkspaceService.deleteATP(atp.id);
                            loadData();
                            notify('Alur ATP dihapus.');
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 font-medium">{atp.material_summary}</p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    <span className="font-semibold text-slate-500">TP yang Dibahas:</span>
                    {atp.tp_codes.map((code) => (
                      <span key={code} className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">
                        {code}
                      </span>
                    ))}
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 italic">Rencana Asesmen: {atp.assessment_plan}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: MODUL AJAR (DEEP LEARNING & KURIKULUM BERBASIS CINTA)
          ========================================================================= */}
      {activeTab === 'modul-ajar' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                Modul Ajar Deep Learning & Kurikulum Berbasis Cinta
              </h3>
              <p className="text-xs text-emerald-700">
                Penyusunan RPP/Modul Ajar Pembelajaran Mendalam (Mindful, Meaningful, Joyful) tersimpan di Google Drive madrasah.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredModul.length} Modul
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredModul.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6 col-span-2">Tidak ada data Modul Ajar.</p>
            ) : (
              filteredModul.map((modul) => (
                <div key={modul.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 transition-all flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        {modul.chapter_title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          modul.status === 'Disetujui'
                            ? 'bg-emerald-100 text-emerald-800'
                            : modul.status === 'Diajukan'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {modul.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-slate-900">{modul.topic}</h4>
                    <p className="text-[11px] text-slate-600 line-clamp-2 italic">
                      "{modul.deep_learning_approach}"
                    </p>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] space-y-1">
                      <p>
                        <strong className="text-emerald-900">Inti Cinta:</strong> {modul.learning_activities.core_deep_learning}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <a
                      href={modul.google_drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
                    >
                      <FolderSync className="w-3.5 h-3.5" />
                      <span>Buka di Google Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => {
                        if (confirm(`Hapus modul ${modul.topic}?`)) {
                          curriculumWorkspaceService.deleteModul(modul.id);
                          loadData();
                          notify('Modul ajar dihapus.');
                        }
                      }}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: LKPD (LEMBAR KERJA PESERTA DIDIK)
          ========================================================================= */}
      {activeTab === 'lkpd' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                Lembar Kerja Peserta Didik (LKPD) Interaktif & Kontekstual
              </h3>
              <p className="text-xs text-emerald-700">
                Lembar aktivitas individu dan kolaboratif menumbuhkan empati dan daya nalar siswa.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredLKPD.length} LKPD
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredLKPD.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6 col-span-2">Tidak ada data LKPD.</p>
            ) : (
              filteredLKPD.map((lkpd) => (
                <div key={lkpd.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 transition-all flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                        {lkpd.activity_type}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 font-bold">{lkpd.target_tp_code}</span>
                    </div>

                    <h4 className="font-bold text-xs text-slate-900">{lkpd.title}</h4>
                    <p className="text-[11px] text-slate-600 line-clamp-3 whitespace-pre-line bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {lkpd.instructions}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      <strong>Rubrik Penskoran:</strong> {lkpd.rubric_summary}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <a
                      href={lkpd.google_drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
                    >
                      <FolderSync className="w-3.5 h-3.5" />
                      <span>Google Docs / Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => {
                        if (confirm(`Hapus ${lkpd.title}?`)) {
                          curriculumWorkspaceService.deleteLKPD(lkpd.id);
                          loadData();
                          notify('LKPD dihapus.');
                        }
                      }}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL FORMULIR TAMBAH / KELOLA DATA
          ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Tambah {activeTab.toUpperCase()} Baru ({selectedSubject === 'sbj-ind' ? 'Bahasa Indonesia' : 'IPAS'} - Kelas {selectedClass})
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3.5 text-xs">
              {/* Form CP */}
              {activeTab === 'cp' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Elemen CP</label>
                    <select
                      value={cpForm.element}
                      onChange={(e) => setCpForm({ ...cpForm, element: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    >
                      <option value="Menyimak">Menyimak</option>
                      <option value="Membaca dan Memirsa">Membaca dan Memirsa</option>
                      <option value="Berbicara dan Mempresentasikan">Berbicara dan Mempresentasikan</option>
                      <option value="Menulis">Menulis</option>
                      <option value="Pemahaman IPAS">Pemahaman IPAS</option>
                      <option value="Keterampilan Proses">Keterampilan Proses</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Deskripsi Capaian Pembelajaran</label>
                    <textarea
                      rows={3}
                      required
                      value={cpForm.description}
                      onChange={(e) => setCpForm({ ...cpForm, description: e.target.value })}
                      placeholder="Tuliskan rumusan kompetensi CP..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sumber Acuan Regulasi</label>
                    <input
                      type="text"
                      value={cpForm.source}
                      onChange={(e) => setCpForm({ ...cpForm, source: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </>
              )}

              {/* Form TP */}
              {activeTab === 'tp' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Kode TP</label>
                      <input
                        type="text"
                        required
                        value={tpForm.code}
                        onChange={(e) => setTpForm({ ...tpForm, code: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Semester</label>
                      <select
                        value={tpForm.semester}
                        onChange={(e) => setTpForm({ ...tpForm, semester: e.target.value as 'Ganjil' | 'Genap' })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        <option value="Ganjil">Semester Ganjil</option>
                        <option value="Genap">Semester Genap</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Lingkup Materi / Bab</label>
                    <input
                      type="text"
                      required
                      value={tpForm.scope}
                      onChange={(e) => setTpForm({ ...tpForm, scope: e.target.value })}
                      placeholder="Contoh: Bab 1: Sudah Besar"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bunyi Tujuan Pembelajaran (TP)</label>
                    <textarea
                      rows={2}
                      required
                      value={tpForm.description}
                      onChange={(e) => setTpForm({ ...tpForm, description: e.target.value })}
                      placeholder="Contoh: Mengidentifikasi ide pokok teks dengan cermat..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Perkiraan Alokasi Waktu (JP)</label>
                    <input
                      type="number"
                      min={2}
                      max={36}
                      value={tpForm.jp}
                      onChange={(e) => setTpForm({ ...tpForm, jp: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </>
              )}

              {/* Form ATP */}
              {activeTab === 'atp' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Urutan Alur</label>
                      <input
                        type="number"
                        min={1}
                        value={atpForm.order}
                        onChange={(e) => setAtpForm({ ...atpForm, order: Number(e.target.value), stage: `Tahap ${e.target.value}` })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Alokasi Total JP</label>
                      <input
                        type="number"
                        value={atpForm.jp}
                        onChange={(e) => setAtpForm({ ...atpForm, jp: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bab / Unit Pembelajaran</label>
                    <input
                      type="text"
                      required
                      value={atpForm.chapter}
                      onChange={(e) => setAtpForm({ ...atpForm, chapter: e.target.value })}
                      placeholder="Contoh: Bab 1: Sudah Besar"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Daftar Kode TP (Pisahkan Koma)</label>
                    <input
                      type="text"
                      value={atpForm.tpCodes}
                      onChange={(e) => setAtpForm({ ...atpForm, tpCodes: e.target.value })}
                      placeholder="Contoh: TP 4.1, TP 4.2"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Ringkasan Materi Pokok</label>
                    <textarea
                      rows={2}
                      value={atpForm.summary}
                      onChange={(e) => setAtpForm({ ...atpForm, summary: e.target.value })}
                      placeholder="Fokus materi yang diajarkan..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </>
              )}

              {/* Form Modul Ajar */}
              {activeTab === 'modul-ajar' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bab / Lingkup Materi</label>
                    <input
                      type="text"
                      required
                      value={modulForm.chapter}
                      onChange={(e) => setModulForm({ ...modulForm, chapter: e.target.value })}
                      placeholder="Bab 1: Sudah Besar"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Topik Modul Ajar</label>
                    <input
                      type="text"
                      required
                      value={modulForm.topic}
                      onChange={(e) => setModulForm({ ...modulForm, topic: e.target.value })}
                      placeholder="Kalimat Transitif & Berkasih Sayang"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kegiatan Inti (Pembelajaran Mendalam / Cinta)</label>
                    <textarea
                      rows={2}
                      value={modulForm.core}
                      onChange={(e) => setModulForm({ ...modulForm, core: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tautan Berkas Google Drive Resmi</label>
                    <input
                      type="url"
                      value={modulForm.driveUrl}
                      onChange={(e) => setModulForm({ ...modulForm, driveUrl: e.target.value })}
                      placeholder="https://drive.google.com/..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </>
              )}

              {/* Form LKPD */}
              {activeTab === 'lkpd' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Judul LKPD</label>
                    <input
                      type="text"
                      required
                      value={lkpdForm.title}
                      onChange={(e) => setLkpdForm({ ...lkpdForm, title: e.target.value })}
                      placeholder="LKPD 01: Berburu Kalimat Transitif"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Bab / Topik</label>
                      <input
                        type="text"
                        value={lkpdForm.chapter}
                        onChange={(e) => setLkpdForm({ ...lkpdForm, chapter: e.target.value })}
                        placeholder="Bab 1"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Tipe Aktivitas</label>
                      <select
                        value={lkpdForm.activityType}
                        onChange={(e) => setLkpdForm({ ...lkpdForm, activityType: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        <option value="Kelompok Kolaboratif">Kelompok Kolaboratif</option>
                        <option value="Individu">Individu</option>
                        <option value="Penyelidikan / Eksperimen">Penyelidikan / Eksperimen</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Petunjuk Kerja Peserta Didik</label>
                    <textarea
                      rows={3}
                      value={lkpdForm.instructions}
                      onChange={(e) => setLkpdForm({ ...lkpdForm, instructions: e.target.value })}
                      placeholder="1. Bacalah wacana dengan seksama..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs"
                >
                  Simpan Perangkat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
