import React, { createContext, useContext, useEffect, useState } from 'react';
import { en, type TranslationDict, type TranslationKey } from './en';
import { fa } from './fa';
import { ps } from './ps';
import { uz } from './uz';
import { tk } from './tk';

export type LangCode = 'fa' | 'ps' | 'uz' | 'tk' | 'en';

export const LANGUAGES: Array<{ code: LangCode; label: string; nativeLabel: string; dir: 'ltr' | 'rtl' }> = [
  { code: 'fa', label: 'Dari', nativeLabel: 'دری', dir: 'rtl' },
  { code: 'ps', label: 'Pashto', nativeLabel: 'پښتو', dir: 'rtl' },
  { code: 'uz', label: 'Afghan Uzbek', nativeLabel: 'اوزبیکی', dir: 'rtl' },
  { code: 'tk', label: 'Afghan Turkmen', nativeLabel: 'تورکمنی', dir: 'rtl' },
  { code: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr' },
];

export const DICTS: Record<LangCode, TranslationDict> = { fa, ps, uz, tk, en };

export const SUPPORTED_LANGS: LangCode[] = ['fa', 'ps', 'uz', 'tk', 'en'];

const STATUS_KEY_MAP: Record<string, TranslationKey> = {
  active: 'active',
  upcoming: 'statusUpcoming',
  inactive: 'inactive',
  suspended: 'statusSuspended',
  graduated: 'statusGraduated',
  withdrawn: 'statusWithdrawn',
  hidden: 'statusHidden',
  published: 'statusPublished',
  draft: 'statusDraft',
  settled: 'statusSettled',
  pending: 'statusPending',
  resolved: 'statusResolved',
  dismissed: 'statusDismissed',
  enabled: 'statusEnabled',
  paused: 'statusPaused',
  manual: 'statusManual',
  scheduled: 'statusScheduled',
  pre_restore: 'statusPreRestore',
  present: 'present',
  absent: 'absent',
  late: 'late',
  excused: 'excused',
  paid: 'paid',
  partial: 'partial',
  unpaid: 'unpaid',
  submitted: 'submitted',
  graded: 'graded',
  returned: 'returned',
  image: 'mediaImageOpt',
  video: 'mediaVideoOpt',
  academic: 'docCatAcademic',
  identity: 'docCatIdentity',
  contract: 'docCatContract',
  general: 'docCatGeneral',
};

const DAY_KEY_MAP: Record<string, TranslationKey> = {
  saturday: 'daySaturday',
  sunday: 'daySunday',
  monday: 'dayMonday',
  tuesday: 'dayTuesday',
  wednesday: 'dayWednesday',
  thursday: 'dayThursday',
  friday: 'dayFriday',
};

const SESSION_KEY_MAP: Record<string, TranslationKey> = {
  morning: 'sessionMorning',
  afternoon: 'sessionAfternoon',
};

const METHOD_KEY_MAP: Record<string, TranslationKey> = {
  cash: 'methodCash',
  bank: 'methodBank',
  card: 'methodCard',
  transfer: 'methodTransfer',
};

const ROLE_KEY_MAP: Record<string, TranslationKey> = {
  admin: 'roleAdmin',
  teacher: 'roleTeacher',
  student: 'roleStudent',
};

const SEARCH_TYPE_KEY_MAP: Record<string, TranslationKey> = {
  student: 'searchTypeStudent',
  teacher: 'searchTypeTeacher',
  payment: 'searchTypePayment',
  course: 'searchTypeCourse',
  class: 'searchTypeClass',
};

const JOB_TYPE_KEY_MAP: Record<string, TranslationKey> = {
  fee_due_soon: 'jobFeeDueSoon',
  fee_overdue: 'jobFeeOverdue',
  homework_deadline: 'jobHomeworkDeadline',
  upcoming_exam: 'jobUpcomingExam',
};

const SERVER_ERROR_KEY_MAP: Record<string, TranslationKey> = {
  'Invalid credentials.': 'errInvalidCredentials',
  'Account is deactivated. Contact the administrator.': 'errAccountDeactivated',
  'Too many failed login attempts. Please wait 15 minutes or contact an administrator.': 'errTooManyAttempts',
  'New password must be at least 8 characters.': 'errPasswordMin8',
  'Current password is incorrect.': 'errCurrentPasswordIncorrect',
  'Access denied.': 'errAccessDenied',
  'Access denied to this conversation.': 'errAccessDenied',
  Forbidden: 'errForbidden',
  'Forbidden report type for your role.': 'errForbidden',
  'Forbidden report export.': 'errForbidden',
  'This teacher-subject assignment already exists for this class.': 'errAlreadyExists',
};

export function translateKey(lang: LangCode, key: TranslationKey, params?: Record<string, string | number>): string {
  const raw = DICTS[lang]?.[key];
  // Strictly never fall back silently to English when another language is active
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return `[MISSING:${lang}:${String(key)}]`;
  }
  if (!params) return raw;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? ''));
}

interface I18nContextValue {
  lang: LangCode;
  dir: 'ltr' | 'rtl';
  setLanguage: (code: LangCode, persistRemote?: boolean) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  tStatus: (status?: string | null) => string;
  tDay: (day?: string | null) => string;
  tSession: (session?: string | null) => string;
  tMethod: (method?: string | null) => string;
  tRole: (role?: string | null) => string;
  tSearchType: (type?: string | null) => string;
  tJobType: (jobType?: string | null) => string;
  tReportColumn: (col: string) => string;
  translateServerError: (msg?: string | null) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

let languageChangeListener: ((code: LangCode) => void) | null = null;
export function registerLanguageChangeListener(fn: ((code: LangCode) => void) | null): void {
  languageChangeListener = fn;
}

export const I18nProvider: React.FC<{ children: React.ReactNode; initialLang?: LangCode }> = ({
  children,
  initialLang = 'fa',
}) => {
  const [lang, setLang] = useState<LangCode>(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem('danesh_lang') as LangCode | null) : null;
    return saved && SUPPORTED_LANGS.includes(saved) ? saved : initialLang;
  });

  const currentMeta = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = currentMeta.dir;
    localStorage.setItem('danesh_lang', lang);
  }, [lang, currentMeta.dir]);

  const setLanguage = (code: LangCode, persistRemote = true) => {
    if (!SUPPORTED_LANGS.includes(code)) return;
    setLang(code);
    languageChangeListener?.(code);
    if (persistRemote) {
      let authHeader: Record<string, string> = {};
      try {
        const tok = typeof window !== 'undefined' ? window.sessionStorage.getItem('danesh_sid_token') : null;
        if (tok) authHeader = { Authorization: `Bearer ${tok}` };
      } catch {
        // ignore
      }
      fetch('/api/auth/language', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ lang: code }),
      }).catch(() => {});
    }
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string =>
    translateKey(lang, key, params);

  const tStatus = (status?: string | null): string => {
    const norm = String(status || '').trim().toLowerCase();
    const key = STATUS_KEY_MAP[norm];
    return key ? t(key) : String(status || '');
  };

  const tDay = (day?: string | null): string => {
    const norm = String(day || '').trim().toLowerCase();
    const key = DAY_KEY_MAP[norm];
    return key ? t(key) : String(day || '');
  };

  const tSession = (session?: string | null): string => {
    const norm = String(session || '').trim().toLowerCase();
    const key = SESSION_KEY_MAP[norm];
    return key ? t(key) : String(session || '');
  };

  const tMethod = (method?: string | null): string => {
    const norm = String(method || '').trim().toLowerCase();
    const key = METHOD_KEY_MAP[norm];
    return key ? t(key) : String(method || '');
  };

  const tRole = (role?: string | null): string => {
    const norm = String(role || '').trim().toLowerCase();
    const key = ROLE_KEY_MAP[norm];
    return key ? t(key) : String(role || '');
  };

  const tSearchType = (type?: string | null): string => {
    const norm = String(type || '').trim().toLowerCase();
    const key = SEARCH_TYPE_KEY_MAP[norm];
    return key ? t(key) : String(type || '');
  };

  const tJobType = (jobType?: string | null): string => {
    const norm = String(jobType || '').trim().toLowerCase();
    const key = JOB_TYPE_KEY_MAP[norm];
    return key ? t(key) : String(jobType || '');
  };

  const tReportColumn = (col: string): string => {
    const maybeKey = `col_${col}` as TranslationKey;
    if (maybeKey in DICTS.en) {
      return t(maybeKey);
    }
    return col.replace(/_/g, ' ');
  };

  const translateServerError = (msg?: string | null): string => {
    const trimmed = String(msg || '').trim();
    if (!trimmed) return t('errorGeneric');
    const key = SERVER_ERROR_KEY_MAP[trimmed];
    return key ? t(key) : trimmed;
  };

  return (
    <I18nContext.Provider
      value={{
        lang,
        dir: currentMeta.dir,
        setLanguage,
        t,
        tStatus,
        tDay,
        tSession,
        tMethod,
        tRole,
        tSearchType,
        tJobType,
        tReportColumn,
        translateServerError,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
