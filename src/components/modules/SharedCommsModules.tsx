import React, { useEffect, useState } from 'react';
import { Bell, Check, FileSpreadsheet, KeyRound, Mail, Plus, Printer, Send, Trash2, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { apiRequest, downloadAuthenticatedFile } from '../../utils/api';
import { formatCurrency } from '../../utils/eduLogic';
import { useFeedback } from '../ui/ToastAndConfirm';
import { DataTable } from '../ui/DataTable';
import { FileUploader } from '../ui/FileUploader';
import { UserAvatar } from '../ui/UserAvatar';

// ─── NOTIFICATIONS MODULE ────────────────────────────────────────────────────
export const NotificationsView: React.FC = () => {
  const { user } = useAuth();
  const { t, translateServerError } = useI18n();
  const { toast } = useFeedback();
  const [items, setItems] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState('all_users');
  const [classId, setClassId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await apiRequest<{ notifications: any[] }>('/api/comms/notifications');
      setItems(res.notifications || []);
      if (user?.role === 'admin') {
        const clsRes = await apiRequest<{ classes: any[] }>('/api/academics/classes');
        setClasses(clsRes.classes || []);
      }
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const markRead = async (id: number) => {
    try {
      await apiRequest(`/api/comms/notifications/${id}/read`, { method: 'POST' });
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const markAll = async () => {
    try {
      await apiRequest('/api/comms/notifications/read-all', { method: 'POST' });
      toast(t('successSaved'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setBusy(true);
    try {
      const res = await apiRequest<{ recipientCount: number }>('/api/comms/notifications/send', {
        method: 'POST',
        body: JSON.stringify({
          title,
          message,
          target_type: targetType,
          class_id: classId ? Number(classId) : undefined,
        }),
      });
      toast(t('notificationSentCountMsg', { count: res.recipientCount }));
      setTitle('');
      setMessage('');
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {user?.role === 'admin' && (
        <form onSubmit={handleSend} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="font-display text-base font-bold text-slate-950 flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-700" />
            <span>{t('sendNotification')}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('targetAudienceLabel')}</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="all_users">{t('audienceAllUsers')}</option>
                <option value="all_students">{t('audienceAllStudents')}</option>
                <option value="all_teachers">{t('audienceAllTeachers')}</option>
                <option value="class">{t('audienceSpecificClass')}</option>
              </select>
            </div>
            {targetType === 'class' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t('classCol')}</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  required
                >
                  <option value="">{t('selectClassOpt')}</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.class_code})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={targetType === 'class' ? '' : 'md:col-span-2'}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('title')}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('announcementTitlePlaceholder')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">{t('messageLabel')}</label>
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('notificationContentPlaceholder')}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              required
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              <span>{t('sendNotification')}</span>
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-950">{t('menuNotifications')}</h2>
          <button type="button" onClick={() => void markAll()} className="text-xs font-semibold text-blue-700 hover:underline">
            {t('markAllRead')}
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">{t('noRecords')}</div>
          ) : (
            items.map((n) => (
              <div key={n.id} className={`p-4 flex items-start justify-between gap-4 ${n.is_read ? 'bg-white' : 'bg-blue-50/40'}`}>
                <div>
                  <div className="text-xs font-mono text-slate-500">
                    {n.type} · {n.created_at}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-0.5">{n.title}</h3>
                  <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                </div>
                {!n.is_read && (
                  <button
                    type="button"
                    onClick={() => void markRead(n.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 bg-white rounded-lg hover:bg-blue-50 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('markReadBtn')}</span>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ─── INTERNAL MESSAGING MODULE ───────────────────────────────────────────────
export const MessagesView: React.FC = () => {
  const { t, tRole, translateServerError } = useI18n();
  const { toast } = useFeedback();
  const [conversations, setConversations] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyAttach, setReplyAttach] = useState<{ url: string; original_name: string } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newRecipient, setNewRecipient] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [searchConv, setSearchConv] = useState('');

  const loadList = async () => {
    try {
      const [cRes, ctRes] = await Promise.all([
        apiRequest<{ conversations: any[] }>('/api/comms/messages/conversations'),
        apiRequest<{ contacts: any[] }>('/api/comms/messages/contacts'),
      ]);
      setConversations(cRes.conversations || []);
      setContacts(ctRes.contacts || []);
      if (!activeConvId && cRes.conversations?.length > 0) {
        setActiveConvId(cRes.conversations[0].id);
      }
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const loadThread = async (id: number) => {
    try {
      const res = await apiRequest<{ messages: any[] }>(`/api/comms/messages/conversations/${id}`);
      setMessages(res.messages || []);
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  useEffect(() => {
    void loadList();
  }, []);

  useEffect(() => {
    if (activeConvId) void loadThread(activeConvId);
  }, [activeConvId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipient || !newBody.trim()) return;
    try {
      const res = await apiRequest<{ id: number }>('/api/comms/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: Number(newRecipient), subject: newSubject || t('conversationFallback'), body: newBody }),
      });
      toast(t('messageSentMsg'));
      setShowNew(false);
      setNewSubject('');
      setNewBody('');
      await loadList();
      setActiveConvId(res.id);
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !replyText.trim()) return;
    try {
      await apiRequest(`/api/comms/messages/conversations/${activeConvId}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          body: replyText,
          attachment_url: replyAttach?.url || '',
          attachment_name: replyAttach?.original_name || '',
        }),
      });
      setReplyText('');
      setReplyAttach(null);
      void loadThread(activeConvId);
      void loadList();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const filteredConvs = conversations.filter((c) =>
    `${c.subject} ${c.other_participants}`.toLowerCase().includes(searchConv.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col max-h-[640px]">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-slate-950 flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-700" />
              <span>{t('menuMessages')}</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('newConversation')}</span>
            </button>
          </div>
          <input
            type="search"
            value={searchConv}
            onChange={(e) => setSearchConv(e.target.value)}
            placeholder={t('search')}
            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
          />
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredConvs.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">{t('noRecords')}</div>
          ) : (
            filteredConvs.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setShowNew(false);
                  setActiveConvId(c.id);
                }}
                className={`w-full text-start p-4 hover:bg-slate-50 transition-colors ${
                  activeConvId === c.id && !showNew ? 'bg-blue-50/70' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900 truncate">{c.other_participants || t('conversationFallback')}</span>
                  {c.unread_count > 0 && (
                    <span className="text-xs font-mono font-bold text-blue-700 tabular-nums">{t('newBadgeCount', { count: c.unread_count })}</span>
                  )}
                </div>
                <div className="text-xs font-medium text-slate-700 mt-0.5 truncate">{c.subject}</div>
                <div className="text-xs text-slate-500 mt-1 truncate">{c.last_message}</div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col min-h-[520px] max-h-[640px]">
        {showNew ? (
          <form onSubmit={handleCreate} className="p-6 space-y-4">
            <h3 className="font-display font-bold text-lg text-slate-950">{t('newConversation')}</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('recipientLabel')}</label>
              <select
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                required
              >
                <option value="">{t('selectRecipientOpt')}</option>
                {contacts.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.full_name} ({tRole(ct.role)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('subjectInputLabel')}</label>
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder={t('conversationSubjectPlaceholder')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('messageLabel')}</label>
              <textarea
                rows={4}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">
                {t('cancel')}
              </button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">
                {t('send')}
              </button>
            </div>
          </form>
        ) : activeConvId ? (
          <>
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="font-display font-bold text-slate-950">
                {conversations.find((c) => c.id === activeConvId)?.subject || t('conversationFallback')}
              </div>
              <div className="text-xs text-slate-500">
                {conversations.find((c) => c.id === activeConvId)?.other_participants}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
              {messages.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold text-slate-900">
                      {m.sender_name} · {tRole(m.sender_role)}
                    </span>
                    <span className="font-mono tabular-nums">{m.created_at}</span>
                  </div>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{m.body}</p>
                  {m.attachment_url && (
                    <a
                      href={m.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-2 text-xs font-medium text-blue-700 hover:underline"
                    >
                      {t('attachmentLabel')}: {m.attachment_name || t('download')}
                    </a>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={handleReply} className="p-4 border-t border-slate-200 bg-white space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={t('writeReplyPlaceholder')}
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 inline-flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>{t('send')}</span>
                </button>
              </div>
              <FileUploader label={t('attachFileOptional')} onUploaded={(m) => setReplyAttach({ url: m.url, original_name: m.original_name })} />
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500">{t('selectOrStartConversation')}</div>
        )}
      </div>
    </div>
  );
};

// ─── PROFILE & PASSWORD MODULE ───────────────────────────────────────────────
export const ProfileView: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { t, translateServerError } = useI18n();
  const { toast } = useFeedback();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [photoUrl, setPhotoUrl] = useState(user?.photo_url || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    setFullName(user?.full_name || '');
    setPhone(user?.phone || '');
    setPhotoUrl(user?.photo_url || '');
  }, [user?.full_name, user?.phone, user?.photo_url]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: fullName, phone, photo_url: photoUrl }),
      });
      await refreshUser();
      toast(t('profileUpdatedMsg'));
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast(t('passwordUpdatedMsg'));
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <form onSubmit={saveProfile} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="font-display font-bold text-slate-950 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-700" />
          <span>{t('menuProfile')}</span>
        </h2>

        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
          <div className="text-xs font-semibold text-slate-700">{t('profilePhotoTitle')}</div>
          <div className="flex flex-wrap items-center gap-4">
            <UserAvatar
              photoUrl={photoUrl}
              name={fullName || user?.full_name || 'U'}
              sizeClass="w-20 h-20"
              textClass="text-xl"
            />
            <div className="flex-1 min-w-[200px] space-y-2">
              <FileUploader
                imageOnly
                label={t('uploadProfilePhotoBtn')}
                onUploaded={(m) => setPhotoUrl(m.url)}
              />
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl('')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('removePhotoBtn')}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">{t('fullName')}</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">{t('phone')}</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" dir="ltr" />
        </div>
        <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800">
          {t('saveChangesBtn')}
        </button>
      </form>

      <form onSubmit={changePassword} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="font-display font-bold text-slate-950 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-blue-700" />
          <span>{t('changePasswordTitle')}</span>
        </h2>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">{t('currentPasswordLabel')}</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">{t('newPasswordMin8Label')}</label>
          <input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" required />
        </div>
        <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800">
          {t('updatePasswordBtn')}
        </button>
      </form>
    </div>
  );
};

// ─── REPORTS & REAL EXCEL EXPORT MODULE ──────────────────────────────────────
export const ReportsView: React.FC = () => {
  const { user } = useAuth();
  const { t, tStatus, tMethod, tRole, tReportColumn, translateServerError } = useI18n();

  const reportTypes =
    user?.role === 'admin'
      ? [
          { key: 'student_enrollment', labelKey: 'report_student_enrollment' as const },
          { key: 'student_attendance', labelKey: 'report_student_attendance' as const },
          { key: 'teacher_attendance', labelKey: 'report_teacher_attendance' as const },
          { key: 'class_capacity', labelKey: 'report_class_capacity' as const },
          { key: 'exam_results', labelKey: 'report_exam_results' as const },
          { key: 'homework_performance', labelKey: 'report_homework_performance' as const },
          { key: 'fee_payments', labelKey: 'report_fee_payments' as const },
          { key: 'outstanding_balances', labelKey: 'report_outstanding_balances' as const },
          { key: 'income', labelKey: 'report_income' as const },
          { key: 'expenses', labelKey: 'report_expenses' as const },
          { key: 'teacher_salaries', labelKey: 'report_teacher_salaries' as const },
          { key: 'certificates', labelKey: 'report_certificates' as const },
        ]
      : [
          { key: 'student_enrollment', labelKey: 'report_student_roster' as const },
          { key: 'student_attendance', labelKey: 'report_student_attendance' as const },
          { key: 'exam_results', labelKey: 'report_exam_results' as const },
          { key: 'homework_performance', labelKey: 'report_homework_performance' as const },
        ];

  const [selectedType, setSelectedType] = useState(reportTypes[0].key);
  const [data, setData] = useState<{ columns: string[]; rows: any[] }>({ columns: [], rows: [] });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadReport = async (typeKey: string) => {
    setErrorMsg(null);
    try {
      const res = await apiRequest<{ columns: string[]; rows: any[] }>(`/api/comms/reports/${typeKey}`);
      setData(res);
    } catch (err: any) {
      setData({ columns: [], rows: [] });
      setErrorMsg(translateServerError(err.message));
    }
  };

  useEffect(() => {
    void loadReport(selectedType);
  }, [selectedType]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-slate-700">{t('reportDatasetLabel')}</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            {reportTypes.map((rt) => (
              <option key={rt.key} value={rt.key}>
                {t(rt.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void downloadAuthenticatedFile(`/api/comms/reports/${selectedType}/excel`, `${selectedType}.xlsx`).catch(() => {})}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{t('exportExcel')} (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Printer className="w-4 h-4" />
            <span>{t('print')}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-4">
          <span className="text-xs text-red-700">{errorMsg}</span>
          <button type="button" onClick={() => void loadReport(selectedType)} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-700 rounded-lg">
            {t('retry')}
          </button>
        </div>
      )}

      <DataTable<Record<string, any>>
        rows={data.rows.map((r, i) => ({ ...r, id: i }))}
        columns={data.columns.map((col) => ({
          key: col,
          header: tReportColumn(col),
          sortValue: (row) => row[col] ?? '',
          render: (row) => {
            const val = row[col];
            if (val === null || val === undefined || val === '') return <span>—</span>;
            if (col === 'status' || col === 'payment_status') return <span>{tStatus(String(val))}</span>;
            if (col === 'payment_method') return <span>{tMethod(String(val))}</span>;
            if (col === 'role') return <span>{tRole(String(val))}</span>;
            if (col === 'is_late') return <span>{Number(val) ? t('lateTag') : t('onTime')}</span>;
            if (['amount', 'total_amount', 'discount_amount', 'paid_amount', 'balance_due', 'gross_amount', 'remaining_balance'].includes(col)) {
              return <span className="font-mono" dir="ltr">{formatCurrency(val)}</span>;
            }
            return <span>{String(val)}</span>;
          },
        }))}
      />
    </div>
  );
};
