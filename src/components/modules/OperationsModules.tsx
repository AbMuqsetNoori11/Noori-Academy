import React, { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, FileText, FolderLock, GraduationCap, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { apiRequest, downloadAuthenticatedFile } from '../../utils/api';
import { useFeedback } from '../ui/ToastAndConfirm';
import { DataTable } from '../ui/DataTable';
import { FileUploader } from '../ui/FileUploader';

// ─── ATTENDANCE MODULE ───────────────────────────────────────────────────────
export const AttendanceModule: React.FC = () => {
  const { user } = useAuth();
  const { t, tStatus, tSession, translateServerError } = useI18n();
  const { toast } = useFeedback();

  const [tab, setTab] = useState<'students' | 'teachers'>('students');
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sessionLabel, setSessionLabel] = useState('Morning');
  const [roster, setRoster] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [teacherRecords, setTeacherRecords] = useState<any[]>([]);
  const [tchForm, setTchForm] = useState({ teacher_id: '', attendance_date: new Date().toISOString().slice(0, 10), status: 'present', check_in_time: '08:15', check_out_time: '15:30', remarks: '' });

  const loadHistory = async () => {
    try {
      const res = await apiRequest<{ records: any[] }>('/api/operations/attendance/students');
      setRecords(res.records || []);
      if (user?.role !== 'student') {
        const clsRes = await apiRequest<{ classes: any[] }>('/api/academics/classes');
        setClasses(clsRes.classes || []);
        const tAtt = await apiRequest<{ records: any[] }>('/api/operations/attendance/teachers');
        setTeacherRecords(tAtt.records || []);
        if (user?.role === 'admin') {
          const tRes = await apiRequest<{ teachers: any[] }>('/api/academics/teachers');
          setTeachers(tRes.teachers || []);
        }
      }
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const loadRoster = async () => {
    if (!selectedClass || !date) return;
    try {
      const res = await apiRequest<{ roster: any[] }>(
        `/api/operations/attendance/students?class_id=${selectedClass}&date=${date}&session_label=${encodeURIComponent(sessionLabel)}`
      );
      setRoster(res.roster || []);
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const saveRoster = async () => {
    try {
      const res = await apiRequest<{ count: number; corrections: number }>('/api/operations/attendance/students', {
        method: 'POST',
        body: JSON.stringify({
          class_id: Number(selectedClass),
          attendance_date: date,
          session_label: sessionLabel,
          entries: roster.map((r) => ({ student_id: r.student_id, status: r.status, remarks: r.remarks })),
        }),
      });
      toast(
        res.corrections
          ? t('savedAttendanceCorrectionsMsg', { count: res.count, corrections: res.corrections })
          : t('savedAttendanceMsg', { count: res.count })
      );
      void loadHistory();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const saveTeacherAtt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/operations/attendance/teachers', {
        method: 'POST',
        body: JSON.stringify({ ...tchForm, teacher_id: tchForm.teacher_id ? Number(tchForm.teacher_id) : undefined }),
      });
      toast(t('teacherAttendanceSavedMsg'));
      void loadHistory();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  if (user?.role === 'student') {
    return (
      <DataTable
        rows={records}
        onPrint={() => window.print()}
        columns={[
          { key: 'date', header: t('date'), sortValue: (r) => r.attendance_date, render: (r) => <span className="font-mono">{r.attendance_date}</span> },
          { key: 'class', header: t('classCol'), render: (r) => <span>{r.class_name}</span> },
          { key: 'session', header: t('sessionCol'), render: (r) => <span>{tSession(r.session_label)}</span> },
          { key: 'status', header: t('status'), render: (r) => <span className="font-semibold">{tStatus(r.status)}</span> },
          { key: 'remarks', header: t('remarksCol'), render: (r) => <span className="text-xs text-slate-500">{r.remarks}</span> },
        ]}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg no-print">
        <button type="button" onClick={() => setTab('students')} className={`px-3.5 py-1.5 text-xs font-semibold rounded-md ${tab === 'students' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}>
          {t('studentAttendanceTab')}
        </button>
        <button type="button" onClick={() => setTab('teachers')} className={`px-3.5 py-1.5 text-xs font-semibold rounded-md ${tab === 'teachers' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}>
          {t('teacherAttendanceTab')}
        </button>
      </div>

      {tab === 'students' ? (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 no-print">
            <h3 className="font-display font-bold text-slate-950 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-blue-700" />
              <span>{t('markEditAttendance')}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="">{t('selectClassOpt')}</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              <select value={sessionLabel} onChange={(e) => setSessionLabel(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="Morning">{t('sessionMorning')}</option>
                <option value="Afternoon">{t('sessionAfternoon')}</option>
              </select>
              <button type="button" onClick={() => void loadRoster()} className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800">
                {t('loadStudentRoster')}
              </button>
            </div>

            {roster.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {roster.map((stu, idx) => (
                    <div key={stu.student_id} className="p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div>
                        <span className="font-mono text-xs text-slate-500 me-2">{stu.student_code}</span>
                        <span className="font-semibold text-slate-900">{stu.first_name} {stu.last_name}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {(['present', 'absent', 'late', 'excused'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setRoster((prev) => prev.map((r, i) => (i === idx ? { ...r, status: st } : r)))}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${
                              stu.status === st
                                ? st === 'present'
                                  ? 'bg-emerald-700 text-white border-emerald-700'
                                  : st === 'absent'
                                  ? 'bg-red-600 text-white border-red-600'
                                  : st === 'late'
                                  ? 'bg-amber-600 text-white border-amber-600'
                                  : 'bg-blue-700 text-white border-blue-700'
                                : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            {t(st)}
                          </button>
                        ))}
                        <input
                          placeholder={t('remarksCol')}
                          value={stu.remarks || ''}
                          onChange={(e) => setRoster((prev) => prev.map((r, i) => (i === idx ? { ...r, remarks: e.target.value } : r)))}
                          className="px-2.5 py-1 text-xs border border-slate-300 rounded-md w-40"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => void saveRoster()} className="px-4 py-2 text-sm font-semibold text-white bg-slate-950 rounded-lg hover:bg-slate-800">
                    {t('saveClassAttendance')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <DataTable
            rows={records}
            onExportExcel={() => void downloadAuthenticatedFile('/api/comms/reports/student_attendance/excel', 'student_attendance.xlsx').catch(() => {})}
            onPrint={() => window.print()}
            columns={[
              { key: 'date', header: t('date'), sortValue: (r) => r.attendance_date, render: (r) => <span className="font-mono">{r.attendance_date}</span> },
              { key: 'class', header: t('classCol'), render: (r) => <span>{r.class_name}</span> },
              { key: 'stu', header: t('studentCol'), render: (r) => <span>{r.student_code} · {r.student_name}</span> },
              { key: 'status', header: t('status'), render: (r) => <span className="font-semibold">{tStatus(r.status)}</span> },
              { key: 'remarks', header: t('remarksCol'), render: (r) => <span className="text-xs text-slate-500">{r.remarks}</span> },
            ]}
          />
        </>
      ) : (
        <div className="space-y-4">
          <form onSubmit={saveTeacherAtt} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h3 className="font-display font-bold text-slate-950">{t('recordTeacherAttendance')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm">
              {user?.role === 'admin' && (
                <select required value={tchForm.teacher_id} onChange={(e) => setTchForm({ ...tchForm, teacher_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                  <option value="">{t('selectTeacherOpt')}</option>
                  {teachers.map((tch) => <option key={tch.id} value={tch.id}>{tch.first_name} {tch.last_name}</option>)}
                </select>
              )}
              <input type="date" value={tchForm.attendance_date} onChange={(e) => setTchForm({ ...tchForm, attendance_date: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              <select value={tchForm.status} onChange={(e) => setTchForm({ ...tchForm, status: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="present">{t('present')}</option>
                <option value="absent">{t('absent')}</option>
                <option value="late">{t('late')}</option>
                <option value="excused">{t('excused')}</option>
              </select>
              <input type="time" value={tchForm.check_in_time} onChange={(e) => setTchForm({ ...tchForm, check_in_time: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">{t('save')}</button>
            </div>
          </form>
          <DataTable
            rows={teacherRecords}
            columns={[
              { key: 'date', header: t('date'), render: (r) => <span className="font-mono">{r.attendance_date}</span> },
              { key: 'tch', header: t('teacherCol'), render: (r) => <span className="font-semibold">{r.teacher_name}</span> },
              { key: 'in', header: t('checkInCol'), render: (r) => <span className="font-mono">{r.check_in_time}</span> },
              { key: 'status', header: t('status'), render: (r) => <span className="font-semibold">{tStatus(r.status)}</span> },
            ]}
          />
        </div>
      )}
    </div>
  );
};

// ─── EXAMINATIONS & CONFIGURABLE GRADING MODULE ──────────────────────────────
export const ExamsAndGradesModule: React.FC = () => {
  const { user } = useAuth();
  const { t, translateServerError } = useI18n();
  const { toast } = useFeedback();

  const [exams, setExams] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [activeExamId, setActiveExamId] = useState<number | null>(null);
  const [gradeRoster, setGradeRoster] = useState<any[]>([]);
  const [examForm, setExamForm] = useState({ title: '', class_id: '', subject_id: '', exam_date: new Date().toISOString().slice(0, 10), max_score: '100', passing_score: '50' });
  const [showRules, setShowRules] = useState(false);

  const load = async () => {
    try {
      const [exRes, rRes] = await Promise.all([
        apiRequest<{ exams: any[] }>('/api/operations/exams'),
        apiRequest<{ rules: any[] }>('/api/operations/grading-rules'),
      ]);
      setExams(exRes.exams || []);
      setRules(rRes.rules || []);
      if (user?.role !== 'student') {
        const [cRes, sRes] = await Promise.all([
          apiRequest<{ classes: any[] }>('/api/academics/classes'),
          apiRequest<{ subjects: any[] }>('/api/academics/subjects'),
        ]);
        setClasses(cRes.classes || []);
        setSubjects(sRes.subjects || []);
      }
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const loadGrades = async (examId: number) => {
    try {
      setActiveExamId(examId);
      const res = await apiRequest<{ grades: any[] }>(`/api/operations/exams/${examId}/grades`);
      setGradeRoster(res.grades || []);
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const createExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/operations/exams', {
        method: 'POST',
        body: JSON.stringify({
          ...examForm,
          class_id: Number(examForm.class_id),
          subject_id: Number(examForm.subject_id),
          max_score: Number(examForm.max_score),
          passing_score: Number(examForm.passing_score),
        }),
      });
      toast(t('examCreatedMsg'));
      setExamForm({ ...examForm, title: '' });
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const saveGrades = async (publish: boolean) => {
    if (!activeExamId) return;
    try {
      await apiRequest(`/api/operations/exams/${activeExamId}/grades`, {
        method: 'POST',
        body: JSON.stringify({
          is_published: publish,
          grades: gradeRoster.map((g) => ({ student_id: g.student_id, score: g.score, feedback: g.feedback })),
        }),
      });
      toast(publish ? t('gradesPublishedMsg') : t('gradesDraftMsg'));
      void loadGrades(activeExamId);
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const saveRules = async () => {
    try {
      await apiRequest('/api/operations/grading-rules', {
        method: 'PUT',
        body: JSON.stringify({ rules }),
      });
      toast(t('gradingRulesUpdatedMsg'));
      setShowRules(false);
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  return (
    <div className="space-y-6">
      {user?.role === 'admin' && (
        <div className="flex justify-end no-print">
          <button type="button" onClick={() => setShowRules((v) => !v)} className="px-3.5 py-1.5 text-xs font-semibold border border-slate-300 bg-white rounded-lg hover:bg-slate-50">
            {t('configureGradingScale', { count: rules.length })}
          </button>
        </div>
      )}

      {showRules && user?.role === 'admin' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="font-display font-bold text-slate-950">{t('configurableGradingRules')}</h3>
          <div className="space-y-2">
            {rules.map((r, idx) => (
              <div key={idx} className="grid grid-cols-5 gap-2 text-xs">
                <input value={r.grade_letter} onChange={(e) => setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, grade_letter: e.target.value } : x)))} className="px-2 py-1.5 border border-slate-300 rounded" placeholder={t('letterPlaceholder')} />
                <input type="number" value={r.min_percent} onChange={(e) => setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, min_percent: Number(e.target.value) } : x)))} className="px-2 py-1.5 border border-slate-300 rounded font-mono" placeholder={t('minPercentPlaceholder')} />
                <input type="number" value={r.max_percent} onChange={(e) => setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, max_percent: Number(e.target.value) } : x)))} className="px-2 py-1.5 border border-slate-300 rounded font-mono" placeholder={t('maxPercentPlaceholder')} />
                <input type="number" step="0.1" value={r.gpa_points} onChange={(e) => setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, gpa_points: Number(e.target.value) } : x)))} className="px-2 py-1.5 border border-slate-300 rounded font-mono" placeholder={t('gpaPlaceholder')} />
                <input value={r.description} onChange={(e) => setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))} className="px-2 py-1.5 border border-slate-300 rounded" placeholder={t('labelPlaceholder')} />
              </div>
            ))}
          </div>
          <button type="button" onClick={() => void saveRules()} className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">{t('saveGradingRules')}</button>
        </div>
      )}

      {user?.role !== 'student' && (
        <form onSubmit={createExam} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 no-print">
          <h3 className="font-display font-bold text-slate-950 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-700" />
            <span>{t('createExamination')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm">
            <input required placeholder={t('examTitlePlaceholder')} value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded-lg" />
            <select required value={examForm.class_id} onChange={(e) => setExamForm({ ...examForm, class_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="">{t('classOpt')}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select required value={examForm.subject_id} onChange={(e) => setExamForm({ ...examForm, subject_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="">{t('subjectOpt')}</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="date" required value={examForm.exam_date} onChange={(e) => setExamForm({ ...examForm, exam_date: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
          </div>
          <div className="flex items-center gap-3">
            <input type="number" value={examForm.max_score} onChange={(e) => setExamForm({ ...examForm, max_score: e.target.value })} className="w-28 px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-mono" placeholder={t('maxScorePlaceholder')} />
            <input type="number" value={examForm.passing_score} onChange={(e) => setExamForm({ ...examForm, passing_score: e.target.value })} className="w-28 px-3 py-1.5 text-sm border border-slate-300 rounded-lg font-mono" placeholder={t('passingScorePlaceholder')} />
            <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">{t('createExamBtn')}</button>
          </div>
        </form>
      )}

      <DataTable
        rows={exams}
        onExportExcel={() => void downloadAuthenticatedFile('/api/comms/reports/exam_results/excel', 'exam_results.xlsx').catch(() => {})}
        onPrint={() => window.print()}
        columns={[
          { key: 'date', header: t('date'), render: (r) => <span className="font-mono">{r.exam_date}</span> },
          { key: 'title', header: t('examinationCol'), render: (r) => <span className="font-semibold">{r.title}</span> },
          { key: 'class', header: t('classSubjectCol'), render: (r) => <span>{r.class_name} · {r.subject_name}</span> },
          { key: 'max', header: t('maxPassCol'), align: 'end', render: (r) => <span className="font-mono">{r.max_score} / {r.passing_score}</span> },
          { key: 'pub', header: t('publishedCol'), render: (r) => <span className={r.is_published ? 'text-emerald-700 font-semibold text-xs' : 'text-amber-700 text-xs'}>{r.is_published ? t('statusPublished') : t('statusDraft')}</span> },
          {
            key: 'act',
            header: t('actions'),
            render: (r) => (
              <button type="button" onClick={() => void loadGrades(r.id)} className="px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50">
                {user?.role === 'student' ? t('viewResultBtn') : t('enterGradesBtn')}
              </button>
            ),
          },
        ]}
      />

      {activeExamId && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-950">{t('examinationGrades')}</h3>
            {user?.role !== 'student' && (
              <div className="flex gap-2">
                <button type="button" onClick={() => void saveGrades(false)} className="px-3.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg">{t('saveDraftBtn')}</button>
                <button type="button" onClick={() => void saveGrades(true)} className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg">{t('savePublishBtn')}</button>
              </div>
            )}
          </div>
          {gradeRoster.length === 0 ? (
            <p className="text-sm text-slate-500">{t('noGradesOrUnpublished')}</p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {gradeRoster.map((g, idx) => (
                <div key={g.student_id} className="p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div>
                    <span className="font-mono text-xs text-slate-500 me-2">{g.student_code}</span>
                    <span className="font-semibold">{g.student_name}</span>
                  </div>
                  {user?.role === 'student' ? (
                    <div className="font-mono font-bold text-slate-900">
                      {g.score} ({g.evaluated?.gradeLetter} · {g.evaluated?.percent}%) {g.feedback ? `— ${g.feedback}` : ''}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        value={g.score ?? ''}
                        onChange={(e) => setGradeRoster((prev) => prev.map((x, i) => (i === idx ? { ...x, score: e.target.value } : x)))}
                        placeholder={t('scorePlaceholder')}
                        className="w-24 px-2.5 py-1 border border-slate-300 rounded-md font-mono"
                      />
                      <span className="font-mono text-xs w-14 text-slate-600">{g.evaluated ? `${g.evaluated.gradeLetter}` : '—'}</span>
                      <input
                        value={g.feedback || ''}
                        onChange={(e) => setGradeRoster((prev) => prev.map((x, i) => (i === idx ? { ...x, feedback: e.target.value } : x)))}
                        placeholder={t('teacherFeedbackPlaceholder')}
                        className="w-56 px-2.5 py-1 border border-slate-300 rounded-md text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── HOMEWORK MODULE ─────────────────────────────────────────────────────────
export const HomeworkModule: React.FC = () => {
  const { user } = useAuth();
  const { t, tStatus, translateServerError } = useI18n();
  const { toast } = useFeedback();
  const [items, setItems] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [form, setForm] = useState({ title: '', description: '', class_id: '', subject_id: '', teacher_id: '', due_date: '', attachment_url: '', attachment_name: '' });
  const [activeHwId, setActiveHwId] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [studentSubmitId, setStudentSubmitId] = useState<number | null>(null);
  const [respText, setRespText] = useState('');
  const [respAttach, setRespAttach] = useState<{ url: string; original_name: string } | null>(null);

  const load = async () => {
    try {
      const res = await apiRequest<{ homework: any[] }>('/api/operations/homework');
      setItems(res.homework || []);
      if (user?.role !== 'student') {
        const [cRes, sRes] = await Promise.all([
          apiRequest<{ classes: any[] }>('/api/academics/classes'),
          apiRequest<{ subjects: any[] }>('/api/academics/subjects'),
        ]);
        setClasses(cRes.classes || []);
        setSubjects(sRes.subjects || []);
        if (user?.role === 'admin') {
          const tRes = await apiRequest<{ teachers: any[] }>('/api/academics/teachers');
          setTeachers(tRes.teachers || []);
        }
      }
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const createHw = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/operations/homework', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          class_id: Number(form.class_id),
          subject_id: Number(form.subject_id),
          teacher_id: form.teacher_id ? Number(form.teacher_id) : undefined,
        }),
      });
      toast(t('homeworkCreatedMsg'));
      setForm({ title: '', description: '', class_id: '', subject_id: '', teacher_id: '', due_date: '', attachment_url: '', attachment_name: '' });
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const viewSubmissions = async (hwId: number) => {
    try {
      setActiveHwId(hwId);
      const res = await apiRequest<{ submissions: any[] }>(`/api/operations/homework/${hwId}/submissions`);
      setSubmissions(res.submissions || []);
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  const submitStudentHw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentSubmitId) return;
    try {
      const res = await apiRequest<{ is_late: boolean }>(`/api/operations/homework/${studentSubmitId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          response_text: respText,
          attachment_url: respAttach?.url || '',
          attachment_name: respAttach?.original_name || '',
        }),
      });
      toast(res.is_late ? t('homeworkSubmittedLateMsg') : t('homeworkSubmittedOnTimeMsg'));
      setStudentSubmitId(null);
      setRespText('');
      setRespAttach(null);
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  return (
    <div className="space-y-6">
      {user?.role !== 'student' && (
        <form onSubmit={createHw} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="font-display font-bold text-slate-950 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-700" />
            <span>{t('assignHomework')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
            <input required placeholder={t('homeworkTitlePlaceholder')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="sm:col-span-2 px-3 py-2 border border-slate-300 rounded-lg" />
            <select required value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="">{t('classOpt')}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select required value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="">{t('subjectOpt')}</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {user?.role === 'admin' && (
              <select required value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="">{t('teacherOpt')}</option>
                {teachers.map((tch) => <option key={tch.id} value={tch.id}>{tch.first_name} {tch.last_name}</option>)}
              </select>
            )}
            <input type="date" required value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
            <div className="sm:col-span-2">
              <FileUploader label={t('attachRefFileOptional')} onUploaded={(m) => setForm({ ...form, attachment_url: m.url, attachment_name: m.original_name })} />
            </div>
          </div>
          <textarea rows={2} placeholder={t('homeworkInstructionsPlaceholder')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">{t('createAssignmentBtn')}</button>
        </form>
      )}

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            {t('noRecords')}
          </div>
        ) : (
          items.map((hw) => (
            <div key={hw.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-mono text-slate-500">
                    {hw.class_name} · {hw.subject_name} · {t('duePrefix')} {hw.due_date}
                  </div>
                  <h4 className="font-display font-bold text-slate-950 text-base mt-0.5">{hw.title}</h4>
                  <p className="text-sm text-slate-600 mt-1">{hw.description}</p>
                  {hw.attachment_url && (
                    <a href={hw.attachment_url} target="_blank" rel="noreferrer" className="inline-block mt-1.5 text-xs font-semibold text-blue-700 hover:underline">
                      {t('downloadResourcePrefix')} {hw.attachment_name || t('attachmentLabel')}
                    </a>
                  )}
                </div>

                {user?.role === 'student' ? (
                  <div className="text-end">
                    {hw.submission_id ? (
                      <div className="text-xs space-y-1">
                        <div className="font-semibold text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{tStatus(hw.submission_status)} {hw.is_late ? `(${t('lateTag')})` : ''}</span>
                        </div>
                        {hw.score !== null && <div className="font-mono font-bold text-slate-900">{t('gradeLabel')} {hw.score} / {hw.max_score}</div>}
                        {hw.feedback && <div className="text-slate-600">{hw.feedback}</div>}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStudentSubmitId(hw.id)}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
                      >
                        {t('submitHomeworkBtn')}
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void viewSubmissions(hw.id)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    {t('reviewSubmissionsCount', { count: hw.submission_count })}
                  </button>
                )}
              </div>

              {studentSubmitId === hw.id && (
                <form onSubmit={submitStudentHw} className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                  <textarea required rows={3} placeholder={t('writeResponsePlaceholder')} value={respText} onChange={(e) => setRespText(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                  <FileUploader label={t('attachHomeworkFile')} onUploaded={(m) => setRespAttach({ url: m.url, original_name: m.original_name })} />
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setStudentSubmitId(null)} className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg">{t('cancel')}</button>
                    <button type="submit" className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg">{t('submit')}</button>
                  </div>
                </form>
              )}
            </div>
          ))
        )}
      </div>

      {activeHwId && user?.role !== 'student' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="font-display font-bold text-slate-950">{t('studentSubmissionsTitle')}</h3>
          {submissions.length === 0 ? (
            <p className="text-sm text-slate-500">{t('noSubmissionsYet')}</p>
          ) : (
            submissions.map((sub) => (
              <SubmissionGraderRow key={sub.id} sub={sub} onGraded={() => void viewSubmissions(activeHwId)} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const SubmissionGraderRow: React.FC<{ sub: any; onGraded: () => void }> = ({ sub, onGraded }) => {
  const { t, translateServerError } = useI18n();
  const { toast } = useFeedback();
  const [score, setScore] = useState(sub.score ?? '');
  const [feedback, setFeedback] = useState(sub.feedback || '');

  const save = async () => {
    try {
      await apiRequest(`/api/operations/homework/submissions/${sub.id}/grade`, {
        method: 'POST',
        body: JSON.stringify({ score, feedback }),
      });
      toast(t('submissionGradedMsg'));
      onGraded();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  return (
    <div className="p-4 rounded-lg border border-slate-200 space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-950">{sub.student_code} · {sub.student_name}</span>
        <span className="font-mono text-xs text-slate-500">{sub.submitted_at} {sub.is_late ? `· ${t('lateTag')}` : ''}</span>
      </div>
      <p className="text-slate-700">{sub.response_text}</p>
      {sub.attachment_url && (
        <a href={sub.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 hover:underline">
          {t('attachmentLabel')}: {sub.attachment_name}
        </a>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <input type="number" placeholder={t('scorePlaceholder')} value={score} onChange={(e) => setScore(e.target.value)} className="w-24 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-mono" />
        <input placeholder={t('teacherFeedbackPlaceholder')} value={feedback} onChange={(e) => setFeedback(e.target.value)} className="flex-1 min-w-[200px] px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg" />
        <button type="button" onClick={() => void save()} className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg">{t('saveGradeBtn')}</button>
      </div>
    </div>
  );
};

// ─── DOCUMENT MANAGEMENT MODULE ──────────────────────────────────────────────
export const DocumentsModule: React.FC = () => {
  const { user } = useAuth();
  const { t, tStatus, translateServerError } = useI18n();
  const { toast } = useFeedback();
  const [docs, setDocs] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('academic');
  const [fileMeta, setFileMeta] = useState<{ url: string; original_name: string; mime_type: string; file_size: number } | null>(null);

  const load = async () => {
    try {
      const res = await apiRequest<{ documents: any[] }>('/api/academics/documents');
      setDocs(res.documents || []);
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const saveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !fileMeta) return;
    try {
      await apiRequest('/api/academics/documents', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category,
          file_path: fileMeta.url,
          original_name: fileMeta.original_name,
          mime_type: fileMeta.mime_type,
          file_size: fileMeta.file_size,
        }),
      });
      toast(t('documentArchivedMsg'));
      setTitle('');
      setFileMeta(null);
      void load();
    } catch (err: any) {
      toast(translateServerError(err.message), 'error');
    }
  };

  return (
    <div className="space-y-6">
      {user?.role !== 'student' && (
        <form onSubmit={saveDoc} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="font-display font-bold text-slate-950 flex items-center gap-2">
            <FolderLock className="w-4 h-4 text-blue-700" />
            <span>{t('uploadAuthorizedDoc')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <input required placeholder={t('documentTitlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="academic">{t('docCatAcademic')}</option>
              <option value="identity">{t('docCatIdentity')}</option>
              <option value="contract">{t('docCatContract')}</option>
              <option value="general">{t('docCatGeneral')}</option>
            </select>
            <FileUploader label={t('chooseDocFile')} onUploaded={setFileMeta} />
          </div>
          <button type="submit" disabled={!fileMeta} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg disabled:opacity-50">
            <Upload className="w-3.5 h-3.5" />
            <span>{t('saveDocumentBtn')}</span>
          </button>
        </form>
      )}

      <DataTable
        rows={docs}
        columns={[
          { key: 'title', header: t('title'), render: (r) => <span className="font-semibold">{r.title}</span> },
          { key: 'cat', header: t('category'), render: (r) => <span className="text-xs">{tStatus(r.category)}</span> },
          { key: 'file', header: t('originalFileCol'), render: (r) => <span className="text-xs font-mono">{r.original_name}</span> },
          { key: 'size', header: t('sizeCol'), align: 'end', render: (r) => <span className="font-mono text-xs">{Math.round(r.file_size / 1024)} KB</span> },
          {
            key: 'dl',
            header: t('actions'),
            render: (r) => (
              <a href={r.file_path} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-700 hover:underline">
                {t('download')}
              </a>
            ),
          },
        ]}
      />
    </div>
  );
};
