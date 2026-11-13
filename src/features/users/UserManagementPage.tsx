import React, { useEffect, useState } from 'react';
import {
  fetchUsersList,
  createUserWithRoles,
  bulkCreateUsersFromCSV,
  updateUserAndTeacher,
  deleteUser,
  getDemoUsers,
  UserListItem,
  CreateUserData,
} from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import { ROLE_CONFIGS } from '../../types/auth.types';
import { UserRole } from '../../types/database.types';
import { Modal } from '../../components/ui/Modal';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  KeyRound,
  GraduationCap,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  School,
  FileCheck,
} from 'lucide-react';

interface CSVPreviewRow {
  email: string;
  password: string;
  title_prefix: string;
  full_name: string;
  title_suffix: string;
  nip: string;
  nuptk: string;
  gender: 'L' | 'P';
  phone_number: string;
  specialization: string;
  roles: UserRole[];
  alreadyRegistered?: boolean;
  status: 'valid' | 'warning' | 'error';
  messages: string[];
}

export const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal Tambah User & Guru
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('AlIhsan2026!');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newTitlePrefix, setNewTitlePrefix] = useState('Ust.');
  const [newTitleSuffix, setNewTitleSuffix] = useState('S.Pd.I');
  const [newNip, setNewNip] = useState('');
  const [newNuptk, setNewNuptk] = useState('');
  const [newGender, setNewGender] = useState<'L' | 'P'>('L');
  const [newPhone, setNewPhone] = useState('');
  const [newSpecialization, setNewSpecialization] = useState('Guru Kelas & PAI');
  const [newRoles, setNewRoles] = useState<UserRole[]>(['guru']);
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Edit User & Guru
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editTitlePrefix, setEditTitlePrefix] = useState('');
  const [editTitleSuffix, setEditTitleSuffix] = useState('');
  const [editNip, setEditNip] = useState('');
  const [editNuptk, setEditNuptk] = useState('');
  const [editGender, setEditGender] = useState<'L' | 'P'>('L');
  const [editPhone, setEditPhone] = useState('');
  const [editSpecialization, setEditSpecialization] = useState('');
  const [editRoles, setEditRoles] = useState<UserRole[]>([]);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editError, setEditError] = useState<string | null>(null);

  // Modal Impor CSV
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<CSVPreviewRow[]>([]);
  const [updateExistingOnImport, setUpdateExistingOnImport] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Salin Password Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const userList = await fetchUsersList({ search: searchTerm, role: roleFilter, status: statusFilter });
      setUsers(userList);
    } catch (err: any) {
      console.warn('Recovering users list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchTerm, roleFilter, statusFilter]);

  useRealtimeSync(['simpel_users_cache_v2', 'simpel_teachers'], () => {
    void loadData();
  });

  const handleRoleToggle = (role: UserRole, target: 'new' | 'edit') => {
    if (target === 'new') {
      if (newRoles.includes(role)) {
        if (newRoles.length > 1) {
          setNewRoles(newRoles.filter((r) => r !== role));
        }
      } else {
        setNewRoles([...newRoles, role]);
      }
    } else {
      if (editRoles.includes(role)) {
        if (editRoles.length > 1) {
          setEditRoles(editRoles.filter((r) => r !== role));
        }
      } else {
        setEditRoles([...editRoles, role]);
      }
    }
  };

  // Unduh Template CSV Resmi Lengkap
  const downloadCSVTemplate = () => {
    const headers = [
      'Email_Username',
      'Kata_Sandi',
      'Gelar_Depan',
      'Nama_Lengkap',
      'Gelar_Belakang',
      'NIP',
      'NUPTK',
      'Jenis_Kelamin',
      'Nomor_Telepon',
      'Spesialisasi',
      'Roles',
    ];

    const sampleRows = [
      [
        'ahmad.fauzi@alihsan.sch.id',
        'AlIhsan2026!',
        'Ust.',
        'Ahmad Fauzi',
        'S.Pd.I',
        '198503122019031008',
        '4532763665200023',
        'L',
        '081234567890',
        'Guru Kelas 4 & PAI',
        'guru,wali_kelas',
      ],
      [
        'siti.nurhaliza@alihsan.sch.id',
        'AlIhsan2026!',
        'Usth.',
        'Siti Nurhaliza',
        'M.Pd.',
        '',
        '9876543210123456',
        'P',
        '085712345678',
        'Guru Matematika & IPAS',
        'guru',
      ],
      [
        'muin.kamad@alihsan.sch.id',
        'AlIhsan2026!',
        '',
        'MUIN',
        'S.Pd.I.',
        '197508152005011004',
        '1234567890123456',
        'L',
        '081234567899',
        'Kepala Madrasah & Akidah Akhlak',
        'kepala_madrasah',
      ],
      [
        'ridwan.pjok@alihsan.sch.id',
        'AlIhsan2026!',
        'Ust.',
        'Muhammad Ridwan',
        'S.Pd.',
        '',
        '',
        'L',
        '081398765432',
        'Guru PJOK & Kesehatan',
        'guru',
      ],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...sampleRows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'template_impor_akun_dan_guru_mi_alihsan.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Ekspor Seluruh Data Akun Lengkap ke CSV
  const exportUsersCSV = () => {
    if (users.length === 0) {
      setNotification({ type: 'error', message: 'Tidak ada data akun pengguna untuk diekspor.' });
      return;
    }

    const headers = [
      'Email_Username',
      'Kata_Sandi',
      'Gelar_Depan',
      'Nama_Lengkap',
      'Gelar_Belakang',
      'NIP',
      'NUPTK',
      'Jenis_Kelamin',
      'Nomor_Telepon',
      'Spesialisasi',
      'Roles',
      'Status_Akun',
      'ID_Guru_Tertaut',
      'Tanggal_Dibuat',
    ];

    const rows = users.map((u) => [
      u.email,
      u.password || 'AlIhsan2026!',
      u.title_prefix || '',
      u.full_name,
      u.title_suffix || '',
      u.nip || (u.teacher_info?.nip ? u.teacher_info.nip : ''),
      u.nuptk || '',
      u.gender || 'L',
      u.phone_number || '',
      u.specialization || (u.teacher_info?.specialization ? u.teacher_info.specialization : ''),
      u.roles.join(';'),
      u.is_active ? 'Aktif' : 'Nonaktif',
      u.teacher_info?.id || '',
      u.created_at,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell || ''}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `data_akun_dan_guru_mi_alihsan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parsing CSV Saat Admin Mengunggah File
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setImportSummary(null);
    setImportError(null);
    setCsvRows([]);

    const splitDelimitedLine = (line: string, delimiter: string): string[] => {
      const cells: string[] = [];
      let inQuotes = false;
      let currentCell = '';
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          if (inQuotes && line[c + 1] === '"') {
            currentCell += '"';
            c++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          cells.push(currentCell.trim());
          currentCell = '';
        } else {
          currentCell += char;
        }
      }
      cells.push(currentCell.trim());
      return cells;
    };

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawText = (event.target?.result as string) || '';
      const text = rawText.replace(/^\uFEFF/, '');
      if (!text.trim()) {
        setImportError('File CSV kosong. Silakan isi data guru/akun terlebih dahulu menggunakan Template CSV.');
        return;
      }

      const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        setImportError('File CSV hanya berisi baris header (judul kolom) dan belum memiliki baris data akun.');
        return;
      }

      // Auto-deteksi pemisah kolom (, dari Google Sheets / ; dari Excel Indonesia / Tab)
      const headerLine = lines[0];
      const commaCount = splitDelimitedLine(headerLine, ',').length;
      const semiCount = splitDelimitedLine(headerLine, ';').length;
      const tabCount = splitDelimitedLine(headerLine, '\t').length;
      const delimiter =
        semiCount > commaCount && semiCount >= tabCount
          ? ';'
          : tabCount > commaCount && tabCount > semiCount
            ? '\t'
            : ',';

      const rawHeaders = splitDelimitedLine(headerLine, delimiter).map((h) =>
        h.replace(/^["'\uFEFF]+|["']+$/g, '').trim().toLowerCase().replace(/\s+/g, '_')
      );

      const emailIdx = rawHeaders.findIndex((h) => h.includes('email') || h.includes('username'));
      const passIdx = rawHeaders.findIndex((h) => h.includes('sandi') || h.includes('password'));
      const prefixIdx = rawHeaders.findIndex((h) => h.includes('gelar_depan') || h.includes('depan'));
      const nameIdx = rawHeaders.findIndex(
        (h) => h === 'nama' || h.includes('nama_lengkap') || h.includes('full_name') || h.includes('nama')
      );
      const suffixIdx = rawHeaders.findIndex((h) => h.includes('gelar_belakang') || h.includes('belakang'));
      const nipIdx = rawHeaders.findIndex((h) => h === 'nip');
      const nuptkIdx = rawHeaders.findIndex((h) => h === 'nuptk');
      const jkIdx = rawHeaders.findIndex((h) => h === 'jk' || h.includes('kelamin') || h.includes('gender'));
      const phoneIdx = rawHeaders.findIndex((h) => h.includes('telepon') || h.includes('hp') || h.includes('wa'));
      const specIdx = rawHeaders.findIndex((h) => h.includes('spesialisasi') || h.includes('tugas') || h.includes('mapel'));
      const roleIdx = rawHeaders.findIndex((h) => h.includes('role') || h.includes('peran'));

      if (emailIdx === -1 || nameIdx === -1) {
        const missingCols: string[] = [];
        if (emailIdx === -1) missingCols.push('Email_Username (atau kolom Email)');
        if (nameIdx === -1) missingCols.push('Nama_Lengkap (atau kolom Nama)');
        setImportError(
          `Format header CSV tidak sesuai. Kolom wajib tidak ditemukan: ${missingCols.join(', ')}. Header terbaca: [${rawHeaders.join(', ')}]. Gunakan "Unduh Template CSV" sebagai acuan.`
        );
        return;
      }

      const existingEmailSet = new Set([
        ...users.map((u) => u.email.trim().toLowerCase()),
        ...getDemoUsers().map((u) => u.email.trim().toLowerCase()),
      ]);
      const seenCsvEmails = new Map<string, number>();
      const parsedList: CSVPreviewRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cells = splitDelimitedLine(lines[i], delimiter);

        const cleanCell = (idx: number) => {
          if (idx < 0 || idx >= cells.length) return '';
          return cells[idx].replace(/^["']|["']$/g, '').trim();
        };

        const email = cleanCell(emailIdx);
        const normalizedEmail = email.toLowerCase();
        const password = cleanCell(passIdx) || 'AlIhsan2026!';
        const title_prefix = cleanCell(prefixIdx);
        const full_name = cleanCell(nameIdx);
        const title_suffix = cleanCell(suffixIdx);
        const nip = cleanCell(nipIdx);
        const nuptk = cleanCell(nuptkIdx);
        const rawJk = cleanCell(jkIdx).toUpperCase();
        const gender: 'L' | 'P' = rawJk.startsWith('P') ? 'P' : 'L';
        const phone_number = cleanCell(phoneIdx);
        const specialization = cleanCell(specIdx) || 'Guru Pengampu';
        const rawRoles = cleanCell(roleIdx);

        // Parse roles
        const roles: UserRole[] = [];
        const roleTokens = rawRoles
          .toLowerCase()
          .split(/[,;|/]/)
          .map((r) => r.trim())
          .filter(Boolean);
        if (roleTokens.includes('admin') || roleTokens.includes('administrator')) roles.push('admin');
        if (roleTokens.includes('kepala_madrasah') || roleTokens.includes('kamad') || roleTokens.includes('kepala')) {
          roles.push('kepala_madrasah');
        }
        if (roleTokens.includes('wali_kelas') || roleTokens.includes('walikelas') || roleTokens.includes('wali')) {
          roles.push('wali_kelas');
        }
        if (roleTokens.includes('guru') || roles.length === 0) roles.push('guru');

        const messages: string[] = [];
        let status: 'valid' | 'warning' | 'error' = 'valid';
        let alreadyRegistered = false;

        if (!email) {
          status = 'error';
          messages.push('Kolom Email_Username kosong.');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          status = 'error';
          messages.push(`Format email "${email}" tidak valid (contoh: nama@alihsan.sch.id).`);
        } else if (seenCsvEmails.has(normalizedEmail)) {
          status = 'error';
          messages.push(`Email "${email}" ganda dengan baris ke-${seenCsvEmails.get(normalizedEmail)} di file CSV.`);
        } else {
          seenCsvEmails.set(normalizedEmail, i);
          if (existingEmailSet.has(normalizedEmail)) {
            alreadyRegistered = true;
            if (updateExistingOnImport) {
              status = 'warning';
              messages.push(`Email sudah terdaftar — akan diperbarui & disinkronkan ke Data Guru.`);
            } else {
              status = 'error';
              messages.push(`Email "${email}" sudah terdaftar di sistem.`);
            }
          }
        }

        if (!full_name) {
          status = 'error';
          messages.push('Kolom Nama_Lengkap kosong.');
        }

        if (password && password.length < 6) {
          status = 'error';
          messages.push('Kata sandi minimal 6 karakter.');
        }

        if (rawJk && !['L', 'P', 'LAKI-LAKI', 'PEREMPUAN'].includes(rawJk)) {
          if (status === 'valid') status = 'warning';
          messages.push(`Jenis kelamin "${rawJk}" tidak standar, otomatis diset L.`);
        }

        if (status === 'valid' && (roles.includes('guru') || roles.includes('wali_kelas'))) {
          messages.push('Siap masuk Akun & Data Guru.');
        }

        parsedList.push({
          email,
          password,
          title_prefix,
          full_name,
          title_suffix,
          nip,
          nuptk,
          gender,
          phone_number,
          specialization,
          roles,
          alreadyRegistered,
          status,
          messages,
        });
      }

      setCsvRows(parsedList);
    };
    reader.onerror = () => {
      setImportError('Gagal membaca berkas CSV. Pastikan file tidak sedang terkunci oleh Excel dan berformat .csv.');
    };
    reader.readAsText(file);
  };

  // Proses Eksekusi Impor Massal
  const handleExecuteImport = async () => {
    if (csvRows.length === 0) return;
    setIsImporting(true);
    setImportSummary(null);
    setImportError(null);

    const invalidPreviewErrors: string[] = [];
    const validRows: CSVPreviewRow[] = [];

    csvRows.forEach((r, idx) => {
      if (r.status === 'error') {
        invalidPreviewErrors.push(
          `Baris ${idx + 1} (${r.email || r.full_name || 'Tanpa Identitas'}): ${r.messages.join(' ')}`
        );
      } else {
        validRows.push(r);
      }
    });

    const payloadRows: CreateUserData[] = validRows.map((r) => ({
      email: r.email,
      password: r.password,
      full_name: r.full_name,
      title_prefix: r.title_prefix,
      title_suffix: r.title_suffix,
      nip: r.nip,
      nuptk: r.nuptk,
      gender: r.gender,
      phone_number: r.phone_number,
      specialization: r.specialization,
      roles: r.roles,
      auto_create_teacher: true,
    }));

    try {
      const result = await bulkCreateUsersFromCSV(payloadRows, currentUser?.id || 'admin', {
        updateExisting: updateExistingOnImport,
      });
      const allErrors = [...invalidPreviewErrors, ...result.errors];

      setImportSummary({
        total: csvRows.length,
        success: result.success,
        failed: result.failed + invalidPreviewErrors.length,
        errors: allErrors,
      });

      if (result.success > 0) {
        setNotification({
          type: 'success',
          message: `Berhasil mengimpor ${result.success} akun pengguna & data guru secara otomatis!`,
        });
        await loadData();
      } else if (allErrors.length > 0) {
        setImportError('Impor tidak dapat memproses akun. Periksa detail kesalahan tiap baris di bawah.');
      }
    } catch (err: any) {
      setImportError(`Gagal memproses impor: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Simpan Pembuatan Akun Baru (Manual Form)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setIsSubmitting(true);
    try {
      await createUserWithRoles(
        {
          email: newEmail,
          password: newPassword,
          full_name: newFullName,
          title_prefix: newTitlePrefix,
          title_suffix: newTitleSuffix,
          nip: newNip,
          nuptk: newNuptk,
          gender: newGender,
          phone_number: newPhone,
          specialization: newSpecialization,
          roles: newRoles,
          auto_create_teacher: true,
        },
        currentUser?.id || 'admin'
      );

      setIsAddModalOpen(false);
      setNotification({
        type: 'success',
        message: `Akun ${newFullName} berhasil didaftarkan dan otomatis tersinkron ke Data Guru!`,
      });

      // Reset form
      setNewEmail('');
      setNewPassword('AlIhsan2026!');
      setNewFullName('');
      setNewTitlePrefix('Ust.');
      setNewTitleSuffix('S.Pd.I');
      setNewNip('');
      setNewNuptk('');
      setNewGender('L');
      setNewPhone('');
      setNewSpecialization('Guru Kelas & PAI');
      setNewRoles(['guru']);

      await loadData();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Simpan Perubahan Akun & Guru
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    setEditError(null);
    setIsSubmitting(true);
    try {
      await updateUserAndTeacher(editingUserId, {
        email: editEmail,
        password: editPassword,
        full_name: editFullName,
        title_prefix: editTitlePrefix,
        title_suffix: editTitleSuffix,
        nip: editNip,
        nuptk: editNuptk,
        gender: editGender,
        phone_number: editPhone,
        specialization: editSpecialization,
        roles: editRoles,
        is_active: editIsActive,
      });

      setIsEditModalOpen(false);
      setNotification({
        type: 'success',
        message: `Data akun dan guru ${editFullName} berhasil diperbarui!`,
      });
      await loadData();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hapus Akun
  const handleDeleteUser = async (userId: string, name: string, email?: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus akun ${name}? Data guru yang tertaut juga akan dihapus.`)) {
      try {
        await deleteUser(userId, email);
        setNotification({
          type: 'success',
          message: `Akun ${name} berhasil dihapus.`,
        });
        await loadData();
      } catch (err: any) {
        setNotification({
          type: 'error',
          message: err.message,
        });
      }
    }
  };

  const copyPasswordToClipboard = (password: string, id: string) => {
    navigator.clipboard.writeText(password);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openEditModal = (item: UserListItem) => {
    setEditingUserId(item.id);
    setEditEmail(item.email);
    setEditPassword(item.password || 'AlIhsan2026!');
    setEditFullName(item.full_name);
    setEditTitlePrefix(item.title_prefix || '');
    setEditTitleSuffix(item.title_suffix || '');
    setEditNip(item.nip || (item.teacher_info?.nip ? item.teacher_info.nip : ''));
    setEditNuptk(item.nuptk || '');
    setEditGender(item.gender || 'L');
    setEditPhone(item.phone_number || '');
    setEditSpecialization(item.specialization || (item.teacher_info?.specialization ? item.teacher_info.specialization : ''));
    setEditRoles([...item.roles]);
    setEditIsActive(item.is_active);
    setEditError(null);
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 font-bold px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Manajemen Akun & Data Guru
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
              Sinkronisasi Otomatis
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Data akun login pengguna otomatis terintegrasi langsung sebagai data Tenaga Pendidik (Guru) madrasah.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Unduh Template CSV */}
          <button
            onClick={downloadCSVTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            title="Unduh format file CSV untuk pendaftaran akun massal"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Unduh Template CSV</span>
          </button>

          {/* Impor CSV */}
          <button
            onClick={() => {
              setCsvFile(null);
              setCsvRows([]);
              setImportError(null);
              setImportSummary(null);
              setIsImportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100/70 transition-colors shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-700" />
            <span>Impor CSV Akun</span>
          </button>

          {/* Ekspor CSV */}
          <button
            onClick={exportUsersCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            title="Ekspor seluruh akun dan kredensial ke CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ekspor CSV Lengkap</span>
          </button>

          {/* Tambah Akun Manual */}
          <button
            onClick={() => {
              setAddError(null);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Akun & Guru</span>
          </button>
        </div>
      </div>

      {/* Banner Informasi Sinkronisasi */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-900 to-emerald-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-700/60 border border-emerald-600 shrink-0">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">Satu Data Terpadu Akun & Guru</p>
            <p className="text-[11px] text-emerald-200">
              Setiap kali Anda menambahkan akun dengan peran Guru, Wali Kelas, atau Kepala Madrasah, profilnya langsung masuk ke menu <strong>Data Guru</strong> dan siap diberi penugasan mengajar atau rombel.
            </p>
          </div>
        </div>
        <div className="text-[11px] font-mono bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-700/60 text-emerald-100 self-start sm:self-auto shrink-0">
          Total Akun: <span className="font-bold text-amber-300">{users.length}</span> Pengguna
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari berdasarkan nama, email, NIP, atau spesialisasi..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="">Semua Peran</option>
            <option value="admin">Administrator</option>
            <option value="kepala_madrasah">Kepala Madrasah</option>
            <option value="guru">Guru Pengampu</option>
            <option value="wali_kelas">Wali Kelas</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>

          <button
            onClick={loadData}
            title="Muat Ulang"
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabel Pengguna & Guru */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3">Nama & Kredensial Login</th>
                <th className="px-4 py-3">Kata Sandi</th>
                <th className="px-4 py-3">Peran (Roles)</th>
                <th className="px-4 py-3">Data Guru & Spesialisasi</th>
                <th className="px-4 py-3">Status Akun</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Memuat data akun pengguna...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Tidak ditemukan data pengguna yang cocok. Silakan klik "Tambah Akun & Guru" atau impor dari CSV.
                  </td>
                </tr>
              ) : (
                users.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Nama & Email */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0">
                          {item.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.title_prefix ? `${item.title_prefix} ` : ''}
                            {item.full_name}
                            {item.title_suffix ? `, ${item.title_suffix}` : ''}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">{item.email}</p>
                          {item.phone_number && (
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">WA: {item.phone_number}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Kata Sandi */}
                    <td className="px-4 py-3.5">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md font-mono text-[11px] text-slate-700">
                        <span>{item.password || 'AlIhsan2026!'}</span>
                        <button
                          type="button"
                          onClick={() => copyPasswordToClipboard(item.password || 'AlIhsan2026!', item.id)}
                          title="Salin Kata Sandi"
                          className="text-slate-400 hover:text-emerald-700 transition-colors ml-1"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Peran / Roles */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {item.roles.map((r) => {
                          const cfg = ROLE_CONFIGS[r];
                          return (
                            <span
                              key={r}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg?.badgeColor || 'bg-slate-100 text-slate-700'}`}
                            >
                              {cfg?.label || r}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Data Guru */}
                    <td className="px-4 py-3.5">
                      {item.teacher_info || item.specialization || item.roles.some((r) => ['guru', 'wali_kelas', 'kepala_madrasah'].includes(r)) ? (
                        <div>
                          <span className="font-semibold text-emerald-800 flex items-center gap-1">
                            <GraduationCap className="w-3.5 h-3.5 text-emerald-700" />
                            <span>{item.specialization || item.teacher_info?.specialization || 'Tenaga Pendidik Aktif'}</span>
                          </span>
                          <p className="text-[10px] text-slate-500 font-mono">
                            NIP: {item.nip || item.teacher_info?.nip || 'Non-PNS'}
                            {item.nuptk ? ` · NUPTK: ${item.nuptk}` : ''}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Akun Pengelola / Admin</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      {item.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Aktif</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                          <span>Nonaktif</span>
                        </span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(item)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 rounded-md border border-emerald-200 transition-colors flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Ubah</span>
                        </button>
                        {item.email.toLowerCase() !== 'alihsansoborejo@gmail.com' && (
                          <button
                            onClick={() => handleDeleteUser(item.id, item.full_name, item.email)}
                            className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md border border-slate-200 transition-colors"
                            title="Hapus Akun Pengguna"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Pengguna & Guru Baru */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Pendaftaran Akun Pengguna & Data Guru"
        subtitle="Data yang dimasukkan akan otomatis tersimpan sebagai akun login dan profil Tenaga Pendidik (Guru)"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {addError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          {/* Section 1: Akun & Kredensial Login */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
              <span>1. Kredensial Akun Login</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Email / Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nama@alihsan.sch.id"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kata Sandi (Password) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="AlIhsan2026!"
                    className="w-full px-3 py-2 pr-8 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor WhatsApp / HP</label>
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Section 2: Data Tenaga Pendidik (Guru) */}
          <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                <GraduationCap className="w-4 h-4 text-emerald-700" />
                <span>2. Profil Tenaga Pendidik (Otomatis Masuk Data Guru)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-700 text-white font-semibold">Tersinkron</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gelar Depan</label>
                <input
                  type="text"
                  value={newTitlePrefix}
                  onChange={(e) => setNewTitlePrefix(e.target.value)}
                  placeholder="Ust."
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Ahmad Fauzi"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gelar Blkg</label>
                <input
                  type="text"
                  value={newTitleSuffix}
                  onChange={(e) => setNewTitleSuffix(e.target.value)}
                  placeholder="S.Pd.I"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">NIP (Jika Ada)</label>
                <input
                  type="text"
                  value={newNip}
                  onChange={(e) => setNewNip(e.target.value)}
                  placeholder="1985..."
                  className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">NUPTK</label>
                <input
                  type="text"
                  value={newNuptk}
                  onChange={(e) => setNewNuptk(e.target.value)}
                  placeholder="4532..."
                  className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                <select
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value as 'L' | 'P')}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Spesialisasi / Tugas Pengampu
              </label>
              <input
                type="text"
                value={newSpecialization}
                onChange={(e) => setNewSpecialization(e.target.value)}
                placeholder="Contoh: Guru Kelas 4 & PAI, Guru PJOK, dll"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Section 3: Penetapan Hak Akses / Roles */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              3. Penetapan Hak Akses Pengguna (Bisa Memilih Lebih dari Satu)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['admin', 'kepala_madrasah', 'guru', 'wali_kelas'] as UserRole[]).map((r) => {
                const cfg = ROLE_CONFIGS[r];
                const isChecked = newRoles.includes(r);
                return (
                  <label
                    key={r}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'border-emerald-600 bg-emerald-50/70'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleRoleToggle(r, 'new')}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">{cfg.label}</p>
                      <p className="text-[10px] text-slate-500">{cfg.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg disabled:opacity-50 shadow-xs"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Akun & Daftarkan Guru'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Hak Akses, Akun, & Guru */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Ubah Data Akun & Guru"
        subtitle={`Pengguna: ${editFullName} (${editEmail})`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {editError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          {/* Status Akun */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Status Akun</label>
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="editStatus"
                  checked={editIsActive}
                  onChange={() => setEditIsActive(true)}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-medium text-slate-800">Aktif (Dapat Masuk)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="editStatus"
                  checked={!editIsActive}
                  onChange={() => setEditIsActive(false)}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span className="font-medium text-slate-800">Nonaktif (Dibekukan)</span>
              </label>
            </div>
          </div>

          {/* Email & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email / Username</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kata Sandi</label>
              <div className="relative">
                <input
                  type={showEditPassword ? 'text' : 'password'}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-8 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Data Nama & Gelar Guru */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gelar Depan</label>
              <input
                type="text"
                value={editTitlePrefix}
                onChange={(e) => setEditTitlePrefix(e.target.value)}
                placeholder="Ust."
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Lengkap</label>
              <input
                type="text"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gelar Belakang</label>
              <input
                type="text"
                value={editTitleSuffix}
                onChange={(e) => setEditTitleSuffix(e.target.value)}
                placeholder="S.Pd.I"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* NIP, NUPTK, JK */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">NIP</label>
              <input
                type="text"
                value={editNip}
                onChange={(e) => setEditNip(e.target.value)}
                placeholder="1985..."
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">NUPTK</label>
              <input
                type="text"
                value={editNuptk}
                onChange={(e) => setEditNuptk(e.target.value)}
                placeholder="4532..."
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
              <select
                value={editGender}
                onChange={(e) => setEditGender(e.target.value as 'L' | 'P')}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-600"
              >
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nomor WhatsApp / HP</label>
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Spesialisasi / Tugas Pengampu</label>
              <input
                type="text"
                value={editSpecialization}
                onChange={(e) => setEditSpecialization(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Roles */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Penetapan Peran (Multi-Peran)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['admin', 'kepala_madrasah', 'guru', 'wali_kelas'] as UserRole[]).map((r) => {
                const cfg = ROLE_CONFIGS[r];
                const isChecked = editRoles.includes(r);
                return (
                  <label
                    key={r}
                    className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isChecked ? 'border-emerald-600 bg-emerald-50/70' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleRoleToggle(r, 'edit')}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">{cfg.label}</p>
                      <p className="text-[10px] text-slate-500">{cfg.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg disabled:opacity-50 shadow-xs"
            >
              {isSubmitting ? 'Menyimpan...' : 'Perbarui Akun & Data Guru'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Impor CSV Akun & Guru Massal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Impor Massal Akun Pengguna & Data Guru"
        subtitle="Unggah file CSV dengan format lengkap untuk mendaftarkan akun sekaligus guru secara instan"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-amber-700" />
              <span>Petunjuk Impor Format Lengkap:</span>
            </p>
            <p className="text-[11px] text-amber-800">
              Gunakan file CSV dengan kolom header: <code>Email_Username, Kata_Sandi, Gelar_Depan, Nama_Lengkap, Gelar_Belakang, NIP, NUPTK, Jenis_Kelamin, Nomor_Telepon, Spesialisasi, Roles</code>.
            </p>
            <button
              type="button"
              onClick={downloadCSVTemplate}
              className="text-[11px] font-bold text-emerald-800 underline hover:text-emerald-950 mt-1"
            >
              Unduh Template CSV Contoh Disini
            </button>
          </div>

          {/* Upload Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pilih Berkas CSV (Mendukung pemisah koma <code>,</code> maupun titik koma <code>;</code> dari Excel)
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleCSVUpload}
              className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-800 file:text-white hover:file:bg-emerald-900 cursor-pointer border border-slate-300 rounded-lg p-1 bg-white"
            />
          </div>

          {/* Opsi Penanganan Email Sudah Terdaftar */}
          <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs cursor-pointer hover:bg-slate-100/70 transition-colors">
            <input
              type="checkbox"
              checked={updateExistingOnImport}
              onChange={(e) => {
                const next = e.target.checked;
                setUpdateExistingOnImport(next);
                setCsvRows((prev) =>
                  prev.map((row) => {
                    if (!row.alreadyRegistered) return row;
                    const filteredMsgs = row.messages.filter(
                      (m) => !m.includes('sudah terdaftar')
                    );
                    if (next) {
                      const hasOtherError =
                        !row.full_name ||
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) ||
                        (row.password && row.password.length < 6);
                      return {
                        ...row,
                        status: hasOtherError ? 'error' : 'warning',
                        messages: [
                          'Email sudah terdaftar — akan diperbarui & disinkronkan ke Data Guru.',
                          ...filteredMsgs,
                        ],
                      };
                    }
                    return {
                      ...row,
                      status: 'error',
                      messages: [`Email "${row.email}" sudah terdaftar di sistem.`, ...filteredMsgs],
                    };
                  })
                );
              }}
              className="mt-0.5 rounded text-emerald-700 focus:ring-emerald-600"
            />
            <div>
              <span className="font-semibold text-slate-800 block">
                Perbarui data akun & guru jika email sudah terdaftar
              </span>
              <span className="text-[11px] text-slate-500">
                Jika dicentang, email yang sudah ada di sistem akan diperbarui datanya dan ditautkan ke Data Guru tanpa gagal duplikat.
              </span>
            </div>
          </label>

          {importError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{importError}</span>
            </div>
          )}

          {/* Pratinjau Baris */}
          {csvRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-800">Pratinjau Data ({csvRows.length} Baris):</span>
                <div className="flex items-center gap-3 text-[11px] font-semibold">
                  <span className="text-emerald-700">
                    {csvRows.filter((r) => r.status !== 'error').length} baris siap impor
                  </span>
                  {csvRows.some((r) => r.status === 'error') && (
                    <span className="text-rose-700">
                      {csvRows.filter((r) => r.status === 'error').length} baris perlu diperbaiki
                    </span>
                  )}
                </div>
              </div>

              {csvRows.some((r) => r.status === 'error') && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800 space-y-1">
                  <p className="font-bold">Daftar Baris yang Harus Diperbaiki Sebelum Impor:</p>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-28 overflow-y-auto">
                    {csvRows.map((row, idx) =>
                      row.status === 'error' ? (
                        <li key={idx}>
                          <span className="font-semibold">Baris {idx + 1}</span>
                          {row.email ? ` (${row.email})` : row.full_name ? ` (${row.full_name})` : ''}:{' '}
                          {row.messages.join(' ')}
                        </li>
                      ) : null
                    )}
                  </ul>
                </div>
              )}

              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2">No</th>
                      <th className="p-2">Email</th>
                      <th className="p-2">Nama & Gelar</th>
                      <th className="p-2">Peran</th>
                      <th className="p-2">Status & Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvRows.map((row, idx) => (
                      <tr key={idx} className={row.status === 'error' ? 'bg-rose-50/70' : 'hover:bg-slate-50'}>
                        <td className="p-2 font-mono align-top">{idx + 1}</td>
                        <td className="p-2 font-mono truncate max-w-[140px] align-top">{row.email || '-'}</td>
                        <td className="p-2 font-semibold align-top">
                          {row.title_prefix ? `${row.title_prefix} ` : ''}
                          {row.full_name || '-'}
                          {row.title_suffix ? `, ${row.title_suffix}` : ''}
                        </td>
                        <td className="p-2 align-top">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold text-[10px] border border-emerald-200">
                            {row.roles.join(', ')}
                          </span>
                        </td>
                        <td className="p-2 align-top">
                          {row.status === 'error' ? (
                            <div className="text-rose-700 font-medium leading-snug">
                              <span className="font-bold">Perlu Diperbaiki:</span> {row.messages.join(' ')}
                            </div>
                          ) : row.status === 'warning' ? (
                            <div className="text-amber-700 font-medium leading-snug">
                              {row.messages.join(' ')}
                            </div>
                          ) : (
                            <span className="text-emerald-700 font-bold">Siap</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Summary */}
          {importSummary && (
            <div
              className={`p-3 border rounded-xl text-xs space-y-2 ${
                importSummary.failed > 0 && importSummary.success === 0
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : importSummary.failed > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <p className="font-bold">Laporan Hasil Impor:</p>
              <p>
                Berhasil: <span className="font-bold">{importSummary.success}</span> dari {importSummary.total} akun.
                {importSummary.failed > 0 && (
                  <span className="text-rose-700 font-bold ml-2">Gagal: {importSummary.failed} baris.</span>
                )}
              </p>
              {importSummary.errors.length > 0 && (
                <div className="pt-1 border-t border-black/10 space-y-1">
                  <p className="font-semibold text-[11px]">Keterangan baris yang harus diperbaiki:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] max-h-32 overflow-y-auto">
                    {importSummary.errors.map((errMsg, idx) => (
                      <li key={idx}>{errMsg}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isImporting || csvRows.length === 0 || csvRows.filter((r) => r.status !== 'error').length === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg disabled:opacity-50 shadow-xs flex items-center gap-1.5"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses Impor...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Proses Impor ({csvRows.filter((r) => r.status !== 'error').length} Akun)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
