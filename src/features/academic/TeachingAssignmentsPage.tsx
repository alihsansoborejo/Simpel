import React, { useState, useEffect, useMemo } from 'react';
import { academicService } from '../../services/academicService';
import { TeachingAssignment, Teacher, ClassRoom, Subject } from '../../types/database.types';
import { printDocumentDirectly } from '../../services/printService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import {
  ClipboardList,
  Search,
  CheckCircle2,
  AlertTriangle,
  School,
  BookOpen,
  UserCheck,
  UserX,
  FileSpreadsheet,
  Printer,
  Sparkles,
  ArrowRight,
  Filter,
  RefreshCw,
  Copy,
  ChevronRight,
  Info,
  Clock,
  Award,
} from 'lucide-react';

interface Props {
  initialView?: string;
  onNavigate?: (view: string) => void;
}

export const TeachingAssignmentsPage: React.FC<Props> = ({ initialView, onNavigate }) => {
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active Rombel Submenu: 'cls-1' | 'cls-2' | 'cls-3' | 'cls-4' | 'cls-5' | 'cls-6' | 'rekap-semua'
  const [activeRombelId, setActiveRombelId] = useState<string>('cls-4');

  // Filter category inside rombel view
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Notifications & Modals
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [showCopyModal, setShowCopyModal] = useState<boolean>(false);
  const [batchTeacherId, setBatchTeacherId] = useState<string>('');
  const [copySourceClassId, setCopySourceClassId] = useState<string>('');
  const [savingSubjectId, setSavingSubjectId] = useState<string | null>(null);

  // Synchronize initialView prop from sidebar navigation
  useEffect(() => {
    if (initialView) {
      if (initialView.startsWith('penugasan-cls-')) {
        const clsId = initialView.replace('penugasan-', '');
        setActiveRombelId(clsId);
      } else if (initialView === 'penugasan-rekap') {
        setActiveRombelId('rekap-semua');
      }
    }
  }, [initialView]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [asgs, tchs, clss, sbjs] = await Promise.all([
        academicService.getTeachingAssignments(),
        academicService.getTeachers(),
        academicService.getClasses(),
        academicService.getSubjects(),
      ]);
      setAssignments(asgs);
      setTeachers(tchs);
      setClasses(clss);
      setSubjects(sbjs);

      if (tchs.length > 0 && !batchTeacherId) {
        setBatchTeacherId(tchs[0].id);
      }
      if (clss.length > 0 && !copySourceClassId) {
        setCopySourceClassId(clss[0].id);
      }
    } catch (err) {
      console.error('Gagal memuat penugasan mengajar:', err);
      showToast('Gagal memuat data penugasan dari server.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtimeSync(['simpel_assignments', 'simpel_teachers', 'simpel_classes', 'simpel_subjects'], () => {
    void loadData();
  });

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Active Class details
  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === activeRombelId) || classes[0] || null;
  }, [classes, activeRombelId]);

  // Map of assignments for quick lookup: key is `${classId}_${subjectId}`
  const assignmentMap = useMemo(() => {
    const map = new Map<string, TeachingAssignment>();
    assignments.forEach((a) => {
      map.set(`${a.class_id}_${a.subject_id}`, a);
    });
    return map;
  }, [assignments]);

  // Calculate completion statistics per rombel
  const rombelStats = useMemo(() => {
    const totalSubjects = subjects.length || 14;
    const stats: Record<string, { filled: number; total: number; percentage: number; isComplete: boolean }> = {};

    classes.forEach((c) => {
      let filled = 0;
      subjects.forEach((s) => {
        if (assignmentMap.has(`${c.id}_${s.id}`)) {
          filled++;
        }
      });
      const pct = Math.round((filled / totalSubjects) * 100);
      stats[c.id] = {
        filled,
        total: totalSubjects,
        percentage: pct,
        isComplete: filled === totalSubjects,
      };
    });

    return stats;
  }, [classes, subjects, assignmentMap]);

  // Handle direct teacher selection via Dropdown
  const handleTeacherChange = async (subjectId: string, newTeacherId: string) => {
    if (!currentClass) return;
    setSavingSubjectId(subjectId);

    const subject = subjects.find((s) => s.id === subjectId);
    const teacher = teachers.find((t) => t.id === newTeacherId);

    try {
      await academicService.upsertTeachingAssignment(
        currentClass.id,
        subjectId,
        newTeacherId,
        'ay-2026',
        'sem-ganjil-2026'
      );

      // Refresh assignments locally
      const updated = await academicService.getTeachingAssignments();
      setAssignments(updated);

      if (newTeacherId && newTeacherId !== 'unassigned') {
        const teacherName = teacher
          ? `${teacher.title_prefix ? teacher.title_prefix + ' ' : ''}${teacher.full_name}${teacher.title_suffix ? ', ' + teacher.title_suffix : ''}`
          : 'Pendidik';
        showToast(
          `Pengampu ${subject?.name || 'Mapel'} di ${currentClass.name} berhasil ditugaskan ke: ${teacherName}`,
          'success'
        );
      } else {
        showToast(`Penugasan ${subject?.name || 'Mapel'} di ${currentClass.name} telah dikosongkan.`, 'info');
      }
    } catch (err) {
      console.error('Gagal memperbarui pengampu:', err);
      showToast('Terjadi kesalahan saat menyimpan penugasan.', 'error');
    } finally {
      setSavingSubjectId(null);
    }
  };

  // Quick Action: Batch assign Class Teacher (Guru Kelas) to core general subjects
  const handleBatchAssignClassTeacher = async () => {
    if (!currentClass || !batchTeacherId) return;
    const coreSubjects = subjects.filter(
      (s) => s.category === 'Umum' || s.category === 'Muatan Lokal'
    );

    try {
      setIsLoading(true);
      const batchList = coreSubjects.map((s) => ({
        subject_id: s.id,
        teacher_id: batchTeacherId,
      }));

      await academicService.batchAssignClassTeachers(
        currentClass.id,
        batchList,
        'ay-2026',
        'sem-ganjil-2026'
      );

      const updated = await academicService.getTeachingAssignments();
      setAssignments(updated);
      setShowBatchModal(false);

      const tObj = teachers.find((t) => t.id === batchTeacherId);
      showToast(
        `Berhasil menugaskan ${tObj?.full_name || 'Guru'} untuk ${coreSubjects.length} mapel umum di ${currentClass.name}!`,
        'success'
      );
    } catch (err) {
      console.error('Gagal batch assign:', err);
      showToast('Gagal menerapkan penugasan massal.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Action: Copy assignments from another rombel
  const handleCopyFromRombel = async () => {
    if (!currentClass || !copySourceClassId || currentClass.id === copySourceClassId) return;

    try {
      setIsLoading(true);
      const sourceAssignments = assignments.filter((a) => a.class_id === copySourceClassId);
      if (sourceAssignments.length === 0) {
        showToast('Rombel sumber belum memiliki penugasan yang dapat disalin.', 'error');
        setIsLoading(false);
        return;
      }

      const copyList = sourceAssignments.map((a) => ({
        subject_id: a.subject_id,
        teacher_id: a.teacher_id,
      }));

      await academicService.batchAssignClassTeachers(
        currentClass.id,
        copyList,
        'ay-2026',
        'sem-ganjil-2026'
      );

      const updated = await academicService.getTeachingAssignments();
      setAssignments(updated);
      setShowCopyModal(false);

      const srcClass = classes.find((c) => c.id === copySourceClassId);
      showToast(
        `Berhasil menyalin ${copyList.length} penugasan dari ${srcClass?.name || 'Rombel'} ke ${currentClass.name}!`,
        'success'
      );
    } catch (err) {
      console.error('Gagal menyalin penugasan:', err);
      showToast('Gagal menyalin penugasan.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter subjects for the selected rombel
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const matchCategory = selectedCategory === 'all' || s.category === selectedCategory;
      const matchSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [subjects, selectedCategory, searchQuery]);

  // Export Rombel or Full Assignments to CSV
  const handleExportCSV = () => {
    if (activeRombelId === 'rekap-semua') {
      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += 'No,Rombel Kelas,Kode Mapel,Nama Mata Pelajaran,Kategori,Guru Pengampu,NIP,Tahun Pelajaran,Semester\n';

      let rowNo = 1;
      classes.forEach((cls) => {
        subjects.forEach((sbj) => {
          const asg = assignmentMap.get(`${cls.id}_${sbj.id}`);
          const teacherName = asg?.teacher
            ? `"${(asg.teacher.title_prefix ? asg.teacher.title_prefix + ' ' : '') + asg.teacher.full_name + (asg.teacher.title_suffix ? ', ' + asg.teacher.title_suffix : '')}"`
            : '"Belum Ditugaskan"';
          const nip = asg?.teacher?.nip || '-';
          csvContent += `${rowNo++},"${cls.name}","${sbj.code}","${sbj.name}","${sbj.category}",${teacherName},"${nip}","2026/2027","Ganjil"\n`;
        });
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `SK_KBM_Seluruh_Rombel_MI_Al_Ihsan_2026.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Rekap distribusi penugasan seluruh rombel berhasil diunduh (CSV).', 'success');
    } else if (currentClass) {
      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += `SK PEMBAGIAN BEBAN MENGAJAR - ${currentClass.name.toUpperCase()} MI MAARIF AL IHSAN SOBOREJO\n`;
      csvContent += 'No,Kode Mapel,Nama Mata Pelajaran,Kategori,Beban JP,Guru Pengampu,NIP/NUPTK,Status\n';

      filteredSubjects.forEach((sbj, idx) => {
        const asg = assignmentMap.get(`${currentClass.id}_${sbj.id}`);
        const teacherName = asg?.teacher
          ? `"${(asg.teacher.title_prefix ? asg.teacher.title_prefix + ' ' : '') + asg.teacher.full_name + (asg.teacher.title_suffix ? ', ' + asg.teacher.title_suffix : '')}"`
          : '"Belum Ditugaskan"';
        const nip = asg?.teacher?.nip || asg?.teacher?.nuptk || '-';
        const status = asg ? 'Sudah Ditugaskan' : 'Kosong';
        const jp = sbj.category === 'PAI' ? '2 JP' : sbj.category === 'Umum' ? '4 JP' : '2 JP';

        csvContent += `${idx + 1},"${sbj.code}","${sbj.name}","${sbj.category}","${jp}",${teacherName},"${nip}","${status}"\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Penugasan_Mengajar_${currentClass.name.replace(/\s+/g, '_')}_2026.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Penugasan mengajar ${currentClass.name} berhasil diekspor.`, 'success');
    }
  };

  const handlePrint = () => {
    let title = 'SURAT KEPUTUSAN & PEMBAGIAN TUGAS MENGAJAR';
    let subtitle = 'Tahun Pelajaran 2025/2026 - MI Ma\'arif Al Ihsan Soborejo';
    let contentHtml = '';

    if (activeRombelId === 'rekap-semua') {
      title = 'MATRIKS PEMBAGIAN TUGAS MENGAJAR (SELURUH ROMBEL)';
      contentHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 30px;">No</th>
              <th style="width: 150px;">Mata Pelajaran</th>
              <th style="width: 70px;">Kelompok</th>
              <th style="width: 40px;">Kls 1</th>
              <th style="width: 40px;">Kls 2</th>
              <th style="width: 40px;">Kls 3</th>
              <th style="width: 40px;">Kls 4</th>
              <th style="width: 40px;">Kls 5</th>
              <th style="width: 40px;">Kls 6</th>
            </tr>
          </thead>
          <tbody>
            ${subjects.map((sbj, idx) => {
              const getTeacherInitial = (cid: string) => {
                const asg = assignments.find(a => a.class_id === cid && a.subject_id === sbj.id);
                if (!asg || !asg.teacher) return '<span style="color:#cbd5e1;">-</span>';
                return `<small><strong>${asg.teacher.full_name}</strong></small>`;
              };
              return `
                <tr>
                  <td class="center">${idx + 1}</td>
                  <td><strong>${sbj.name}</strong></td>
                  <td class="center">${sbj.category}</td>
                  <td>${getTeacherInitial('cls-1')}</td>
                  <td>${getTeacherInitial('cls-2')}</td>
                  <td>${getTeacherInitial('cls-3')}</td>
                  <td>${getTeacherInitial('cls-4')}</td>
                  <td>${getTeacherInitial('cls-5')}</td>
                  <td>${getTeacherInitial('cls-6')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } else {
      const cls = currentClass;
      title = `PENUGASAN GURU MENGAJAR - ${cls.name.toUpperCase()}`;
      subtitle = `Fase ${cls.phase} - Tahun Pelajaran 2025/2026 (Semester Ganjil)`;

      contentHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 35px;">No</th>
              <th style="width: 80px;">Kode</th>
              <th>Mata Pelajaran</th>
              <th style="width: 100px;">Kelompok</th>
              <th>Nama Guru Pengampu</th>
              <th style="width: 110px;">NIP / NUPTK</th>
              <th style="width: 70px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${subjects.map((sbj, idx) => {
              const asg = assignments.find(a => a.class_id === cls.id && a.subject_id === sbj.id);
              const t = asg?.teacher;
              return `
                <tr>
                  <td class="center">${idx + 1}</td>
                  <td class="center font-mono font-bold">${sbj.code}</td>
                  <td><strong>${sbj.name}</strong></td>
                  <td class="center">${sbj.category}</td>
                  <td>${t ? `<strong>${t.title_prefix || ''} ${t.full_name} ${t.title_suffix || ''}</strong>` : '<span style="color:#e11d48;font-style:italic;">Belum Ditugaskan</span>'}</td>
                  <td class="center font-mono">${t?.nip || t?.nuptk || '-'}</td>
                  <td class="center">${t ? '<span style="color:#047857;font-weight:bold;">Aktif</span>' : '<span style="color:#e11d48;">Kosong</span>'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    printDocumentDirectly(contentHtml, {
      title,
      subtitle,
      metadata: [
        { label: 'Tahun Pelajaran', value: '2025/2026 (Semester Ganjil)' },
        { label: 'Fokus Rombel', value: activeRombelId === 'rekap-semua' ? 'Matriks Seluruh Rombel' : currentClass.name },
        { label: 'Total Mapel', value: `${subjects.length} Mata Pelajaran` },
        { label: 'Tanggal Dokumen', value: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) },
      ],
      signature: {
        leftTitle: 'Waka Kurikulum / Akademik,',
        leftName: 'Ust. Ahmad Fauzi, S.Pd.I',
        leftNip: '198503122019031008',
        rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        rightTitle: 'Kepala Madrasah,',
        rightName: 'MUIN, S.Pd.I',
        rightNip: '197508152005011004',
      },
    });
  };

  // Helper for Category badge colors
  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'PAI':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Umum':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case "Khas Ma'arif":
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Muatan Lokal':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold animate-in fade-in slide-in-from-top-4 transition-all duration-300 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700 shadow-emerald-950/20'
              : toastMessage.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700 shadow-rose-950/20'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-emerald-800/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider">
              Portal Admin • Berbasis Rombel
            </span>
            <span className="text-emerald-300 text-xs font-medium">T.P 2026/2027 Semester Ganjil</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mt-1.5 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-400" />
            <span>Pengaturan Penugasan Guru Mengajar (SK KBM)</span>
          </h1>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-2xl leading-relaxed">
            Pilih rombel (kelas) pada sub-menu di bawah. Di dalam setiap rombel, tampil seluruh mata pelajaran kurikulum madrasah. Tentukan guru pengampu untuk setiap mapel dengan mudah langsung melalui dropdown.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-800/80 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg border border-emerald-600 transition-colors"
            title="Ekspor CSV Data Penugasan"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg border border-white/20 transition-colors"
            title="Cetak Dokumen SK KBM"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>Cetak SK KBM</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          SUB-MENU ROMBEL (KELAS) SESUAI INSTRUKSI USER:
          "jadi di ada sub menu rombel (kelas) di bagian penugasan mengajar, 
           di dalam rombel tersebut tampil seluruh mapel"
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-xs">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <div className="flex items-center gap-2">
            <School className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Sub-Menu Rombel (Pilih Kelas Pengaturan):
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Klik rombel untuk membuka daftar lengkap mata pelajaran & dropdown guru
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {classes.map((cls) => {
            const isSelected = activeRombelId === cls.id;
            const stat = rombelStats[cls.id] || { filled: 0, total: 14, percentage: 0, isComplete: false };

            return (
              <button
                key={cls.id}
                onClick={() => {
                  setActiveRombelId(cls.id);
                  if (onNavigate) onNavigate(`penugasan-${cls.id}`);
                }}
                className={`flex flex-col p-2.5 rounded-xl text-left border transition-all duration-200 ${
                  isSelected
                    ? 'bg-emerald-800 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-600/30 ring-offset-1'
                    : 'bg-slate-50/80 hover:bg-emerald-50/60 text-slate-800 border-slate-200/90 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                    {cls.name}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      isSelected
                        ? 'bg-emerald-950 text-emerald-200'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    Fase {cls.phase}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] mt-1">
                  <span className={isSelected ? 'text-emerald-100' : 'text-slate-500'}>
                    Pengampu:
                  </span>
                  <span
                    className={`font-mono font-bold text-[10px] px-1.5 py-0.5 rounded-full ${
                      stat.isComplete
                        ? isSelected
                          ? 'bg-emerald-500 text-white'
                          : 'bg-emerald-100 text-emerald-800'
                        : isSelected
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {stat.filled}/{stat.total} Mapel
                  </span>
                </div>

                {/* Progress Mini Bar */}
                <div className="w-full bg-slate-200/70 h-1 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      stat.isComplete
                        ? 'bg-emerald-400'
                        : isSelected
                        ? 'bg-amber-300'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${stat.percentage}%` }}
                  />
                </div>
              </button>
            );
          })}

          {/* Tab Matriks Rekap Keseluruhan */}
          <button
            onClick={() => {
              setActiveRombelId('rekap-semua');
              if (onNavigate) onNavigate('penugasan-rekap');
            }}
            className={`flex flex-col p-2.5 rounded-xl text-left border transition-all duration-200 col-span-2 sm:col-span-1 ${
              activeRombelId === 'rekap-semua'
                ? 'bg-slate-900 text-white border-slate-800 shadow-sm ring-2 ring-slate-700/40'
                : 'bg-slate-50/80 hover:bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className={`text-xs font-bold ${activeRombelId === 'rekap-semua' ? 'text-amber-300' : 'text-slate-900'}`}>
                Matriks Rekap
              </span>
              <Award className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className={`text-[10px] mt-0.5 ${activeRombelId === 'rekap-semua' ? 'text-slate-300' : 'text-slate-500'}`}>
              Semua Rombel
            </p>
            <span
              className={`text-[10px] font-semibold mt-1 self-start px-1.5 py-0.5 rounded ${
                activeRombelId === 'rekap-semua' ? 'bg-slate-800 text-amber-300' : 'bg-slate-200 text-slate-700'
              }`}
            >
              Cross-Tabulasi
            </span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          KONTEN TAMPILAN SESUAI SUB-MENU YANG AKTIF:
          Jika Memilih Rombel (Kelas 1 s.d. 6): Tampil seluruh mapel + dropdown guru
          Jika Memilih Matriks Rekap: Tampil grid matriks
          ========================================================================= */}
      {activeRombelId !== 'rekap-semua' && currentClass ? (
        <div className="space-y-4">
          {/* Rombel Header & Utility Strip */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-black text-xl shrink-0 border border-emerald-200">
                  {currentClass.level}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      Rombel {currentClass.name}
                    </h2>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Fase {currentClass.phase}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-600 font-medium">
                      Kapasitas: {currentClass.capacity} Siswa
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tabel di bawah menampilkan <strong>seluruh mata pelajaran</strong> untuk {currentClass.name}. Pilih guru pengampu pada dropdown kolom <em>Guru Pengampu</em>. Perubahan tersimpan secara otomatis.
                  </p>
                </div>
              </div>

              {/* Rombel Metrics & Quick Batch Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-xs"
                  title="Tugaskan seorang guru kelas untuk seluruh mata pelajaran umum rombel ini"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tugaskan Cepat Guru Kelas</span>
                </button>

                <button
                  onClick={() => setShowCopyModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
                  title="Salin penugasan dari rombel lain"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin dari Rombel Lain</span>
                </button>
              </div>
            </div>

            {/* Quick Status Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Total Mata Pelajaran
                </span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block">
                  {subjects.length} Mapel
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider block">
                  Sudah Ada Pengampu
                </span>
                <span className="text-base font-bold text-emerald-900 mt-0.5 block">
                  {rombelStats[currentClass.id]?.filled || 0} Mapel ({rombelStats[currentClass.id]?.percentage || 0}%)
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider block">
                  Belum Ditugaskan
                </span>
                <span className="text-base font-bold text-amber-900 mt-0.5 block">
                  {subjects.length - (rombelStats[currentClass.id]?.filled || 0)} Mapel
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider block">
                  Beban KBM Rombel
                </span>
                <span className="text-base font-bold text-blue-900 mt-0.5 block">
                  ~42 JP / Minggu
                </span>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            {/* Filter Tabs by Category */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1 shrink-0">
                <Filter className="w-3.5 h-3.5" />
                <span>Kategori:</span>
              </span>
              {[
                { id: 'all', label: 'Semua Mapel' },
                { id: 'PAI', label: 'PAI / Keagamaan' },
                { id: 'Umum', label: 'Mapel Umum' },
                { id: "Khas Ma'arif", label: "Khas Ma'arif" },
                { id: 'Muatan Lokal', label: 'Muatan Lokal' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg shrink-0 transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-800 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama mapel / kode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-emerald-600 focus:bg-white"
              />
            </div>
          </div>

          {/* =========================================================================
              TABEL SELURUH MATA PELAJARAN DENGAN DROPDOWN GURU:
              "di dalam rombel tersebut tampil seluruh mapel, 
               nantinya admin hanya memilih guru pada mapel melalui drop down"
              ========================================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-700 text-xs font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4 w-28">Kode</th>
                    <th className="py-3 px-4">Nama Mata Pelajaran</th>
                    <th className="py-3 px-4 w-36">Kategori</th>
                    <th className="py-3 px-4 w-24 text-center">Alokasi</th>
                    <th className="py-3 px-4 min-w-[300px]">
                      Pilih Guru Pengampu (Dropdown)
                    </th>
                    <th className="py-3 px-4 w-44">Status Penugasan</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                        <span>Memuat daftar mata pelajaran rombel...</span>
                      </td>
                    </tr>
                  ) : filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Tidak ada mata pelajaran yang sesuai filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredSubjects.map((subject, idx) => {
                      const asg = assignmentMap.get(`${currentClass.id}_${subject.id}`);
                      const isAssigned = !!asg && !!asg.teacher_id;
                      const isSaving = savingSubjectId === subject.id;

                      return (
                        <tr
                          key={subject.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            !isAssigned ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          {/* 1. No */}
                          <td className="py-3.5 px-4 text-center font-mono font-medium text-slate-500">
                            {idx + 1}
                          </td>

                          {/* 2. Kode */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                              {subject.code}
                            </span>
                          </td>

                          {/* 3. Nama Mata Pelajaran */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              <span>{subject.name}</span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Kurikulum Merdeka • Kelas {currentClass.level} (Fase {currentClass.phase})
                            </span>
                          </td>

                          {/* 4. Kategori */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getCategoryBadgeClass(
                                subject.category
                              )}`}
                            >
                              {subject.category}
                            </span>
                          </td>

                          {/* 5. Alokasi JP */}
                          <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-600">
                            {subject.category === 'PAI'
                              ? '2 JP'
                              : subject.category === 'Umum'
                              ? subject.code === 'IND' || subject.code === 'MTK'
                                ? '5 JP'
                                : '4 JP'
                              : '2 JP'}
                          </td>

                          {/* 6. DROPDOWN PILIH GURU PENGAMPU */}
                          <td className="py-3.5 px-4">
                            <div className="relative">
                              <select
                                value={asg?.teacher_id || 'unassigned'}
                                onChange={(e) => handleTeacherChange(subject.id, e.target.value)}
                                disabled={isSaving}
                                className={`w-full text-xs font-medium px-3 py-2 rounded-xl border transition-all appearance-none pr-8 cursor-pointer focus:outline-none focus:ring-2 ${
                                  isAssigned
                                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-semibold focus:ring-emerald-500/30'
                                    : 'bg-white border-amber-300 text-amber-900 focus:ring-amber-500/30'
                                }`}
                              >
                                <option value="unassigned">
                                  -- Belum Ditugaskan (Pilih Guru) --
                                </option>
                                <optgroup label="Daftar Pendidik MI Ma’arif Al Ihsan">
                                  {teachers.map((t) => {
                                    const teacherLabel = `${t.title_prefix ? t.title_prefix + ' ' : ''}${t.full_name}${t.title_suffix ? ', ' + t.title_suffix : ''}`;
                                    return (
                                      <option key={t.id} value={t.id}>
                                        {teacherLabel} — ({t.specialization || 'Pendidik'})
                                      </option>
                                    );
                                  })}
                                </optgroup>
                              </select>

                              {/* Dropdown Chevron / Loading Spinner */}
                              <div className="absolute right-2.5 top-2.5 pointer-events-none text-slate-400">
                                {isSaving ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 rotate-90 text-slate-500" />
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 7. Status Penugasan & Aksi Cepat */}
                          <td className="py-3.5 px-4">
                            {isAssigned ? (
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 text-emerald-800">
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <div className="truncate">
                                    <span className="font-bold text-[11px] truncate block">
                                      {asg?.teacher?.full_name || 'Ditugaskan'}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {asg?.teacher?.nip ? `NIP ${asg.teacher.nip}` : 'Pendidik Tetap'}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleTeacherChange(subject.id, 'unassigned')}
                                  title="Kosongkan penugasan"
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200/80">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span className="font-semibold text-[11px]">Belum Ada Guru</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Info */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Penugasan ini terhubung langsung ke modul <strong>Presensi Harian</strong>, <strong>Jurnal Mengajar</strong>, <strong>Perangkat Pembelajaran (CP/TP/ATP)</strong>, dan <strong>Perangkat Evaluasi (LM 1-4, STS, SAS)</strong> guru bersangkutan.
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-400 shrink-0">
                Data Rombel: {currentClass.name}
              </span>
            </div>
          </div>
        </div>
      ) : activeRombelId === 'rekap-semua' ? (
        /* =========================================================================
           TABEL MATRIKS REKAP PENUGASAN SELURUH ROMBEL (KELAS 1 - 6)
           ========================================================================= */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-800" />
                  <span>Matriks Distribusi Mengajar Seluruh Rombel (Kelas 1 - 6)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Peta persebaran tenaga pendidik lintas rombel. Klik nama rombel pada header untuk berpindah ke pengaturan detail.
                </p>
              </div>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg self-start sm:self-auto transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
                <span>Unduh Matriks Lengkap (CSV)</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold">
                    <th className="py-3 px-3 w-10 text-center">No</th>
                    <th className="py-3 px-3 min-w-[200px]">Mata Pelajaran</th>
                    {classes.map((cls) => (
                      <th
                        key={cls.id}
                        className="py-3 px-3 text-center min-w-[130px] border-l border-slate-200 cursor-pointer hover:bg-emerald-50 transition-colors"
                        onClick={() => setActiveRombelId(cls.id)}
                        title={`Buka pengaturan ${cls.name}`}
                      >
                        <div className="text-emerald-900 font-extrabold">{cls.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">Fase {cls.phase}</div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {subjects.map((sbj, idx) => (
                    <tr key={sbj.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{sbj.name}</div>
                        <span className="text-[10px] font-mono text-slate-400">[{sbj.code}] • {sbj.category}</span>
                      </td>

                      {classes.map((cls) => {
                        const asg = assignmentMap.get(`${cls.id}_${sbj.id}`);
                        const teacher = asg?.teacher;
                        return (
                          <td
                            key={cls.id}
                            className="py-2 px-2 text-center border-l border-slate-100"
                          >
                            {teacher ? (
                              <button
                                onClick={() => setActiveRombelId(cls.id)}
                                className="w-full p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 transition-colors text-left"
                                title={`Ganti pengampu ${sbj.name} di ${cls.name}`}
                              >
                                <span className="font-bold text-[11px] block truncate">
                                  {teacher.full_name}
                                </span>
                                <span className="text-[9px] text-emerald-700 block truncate">
                                  {teacher.title_prefix || ''} {teacher.title_suffix || ''}
                                </span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setActiveRombelId(cls.id)}
                                className="w-full p-1.5 rounded-lg bg-slate-50 hover:bg-amber-100 text-slate-400 hover:text-amber-900 border border-dashed border-slate-200 hover:border-amber-400 transition-colors text-center text-[10px] font-semibold"
                                title={`Tugaskan guru untuk ${sbj.name} di ${cls.name}`}
                              >
                                + Pilih Guru
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* =========================================================================
          MODAL: TUGASKAN CEPAT GURU KELAS (BATCH ASSIGN)
          ========================================================================= */}
      {showBatchModal && currentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Tugaskan Cepat Guru Kelas
                </h3>
                <p className="text-xs text-slate-500">
                  Untuk {currentClass.name} (Fase {currentClass.phase})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 my-4 leading-relaxed bg-amber-50/70 p-3 rounded-xl border border-amber-200/80">
              Fitur ini akan secara otomatis menugaskan guru yang dipilih ke seluruh mata pelajaran umum dan muatan lokal rombel ini (seperti Bahasa Indonesia, Matematika, Pendidikan Pancasila, IPAS, Seni Budaya, dll.), tanpa mengubah guru mata pelajaran khusus (PAI/PJOK) jika sudah ditetapkan.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Guru Kelas yang Ditugaskan:
                </label>
                <select
                  value={batchTeacherId}
                  onChange={(e) => setBatchTeacherId(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-emerald-600 bg-white"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title_prefix ? t.title_prefix + ' ' : ''}
                      {t.full_name}
                      {t.title_suffix ? ', ' + t.title_suffix : ''} — ({t.specialization || 'Pendidik'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleBatchAssignClassTeacher}
                  className="px-4 py-2 text-xs font-bold bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Terapkan Penugasan Guru Kelas</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: SALIN PENUGASAN DARI ROMBEL LAIN
          ========================================================================= */}
      {showCopyModal && currentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center">
                <Copy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Salin Distribusi dari Rombel Lain
                </h3>
                <p className="text-xs text-slate-500">
                  Sasaran Tujuan: {currentClass.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 my-4 leading-relaxed bg-blue-50/70 p-3 rounded-xl border border-blue-200/80">
              Salin konfigurasi pengampu mata pelajaran dari rombel kelas lain untuk mempercepat pengaturan beban mengajar.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Rombel Sumber:
                </label>
                <select
                  value={copySourceClassId}
                  onChange={(e) => setCopySourceClassId(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-emerald-600 bg-white"
                >
                  {classes
                    .filter((c) => c.id !== currentClass.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Fase {c.phase}) — {rombelStats[c.id]?.filled || 0} Mapel Terisi
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleCopyFromRombel}
                  className="px-4 py-2 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Copy className="w-4 h-4" />
                  <span>Salin ke {currentClass.name}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
