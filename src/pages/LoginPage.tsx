import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpenCheck, KeyRound, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { BrandLogo } from '../components/ui/BrandLogo';
import { useFeedback } from '../components/ui/ToastAndConfirm';
import { apiRequest } from '../utils/api';

interface LoginPageProps {
  onBackToPublic: () => void;
  onLoginSuccess: (role: 'admin' | 'teacher' | 'student') => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onBackToPublic, onLoginSuccess }) => {
  const { login, branding } = useAuth();
  const { t, translateServerError } = useI18n();
  const { toast } = useFeedback();

  const [bookOpen, setBookOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || window.location.search.includes('autostart=1')) {
      setBookOpen(true);
      return;
    }
    const timer = setTimeout(() => setBookOpen(true), 280);
    return () => clearTimeout(timer);
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!identifier.trim() || !password) {
      setErrorMsg(t('loginValidationMissing'));
      return;
    }
    setBusy(true);
    try {
      const user = await login(identifier.trim(), password);
      toast(t('welcomeUser', { name: user.full_name }), 'success');
      onLoginSuccess(user.role);
    } catch (err: any) {
      setErrorMsg(err?.message ? translateServerError(err.message) : t('loginFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!identifier.trim()) {
      setErrorMsg(t('resetValidationMissing'));
      return;
    }
    setBusy(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/password-reset-request', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), reason: resetReason.trim() }),
      });
      toast(res.message ? translateServerError(res.message) : t('successSaved'), 'info');
      setMode('login');
      setResetReason('');
    } catch (err: any) {
      setErrorMsg(err?.message ? translateServerError(err.message) : t('resetRequestFailed'));
    } finally {
      setBusy(false);
    }
  };

  const fillAccount = (u: string, p: string) => {
    setMode('login');
    setIdentifier(u);
    setPassword(p);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 flex flex-col justify-between p-4 sm:p-6 overflow-x-hidden">
      {/* Top Bar */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackToPublic}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('backToWebsite')}</span>
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setBookOpen((v) => !v)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-200 border border-amber-400/30 rounded-lg hover:bg-amber-400/10"
          >
            <BookOpenCheck className="w-3.5 h-3.5" />
            <span>{bookOpen ? t('closeCover') : t('openBook')}</span>
          </button>
          <LanguageSwitcher compact />
        </div>
      </div>

      {/* 3D Educational Book Stage */}
      <div className="flex-1 flex items-center justify-center py-6 sm:py-10 book-stage">
        <div
          data-book-open={bookOpen ? 'true' : 'false'}
          className="book-wrapper w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-2xl shadow-2xl border border-amber-900/40 bg-[#fdfbf5]"
        >
          {/* Animated 3D Hardcover Flap (overlaps right half initially on desktop, swings open smoothly) */}
          <div
            aria-hidden="true"
            className={`book-cover-flap hidden md:block absolute inset-y-0 end-0 w-1/2 z-20 pointer-events-none ${
              bookOpen ? '' : ''
            }`}
          >
            {/* Front of Hardcover */}
            <div className="book-face absolute inset-0 rounded-e-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border-2 border-amber-500/50 p-10 flex flex-col items-center justify-center text-center shadow-2xl">
              <div className="mb-5">
                <BrandLogo
                  logoUrl={branding.site_logo_url}
                  alt={branding.site_name || t('appName')}
                  sizeClass="w-20 h-20"
                  iconClass="w-9 h-9"
                  roundedClass="rounded-full"
                  bgClass="bg-amber-500/10 border-2 border-amber-400/70 text-amber-300"
                />
              </div>
              <div className="font-display text-2xl font-bold text-amber-100 tracking-wide">{branding.site_name || t('appName')}</div>
              <div className="mt-2 text-xs text-amber-300/80 uppercase tracking-[0.2em]">{t('academicRegistry')}</div>
            </div>
            {/* Inside of Hardcover */}
            <div className="book-face book-face-back absolute inset-0 rounded-s-2xl bg-[#f5efe0] border border-amber-900/20 p-8 flex flex-col justify-end">
              <div className="text-xs text-amber-900/60 font-mono">{t('exLibris')}</div>
            </div>
          </div>

          {/* Left Page: Institutional Emblem, Access Info & Quick Account Selector */}
          <div className="p-7 sm:p-10 border-b md:border-b-0 md:border-e border-amber-900/15 bg-gradient-to-br from-[#faf6eb] to-[#f4eedc] rounded-t-2xl md:rounded-s-2xl md:rounded-tr-none flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2.5 text-blue-900 font-display font-bold text-lg">
                {branding.site_logo_url ? (
                  <BrandLogo
                    logoUrl={branding.site_logo_url}
                    alt={branding.site_name || t('appName')}
                    sizeClass="w-9 h-9"
                    iconClass="w-5 h-5"
                  />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-amber-700" />
                )}
                <span>{branding.site_name || t('appName')}</span>
              </div>
              <h2 className="mt-4 font-display text-2xl font-bold text-slate-950 leading-snug">{t('loginTitle')}</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{t('noPublicSignupNote')}</p>

              <div className="mt-6 pt-5 border-t border-amber-900/15">
                <div className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-700" />
                  <span>{t('quickDemoAccess')}</span>
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => fillAccount('admin', 'Admin@2026')}
                    className="w-full text-start px-3 py-2 rounded-lg border border-amber-900/15 bg-white/80 hover:bg-white transition-colors flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-slate-900">{t('roleAdmin')}</span>
                    <span className="font-mono text-slate-600">admin / Admin@2026</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillAccount('teacher1', 'Teacher@2026')}
                    className="w-full text-start px-3 py-2 rounded-lg border border-amber-900/15 bg-white/80 hover:bg-white transition-colors flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-slate-900">{t('roleTeacher')}</span>
                    <span className="font-mono text-slate-600">teacher1 / Teacher@2026</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillAccount('student1', 'Student@2026')}
                    className="w-full text-start px-3 py-2 rounded-lg border border-amber-900/15 bg-white/80 hover:bg-white transition-colors flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-slate-900">{t('roleStudent')}</span>
                    <span className="font-mono text-slate-600">student1 / Student@2026</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 text-xs text-slate-500 font-mono">
              {t('securityTagline')}
            </div>
          </div>

          {/* Right Page: Interactive Login & Admin Reset Form */}
          <div className="p-7 sm:p-10 bg-[#fffdf8] rounded-b-2xl md:rounded-e-2xl md:rounded-bl-none flex flex-col justify-center">
            {mode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-950">{t('signInBtn')}</h1>
                  <p className="mt-1 text-xs text-slate-600">{t('loginSubtitle')}</p>
                </div>

                {errorMsg && (
                  <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label htmlFor="login-identifier" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('usernameOrEmail')}
                  </label>
                  <input
                    id="login-identifier"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="admin / teacher1 / student1"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('password')}
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  <span>{busy ? t('signingIn') : t('signInBtn')}</span>
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setErrorMsg('');
                    }}
                    className="text-xs font-medium text-blue-700 hover:underline inline-flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{t('forgotPassword')}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-950">{t('resetRequestTitle')}</h1>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{t('resetRequestDesc')}</p>
                </div>

                {errorMsg && (
                  <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label htmlFor="reset-identifier" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('usernameOrEmail')}
                  </label>
                  <input
                    id="reset-identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="reset-reason" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('resetReason')}
                  </label>
                  <textarea
                    id="reset-reason"
                    rows={3}
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    {t('backToLogin')}
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60"
                  >
                    {t('submitResetRequest')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-500">
        {t('appFullSubtitle')}
      </div>
    </div>
  );
};
