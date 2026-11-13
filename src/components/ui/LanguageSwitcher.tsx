import React from 'react';
import { Globe } from 'lucide-react';
import { LANGUAGES, type LangCode, useI18n } from '../../i18n';

export const LanguageSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { lang, setLanguage, t } = useI18n();

  return (
    <div className="inline-flex items-center gap-1 sm:gap-1.5 shrink-0">
      <Globe className={`w-4 h-4 text-slate-500 shrink-0 ${compact ? 'hidden sm:block' : ''}`} aria-hidden="true" />
      <label className="sr-only" htmlFor="lang-switcher">
        {t('language')}
      </label>
      <select
        id="lang-switcher"
        aria-label={t('language')}
        value={lang}
        onChange={(e) => setLanguage(e.target.value as LangCode, true)}
        className={`bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 cursor-pointer ${
          compact ? 'text-xs px-1.5 sm:px-2 py-1.5 max-w-[84px] sm:max-w-none' : 'text-sm px-2.5 py-1.5'
        }`}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.nativeLabel}
          </option>
        ))}
      </select>
    </div>
  );
};
