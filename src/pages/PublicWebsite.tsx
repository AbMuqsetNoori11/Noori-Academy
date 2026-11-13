import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Globe,
  Mail,
  MapPin,
  Menu,
  Phone,
  X,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';
import { BrandLogo } from '../components/ui/BrandLogo';
import { formatCurrency } from '../utils/eduLogic';
import { resolveMediaUrl } from '../utils/mediaAssets';
import type { PublicRouteType } from '../App';
import { AboutUsView } from '../components/public/AboutUsView';
import {
  CoursesListingView,
  GalleryListingView,
  TeachersListingView,
} from '../components/public/PublicListingViews';

interface PublicWebsiteProps {
  publicRoute: PublicRouteType;
  onNavigatePublic: (path: string) => void;
  onNavigateLogin: () => void;
  activePageSlug?: string | null;
  onNavigatePage: (slug: string | null) => void;
}

export const PublicWebsite: React.FC<PublicWebsiteProps> = ({
  publicRoute,
  onNavigatePublic,
  onNavigateLogin,
  activePageSlug,
  onNavigatePage,
}) => {
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [slideIdx, setSlideIdx] = useState(0);
  const [lightboxItem, setLightboxItem] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadBootstrap = () => {
    setLoading(true);
    setLoadError('');
    fetch('/api/public/bootstrap')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => setData(json))
      .catch(() => setLoadError(t('loadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (publicRoute === 'contact') {
      const timer = setTimeout(() => {
        document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [publicRoute, loading]);

  const sliders = data?.sliders || [];
  const intervalMs = Math.max(3000, Number(data?.settings?.slider_interval_ms || 6000));

  useEffect(() => {
    if (sliders.length <= 1) return;
    const timer = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % sliders.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [sliders.length, intervalMs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-600">{t('loading')}</div>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-sm font-medium text-red-700">{loadError || t('loadFailed')}</div>
        <button
          type="button"
          onClick={loadBootstrap}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  const {
    settings,
    sections,
    menus = [],
    pages = [],
    featuredCourses = [],
    featuredTeachers = [],
    topStudents = [],
    stats,
  } = data;

  const aboutSection = sections.find((s: any) => s.section_key === 'about');
  const whySection = sections.find((s: any) => s.section_key === 'why_choose_us');
  let aboutMeta: any = {};
  let whyCards: Array<{ title: string; description: string }> = [];
  try {
    aboutMeta = aboutSection?.meta_json ? JSON.parse(aboutSection.meta_json) : {};
  } catch {
    aboutMeta = {};
  }
  try {
    whyCards = whySection?.meta_json ? JSON.parse(whySection.meta_json).cards || [] : [];
  } catch {
    whyCards = [];
  }

  const safePages = (pages || []).filter((p: any) => p.slug !== 'academic-calendar');
  const activeCustomPage =
    publicRoute === 'custom' && activePageSlug && activePageSlug !== 'academic-calendar'
      ? safePages.find((p: any) => p.slug === activePageSlug)
      : null;

  const primaryNavLinks: Array<{ key: PublicRouteType; label: string; path: string }> = [
    { key: 'home', label: t('home'), path: '/' },
    { key: 'courses', label: t('navCourses'), path: '/courses' },
    { key: 'teachers', label: t('navFaculty'), path: '/teachers' },
    { key: 'gallery', label: t('navGallery'), path: '/gallery' },
    { key: 'about', label: t('navAbout'), path: '/about' },
    { key: 'contact', label: t('navContact'), path: '/#contact' },
  ];

  // Include only admin-added custom CMS links that aren't duplicating core routes or academic-calendar
  const coreUrls = new Set([
    '/',
    '/courses',
    '/teachers',
    '/gallery',
    '/about',
    '/contact',
    '/#contact',
    '#courses',
    '#teachers',
    '#gallery',
    '#about',
    '#contact',
  ]);
  const extraMenus = (menus || []).filter(
    (m: any) =>
      !coreUrls.has(String(m.url || '').trim()) &&
      m.target_page_slug !== 'academic-calendar' &&
      !String(m.url || '').includes('academic-calendar')
  );

  const handlePublicLink = (url: string, targetPageSlug?: string) => {
    setMobileMenuOpen(false);
    if (targetPageSlug && targetPageSlug !== 'academic-calendar') {
      onNavigatePage(targetPageSlug);
      return;
    }
    const clean = String(url || '').trim();
    if (clean === '/login') {
      onNavigateLogin();
      return;
    }
    if (clean === '#courses' || clean === '/courses') {
      onNavigatePublic('/courses');
      return;
    }
    if (clean === '#teachers' || clean === '/teachers') {
      onNavigatePublic('/teachers');
      return;
    }
    if (clean === '#gallery' || clean === '/gallery') {
      onNavigatePublic('/gallery');
      return;
    }
    if (clean === '#about' || clean === '/about') {
      onNavigatePublic('/about');
      return;
    }
    if (clean === '#contact' || clean === '/#contact' || clean === '/contact') {
      onNavigatePublic('/#contact');
      return;
    }
    if (clean.startsWith('/page/')) {
      onNavigatePage(clean.slice('/page/'.length));
      return;
    }
    if (clean.startsWith('/')) {
      onNavigatePublic(clean);
      return;
    }
    if (clean.startsWith('#')) {
      const id = clean.slice(1);
      onNavigatePublic(`/#${id}`);
      return;
    }
    window.open(clean, '_blank', 'noopener,noreferrer');
  };

  const currentSlide = sliders[slideIdx] || sliders[0];

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col overflow-x-hidden">
      {/* Responsive Clean Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 public-navbar">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Title */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setMobileMenuOpen(false);
              onNavigatePublic('/');
            }}
            className="inline-flex items-center gap-2.5 font-display text-base sm:text-lg font-bold tracking-tight text-slate-950 min-w-0 max-w-[180px] sm:max-w-none"
          >
            <BrandLogo
              logoUrl={settings.site_logo_url}
              alt={settings.site_name || t('appName')}
              sizeClass="w-8 h-8 sm:w-9 sm:h-9"
              iconClass="w-4 h-4 sm:w-5 sm:h-5"
            />
            <span className="truncate">{settings.site_name || t('appName')}</span>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600" aria-label="Main Navigation">
            {primaryNavLinks.map((item) => {
              const isActive =
                publicRoute === item.key && item.key !== 'contact';
              return (
                <a
                  key={item.key}
                  href={item.path}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigatePublic(item.path);
                  }}
                  className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
                    isActive
                      ? 'text-blue-700 border-blue-700 font-semibold'
                      : 'border-transparent hover:text-blue-700'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
            {extraMenus.slice(0, 2).map((m: any) => (
              <a
                key={m.id}
                href={m.url}
                onClick={(e) => {
                  e.preventDefault();
                  handlePublicLink(m.url, m.target_page_slug);
                }}
                className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                {m.label}
              </a>
            ))}
          </nav>

          {/* Action Zone: Language Switcher + Login + Always-Visible Mobile Menu Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <LanguageSwitcher compact />
            <button
              type="button"
              onClick={onNavigateLogin}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              {t('portalLogin')}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={t('toggleNavMenu')}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile Navigation"
            className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-1 shadow-lg"
          >
            {primaryNavLinks.map((item) => {
              const isActive = publicRoute === item.key && item.key !== 'contact';
              return (
                <a
                  key={item.key}
                  href={item.path}
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileMenuOpen(false);
                    onNavigatePublic(item.path);
                  }}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-blue-700'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
            {extraMenus.map((m: any) => (
              <a
                key={m.id}
                href={m.url}
                onClick={(e) => {
                  e.preventDefault();
                  handlePublicLink(m.url, m.target_page_slug);
                }}
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-700"
              >
                {m.label}
              </a>
            ))}
            <div className="pt-2 mt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateLogin();
                }}
                className="w-full py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800"
              >
                {t('portalLogin')}
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* Independent Route Rendering */}
      {publicRoute === 'courses' ? (
        <CoursesListingView />
      ) : publicRoute === 'teachers' ? (
        <TeachersListingView />
      ) : publicRoute === 'gallery' ? (
        <GalleryListingView onOpenLightbox={setLightboxItem} />
      ) : publicRoute === 'about' ? (
        <AboutUsView
          aboutSection={aboutSection}
          aboutMeta={aboutMeta}
          whySection={whySection}
          whyCards={whyCards}
          onNavigateCourses={() => onNavigatePublic('/courses')}
          onNavigateLogin={onNavigateLogin}
        />
      ) : activeCustomPage ? (
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-14">
          <button
            type="button"
            onClick={() => onNavigatePublic('/')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline mb-6"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            <span>{t('home')}</span>
          </button>
          <article className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 mb-4">{activeCustomPage.title}</h1>
            <div className="text-xs text-slate-500 mb-6 tabular-nums">
              {t('updatedLabel')}: {activeCustomPage.updated_at}
            </div>
            <div
              className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-4"
              dangerouslySetInnerHTML={{ __html: activeCustomPage.content_html }}
            />
          </article>
        </main>
      ) : (
        <main id="top" className="flex-1">
          {/* Animated Hero Slider */}
          {currentSlide && (
            <section className="relative h-[460px] sm:h-[540px] bg-slate-950 overflow-hidden">
              {sliders.map((slide: any, idx: number) => (
                <div
                  key={slide.id}
                  className={`absolute inset-0 transition-opacity duration-700 ${
                    idx === slideIdx ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                  }`}
                >
                  <img
                    src={resolveMediaUrl(slide.image_url)}
                    alt={slide.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-slate-950/30" />
                  <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-slate-950/80 via-slate-950/45 to-transparent" />
                  <div className="absolute inset-0 max-w-7xl mx-auto px-4 sm:px-6 flex flex-col justify-end pb-14 sm:pb-16">
                    <div className="max-w-2xl">
                      <p className="text-xs sm:text-sm font-medium text-amber-300 mb-2">
                        {settings.site_name} · {settings.site_tagline}
                      </p>
                      <h1 className="font-display text-2xl sm:text-5xl font-bold text-white leading-tight tracking-tight [text-wrap:balance]">
                        {slide.title}
                      </h1>
                      <p className="mt-3 text-sm sm:text-lg text-slate-200 leading-relaxed max-w-xl">{slide.subtitle}</p>
                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <a
                          href={slide.button_url || '/courses'}
                          onClick={(e) => {
                            e.preventDefault();
                            handlePublicLink(slide.button_url || '/courses');
                          }}
                          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors"
                        >
                          <span>{slide.button_label || t('heroCta')}</span>
                          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {sliders.length > 1 && (
                <div className="absolute bottom-6 end-6 z-20 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={t('previousSlide')}
                    onClick={() => setSlideIdx((p) => (p - 1 + sliders.length) % sliders.length)}
                    className="p-2 rounded-lg bg-slate-950/70 text-white border border-white/20 hover:bg-slate-900"
                  >
                    <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('nextSlide')}
                    onClick={() => setSlideIdx((p) => (p + 1) % sliders.length)}
                    className="p-2 rounded-lg bg-slate-950/70 text-white border border-white/20 hover:bg-slate-900"
                  >
                    <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Real Live Statistics Strip (3 Metrics Only — Certificates Issued Removed) */}
          <section className="border-b border-slate-200 bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <div className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 tabular-nums">{stats.active_students}</div>
                <div className="mt-1 text-xs sm:text-sm text-slate-600">{t('statsStudents')}</div>
              </div>
              <div>
                <div className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 tabular-nums">{stats.active_teachers}</div>
                <div className="mt-1 text-xs sm:text-sm text-slate-600">{t('statsTeachers')}</div>
              </div>
              <div>
                <div className="font-mono text-2xl sm:text-3xl font-bold text-slate-950 tabular-nums">{stats.active_courses}</div>
                <div className="mt-1 text-xs sm:text-sm text-slate-600">{t('statsCourses')}</div>
              </div>
            </div>
          </section>

          {/* Featured Courses (Admin CMS Controlled Only) */}
          <section id="courses" className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">{t('featuredCoursesTitle')}</h2>
                <p className="mt-2 text-slate-600">{t('featuredCoursesSub')}</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigatePublic('/courses')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
              >
                <span>{t('viewAllCourses')}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>

            {featuredCourses.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-sm text-slate-600 max-w-2xl">{t('noFeaturedCourses')}</p>
                <button
                  type="button"
                  onClick={() => onNavigatePublic('/courses')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap self-start sm:self-auto"
                >
                  {t('viewAllCourses')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredCourses.map((c: any) => (
                  <article key={c.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
                    <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                      {c.image_url ? (
                        <img src={resolveMediaUrl(c.image_url)} alt={c.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <BookOpen className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="text-xs font-mono text-slate-500 mb-1.5 tabular-nums">
                        {c.course_code} · {c.duration_weeks} {t('durationWeeks')} · {t('capacity')}: {c.capacity}
                      </div>
                      <h3 className="font-display text-lg font-bold text-slate-950">{c.title}</h3>
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed flex-1">{c.description}</p>
                      {c.subject_names && (
                        <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                          {c.subject_names}
                        </p>
                      )}
                      <div className="mt-4 flex items-center justify-between text-sm font-semibold text-slate-900 tabular-nums">
                        <span>{t('tuitionFee')}</span>
                        <span className="text-blue-700" dir="ltr">{formatCurrency(c.fee_amount)}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Why Choose Us / Institutional Standards */}
          {whyCards.length > 0 && (
            <section className="bg-slate-50 border-y border-slate-200 py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 mb-10">{whySection?.title || t('whyChooseUsTitle')}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {whyCards.map((card, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-white p-6">
                      <div className="font-mono text-xs font-semibold text-blue-700 mb-2 tabular-nums">0{idx + 1}.</div>
                      <h3 className="font-display text-base font-bold text-slate-950">{card.title}</h3>
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed">{card.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Featured Faculty Showcase (Admin CMS Controlled Only) */}
          <section id="teachers" className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">{t('teachersTitle')}</h2>
                <p className="mt-2 text-slate-600">{t('teachersSub')}</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigatePublic('/teachers')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
              >
                <span>{t('viewAllTeachers')}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>

            {featuredTeachers.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-sm text-slate-600 max-w-2xl">{t('noFeaturedTeachers')}</p>
                <button
                  type="button"
                  onClick={() => onNavigatePublic('/teachers')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap self-start sm:self-auto"
                >
                  {t('viewAllTeachers')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {featuredTeachers.map((tch: any) => (
                  <div key={tch.id} className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col sm:flex-row gap-5 items-start">
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                      {tch.photo_url ? (
                        <img
                          src={resolveMediaUrl(tch.photo_url)}
                          alt={`${tch.first_name} ${tch.last_name}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-display font-bold text-slate-500 text-xl">
                          {tch.first_name[0]}
                          {tch.last_name[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-slate-500 font-medium">
                        {tch.specialization} {tch.qualification ? `· ${tch.qualification}` : ''}
                      </div>
                      <h3 className="font-display text-lg font-bold text-slate-950 mt-0.5">
                        {tch.first_name} {tch.last_name}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed">{tch.bio}</p>
                      {tch.subjects_taught && (
                        <p className="mt-2.5 text-xs text-blue-700 font-medium">{tch.subjects_taught}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Top / Featured Students (Admin CMS Published Only) */}
          {topStudents.length > 0 && (
            <section className="bg-slate-950 text-white py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="max-w-2xl mb-10">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold">{t('topStudentsTitle')}</h2>
                  <p className="mt-2 text-slate-300">{t('topStudentsSub')}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {topStudents.map((st: any) => (
                    <div key={st.id} className="rounded-xl border border-slate-800 bg-slate-900 p-6 flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center font-display text-lg font-bold text-amber-300 shrink-0 overflow-hidden">
                        {st.display_photo_url || st.student_photo ? (
                          <img src={resolveMediaUrl(st.display_photo_url || st.student_photo)} alt={st.first_name} className="w-full h-full object-cover" />
                        ) : (
                          `${st.first_name[0]}${st.last_name[0]}`
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-amber-300 font-medium">{st.achievement_title}</div>
                        <h3 className="font-display text-lg font-bold text-white mt-0.5">
                          {st.first_name} {st.last_name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-300">{st.achievement_detail}</p>
                        <div className="mt-2 text-xs text-slate-400">
                          {st.course_title} {st.class_name ? `· ${st.class_name}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Brief Editorial About Us Teaser -> Dedicated /about Page */}
          {aboutSection && (
            <section id="about" className="bg-[#FAF8F4] border-t border-stone-200 py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className="lg:col-span-7">
                  <p className="text-xs font-semibold text-blue-800 mb-2">{aboutSection.subtitle || t('aboutTitle')}</p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-stone-950">{aboutSection.title}</h2>
                  <div
                    className="mt-4 text-stone-600 leading-relaxed space-y-3 text-sm sm:text-base max-w-2xl"
                    dangerouslySetInnerHTML={{ __html: aboutSection.content_html }}
                  />
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => onNavigatePublic('/about')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-stone-900 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors"
                    >
                      <span>{t('aboutExploreProfile')}</span>
                      <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
                <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                  {aboutMeta.mission && (
                    <div className="rounded-xl border border-stone-200 bg-white p-5">
                      <h3 className="font-display text-sm font-bold text-stone-950">{t('aboutMission')}</h3>
                      <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">{aboutMeta.mission}</p>
                    </div>
                  )}
                  {aboutMeta.vision && (
                    <div className="rounded-xl border border-stone-200 bg-white p-5">
                      <h3 className="font-display text-sm font-bold text-stone-950">{t('aboutVision')}</h3>
                      <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">{aboutMeta.vision}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Call To Action & Contact */}
          <section id="contact" className="border-t border-slate-200 bg-white py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-6 rounded-2xl bg-slate-950 text-white p-8 flex flex-col justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold">{t('ctaTitle')}</h2>
                  <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">{t('ctaDesc')}</p>
                </div>
                <div className="mt-8">
                  <button
                    type="button"
                    onClick={onNavigateLogin}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <span>{t('ctaButton')}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 rounded-2xl border border-slate-200 p-8">
                <h2 className="font-display text-xl font-bold text-slate-950 mb-5">{t('contactTitle')}</h2>
                <div className="space-y-4 text-sm text-slate-700">
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-blue-700 mt-1 shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500">{t('contactPhone')}</div>
                      <div dir="ltr" className="font-medium tabular-nums inline-block">{settings.contact_phone}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-blue-700 mt-1 shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500">{t('contactEmail')}</div>
                      <div className="font-medium">{settings.contact_email}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-blue-700 mt-1 shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500">{t('contactAddress')}</div>
                      <div className="font-medium">{settings.contact_address}</div>
                      {settings.map_embed_note && <div className="text-xs text-slate-500 mt-0.5 font-mono">{settings.map_embed_note}</div>}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-xs font-medium text-blue-700">
                    {settings.social_facebook && (
                      <a href={settings.social_facebook} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" /> {t('socialFacebook')}
                      </a>
                    )}
                    {settings.social_telegram && (
                      <a href={settings.social_telegram} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" /> {t('socialTelegram')}
                      </a>
                    )}
                    {settings.social_linkedin && (
                      <a href={settings.social_linkedin} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" /> {t('socialLinkedIn')}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2.5">
            <BrandLogo
              logoUrl={settings.site_logo_url}
              alt={settings.site_name || t('appName')}
              sizeClass="w-7 h-7"
              iconClass="w-4 h-4"
            />
            <span>{settings.footer_text}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button type="button" onClick={() => onNavigatePublic('/courses')} className="hover:text-slate-900 hover:underline">
              {t('navCourses')}
            </button>
            <button type="button" onClick={() => onNavigatePublic('/teachers')} className="hover:text-slate-900 hover:underline">
              {t('navFaculty')}
            </button>
            <button type="button" onClick={() => onNavigatePublic('/gallery')} className="hover:text-slate-900 hover:underline">
              {t('navGallery')}
            </button>
            <button type="button" onClick={() => onNavigatePublic('/about')} className="hover:text-slate-900 hover:underline">
              {t('navAbout')}
            </button>
            {safePages.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onNavigatePage(p.slug)}
                className="hover:text-slate-900 hover:underline"
              >
                {p.title}
              </button>
            ))}
          </div>
        </div>
      </footer>

      {/* Lightbox Modal for Gallery */}
      {lightboxItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div>
                <h3 className="font-display font-bold text-slate-900">{lightboxItem.title}</h3>
                <p className="text-xs text-slate-500">{lightboxItem.category_name}</p>
              </div>
              <button
                type="button"
                aria-label={t('close')}
                onClick={() => setLightboxItem(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-950 flex items-center justify-center max-h-[70vh] overflow-hidden">
              {lightboxItem.media_type === 'video' ? (
                <video src={lightboxItem.file_url} controls className="max-h-[70vh] w-full" />
              ) : (
                <img src={resolveMediaUrl(lightboxItem.file_url)} alt={lightboxItem.title} className="max-h-[70vh] object-contain" />
              )}
            </div>
            {lightboxItem.description && (
              <div className="p-4 text-sm text-slate-700 bg-white border-t border-slate-200">{lightboxItem.description}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
