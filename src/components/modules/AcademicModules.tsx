import React, { useEffect, useState } from 'react';
import { CalendarClock, Eye, Pencil, Plus, Printer, Trash2, TrendingUp, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { apiRequest, downloadAuthenticatedFile } from '../../utils/api';
import { formatCurrency } from '../../utils/eduLogic';
import { useFeedback } from '../ui/ToastAndConfirm';
import { DataTable } from '../ui/DataTable';
import { FileUploader } from '../ui/FileUploader';
import { UserAvatar } from '../ui/UserAvatar';

// ─── STUDENTS MANAGEMENT MODULE ──────────────────────────────────────────────
export const StudentsModule: React.FC = () => {
  const { t, tStatus, translateServerError } = useI18n();
  const { toast } = useFeedback();
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    father_name: '',
    username: '',
    email: '',
    phone: '',
    gender: 'male',
    date_of_birth: '',
    guardian_name: '',
    guardian_phone: '',
    address: '',
    photo_url: '',
    class_id: '',
    password: 'Student@2026',
  });

  const load = async () => {
    try {
      const [sRes, cRes] = await Promise.all([
        apiRequest<{ students: any[] }>('/api/academics/students'),
        apiRequest<{ classes: any[] }>('/api/academics/classes'),
      ]);
      setStudents(sRes.students || []);
      setClasses(cRes.classes || []);
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/academics/students', {
        method: 'POST',
        body: JSON.stringify({ ...form, class_id: form.class_id ? Number(form.class_id) : null }),
      });
      toast(t('studentRegisteredMsg'));
      setShowModal(false);
      setForm({
        first_name: '', last_name: '', father_name: '', username: '', email: '', phone: '',
        gender: 'male', date_of_birth: '', guardian_name: '', guardian_phone: '', address: '', photo_url: '', class_id: '', password: 'Student@2026',
      });
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const openProfile = async (id: number) => {
    try {
      const res = await apiRequest(`/api/academics/students/${id}/profile`);
      setProfileData(res);
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const openEdit = (s: any) => {
    setEditStudent({
      id: s.id,
      first_name: s.first_name || '',
      last_name: s.last_name || '',
      father_name: s.father_name || '',
      gender: s.gender || 'male',
      date_of_birth: s.date_of_birth || '',
      national_id: s.national_id || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      guardian_name: s.guardian_name || '',
      guardian_phone: s.guardian_phone || '',
      guardian_relation: s.guardian_relation || '',
      status: s.status || 'active',
      notes: s.notes || '',
      photo_url: s.photo_url || '',
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent) return;
    try {
      await apiRequest(`/api/academics/students/${editStudent.id}`, {
        method: 'PUT',
        body: JSON.stringify(editStudent),
      });
      toast(t('studentUpdatedMsg'));
      const updatedId = editStudent.id;
      setEditStudent(null);
      await load();
      if (profileData?.student?.id === updatedId) {
        void openProfile(updatedId);
      }
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const toggleStatus = async (s: any) => {
    try {
      const next = s.status === 'active' ? 'suspended' : 'active';
      await apiRequest(`/api/academics/students/${s.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
      });
      toast(t('successSaved'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <h2 className="font-display text-lg font-bold text-slate-950">{t('menuStudents')}</h2>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t('registerStudent')}</span>
        </button>
      </div>

      <DataTable
        rows={students}
        onExportExcel={() => void downloadAuthenticatedFile('/api/comms/reports/student_enrollment/excel', 'student_enrollment.xlsx').catch(() => {})}
        onPrint={() => window.print()}
        columns={[
          { key: 'student_code', header: t('idCode'), sortValue: (r) => r.student_code, render: (r) => <span className="font-mono font-semibold text-slate-900">{r.student_code}</span> },
          {
            key: 'name',
            header: t('fullName'),
            sortValue: (r) => `${r.first_name} ${r.last_name}`,
            render: (r) => (
              <div className="flex items-center gap-2.5">
                <UserAvatar photoUrl={r.photo_url} name={`${r.first_name} ${r.last_name}`} sizeClass="w-9 h-9" />
                <div>
                  <div className="font-semibold text-slate-950">{r.first_name} {r.last_name}</div>
                  <div className="text-xs text-slate-500">{r.email}</div>
                </div>
              </div>
            ),
          },
          { key: 'class', header: t('classCourse'), render: (r) => <span>{r.current_class || t('unassigned')}</span> },
          { key: 'phone', header: t('phone'), render: (r) => <span className="tabular-nums" dir="ltr">{r.phone}</span> },
          {
            key: 'balance',
            header: t('balanceDue'),
            align: 'end',
            sortValue: (r) => Number(r.balance_due || 0),
            render: (r) => <span className="font-mono text-slate-900" dir="ltr">{formatCurrency(r.balance_due || 0)}</span>,
          },
          {
            key: 'status',
            header: t('status'),
            render: (r) => (
              <button
                type="button"
                onClick={() => void toggleStatus(r)}
                className={`text-xs font-semibold ${r.status === 'active' ? 'text-emerald-700' : 'text-amber-700'}`}
              >
                {tStatus(r.status)}
              </button>
            ),
          },
          {
            key: 'actions',
            header: t('actions'),
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void openProfile(r.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{t('viewDetailsBtn')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{t('edit')}</span>
                </button>
              </div>
            ),
          },
        ]}
      />

      {/* Register Student Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleCreate} className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display font-bold text-lg text-slate-950">{t('registerNewStudent')}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('firstName')} *</label>
                <input type="text" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('lastName')} *</label>
                <input type="text" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('username')} *</label>
                <input type="text" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('email')} *</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('fatherName')}</label>
                <input type="text" value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('phone')}</label>
                <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('guardianName')}</label>
                <input type="text" value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('guardianPhone')}</label>
                <input type="text" value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('assignClassHint')}</label>
                <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  <option value="">{t('noneEnrollLater')}</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.course_title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('initialPassword')}</label>
                <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" required />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <UserAvatar photoUrl={form.photo_url} name={`${form.first_name} ${form.last_name}` || 'S'} sizeClass="w-14 h-14" />
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <FileUploader imageOnly label={t('uploadStudentPhoto')} onUploaded={(m) => setForm({ ...form, photo_url: m.url })} />
                {form.photo_url && (
                  <button type="button" onClick={() => setForm({ ...form, photo_url: '' })} className="text-xs text-red-600 hover:underline">
                    {t('removePhotoBtn')}
                  </button>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">{t('cancel')}</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800">{t('save')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Student Modal */}
      {editStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleUpdate} className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display font-bold text-lg text-slate-950">{t('editStudentTitle')}</h3>
              <button type="button" onClick={() => setEditStudent(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <UserAvatar photoUrl={editStudent.photo_url} name={`${editStudent.first_name} ${editStudent.last_name}`} sizeClass="w-16 h-16" textClass="text-base" />
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <FileUploader imageOnly label={t('uploadStudentPhoto')} onUploaded={(m) => setEditStudent({ ...editStudent, photo_url: m.url })} />
                {editStudent.photo_url && (
                  <button type="button" onClick={() => setEditStudent({ ...editStudent, photo_url: '' })} className="text-xs font-medium text-red-600 hover:underline">
                    {t('removePhotoBtn')}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('firstName')} *</label>
                <input type="text" required value={editStudent.first_name} onChange={(e) => setEditStudent({ ...editStudent, first_name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('lastName')} *</label>
                <input type="text" required value={editStudent.last_name} onChange={(e) => setEditStudent({ ...editStudent, last_name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('fatherName')}</label>
                <input type="text" value={editStudent.father_name} onChange={(e) => setEditStudent({ ...editStudent, father_name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('studentStatusLabel')}</label>
                <select value={editStudent.status} onChange={(e) => setEditStudent({ ...editStudent, status: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  <option value="active">{tStatus('active')}</option>
                  <option value="graduated">{tStatus('graduated')}</option>
                  <option value="suspended">{tStatus('suspended')}</option>
                  <option value="withdrawn">{tStatus('withdrawn')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('phone')}</label>
                <input type="text" value={editStudent.phone} onChange={(e) => setEditStudent({ ...editStudent, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('email')} *</label>
                <input type="email" required value={editStudent.email} onChange={(e) => setEditStudent({ ...editStudent, email: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('dobLabel')}</label>
                <input type="date" value={editStudent.date_of_birth} onChange={(e) => setEditStudent({ ...editStudent, date_of_birth: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('nationalIdLabel')}</label>
                <input type="text" value={editStudent.national_id} onChange={(e) => setEditStudent({ ...editStudent, national_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('guardianName')}</label>
                <input type="text" value={editStudent.guardian_name} onChange={(e) => setEditStudent({ ...editStudent, guardian_name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('guardianPhone')}</label>
                <input type="text" value={editStudent.guardian_phone} onChange={(e) => setEditStudent({ ...editStudent, guardian_phone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('guardianRelationLabel')}</label>
                <input type="text" value={editStudent.guardian_relation} onChange={(e) => setEditStudent({ ...editStudent, guardian_relation: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('addressLabel')}</label>
                <input type="text" value={editStudent.address} onChange={(e) => setEditStudent({ ...editStudent, address: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('notes')}</label>
              <textarea rows={2} value={editStudent.notes} onChange={(e) => setEditStudent({ ...editStudent, notes: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditStudent(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">{t('cancel')}</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800">{t('saveChangesBtn')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Full Student Academic & Financial Profile Drawer */}
      {profileData && (() => {
        const att = profileData.attendance || [];
        const attCounts = {
          present: att.filter((a: any) => a.status === 'present').length,
          absent: att.filter((a: any) => a.status === 'absent').length,
          late: att.filter((a: any) => a.status === 'late').length,
          excused: att.filter((a: any) => a.status === 'excused').length,
        };
        const st = profileData.student;
        return (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex justify-end">
            <div className="w-full max-w-2xl bg-white h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-start gap-4">
                  <UserAvatar photoUrl={st.photo_url} name={`${st.first_name} ${st.last_name}`} sizeClass="w-16 h-16" textClass="text-lg" />
                  <div>
                    <div className="font-mono text-xs text-blue-700 font-semibold">{st.student_code} · {tStatus(st.status)}</div>
                    <h3 className="font-display text-xl font-bold text-slate-950">
                      {st.first_name} {st.last_name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {st.email} {st.phone ? `· ${st.phone}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(st)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{t('edit')}</span>
                  </button>
                  <button type="button" onClick={() => setProfileData(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase">{t('personalInfoSection')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500">{t('fatherName')}:</span> <span className="font-medium text-slate-900">{st.father_name || '—'}</span></div>
                  <div><span className="text-slate-500">{t('dobLabel')}:</span> <span className="font-mono text-slate-900">{st.date_of_birth || '—'}</span></div>
                  <div><span className="text-slate-500">{t('nationalIdLabel')}:</span> <span className="font-mono text-slate-900">{st.national_id || '—'}</span></div>
                  <div><span className="text-slate-500">{t('guardianLabel')}:</span> <span className="font-medium text-slate-900">{st.guardian_name || '—'} {st.guardian_phone ? `(${st.guardian_phone})` : ''}</span></div>
                  <div className="sm:col-span-2"><span className="text-slate-500">{t('addressLabel')}:</span> <span className="text-slate-900">{st.address || '—'}</span></div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('attendanceSummarySection')}</h4>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50"><div className="font-mono font-bold text-emerald-700 text-base">{attCounts.present}</div><div className="text-emerald-800">{t('present')}</div></div>
                  <div className="p-2.5 rounded-lg border border-red-200 bg-red-50"><div className="font-mono font-bold text-red-700 text-base">{attCounts.absent}</div><div className="text-red-800">{t('absent')}</div></div>
                  <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50"><div className="font-mono font-bold text-amber-700 text-base">{attCounts.late}</div><div className="text-amber-800">{t('late')}</div></div>
                  <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50"><div className="font-mono font-bold text-blue-700 text-base">{attCounts.excused}</div><div className="text-blue-800">{t('excused')}</div></div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('enrollmentHistory')}</h4>
                <div className="space-y-1.5">
                  {profileData.enrollments.length === 0 ? (
                    <p className="text-xs text-slate-500">{t('noRecords')}</p>
                  ) : profileData.enrollments.map((e: any) => (
                    <div key={e.id} className="text-xs p-2.5 rounded-lg border border-slate-200 flex justify-between">
                      <span className="font-semibold">{e.class_name} ({e.course_title})</span>
                      <span className="font-mono text-slate-600">{e.enrolled_at} · {tStatus(e.status)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('examinationGrades')}</h4>
                <div className="space-y-1.5">
                  {profileData.grades.length === 0 ? <p className="text-xs text-slate-500">{t('noGradesRecorded')}</p> : profileData.grades.map((g: any) => (
                    <div key={g.id} className="text-xs p-2.5 rounded-lg border border-slate-200 flex justify-between">
                      <span>{g.exam_title} ({g.subject_name})</span>
                      <span className="font-mono font-bold">{g.score} / {g.max_score}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('feePaymentHistory')}</h4>
                <div className="space-y-1.5">
                  {profileData.fees.length === 0 ? (
                    <p className="text-xs text-slate-500">{t('noRecords')}</p>
                  ) : profileData.fees.map((f: any) => (
                    <div key={f.id} className="text-xs p-2.5 rounded-lg border border-slate-200 flex justify-between gap-2">
                      <span className="font-medium">{f.title}</span>
                      <span className="font-mono" dir="ltr">
                        {formatCurrency(f.paid_amount)} / {formatCurrency(Number(f.total_amount) - Number(f.discount_amount))} ({tStatus(f.status)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('certificatesAndIdCards')}</h4>
                <div className="text-xs text-slate-700 space-y-1">
                  {profileData.certificates.length === 0 && profileData.idCards.length === 0 && (
                    <p className="text-slate-500">{t('noRecords')}</p>
                  )}
                  {profileData.certificates.map((c: any) => (
                    <div key={c.id}>{t('certificateLabel')}: <span className="font-mono font-semibold">{c.certificate_number}</span> ({c.course_title})</div>
                  ))}
                  {profileData.idCards.map((ic: any) => (
                    <div key={ic.id}>{t('idCardLabel')}: <span className="font-mono font-semibold">{ic.card_number}</span> ({tStatus(ic.status)})</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── TEACHERS MANAGEMENT MODULE ──────────────────────────────────────────────
export const TeachersModule: React.FC = () => {
  const { t, tStatus, tDay, translateServerError } = useI18n();
  const { toast } = useFeedback();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editTeacher, setEditTeacher] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    phone: '',
    specialization: '',
    qualification: '',
    base_salary: '15000',
    bio: '',
    photo_url: '',
    password: 'Teacher@2026',
  });

  const load = async () => {
    try {
      const res = await apiRequest<{ teachers: any[] }>('/api/academics/teachers');
      setTeachers(res.teachers || []);
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/academics/teachers', {
        method: 'POST',
        body: JSON.stringify({ ...form, base_salary: Number(form.base_salary || 0) }),
      });
      toast(t('teacherRegisteredMsg'));
      setShowModal(false);
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const openProfile = async (id: number) => {
    try {
      const res = await apiRequest(`/api/academics/teachers/${id}/profile`);
      setProfileData(res);
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const openEdit = (tch: any) => {
    setEditTeacher({
      id: tch.id,
      first_name: tch.first_name || '',
      last_name: tch.last_name || '',
      specialization: tch.specialization || '',
      qualification: tch.qualification || '',
      phone: tch.phone || '',
      email: tch.email || '',
      address: tch.address || '',
      base_salary: String(tch.base_salary ?? 0),
      salary_type: tch.salary_type || 'monthly',
      status: tch.status || 'active',
      bio: tch.bio || '',
      photo_url: tch.photo_url || '',
      show_on_website: Boolean(tch.show_on_website),
      featured_on_home: Boolean(tch.featured_on_home),
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTeacher) return;
    try {
      await apiRequest(`/api/academics/teachers/${editTeacher.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editTeacher,
          base_salary: Number(editTeacher.base_salary || 0),
        }),
      });
      toast(t('teacherUpdatedMsg'));
      const updatedId = editTeacher.id;
      setEditTeacher(null);
      await load();
      if (profileData?.teacher?.id === updatedId) {
        void openProfile(updatedId);
      }
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between no-print">
        <h2 className="font-display text-lg font-bold text-slate-950">{t('menuTeachers')}</h2>
        <button type="button" onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800">
          <Plus className="w-4 h-4" />
          <span>{t('registerTeacher')}</span>
        </button>
      </div>

      <DataTable
        rows={teachers}
        onPrint={() => window.print()}
        columns={[
          { key: 'code', header: t('codeLabel'), sortValue: (r) => r.teacher_code, render: (r) => <span className="font-mono font-semibold">{r.teacher_code}</span> },
          {
            key: 'name',
            header: t('instructorCol'),
            sortValue: (r) => `${r.first_name} ${r.last_name}`,
            render: (r) => (
              <div className="flex items-center gap-2.5">
                <UserAvatar photoUrl={r.photo_url} name={`${r.first_name} ${r.last_name}`} sizeClass="w-9 h-9" />
                <div>
                  <div className="font-semibold text-slate-950">{r.first_name} {r.last_name}</div>
                  <div className="text-xs text-slate-500">{r.specialization}</div>
                </div>
              </div>
            ),
          },
          { key: 'classes', header: t('assignedClassesCol'), align: 'end', render: (r) => <span>{r.assigned_classes_count ?? 0}</span> },
          { key: 'salary', header: t('baseSalaryCol'), align: 'end', render: (r) => <span className="font-mono" dir="ltr">{formatCurrency(r.base_salary)}</span> },
          { key: 'status', header: t('status'), render: (r) => <span className={r.status === 'active' ? 'text-emerald-700 font-semibold text-xs' : 'text-slate-500 text-xs'}>{tStatus(r.status)}</span> },
          {
            key: 'actions',
            header: t('actions'),
            render: (r) => (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void openProfile(r.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{t('viewDetailsBtn')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{t('edit')}</span>
                </button>
              </div>
            ),
          },
        ]}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleCreate} className="w-full max-w-xl bg-white rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display font-bold text-lg">{t('registerTeacher')}</h3>
              <button type="button" onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <input required placeholder={t('firstName')} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
              <input required placeholder={t('lastName')} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
              <input required placeholder={t('username')} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
              <input required type="email" placeholder={t('email')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
              <input placeholder={t('specialization')} value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
              <input placeholder={t('qualification')} value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
              <input type="number" placeholder={t('baseSalaryInput')} value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              <input placeholder={t('initialPassword')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
            </div>
            <textarea rows={2} placeholder={t('shortBioPlaceholder')} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="flex flex-wrap items-center gap-4 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <UserAvatar photoUrl={form.photo_url} name={`${form.first_name} ${form.last_name}` || 'T'} sizeClass="w-14 h-14" />
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <FileUploader imageOnly label={t('uploadTeacherPhoto')} onUploaded={(m) => setForm({ ...form, photo_url: m.url })} />
                {form.photo_url && (
                  <button type="button" onClick={() => setForm({ ...form, photo_url: '' })} className="text-xs text-red-600 hover:underline">
                    {t('removePhotoBtn')}
                  </button>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">{t('cancel')}</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">{t('save')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {editTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleUpdate} className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display font-bold text-lg text-slate-950">{t('editTeacherTitle')}</h3>
              <button type="button" onClick={() => setEditTeacher(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex flex-wrap items-center gap-4 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <UserAvatar photoUrl={editTeacher.photo_url} name={`${editTeacher.first_name} ${editTeacher.last_name}`} sizeClass="w-16 h-16" textClass="text-base" />
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <FileUploader imageOnly label={t('uploadTeacherPhoto')} onUploaded={(m) => setEditTeacher({ ...editTeacher, photo_url: m.url })} />
                {editTeacher.photo_url && (
                  <button type="button" onClick={() => setEditTeacher({ ...editTeacher, photo_url: '' })} className="text-xs font-medium text-red-600 hover:underline">
                    {t('removePhotoBtn')}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('firstName')} *</label>
                <input required value={editTeacher.first_name} onChange={(e) => setEditTeacher({ ...editTeacher, first_name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('lastName')} *</label>
                <input required value={editTeacher.last_name} onChange={(e) => setEditTeacher({ ...editTeacher, last_name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('specialization')}</label>
                <input value={editTeacher.specialization} onChange={(e) => setEditTeacher({ ...editTeacher, specialization: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('qualification')}</label>
                <input value={editTeacher.qualification} onChange={(e) => setEditTeacher({ ...editTeacher, qualification: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('phone')}</label>
                <input value={editTeacher.phone} onChange={(e) => setEditTeacher({ ...editTeacher, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('email')} *</label>
                <input type="email" required value={editTeacher.email} onChange={(e) => setEditTeacher({ ...editTeacher, email: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" dir="ltr" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('baseSalaryInput')}</label>
                <input type="number" step="0.01" value={editTeacher.base_salary} onChange={(e) => setEditTeacher({ ...editTeacher, base_salary: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('salaryTypeLabel')}</label>
                <select value={editTeacher.salary_type} onChange={(e) => setEditTeacher({ ...editTeacher, salary_type: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  <option value="monthly">{t('monthlySalaryOpt')}</option>
                  <option value="hourly">{t('hourlySalaryOpt')}</option>
                  <option value="per_class">{t('perClassSalaryOpt')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('status')}</label>
                <select value={editTeacher.status} onChange={(e) => setEditTeacher({ ...editTeacher, status: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  <option value="active">{tStatus('active')}</option>
                  <option value="inactive">{tStatus('inactive')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('addressLabel')}</label>
                <input value={editTeacher.address} onChange={(e) => setEditTeacher({ ...editTeacher, address: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('shortBioPlaceholder')}</label>
              <textarea rows={2} value={editTeacher.bio} onChange={(e) => setEditTeacher({ ...editTeacher, bio: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={editTeacher.show_on_website} onChange={(e) => setEditTeacher({ ...editTeacher, show_on_website: e.target.checked })} />
                <span>{t('showOnWebsiteLabel')}</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={editTeacher.featured_on_home} onChange={(e) => setEditTeacher({ ...editTeacher, featured_on_home: e.target.checked })} />
                <span>{t('showOnHomepageLabel')}</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditTeacher(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">{t('cancel')}</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800">{t('saveChangesBtn')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Full Teacher Profile Drawer */}
      {profileData && (() => {
        const tch = profileData.teacher;
        const summary = profileData.attendanceSummary || { present: 0, absent: 0, late: 0, excused: 0 };
        return (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex justify-end">
            <div className="w-full max-w-2xl bg-white h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-start gap-4">
                  <UserAvatar photoUrl={tch.photo_url} name={`${tch.first_name} ${tch.last_name}`} sizeClass="w-16 h-16" textClass="text-lg" />
                  <div>
                    <div className="font-mono text-xs text-blue-700 font-semibold">{tch.teacher_code} · {tStatus(tch.status)}</div>
                    <h3 className="font-display text-xl font-bold text-slate-950">{tch.first_name} {tch.last_name}</h3>
                    <p className="text-xs text-slate-600 mt-0.5">{tch.specialization} {tch.qualification ? `· ${tch.qualification}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(tch)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{t('edit')}</span>
                  </button>
                  <button type="button" onClick={() => setProfileData(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase">{t('personalInfoSection')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div><span className="text-slate-500">{t('phone')}:</span> <span className="font-mono text-slate-900" dir="ltr">{tch.phone || '—'}</span></div>
                  <div><span className="text-slate-500">{t('email')}:</span> <span className="text-slate-900">{tch.email || '—'}</span></div>
                  <div><span className="text-slate-500">{t('hireDateLabel')}:</span> <span className="font-mono text-slate-900">{tch.hire_date || '—'}</span></div>
                  <div><span className="text-slate-500">{t('addressLabel')}:</span> <span className="text-slate-900">{tch.address || '—'}</span></div>
                  <div className="sm:col-span-2 text-slate-700 pt-1">{tch.bio || t('noBioAvailable')}</div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('teachingAssignmentsSection')}</h4>
                <div className="space-y-1.5">
                  {(profileData.assignments || []).length === 0 ? (
                    <p className="text-xs text-slate-500">{t('noRecords')}</p>
                  ) : profileData.assignments.map((a: any) => (
                    <div key={a.id} className="text-xs p-2.5 rounded-lg border border-slate-200 flex justify-between gap-2">
                      <span className="font-semibold text-slate-900">{a.class_name} · {a.subject_name}</span>
                      <span className="text-slate-500">{a.course_title} {a.room ? `(${a.room})` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('menuTimetable')}</h4>
                <div className="space-y-1.5">
                  {(profileData.timetable || []).length === 0 ? (
                    <p className="text-xs text-slate-500">{t('noRecords')}</p>
                  ) : profileData.timetable.map((tt: any) => (
                    <div key={tt.id} className="text-xs p-2.5 rounded-lg border border-slate-200 flex justify-between gap-2">
                      <span className="font-medium text-slate-900">{tDay(tt.day_of_week)} · {tt.class_name} ({tt.subject_name})</span>
                      <span className="font-mono text-slate-600" dir="ltr">{tt.start_time}–{tt.end_time} {tt.room ? `· ${tt.room}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('attendanceSummarySection')}</h4>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50"><div className="font-mono font-bold text-emerald-700 text-base">{summary.present}</div><div className="text-emerald-800">{t('present')}</div></div>
                  <div className="p-2.5 rounded-lg border border-red-200 bg-red-50"><div className="font-mono font-bold text-red-700 text-base">{summary.absent}</div><div className="text-red-800">{t('absent')}</div></div>
                  <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50"><div className="font-mono font-bold text-amber-700 text-base">{summary.late}</div><div className="text-amber-800">{t('late')}</div></div>
                  <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50"><div className="font-mono font-bold text-blue-700 text-base">{summary.excused}</div><div className="text-blue-800">{t('excused')}</div></div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('salaryDetailsSection')}</h4>
                <div className="text-xs p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span>{t('baseSalaryCol')} ({tch.salary_type})</span>
                  <span className="font-mono font-bold text-slate-950" dir="ltr">{formatCurrency(tch.base_salary)}</span>
                </div>
                <div className="space-y-1.5">
                  {(profileData.salaryPayments || []).map((sp: any) => (
                    <div key={sp.id} className="text-xs p-2.5 rounded-lg border border-slate-200 flex justify-between">
                      <span className="font-mono">{sp.pay_month} · {sp.payment_date}</span>
                      <span className="font-mono font-semibold text-emerald-700" dir="ltr">{formatCurrency(sp.paid_amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── SUBJECTS & COURSES MODULE ───────────────────────────────────────────────
export const SubjectsAndCoursesModule: React.FC = () => {
  const { t, tStatus, translateServerError } = useI18n();
  const { toast } = useFeedback();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [subName, setSubName] = useState('');
  const [subDesc, setSubDesc] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseFee, setCourseFee] = useState('5000');
  const [courseWeeks, setCourseWeeks] = useState('16');
  const [courseCap, setCourseCap] = useState('25');
  const [courseFeatured, setCourseFeatured] = useState(false);
  const [selectedSubs, setSelectedSubs] = useState<number[]>([]);
  const [editSubject, setEditSubject] = useState<any>(null);
  const [editCourse, setEditCourse] = useState<any>(null);

  const load = async () => {
    try {
      const [sRes, cRes] = await Promise.all([
        apiRequest<{ subjects: any[] }>('/api/academics/subjects'),
        apiRequest<{ courses: any[] }>('/api/academics/courses'),
      ]);
      setSubjects(sRes.subjects || []);
      setCourses(cRes.courses || []);
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/academics/subjects', { method: 'POST', body: JSON.stringify({ name: subName, description: subDesc }) });
      toast(t('subjectCreatedMsg'));
      setSubName('');
      setSubDesc('');
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const updateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSubject) return;
    try {
      await apiRequest(`/api/academics/subjects/${editSubject.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editSubject.name,
          description: editSubject.description,
          credit_hours: Number(editSubject.credit_hours || 3),
          status: editSubject.status,
        }),
      });
      toast(t('subjectUpdatedMsg'));
      setEditSubject(null);
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const addCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/academics/courses', {
        method: 'POST',
        body: JSON.stringify({
          title: courseTitle,
          fee_amount: Number(courseFee),
          duration_weeks: Number(courseWeeks),
          capacity: Number(courseCap),
          subject_ids: selectedSubs,
          featured: courseFeatured,
        }),
      });
      toast(t('courseCreatedMsg'));
      setCourseTitle('');
      setCourseFeatured(false);
      setSelectedSubs([]);
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const updateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCourse) return;
    try {
      await apiRequest(`/api/academics/courses/${editCourse.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editCourse,
          duration_weeks: Number(editCourse.duration_weeks || 12),
          fee_amount: Number(editCourse.fee_amount || 0),
          capacity: Number(editCourse.capacity || 25),
        }),
      });
      toast(t('courseUpdatedMsg'));
      setEditCourse(null);
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <form onSubmit={addSubject} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="font-display font-bold text-slate-950">{t('menuSubjects')}</h3>
          <input required placeholder={t('subjectNamePlaceholder')} value={subName} onChange={(e) => setSubName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <input placeholder={t('description')} value={subDesc} onChange={(e) => setSubDesc(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">{t('createSubject')}</button>
        </form>
        <DataTable
          rows={subjects}
          pageSize={6}
          columns={[
            { key: 'code', header: t('codeLabel'), render: (r) => <span className="font-mono font-semibold">{r.subject_code}</span> },
            { key: 'name', header: t('subjectCol'), render: (r) => <span className="font-medium">{r.name}</span> },
            { key: 'status', header: t('status'), render: (r) => <span className="text-xs">{tStatus(r.status)}</span> },
            {
              key: 'act',
              header: t('actions'),
              render: (r) => (
                <button
                  type="button"
                  onClick={() => setEditSubject({ ...r, credit_hours: String(r.credit_hours ?? 3) })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  <Pencil className="w-3 h-3" />
                  <span>{t('edit')}</span>
                </button>
              ),
            },
          ]}
        />
      </div>

      <div className="space-y-4">
        <form onSubmit={addCourse} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="font-display font-bold text-slate-950">{t('menuCourses')}</h3>
          <input required placeholder={t('courseTitlePlaceholder')} value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" placeholder={t('feeInput')} value={courseFee} onChange={(e) => setCourseFee(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
            <input type="number" placeholder={t('weeksInput')} value={courseWeeks} onChange={(e) => setCourseWeeks(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
            <input type="number" placeholder={t('capacityInput')} value={courseCap} onChange={(e) => setCourseCap(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
          </div>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <label key={s.id} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedSubs.includes(s.id)}
                  onChange={(e) => setSelectedSubs((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)))}
                />
                <span>{s.name}</span>
              </label>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={courseFeatured}
              onChange={(e) => setCourseFeatured(e.target.checked)}
            />
            <span>{t('showOnHomepageLabel')}</span>
          </label>
          <div>
            <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">{t('createCourse')}</button>
          </div>
        </form>
        <DataTable
          rows={courses}
          pageSize={6}
          columns={[
            { key: 'code', header: t('codeLabel'), render: (r) => <span className="font-mono font-semibold">{r.course_code}</span> },
            { key: 'title', header: t('courseCol'), render: (r) => <span className="font-medium">{r.title}</span> },
            { key: 'fee', header: t('feeCol'), align: 'end', render: (r) => <span className="font-mono" dir="ltr">{formatCurrency(r.fee_amount)}</span> },
            {
              key: 'act',
              header: t('actions'),
              render: (r) => (
                <button
                  type="button"
                  onClick={() => {
                    const subIds = String(r.subject_ids || '')
                      .split(',')
                      .map((x) => Number(x.trim()))
                      .filter((n) => n > 0);
                    setEditCourse({
                      ...r,
                      fee_amount: String(r.fee_amount ?? 0),
                      duration_weeks: String(r.duration_weeks ?? 12),
                      capacity: String(r.capacity ?? 25),
                      featured: Boolean(r.featured),
                      subject_ids: subIds,
                    });
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  <Pencil className="w-3 h-3" />
                  <span>{t('edit')}</span>
                </button>
              ),
            },
          ]}
        />
      </div>

      {/* Edit Subject Modal */}
      {editSubject && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form onSubmit={updateSubject} className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display font-bold text-lg">{t('editSubjectTitle')}</h3>
              <button type="button" onClick={() => setEditSubject(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('subjectCol')} *</label>
                <input required value={editSubject.name} onChange={(e) => setEditSubject({ ...editSubject, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('description')}</label>
                <input value={editSubject.description || ''} onChange={(e) => setEditSubject({ ...editSubject, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('creditHoursLabel')}</label>
                  <input type="number" min={1} value={editSubject.credit_hours} onChange={(e) => setEditSubject({ ...editSubject, credit_hours: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('status')}</label>
                  <select value={editSubject.status} onChange={(e) => setEditSubject({ ...editSubject, status: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    <option value="active">{tStatus('active')}</option>
                    <option value="inactive">{tStatus('inactive')}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditSubject(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">{t('cancel')}</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">{t('saveChangesBtn')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Course Modal */}
      {editCourse && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={updateCourse} className="w-full max-w-xl bg-white rounded-2xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display font-bold text-lg">{t('editCourseTitle')}</h3>
              <button type="button" onClick={() => setEditCourse(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('courseCol')} *</label>
                <input required value={editCourse.title} onChange={(e) => setEditCourse({ ...editCourse, title: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('feeInput')}</label>
                <input type="number" step="0.01" value={editCourse.fee_amount} onChange={(e) => setEditCourse({ ...editCourse, fee_amount: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('weeksInput')}</label>
                <input type="number" value={editCourse.duration_weeks} onChange={(e) => setEditCourse({ ...editCourse, duration_weeks: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('capacityInput')}</label>
                <input type="number" value={editCourse.capacity} onChange={(e) => setEditCourse({ ...editCourse, capacity: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('status')}</label>
                <select value={editCourse.status} onChange={(e) => setEditCourse({ ...editCourse, status: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  <option value="active">{tStatus('active')}</option>
                  <option value="upcoming">{tStatus('upcoming')}</option>
                  <option value="completed">{tStatus('completed')}</option>
                  <option value="inactive">{tStatus('inactive')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('startDate')}</label>
                <input type="date" value={editCourse.start_date || ''} onChange={(e) => setEditCourse({ ...editCourse, start_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('endDate')}</label>
                <input type="date" value={editCourse.end_date || ''} onChange={(e) => setEditCourse({ ...editCourse, end_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('description')}</label>
              <textarea rows={2} placeholder={t('courseDescriptionPlaceholder')} value={editCourse.description || ''} onChange={(e) => setEditCourse({ ...editCourse, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1.5">{t('courseSubjectsLabel')}</div>
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <label key={s.id} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={(editCourse.subject_ids || []).includes(s.id)}
                      onChange={(e) => {
                        const prev = editCourse.subject_ids || [];
                        setEditCourse({ ...editCourse, subject_ids: e.target.checked ? [...prev, s.id] : prev.filter((x: number) => x !== s.id) });
                      }}
                    />
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <FileUploader imageOnly label={t('uploadCustomSlideImage')} onUploaded={(m) => setEditCourse({ ...editCourse, image_url: m.url })} />
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={editCourse.featured} onChange={(e) => setEditCourse({ ...editCourse, featured: e.target.checked })} />
              <span>{t('showOnHomepageLabel')}</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditCourse(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">{t('cancel')}</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">{t('saveChangesBtn')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// ─── CLASSES & TEACHER ASSIGNMENTS ───────────────────────────────────────────
export const ClassesAndAssignmentsModule: React.FC = () => {
  const { user } = useAuth();
  const { t, tStatus, translateServerError } = useI18n();
  const { toast } = useFeedback();
  const [classes, setClasses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [studentProfile, setStudentProfile] = useState<any>(null);

  const [clsName, setClsName] = useState('');
  const [clsCourseId, setClsCourseId] = useState('');
  const [clsRoom, setClsRoom] = useState('');
  const [assignClass, setAssignClass] = useState('');
  const [assignSubject, setAssignSubject] = useState('');
  const [assignTeacher, setAssignTeacher] = useState('');

  const load = async () => {
    try {
      const res = await apiRequest<{ classes: any[]; assignments: any[] }>('/api/academics/classes');
      setClasses(res.classes || []);
      setAssignments(res.assignments || []);
      if (user?.role === 'admin') {
        const [cRes, sRes, tRes] = await Promise.all([
          apiRequest<{ courses: any[] }>('/api/academics/courses'),
          apiRequest<{ subjects: any[] }>('/api/academics/subjects'),
          apiRequest<{ teachers: any[] }>('/api/academics/teachers'),
        ]);
        setCourses(cRes.courses || []);
        setSubjects(sRes.subjects || []);
        setTeachers(tRes.teachers || []);
      } else if (user?.role === 'teacher') {
        const stRes = await apiRequest<{ students: any[] }>('/api/academics/students');
        setStudents(stRes.students || []);
      }
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/academics/classes', {
        method: 'POST',
        body: JSON.stringify({ name: clsName, course_id: Number(clsCourseId), room: clsRoom }),
      });
      toast(t('classCreatedMsg'));
      setClsName('');
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/academics/classes/${assignClass}/assign-teacher`, {
        method: 'POST',
        body: JSON.stringify({ subject_id: Number(assignSubject), teacher_id: Number(assignTeacher) }),
      });
      toast(t('teacherAssignedMsg'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  return (
    <div className="space-y-6">
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={createClass} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h3 className="font-display font-bold text-slate-950">{t('createClass')}</h3>
            <input required placeholder={t('classNamePlaceholder')} value={clsName} onChange={(e) => setClsName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <select required value={clsCourseId} onChange={(e) => setClsCourseId(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="">{t('selectCourseOpt')}</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <input placeholder={t('roomPlaceholder')} value={clsRoom} onChange={(e) => setClsRoom(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">{t('createClass')}</button>
          </form>

          <form onSubmit={handleAssignTeacher} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h3 className="font-display font-bold text-slate-950">{t('assignTeacherTitle')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select required value={assignClass} onChange={(e) => setAssignClass(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="">{t('classOpt')}</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select required value={assignSubject} onChange={(e) => setAssignSubject(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="">{t('subjectOpt')}</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select required value={assignTeacher} onChange={(e) => setAssignTeacher(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="">{t('teacherOpt')}</option>
                {teachers.map((tch) => <option key={tch.id} value={tch.id}>{tch.first_name} {tch.last_name}</option>)}
              </select>
            </div>
            <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg">{t('assignTeacherBtn')}</button>
          </form>
        </div>
      )}

      <DataTable
        rows={classes}
        columns={[
          { key: 'code', header: t('codeLabel'), render: (r) => <span className="font-mono font-semibold">{r.class_code}</span> },
          { key: 'name', header: t('classNameCol'), render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: 'course', header: t('courseCol'), render: (r) => <span>{r.course_title}</span> },
          { key: 'room', header: t('roomCol'), render: (r) => <span>{r.room}</span> },
          { key: 'cap', header: t('enrolledCapCol'), align: 'end', render: (r) => <span className="font-mono">{r.enrolled_count} / {r.capacity}</span> },
        ]}
      />

      {user?.role === 'admin' && (
        <DataTable
          rows={assignments}
          columns={[
            { key: 'class', header: t('classCol'), render: (r) => <span className="font-medium">{r.class_name}</span> },
            { key: 'subject', header: t('subjectCol'), render: (r) => <span>{r.subject_name}</span> },
            { key: 'teacher', header: t('teacherCol'), render: (r) => <span className="font-medium">{r.teacher_name}</span> },
            {
              key: 'act',
              header: t('actions'),
              render: (r) => (
                <button
                  type="button"
                  onClick={async () => {
                    await apiRequest(`/api/academics/classes/assignments/${r.id}`, { method: 'DELETE' });
                    toast(t('assignmentRemovedMsg'));
                    void load();
                  }}
                  className="text-red-600 hover:underline text-xs inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t('remove')}
                </button>
              ),
            },
          ]}
        />
      )}

      {user?.role === 'teacher' && (
        <div className="space-y-2">
          <h3 className="font-display font-bold text-slate-950">{t('myAssignedStudents')}</h3>
          <DataTable
            rows={students}
            columns={[
              { key: 'code', header: t('studentIdCol'), render: (r) => <span className="font-mono font-semibold">{r.student_code}</span> },
              {
                key: 'name',
                header: t('studentCol'),
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <UserAvatar photoUrl={r.photo_url} name={`${r.first_name} ${r.last_name}`} sizeClass="w-8 h-8" />
                    <span className="font-medium">{r.first_name} {r.last_name}</span>
                  </div>
                ),
              },
              { key: 'class', header: t('classCol'), render: (r) => <span>{r.current_class}</span> },
              { key: 'phone', header: t('phone'), render: (r) => <span dir="ltr">{r.phone}</span> },
              {
                key: 'det',
                header: t('actions'),
                render: (r) => (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await apiRequest(`/api/academics/students/${r.id}/profile`);
                        setStudentProfile(res);
                      } catch (err: any) {
                        toast(translateServerError(err?.message), 'error');
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{t('viewDetailsBtn')}</span>
                  </button>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Teacher Scoped Read-Only Student Profile Drawer (Academic & Attendance Only) */}
      {studentProfile && (() => {
        const st = studentProfile.student;
        const att = studentProfile.attendance || [];
        const attCounts = {
          present: att.filter((a: any) => a.status === 'present').length,
          absent: att.filter((a: any) => a.status === 'absent').length,
          late: att.filter((a: any) => a.status === 'late').length,
          excused: att.filter((a: any) => a.status === 'excused').length,
        };
        return (
          <div className="fixed inset-0 z-50 bg-slate-950/50 flex justify-end">
            <div className="w-full max-w-xl bg-white h-full overflow-y-auto p-6 space-y-5 shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div className="flex items-start gap-3.5">
                  <UserAvatar photoUrl={st.photo_url} name={`${st.first_name} ${st.last_name}`} sizeClass="w-14 h-14" />
                  <div>
                    <div className="font-mono text-xs text-blue-700 font-semibold">{st.student_code} · {tStatus(st.status)}</div>
                    <h3 className="font-display text-lg font-bold text-slate-950">{st.first_name} {st.last_name}</h3>
                    <p className="text-xs text-slate-600">{st.phone || '—'} · {st.email || '—'}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setStudentProfile(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg border border-emerald-200 bg-emerald-50"><div className="font-mono font-bold text-emerald-700">{attCounts.present}</div><div>{t('present')}</div></div>
                <div className="p-2 rounded-lg border border-red-200 bg-red-50"><div className="font-mono font-bold text-red-700">{attCounts.absent}</div><div>{t('absent')}</div></div>
                <div className="p-2 rounded-lg border border-amber-200 bg-amber-50"><div className="font-mono font-bold text-amber-700">{attCounts.late}</div><div>{t('late')}</div></div>
                <div className="p-2 rounded-lg border border-blue-200 bg-blue-50"><div className="font-mono font-bold text-blue-700">{attCounts.excused}</div><div>{t('excused')}</div></div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('enrollmentHistory')}</h4>
                <div className="space-y-1.5">
                  {(studentProfile.enrollments || []).map((e: any) => (
                    <div key={e.id} className="text-xs p-2.5 rounded-lg border border-slate-200 flex justify-between">
                      <span className="font-semibold">{e.class_name} ({e.course_title})</span>
                      <span className="font-mono text-slate-500">{tStatus(e.status)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('examinationGrades')}</h4>
                <div className="space-y-1.5">
                  {(studentProfile.grades || []).length === 0 ? (
                    <p className="text-xs text-slate-500">{t('noGradesRecorded')}</p>
                  ) : studentProfile.grades.map((g: any) => (
                    <div key={g.id} className="text-xs p-2.5 rounded-lg border border-slate-200 flex justify-between">
                      <span>{g.exam_title} ({g.subject_name})</span>
                      <span className="font-mono font-bold">{g.score} / {g.max_score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── TIMETABLE MODULE (INDEPENDENT PER-CLASS + CONFLICT DETECTION + PRINT) ───
export const TimetableModule: React.FC = () => {
  const { user } = useAuth();
  const { t, tDay, translateServerError } = useI18n();
  const { toast } = useFeedback();
  const [slots, setSlots] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [editSlot, setEditSlot] = useState<any>(null);
  const [form, setForm] = useState({ subject_id: '', teacher_id: '', day_of_week: 'Saturday', start_time: '09:00', end_time: '10:30', room: '' });

  const loadTimetableForClass = async (classId: string) => {
    try {
      const url = user?.role === 'admin' && classId
        ? `/api/academics/timetables?class_id=${encodeURIComponent(classId)}`
        : '/api/academics/timetables';
      const res = await apiRequest<{ timetables: any[] }>(url);
      setSlots(res.timetables || []);
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const load = async () => {
    try {
      if (user?.role === 'admin') {
        const [cRes, sRes, tRes] = await Promise.all([
          apiRequest<{ classes: any[] }>('/api/academics/classes'),
          apiRequest<{ subjects: any[] }>('/api/academics/subjects'),
          apiRequest<{ teachers: any[] }>('/api/academics/teachers'),
        ]);
        const cList = cRes.classes || [];
        setClasses(cList);
        setSubjects(sRes.subjects || []);
        setTeachers(tRes.teachers || []);
        const activeId = selectedClassId || (cList[0] ? String(cList[0].id) : '');
        if (activeId && !selectedClassId) {
          setSelectedClassId(activeId);
          setForm((prev) => ({ ...prev, room: prev.room || cList[0]?.room || '' }));
        }
        if (activeId) {
          await loadTimetableForClass(activeId);
        } else {
          setSlots([]);
        }
      } else {
        await loadTimetableForClass('');
      }
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (user?.role === 'admin' && selectedClassId) {
      void loadTimetableForClass(selectedClassId);
    }
  }, [selectedClassId]);

  const activeClass = classes.find((c) => String(c.id) === selectedClassId) || null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) return;
    try {
      await apiRequest('/api/academics/timetables', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          class_id: Number(selectedClassId),
          subject_id: Number(form.subject_id),
          teacher_id: Number(form.teacher_id),
        }),
      });
      toast(t('timetableSlotAddedMsg'));
      void loadTimetableForClass(selectedClassId);
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const handleUpdateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSlot) return;
    try {
      await apiRequest(`/api/academics/timetables/${editSlot.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          class_id: Number(editSlot.class_id),
          subject_id: Number(editSlot.subject_id),
          teacher_id: Number(editSlot.teacher_id),
          day_of_week: editSlot.day_of_week,
          start_time: editSlot.start_time,
          end_time: editSlot.end_time,
          room: editSlot.room || '',
        }),
      });
      toast(t('timetableSlotUpdatedMsg'));
      setEditSlot(null);
      void loadTimetableForClass(selectedClassId);
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  return (
    <div className="space-y-6">
      {user?.role === 'admin' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-slate-950 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-blue-700" />
                <span>{t('selectClassTimetablePrompt')}</span>
              </h3>
            </div>
            <select
              aria-label={t('classCol')}
              value={selectedClassId}
              onChange={(e) => {
                const cid = e.target.value;
                setSelectedClassId(cid);
                const cls = classes.find((c) => String(c.id) === cid);
                if (cls?.room) setForm((prev) => ({ ...prev, room: cls.room }));
              }}
              className="px-3.5 py-2 text-sm font-semibold border border-blue-300 rounded-lg bg-blue-50/40 text-slate-900 min-w-[240px]"
            >
              <option value="">{t('selectClassOpt')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.class_code}) — {c.course_title}
                </option>
              ))}
            </select>
          </div>

          {classes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => {
                const isSel = String(c.id) === selectedClassId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedClassId(String(c.id));
                      if (c.room) setForm((prev) => ({ ...prev, room: c.room }));
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      isSel
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {c.name} ({c.class_code})
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {user?.role === 'admin' && activeClass && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-blue-800">{t('activeClassTimetableTitle')}</div>
            <div className="font-display text-base font-bold text-slate-950">
              {activeClass.name} <span className="font-mono text-xs text-slate-600">({activeClass.class_code})</span>
            </div>
          </div>
          <div className="text-xs text-slate-700 flex flex-wrap gap-3">
            <span>{activeClass.course_title}</span>
            {activeClass.room && <span className="font-mono">· {activeClass.room}</span>}
          </div>
        </div>
      )}

      {user?.role === 'admin' && selectedClassId && (
        <form onSubmit={handleAdd} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 no-print">
          <h3 className="font-display font-bold text-slate-950 flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4 text-blue-700" />
            <span>{t('scheduleSessionTitle')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-3 text-sm">
            <select required value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="">{t('subjectOpt')}</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select required value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="">{t('teacherOpt')}</option>
              {teachers.map((tch) => <option key={tch.id} value={tch.id}>{tch.first_name} {tch.last_name}</option>)}
            </select>
            <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
              {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d) => <option key={d} value={d}>{tDay(d)}</option>)}
            </select>
            <input type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
            <input type="time" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
            <input placeholder={t('roomCol')} value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
            <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800">{t('add')}</button>
          </div>
        </form>
      )}

      <div className="flex justify-end no-print">
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 bg-white rounded-lg hover:bg-slate-50">
          <Printer className="w-4 h-4" />
          <span>{t('printTimetable')}</span>
        </button>
      </div>

      {user?.role === 'admin' && !selectedClassId ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {t('selectClassTimetablePrompt')}
        </div>
      ) : user?.role === 'admin' && slots.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {t('noTimetableForClass')}
        </div>
      ) : (
        <DataTable
          rows={slots}
          columns={[
            { key: 'day', header: t('dayCol'), sortValue: (r) => r.day_of_week, render: (r) => <span className="font-semibold">{tDay(r.day_of_week)}</span> },
            { key: 'time', header: t('timeCol'), sortValue: (r) => r.start_time, render: (r) => <span className="font-mono" dir="ltr">{r.start_time} – {r.end_time}</span> },
            { key: 'class', header: t('classCol'), render: (r) => <span>{r.class_name}</span> },
            { key: 'subject', header: t('subjectCol'), render: (r) => <span className="font-medium">{r.subject_name}</span> },
            { key: 'teacher', header: t('teacherCol'), render: (r) => <span>{r.teacher_name}</span> },
            { key: 'room', header: t('roomCol'), render: (r) => <span>{r.room}</span> },
            ...(user?.role === 'admin'
              ? [
                  {
                    key: 'act',
                    header: t('actions'),
                    render: (r: any) => (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditSlot({ ...r })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-50"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>{t('edit')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/academics/timetables/${r.id}`, { method: 'DELETE' });
                            toast(t('timetableSlotDeletedMsg'));
                            void loadTimetableForClass(selectedClassId);
                          }}
                          className="text-xs text-red-600 hover:underline"
                        >
                          {t('delete')}
                        </button>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}

      {/* Edit Timetable Session Modal */}
      {editSlot && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form onSubmit={handleUpdateSlot} className="w-full max-w-lg bg-white rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display font-bold text-lg">{t('editTimetableSlotTitle')}</h3>
              <button type="button" onClick={() => setEditSlot(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('subjectCol')}</label>
                <select required value={editSlot.subject_id} onChange={(e) => setEditSlot({ ...editSlot, subject_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('teacherCol')}</label>
                <select required value={editSlot.teacher_id} onChange={(e) => setEditSlot({ ...editSlot, teacher_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  {teachers.map((tch) => <option key={tch.id} value={tch.id}>{tch.first_name} {tch.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('dayCol')}</label>
                <select value={editSlot.day_of_week} onChange={(e) => setEditSlot({ ...editSlot, day_of_week: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d) => <option key={d} value={d}>{tDay(d)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('roomCol')}</label>
                <input value={editSlot.room || ''} onChange={(e) => setEditSlot({ ...editSlot, room: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('startTimeLabel')}</label>
                <input type="time" required value={editSlot.start_time} onChange={(e) => setEditSlot({ ...editSlot, start_time: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('endTimeLabel')}</label>
                <input type="time" required value={editSlot.end_time} onChange={(e) => setEditSlot({ ...editSlot, end_time: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditSlot(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">{t('cancel')}</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">{t('saveChangesBtn')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// ─── STUDENT PROMOTION (PRESERVES HISTORICAL ENROLLMENTS) ────────────────────
export const PromotionsModule: React.FC = () => {
  const { t, translateServerError } = useI18n();
  const { toast, confirm } = useFeedback();
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [fromClassId, setFromClassId] = useState('');
  const [toClassId, setToClassId] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const load = async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        apiRequest<{ classes: any[] }>('/api/academics/classes'),
        apiRequest<{ students: any[] }>('/api/academics/students'),
      ]);
      setClasses(cRes.classes || []);
      setStudents(sRes.students || []);
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const eligible = students.filter((s) => Number(s.current_class_id) === Number(fromClassId));

  const handlePromote = async () => {
    const ok = await confirm({
      title: t('confirmPromotionTitle'),
      message: t('confirmPromotionMsg', { count: selectedIds.length }),
      confirmLabel: t('confirmPromotionBtn'),
    });
    if (!ok) return;
    try {
      const res = await apiRequest<{ promoted_count: number }>('/api/academics/promotions', {
        method: 'POST',
        body: JSON.stringify({ from_class_id: Number(fromClassId), to_class_id: Number(toClassId), student_ids: selectedIds }),
      });
      toast(t('promotedCountMsg', { count: res.promoted_count }));
      setSelectedIds([]);
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="font-display font-bold text-lg text-slate-950 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-700" />
          <span>{t('menuPromotions')}</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t('sourceClassLabel')}</label>
            <select
              value={fromClassId}
              onChange={(e) => {
                setFromClassId(e.target.value);
                setSelectedIds([]);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="">{t('selectSourceClass')}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.class_code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t('targetClassLabel')}</label>
            <select
              value={toClassId}
              onChange={(e) => setToClassId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="">{t('selectTargetClass')}</option>
              {classes.filter((c) => String(c.id) !== fromClassId).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.class_code})</option>)}
            </select>
          </div>
        </div>

        {fromClassId && (
          <div className="pt-2 space-y-2">
            <div className="text-xs font-semibold text-slate-700">{t('eligibleStudentsCount', { count: eligible.length })}</div>
            {eligible.length === 0 ? (
              <p className="text-xs text-slate-500">{t('noActiveStudentsInClass')}</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {eligible.map((s) => (
                  <label key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s.id)}
                        onChange={(e) => setSelectedIds((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))}
                      />
                      <span className="font-mono text-xs text-slate-500">{s.student_code}</span>
                      <span className="font-medium text-slate-900">{s.first_name} {s.last_name}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="pt-3 flex justify-end">
              <button
                type="button"
                disabled={!toClassId || selectedIds.length === 0}
                onClick={() => void handlePromote()}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
              >
                {t('promoteSelectedCount', { count: selectedIds.length })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
