import React, { useState, useEffect } from 'react';
import { attendanceService } from '../../services/attendanceService';
import { academicService } from '../../services/academicService';
import { Student, ClassRoom, AttendanceStatus, ClassMember, Teacher } from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import { printDocumentDirectly } from '../../services/printService';
import {
  CalendarCheck,
  CheckCircle,
  Save,
  Check,
  Calendar,
  Users,
  AlertCircle,
  Info,
  Printer,
  ShieldCheck,
  School,
  Lock,
} from 'lucide-react';

interface AttendancePageProps {
  onNavigate?: (view: string) => void;
}

export const AttendancePage: React.FC<AttendancePageProps> = ({ onNavigate }) => {
  const { user, activeRole } = useAuth();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  const [homeroomClassId, setHomeroomClassId] = useState<string>('cls-4');
  const [selectedClassId, setSelectedClassId] = useState<string>('cls-4');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Map of studentId -> { status: AttendanceStatus, notes: string }
  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, { status: AttendanceStatus; notes: string }>
  >({});

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [clss, stds, cm, hrs] = await Promise.all([
        academicService.getClasses(),
        academicService.getStudents(),
        academicService.getClassMembers(),
        academicService.getHomeroomAssignments(),
      ]);

      setClasses(clss);
      setAllStudents(stds);
      setClassMembers(cm);

      // Tentukan rombel wali kelas pengguna aktif
      let userHrClass = 'cls-4';
      if (user?.teacherId) {
        const foundHr = hrs.find((h) => h.teacher_id === user.teacherId);
        if (foundHr) {
          userHrClass = foundHr.class_id;
        } else {
          const classWithHr = clss.find((c) => c.homeroom_teacher_id === user.teacherId);
          if (classWithHr) userHrClass = classWithHr.id;
        }
      } else if (user?.homeroomClassId) {
        userHrClass = user.homeroomClassId;
      }

      setHomeroomClassId(userHrClass);

      // Jika role wali_kelas, kunci ke rombel binaannya
      const activeClass = activeRole === 'wali_kelas' ? userHrClass : selectedClassId || 'cls-4';
      setSelectedClassId(activeClass);

      await loadAttendanceForClass(activeClass, selectedDate, stds, cm);
    } catch (err) {
      console.error('Gagal memuat data awal presensi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAttendanceForClass = async (
    classId: string,
    date: string,
    studentsPool: Student[],
    membersPool: ClassMember[]
  ) => {
    try {
      // Dapatkan siswa yang terdaftar di rombel ini
      const enrolledStudentIds = membersPool
        .filter((m) => m.class_id === classId)
        .map((m) => m.student_id);

      // Siswa rombel
      const classStudents = studentsPool.filter(
        (s) => enrolledStudentIds.includes(s.id) || (classId === 'cls-4' && enrolledStudentIds.length === 0)
      );

      const existing = await attendanceService.getAttendance({
        classId,
        date,
      });

      const initialMap: Record<string, { status: AttendanceStatus; notes: string }> = {};
      classStudents.forEach((s) => {
        const found = existing.find((e) => e.student_id === s.id);
        initialMap[s.id] = {
          status: found ? found.status : 'Hadir',
          notes: found?.notes || '',
        };
      });
      setAttendanceMap(initialMap);
    } catch (err) {
      console.error('Gagal memuat presensi kelas:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [activeRole]);

  useEffect(() => {
    if (allStudents.length > 0) {
      loadAttendanceForClass(selectedClassId, selectedDate, allStudents, classMembers);
    }
  }, [selectedClassId, selectedDate]);

  // Filter siswa yang terdaftar di rombel aktif
  const targetMemberIds = classMembers
    .filter((m) => m.class_id === selectedClassId)
    .map((m) => m.student_id);

  const displayedStudents = allStudents.filter(
    (s) => targetMemberIds.includes(s.id) || (selectedClassId === 'cls-4' && targetMemberIds.length === 0)
  );

  const currentClass = classes.find((c) => c.id === selectedClassId) || {
    id: selectedClassId,
    name: 'Kelas 4',
    level: 4,
    phase: 'B',
  };

  const isHomeroomLocked = activeRole === 'wali_kelas';

  const handleMarkAllPresent = () => {
    const updated: Record<string, { status: AttendanceStatus; notes: string }> = {};
    displayedStudents.forEach((s) => {
      updated[s.id] = {
        status: 'Hadir',
        notes: '',
      };
    });
    setAttendanceMap(updated);
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes,
      },
    }));
  };

  const handleSaveAttendance = async () => {
    setIsSaving(true);
    try {
      const payload = displayedStudents.map((s) => ({
        studentId: s.id,
        classId: selectedClassId,
        date: selectedDate,
        status: attendanceMap[s.id]?.status || 'Hadir',
        notes: attendanceMap[s.id]?.notes || null,
        recordedBy: user?.id || 'usr-guru-1',
        academicYearId: 'ay-2026',
        semesterId: 'sem-ganjil-2026',
      }));

      await attendanceService.recordAttendance(payload);
      setStatusMessage(`Presensi ${currentClass.name} tanggal ${selectedDate} berhasil disimpan ke database.`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      console.error('Gagal menyimpan presensi:', err);
      setStatusMessage('Terjadi kesalahan saat menyimpan presensi.');
    } finally {
      setIsSaving(false);
    }
  };

  // Cetak Dokumen Presensi Siap Cetak
  const handlePrintAttendance = () => {
    const rows = displayedStudents.map((s, idx) => {
      const entry = attendanceMap[s.id] || { status: 'Hadir', notes: '' };
      return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td><strong>${s.full_name}</strong></td>
          <td class="center font-mono">${s.nis}</td>
          <td class="center font-bold" style="${
            entry.status === 'Hadir' ? 'color:#047857;' : entry.status === 'Sakit' ? 'color:#d97706;' : entry.status === 'Izin' ? 'color:#2563eb;' : 'color:#dc2626;'
          }">${entry.status}</td>
          <td>${entry.notes || '-'}</td>
        </tr>
      `;
    }).join('');

    const contentHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 35px;">No</th>
            <th>Nama Lengkap Peserta Didik</th>
            <th style="width: 90px;">NIS</th>
            <th style="width: 100px;">Status Kehadiran</th>
            <th>Keterangan / Alasan</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    printDocumentDirectly(contentHtml, {
      title: 'DAFTAR PRESENSI HARIAN PESERTA DIDIK',
      subtitle: `${currentClass.name} (Fase ${currentClass.phase}) - Tanggal: ${selectedDate}`,
      metadata: [
        { label: 'Rombongan Belajar', value: currentClass.name },
        { label: 'Fase Kurikulum', value: `Fase ${currentClass.phase}` },
        { label: 'Tanggal KBM', value: selectedDate },
        { label: 'Tingkat Kehadiran', value: `${hadirPercentage}% (${hadirCount} Hadir)` },
      ],
      signature: {
        leftTitle: 'Wali Kelas,',
        leftName: user?.profile?.full_name || 'Ust. Ahmad Fauzi, S.Pd.I',
        leftNip: '198503122019031008',
        rightCityDate: `Temanggung, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        rightTitle: 'Mengetahui,<br>Kepala Madrasah,',
        rightName: 'MUIN, S.Pd.I',
        rightNip: '197508152005011004',
      },
    });
  };

  // Hitung statistik hari ini
  const total = displayedStudents.length;
  const hadirCount = displayedStudents.filter((s) => (attendanceMap[s.id]?.status || 'Hadir') === 'Hadir').length;
  const sakitCount = displayedStudents.filter((s) => attendanceMap[s.id]?.status === 'Sakit').length;
  const izinCount = displayedStudents.filter((s) => attendanceMap[s.id]?.status === 'Izin').length;
  const alpaCount = displayedStudents.filter((s) => attendanceMap[s.id]?.status === 'Alpa').length;
  const hadirPercentage = total > 0 ? Math.round((hadirCount / total) * 100) : 0;

  // Jika guru biasa (bukan wali kelas dan bukan admin/kamad)
  if (activeRole === 'guru' && !user?.roles?.includes('wali_kelas')) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-700">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Akses Presensi Khusus Wali Kelas</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Sesuai SOP Administrasi Madrasah, pencatatan absensi harian siswa dikelola secara terpusat oleh <strong>Wali Kelas</strong> pada rombel binaannya masing-masing.
          <br /><br />
          Sebagai Guru Mata Pelajaran, Anda dapat mencatat kehadiran santri saat jam tatap muka langsung di lembar <strong>Jurnal Mengajar Harian</strong>.
        </p>
        <div className="pt-2 flex justify-center gap-3">
          {onNavigate && (
            <button
              onClick={() => onNavigate('jurnal-kbm')}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              Buka Jurnal Mengajar Harian
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Presensi Kehadiran Siswa</h1>
            {isHomeroomLocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <Lock className="w-3 h-3 text-amber-700" />
                <span>Portal Khusus Wali Kelas</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isHomeroomLocked
              ? `Pencatatan presensi khusus rombongan belajar binaan Anda (${currentClass.name}).`
              : 'Pencatatan kehadiran harian peserta didik per rombel dengan rekap persentase otomatis.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrintAttendance}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
            title="Cetak Berkas Presensi Siap Cetak (Kop Madrasah)"
          >
            <Printer className="w-4 h-4 text-emerald-800" />
            <span>Cetak PDF Siap Cetak</span>
          </button>
          <button
            onClick={handleMarkAllPresent}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Check className="w-4 h-4 text-emerald-700" />
            <span>Tandai Semua Hadir</span>
          </button>
          <button
            onClick={handleSaveAttendance}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Presensi'}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Banner Khusus Wali Kelas */}
      {isHomeroomLocked && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-950">
          <div className="flex items-center gap-2.5">
            <School className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <span className="font-bold">Rombel Binaan: {currentClass.name} (Fase {currentClass.phase})</span>
              <p className="text-[11px] text-emerald-800">
                Wali Kelas: <strong>{user?.profile?.full_name || 'Ust. Ahmad Fauzi, S.Pd.I'}</strong> — Data kehadiran otomatis terekap ke Buku Rapor semester aktif.
              </p>
            </div>
          </div>
          <span className="font-mono tabular-nums font-bold text-emerald-800 bg-white px-2.5 py-1 rounded border border-emerald-200 shadow-2xs">
            {displayedStudents.length} Santri Terdaftar
          </span>
        </div>
      )}

      {/* Filter Rombel & Tanggal */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Rombel:</span>
            {isHomeroomLocked ? (
              <span className="text-xs font-bold px-3 py-1.5 bg-slate-100 text-slate-800 rounded-lg border border-slate-200 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-slate-500" />
                <span>{currentClass.name} (Fase {currentClass.phase})</span>
              </span>
            ) : (
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600 font-medium"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Fase {c.phase})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Tanggal:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-mono tabular-nums px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-emerald-600 font-medium"
            />
          </div>
        </div>

        {/* Ringkasan Statistik */}
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-slate-600">Kehadiran:</span>
          <span className="font-mono tabular-nums font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            {hadirPercentage}% Hadir
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500 font-mono tabular-nums">H: {hadirCount}</span>
          <span className="text-slate-500 font-mono tabular-nums">S: {sakitCount}</span>
          <span className="text-slate-500 font-mono tabular-nums">I: {izinCount}</span>
          <span className="text-slate-500 font-mono tabular-nums">A: {alpaCount}</span>
        </div>
      </div>

      {/* Tabel Entri Presensi */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 text-xs font-semibold">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Nama Lengkap Santri</th>
                <th className="py-3 px-4">NIS</th>
                <th className="py-3 px-4 text-center">Status Kehadiran</th>
                <th className="py-3 px-4">Keterangan / Alasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Memuat presensi siswa...
                  </td>
                </tr>
              ) : displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Tidak ada siswa yang terdaftar pada {currentClass.name}. Silakan tambahkan siswa di Data Master Siswa atau Pusat Migrasi.
                  </td>
                </tr>
              ) : (
                displayedStudents.map((student, idx) => {
                  const entry = attendanceMap[student.id] || { status: 'Hadir', notes: '' };
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{student.full_name}</div>
                        <div className="text-[11px] text-slate-400">
                          {student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 font-medium">
                        {student.nis}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {(['Hadir', 'Sakit', 'Izin', 'Alpa'] as AttendanceStatus[]).map((st) => {
                            const isSelected = entry.status === st;
                            let activeStyle = '';
                            if (st === 'Hadir') activeStyle = 'bg-emerald-800 text-white border-emerald-800';
                            if (st === 'Sakit') activeStyle = 'bg-amber-600 text-white border-amber-600';
                            if (st === 'Izin') activeStyle = 'bg-blue-700 text-white border-blue-700';
                            if (st === 'Alpa') activeStyle = 'bg-rose-700 text-white border-rose-700';

                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => handleStatusChange(student.id, st)}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded border transition-all ${
                                  isSelected
                                    ? activeStyle
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {st}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder={
                            entry.status === 'Hadir'
                              ? 'Catatan opsional...'
                              : 'Alasan izin/sakit (mis. Demam)...'
                          }
                          value={entry.notes}
                          onChange={(e) => handleNotesChange(student.id, e.target.value)}
                          className="w-full text-xs px-2.5 py-1 bg-white border border-slate-200 rounded focus:outline-emerald-600"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
