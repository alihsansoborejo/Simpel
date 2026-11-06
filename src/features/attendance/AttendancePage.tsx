import React, { useState, useEffect } from 'react';
import { attendanceService } from '../../services/attendanceService';
import { academicService } from '../../services/academicService';
import { Student, ClassRoom, AttendanceStatus } from '../../types/database.types';
import { useAuth } from '../../context/AuthContext';
import {
  CalendarCheck,
  CheckCircle,
  Save,
  Check,
  Calendar,
  Users,
  AlertCircle,
  Info,
} from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('cls-4');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Map of studentId -> { status: AttendanceStatus, notes: string }
  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, { status: AttendanceStatus; notes: string }>
  >({});

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clss, stds] = await Promise.all([
        academicService.getClasses(),
        academicService.getStudents(),
      ]);
      setClasses(clss);
      setStudents(stds);

      // Load existing attendance for this class and date
      const existing = await attendanceService.getAttendance({
        classId: selectedClassId,
        date: selectedDate,
      });

      const initialMap: Record<string, { status: AttendanceStatus; notes: string }> = {};
      stds.forEach((s) => {
        const found = existing.find((e) => e.student_id === s.id);
        initialMap[s.id] = {
          status: found ? found.status : 'Hadir',
          notes: found?.notes || '',
        };
      });
      setAttendanceMap(initialMap);
    } catch (err) {
      console.error('Gagal memuat presensi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClassId, selectedDate]);

  const handleMarkAllPresent = () => {
    const updated: Record<string, { status: AttendanceStatus; notes: string }> = {};
    students.forEach((s) => {
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
      const payload = students.map((s) => ({
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
      setStatusMessage(`Presensi tanggal ${selectedDate} berhasil disimpan ke database.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('Gagal menyimpan presensi:', err);
      setStatusMessage('Terjadi kesalahan saat menyimpan presensi.');
    } finally {
      setIsSaving(false);
    }
  };

  // Hitung statistik hari ini
  const total = students.length;
  const hadirCount = Object.values(attendanceMap).filter((v) => v.status === 'Hadir').length;
  const sakitCount = Object.values(attendanceMap).filter((v) => v.status === 'Sakit').length;
  const izinCount = Object.values(attendanceMap).filter((v) => v.status === 'Izin').length;
  const alpaCount = Object.values(attendanceMap).filter((v) => v.status === 'Alpa').length;
  const hadirPercentage = total > 0 ? Math.round((hadirCount / total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Presensi Kehadiran Siswa</h1>
          <p className="text-xs text-slate-500 mt-1">
            Pencatatan langsung kehadiran harian peserta didik dengan rekap persentase otomatis.
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Filter Rombel & Tanggal */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Rombel:</span>
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
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Tidak ada siswa terdaftar pada rombel ini.
                  </td>
                </tr>
              ) : (
                students.map((student, idx) => {
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
