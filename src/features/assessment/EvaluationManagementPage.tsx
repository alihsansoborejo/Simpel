import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { curriculumWorkspaceService } from '../../services/curriculumWorkspaceService';
import {
  KisiKisiItem,
  SoalAsesmenItem,
  EvaluationScopeKey,
  LingkupMateriConfig,
} from '../../types/curriculum.types';
import { GradesPage } from './GradesPage';
import { RemedialEnrichmentPage } from './RemedialEnrichmentPage';
import { LearningAnalysisPage } from './LearningAnalysisPage';
import {
  Award,
  Plus,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Search,
  Trash2,
  CheckCircle2,
  X,
  FileText,
  TrendingUp,
  HelpCircle,
  FolderSync,
  Layers,
  ChevronRight,
  BookOpen,
  Info,
  Calendar,
  Check,
} from 'lucide-react';

export type EvaluationTab =
  | 'kisi-kisi'
  | 'soal-asesmen'
  | 'asesmen-nilai'
  | 'remedial-pengayaan'
  | 'analisis-nilai';

interface EvaluationManagementPageProps {
  defaultTab?: EvaluationTab;
  initialScope?: EvaluationScopeKey;
  onNavigate?: (view: string) => void;
}

export const EvaluationManagementPage: React.FC<EvaluationManagementPageProps> = ({
  defaultTab = 'kisi-kisi',
  initialScope = 'LM1',
  onNavigate,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<EvaluationTab>(defaultTab);

  // Filter Mata Pelajaran & Kelas
  const [selectedSubject, setSelectedSubject] = useState<string>('sbj-ind');
  const [selectedClass, setSelectedClass] = useState<number>(4);

  // Filter Lingkup Materi (LM) & Asesmen Khusus (STS / SAS)
  const [selectedScope, setSelectedScope] = useState<EvaluationScopeKey>(initialScope);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Data States
  const [kisiList, setKisiList] = useState<KisiKisiItem[]>([]);
  const [soalList, setSoalList] = useState<SoalAsesmenItem[]>([]);

  // Modal States
  const [showModal, setShowModal] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Form States
  const [kisiForm, setKisiForm] = useState({
    type: 'Formatif Lingkup Materi' as 'Formatif Lingkup Materi' | 'Sumatif Lingkup Materi' | 'Sumatif Tengah Semester (STS)' | 'Sumatif Akhir Semester (SAS)',
    tpCode: 'TP 4.1',
    topic: '',
    indicator: '',
    cogLevel: 'L2 (Aplikasi)' as 'L1 (Pengetahuan/Pemahaman)' | 'L2 (Aplikasi)' | 'L3 (Penalaran/HOTS)',
    qType: 'Pilihan Ganda' as 'Pilihan Ganda' | 'Isian Singkat' | 'Uraian' | 'Unjuk Kerja / Praktik',
    qNum: '1, 2',
    weight: 20,
  });

  const [soalForm, setSoalForm] = useState({
    tpCode: 'TP 4.1',
    qNum: 1,
    qType: 'Pilihan Ganda' as 'Pilihan Ganda' | 'Isian Singkat' | 'Uraian' | 'Praktik',
    stimulus: '',
    questionText: '',
    optA: '',
    optB: '',
    optC: '',
    optD: '',
    correctAnswer: 'A',
    rubric: 'Jawaban benar bernilai 10 poin.',
    points: 10,
  });

  // Sinkronisasi saat props berubah
  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  useEffect(() => {
    if (initialScope) {
      setSelectedScope(initialScope);
    }
  }, [initialScope]);

  const loadData = () => {
    setKisiList(curriculumWorkspaceService.getKisiList());
    setSoalList(curriculumWorkspaceService.getSoalList());
  };

  useEffect(() => {
    loadData();
  }, []);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Daftar Lingkup Materi yang tersedia untuk mapel dan kelas aktif
  const availableScopes = curriculumWorkspaceService.getLingkupMateriList(selectedSubject, selectedClass);
  const currentScopeConfig =
    availableScopes.find((s) => s.scope_key === selectedScope) || availableScopes[0];

  // Filter butir kisi-kisi per Mapel, Kelas, dan Lingkup Materi / STS / SAS
  const filteredKisi = kisiList.filter(
    (k) =>
      k.subject_id === selectedSubject &&
      k.class_level === selectedClass &&
      k.scope_key === selectedScope &&
      (k.material_topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.indicator.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.tp_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Filter butir soal per Mapel, Kelas, dan Lingkup Materi / STS / SAS
  const filteredSoal = soalList.filter(
    (s) =>
      s.subject_id === selectedSubject &&
      s.class_level === selectedClass &&
      s.scope_key === selectedScope &&
      (s.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.stimulus.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.tp_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Ekspor CSV
  const handleExportCSV = () => {
    const scopeLabel = currentScopeConfig ? currentScopeConfig.code : selectedScope;
    if (activeTab === 'kisi-kisi') {
      const headers = ['No', 'Lingkup Materi / Asesmen', 'Jenis Asesmen', 'Kode TP', 'Topik Materi', 'Indikator Soal', 'Level Kognitif', 'Bentuk Soal', 'Nomor Soal', 'Bobot (%)'];
      const rows = filteredKisi.map((k, i) => [
        i + 1,
        `"${scopeLabel}"`,
        `"${k.assessment_type}"`,
        k.tp_code,
        `"${k.material_topic}"`,
        `"${k.indicator}"`,
        `"${k.cognitive_level}"`,
        `"${k.question_type}"`,
        `"${k.question_numbers}"`,
        k.scoring_weight,
      ]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kisi_kisi_${selectedSubject}_${selectedScope}_kelas${selectedClass}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      notify(`Berkas Kisi-kisi ${scopeLabel} berhasil diunduh.`);
    } else if (activeTab === 'soal-asesmen') {
      const headers = ['No', 'Lingkup Materi / Asesmen', 'Kode TP', 'Bentuk Soal', 'Stimulus Kontekstual', 'Pertanyaan Soal', 'Kunci Jawaban', 'Rubrik Penskoran', 'Poin'];
      const rows = filteredSoal.map((s) => [
        s.question_number,
        `"${scopeLabel}"`,
        s.tp_code,
        s.question_type,
        `"${s.stimulus}"`,
        `"${s.question_text}"`,
        `"${s.correct_answer}"`,
        `"${s.scoring_rubric}"`,
        s.score_points,
      ]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `naskah_soal_${selectedSubject}_${selectedScope}_kelas${selectedClass}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      notify(`Berkas Naskah Soal ${scopeLabel} berhasil diunduh.`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const currentSubjectName = selectedSubject === 'sbj-ind' ? 'Bahasa Indonesia' : 'IPAS';

    if (activeTab === 'kisi-kisi') {
      const item: KisiKisiItem = {
        id: `kisi-${Date.now()}`,
        subject_id: selectedSubject,
        subject_name: currentSubjectName,
        class_level: selectedClass,
        scope_key: selectedScope,
        assessment_type: kisiForm.type,
        tp_code: kisiForm.tpCode,
        material_topic: kisiForm.topic,
        indicator: kisiForm.indicator,
        cognitive_level: kisiForm.cogLevel,
        question_type: kisiForm.qType,
        question_numbers: kisiForm.qNum,
        scoring_weight: Number(kisiForm.weight),
        created_at: new Date().toISOString(),
      };
      curriculumWorkspaceService.saveKisi(item);
      notify(`Kisi-kisi untuk ${currentScopeConfig?.code || selectedScope} berhasil disimpan.`);
    } else if (activeTab === 'soal-asesmen') {
      const options =
        soalForm.qType === 'Pilihan Ganda'
          ? [soalForm.optA, soalForm.optB, soalForm.optC, soalForm.optD].filter(Boolean)
          : undefined;

      const item: SoalAsesmenItem = {
        id: `soal-${Date.now()}`,
        subject_id: selectedSubject,
        subject_name: currentSubjectName,
        class_level: selectedClass,
        scope_key: selectedScope,
        tp_code: soalForm.tpCode,
        question_number: Number(soalForm.qNum),
        question_type: soalForm.qType,
        stimulus: soalForm.stimulus,
        question_text: soalForm.questionText,
        options,
        correct_answer: soalForm.correctAnswer,
        scoring_rubric: soalForm.rubric,
        score_points: Number(soalForm.points),
        created_at: new Date().toISOString(),
      };
      curriculumWorkspaceService.saveSoal(item);
      notify(`Soal untuk ${currentScopeConfig?.code || selectedScope} berhasil ditambahkan.`);
    }

    setShowModal(false);
    loadData();
  };

  const handleOpenAdd = () => {
    const firstTP = currentScopeConfig?.associated_tps[0] || 'TP 4.1';
    const defaultAssessmentType =
      selectedScope === 'STS'
        ? 'Sumatif Tengah Semester (STS)'
        : selectedScope === 'SAS'
        ? 'Sumatif Akhir Semester (SAS)'
        : 'Formatif Lingkup Materi';

    if (activeTab === 'kisi-kisi') {
      setKisiForm({
        type: defaultAssessmentType,
        tpCode: firstTP,
        topic: currentScopeConfig?.title || '',
        indicator: '',
        cogLevel: 'L2 (Aplikasi)',
        qType: 'Pilihan Ganda',
        qNum: `${filteredKisi.length + 1}`,
        weight: 20,
      });
    } else {
      setSoalForm({
        tpCode: firstTP,
        qNum: filteredSoal.length + 1,
        qType: 'Pilihan Ganda',
        stimulus: 'Cerita budi pekerti dan empati di lingkungan madrasah...',
        questionText: '',
        optA: 'A. ',
        optB: 'B. ',
        optC: 'C. ',
        optD: 'D. ',
        correctAnswer: 'A',
        rubric: 'Jawaban tepat dinilai 10 poin.',
        points: 10,
      });
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

      {/* =========================================================================
          HEADER PERANGKAT EVALUASI
          ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 uppercase tracking-wider">
              Asesmen & Evaluasi Pembelajaran
            </span>
            <span className="text-xs text-slate-400">· MI Ma’arif Al Ihsan Soborejo</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1 tracking-tight">
            Perangkat Evaluasi per Lingkup Materi & STS/SAS
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola instrumen evaluasi per Lingkup Materi (LM 1 s.d. LM 4) serta modul khusus Sumatif Tengah Semester (STS) dan Sumatif Akhir Semester (SAS).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {(activeTab === 'kisi-kisi' || activeTab === 'soal-asesmen') && (
            <>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Ekspor CSV</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Cetak Naskah</span>
              </button>

              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4 text-amber-300" />
                <span>Tambah Butir di {currentScopeConfig?.code || selectedScope}</span>
              </button>
            </>
          )}

          {onNavigate && (
            <button
              onClick={() => onNavigate(activeTab === 'analisis-nilai' || activeTab === 'remedial-pengayaan' ? 'asisten-ai-analisis' : 'asisten-ai-soal')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-500 transition-colors shadow-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-950" />
              <span>Bantu AI Asesmen</span>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          PENGATURAN MATA PELAJARAN & SUB-MENU PER LINGKUP MATERI (LM) / STS / SAS
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-xs">
        {/* Baris 1: Pemilihan Mapel & Kelas */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Mata Pelajaran:</span>
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedScope('LM1');
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
              >
                <option value="sbj-ind">Bahasa Indonesia</option>
                <option value="sbj-ipas">IPAS</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600">Kelas:</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
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

          <div className="text-[11px] text-slate-500">
            Semester: <strong className="text-emerald-800">Ganjil (2026/2027)</strong> · KKTP: <strong className="text-amber-800">75</strong>
          </div>
        </div>

        {/* Baris 2: SUB-MENU PER LINGKUP MATERI (LM) & KHUSUS STS / SAS */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pilih Lingkup Materi (LM) atau Asesmen Semester:</span>
            </span>
            <span className="text-[11px] text-emerald-800 font-semibold">
              Aktif: {currentScopeConfig?.title}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {availableScopes.map((scope) => {
              const isSelected = selectedScope === scope.scope_key;
              const isSpecial = scope.is_special_summative;
              return (
                <button
                  key={scope.id}
                  onClick={() => setSelectedScope(scope.scope_key)}
                  className={`p-2.5 rounded-xl border text-left transition-all relative ${
                    isSelected
                      ? isSpecial
                        ? 'bg-amber-500 text-slate-900 border-amber-600 shadow-sm font-bold ring-2 ring-amber-300'
                        : 'bg-emerald-700 text-white border-emerald-800 shadow-sm font-bold ring-2 ring-emerald-300'
                      : isSpecial
                      ? 'bg-amber-50/70 border-amber-200 text-amber-950 hover:bg-amber-100/80'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        isSelected
                          ? 'bg-slate-900/20 text-white'
                          : isSpecial
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {scope.code}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </div>
                  <p className="text-[11px] font-bold mt-1.5 truncate leading-tight">
                    {scope.code === 'STS' || scope.code === 'SAS' ? scope.label : scope.title.split('(')[0]}
                  </p>
                  <p className={`text-[9px] mt-0.5 truncate ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                    {scope.associated_tps.join(', ')}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ringkasan Informasi Lingkup Materi yang Aktif */}
        {currentScopeConfig && (
          <div
            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              currentScopeConfig.is_special_summative
                ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                : 'bg-emerald-50/70 border-emerald-100 text-emerald-950'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div
                className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  currentScopeConfig.is_special_summative ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                }`}
              >
                <Award className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-sm">{currentScopeConfig.title}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-current">
                    {currentScopeConfig.code}
                  </span>
                </div>
                <p className="text-xs opacity-90 mt-0.5">{currentScopeConfig.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <span className="text-[11px] font-semibold">TP Terkait:</span>
              <div className="flex items-center gap-1">
                {currentScopeConfig.associated_tps.map((tp) => (
                  <span
                    key={tp}
                    className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200"
                  >
                    {tp}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Baris 3: Tab Jenis Perangkat Evaluasi */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('kisi-kisi')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'kisi-kisi'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>Kisi-kisi ({currentScopeConfig?.code || selectedScope})</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'kisi-kisi' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredKisi.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('soal-asesmen')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'soal-asesmen'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4 text-sky-400" />
            <span>Naskah & Bank Soal ({currentScopeConfig?.code || selectedScope})</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'soal-asesmen' ? 'bg-emerald-900 text-amber-300' : 'bg-slate-200 text-slate-700'}`}>
              {filteredSoal.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('asesmen-nilai')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'asesmen-nilai'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Daftar Nilai Siswa</span>
          </button>

          <button
            onClick={() => setActiveTab('remedial-pengayaan')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'remedial-pengayaan'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-rose-400" />
            <span>Remedial & Pengayaan</span>
          </button>

          <button
            onClick={() => setActiveTab('analisis-nilai')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'analisis-nilai'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-amber-300" />
            <span>Analisis Ketuntasan</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: KISI-KISI ASESMEN KHUSUS SCOPE INI
          ========================================================================= */}
      {activeTab === 'kisi-kisi' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-700 text-white">
                  {currentScopeConfig?.code || selectedScope}
                </span>
                <h3 className="font-bold text-sm text-emerald-950">
                  Matriks Kisi-kisi Asesmen: {currentScopeConfig?.title}
                </h3>
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                Distribusi indikator, tingkat kognitif L1/L2/L3 (HOTS), bentuk soal, dan bobot untuk unit evaluasi ini.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredKisi.length} Butir Indikator
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">TP</th>
                  <th className="px-4 py-3">Jenis Asesmen & Topik</th>
                  <th className="px-4 py-3">Indikator Soal</th>
                  <th className="px-4 py-3">Level Kognitif</th>
                  <th className="px-4 py-3">Bentuk & No Soal</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredKisi.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Belum ada butir kisi-kisi untuk {currentScopeConfig?.code || selectedScope}. Klik "Tambah Butir" untuk merumuskan.
                    </td>
                  </tr>
                ) : (
                  filteredKisi.map((k) => (
                    <tr key={k.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-emerald-800">{k.tp_code}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{k.material_topic}</p>
                        <span className="text-[10px] text-slate-500 font-medium">{k.assessment_type}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-sm">{k.indicator}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            k.cognitive_level.includes('L3')
                              ? 'bg-rose-100 text-rose-800'
                              : k.cognitive_level.includes('L2')
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-blue-100 text-blue-900'
                          }`}
                        >
                          {k.cognitive_level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{k.question_type}</p>
                        <span className="text-[10px] text-slate-500">No. {k.question_numbers} (Bobot {k.scoring_weight}%)</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Hapus kisi-kisi untuk ${k.material_topic}?`)) {
                              curriculumWorkspaceService.deleteKisi(k.id);
                              loadData();
                              notify('Kisi-kisi dihapus.');
                            }
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
          TAB 2: NASKAH & BANK SOAL KHUSUS SCOPE INI
          ========================================================================= */}
      {activeTab === 'soal-asesmen' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-700 text-white">
                  {currentScopeConfig?.code || selectedScope}
                </span>
                <h3 className="font-bold text-sm text-emerald-950">
                  Naskah Soal Evaluasi: {currentScopeConfig?.title}
                </h3>
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                Butir soal asesmen autentik HOTS dan berbasis Kurikulum Berbasis Cinta siap cetak atau dibagikan ke siswa.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-200">
              Total: {filteredSoal.length} Butir Soal
            </span>
          </div>

          <div className="p-4 space-y-4">
            {filteredSoal.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Belum ada butir soal untuk {currentScopeConfig?.code || selectedScope}. Klik "Tambah Butir" untuk menyusun soal.
              </p>
            ) : (
              filteredSoal.map((soal) => (
                <div key={soal.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-emerald-500 transition-all space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-bold text-[10px]">
                        Soal #{soal.question_number}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold text-[10px]">
                        {soal.tp_code}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">({soal.question_type})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {soal.score_points} Poin
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`Hapus soal nomor ${soal.question_number}?`)) {
                            curriculumWorkspaceService.deleteSoal(soal.id);
                            loadData();
                            notify('Soal dihapus.');
                          }
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {soal.stimulus && (
                    <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 text-xs text-slate-700 italic">
                      <strong>Stimulus:</strong> "{soal.stimulus}"
                    </div>
                  )}

                  <p className="text-xs font-semibold text-slate-900">{soal.question_text}</p>

                  {soal.options && soal.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2 text-xs">
                      {soal.options.map((opt, i) => (
                        <div
                          key={i}
                          className={`p-2 rounded-lg border text-xs font-medium ${
                            opt.startsWith(soal.correct_answer)
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-1.5 flex flex-wrap items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
                    <p>
                      <strong className="text-emerald-900">Kunci Jawaban:</strong> {soal.correct_answer}
                    </p>
                    <p className="italic">{soal.scoring_rubric}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: DAFTAR NILAI SISWA
          ========================================================================= */}
      {activeTab === 'asesmen-nilai' && (
        <div className="space-y-4">
          <GradesPage />
        </div>
      )}

      {/* =========================================================================
          TAB 4: REMEDIAL & PENGAYAAN
          ========================================================================= */}
      {activeTab === 'remedial-pengayaan' && (
        <div className="space-y-4">
          <RemedialEnrichmentPage />
        </div>
      )}

      {/* =========================================================================
          TAB 5: ANALISIS HASIL BELAJAR
          ========================================================================= */}
      {activeTab === 'analisis-nilai' && (
        <div className="space-y-4">
          <LearningAnalysisPage />
        </div>
      )}

      {/* =========================================================================
          MODAL FORMULIR TAMBAH BUTIR KISI-KISI / SOAL
          ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Tambah {activeTab === 'kisi-kisi' ? 'Kisi-kisi Asesmen' : 'Soal Asesmen'}
                </h3>
                <p className="text-[11px] text-emerald-800 font-semibold">
                  Unit: {currentScopeConfig?.title} ({currentScopeConfig?.code})
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3 text-xs">
              {activeTab === 'kisi-kisi' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Jenis Asesmen</label>
                      <select
                        value={kisiForm.type}
                        onChange={(e) => setKisiForm({ ...kisiForm, type: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        <option value="Formatif Lingkup Materi">Formatif Lingkup Materi</option>
                        <option value="Sumatif Lingkup Materi">Sumatif Lingkup Materi</option>
                        <option value="Sumatif Tengah Semester (STS)">Sumatif Tengah Semester (STS)</option>
                        <option value="Sumatif Akhir Semester (SAS)">Sumatif Akhir Semester (SAS)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Target Kode TP</label>
                      <input
                        type="text"
                        value={kisiForm.tpCode}
                        onChange={(e) => setKisiForm({ ...kisiForm, tpCode: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Lingkup Materi / Topik</label>
                    <input
                      type="text"
                      required
                      value={kisiForm.topic}
                      onChange={(e) => setKisiForm({ ...kisiForm, topic: e.target.value })}
                      placeholder="Contoh: Kalimat Transitif dan Intransitif"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Indikator Soal</label>
                    <textarea
                      rows={2}
                      required
                      value={kisiForm.indicator}
                      onChange={(e) => setKisiForm({ ...kisiForm, indicator: e.target.value })}
                      placeholder="Disajikan kalimat, siswa dapat..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Level Kognitif</label>
                      <select
                        value={kisiForm.cogLevel}
                        onChange={(e) => setKisiForm({ ...kisiForm, cogLevel: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        <option value="L1 (Pengetahuan/Pemahaman)">L1 (Pengetahuan/Pemahaman)</option>
                        <option value="L2 (Aplikasi)">L2 (Aplikasi)</option>
                        <option value="L3 (Penalaran/HOTS)">L3 (Penalaran/HOTS)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Bentuk Soal</label>
                      <select
                        value={kisiForm.qType}
                        onChange={(e) => setKisiForm({ ...kisiForm, qType: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      >
                        <option value="Pilihan Ganda">Pilihan Ganda</option>
                        <option value="Isian Singkat">Isian Singkat</option>
                        <option value="Uraian">Uraian</option>
                        <option value="Unjuk Kerja / Praktik">Unjuk Kerja / Praktik</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Nomor Soal</label>
                      <input
                        type="number"
                        min={1}
                        value={soalForm.qNum}
                        onChange={(e) => setSoalForm({ ...soalForm, qNum: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Target TP</label>
                      <input
                        type="text"
                        value={soalForm.tpCode}
                        onChange={(e) => setSoalForm({ ...soalForm, tpCode: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Stimulus Kontekstual (Kisah Kasih Sayang / Kasus)</label>
                    <textarea
                      rows={2}
                      value={soalForm.stimulus}
                      onChange={(e) => setSoalForm({ ...soalForm, stimulus: e.target.value })}
                      placeholder="Teks pengantar atau kutipan cerita madrasah..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Pertanyaan Soal</label>
                    <textarea
                      rows={2}
                      required
                      value={soalForm.questionText}
                      onChange={(e) => setSoalForm({ ...soalForm, questionText: e.target.value })}
                      placeholder="Tuliskan pertanyaan soal..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium"
                    />
                  </div>

                  {soalForm.qType === 'Pilihan Ganda' && (
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-slate-700">Pilihan Jawaban</label>
                      <input
                        type="text"
                        value={soalForm.optA}
                        onChange={(e) => setSoalForm({ ...soalForm, optA: e.target.value })}
                        placeholder="A. Pilihan pertama"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                      />
                      <input
                        type="text"
                        value={soalForm.optB}
                        onChange={(e) => setSoalForm({ ...soalForm, optB: e.target.value })}
                        placeholder="B. Pilihan kedua"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                      />
                      <input
                        type="text"
                        value={soalForm.optC}
                        onChange={(e) => setSoalForm({ ...soalForm, optC: e.target.value })}
                        placeholder="C. Pilihan ketiga"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                      />
                      <input
                        type="text"
                        value={soalForm.optD}
                        onChange={(e) => setSoalForm({ ...soalForm, optD: e.target.value })}
                        placeholder="D. Pilihan keempat"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Kunci Jawaban</label>
                      <input
                        type="text"
                        required
                        value={soalForm.correctAnswer}
                        onChange={(e) => setSoalForm({ ...soalForm, correctAnswer: e.target.value })}
                        placeholder="Contoh: A atau Uraian lengkap"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Bobot Nilai (Poin)</label>
                      <input
                        type="number"
                        min={1}
                        value={soalForm.points}
                        onChange={(e) => setSoalForm({ ...soalForm, points: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                      />
                    </div>
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
                  Simpan ke {currentScopeConfig?.code || selectedScope}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
