import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  GraduationCap,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { apiRequest } from '../../utils/api';
import { formatCurrency } from '../../utils/eduLogic';
import { ChartCanvas } from '../ui/ChartCanvas';

interface DashboardOverviewProps {
  onNavigateSection: (key: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigateSection }) => {
  const { t, tStatus, tDay, translateServerError } = useI18n();
  const [data, setData] = useState<any>(null);
  const [financeChart, setFinanceChart] = useState<any>(null);
  const [financeError, setFinanceError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    setFinanceError('');
    try {
      const res = await apiRequest<any>('/api/comms/dashboard');
      setData(res);
      if (res.role === 'admin') {
        apiRequest<any>('/api/finance/summary')
          .then((fin) => setFinanceChart(fin))
          .catch((finErr: any) => {
            setFinanceError(finErr?.message ? translateServerError(finErr.message) : t('loadFailed'));
          });
      }
    } catch (err: any) {
      setError(err?.message ? translateServerError(err.message) : t('loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const monthlyConfig = useMemo(() => {
    const monthly = financeChart?.monthly_chart || [];
    return {
      type: 'bar' as const,
      data: {
        labels: monthly.length > 0 ? monthly.map((m: any) => m.month) : [t('noData')],
        datasets: [
          {
            label: t('kpiTotalIncome'),
            data: monthly.length > 0 ? monthly.map((m: any) => m.income) : [0],
            backgroundColor: '#1d4ed8',
            borderRadius: 6,
          },
          {
            label: t('kpiTotalExpenses'),
            data: monthly.length > 0 ? monthly.map((m: any) => m.expenses) : [0],
            backgroundColor: '#dc2626',
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const } },
      },
    };
  }, [financeChart, t]);

  const attendanceConfig = useMemo(() => {
    const breakdown: Array<{ status: string; cnt: number }> = data?.attendanceBreakdown || [];
    const colorMap: Record<string, string> = {
      present: '#059669',
      absent: '#dc2626',
      late: '#d97706',
      excused: '#2563eb',
    };
    return {
      type: 'doughnut' as const,
      data: {
        labels: breakdown.length ? breakdown.map((b) => tStatus(b.status)) : [t('present')],
        datasets: [
          {
            data: breakdown.length ? breakdown.map((b) => b.cnt) : [0],
            backgroundColor: breakdown.length
              ? breakdown.map((b) => colorMap[String(b.status).toLowerCase()] || '#64748b')
              : ['#059669'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' as const } },
      },
    };
  }, [data, t, tStatus]);

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">{t('loading')}</div>;
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex flex-wrap items-center justify-between gap-4">
        <span className="text-sm font-medium text-red-700">{error || t('loadFailed')}</span>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  // ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────
  if (data.role === 'admin') {
    const k = data.kpis;
    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => onNavigateSection('students')}
            className="text-start rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>{t('kpiTotalStudents')}</span>
              <Users className="w-4 h-4 text-blue-700" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-slate-950 tabular-nums">{k.totalStudents}</div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">{k.activeStudents} {t('active')}</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateSection('teachers')}
            className="text-start rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>{t('kpiTeachers')}</span>
              <UserCheck className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-slate-950 tabular-nums">{k.totalTeachers}</div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">{k.totalClasses} {t('kpiClasses')} · {k.totalCourses} {t('kpiCourses')}</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateSection('accounting')}
            className="text-start rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>{t('kpiTotalIncome')}</span>
              <TrendingUp className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-emerald-700 font-mono tabular-nums" dir="ltr">
              {formatCurrency(k.totalIncome)}
            </div>
            <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
              {t('kpiNetBalance')}:{' '}
              <span dir="ltr" className="inline-block">
                {Number(k.netBalance) < 0 ? '-' : ''}{formatCurrency(Math.abs(Number(k.netBalance)))}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateSection('finance')}
            className="text-start rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>{t('kpiOutstandingFees')}</span>
              <Wallet className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-amber-700 font-mono tabular-nums" dir="ltr">
              {formatCurrency(k.outstandingFees)}
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">
              {k.pendingResets} {t('resetRequestsBadge')} · {k.pendingSubmissions} {t('ungradedHomeworkBadge')}
            </div>
          </button>
        </div>

        {/* Chart.js Analytical Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-display font-bold text-slate-950 text-sm mb-4">{t('chartMonthlyFinance')}</h3>
            {financeError ? (
              <div className="h-64 flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
                {financeError}
              </div>
            ) : (
              <ChartCanvas config={monthlyConfig} heightClass="h-64" label={t('chartMonthlyFinance')} />
            )}
          </div>
          <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-display font-bold text-slate-950 text-sm mb-4">{t('chartAttendanceSummary')}</h3>
            <ChartCanvas config={attendanceConfig} heightClass="h-64" label={t('chartAttendanceSummary')} />
          </div>
        </div>

        {/* Recent Students & Recent Audit Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-slate-950 text-sm">{t('recentRegistrations')}</h3>
              <button type="button" onClick={() => onNavigateSection('students')} className="text-xs font-semibold text-blue-700 hover:underline">
                {t('viewAll')}
              </button>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {(data.recentStudents || []).map((s: any) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{s.first_name} {s.last_name}</div>
                    <div className="font-mono text-slate-500">{s.student_code}</div>
                  </div>
                  <span className="font-mono text-slate-500">{s.admission_date}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-slate-950 text-sm">{t('recentSystemActivity')}</h3>
              <button type="button" onClick={() => onNavigateSection('audit-logs')} className="text-xs font-semibold text-blue-700 hover:underline">
                {t('menuAuditLogs')}
              </button>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {(data.recentActivities || []).map((a: any) => (
                <div key={a.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono font-semibold text-blue-800">{a.action}</span>
                    <span className="mx-1.5 text-slate-400">·</span>
                    <span className="text-slate-700">{a.user_name}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 shrink-0">{a.created_at}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── TEACHER DASHBOARD ────────────────────────────────────────────────────
  if (data.role === 'teacher') {
    const k = data.kpis;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{t('kpiAssignedClasses')}</span>
              <GraduationCap className="w-4 h-4 text-blue-700" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-slate-950 tabular-nums">{k.assignedClasses}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{t('kpiAssignedStudents')}</span>
              <Users className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-slate-950 tabular-nums">{k.assignedStudents}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{t('menuTimetable')}</span>
              <CalendarClock className="w-4 h-4 text-blue-700" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-slate-950 tabular-nums">{k.timetableCount}</div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateSection('homework')}
            className="text-start rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300"
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{t('kpiPendingReviews')}</span>
              <ClipboardList className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-amber-700 tabular-nums">{k.pendingReviews}</div>
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-slate-950 text-sm">{t('myTeachingSchedule')}</h3>
            <button type="button" onClick={() => onNavigateSection('timetable')} className="text-xs font-semibold text-blue-700 hover:underline">
              {t('fullTimetable')}
            </button>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {(data.timetable || []).map((tt: any) => (
              <div key={tt.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900">{tt.class_name}</span>
                  <span className="mx-2 text-slate-400">·</span>
                  <span className="text-slate-700">{tt.subject_name}</span>
                </div>
                <div className="font-mono text-slate-600">
                  {tDay(tt.day_of_week)} · {tt.start_time}–{tt.end_time} ({tt.room})
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── STUDENT DASHBOARD ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{t('activeEnrollments')}</span>
            <BookOpen className="w-4 h-4 text-blue-700" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-slate-950 tabular-nums">{(data.enrollments || []).length}</div>
        </div>
        <button
          type="button"
          onClick={() => onNavigateSection('homework')}
          className="text-start rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{t('kpiPendingHomework')}</span>
            <ClipboardList className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-amber-700 tabular-nums">{data.pendingHomework || 0}</div>
        </button>
        <button
          type="button"
          onClick={() => onNavigateSection('finance')}
          className="text-start rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{t('kpiMyBalance')}</span>
            <CreditCard className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-slate-950 font-mono tabular-nums" dir="ltr">
            {Number(data.finance?.balance || 0) < 0 ? '-' : ''}{formatCurrency(Math.abs(Number(data.finance?.balance || 0)))}
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-display font-bold text-slate-950 text-sm mb-3">{t('registeredCoursesClasses')}</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {(data.enrollments || []).map((e: any) => (
              <div key={e.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{e.course_title}</div>
                  <div className="text-slate-600">{e.class_name}</div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-display font-bold text-slate-950 text-sm mb-3">{t('recentPublishedGrades')}</h3>
          {(data.recentGrades || []).length === 0 ? (
            <div className="text-xs text-slate-500">{t('noRecords')}</div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {data.recentGrades.map((g: any, i: number) => (
                <div key={i} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{g.title}</div>
                    <div className="text-slate-500">{g.subject_name} · {g.exam_date}</div>
                  </div>
                  <div className="font-mono font-bold text-blue-800">{g.score} / {g.max_score}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
