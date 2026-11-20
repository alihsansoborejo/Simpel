import React, { useState, useEffect, useMemo } from 'react';
import { academicService } from '../../services/academicService';
import { printDocumentDirectly } from '../../services/printService';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useAuth } from '../../context/AuthContext';
import {
  ClassRoom,
  Teacher,
  Student,
  ClassMember,
  ClassOfficial,
  TeachingAssignment,
  Subject,
} from '../../types/database.types';
import {
  School,
  Users,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Award,
  BookOpen,
  ArrowLeft,
  UserPlus,
  UserMinus,
  Printer,
  ArrowUpDown,
  ShieldCheck,
  ChevronRight,
  Search,
} from 'lucide-react';

interface ClassesPageProps {
  onNavigate?: (view: string) => void;
  homeroomOnly?: boolean;
}

const PRESET_OFFICIAL_ROLES = [
  'Ketua Kelas',
  'Wakil Ketua Kelas',
  'Sekretaris',
  'Bendahara',
  'Seksi Kerohanian & Ibadah',
  'Seksi Kebersihan & Keindahan',
  'Seksi Keamanan & Ketertiban',
  'Seksi Olahraga & Pramuka',
];

export const ClassesPage: React.FC<ClassesPageProps> = ({ onNavigate, homeroomOnly = false }) => {
  const { user, activeRole } = useAuth();
  const isHomeroomScope = homeroomOnly || activeRole === 'wali_kelas';

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  const [classOfficials, setClassOfficials] = useState<ClassOfficial[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [homeroomClass, setHomeroomClass] = useState<ClassRoom | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Selected class detail state & active tab
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'perangkat' | 'anggota' | 'pengajar'>(
    homeroomOnly ? 'perangkat' : 'anggota'
  );

  // Modal Add/Edit Class
  const [showClassModal, setShowClassModal] = useState<boolean>(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [name, setName] = useState<string>('Kelas 1');
  const [level, setLevel] = useState<number>(1);
  const [phase, setPhase] = useState<'A' | 'B' | 'C'>('A');
  const [capacity, setCapacity] = useState<number>(28);
  const [homeroomTeacherId, setHomeroomTeacherId] = useState<string>('');
  const [confirmDeleteClass, setConfirmDeleteClass] = useState<{ id: string; name: string } | null>(null);

  // Modal Enroll Students to Rombel
  const [showEnrollModal, setShowEnrollModal] = useState<boolean>(false);
  const [enrollSearch, setEnrollSearch] = useState<string>('');
  const [enrollShowAssignedElsewhere, setEnrollShowAssignedElsewhere] = useState<boolean>(false);
  const [selectedStudentIdsToEnroll, setSelectedStudentIdsToEnroll] = useState<string[]>([]);

  // Modal Add/Edit Perangkat Kelas
  const [showOfficialModal, setShowOfficialModal] = useState<boolean>(false);
  const [editingOfficialId, setEditingOfficialId] = useState<string | null>(null);
  const [officialRoleName, setOfficialRoleName] = useState<string>('Ketua Kelas');
  const [officialCustomRole, setOfficialCustomRole] = useState<string>('');
  const [officialStudentId, setOfficialStudentId] = useState<string>('');
  const [officialNotes, setOfficialNotes] = useState<string>('');

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cls, tch, std, cm, co, asgs, sbjs, hrCls] = await Promise.all([
        academicService.getClasses(),
        academicService.getTeachers(),
        academicService.getStudents(),
        academicService.getClassMembers(),
        academicService.getClassOfficials(),
        academicService.getTeachingAssignments(),
        academicService.getSubjects(),
        isHomeroomScope ? academicService.resolveHomeroomClassForUser(user) : Promise.resolve(null),
      ]);
      setClasses(cls);
      setTeachers(tch);
      setStudents(std);
      setClassMembers(cm);
      setClassOfficials(co);
      setAssignments(asgs);
      setSubjects(sbjs);
      setHomeroomClass(hrCls);

      if (isHomeroomScope) {
        setSelectedClassId(hrCls ? hrCls.id : null);
      }
    } catch (err) {
      console.error('Gagal memuat data kelas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [isHomeroomScope, user?.id, user?.homeroomClassId]);

  useRealtimeSync(
    [
      'simpel_classes',
      'simpel_teachers',
      'simpel_students',
      'simpel_class_members',
      'simpel_class_officials',
      'simpel_homeroom_assignments',
      'simpel_assignments',
    ],
    () => {
      void loadData();
    }
  );

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const membersByClassId = useMemo(() => {
    const map = new Map<string, ClassMember[]>();
    for (const m of classMembers) {
      if (students.length > 0 && !studentMap.has(m.student_id)) continue;
      const list = map.get(m.class_id) || [];
      list.push(m);
      map.set(m.class_id, list);
    }
    return map;
  }, [classMembers, students.length, studentMap]);

  const officialsByClassId = useMemo(() => {
    const map = new Map<string, ClassOfficial[]>();
    for (const o of classOfficials) {
      if (students.length > 0 && !studentMap.has(o.student_id)) continue;
      const list = map.get(o.class_id) || [];
      list.push(o);
      map.set(o.class_id, list);
    }
    return map;
  }, [classOfficials, students.length, studentMap]);

  const unassignedStudents = useMemo(() => {
    const enrolledIds = new Set(classMembers.map((m) => m.student_id));
    return students.filter((s) => !enrolledIds.has(s.id));
  }, [students, classMembers]);

  const formatTeacherName = (t?: Teacher | null): string => {
    if (!t) return 'Belum Ditetapkan';
    return `${t.title_prefix ? `${t.title_prefix} ` : ''}${t.full_name}${t.title_suffix ? `, ${t.title_suffix}` : ''}`.trim();
  };

  // === HANDLER ROMBEL & WALI KELAS ===
  const openAddModal = () => {
    setEditingClassId(null);
    setLevel(1);
    setName('Kelas 1');
    setPhase('A');
    setCapacity(28);
    setHomeroomTeacherId('');
    setShowClassModal(true);
  };

  const openEditModal = (cls: ClassRoom) => {
    setEditingClassId(cls.id);
    setLevel(cls.level);
    setName(cls.name);
    setPhase(cls.phase);
    setCapacity(cls.capacity);
    setHomeroomTeacherId(cls.homeroom_teacher_id || '');
    setShowClassModal(true);
  };

  const handleLevelChange = (lvl: number) => {
    setLevel(lvl);
    if (!editingClassId) {
      setName(`Kelas ${lvl}`);
    }
    if (lvl === 1 || lvl === 2) setPhase('A');
    else if (lvl === 3 || lvl === 4) setPhase('B');
    else setPhase('C');
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClassId) {
        await academicService.updateClass(editingClassId, {
          name,
          level,
          phase,
          capacity,
          homeroom_teacher_id: homeroomTeacherId || null,
        });
        showToast(`Rombel ${name} & Wali Kelas berhasil diperbarui.`);
      } else {
        await academicService.createClass({
          name,
          level,
          phase,
          capacity,
          homeroom_teacher_id: homeroomTeacherId || null,
        });
        showToast(`Rombel ${name} berhasil ditambahkan.`);
      }
      setShowClassModal(false);
      await loadData();
    } catch (err) {
      console.error('Gagal menyimpan rombel:', err);
      showToast('Gagal menyimpan rombel kelas.', 'error');
    }
  };

  const handleDirectHomeroomChange = async (classId: string, teacherId: string) => {
    try {
      if (teacherId) {
        await academicService.assignHomeroomTeacher(classId, teacherId);
        const t = teachers.find((x) => x.id === teacherId);
        showToast(
          `Wali Kelas untuk rombel ini ditetapkan ke ${formatTeacherName(t)} (peran Wali Kelas akun otomatis disinkronkan).`
        );
      } else {
        await academicService.removeHomeroomTeacher(classId);
        showToast('Penugasan Wali Kelas pada rombel ini dilepaskan.');
      }
      await loadData();
    } catch (err) {
      console.error('Gagal mengubah wali kelas:', err);
      showToast('Gagal memperbarui Wali Kelas.', 'error');
    }
  };

  const handleDeleteClass = async (id: string, className: string) => {
    try {
      await academicService.deleteClass(id);
      setConfirmDeleteClass(null);
      if (selectedClassId === id) setSelectedClassId(null);
      showToast(`Rombel ${className} telah dihapus.`);
      await loadData();
    } catch (err) {
      console.error('Gagal menghapus rombel:', err);
      showToast('Gagal menghapus rombel kelas.', 'error');
    }
  };

  // === HANDLER ANGGOTA ROMBEL ===
  const openEnrollModal = () => {
    setEnrollSearch('');
    setEnrollShowAssignedElsewhere(unassignedStudents.length === 0);
    setSelectedStudentIdsToEnroll([]);
    setShowEnrollModal(true);
  };

  const handleToggleStudentEnroll = (studentId: string) => {
    setSelectedStudentIdsToEnroll((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleCommitEnrollStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || selectedStudentIdsToEnroll.length === 0) return;
    try {
      const ctx = await academicService.resolveActiveAcademicContext();
      for (const stdId of selectedStudentIdsToEnroll) {
        await academicService.assignStudentToClass(stdId, selectedClass.id, ctx.academicYearId);
      }
      showToast(
        `${selectedStudentIdsToEnroll.length} siswa berhasil dimasukkan ke rombel ${selectedClass.name}.`
      );
      setShowEnrollModal(false);
      await loadData();
    } catch (err) {
      console.error('Gagal memasukkan siswa ke rombel:', err);
      showToast('Gagal memasukkan siswa ke rombel.', 'error');
    }
  };

  const handleRemoveMemberFromClass = async (studentId: string, studentName: string) => {
    if (!selectedClass) return;
    try {
      await academicService.removeStudentFromClass(studentId, selectedClass.id);
      showToast(`${studentName} dikeluarkan dari rombel ${selectedClass.name}.`);
      await loadData();
    } catch (err) {
      console.error('Gagal mengeluarkan siswa:', err);
      showToast('Gagal mengeluarkan siswa dari rombel.', 'error');
    }
  };

  const handleReorderMembers = async () => {
    if (!selectedClass) return;
    try {
      await academicService.reorderClassMembersAlphabetically(selectedClass.id);
      showToast(`Nomor urut absen siswa ${selectedClass.name} telah diurutkan sesuai abjad.`);
      await loadData();
    } catch (err) {
      console.error('Gagal mengurutkan anggota rombel:', err);
    }
  };

  // === HANDLER PERANGKAT KELAS ===
  const openAddOfficialModal = () => {
    const currentMembers = selectedClass ? membersByClassId.get(selectedClass.id) || [] : [];
    const currentOfficials = selectedClass ? officialsByClassId.get(selectedClass.id) || [] : [];
    const takenRoles = new Set(currentOfficials.map((o) => o.role_name));
    const nextAvailableRole =
      PRESET_OFFICIAL_ROLES.find((r) => !takenRoles.has(r)) || PRESET_OFFICIAL_ROLES[0];

    setEditingOfficialId(null);
    setOfficialRoleName(nextAvailableRole);
    setOfficialCustomRole('');
    setOfficialStudentId(currentMembers[0]?.student_id || '');
    setOfficialNotes('');
    setShowOfficialModal(true);
  };

  const openEditOfficialModal = (official: ClassOfficial) => {
    const isPreset = PRESET_OFFICIAL_ROLES.includes(official.role_name);
    setEditingOfficialId(official.id);
    setOfficialRoleName(isPreset ? official.role_name : '__custom__');
    setOfficialCustomRole(isPreset ? '' : official.role_name);
    setOfficialStudentId(official.student_id);
    setOfficialNotes(official.notes || '');
    setShowOfficialModal(true);
  };

  const handleSaveOfficial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    const finalRole =
      officialRoleName === '__custom__' ? officialCustomRole.trim() : officialRoleName.trim();
    if (!finalRole || !officialStudentId) {
      showToast('Jabatan dan nama siswa wajib dipilih.', 'error');
      return;
    }

    try {
      await academicService.upsertClassOfficial({
        id: editingOfficialId || undefined,
        class_id: selectedClass.id,
        student_id: officialStudentId,
        role_name: finalRole,
        notes: officialNotes.trim() || null,
      });
      setShowOfficialModal(false);
      showToast(`Perangkat kelas (${finalRole}) berhasil disimpan.`);
      await loadData();
    } catch (err) {
      console.error('Gagal menyimpan perangkat kelas:', err);
      showToast('Gagal menyimpan perangkat kelas.', 'error');
    }
  };

  const handleDeleteOfficial = async (official: ClassOfficial) => {
    try {
      await academicService.deleteClassOfficial(official.id);
      showToast(`Jabatan ${official.role_name} berhasil dihapus.`);
      await loadData();
    } catch (err) {
      console.error('Gagal menghapus perangkat kelas:', err);
    }
  };

  const handlePrintClassStructure = async () => {
    if (!selectedClass) return;
    const settings = await academicService.getSettings();
    const members = membersByClassId.get(selectedClass.id) || [];
    const officials = officialsByClassId.get(selectedClass.id) || [];
    const hrName = formatTeacherName(selectedClass.homeroom_teacher);
    const hrNip = selectedClass.homeroom_teacher?.nip || '-';

    const officialRows = officials
      .map(
        (off, idx) => `
      <tr>
        <td class="center">${idx + 1}</td>
        <td><strong>${off.role_name}</strong></td>
        <td class="center"><strong>${off.student?.full_name || '-'}</strong></td>
        <td class="center font-mono">${off.student?.nis || '-'}</td>
        <td>${off.notes || '-'}</td>
      </tr>
    `
      )
      .join('');

    const memberRows = members
      .map(
        (m, idx) => `
      <tr>
        <td class="center">${m.student_number || idx + 1}</td>
        <td class="center font-mono">${m.student?.nis || '-'}</td>
        <td class="center">${m.student?.full_name || '-'}</td>
        <td class="center">${m.student?.gender || '-'}</td>
      </tr>
    `
      )
      .join('');

    const html = `
      <h3 style="margin: 12px 0 6px; font-size: 13px;">A. Struktur Pengurus & Perangkat ${selectedClass.name}</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 35px;">No</th>
            <th style="width: 190px;">Jabatan Perangkat Kelas</th>
            <th>Nama Peserta Didik</th>
            <th style="width: 90px;">NIS</th>
            <th>Keterangan / Tugas</th>
          </tr>
        </thead>
        <tbody>
          ${
            officialRows ||
            '<tr><td colspan="5" class="center">Belum ada perangkat kelas yang ditetapkan.</td></tr>'
          }
        </tbody>
      </table>

      <h3 style="margin: 18px 0 6px; font-size: 13px;">B. Daftar Anggota Rombongan Belajar (${members.length} Siswa)</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 50px;">Absen</th>
            <th style="width: 100px;">NIS</th>
            <th>Nama Lengkap Peserta Didik</th>
            <th style="width: 50px;">L/P</th>
          </tr>
        </thead>
        <tbody>
          ${
            memberRows ||
            '<tr><td colspan="4" class="center">Belum ada siswa terdaftar di rombel ini.</td></tr>'
          }
        </tbody>
      </table>
    `;

    printDocumentDirectly(html, {
      title: `STRUKTUR ORGANISASI & PERANGKAT ${selectedClass.name.toUpperCase()}`,
      subtitle: `Fase ${selectedClass.phase} · Wali Kelas: ${hrName}`,
      metadata: [
        { label: 'Madrasah', value: settings.school_name },
        { label: 'Rombongan Belajar', value: `${selectedClass.name} (Fase ${selectedClass.phase})` },
        { label: 'Wali Kelas', value: hrName },
        { label: 'Jumlah Siswa', value: `${members.length} / ${selectedClass.capacity} Siswa` },
      ],
      signature: {
        leftTitle: 'Wali Kelas,',
        leftName: hrName,
        leftNip: hrNip,
        rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`,
        rightTitle: 'Mengetahui,<br>Kepala Madrasah,',
        rightName: settings.principal_name || 'MUIN, S.Pd.I',
        rightNip: settings.principal_nip || '-',
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Memuat data rombongan belajar & perangkat kelas...</span>
      </div>
    );
  }

  // Jika Wali Kelas belum punya rombel yang ditugaskan
  if (isHomeroomScope && !homeroomClass) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-xs">
            <h2 className="text-sm font-bold text-amber-950">Rombel Wali Kelas Belum Ditetapkan</h2>
            <p className="text-amber-800 leading-relaxed">
              Akun Anda saat ini belum terhubung sebagai Wali Kelas pada rombel manapun. Silakan hubungi Administrator Madrasah untuk menetapkan rombel kelas binaan Anda di menu <strong>Kelas 1 s.d. 6</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================================
  // DETAIL WORKSPACE UNTUK ROMBEL TERPILIH (Wali, Anggota Rombel, Perangkat Kelas)
  // =====================================================================
  if (selectedClass) {
    const classMembersList = membersByClassId.get(selectedClass.id) || [];
    const classOfficialsList = officialsByClassId.get(selectedClass.id) || [];
    const classAssignments = assignments.filter((a) => a.class_id === selectedClass.id);
    const maleCount = classMembersList.filter((m) => m.student?.gender === 'L').length;
    const femaleCount = classMembersList.filter((m) => m.student?.gender === 'P').length;

    const enrollCandidates = students.filter((s) => {
      const currentMember = classMembers.find((m) => m.student_id === s.id);
      const alreadyInThisClass = currentMember?.class_id === selectedClass.id;
      if (alreadyInThisClass) return false;
      if (!enrollShowAssignedElsewhere && currentMember) return false;
      if (enrollSearch.trim()) {
        const q = enrollSearch.toLowerCase();
        return s.full_name.toLowerCase().includes(q) || s.nis.includes(q);
      }
      return true;
    });

    return (
      <div className="space-y-6 max-w-6xl">
        {/* Top Bar & Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {!isHomeroomScope && (
              <button
                onClick={() => setSelectedClassId(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Semua Rombel</span>
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Pengelolaan {selectedClass.name}</span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Fase {selectedClass.phase}
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Wali Kelas: <strong className="text-slate-700">{formatTeacherName(selectedClass.homeroom_teacher)}</strong> ·{' '}
                {classMembersList.length} / {selectedClass.capacity} siswa · {classOfficialsList.length} perangkat kelas
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isHomeroomScope && (
              <select
                value={selectedClass.id}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Pindah ke: {c.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handlePrintClassStructure}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Struktur & Anggota</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`flex items-center gap-2 p-3 text-xs font-medium rounded-lg border ${
              statusMessage.type === 'success'
                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                : 'text-rose-800 bg-rose-50 border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wali Kelas</span>
            <p className="text-xs font-bold text-slate-900 mt-1 truncate" title={formatTeacherName(selectedClass.homeroom_teacher)}>
              {formatTeacherName(selectedClass.homeroom_teacher)}
            </p>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              {selectedClass.homeroom_teacher?.specialization || 'Penanggung Jawab Rombel'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Anggota Rombel</span>
            <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {classMembersList.length} <span className="text-xs font-normal text-slate-500">/ {selectedClass.capacity} Siswa</span>
            </p>
            <p className="text-[11px] text-slate-500">
              Putra: {maleCount} · Putri: {femaleCount}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Perangkat Kelas</span>
            <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {classOfficialsList.length} <span className="text-xs font-normal text-slate-500">Pengurus</span>
            </p>
            <p className="text-[11px] text-amber-700 truncate">
              Ketua: {classOfficialsList.find((o) => o.role_name === 'Ketua Kelas')?.student?.full_name || 'Belum ditetapkan'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guru Mapel Terhubung</span>
            <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
              {classAssignments.length} <span className="text-xs font-normal text-slate-500">/ {subjects.length} Mapel</span>
            </p>
            <p className="text-[11px] text-slate-500">Penugasan SK KBM aktif</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {[
            { id: 'perangkat', label: `Perangkat Kelas (${classOfficialsList.length})`, icon: ShieldCheck },
            { id: 'anggota', label: `Anggota Rombel (${classMembersList.length})`, icon: Users },
            { id: 'pengajar', label: `Wali Kelas & Guru Mapel (${classAssignments.length})`, icon: BookOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = detailTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setDetailTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: PERANGKAT KELAS */}
        {detailTab === 'perangkat' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Struktur Perangkat {selectedClass.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tetapkan Ketua Kelas, Wakil Ketua, Sekretaris, Bendahara, dan Seksi-seksi dari siswa yang terdaftar di rombel ini.
                </p>
              </div>
              <button
                onClick={openAddOfficialModal}
                disabled={classMembersList.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tetapkan Perangkat Kelas</span>
              </button>
            </div>

            {classMembersList.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-2">
                <p className="text-xs font-bold text-amber-900">Belum Ada Siswa di Rombel {selectedClass.name}</p>
                <p className="text-xs text-amber-800">
                  Tambahkan atau impor siswa ke {selectedClass.name} terlebih dahulu pada tab <strong>Anggota Rombel</strong> agar dapat dipilih sebagai Perangkat Kelas.
                </p>
                <button
                  onClick={() => setDetailTab('anggota')}
                  className="mt-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700"
                >
                  <span>Kelola Anggota Rombel</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : classOfficialsList.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
                <Award className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-xs font-bold text-slate-800">Perangkat Kelas Belum Ditetapkan</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Klik tombol &quot;Tetapkan Perangkat Kelas&quot; untuk menyusun pengurus {selectedClass.name} (Ketua Kelas, Sekretaris, Bendahara, dan Seksi).
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-3 px-4 w-12">No</th>
                      <th className="py-3 px-4">Jabatan Perangkat Kelas</th>
                      <th className="py-3 px-4">Nama Siswa</th>
                      <th className="py-3 px-4">NIS</th>
                      <th className="py-3 px-4">Keterangan Tugas</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classOfficialsList.map((off, idx) => (
                      <tr key={off.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-bold text-[11px]">
                            <Award className="w-3 h-3 text-amber-600" />
                            <span>{off.role_name}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{off.student?.full_name || '-'}</td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-600">{off.student?.nis || '-'}</td>
                        <td className="py-3 px-4 text-slate-600">{off.notes || '-'}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditOfficialModal(off)}
                              className="p-1.5 text-slate-500 hover:text-emerald-800 hover:bg-slate-100 rounded transition-colors"
                              title="Ubah Pengurus"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteOfficial(off)}
                              className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                              title="Hapus Jabatan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ANGGOTA ROMBEL */}
        {detailTab === 'anggota' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Daftar Anggota Rombel {selectedClass.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola penempatan peserta didik, nomor urut absen, dan perpindahan rombel.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {classMembersList.length > 1 && (
                  <button
                    onClick={handleReorderMembers}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>Urutkan Abjad Absen</span>
                  </button>
                )}
                <button
                  onClick={openEnrollModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tambah / Pindahkan Siswa</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4 w-16 text-center align-middle">Absen</th>
                    <th className="py-3 px-4 text-center align-middle">NIS / NISN</th>
                    <th className="py-3 px-4 text-center align-middle">Nama Peserta Didik</th>
                    <th className="py-3 px-4 text-center align-middle">L/P</th>
                    <th className="py-3 px-4 align-middle">Perangkat Kelas</th>
                    <th className="py-3 px-4 text-right align-middle">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classMembersList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">
                        Belum ada peserta didik yang masuk rombel {selectedClass.name}. Klik &quot;Tambah / Pindahkan Siswa&quot; di atas atau impor CSV dengan kolom Tingkat_Kelas = {selectedClass.level}.
                      </td>
                    </tr>
                  ) : (
                    classMembersList.map((member, idx) => {
                      const std = member.student || studentMap.get(member.student_id);
                      const studentRoles = classOfficialsList.filter((o) => o.student_id === member.student_id);
                      return (
                        <tr key={member.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 text-center align-middle font-mono tabular-nums font-bold text-slate-600">
                            {member.student_number || idx + 1}
                          </td>
                          <td className="py-3 px-4 text-center align-middle font-mono tabular-nums">
                            <div className="font-medium text-slate-900">{std?.nis || '-'}</div>
                            <div className="text-[11px] text-slate-400">{std?.nisn || '-'}</div>
                          </td>
                          <td className="py-3 px-4 text-center align-middle font-bold text-slate-900">{std?.full_name || 'Siswa'}</td>
                          <td className="py-3 px-4 text-center align-middle">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                std?.gender === 'P' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {std?.gender || 'L'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {studentRoles.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {studentRoles.map((sr) => (
                                  <span
                                    key={sr.id}
                                    className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold"
                                  >
                                    {sr.role_name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Anggota Kelas</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleRemoveMemberFromClass(member.student_id, std?.full_name || 'Siswa')}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50 rounded border border-rose-200 font-medium"
                              title="Keluarkan dari rombel ini"
                            >
                              <UserMinus className="w-3 h-3" />
                              <span>Keluarkan</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: WALI KELAS & GURU PENGAMPU MAPEL */}
        {detailTab === 'pengajar' && (
          <div className="space-y-5">
            {/* Penugasan Wali Kelas */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Wali Kelas {selectedClass.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Guru yang ditetapkan sebagai Wali Kelas otomatis terhubung ke Rombel ini dan memperoleh peran akses <strong>Wali Kelas</strong>.
                  </p>
                </div>
                {!isHomeroomScope && (
                  <div className="w-full sm:w-80">
                    <select
                      value={selectedClass.homeroom_teacher_id || ''}
                      onChange={(e) => handleDirectHomeroomChange(selectedClass.id, e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold text-slate-800 focus:outline-emerald-600"
                    >
                      <option value="">-- Belum Ada Wali Kelas --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {formatTeacherName(t)} {t.specialization ? `(${t.specialization})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Daftar Guru Pengampu Mata Pelajaran */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Daftar Guru Mata Pelajaran ({selectedClass.name})</h3>
                  <p className="text-xs text-slate-500">Terhubung langsung dengan SK Penugasan Mengajar.</p>
                </div>
                {onNavigate && activeRole === 'admin' && (
                  <button
                    onClick={() => onNavigate(`penugasan-${selectedClass.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg"
                  >
                    <span>Atur Guru Mapel</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 font-semibold bg-slate-50/50">
                    <th className="py-2.5 px-4 w-12">No</th>
                    <th className="py-2.5 px-4">Mata Pelajaran</th>
                    <th className="py-2.5 px-4">Kategori</th>
                    <th className="py-2.5 px-4">Guru Pengampu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjects.map((sbj, idx) => {
                    const asg = classAssignments.find((a) => a.subject_id === sbj.id);
                    return (
                      <tr key={sbj.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">{sbj.name}</td>
                        <td className="py-2.5 px-4 text-slate-600">{sbj.category}</td>
                        <td className="py-2.5 px-4">
                          {asg?.teacher ? (
                            <span className="font-semibold text-emerald-800">{formatTeacherName(asg.teacher)}</span>
                          ) : (
                            <span className="text-amber-700 italic">Belum ditugaskan</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Tambah / Pindahkan Siswa ke Rombel */}
        {showEnrollModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Masukkan Siswa ke {selectedClass.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih peserta didik yang belum memiliki rombel atau pindahkan dari rombel lain.
                </p>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={enrollSearch}
                    onChange={(e) => setEnrollSearch(e.target.value)}
                    placeholder="Cari nama siswa atau NIS..."
                    className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enrollShowAssignedElsewhere}
                    onChange={(e) => setEnrollShowAssignedElsewhere(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-800"
                  />
                  <span>Tampilkan juga siswa yang saat ini terdaftar di rombel lain (untuk pindah kelas)</span>
                </label>
              </div>

              <form onSubmit={handleCommitEnrollStudents} className="space-y-4">
                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {enrollCandidates.length === 0 ? (
                    <p className="p-6 text-center text-xs text-slate-400">
                      Tidak ada kandidat siswa yang tersedia pada filter ini.
                    </p>
                  ) : (
                    enrollCandidates.map((s) => {
                      const prevMember = classMembers.find((m) => m.student_id === s.id);
                      const prevClass = prevMember ? classMap.get(prevMember.class_id) : null;
                      const isChecked = selectedStudentIdsToEnroll.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center justify-between px-3 py-2.5 text-xs cursor-pointer hover:bg-slate-50 ${
                            isChecked ? 'bg-emerald-50/70' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleStudentEnroll(s.id)}
                              className="rounded border-slate-300 text-emerald-800"
                            />
                            <div>
                              <p className="font-bold text-slate-900">{s.full_name}</p>
                              <p className="text-[11px] text-slate-500 font-mono">NIS: {s.nis} · {s.gender}</p>
                            </div>
                          </div>
                          {prevClass ? (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                              Saat ini: {prevClass.name}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                              Belum Ada Rombel
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Dipilih: <strong>{selectedStudentIdsToEnroll.length}</strong> siswa
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEnrollModal(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={selectedStudentIdsToEnroll.length === 0}
                      className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg disabled:opacity-50"
                    >
                      Masukkan ke {selectedClass.name}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Tetapkan / Edit Perangkat Kelas */}
        {showOfficialModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900 mb-1">
                {editingOfficialId ? 'Ubah Perangkat Kelas' : `Tetapkan Perangkat ${selectedClass.name}`}
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Pilih jabatan struktur kelas dan siswa anggota rombel {selectedClass.name}.
              </p>

              <form onSubmit={handleSaveOfficial} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jabatan Perangkat Kelas</label>
                  <select
                    value={officialRoleName}
                    onChange={(e) => setOfficialRoleName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-emerald-600 font-medium"
                  >
                    {PRESET_OFFICIAL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    <option value="__custom__">Jabatan Lainnya (Tulis Sendiri)...</option>
                  </select>
                </div>

                {officialRoleName === '__custom__' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Jabatan Khusus</label>
                    <input
                      type="text"
                      value={officialCustomRole}
                      onChange={(e) => setOfficialCustomRole(e.target.value)}
                      placeholder="Contoh: Koordinator Piket Senin"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Peserta Didik ({selectedClass.name})
                  </label>
                  <select
                    value={officialStudentId}
                    onChange={(e) => setOfficialStudentId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-emerald-600 font-semibold text-slate-800"
                    required
                  >
                    <option value="">-- Pilih Siswa --</option>
                    {classMembersList.map((m) => {
                      const std = m.student || studentMap.get(m.student_id);
                      if (!std) return null;
                      return (
                        <option key={std.id} value={std.id}>
                          {m.student_number ? `${m.student_number}. ` : ''}
                          {std.full_name} (NIS: {std.nis})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan / Uraian Tugas (Opsional)</label>
                  <input
                    type="text"
                    value={officialNotes}
                    onChange={(e) => setOfficialNotes(e.target.value)}
                    placeholder="Contoh: Memimpin doa pagi dan koordinasi piket"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowOfficialModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                  >
                    Simpan Perangkat Kelas
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =====================================================================
  // GRID OVERVIEW SELURUH ROMBEL (KELAS 1 - 6)
  // =====================================================================
  const totalEnrolled = classes.reduce((acc, c) => acc + (membersByClassId.get(c.id)?.length || 0), 0);
  const assignedHomeroomsCount = classes.filter((c) => Boolean(c.homeroom_teacher_id)).length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Data Rombongan Belajar (Kelas 1 - 6)</h1>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan terhubung antara Rombel, Wali Kelas, Anggota Siswa, Perangkat Kelas, dan Penugasan Guru Mapel.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Rombel Kelas</span>
        </button>
      </div>

      {statusMessage && (
        <div
          className={`flex items-center gap-2 p-3 text-xs font-medium rounded-lg border ${
            statusMessage.type === 'success'
              ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
              : 'text-rose-800 bg-rose-50 border-rose-200'
          }`}
        >
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Alert siswa belum masuk rombel */}
      {unassignedStudents.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                Ada {unassignedStudents.length} Peserta Didik Belum Masuk Rombel
              </p>
              <p className="text-amber-800 mt-0.5">
                Klik tombol &quot;Kelola Rombel &amp; Perangkat&quot; pada salah satu kartu kelas di bawah untuk memasukkan siswa ke rombelnya.
              </p>
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('master-siswa')}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0 self-start sm:self-auto"
            >
              Lihat Data Siswa
            </button>
          )}
        </div>
      )}

      {/* Info Fase Kurikulum Merdeka & Statistik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-emerald-900">FASE A (Kelas 1 &amp; 2)</span>
            <span className="text-[11px] font-mono font-bold text-emerald-800">
              {classes.filter((c) => c.phase === 'A').reduce((s, c) => s + (membersByClassId.get(c.id)?.length || 0), 0)} Siswa
            </span>
          </div>
          <p className="text-xs text-emerald-800/80">
            Fokus fondasi literasi, numerasi dasar, adab mulia, dan Kurikulum Berbasis Cinta.
          </p>
        </div>

        <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-amber-900">FASE B (Kelas 3 &amp; 4)</span>
            <span className="text-[11px] font-mono font-bold text-amber-800">
              {classes.filter((c) => c.phase === 'B').reduce((s, c) => s + (membersByClassId.get(c.id)?.length || 0), 0)} Siswa
            </span>
          </div>
          <p className="text-xs text-amber-800/80">
            Penguatan IPAS, nalar kritis, kolaborasi santun, dan Pembelajaran Mendalam.
          </p>
        </div>

        <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-900">FASE C (Kelas 5 &amp; 6)</span>
            <span className="text-[11px] font-mono font-bold text-slate-700">
              {totalEnrolled} Total Siswa · {assignedHomeroomsCount}/{classes.length} Wali
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Kemandirian belajar, kepemimpinan perangkat kelas, Aswaja, dan persiapan kelulusan.
          </p>
        </div>
      </div>

      {/* Grid Kartu Kelas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {classes.map((cls) => {
          const members = membersByClassId.get(cls.id) || [];
          const registeredCount = members.length;
          const officials = officialsByClassId.get(cls.id) || [];
          const ketua = officials.find((o) => o.role_name === 'Ketua Kelas');
          const classMapelCount = assignments.filter((a) => a.class_id === cls.id).length;
          const homeroomName = formatTeacherName(cls.homeroom_teacher);
          const pct = cls.capacity > 0 ? Math.min(100, Math.round((registeredCount / cls.capacity) * 100)) : 0;

          return (
            <div
              key={cls.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-400 transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold text-sm">
                      {cls.level}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{cls.name}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <span>Fase {cls.phase}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums font-semibold text-emerald-800">
                          {registeredCount} Siswa
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-mono tabular-nums font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      Maks {cls.capacity}
                    </span>
                    <button
                      onClick={() => openEditModal(cls)}
                      className="p-1 text-slate-400 hover:text-emerald-800 hover:bg-slate-100 rounded transition-colors"
                      title="Ubah Data Rombel & Wali Kelas"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {classes.length > 6 && (
                      <button
                        onClick={() => setConfirmDeleteClass({ id: cls.id, name: cls.name })}
                        className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        title="Hapus Rombel"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar Kapasitas Nyata */}
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                    <span>Keterisian Rombel</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-700 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Ringkasan Perangkat Kelas & Guru Mapel */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Perangkat Kelas</span>
                    <span className="font-semibold text-slate-800 truncate block">
                      {ketua?.student?.full_name
                        ? `Ketua: ${ketua.student.full_name}`
                        : officials.length > 0
                        ? `${officials.length} Pengurus`
                        : 'Belum diatur'}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Guru Mapel</span>
                    <span className="font-semibold text-slate-800 block">
                      {classMapelCount} / {subjects.length} Mapel
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                {/* Wali Kelas */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 truncate pr-2">
                    <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="font-medium truncate" title={homeroomName}>
                      {homeroomName}
                    </span>
                  </div>
                  <button
                    onClick={() => openEditModal(cls)}
                    className="shrink-0 text-[10px] text-emerald-800 font-semibold bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors cursor-pointer"
                  >
                    {cls.homeroom_teacher ? 'Ubah Wali' : '+ Pilih Wali'}
                  </button>
                </div>

                {/* Aksi Kelola Terhubung */}
                <button
                  onClick={() => {
                    setSelectedClassId(cls.id);
                    setDetailTab('perangkat');
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                  <span>Kelola Rombel &amp; Perangkat Kelas</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Konfirmasi Hapus Kelas */}
      {confirmDeleteClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Konfirmasi Hapus Rombel</h3>
            <p className="text-xs text-slate-600">
              Hapus rombel <strong>{confirmDeleteClass.name}</strong>? Anggota rombel dan perangkat kelas di rombel ini akan dilepas.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteClass(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteClass(confirmDeleteClass.id, confirmDeleteClass.name)}
                className="px-3.5 py-1.5 text-xs bg-rose-700 hover:bg-rose-800 text-white font-semibold rounded-lg"
              >
                Hapus Rombel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah/Edit Rombel */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingClassId ? `Ubah Data Rombel ${name}` : 'Tambah Rombel Kelas Baru'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Konfigurasi rombongan belajar, kapasitas kelas, dan penugasan Wali Kelas.
            </p>

            <form onSubmit={handleSaveClass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tingkat Kelas</label>
                <div className="grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => handleLevelChange(lvl)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                        level === lvl
                          ? 'border-emerald-800 bg-emerald-800 text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Rombel</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Wali Kelas (Penanggung Jawab Rombel)
                </label>
                <select
                  value={homeroomTeacherId}
                  onChange={(e) => setHomeroomTeacherId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white font-medium text-slate-800"
                >
                  <option value="">-- Pilih Wali Kelas dari Daftar Guru --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatTeacherName(t)} {t.specialization ? `(${t.specialization})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Penetapan ini otomatis menghubungkan akun guru tersebut dengan akses peran <strong>Wali Kelas</strong> pada rombel ini.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fase Kurikulum</label>
                  <select
                    value={phase}
                    onChange={(e) => setPhase(e.target.value as 'A' | 'B' | 'C')}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600 bg-white"
                  >
                    <option value="A">Fase A (Kelas 1-2)</option>
                    <option value="B">Fase B (Kelas 3-4)</option>
                    <option value="C">Fase C (Kelas 5-6)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kapasitas Maksimal</label>
                  <input
                    type="number"
                    min="10"
                    max="40"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full text-xs font-mono tabular-nums px-3 py-2 border border-slate-200 rounded-lg focus:outline-emerald-600"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg shadow-xs"
                >
                  {editingClassId ? 'Simpan Perubahan' : 'Simpan Rombel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
