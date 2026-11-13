import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, Printer, Receipt, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { apiRequest, downloadAuthenticatedFile } from '../../utils/api';
import { computeFeeSummary, formatCurrency } from '../../utils/eduLogic';
import { useFeedback } from '../ui/ToastAndConfirm';
import { DataTable } from '../ui/DataTable';
import { ChartCanvas } from '../ui/ChartCanvas';

// ─── STUDENT FEES, INSTALLMENT PAYMENTS & RECEIPT PRINTING ───────────────────
export const StudentFeesAndPaymentsModule: React.FC = () => {
  const { user } = useAuth();
  const { t, tStatus, tMethod, translateServerError } = useI18n();
  const { toast } = useFeedback();

  const [fees, setFees] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [payModalFee, setPayModalFee] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [receiptModal, setReceiptModal] = useState<any>(null);
  const [newFeeForm, setNewFeeForm] = useState({ student_id: '', title: '', total_amount: '', discount_amount: '0', due_date: '' });

  const load = async () => {
    try {
      const res = await apiRequest<{ studentFees: any[]; payments: any[] }>('/api/finance/student-fees');
      setFees(res.studentFees || []);
      setPayments(res.payments || []);
      if (user?.role === 'admin') {
        const sRes = await apiRequest<{ students: any[] }>('/api/academics/students');
        setStudents(sRes.students || []);
      }
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const createFee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/finance/student-fees', {
        method: 'POST',
        body: JSON.stringify({
          student_id: Number(newFeeForm.student_id),
          title: newFeeForm.title,
          total_amount: Number(newFeeForm.total_amount),
          discount_amount: Number(newFeeForm.discount_amount || 0),
          due_date: newFeeForm.due_date,
        }),
      });
      toast(t('feeAssignedMsg'));
      setNewFeeForm({ student_id: '', title: '', total_amount: '', discount_amount: '0', due_date: '' });
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalFee) return;
    try {
      const idempotencyKey = `pay-${payModalFee.id}-${Date.now()}`;
      const res = await apiRequest<{ receipt_number: string }>('/api/finance/payments', {
        method: 'POST',
        body: JSON.stringify({
          student_fee_id: payModalFee.id,
          amount: Number(payAmount),
          payment_method: payMethod,
          notes: payNotes,
          idempotency_key: idempotencyKey,
        }),
      });
      toast(t('paymentRecordedMsg', { receipt: res.receipt_number }));
      setPayModalFee(null);
      setPayAmount('');
      setPayNotes('');
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  return (
    <div className="space-y-6">
      {user?.role === 'admin' && (
        <form onSubmit={createFee} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 no-print">
          <h3 className="font-display font-bold text-slate-950 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-700" />
            <span>{t('assignStudentFee')}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm">
            <select required value={newFeeForm.student_id} onChange={(e) => setNewFeeForm({ ...newFeeForm, student_id: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
              <option value="">{t('selectStudentOpt')}</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.student_code} · {s.first_name} {s.last_name}</option>)}
            </select>
            <input required placeholder={t('feeTitlePlaceholder')} value={newFeeForm.title} onChange={(e) => setNewFeeForm({ ...newFeeForm, title: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
            <input required type="number" step="0.01" placeholder={t('amount')} value={newFeeForm.total_amount} onChange={(e) => setNewFeeForm({ ...newFeeForm, total_amount: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
            <input type="number" step="0.01" placeholder={t('discountInput')} value={newFeeForm.discount_amount} onChange={(e) => setNewFeeForm({ ...newFeeForm, discount_amount: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
            <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">{t('assignFeeBtn')}</button>
          </div>
        </form>
      )}

      <DataTable
        rows={fees}
        onExportExcel={user?.role === 'admin' ? () => void downloadAuthenticatedFile('/api/comms/reports/outstanding_balances/excel', 'outstanding_balances.xlsx').catch(() => {}) : undefined}
        columns={[
          ...(user?.role === 'admin' ? [{ key: 'stu', header: t('studentCol'), render: (r: any) => <span className="font-medium">{r.student_code} · {r.student_name}</span> }] : []),
          { key: 'title', header: t('feeItemCol'), render: (r) => <span className="font-semibold">{r.title}</span> },
          { key: 'net', header: t('netTotalCol'), align: 'end', render: (r) => <span className="font-mono" dir="ltr">{formatCurrency(computeFeeSummary(r.total_amount, r.discount_amount, r.paid_amount).netTotal)}</span> },
          { key: 'paid', header: t('paidCol'), align: 'end', render: (r) => <span className="font-mono text-emerald-700" dir="ltr">{formatCurrency(r.paid_amount)}</span> },
          { key: 'rem', header: t('remainingCol'), align: 'end', render: (r) => <span className="font-mono font-bold text-slate-950" dir="ltr">{formatCurrency(computeFeeSummary(r.total_amount, r.discount_amount, r.paid_amount).remaining)}</span> },
          { key: 'status', header: t('status'), render: (r) => <span className={`text-xs font-semibold ${r.status === 'paid' ? 'text-emerald-700' : r.status === 'partial' ? 'text-amber-700' : 'text-red-600'}`}>{tStatus(r.status)}</span> },
          ...(user?.role === 'admin'
            ? [
                {
                  key: 'pay',
                  header: t('actions'),
                  render: (r: any) => {
                    const rem = computeFeeSummary(r.total_amount, r.discount_amount, r.paid_amount).remaining;
                    return rem > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPayModalFee(r);
                          setPayAmount(String(rem));
                        }}
                        className="px-3 py-1 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
                      >
                        {t('recordPayment')}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">{t('statusSettled')}</span>
                    );
                  },
                },
              ]
            : []),
        ]}
      />

      <div className="space-y-2">
        <h3 className="font-display font-bold text-slate-950 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-blue-700" />
          <span>{t('immutableReceiptsTitle')}</span>
        </h3>
        <DataTable
          rows={payments}
          onExportExcel={user?.role === 'admin' ? () => void downloadAuthenticatedFile('/api/comms/reports/fee_payments/excel', 'fee_payments.xlsx').catch(() => {}) : undefined}
          columns={[
            { key: 'rcp', header: t('receiptNumCol'), render: (r) => <span className="font-mono font-semibold text-blue-700">{r.receipt_number}</span> },
            { key: 'date', header: t('date'), render: (r) => <span className="font-mono">{r.payment_date}</span> },
            ...(user?.role === 'admin' ? [{ key: 'stu', header: t('studentCol'), render: (r: any) => <span>{r.student_name}</span> }] : []),
            { key: 'method', header: t('methodCol'), render: (r) => <span>{tMethod(r.payment_method)}</span> },
            { key: 'amt', header: t('amount'), align: 'end', render: (r) => <span className="font-mono font-bold" dir="ltr">{formatCurrency(r.amount)}</span> },
            {
              key: 'prt',
              header: t('print'),
              render: (r) => (
                <button type="button" onClick={() => setReceiptModal(r)} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-50">
                  <Printer className="w-3.5 h-3.5" /> {t('printReceipt')}
                </button>
              ),
            },
          ]}
        />
      </div>

      {/* Record Payment Modal */}
      {payModalFee && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <form onSubmit={submitPayment} className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4">
            <h3 className="font-display font-bold text-lg text-slate-950">{t('recordPayment')}</h3>
            <div className="text-xs text-slate-600">{payModalFee.student_name} · {payModalFee.title}</div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('amount')}</label>
              <input type="number" step="0.01" min="0.01" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('paymentMethodLabel')}</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="cash">{t('methodCash')}</option>
                <option value="bank">{t('methodBank')}</option>
                <option value="card">{t('methodCard')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{t('notes')}</label>
              <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPayModalFee(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">{t('cancel')}</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">{t('confirmPaymentBtn')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Printable Official Receipt Modal */}
      {receiptModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl p-8 space-y-4 print-only-container">
            <div className="flex items-start justify-between border-b border-slate-300 pb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-950">{t('appName')}</h2>
                <p className="text-xs text-slate-500">{t('officialPaymentReceipt')}</p>
              </div>
              <div className="text-end font-mono text-xs">
                <div className="font-bold text-blue-700">{receiptModal.receipt_number}</div>
                <div>{receiptModal.payment_date}</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">{t('studentColon')}</span><span className="font-semibold">{receiptModal.student_name || user?.full_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t('feeItemColon')}</span><span>{receiptModal.fee_title || t('tuitionFeeFallback')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t('methodColon')}</span><span>{tMethod(receiptModal.payment_method)}</span></div>
              <div className="flex justify-between pt-3 border-t border-slate-200 text-base font-bold">
                <span>{t('amountPaidColon')}</span>
                <span className="font-mono text-emerald-700" dir="ltr">{formatCurrency(receiptModal.amount)}</span>
              </div>
            </div>
            <div className="pt-6 flex justify-end gap-2 no-print">
              <button type="button" onClick={() => setReceiptModal(null)} className="px-4 py-2 text-xs border border-slate-300 rounded-lg">{t('close')}</button>
              <button type="button" onClick={() => window.print()} className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg inline-flex items-center gap-1.5">
                <Printer className="w-4 h-4" /> {t('printReceipt')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── INCOME, EXPENSES & FINANCIAL DASHBOARD ──────────────────────────────────
export const AccountingModule: React.FC = () => {
  const { t, translateServerError } = useI18n();
  const { toast } = useFeedback();
  const [summary, setSummary] = useState<any>(null);
  const [income, setIncome] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [incForm, setIncForm] = useState({ title: '', category: '', amount: '', income_date: new Date().toISOString().slice(0, 10), description: '' });
  const [expForm, setExpForm] = useState({ title: '', category: '', amount: '', expense_date: new Date().toISOString().slice(0, 10), description: '' });

  const load = async () => {
    try {
      const [sum, inc, exp] = await Promise.all([
        apiRequest('/api/finance/summary'),
        apiRequest<{ income: any[] }>('/api/finance/income'),
        apiRequest<{ expenses: any[] }>('/api/finance/expenses'),
      ]);
      setSummary(sum);
      setIncome(inc.income || []);
      setExpenses(exp.expenses || []);
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const chartConfig = useMemo(() => {
    const months = summary?.monthly_chart || [];
    return {
      type: 'bar' as const,
      data: {
        labels: months.map((m: any) => m.month),
        datasets: [
          { label: t('kpiTotalIncome'), data: months.map((m: any) => m.income), backgroundColor: '#1d4ed8' },
          { label: t('kpiTotalExpenses'), data: months.map((m: any) => m.expenses), backgroundColor: '#dc2626' },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    };
  }, [summary, t]);

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{t('kpiTotalIncome')}</div>
            <div className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums" dir="ltr">{formatCurrency(summary.total_income)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{t('kpiTotalExpenses')}</div>
            <div className="mt-1 font-mono text-2xl font-bold text-red-600 tabular-nums" dir="ltr">{formatCurrency(Number(summary.total_expenses) + Number(summary.total_salaries_paid))}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{t('kpiNetBalance')}</div>
            <div className="mt-1 font-mono text-2xl font-bold text-slate-950 tabular-nums" dir="ltr">{formatCurrency(summary.net_balance)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{t('kpiOutstandingFees')}</div>
            <div className="mt-1 font-mono text-2xl font-bold text-amber-700 tabular-nums" dir="ltr">{formatCurrency(summary.outstanding_fees)}</div>
          </div>
        </div>
      )}

      {summary?.monthly_chart?.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-display font-bold text-slate-950 mb-4">{t('chartMonthlyFinance')}</h3>
          <ChartCanvas config={chartConfig} label={t('chartMonthlyFinance')} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiRequest('/api/finance/income', {
                method: 'POST',
                body: JSON.stringify({ ...incForm, category: incForm.category || t('defaultCategoryWorkshops'), amount: Number(incForm.amount) }),
              });
              toast(t('incomeRecordedMsg'));
              setIncForm({ ...incForm, title: '', amount: '' });
              void load();
            } catch (err: any) {
              toast(translateServerError(err?.message), 'error');
            }
          }}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
        >
          <h3 className="font-display font-bold text-slate-950 flex items-center gap-2"><Banknote className="w-4 h-4 text-emerald-700" /> {t('recordOtherIncome')}</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <input required placeholder={t('title')} value={incForm.title} onChange={(e) => setIncForm({ ...incForm, title: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
            <input placeholder={t('defaultCategoryWorkshops')} value={incForm.category} onChange={(e) => setIncForm({ ...incForm, category: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
            <input required type="number" step="0.01" placeholder={t('amount')} value={incForm.amount} onChange={(e) => setIncForm({ ...incForm, amount: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
            <input type="date" value={incForm.income_date} onChange={(e) => setIncForm({ ...incForm, income_date: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
          </div>
          <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg">{t('addIncomeBtn')}</button>
        </form>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiRequest('/api/finance/expenses', {
                method: 'POST',
                body: JSON.stringify({ ...expForm, category: expForm.category || t('defaultCategoryUtilities'), amount: Number(expForm.amount) }),
              });
              toast(t('expenseRecordedMsg'));
              setExpForm({ ...expForm, title: '', amount: '' });
              void load();
            } catch (err: any) {
              toast(translateServerError(err?.message), 'error');
            }
          }}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
        >
          <h3 className="font-display font-bold text-slate-950 flex items-center gap-2"><Wallet className="w-4 h-4 text-red-600" /> {t('recordExpense')}</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <input required placeholder={t('title')} value={expForm.title} onChange={(e) => setExpForm({ ...expForm, title: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
            <input placeholder={t('defaultCategoryUtilities')} value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg" />
            <input required type="number" step="0.01" placeholder={t('amount')} value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
            <input type="date" value={expForm.expense_date} onChange={(e) => setExpForm({ ...expForm, expense_date: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
          </div>
          <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg">{t('addExpenseBtn')}</button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DataTable
          rows={income}
          pageSize={6}
          onExportExcel={() => void downloadAuthenticatedFile('/api/comms/reports/income/excel', 'income.xlsx').catch(() => {})}
          columns={[
            { key: 'date', header: t('date'), render: (r) => <span className="font-mono text-xs">{r.income_date}</span> },
            { key: 'title', header: t('incomeItemCol'), render: (r) => <span className="font-medium">{r.title}</span> },
            { key: 'amt', header: t('amount'), align: 'end', render: (r) => <span className="font-mono text-emerald-700 font-semibold" dir="ltr">{formatCurrency(r.amount)}</span> },
          ]}
        />
        <DataTable
          rows={expenses}
          pageSize={6}
          onExportExcel={() => void downloadAuthenticatedFile('/api/comms/reports/expenses/excel', 'expenses.xlsx').catch(() => {})}
          columns={[
            { key: 'date', header: t('date'), render: (r) => <span className="font-mono text-xs">{r.expense_date}</span> },
            { key: 'title', header: t('expenseItemCol'), render: (r) => <span className="font-medium">{r.title}</span> },
            { key: 'amt', header: t('amount'), align: 'end', render: (r) => <span className="font-mono text-red-600 font-semibold" dir="ltr">{formatCurrency(r.amount)}</span> },
          ]}
        />
      </div>
    </div>
  );
};

// ─── TEACHER SALARIES MODULE ─────────────────────────────────────────────────
export const SalariesModule: React.FC = () => {
  const { t, translateServerError } = useI18n();
  const { toast } = useFeedback();
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [form, setForm] = useState({ teacher_id: '', pay_month: new Date().toISOString().slice(0, 7), gross_amount: '1000', paid_amount: '1000', payment_method: 'bank', notes: '' });

  const load = async () => {
    try {
      const res = await apiRequest<{ definitions: any[]; payments: any[] }>('/api/finance/salaries');
      setDefinitions(res.definitions || []);
      setPayments(res.payments || []);
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const paySalary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/finance/salaries/payments', {
        method: 'POST',
        body: JSON.stringify({ ...form, teacher_id: Number(form.teacher_id), gross_amount: Number(form.gross_amount), paid_amount: Number(form.paid_amount) }),
      });
      toast(t('salaryPaidMsg'));
      void load();
    } catch (err: any) {
      toast(translateServerError(err?.message), 'error');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={paySalary} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="font-display font-bold text-slate-950">{t('disburseSalaryTitle')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm">
          <select
            required
            value={form.teacher_id}
            onChange={(e) => {
              const def = definitions.find((d) => String(d.teacher_id) === e.target.value);
              const gross = def ? Number(def.base_amount) + Number(def.allowance) - Number(def.deduction) : 1000;
              setForm({ ...form, teacher_id: e.target.value, gross_amount: String(gross), paid_amount: String(gross) });
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
          >
            <option value="">{t('selectTeacherOpt')}</option>
            {definitions.map((d) => <option key={d.teacher_id} value={d.teacher_id}>{d.teacher_name}</option>)}
          </select>
          <input type="month" value={form.pay_month} onChange={(e) => setForm({ ...form, pay_month: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
          <input type="number" step="0.01" placeholder={t('grossInput')} value={form.gross_amount} onChange={(e) => setForm({ ...form, gross_amount: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
          <input type="number" step="0.01" placeholder={t('paidInput')} value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg font-mono" />
          <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">{t('paySalaryBtn')}</button>
        </div>
      </form>

      <DataTable
        rows={payments}
        onExportExcel={() => void downloadAuthenticatedFile('/api/comms/reports/teacher_salaries/excel', 'teacher_salaries.xlsx').catch(() => {})}
        columns={[
          { key: 'month', header: t('monthCol'), render: (r) => <span className="font-mono">{r.pay_month}</span> },
          { key: 'tch', header: t('teacherCol'), render: (r) => <span className="font-semibold">{r.teacher_name}</span> },
          { key: 'gross', header: t('grossCol'), align: 'end', render: (r) => <span className="font-mono" dir="ltr">{formatCurrency(r.gross_amount)}</span> },
          { key: 'paid', header: t('paidCol'), align: 'end', render: (r) => <span className="font-mono text-emerald-700" dir="ltr">{formatCurrency(r.paid_amount)}</span> },
          { key: 'rem', header: t('remainingCol'), align: 'end', render: (r) => <span className="font-mono" dir="ltr">{formatCurrency(r.remaining_balance)}</span> },
          { key: 'date', header: t('paidDateCol'), render: (r) => <span className="font-mono text-xs">{r.payment_date}</span> },
        ]}
      />
    </div>
  );
};
