import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '../../i18n';

interface AboutUsViewProps {
  aboutSection: any;
  aboutMeta: {
    history?: string;
    mission?: string;
    vision?: string;
    objectives?: string;
    values?: Array<{ title: string; description: string }>;
  };
  whySection: any;
  whyCards: Array<{ title: string; description: string }>;
  onNavigateCourses: () => void;
  onNavigateLogin: () => void;
}

export const AboutUsView: React.FC<AboutUsViewProps> = ({
  aboutSection,
  aboutMeta,
  whySection,
  whyCards,
  onNavigateCourses,
  onNavigateLogin,
}) => {
  const { t } = useI18n();

  const values = Array.isArray(aboutMeta?.values) ? aboutMeta.values.filter((v) => v?.title) : [];
  const pillars = Array.isArray(whyCards) ? whyCards.filter((c) => c?.title) : [];
  const headline = aboutSection?.title || t('aboutPageHeadline');
  const eyebrow = aboutSection?.subtitle || t('aboutPageEyebrow');

  return (
    <main className="flex-1 bg-[#FAF8F4] text-stone-900">
      {/* Editorial Header & Introduction */}
      <section className="border-b border-stone-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="text-xs font-medium text-blue-900 tracking-wide mb-4">
            {eyebrow}
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold text-stone-950 leading-tight tracking-tight max-w-3xl [text-wrap:balance]">
            {headline}
          </h1>

          {aboutSection?.content_html && (
            <div
              className="mt-8 pt-8 border-t border-stone-200 max-w-3xl text-base sm:text-lg text-stone-700 leading-[1.85] space-y-4"
              dangerouslySetInnerHTML={{ __html: aboutSection.content_html }}
            />
          )}
        </div>
      </section>

      {/* Institutional History */}
      {aboutMeta?.history && (
        <section className="border-b border-stone-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-10 items-start">
            <div className="md:col-span-4">
              <div className="font-mono text-xs text-stone-500 mb-1.5 tabular-nums">01</div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-950">
                {t('aboutHistory')}
              </h2>
            </div>
            <div className="md:col-span-8">
              <p className="text-base sm:text-lg text-stone-700 leading-[1.8] max-w-2xl">
                {aboutMeta.history}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Mission & Vision Two-Column Editorial Split */}
      {(aboutMeta?.mission || aboutMeta?.vision) && (
        <section className="border-b border-stone-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid grid-cols-1 md:grid-cols-2 gap-8">
            {aboutMeta?.mission && (
              <div className="border border-stone-200 bg-[#FAF8F4] rounded-xl p-7 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="font-mono text-xs text-stone-500 mb-2 tabular-nums">02</div>
                  <h2 className="font-display text-xl font-bold text-stone-950 mb-4">
                    {t('aboutMission')}
                  </h2>
                  <p className="text-sm sm:text-base text-stone-700 leading-[1.8]">
                    {aboutMeta.mission}
                  </p>
                </div>
              </div>
            )}
            {aboutMeta?.vision && (
              <div className="border border-stone-200 bg-[#FAF8F4] rounded-xl p-7 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="font-mono text-xs text-stone-500 mb-2 tabular-nums">03</div>
                  <h2 className="font-display text-xl font-bold text-stone-950 mb-4">
                    {t('aboutVision')}
                  </h2>
                  <p className="text-sm sm:text-base text-stone-700 leading-[1.8]">
                    {aboutMeta.vision}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Educational Objectives */}
      {aboutMeta?.objectives && (
        <section className="border-b border-stone-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-10 items-start">
            <div className="md:col-span-4">
              <div className="font-mono text-xs text-stone-500 mb-1.5 tabular-nums">04</div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-950">
                {t('aboutObjectives')}
              </h2>
            </div>
            <div className="md:col-span-8">
              <p className="text-base sm:text-lg text-stone-700 leading-[1.8] max-w-2xl">
                {aboutMeta.objectives}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Institutional Values & Academic Standards */}
      {(values.length > 0 || pillars.length > 0) && (
        <section className="border-b border-stone-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-18">
            <div className="max-w-2xl mb-10">
              <div className="font-mono text-xs text-stone-500 mb-1.5 tabular-nums">05</div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-950">
                {whySection?.title || t('aboutValuesTitle')}
              </h2>
            </div>

            {values.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                {values.map((val, idx) => (
                  <div
                    key={idx}
                    className="border border-stone-200 bg-[#FAF8F4] rounded-xl p-6"
                  >
                    <div className="font-mono text-xs text-blue-900 font-semibold mb-2 tabular-nums">
                      0{idx + 1}
                    </div>
                    <h3 className="font-display text-base sm:text-lg font-bold text-stone-950">
                      {val.title}
                    </h3>
                    <p className="mt-2 text-sm text-stone-600 leading-relaxed">
                      {val.description}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {pillars.length > 0 && (
              <div className="border-t border-stone-200 pt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {pillars.map((card, idx) => (
                  <div key={idx} className="border border-stone-200 bg-white rounded-xl p-5">
                    <h3 className="font-display text-sm sm:text-base font-bold text-stone-950">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-stone-600 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Quiet Institutional Closing Action */}
      <section className="py-14 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-stone-200 bg-white rounded-2xl p-8 sm:p-10">
          <div className="max-w-xl">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-950">
              {t('aboutStartJourneyTitle')}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-stone-600 leading-relaxed">
              {t('aboutStartJourneyDesc')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onNavigateCourses}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-stone-900 bg-[#FAF8F4] border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors whitespace-nowrap"
            >
              <span>{t('viewAllCourses')}</span>
            </button>
            <button
              type="button"
              onClick={onNavigateLogin}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap"
            >
              <span>{t('portalLogin')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};
