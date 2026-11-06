import React, { useEffect, useState } from 'react';
import {
  fetchUsersList,
  fetchTeachersWithoutAccount,
  createUserWithRoles,
  updateUserRolesAndStatus,
  UserListItem,
} from '../../services/userService';
import { useAuth } from '../../context/AuthContext';
import { ROLE_CONFIGS } from '../../types/auth.types';
import { UserRole, Teacher } from '../../types/database.types';
import { Modal } from '../../components/ui/Modal';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  MoreVertical,
  KeyRound,
  GraduationCap,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [teachersWithoutAccount, setTeachersWithoutAccount] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal Tambah User
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRoles, setNewRoles] = useState<UserRole[]>(['guru']);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Edit User
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [editRoles, setEditRoles] = useState<UserRole[]>([]);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editError, setEditError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [userList, teachers] = await Promise.all([
        fetchUsersList({ search: searchTerm, role: roleFilter, status: statusFilter }),
        fetchTeachersWithoutAccount(),
      ]);
      setUsers(userList);
      setTeachersWithoutAccount(teachers);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchTerm, roleFilter, statusFilter]);

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setIsSubmitting(true);
    try {
      await createUserWithRoles(
        {
          email: newEmail,
          full_name: newFullName,
          phone_number: newPhone,
          roles: newRoles,
          teacher_id: selectedTeacherId || undefined,
        },
        currentUser?.id || 'admin'
      );
      setIsAddModalOpen(false);
      // Reset form
      setNewEmail('');
      setNewFullName('');
      setNewPhone('');
      setNewRoles(['guru']);
      setSelectedTeacherId('');
      await loadData();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setIsSubmitting(true);
    try {
      await updateUserRolesAndStatus(editingUser.id, editRoles, editIsActive);
      setIsEditModalOpen(false);
      await loadData();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Manajemen Akun & Hak Akses Pengguna
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan otorisasi akun madrasah, multi-peran dewan guru, dan status akses
          </p>
        </div>

        <button
          onClick={() => {
            setAddError(null);
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Akun Baru</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari berdasarkan nama atau alamat email..."
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

      {/* Tabel Pengguna */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3">Nama Pengguna & Email</th>
                <th className="px-4 py-3">Penugasan Peran (Roles)</th>
                <th className="px-4 py-3">Keterkaitan Data Guru</th>
                <th className="px-4 py-3">Status Akun</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    Memuat data akun pengguna...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    Tidak ditemukan data pengguna yang cocok.
                  </td>
                </tr>
              ) : (
                users.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                          {item.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{item.full_name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{item.email}</p>
                        </div>
                      </div>
                    </td>

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

                    <td className="px-4 py-3.5">
                      {item.teacher_info ? (
                        <div>
                          <span className="font-medium text-slate-800 flex items-center gap-1">
                            <GraduationCap className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Terhubung</span>
                          </span>
                          <p className="text-[10px] text-slate-500">
                            NIP: {item.teacher_info.nip || '-'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Tidak Terhubung</span>
                      )}
                    </td>

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

                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => {
                          setEditingUser(item);
                          setEditRoles([...item.roles]);
                          setEditIsActive(item.is_active);
                          setEditError(null);
                          setIsEditModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 rounded-md border border-emerald-200 transition-colors"
                      >
                        Kelola Hak
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Pengguna Baru */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Pendaftaran Akun Pengguna Baru"
        subtitle="Hanya Administrator yang berwenang mendaftarkan pengguna baru"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {addError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap</label>
            <input
              type="text"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder="Contoh: Ust. Ahmad Fauzi, S.Pd.I"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Email Akun</label>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor WhatsApp / HP</label>
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="081234567890"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Hubungkan ke Profil Guru (Opsional)
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">-- Bukan Akun Guru / Buat Baru Nanti --</option>
              {teachersWithoutAccount.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} (NIP: {t.nip || 'Non-NIP'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Penetapan Peran (Bisa Memilih Lebih dari Satu)
            </label>
            <div className="space-y-2">
              {(['admin', 'kepala_madrasah', 'guru', 'wali_kelas'] as UserRole[]).map((r) => {
                const cfg = ROLE_CONFIGS[r];
                const isChecked = newRoles.includes(r);
                return (
                  <label
                    key={r}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'border-emerald-600 bg-emerald-50/50'
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
                      <p className="text-[11px] text-slate-500">{cfg.description}</p>
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
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg disabled:opacity-50"
            >
              {isSubmitting ? 'Mendaftarkan...' : 'Simpan Akun Pengguna'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Hak Akses & Status */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Ubah Peran & Status Pengguna"
        subtitle={`Pengguna: ${editingUser?.full_name} (${editingUser?.email})`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {editError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Status Akun</label>
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={editIsActive}
                  onChange={() => setEditIsActive(true)}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-medium text-slate-800">Aktif (Dapat Masuk)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={!editIsActive}
                  onChange={() => setEditIsActive(false)}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span className="font-medium text-slate-800">Nonaktif (Dibekukan)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Penetapan Multi-Peran
            </label>
            <div className="space-y-2">
              {(['admin', 'kepala_madrasah', 'guru', 'wali_kelas'] as UserRole[]).map((r) => {
                const cfg = ROLE_CONFIGS[r];
                const isChecked = editRoles.includes(r);
                return (
                  <label
                    key={r}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'border-emerald-600 bg-emerald-50/50'
                        : 'border-slate-200 hover:bg-slate-50'
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
                      <p className="text-[11px] text-slate-500">{cfg.description}</p>
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
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Perbarui Hak Akses'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
